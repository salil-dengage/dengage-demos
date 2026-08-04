// ============================================================================
// searchwishtest: site search and the wishlist, and the two Dengage event
// contracts behind them.
//
//   node tools/verify/searchwishtest.js            # every site
//   node tools/verify/searchwishtest.js fintech    # one site
//
// The point of this suite is the PAYLOADS. Both features are easy to make look
// right on screen while writing the wrong shape into search_events and
// wishlist_events, and a wrong shape is invisible until somebody tries to build
// a segment on the table months later. So every assertion here is against the
// documented contract at https://dev.dengage.com/docs/ecommerce-events, key by
// key, including which keys must NOT be present.
//
//   ec:search              keywords, result_count, filters
//   ec:addToWishlist       list_name, product_id, product_variant_id,
//                          expire_date, price, discounted_price, stock_count
//   ec:removeFromWishlist  list_name, product_id  -- and nothing else
//
// It also pins the two behaviours that are judgement calls rather than
// documented rules, because both are easy to regress:
//
//   one event per settled query, not one per keystroke
//   stock_count present only where the catalogue actually tracks stock
// ============================================================================
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { site, allSites, offlineRoute, stubDengage, SITES } = require('./sites');

const REPO = path.resolve(__dirname, '../..');
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* The three modules must be byte-identical everywhere. That is the whole
   reason they take their per-site values from data attributes, and it is the
   property that stops four copies drifting apart. */
const SHARED = ['wishlist.js', 'wishlistUi.js', 'searchPanel.js'];
const SHARED_DIRS = ['cantu-pneus/en/js', 'cantu-pneus/js', 'cantu-pneus/ru/js',
                     'fintech/js', 'banking/js'];

/* Which catalogues track stock. Only these may send stock_count. */
/* Read straight from sites.js rather than keeping a second copy here. This was
   a local map, and adding the RU site set tracksStock in one place and not the
   other, so the suite asserted the opposite of the truth. */
const TRACKS_STOCK = Object.fromEntries(
  Object.entries(SITES).map(([k, v]) => [k, Boolean(v.tracksStock)]));

/* A contact key to pin for the identity checks, via ?ck= which js/identity.js
   reads. Any value works; it just has to be one the test can recognise. */
const IDENTITY_KEY = 'searchwish-demo';

const problems = [];
function check(ok, label, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    problems.push(label + (detail ? ': ' + detail : ''));
    if (detail) console.log('        ' + detail);
  }
}

function sent(page, action) {
  return page.evaluate(a => (window.__sent || [])
    .filter(c => c[0] === a).map(c => c[1]), action);
}

/* The wishlist writes wishlist_events through sendDeviceEvent, carrying
   event_type explicitly (see the header of js/wishlist.js). So a "wishlist
   event" in this suite is a sendDeviceEvent call naming that table, filtered
   by event_type to separate the adds from the removes. */
function wishlistRows(page, eventType) {
  return page.evaluate(t => (window.__sent || [])
    .filter(c => c[0] === 'sendDeviceEvent' && c[1] === 'wishlist_events')
    .map(c => c[2])
    .filter(p => p && p.event_type === t), eventType);
}

function keysOf(obj) { return Object.keys(obj || {}).sort(); }

// ---------------------------------------------------------------- byte identity
function checkShared() {
  console.log('\n################  shared modules  ################');
  for (const file of SHARED) {
    const hashes = SHARED_DIRS.map(dir => {
      const p = path.join(REPO, dir, file);
      if (!fs.existsSync(p)) return 'MISSING:' + dir;
      return require('crypto').createHash('md5')
        .update(fs.readFileSync(p)).digest('hex');
    });
    const unique = [...new Set(hashes)];
    check(unique.length === 1, `${file} is byte-identical across all ${SHARED_DIRS.length} sites`,
      unique.length === 1 ? '' : SHARED_DIRS.map((d, i) => d + '=' + hashes[i].slice(0, 8)).join(' '));
  }
}

