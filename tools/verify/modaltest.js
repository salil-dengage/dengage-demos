const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();
const P = CFG.panel;

/* The 17 assertions below describe the ecommerce event panel: eight cards
   firing ec:addToCart, ec:beginCheckout, ec:order and ec:addToWishlist.

   The finance sites have no such panel. Their cards write page_view_events
   plus their own <site>_* tables and make no ec:* call at all, so asserting
   the ecommerce shape there is a stale assertion rather than a fault. Each is
   covered by its own suite instead, which drives every card and checks the
   tables it writes:

     banking   banking/tools/journeytest.js
     fintech   tools/verify/appevents.js  */
if (!CFG.usesEcommerceFunnel) {
  console.log(`\n################  ${CFG.key}  ################`);
  console.log('  SKIP  this site has no ecommerce event panel');
  console.log('        (usesEcommerceFunnel: false in sites.js; its panel is covered');
  console.log('         by that site\'s own suite, see the header of this file)');
  process.exit(0);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__sent = []; window.dengage = function () { window.__sent.push(JSON.parse(JSON.stringify([...arguments]))); }; });
  const fail = [];
  const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail.push(m); };

  await p.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  await p.click('#event-modal-icon');
  await p.waitForTimeout(400);
  ok(await p.$('#event-manager-modal.visible'), 'modal opens');

  const cards = await p.$$('#event-manager-modal .event-card');
  ok(cards.length === 8, '8 event cards rendered (' + cards.length + ')');

  async function fire(i) {
    await p.evaluate(() => { window.__sent.length = 0; });
    const card = (await p.$$('#event-manager-modal .event-card'))[i];
    await card.$eval('.event-header', el => el.click());
    await p.waitForTimeout(350);
    await card.$eval('.send-btn', el => el.click());
    await p.waitForTimeout(250);
    return p.evaluate(() => window.__sent);
  }

  // card 0: Product viewed -> pageView
  let s = await fire(0);
  ok(s.length === 1 && s[0][0] === 'pageView', 'card 1 fires pageView');
  let d = s[0][1];
  ok(d.page_type === 'product' && d.product_id === P.product.id, 'card 1 product fields present');
  ok(d.price === P.product.price && d.discounted_price === P.product.discounted && d.stock_count === P.product.stock, 'card 1 numeric columns are Numbers');
  ok(d.category_path === P.product.categoryPath && d.promotion_id === P.product.promotionId && d.page_title && d.page_url && d.category_id, 'card 1 carries all page_view_events columns');

  // card 1: Category viewed -> pageView
  s = await fire(1);
  d = s[0] && s[0][1];
  ok(s.length === 1 && s[0][0] === 'pageView' && d.page_type === 'category' && d.category_id === P.category.id && d.category_path === P.category.path, 'card 2 fires category pageView');

  // card 2: Added to cart -> ec:addToCart with cartItems
  s = await fire(2);
  d = s[0] && s[0][1];
  ok(s.length === 1 && s[0][0] === 'ec:addToCart', 'card 3 fires ec:addToCart');
  ok(d.quantity === P.cart.qty && d.unit_price === P.cart.unit && d.discounted_price === P.cart.discounted, 'card 3 numeric item fields');
  ok(Array.isArray(d.cartItems) && d.cartItems.length === 1 && d.cartItems[0].product_id === P.cart.id && d.cartItems[0].quantity === P.cart.qty, 'card 3 builds cartItems from fields');

  // card 3: Wishlist -> wishlist_events, written directly via sendDeviceEvent,
  // exactly as js/wishlist.js does, carrying event_type and is_used explicitly.
  // Do not switch this card (or eventModal.js) to the ec: form: required for
  // correct behaviour with this SDK version. Background: Salil.
  s = await fire(3);
  d = s[0] && s[0][2];
  ok(s.length === 1 && s[0][0] === 'sendDeviceEvent' && s[0][1] === 'wishlist_events'
    && d.product_id === P.wishlist.id && d.list_name === P.wishlist.list
    && d.price === P.wishlist.price && d.stock_count === P.wishlist.stock,
    'card 4 writes wishlist_events with its documented columns');
  ok(d.event_type === 'add' && d.is_used === 'false',
    'card 4 carries event_type and is_used, which the table requires');
  ok(d.cartItems === undefined, 'card 4 has no cartItems');
  ok((await fire(3)).every(c => c[0] !== 'ec:addToWishlist'),
    'card 4 does not use the ec:addToWishlist action');

  // card 4: Checkout -> ec:beginCheckout
  s = await fire(4);
  d = s[0] && s[0][1];
  ok(s.length === 1 && s[0][0] === 'ec:beginCheckout' && Array.isArray(d.cartItems), 'card 5 fires ec:beginCheckout with cartItems');

  // card 5: Payment -> ec:order
  s = await fire(5);
  d = s[0] && s[0][1];
  ok(s.length === 1 && s[0][0] === 'ec:order', 'card 6 fires ec:order');
  ok(new RegExp(P.order.idPattern).test(d.order_id) && d.item_count === P.order.itemCount && d.total_amount === P.order.total && d.payment_method === P.order.payment && d.shipping === P.order.shipping && d.coupon_code === P.order.coupon, 'card 6 carries order_events columns');
  ok(Array.isArray(d.cartItems) && d.cartItems[0].unit_price === P.cart.unit && d.cartItems[0].discounted_price === P.cart.discounted, 'card 6 builds order cartItems');

  // card 6 + 7: custom sendDeviceEvent path unchanged
  s = await fire(6);
  ok(s.length === 1 && s[0][0] === 'sendDeviceEvent' && s[0][1] === CFG.customTable && s[0][2].event_name === P.customEvents[0], 'card 7 sendDeviceEvent -> ' + CFG.customTable);
  s = await fire(7);
  ok(s.length === 1 && s[0][0] === 'sendDeviceEvent' && s[0][1] === CFG.customTable && s[0][2].event_name === P.customEvents[1], 'card 8 sendDeviceEvent -> ' + CFG.customTable);

  // The table name is locked on cards that use a first-class SDK action, and
  // editable on cards that name their own table. The wishlist card names its
  // own table, so this is 5 locked and 3 editable.
  const ro = await p.$$eval('#event-manager-modal .table-name-input', els => els.map(e => e.readOnly));
  const locked = ro.filter(Boolean).length;
  ok(locked === 5 && ro.length - locked === 3,
    `table field locked on ${locked} SDK cards, editable on ${ro.length - locked} table-named cards`);

  const shot = (await p.$$('#event-manager-modal .event-card'))[0];
  await shot.$eval('.event-header', el => el.click());
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'modal-cards.png' });

  await b.close();
  console.log('\n================  ' + (fail.length ? fail.length + ' FAILURES' : 'ALL CHECKS PASSED') + '  ================');
  process.exit(fail.length ? 1 : 0);
})();
