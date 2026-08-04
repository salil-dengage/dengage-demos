/* ============================================================================
   gatetest: is the portal actually shut, and does the front door work?

       node tools/verify/gatetest.js fintech

   Sites with no `gate` block in sites.js are skipped.

   WHY THIS EXISTS

   The account portal used to be a link. "Open account" went straight to
   app.html, so the demo skipped the one moment a finance prospect cares about
   most, the lead, and the portal was not somewhere you arrived, it was just
   another page. Closing it introduced three ways to break the demo silently,
   and this suite is one check for each.

   1. THE GATE LETS SOMEBODY IN. Obvious, and the only one you would notice by
      hand.

   2. THE GATE LEAKS EVENTS. Bouncing a visitor is not enough. If the SDK has
      already initialised and js/pageView.js has already fired by the time the
      redirect lands, the portal writes a page view for somebody who never got
      in, and every "reached the portal" segment is quietly wrong. Note that
      location.replace() in the head does NOT stop the rest of the document
      executing, so this is a real hazard and not a theoretical one. The check
      stamps each SDK call with the page it came from, into sessionStorage so
      it survives the redirect: without the stamp you cannot tell the portal's
      page view from the landing page's, and the first version of this check
      could not, so it proved nothing.

   3. THE FRONT DOOR STOPS FIRING. "Open account" must push its dataLayer
      event, so the Dengage lead form can render, and must NOT navigate. A
      regression here looks like nothing at all: the button still works, it
      just quietly goes back to bypassing the lead capture.

   It also covers the dark-campaign fallback, because a hero CTA that does
   nothing when no campaign exists is worse than no CTA at all.
   ========================================================================== */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { site, offlineRoute, seedSession } = require('./sites');

const cfg = site();

let failures = 0;
function ok(cond, label) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
    if (!cond) failures++;
}

/* Records every dengage() call stamped with the page that made it, and keeps
   the log in sessionStorage so a redirect does not erase the evidence. */
function recorder() {
    window.dengage = function () {
        try {
            const k = '__dnlog';
            const prev = JSON.parse(sessionStorage.getItem(k) || '[]');
            prev.push(location.pathname.split('/').pop() + ' :: ' + arguments[0] +
                ' ' + (typeof arguments[1] === 'string' ? arguments[1] : ''));
            sessionStorage.setItem(k, JSON.stringify(prev));
        } catch (e) { /* private mode */ }
        (window.__dn = window.__dn || []).push([].slice.call(arguments));
    };
}

(async () => {
    const gate = cfg.gate;
    if (!gate) {
        console.log('SKIP  ' + cfg.key + ' has no gated surface (gate unset in sites.js)');
        process.exit(0);
    }

    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await offlineRoute(ctx, cfg);
    const page = await ctx.newPage();
    await page.addInitScript(recorder);

    /* ------------------------------------------------ 1. the portal is shut */
    await page.goto(cfg.base + '/' + gate.surface, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const bounced = page.url().split('/').pop();
    ok(bounced.indexOf(gate.bounceTo) === 0,
        'cold visit to ' + gate.surface + ' bounces to ' + bounced);

    ok(await page.locator(gate.formActive).count() === 1,
        'the sign-in form reopens on the bounce');

    const dl = await page.evaluate(() =>
        (window.dataLayer || []).map(e => e && e.event).filter(Boolean));
    ok(dl.indexOf(gate.blockedEvent) !== -1,
        'pushes ' + gate.blockedEvent + ' so a campaign can target the attempt');

    /* --------------------------------------- 2. the bounce leaked no events */
    const log = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('__dnlog') || '[]'));
    const fromPortal = log.filter(l => l.indexOf(gate.surface) === 0);
    ok(!fromPortal.some(l => /pageView/i.test(l)),
        'no portal page view for the bounced visitor (' +
        (fromPortal.join(' | ') || 'no SDK calls from the portal at all') + ')');
    ok(!fromPortal.some(l => /initialize/i.test(l)),
        'no SDK session opened on the portal for the bounced visitor');

    /* ------------------------------------------------- 3. the front door */
    await page.goto(cfg.base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.evaluate(() => { window.dataLayer = []; });
    await page.locator(gate.openAccount).first().click();
    await page.waitForTimeout(400);

    ok(page.url().indexOf(gate.surface) === -1,
        '"Open account" does not navigate to the portal any more');

    const intent = await page.evaluate(name =>
        (window.dataLayer || []).find(e => e && e.event === name), gate.intentEvent);
    ok(!!intent, 'pushes ' + gate.intentEvent + ' for the Dengage lead form');
    ok(!!intent && !!intent.cta_location && intent.cta_location !== 'unspecified',
        'the push carries cta_location (' + (intent && intent.cta_location) + ')');

    const onboarding = await page.evaluate(() => (window.__dn || [])
        .filter(a => a[0] === 'sendDeviceEvent' && /onboarding/.test(a[1] || '')).length);
    ok(onboarding >= 1, 'the onboarding funnel row is still written (' + onboarding + ')');

    /* The campaign does not exist in this offline run, which is exactly the
       dark-campaign case the fallback is for. */
    await page.waitForTimeout(1300);
    ok(await page.locator(gate.formActive).count() === 1,
        'campaign dark, the fallback opened the account form rather than nothing');

    /* --------------------------------------------- 4. signing in gets you in */
    for (const [sel, val] of Object.entries(gate.fill)) await page.fill(sel, val);
    await page.click(gate.submit);
    await page.waitForTimeout(2000);
    ok(page.url().indexOf(gate.surface) !== -1,
        'signing in lands in the portal (' + page.url().split('/').pop() + ')');

    /* And it stays open on a direct visit, or the session is not persisting. */
    await page.goto(cfg.base + '/' + gate.surface, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    ok(page.url().indexOf(gate.surface) !== -1,
        'a signed-in visitor stays in the portal on a direct visit');

    /* And the seed the OTHER suites rely on opens the same door. If this ever
       fails, appevents/inlinetest/mobile are measuring the landing page. */
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await offlineRoute(fresh, cfg);
    await seedSession(fresh, cfg);
    const p2 = await fresh.newPage();
    await p2.addInitScript(recorder);
    await p2.goto(cfg.base + '/' + gate.surface, { waitUntil: 'domcontentloaded' });
    await p2.waitForTimeout(900);
    ok(p2.url().indexOf(gate.surface) !== -1,
        'seedSession() from sites.js opens the portal for the other suites');
    await fresh.close();

    await browser.close();

    console.log('');
    if (failures) {
        console.log(failures + ' CHECK(S) FAILED');
        process.exit(1);
    }
    console.log('the portal is shut, the bounce is clean, and the front door fires');
})().catch(err => { console.error(err); process.exit(1); });