// --------------------------------------------------------------------- per site
async function runSite(ctx, key) {
  const cfg = site(key);
  console.log(`\n################  ${key}  ################`);

  /* Search and saved items are ecommerce features: they write search_events
     and wishlist_events through the ec:* actions. Neither finance site uses
     the ecommerce API, so neither carries them. The honest replacement is
     product_shortlisted in that site's own product events table.

     Gated on a per-site value rather than a list here, because a second copy
     of per-site config is what broke this exact suite before: TRACKS_STOCK was
     a local map, the RU site set it in sites.js only, and the suite asserted
     the opposite of the truth.

     The byte-identity check in checkShared() is deliberately NOT gated. Those
     modules still have to stay identical across all five sites even where a
     site no longer loads them, or the next site to adopt them inherits a
     forked copy. Asserting a header magnifier on a site that deliberately has
     none is a stale assertion; asserting the files have not drifted is not. */
  if (cfg.ecommerceUi === false) {
    console.log('  SKIP  ' + key + ' has no search or saved items: it does not ' +
                'use the ecommerce API (ecommerceUi: false in sites.js)');
    return;
  }

  const page = await ctx.newPage();
  await offlineRoute(page, cfg);
  await stubDengage(page);
  // Pin a known contact for this run, the way a demo does it, so the identity
  // ordering below is testing the signed-in case and not the anonymous one.
  await page.goto(cfg.home + '?ck=' + IDENTITY_KEY, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.product-card').length > 0,
    null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);

  // ------------------------------------------------------------- entry points
  check(await page.locator('.nav-main [data-dns-open]').count() === 1,
    'exactly one search button in the header');
  check(await page.locator('.nav-main [data-dnw-open]').count() === 1,
    'exactly one saved-items button in the header');
  check(await page.locator('.nav-main [data-cart-open]').count() === 1,
    'the cart button is untouched and still alone');

  // ----------------------------------------------------------------- identity
  // Neither feature attaches identity itself, and it must stay that way: the SDK
  // stamps session_id, dn_device_id and dn_contact_key onto every event, reading
  // them out of storage AT SEND TIME rather than capturing them at initialize.
  // ec:search goes through the same gw() path as sendDeviceEvent, and the two
  // wishlist events go through it as well, so all three inherit whatever
  // js/identity.js resolved. What this suite CAN prove is the ordering and the
  // absence: that initialize ran with the contact key before any event fired,
  // and that these modules never put an identity field in a payload themselves,
  // which would shadow the SDK's own.
  const calls = await page.evaluate(() => (window.__sent || []).map(c => c[0]));
  const initAt = calls.indexOf('initialize');
  check(initAt !== -1, 'initialize was called');

  const initArg = await page.evaluate(() =>
    ((window.__sent || []).find(c => c[0] === 'initialize') || [])[1]);
  check(initArg && initArg.contactKey === IDENTITY_KEY,
    'initialize carried the resolved contact key, so events are not anonymous',
    JSON.stringify(initArg));

  const firstEventAt = calls.findIndex(c => c === 'pageView' || String(c).startsWith('ec:'));
  check(firstEventAt === -1 || firstEventAt > initAt,
    'every event fires AFTER initialize, so none lands on the anonymous device',
    `initialize at ${initAt}, first event at ${firstEventAt}`);

  // The header sat at exactly zero horizontal slack before these two controls
  // were added, and the first attempt pushed the cart button clean off the right
  // of the screen. So this is checked at three widths, not one, and it is
  // checked against the container rather than the viewport: the nav must still
  // end inside .header-inner, which is what "nothing fell off the edge" means.
  // 1120 is in this list deliberately: it overflowed BEFORE any of this was
  // added (nav right 1232 against an 1088 container on the English CantuPneus
  // site, because the site's own compact rules only engage at 1100) and the
  // tightening this feature brings closes it. Not in the list: 861 to 880, the
  // last slice before .nav-main is hidden at 860, which still overflows on that
  // one site. It overflowed there beforehand too, by 26px against 14px now, so
  // it is left alone rather than reflowed further for a 20px-wide window.
  for (const width of [1440, 1280, 1200, 1120, 1024, 900]) {
    await page.setViewportSize({ width: width, height: 900 });
    await page.waitForTimeout(200);
    const fit = await page.evaluate(() => {
      const right = sel => {
        const node = document.querySelector(sel);
        return node ? Math.round(node.getBoundingClientRect().right) : null;
      };
      return {
        nav: right('.nav-main'),
        inner: right('.header-inner'),
        cart: right('.nav-main [data-cart-open]'),
        vw: window.innerWidth,
      };
    });
    check(fit.nav !== null && fit.nav <= fit.inner + 1,
      `header nav still fits its container at ${width}px`,
      `nav right ${fit.nav} vs container right ${fit.inner}`);
    check(fit.cart !== null && fit.cart <= fit.vw,
      `the cart button is still on screen at ${width}px`,
      `cart right ${fit.cart} vs viewport ${fit.vw}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);

  const hearts = await page.locator('.product-card .dnw-heart').count();
  const cards = await page.locator('.product-card').count();
  check(cards > 0 && hearts === cards,
    `every product card got a heart (${hearts}/${cards})`);

  // -------------------------------------------------------- ec:addToWishlist
  const heart = page.locator('.product-card .dnw-heart').first();
  const savedId = await heart.getAttribute('data-product-id');
  await heart.click();
  await page.waitForTimeout(250);

  let adds = await wishlistRows(page, 'add');
  check(adds.length === 1, 'saving writes exactly one wishlist_events add row',
    'wrote ' + adds.length);

  if (adds.length === 1) {
    const p = adds[0];
    // the documented fields, plus event_type and is_used, which the table
    // requires and this project sets explicitly, plus the event_id stamp
    const expected = ['discounted_price', 'event_id', 'event_type', 'expire_date',
      'is_used', 'list_name', 'price', 'product_id', 'product_variant_id']
      .concat(TRACKS_STOCK[key] ? ['stock_count'] : []).sort();
    check(JSON.stringify(keysOf(p)) === JSON.stringify(expected),
      'the add row carries the documented keys plus event_type and is_used',
      'got ' + keysOf(p).join(',') + ' want ' + expected.join(','));

    // These two are required for the row to store, so they are asserted
    // explicitly rather than assumed.
    check(p.event_type === 'add', 'event_type is set, which the platform requires',
      JSON.stringify(p.event_type));
    check(p.is_used === false, 'is_used is set, which the platform also requires',
      JSON.stringify(p.is_used));

    check(p.list_name === 'favorites', 'list_name is the configured list', p.list_name);
    check(p.product_id === savedId, 'product_id is the saved product', p.product_id);
    check(typeof p.product_variant_id === 'string' && p.product_variant_id.length > 0,
      'product_variant_id is a non-empty string');

    // docs type price and discounted_price as strings
    check(typeof p.price === 'string' && /^\d+\.\d{2}$/.test(p.price),
      'price is a 2-decimal string as the docs type it', JSON.stringify(p.price));
    check(typeof p.discounted_price === 'string' && /^\d+\.\d{2}$/.test(p.discounted_price),
      'discounted_price is a 2-decimal string', JSON.stringify(p.discounted_price));
    check(Number(p.price) >= Number(p.discounted_price),
      'price is list and discounted_price is what is paid, so price >= discounted',
      p.price + ' vs ' + p.discounted_price);

    const when = Date.parse(p.expire_date);
    check(Number.isFinite(when) && when > Date.now(),
      'expire_date is a parseable ISO 8601 date in the future', p.expire_date);
    check(/^\d{4}-\d{2}-\d{2}T/.test(p.expire_date || ''),
      'expire_date is ISO 8601, not a locale string', p.expire_date);

    if (TRACKS_STOCK[key]) {
      check(typeof p.stock_count === 'number' && p.stock_count >= 0,
        'stock_count is a number, because this catalogue tracks stock',
        JSON.stringify(p.stock_count));
    } else {
      check(!('stock_count' in p),
        'stock_count is omitted, because this catalogue does not track stock',
        JSON.stringify(p.stock_count));
    }
  }

  // saving twice is one save
  await heart.click();          // off
  await page.waitForTimeout(200);
  await heart.click();          // on again
  await page.waitForTimeout(200);
  adds = await wishlistRows(page, 'add');
  check(adds.length === 2, 'save, unsave, save fires two adds and no duplicate',
    'fired ' + adds.length);

  // ---------------------------------------------------- ec:removeFromWishlist
  const removes = await wishlistRows(page, 'remove');
  check(removes.length === 1, 'unsaving writes exactly one wishlist_events remove row',
    'wrote ' + removes.length);
  if (removes.length) {
    check(JSON.stringify(keysOf(removes[0]))
      === JSON.stringify(['event_id', 'event_type', 'is_used', 'list_name', 'product_id']),
      'the remove row carries list_name and product_id plus the two required columns',
      'got ' + keysOf(removes[0]).join(','));
    check(removes[0].product_id === savedId, 'remove names the same product');
  }

  // The wishlist path must stay on the direct write; switching these modules
  // to the ec:*Wishlist actions would break the assertions above. Do not
  // remove: required for correct behaviour with this SDK version.
  // Background: Salil.
  check((await sent(page, 'ec:addToWishlist')).length === 0
     && (await sent(page, 'ec:removeFromWishlist')).length === 0,
    'no ec:*Wishlist call is used');

  // No identity field may appear in a payload these modules build. The SDK owns
  // that, and a hand-written contact key here would be stale the moment somebody
  // signs in or out mid-session.
  const IDENTITY_FIELDS = ['contact_key', 'contactKey', 'dn_contact_key',
    'device_id', 'deviceId', 'dn_device_id', 'session_id', 'sessionId'];
  const allPayloads = await page.evaluate(() => (window.__sent || [])
    .filter(c => String(c[0]).startsWith('ec:')).map(c => c[1] || {}));
  const leaked = allPayloads
    .flatMap(p => Object.keys(p))
    .filter(k => IDENTITY_FIELDS.indexOf(k) !== -1);
  check(leaked.length === 0,
    'no payload sets identity by hand; the SDK stamps it fresh on every event',
    'found ' + leaked.join(','));

  // ------------------------------------------------------------- the drawer
  check(await page.locator('[data-dnw-count]').first().textContent() === '1',
    'the header badge shows one saved item');

  await page.locator('.nav-main [data-dnw-open]').click();
  await page.waitForTimeout(320);
  check(await page.locator('#dnwDrawer.is-open').count() === 1, 'the drawer opens');
  check(await page.locator('.dnw-item').count() === 1, 'the drawer lists the saved item');
  check(await page.locator('.dnw-item [data-cart-add]').count() === 1,
    "the drawer's add button reuses the cart's own hook");

  // The drawer's add button must say what the site's own product cards say. The
  // finance sites have no cart, they have an application, and their cards read
  // "Add to application"; the Portuguese site reads "Adicionar ao carrinho". A
  // hardcoded "Add to cart" was wrong on three of the four sites.
  const labels = await page.evaluate(() => {
    const text = sel => {
      const node = document.querySelector(sel);
      return node ? node.textContent.trim() : null;
    };
    return {
      drawer: text('.dnw-item [data-cart-add]'),
      card: text('.product-card [data-cart-add]'),
    };
  });
  check(labels.drawer !== null && labels.drawer === labels.card,
    "the drawer's add button uses this site's own wording",
    `drawer "${labels.drawer}" vs card "${labels.card}"`);

  // And it has to actually work, not merely carry the right attribute: clicking
  // it must go through the real cart and fire a correct ec:addToCart, with the
  // numbers as NUMBERS (the cart events type them that way, unlike the wishlist
  // events which type price as a string).
  await page.evaluate(() => { window.__sent = []; });
  await page.locator('.dnw-item [data-cart-add]').first().click();
  await page.waitForTimeout(350);
  const fromDrawer = await sent(page, 'ec:addToCart');
  check(fromDrawer.length === 1,
    'the drawer add button goes through the real cart and fires ec:addToCart',
    'fired ' + fromDrawer.length);
  if (fromDrawer.length) {
    const c = fromDrawer[0];
    check(typeof c.unit_price === 'number' && typeof c.discounted_price === 'number',
      'the cart event carries numbers, not the wishlist events\' strings',
      JSON.stringify({ unit_price: c.unit_price, discounted_price: c.discounted_price }));
    check(Array.isArray(c.cartItems) && c.cartItems.length === 1,
      'the cart event carries the whole basket as cartItems');
  }
  check(await page.locator('[data-cart-count]').first().textContent() === '1',
    'the cart badge counts the item added from the drawer');

  // the drawer must not be able to push the page sideways on a phone
  await page.setViewportSize({ width: 420, height: 780 });
  await page.waitForTimeout(220);
  let overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 1, 'the open drawer does not scroll the page sideways at 420px',
    'overflow ' + overflow + 'px');
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.locator('#dnwDrawer .dnw-drawer-close').click();
  await page.waitForTimeout(250);
  check(await page.evaluate(() => document.body.style.overflow) === '',
    'closing the drawer releases body scroll');

  // ------------------------------------------------------------- clear list
  // Save a SECOND product first, so "one remove per product" is actually being
  // tested rather than trivially satisfied by a single-item list.
  await page.locator('.product-card .dnw-heart').nth(2).click();
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__sent = []; });

  await page.locator('.nav-main [data-dnw-open]').click();
  await page.waitForTimeout(280);
  check(await page.locator('.dnw-item').count() === 2, 'the drawer lists both saved items');
  await page.locator('[data-dnw-clear]').click();
  await page.waitForTimeout(300);
  const afterClear = await wishlistRows(page, 'remove');
  check(afterClear.length === 2,
    'clearing a two-item list sends one remove per product, since the contract has no bulk remove',
    'removes ' + afterClear.length);
  check(new Set(afterClear.map(r => r.product_id)).size === 2,
    'the two removes name two different products');
  check(await page.locator('.dnw-item').count() === 0, 'the drawer is empty after clearing');
  await page.locator('#dnwDrawer .dnw-drawer-close').click();
  await page.waitForTimeout(200);

  // ------------------------------------------------------------- ec:search
  await page.evaluate(() => { window.__sent = []; });
  await page.locator('.nav-main [data-dns-open]').click();
  await page.waitForTimeout(300);
  check(await page.locator('#dnsPanel.is-open').count() === 1, 'the search panel opens');
  check(await page.locator('.dns-chip').count() > 1,
    'filter chips were built from the catalogue');

  // type a real query one character at a time
  const term = await page.evaluate(() => {
    const card = document.querySelector('.product-card-name');
    return (card ? card.textContent.trim().split(/\s+/)[0] : 'a');
  });
  const input = page.locator('[data-dns-input]');
  await input.click();
  await input.pressSequentially(term, { delay: 60 });
  await page.waitForTimeout(200);

  let searches = await sent(page, 'ec:search');
  check(searches.length === 0,
    'typing alone reports nothing, so search_events is not a keystroke log',
    'fired ' + searches.length);

  await page.waitForTimeout(1100);            // let the query settle
  searches = await sent(page, 'ec:search');
  check(searches.length === 1, 'one settled query reports exactly one ec:search',
    'fired ' + searches.length);

  const shown = await page.locator('.dns-result').count();
  check(shown > 0, 'the query returned visible results', 'showed ' + shown);

  if (searches.length) {
    const p = searches[0];
    check(JSON.stringify(keysOf(p)) === JSON.stringify(['filters', 'keywords', 'result_count']),
      'ec:search carries exactly keywords, result_count and filters',
      'got ' + keysOf(p).join(','));
    check(p.keywords === term, 'keywords is what the visitor typed',
      JSON.stringify(p.keywords) + ' vs ' + JSON.stringify(term));
    check(typeof p.result_count === 'number' && p.result_count > 0,
      'result_count is a number matching what was shown', JSON.stringify(p.result_count));
    check(p.filters === '', 'filters is an empty string when the visitor picked none',
      JSON.stringify(p.filters));
  }

  // re-reading the same results is not a second search
  await page.waitForTimeout(900);
  check((await sent(page, 'ec:search')).length === 1,
    'the same keywords and filters are not reported twice');

  // ------------------------------------------------------ Enter, and filters
  await page.evaluate(() => { window.__sent = []; });
  await input.fill('');
  await input.pressSequentially('r1', { delay: 40 });
  await input.press('Enter');
  await page.waitForTimeout(220);
  check((await sent(page, 'ec:search')).length === 1,
    'Enter reports at once instead of waiting for the settle timer');

  await page.evaluate(() => { window.__sent = []; });
  const chipName = await page.locator('.dns-chip').nth(1).textContent();
  await page.locator('.dns-chip').nth(1).click();
  await page.waitForTimeout(300);
  const filtered = await sent(page, 'ec:search');
  check(filtered.length === 1, 'picking a filter with a query present is a new search',
    'fired ' + filtered.length);
  if (filtered.length) {
    check(filtered[0].filters === 'category=' + chipName.trim(),
      'filters describes the picked filter as a readable string',
      JSON.stringify(filtered[0].filters));
  }

  // ----------------------------------------------------- a genuine zero result
  await page.locator('.dns-chip').nth(1).click();      // clear the filter
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__sent = []; });
  await input.fill('');
  await input.pressSequentially('zzqqxx', { delay: 30 });
  await input.press('Enter');
  await page.waitForTimeout(250);
  const empty = await sent(page, 'ec:search');
  check(empty.length === 1 && empty[0].result_count === 0,
    'a query with no matches reports result_count 0, which is the catalogue gap signal',
    JSON.stringify(empty[0] || null));
  check(await page.locator('.dns-none').count() === 1,
    'the visitor is told there were no matches');

  // the panel must not push the page sideways on a phone either
  await page.setViewportSize({ width: 420, height: 780 });
  await page.waitForTimeout(220);
  overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 1, 'the open search panel does not scroll the page sideways at 420px',
    'overflow ' + overflow + 'px');
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check(await page.locator('#dnsPanel.is-open').count() === 0, 'Escape closes the search panel');
  await page.close();

  // ------------------------------------------------------------ product page
  const pdp = await ctx.newPage();
  await offlineRoute(pdp, cfg);
  await stubDengage(pdp);
  await pdp.goto(cfg.product, { waitUntil: 'domcontentloaded' });
  await pdp.waitForSelector('.product-detail-actions [data-dnw-toggle]', { timeout: 15000 })
    .catch(() => {});
  await pdp.waitForTimeout(300);

  check(await pdp.locator('.product-detail-actions [data-dnw-toggle]').count() === 1,
    'the product page gets one save button, next to add to cart');
  check(await pdp.locator('.product-detail-actions [data-product-add-to-cart]').count() === 1,
    'the existing add-to-cart button is still there');

  await pdp.locator('.product-detail-actions [data-dnw-toggle]').click();
  await pdp.waitForTimeout(250);
  const pdpAdds = await wishlistRows(pdp, 'add');
  check(pdpAdds.length === 1, 'saving from the product page writes one add row',
    'wrote ' + pdpAdds.length);
  if (pdpAdds.length) {
    check(pdpAdds[0].product_id === cfg.productId,
      'the product page save names the product in the URL', pdpAdds[0].product_id);
    if (TRACKS_STOCK[key]) {
      check(typeof pdpAdds[0].stock_count === 'number',
        'the product page save carries stock_count too',
        JSON.stringify(pdpAdds[0].stock_count));
    }
  }
  check(await pdp.locator('.product-detail-actions [data-dnw-toggle].is-saved').count() === 1,
    'the save button shows saved state after the click');

  // and nothing about the cart changed on this page
  await pdp.locator('[data-product-add-to-cart]').click();
  await pdp.waitForTimeout(250);
  check((await sent(pdp, 'ec:addToCart')).length === 1,
    'add to cart still fires ec:addToCart, unchanged');
  await pdp.close();
}

// --------------------------------------------------------------------- driver
(async () => {
  checkShared();

  const keys = process.argv[2] ? [process.argv[2]] : allSites();
  const browser = await chromium.launch({ executablePath: CHROME });

  for (const key of keys) {
    // A FRESH CONTEXT PER SITE, which matters more than it looks. All four demo
    // sites are served from one origin, and the Portuguese and English
    // CantuPneus sites share one wishlist storage key on purpose: same shop,
    // two languages, one saved list. Reusing a context therefore carried saved
    // items from one site's run into the next and the later site failed on a
    // badge count that was correct for the state it had inherited.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      await runSite(ctx, key);
    } catch (err) {
      problems.push(key + ': threw ' + err.message);
      console.log('  FAIL  suite threw: ' + err.message);
    }
    await ctx.close();
  }

  await browser.close();
  console.log(problems.length
    ? `\n${problems.length} problem(s)`
    : '\nsearch and wishlist match the documented event contracts on every site');
  process.exit(problems.length ? 1 : 0);
})();
