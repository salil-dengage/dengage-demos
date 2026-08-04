/* ============================================================================
   appevents.js: the money-app surface and the tables it writes.

       node tools/verify/appevents.js fintech

   Sites with no app surface are skipped, driven by `appSurface` in sites.js
   rather than a list here. Duplicated config has broken this build twice
   (TRACKS_STOCK, launcherButton), so if a value varies by site it lives in
   sites.js and nowhere else.

   WHAT THIS GUARDS

   1. The app renders and every action works. Offline, with the SDK stubbed.
   2. Each action writes the table fintech/EVENT-MODEL.md says it should.
   3. NO ec:* call is ever made. This is the point of the rebuild: the finance
      sites do not use the ecommerce API, because a card has no quantity and a
      loan has no shipping method. A reintroduced ec:addToCart would populate
      shopping_cart_events with invented columns and nobody would notice for
      weeks, so it is asserted rather than trusted.
   4. No payload carries stock_count, and no payload zero-fills an absent
      field. Number(null) === 0 has produced this bug twice here.
   ========================================================================== */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { site, offlineRoute, stubDengage, seedSession } = require('./sites');

const cfg = site();
let failures = 0;

function ok(cond, label) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
    if (!cond) failures++;
}

/* Every sendDeviceEvent call the page made, as {table, event, payload}. */
function eventsFrom(sent) {
    return sent
        .filter(a => a[0] === 'sendDeviceEvent')
        .map(a => ({ table: a[1], event: (a[2] || {}).event_type, payload: a[2] || {} }));
}

function sawEvent(events, table, name) {
    return events.some(e => e.table === table && e.event === name);
}

