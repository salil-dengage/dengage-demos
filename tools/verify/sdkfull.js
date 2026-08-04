const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();

const MOCK = () => {
  window.__sent = [];
  window.dengage = function () {
    const a = [...arguments];
    window.__sent.push(a);
    // getContactKey / getDeviceId take a callback
    if (typeof a[1] === 'function') a[1](a[0] === 'getContactKey' ? null : 'dev-abc-123');
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));

  const fail = [];
  const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail.push(msg); };

  // ---------- home page view ----------
  let p = await ctx.newPage();
  await p.addInitScript(MOCK);
  await p.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  let sent = await p.evaluate(() => window.__sent);
  const pv = sent.find(a => a[0] === 'pageView');
  console.log('\n--- HOME ---');
  ok(!!pv, 'pageView fired');
  ok(pv && pv[1].page_type === 'home', 'page_type = home  ' + JSON.stringify(pv && pv[1]));

  // ---------- the funnel ----------
  //    Two different contracts, by industry.
  //
  //    The CantuPneus sites map their funnel onto the ecommerce API, which is
  //    right for a shop: cartItems, unit_price and an order_id all mean
  //    something when you are selling tyres.
  //
  //    The finance sites do NOT. A card has no quantity, a loan has no
  //    shipping method, and an application is approved or declined rather than
  //    ordered. So the assertion inverts: the interesting thing is that no
  //    ec:* call happens at all.
  //
  //    They also differ from each other. FinTech carries no cart-shaped
  //    control whatsoever; Banking keeps a shortlist, which is not a basket
  //    (no quantities, no total) and writes to a custom table. Where such a
  //    control exists it is driven here, because the replacement for the cart
  //    is the thing most worth asserting.
  if (CFG.ecommerceUi === false) {
    console.log('\n--- FUNNEL (no ecommerce API on this site) ---');
    ok(!(await p.$('[data-cart-add]')) && !(await p.$('[data-cart-open]')),
       'no cart controls in the markup');

    if (CFG.shortlistTable && await p.$(CFG.hooks.add)) {
      await p.evaluate(sel => document.querySelector(sel).click(), CFG.hooks.add);
      await p.waitForTimeout(700);
      sent = await p.evaluate(() => window.__sent);
      const rows = sent
        .filter(a => a[0] === 'sendDeviceEvent' && a[1] === CFG.shortlistTable)
        .map(a => a[2]);
      const added = rows.find(r => r && r.event_type === 'product_shortlisted');
      console.log('\n--- SHORTLIST ---');
      ok(!!added, 'product_shortlisted written to ' + CFG.shortlistTable);
      ok(!!(added && added.product_id), 'carries product_id');
      ok(!!(added && added.customer_tier && added.event_source === 'web'),
         'carries the common columns');
      ok(!(added && 'stock_count' in added), 'no stock_count, under any name');
      console.log('        ' + JSON.stringify(added));
    }

    ok(!sent.some(a => typeof a[0] === 'string' && a[0].indexOf('ec:') === 0),
       'no ec:* call is made anywhere on this site');
  } else {
    // ---------- add to cart ----------
    await p.evaluate(() => document.querySelector('[data-cart-add]').click());
    await p.waitForTimeout(700);
    sent = await p.evaluate(() => window.__sent);
    const atc = sent.find(a => a[0] === 'ec:addToCart');
    console.log('\n--- ADD TO CART ---');
    ok(!!atc, 'ec:addToCart fired');
    ok(atc && Array.isArray(atc[1].cartItems) && atc[1].cartItems.length > 0, 'carries cartItems array');
    ok(atc && atc[1].product_id && atc[1].unit_price >= 0, 'has product_id + unit_price');
    console.log('        ' + JSON.stringify(atc && atc[1]));

    // ---------- checkout ----------
    await p.evaluate(() => { document.querySelector('[data-cart-open]').click(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { document.querySelector('[data-cart-checkout]').click(); });
    await p.waitForTimeout(800);
    sent = await p.evaluate(() => window.__sent);
    console.log('\n--- CHECKOUT ---');
    ok(sent.some(a => a[0] === 'ec:beginCheckout'), 'ec:beginCheckout fired');
    const order = sent.find(a => a[0] === 'ec:order');
    ok(!!order, 'ec:order fired');
    ok(order && order[1].order_id && Array.isArray(order[1].cartItems), 'order has order_id + cartItems');
    console.log('        ' + JSON.stringify(order && order[1]));
  }

  // ---------- sign-up identity ----------
  const p2 = await ctx.newPage();
  await p2.addInitScript(MOCK);
  await p2.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1200);
  await p2.evaluate(() => {
    document.querySelector('[data-login-btn]').click();
    document.getElementById('loginFirstName').value = 'Joao';
    document.getElementById('loginLastName').value = 'Silva';
    document.getElementById('loginEmail').value = 'joao@transportes.com.br';
    document.getElementById('loginPassword').value = 'segredo123';
    document.getElementById('loginForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });
  await p2.waitForTimeout(700);
  sent = await p2.evaluate(() => window.__sent);
  console.log('\n--- SIGN UP ---');
  const ck = sent.find(a => a[0] === 'setContactKey');
  ok(!!ck, 'setContactKey fired');
  /* The key sent is the RESOLVED contact key from js/identity.js, which falls
     back to the email for any address that is not a mapped demo contact. It is
     not simply "the email": sending the email where the real contact_key differed
     created a second contact and nothing attached to the real one. */
  ok(ck && ck[1] === 'joao@transportes.com.br',
     'unmapped address resolves to itself  ' + JSON.stringify(ck && ck[1]));
  const mapped = await p2.evaluate(() =>
    window.DengageIdentity && window.DengageIdentity.keyFor('salil@dengage.com'));
  ok(mapped === 'salil-demo', 'mapped demo contact resolves to its contact key  ' + JSON.stringify(mapped));
  const initArg = await p2.evaluate(() => {
    const i = window.__sent.findIndex(a => a[0] === 'initialize');
    const v = window.__sent.findIndex(a => a[0] === 'pageView');
    return { i, v, ordered: i >= 0 && v >= 0 ? i < v : null };
  });
  ok(initArg.ordered !== false, 'initialize runs before pageView  ' + JSON.stringify(initArg));

  // ---------- product page view ----------
  const p3 = await ctx.newPage();
  await p3.addInitScript(MOCK);
  await p3.goto(CFG.product, { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(2500);
  sent = await p3.evaluate(() => window.__sent);
  const ppv = sent.find(a => a[0] === 'pageView');
  console.log('\n--- PRODUCT PAGE ---');
  ok(!!ppv, 'pageView fired');
  ok(ppv && ppv[1].page_type === 'product', 'page_type = product');
  ok(ppv && ppv[1].product_id === CFG.productId, 'carries product_id');
  ok(!!(ppv && ppv[1].category_path), 'carries category_path');
  if (CFG.usesEcommerceFunnel) {
    ok(ppv && ppv[1].discounted_price != null, 'carries price');
  } else {
    /* A mortgage has no price. Sending one meant sending a fiction. */
    ok(ppv && ppv[1].discounted_price == null && ppv[1].price == null,
       'no price on the page view, because a bank product has none');
  }

  // stock_count used to be a hardcoded 1 on every product view, which threw away
  // a real figure on the sites whose catalogue tracks stock. Where a catalogue
  // tracks it, the page view must carry the actual number. Where a product has
  // no unit count at all, as a card or a mortgage does not, the field is now
  // omitted entirely rather than filled with an invented availability flag.
  const stock = ppv && ppv[1].stock_count;
  if (CFG.panel && CFG.panel.product && CFG.tracksStock) {
    ok(typeof stock === 'number' && stock > 1,
      'stock_count is the real figure, not the old hardcoded 1  -> ' + stock);
  } else {
    // A finance site sends NO stock_count. It used to send 1 as a stand-in for
    // plain availability, which the docs do allow, but a card has no unit count
    // and an invented figure in that column reads as real to any segment built
    // on it. The docs also allow omitting it, so it is omitted.
    //
    // Asserted as absent rather than as 0: Number(null) is 0, and a 0 would
    // announce every card as out of stock. That trap has bitten twice here.
    ok(stock === undefined,
      'no stock_count on a finance site, not even the old stand-in 1  -> ' + stock);
  }
  console.log('        ' + JSON.stringify(ppv && ppv[1]));

  // ---------- default scenario navigates for a page-load trigger ----------
  const p4 = await ctx.newPage();
  await p4.addInitScript(MOCK);
  await p4.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p4.waitForTimeout(1500);
  await p4.evaluate((BTN) => {
    const w = [...document.getElementById('sticky-modal').querySelectorAll(':scope > div:last-child > div')][0];
    [...w.querySelectorAll('button')].filter(x => x.textContent === BTN)[1].click(); // nps-popup
  }, CFG.launcherButton);
  await p4.waitForTimeout(1800);
  console.log('\n--- DEFAULT SCENARIO (nps-popup) ---');
  // no navigation any more: the SDK watches dataLayer, so the button pushes and stays
  ok(!p4.url().includes('scenario='), 'stays on the page (no reload workaround)  -> ' + p4.url());
  const dlEvents = await p4.evaluate(() => (window.dataLayer || []).map(d => d && d.event));

  // The scenario event is PREFIXED PER SITE so each language can have its own
  // campaign and its own content: br_ on the pt-BR site, en_ on the English one,
  // nothing on the two finance sites. This assertion hardcoded the bare slug and
  // went red the moment the prefixes landed, which is exactly what it is for.
  const expected = (CFG.scenarioPrefix || '') + 'nps-popup';
  ok(dlEvents.includes(expected),
    `dataLayer got {event: ${expected}} for DATA_LAYER_EVENT trigger  -> ${JSON.stringify(dlEvents.slice(-3))}`);

  // and on a prefixed site the BARE slug must not also be pushed, or a campaign
  // built on the prefix would be firing twice, once per name
  if (CFG.scenarioPrefix) {
    ok(!dlEvents.includes('nps-popup'),
      'the unprefixed slug is NOT pushed as well (no double trigger)');
  }

  // The launcher prints the event name under each Default Scenario button, and
  // that caption is read off the screen during demos. It once kept showing the
  // bare slug after the prefixes went live, so the panel said "event: survey"
  // while the page pushed "br_survey". The caption must match what fires.
  const caption = await p4.evaluate(() => {
    const w = [...document.getElementById('sticky-modal')
      .querySelectorAll(':scope > div:last-child > div')][0];
    const small = w.querySelectorAll('small');
    return [...small].map(s => s.textContent.trim()).filter(t => t.startsWith('event: '));
  });
  ok(caption.length > 0, 'launcher prints an event caption for the panel scenarios');
  const mismatched = caption.filter(t => !t.startsWith('event: ' + (CFG.scenarioPrefix || '')));
  ok(mismatched.length === 0,
    `every caption shows the real event name  -> ${JSON.stringify(caption.slice(0, 3))}`);

  await b.close();
  console.log('\n================  ' + (fail.length ? fail.length + ' FAILURES' : 'ALL CHECKS PASSED') + '  ================');
  fail.forEach(f => console.log('  - ' + f));
})();
