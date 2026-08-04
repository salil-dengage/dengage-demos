/* ============================================================================
   portaltest: does each portal page own its own scenarios?

       node tools/verify/portaltest.js fintech

   Sites with no `portal` block in sites.js are skipped.

   WHY THE PORTAL IS FIVE PAGES

   It was one page until 2 August 2026, with five views toggled by a hidden
   attribute. That meant all ten portal signals fired on a single load, so
   every inline campaign appeared at once and the only way to demo them one at
   a time was to reset between each. Splitting the views into real pages, each
   pushing only its own signals, is what makes a single campaign demonstrable.

   The important part: this needs NO panel change. The campaigns trigger on the
   EVENT NAME, so an event that only fires on cards.html can only ever show
   there. The page split does the targeting, not a URL rule.

   WHAT THIS ASSERTS, AND WHY IT IS NOT "these exact events fired"

   Three of the ten are conditional on state the demo does not start in: the
   balance is 2,480 so low_balance is correctly quiet, the seed card is
   activated, and the goals sit at 38% and 15%. Asserting an exact set would
   therefore encode "the demo's opening balance" into a suite about page
   scoping, and would go red the day someone changes the seed data.

   So it asserts the property that actually matters:

     1. no page fires a signal that belongs to another page. This is the whole
        guarantee. If it breaks, campaigns start appearing on top of each other
        again and the reason will not be obvious.
     2. every unconditional signal for the page does fire, so the scoping
        cannot be silently over-tight.
     3. a conditional signal still fires on its own page once the state
        matches, proved by walking the documented demo path rather than by
        seeding storage (state is not persisted until something changes it, so
        seeding before the first load writes into nothing).
     4. the page renders exactly one view, its tab is active, and the tabs are
        real links. A leftover preventDefault on .npy-tab would silently block
        navigation and put the whole split back to one page.
   ========================================================================== */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { site, offlineRoute, seedSession } = require('./sites');

const cfg = site();

let failures = 0;
function ok(cond, label) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
    if (!cond) failures++;
}

(async () => {
    const portal = cfg.portal;
    if (!portal) {
        console.log('SKIP  ' + cfg.key + ' has no portal (portal unset in sites.js)');
        process.exit(0);
    }

    const ALL = Object.values(portal)
        .flatMap(e => e.always.concat(e.conditional));

    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await offlineRoute(ctx, cfg);
    await seedSession(ctx, cfg);          // every portal page is gated

    for (const [rel, exp] of Object.entries(portal)) {
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message.slice(0, 80)));
        await page.goto(cfg.base + '/' + rel, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1400);

        console.log('');
        console.log('---- ' + rel + ' ----');
        ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs[0] : ''));

        const got = await page.evaluate(() => ({
            view: document.body.dataset.portalView,
            views: [...document.querySelectorAll('.npy-view')]
                .map(v => ({ v: v.dataset.view, kids: v.childElementCount })),
            slots: [...document.querySelectorAll('[id^="dn_inline_target_"]')].map(e => e.id),
            signals: (window.dataLayer || []).map(d => d && d.event).filter(Boolean),
            active: [...document.querySelectorAll('.npy-tab.is-active')].map(a => a.dataset.view),
            hrefs: [...document.querySelectorAll('.npy-tab')].map(a => a.getAttribute('href')),
        }));

        ok(got.view === exp.view, 'body carries data-portal-view="' + got.view + '"');
        ok(got.views.length === 1 && got.views[0].v === exp.view && got.views[0].kids > 0,
            'exactly one view, and it rendered: ' + JSON.stringify(got.views));
        ok(got.active.length === 1 && got.active[0] === exp.view,
            'its tab is the active one (' + got.active.join(',') + ')');
        ok(got.hrefs.length > 0 && got.hrefs.every(h => h && /\.html$/.test(h)),
            'the tabs are real links, not in-page toggles');

        const mine = exp.always.concat(exp.conditional);
        const foreign = got.signals.filter(e => !mine.includes(e) && ALL.includes(e));
        ok(foreign.length === 0,
            'no other page\'s signals leak here' + (foreign.length ? ': ' + foreign.join(', ') : ''));

        const missing = exp.always.filter(e => !got.signals.includes(e));
        ok(missing.length === 0,
            'every unconditional signal fired' +
            (missing.length ? ', MISSING ' + missing.join(', ')
                            : ' (' + (exp.always.join(', ') || 'none expected') + ')'));

        const noSlot = exp.slots.filter(s => !got.slots.includes(s));
        ok(noSlot.length === 0,
            'its inline slots are present' +
            (noSlot.length ? ', MISSING ' + noSlot.join(', ') : ' (' + got.slots.length + ')'));

        await page.close();
    }

    /* A conditional signal must still fire on its own page once state matches,
       or the scoping could be over-tight with nothing to say so. Walks the
       documented demo path: a card that was delivered and never activated. */
    const dormantPage = Object.keys(portal)
        .find(rel => portal[rel].conditional.includes('fintech_card_dormant'));
    if (dormantPage) {
        const page = await ctx.newPage();
        await page.goto(cfg.base + '/' + dormantPage, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const cards = await page.evaluate(() => {
            const S = window.NovaPayState;
            if (!S) return -1;
            const st = S.get();
            (st.cards || []).forEach(c => { c.activated = false; c.orderedDaysAgo = 2; });
            S.save(st);
            return (st.cards || []).length;
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1400);
        const sig = await page.evaluate(() =>
            (window.dataLayer || []).map(d => d && d.event).filter(e => /^fintech_/.test(e)));

        console.log('');
        console.log('---- ' + dormantPage + ', with a dormant card (' + cards + ') ----');
        ok(sig.includes('fintech_card_dormant'),
            'the conditional signal fires once the state matches: ' + JSON.stringify(sig));
        ok(!sig.some(e => e !== 'fintech_card_dormant'),
            'and still nothing belonging to another page');
        await page.close();
    }

    await browser.close();

    console.log('');
    if (failures) {
        console.log(failures + ' CHECK(S) FAILED');
        process.exit(1);
    }
    console.log('every portal page owns its own scenarios');
})().catch(err => { console.error(err); process.exit(1); });
