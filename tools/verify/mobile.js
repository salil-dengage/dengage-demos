/* ============================================================================
   mobile: does the site fit the screen it is being demoed on?

       node tools/verify/mobile.js fintech
       node tools/verify/mobile.js banking

   These demos get shown on a laptop most of the time and on a phone the rest
   of the time, usually the prospect's own, handed across a table. A horizontal
   scrollbar on a money app is the kind of thing a prospect notices in the
   first two seconds and never stops noticing.

   WHAT IT CHECKS

   Horizontal overflow, at three viewports, on every page the site has. The
   test is simply documentElement.scrollWidth against innerWidth, which is the
   one measurement that catches the whole class: a fixed width, a long unbroken
   string, a grid whose minimum column exceeds the screen, a widget positioned
   off the right edge.

   When it fails it names the offending elements, because "the page is 40px too
   wide" without saying what is 40px too wide is a bug report you have to
   redo from scratch.

   WHAT IT DOES NOT CHECK

   Whether the layout is GOOD on a phone, only that it fits. Tap target sizes,
   readable font sizes and reachable controls are a separate question and a
   human one. Use secshot.js for the visual pass.
   ========================================================================== */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { site, offlineRoute, seedSession } = require('./sites');

const cfg = site();

/* Two phones and a tablet. 360 is the narrowest Android still in wide use and
   is where a fixed-width element shows up first; 390 is the current iPhone;
   768 is the iPad portrait width where a desktop grid usually breaks before
   the mobile breakpoint catches it. */
const SIZES = [
    { w: 360, h: 800, name: 'Android 360' },
    { w: 390, h: 844, name: 'iPhone 390' },
    { w: 768, h: 1024, name: 'iPad 768' },
];

let failures = 0;
function ok(cond, label) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
    if (!cond) failures++;
}

(async () => {
    /* Every page this site has: the landing, the product page, and the app
       surface where a site has one. Read from config so a site that adds a
       page does not silently go unchecked. */
    const pages = ['index.html', 'product.html?id=' + cfg.productId];
    if (cfg.appSurface) pages.push(cfg.appSurface);
    /* Sites that have grown past two pages list the rest here. Banking has
       thirteen, and eleven of them were unmeasured: that is how a <select>
       sizing to its longest option pushed one page 48px wide at 768px. */
    (cfg.mobilePages || []).forEach(rel => pages.push(rel));

    const browser = await chromium.launch();

    for (const size of SIZES) {
        for (const rel of pages) {
            const ctx = await browser.newContext({
                viewport: { width: size.w, height: size.h },
                isMobile: size.w < 500,
                hasTouch: size.w < 500,
            });
            await offlineRoute(ctx, cfg);
            await seedSession(ctx, cfg);   // gated portals, see sites.js
            const page = await ctx.newPage();
            /* A signed-in surface renders its gate, not its content, without
               a user. Measuring the gate would pass while the real page
               overflowed. */
            if (cfg.mobileUser) {
                await page.addInitScript(u => {
                    try { localStorage.setItem('meridian_user', JSON.stringify(u)); } catch (e) {}
                }, cfg.mobileUser);
            }
            /* The SDK is stubbed to a no-op rather than recorded: this suite
               is about layout, and an unstubbed dengage() would throw. */
            await page.addInitScript(() => { window.dengage = function () {}; });
            await page.goto(cfg.base + '/' + rel, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(900);

            const r = await page.evaluate(() => {
                const de = document.documentElement;
                const offenders = [...document.querySelectorAll('body *')]
                    .filter(e => {
                        const b = e.getBoundingClientRect();
                        /* Ignore anything with no box: a hidden inline slot or
                           a zero-size wrapper cannot push the page wide. */
                        return b.width > 0 && b.height > 0 &&
                               (b.right > window.innerWidth + 2 || b.left < -2);
                    })
                    .slice(0, 5)
                    .map(e => e.tagName.toLowerCase() +
                        (typeof e.className === 'string' && e.className
                            ? '.' + e.className.trim().split(/\s+/)[0] : ''));
                return {
                    scrollWidth: de.scrollWidth,
                    viewport: window.innerWidth,
                    offenders,
                };
            });

            const fits = r.scrollWidth <= r.viewport + 2;
            ok(fits, size.name.padEnd(12) + rel.split('?')[0].padEnd(13) +
                (fits
                    ? 'fits (' + r.scrollWidth + 'px)'
                    : 'OVERFLOWS by ' + (r.scrollWidth - r.viewport) + 'px: ' +
                      (r.offenders.join(', ') || 'no single element identified')));

            await ctx.close();
        }
    }

    await browser.close();

    console.log('');
    if (failures) {
        console.log(failures + ' viewport/page combination(s) overflow');
        process.exit(1);
    }
    console.log('every page fits every viewport, no horizontal scroll');
})().catch(err => { console.error(err); process.exit(1); });