(async () => {
    if (!cfg.appSurface) {
        console.log('SKIP  ' + cfg.key + ' has no app surface (appSurface unset in sites.js)');
        process.exit(0);
    }

    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await offlineRoute(ctx, cfg);
    /* app.html is gated. Without this the suite drives the landing page while
       reporting on the portal. */
    await seedSession(ctx, cfg);

    const page = await ctx.newPage();
    await stubDengage(page);

    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    /* The portal is five pages now, so each flow is driven on the page that
       owns it. Recorded SDK calls accumulate across navigations because
       stubDengage installs on the context, not the page. */
    let SENT = [];
    async function harvest() {
        const batch = await page.evaluate(() => window.__sent || []).catch(() => []);
        SENT = SENT.concat(batch);
    }
    async function goTo(rel) {
        /* window.__sent lives on the document, so a navigation wipes it.
           Harvest first or every call made before the move disappears and the
           suite passes on an empty set. */
        await harvest();
        await page.goto(cfg.base + '/' + rel, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
    }

    await goTo(cfg.appSurface);

    /* ------------------------------------------------------------ renders */
    const balance = await page.textContent('.npy-balance').catch(() => null);
    ok(!!balance && /\d/.test(balance), 'balance renders a figure (' + balance + ')');

    const tabs = await page.$$eval('.npy-tab', ns => ns.map(n => n.textContent.trim()));
    ok(tabs.length === 5, 'five app tabs (' + tabs.join(', ') + ')');

    /* Inline slots use the SAME vocabulary as every other page on every site.
       The app page carries the three that make sense on it; below_hero and
       pdp_below_price belong to the landing and the product page.

       This is asserted by id rather than by count because the first draft of
       this page invented three new names (mid_content, footer, end_of_body),
       which would have left the panel's Inline Target Selector offering slots
       that exist on one page of one site. */
    const slots = await page.$$eval('.dn-inline-slot', ns => ns.map(n => n.id).sort());
    const wantSlots = ((cfg.portal && cfg.portal[cfg.appSurface])
        ? cfg.portal[cfg.appSurface].slots : []).slice().sort();
    ok(JSON.stringify(slots) === JSON.stringify(wantSlots),
        'inline slots present and correctly named (' + slots.length + ' on '
        + cfg.appSurface + ')');

    /* The ten portal signals. These are what a Dengage campaign triggers on,
       so an absent one is a scenario that can never fire, and nothing would
       say so: the dataLayer push is silent either way. */
    const dl = await page.evaluate(() => (window.dataLayer || [])
        .map(d => d && d.event).filter(e => typeof e === 'string' && e.indexOf('fintech_') === 0));
    /* Only this page's own, since the portal split on 2 Aug 2026. The full
       page-to-signal map, and the guarantee that no page fires another page's
       signals, belong to portaltest.js. */
    const WANT_SIGNALS = ((cfg.portal && cfg.portal[cfg.appSurface])
        ? cfg.portal[cfg.appSurface].always : []);
    const missing = WANT_SIGNALS.filter(s => !dl.includes(s));
    ok(missing.length === 0,
        'portal signals fire on load (' + (missing.length ? 'missing ' + missing.join(', ')
                                                         : dl.length + ' pushed') + ')');

    /* -------------------------------------------------------- onboarding */
    await page.click('[data-action="start-kyc"]');
    await page.waitForSelector('.npy-modal');
    await page.click('[data-doc="passport"]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    /* ---------------------------------------------------------- transfer */
    await goTo('money.html');
    await page.click('[data-action="send-money"]');
    await page.waitForSelector('.npy-modal');
    await page.fill('#npy-amount', '120');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    ok(!!(await page.$('.npy-result')), 'a transfer shows a confirmation');
    await page.click('.npy-modal-x');

    /* A transfer larger than the balance must be recorded as a failure, not
       silently succeed. That row is what a "topped up too late" campaign
       triggers on, so its absence would be invisible and wrong. */
    await page.click('[data-action="send-money"]');
    await page.waitForSelector('.npy-modal');
    await page.fill('#npy-amount', '999999');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    /* ------------------------------------------------------------- cards */
    await goTo('cards.html');
    await page.click('.npy-tab[data-view="cards"]');
    await page.waitForTimeout(100);
    await page.click('[data-action="toggle-freeze"]');
    await page.waitForTimeout(100);

    await page.click('[data-action="order-card"]');
    await page.waitForSelector('.npy-modal');
    await page.click('[data-tier="metal"]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    /* -------------------------------------------------------------- grow */
    await goTo('grow.html');
    await page.click('.npy-tab[data-view="grow"]');
    await page.waitForTimeout(100);

    await page.click('[data-action="new-pot"]');
    await page.waitForSelector('.npy-modal');
    await page.fill('#npy-pot-name', 'Test goal');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    await page.click('[data-action="fund-pot"]');
    await page.waitForSelector('.npy-modal');
    await page.fill('#npy-amount', '50');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    await page.click('[data-action="invest"]');
    await page.waitForSelector('.npy-modal');
    await page.fill('#npy-amount', '200');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    await page.click('[data-action="loan-calc"]');
    await page.waitForSelector('.npy-modal');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    /* ---------------------------------------------------------- products */
    await goTo('products.html');
    await page.click('.npy-tab[data-view="products"]');
    await page.waitForTimeout(150);
    const prods = await page.$$('.npy-prod');
    ok(prods.length >= 8, 'product grid renders (' + prods.length + ' products)');

    await page.click('.npy-prod [data-action="shortlist"]');
    await page.waitForTimeout(100);
    await page.click('.npy-prod [data-action="compare"]');
    await page.waitForSelector('.npy-modal');
    await page.click('.npy-modal-x');

    await page.click('.npy-prod [data-action="apply"]');
    await page.waitForSelector('.npy-modal');
    await page.click('[data-confirm]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    /* ------------------------------------------------------------ support */
    await goTo('money.html');
    await page.click('.npy-tab[data-view="money"]');
    await page.waitForTimeout(150);
    /* Scoped to the visible view on purpose. Home renders transaction rows
       too, and a bare selector resolves to the hidden copy first. */
    await page.click('#novapay-view-money [data-action="dispute"]');
    await page.waitForSelector('.npy-modal');
    await page.click('[data-case="fraud_report"]');
    await page.waitForTimeout(150);
    await page.click('.npy-modal-x');

    /* ================================================ the landing surfaces

       The event panel and the scenario launcher live on the LANDING page, not
       on the app, and that is exactly how a real fault survived: appevents
       drove app.html only, so it never opened either of them, and the event
       panel went on firing ec:addToCart, ec:addToWishlist, ec:beginCheckout
       and ec:order into tables this site does not use, while this suite
       reported no ec:* calls and passed.

       A guard that only looks where the author was looking is not a guard. */
    const landing = await ctx.newPage();
    await stubDengage(landing);
    const landingErrors = [];
    landing.on('pageerror', e => landingErrors.push(e.message));
    await landing.goto(cfg.base + '/index.html', { waitUntil: 'domcontentloaded' });
    await landing.waitForTimeout(700);

    /* Event panel: open it and fire every card it offers. */
    await landing.click('#event-modal-icon').catch(() => {});
    await landing.waitForTimeout(400);
    /* Clicked through the DOM rather than with a real pointer. The cards sit
       in a scroll container inside the drawer, so Playwright's visibility and
       stability checks reject most of them, and what is under test here is the
       handler, not whether the pixel is reachable.

       Asserted, not assumed. The first version of this block used a GUESSED
       selector, matched nothing, fired nothing, and therefore reported "no ec:*
       calls" while the panel really was still calling ec:addToWishlist. A guard
       that cannot fail is not a guard, so the count is checked first. */
    const cardCount = await landing.evaluate(() => {
        const bs = [...document.querySelectorAll('#event-manager-modal .send-btn')];
        bs.forEach(b => b.click());
        return bs.length;
    });
    await landing.waitForTimeout(500);
    ok(cardCount >= 6,
        'event panel fired its cards (' + cardCount + ' send buttons)');

    /* Scenario launcher: fire a few scenarios.

       Scoped to the per-item button by its LABEL, read from sites.js, not to
       every button in the drawer. The drawer also holds the close control, the
       push opt-in and "Reset displays", and that last one reloads the page,
       which killed this suite the first time it was written. The same trap is
       already documented: an earlier probe reported ok while firing nothing,
       because it clicked the drawer's first button, which is the close. */
    await landing.click('#sticky-icon').catch(() => {});
    await landing.waitForTimeout(400);
    const label = cfg.launcherButton;
    const showButtons = await landing.$$('#sticky-modal button');
    let fired = 0;
    for (const b of showButtons) {
        const txt = (await b.textContent().catch(() => '') || '').trim();
        if (txt !== label) continue;
        await b.click().catch(() => {});
        await landing.waitForTimeout(150);
        if (++fired >= 4) break;
    }
    ok(fired > 0, 'launcher fired ' + fired + ' scenarios (button label "' + label + '")');

    const landingSent = await landing.evaluate(() => window.__sent || []);
    const landingEvents = eventsFrom(landingSent);

    const landingEc = landingSent.filter(a =>
        typeof a[0] === 'string' && a[0].indexOf('ec:') === 0);
    ok(landingEc.length === 0,
        'no ec:* calls from the event panel or the launcher ('
        + ([...new Set(landingEc.map(c => c[0]))].join(', ') || 'none') + ')');

    ok(landingErrors.length === 0,
        'no page errors on the landing page ('
        + (landingErrors.join(' | ') || 'none') + ')');

    await landing.close();

    /* ============================================================ assertions */

    await harvest();
    const sent = SENT;
    const events = eventsFrom(sent);

    console.log('\n--- ' + events.length + ' events across ' +
        new Set(events.map(e => e.table)).size + ' tables ---');

    /* Every table the site writes must be one this model actually has. A row
       sent to a table that does not exist still answers 200 and is discarded,
       which is how fintech_events and fintech_onsite_events went on being
       written for hours after the rebuild replaced them. */
    const KNOWN = new Set(Object.values(cfg.tables));
    const unknown = [...new Set(
        [...events, ...landingEvents].map(e => e.table).filter(x => !KNOWN.has(x)))];
    ok(unknown.length === 0,
        'every table written is in the model (' + (unknown.join(', ') || 'none') + ')');

    /* 1. No ecommerce API, at all. The whole reason this rebuild happened. */
    const ecCalls = sent.filter(a => typeof a[0] === 'string' && a[0].indexOf('ec:') === 0);
    ok(ecCalls.length === 0,
        'no ec:* calls (' + (ecCalls.map(c => c[0]).join(', ') || 'none') + ')');

    /* 2. page_view_events is the one standard table kept. */
    ok(sent.some(a => a[0] === 'pageView'), 'pageView still fires (page_view_events)');

    /* 3. Each domain writes its own table, with the events EVENT-MODEL.md
          specifies. Named individually rather than counted, so a rename shows
          up as the specific thing that broke. */
    const expected = [
        [cfg.tables.onboarding, 'kyc_started'],
        [cfg.tables.onboarding, 'kyc_approved'],
        [cfg.tables.onboarding, 'account_opened'],
        [cfg.tables.account, 'balance_viewed'],
        [cfg.tables.transaction, 'transfer_sent'],
        [cfg.tables.transaction, 'transaction_failed'],
        [cfg.tables.card, 'card_frozen'],
        [cfg.tables.card, 'card_ordered'],
        [cfg.tables.savings, 'pot_created'],
        [cfg.tables.savings, 'pot_funded'],
        [cfg.tables.investment, 'investment_made'],
        [cfg.tables.credit, 'loan_quote_requested'],
        [cfg.tables.product, 'product_shortlisted'],
        [cfg.tables.product, 'product_compared'],
        [cfg.tables.product, 'application_started'],
        [cfg.tables.product, 'application_submitted'],
        [cfg.tables.support, 'fraud_reported'],
    ];
    expected.forEach(([table, name]) => {
        ok(sawEvent(events, table, name), table + ' <- ' + name);
    });

    /* 4. The common spine, agreed with the Banking session so the two finance
          datasets are interchangeable. Six columns the SITE writes; the other
          three come from the SDK, see below. */
    const SPINE = ['event_type', 'event_source', 'page_path',
                   'is_authenticated', 'customer_tier', 'app_version'];
    const missingSpine = events.filter(e =>
        SPINE.some(k => e.payload[k] === undefined));
    ok(missingSpine.length === 0,
        'every event carries the six site-written spine columns ('
        + missingSpine.length + ' missing)');

    ok(events.every(e => e.payload.event_source === 'web'),
        'every event is tagged event_source = web');

    /* The full URL, not just the path: the query string carries ?ck= and the
       campaign parameters, and a path alone would lose attribution. */
    ok(events.every(e => /^https?:\/\//.test(e.payload.page_path || '')),
        'page_path carries the full URL, not just the path');

    ok(events.every(e => typeof e.payload.is_authenticated === 'boolean'),
        'is_authenticated is a boolean, not a string');

    const TIERS = ['prospect', 'classic', 'premier', 'private'];
    const badTier = events.filter(e => !TIERS.includes(e.payload.customer_tier));
    ok(badTier.length === 0,
        'customer_tier uses the shared vocabulary (' + TIERS.join('|') + ')');

    /* 4b. Identity is the SDK's to write, never the site's.

       dn_device_id, dn_contact_key and session_id travel in the event envelope
       and are resolved per event. A hand-written copy goes stale the moment
       somebody signs in or out, and the row would still land, just disagreeing
       with the envelope. So its absence is asserted rather than assumed.

       This suite previously asserted the OPPOSITE, that every row carried a
       device_id captured through getDeviceId. That was built on a guess about
       an undocumented column and was corrected once the platform behaviour was
       confirmed. */
    const SDK_OWNED = ['dn_device_id', 'dn_contact_key', 'session_id',
                       'device_id', 'contact_key', 'key'];
    const wroteIdentity = events.filter(e =>
        SDK_OWNED.some(k => k in e.payload));
    ok(wroteIdentity.length === 0,
        'no payload writes an SDK-owned identity column ('
        + (wroteIdentity.map(e => e.event).join(', ') || 'none') + ')');

    /* 5. stock_count is never sent from a finance site. A card has no unit
          count and a fabricated figure poisons every segment built on it. */
    const withStock = events.filter(e => 'stock_count' in e.payload);
    ok(withStock.length === 0, 'no payload carries stock_count');

    /* 6. Absent means absent. An empty string or a null that survived into a
          payload becomes 0 or '' in the table and reads as a real answer. */
    const zeroFilled = events.filter(e =>
        Object.values(e.payload).some(v => v === null || v === undefined || v === ''));
    ok(zeroFilled.length === 0,
        'no payload carries a null or empty value (' + zeroFilled.length + ')');

    /* 7. Money is a number, never a formatted string. "$120.50" in a decimal
          column stores as null and the sum of a campaign's transfers is 0. */
    const moneyKeys = ['amount', 'balance', 'fee', 'monthly_fee', 'goal_amount',
                       'current_amount', 'requested_amount', 'disputed_amount'];
    const badMoney = events.filter(e =>
        moneyKeys.some(k => k in e.payload && typeof e.payload[k] !== 'number'));
    ok(badMoney.length === 0, 'every money field is a number, not a string');

    /* 8. A failed transfer must carry its reason, or the segment cannot tell
          "declined for funds" from "declined by rules". */
    const failed = events.find(e => e.event === 'transaction_failed');
    ok(failed && failed.payload.failure_reason === 'insufficient_funds',
        'a failed transfer records failure_reason');

    ok(pageErrors.length === 0,
        'no page errors (' + (pageErrors.join(' | ') || 'none') + ')');

    await browser.close();

    console.log('');
    if (failures) {
        console.log(failures + ' CHECK(S) FAILED');
        process.exit(1);
    }
    console.log('The app writes the tables EVENT-MODEL.md specifies, and no ecommerce table.');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
