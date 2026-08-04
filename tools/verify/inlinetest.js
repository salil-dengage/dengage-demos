/* ============================================================================
   inlinetest: does inline On-Site content behave itself once injected?

       node tools/verify/inlinetest.js fintech

   Sites with no inline content set are skipped, driven by `inlineContent` in
   sites.js rather than a list here.

   WHY THIS IS A SEPARATE SUITE FROM paneltest

   The inline path is not the popup path. Its rules are the OPPOSITE in four
   places, and paneltest asserts the popup ones, so running it over inline
   content would fail every file for the wrong reasons:

     popup / banner                     inline
     ..............................     ..............................
     rendered in a cross-origin iframe  cloned straight into the page
     needs target="_top" on anchors     no frame to break out of
     needs Dn.sendClick on the CTA      the SDK counts injected anchors itself
     CSS is sandboxed by the frame      the <style> lands in document.head

   That last one is the dangerous one and is the reason this file exists. An
   unscoped `.card { }` in inline content does not break the campaign, it
   restyles the HOST PAGE, and it does it silently. You would find out during a
   demo when the portal's own cards changed shape.

   WHAT IT DOES

   Injects each file exactly as the SDK does (style into head, HTML cloned into
   its target slot) into the real page, and compares the computed style of the
   host page's own furniture before and after. Anything that moved is a leak.

   It also checks the content actually rendered with height, because a file
   that renders nothing leaks nothing and would otherwise pass.
   ========================================================================== */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { site, offlineRoute, seedSession } = require('./sites');

const REPO = path.resolve(__dirname, '..', '..');
const cfg = site();

let failures = 0;
function ok(cond, label) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
    if (!cond) failures++;
}

/* The host page's own furniture. If any of these change when a campaign is
   injected, the campaign's CSS escaped its root. */
function probe() {
    const pick = sel => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const c = getComputedStyle(e);
        return [c.fontFamily, c.fontSize, c.color, c.backgroundColor,
                c.padding, c.margin, c.borderRadius, c.display].join('|');
    };
    return {
        body: pick('body'),
        card: pick('.npy-card, .product-card, .mrd-card'),
        button: pick('.npy-btn, .btn-primary'),
        heading: pick('h3'),
        anchor: pick('a'),
        pageWidth: document.documentElement.scrollWidth,
    };
}

(async () => {
    const set = cfg.inlineContent;
    if (!set) {
        console.log('SKIP  ' + cfg.key + ' has no inline content set '
            + '(inlineContent unset in sites.js)');
        process.exit(0);
    }

    const dir = path.join(REPO, set.dir);
    if (!fs.existsSync(dir)) {
        console.log('FAIL  inline content directory missing: ' + set.dir);
        process.exit(1);
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
    ok(files.length > 0, 'inline content files found (' + files.length + ')');

    const browser = await chromium.launch();

    for (const file of files) {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8');
        /* Comments explain the inline rules by naming them, so they are
           stripped before anything is counted. Checking the raw file would
           flag every file for the words in its own header. */
        const body = raw.replace(/<!--[\s\S]*?-->/g, '');

        const style = (body.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
        const markup = (body.match(/<body>([\s\S]*?)<\/body>/) || [])[1] || '';
        const rootId = (markup.match(/<div id="([a-zA-Z0-9_-]+)"/) || [])[1];

        /* ---------------------------------------------------------- static */
        ok(!!rootId, file + ': has a single root element with an id');

        const selectors = [...style.matchAll(/^\s*#([a-zA-Z0-9_-]+)/gm)].map(m => m[1]);
        const stray = [...new Set(selectors)].filter(s => s !== rootId);
        ok(stray.length === 0,
            file + ': every CSS rule is scoped under #' + rootId +
            (stray.length ? ' (stray: ' + stray.join(', ') + ')' : ''));

        ok(!/<script/i.test(body), file + ': no script block');
        ok(!/target="_top"/.test(body),
            file + ': no target="_top" (there is no frame on this path)');
        ok(!/sendClick/.test(body),
            file + ': no Dn.sendClick (the SDK counts injected anchors itself)');
        /* Escaped, not literal: a previous edit replaced the literal dashes
           in this file and turned this check into a test for commas. */
        ok(!/[\u2014\u2013]/.test(body), file + ': no em or en dashes');

        /* ---------------------------------------------------------- injected */
        const map = set.slots[file];
        if (!map) {
            ok(false, file + ': no target slot mapped in sites.js');
            continue;
        }
        /* Slot and page: the portal is five pages, so injecting into the wrong
           one would report a missing target instead of the real mistake. */
        const slot = map.slot || map;
        const pageRel = map.page || set.page;

        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await offlineRoute(ctx, cfg);
        await seedSession(ctx, cfg);   // app.html is gated
        const page = await ctx.newPage();
        await page.addInitScript(() => { window.dengage = function () {}; });
        await page.goto(cfg.base + '/' + pageRel, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);

        const before = await page.evaluate(probe);

        const height = await page.evaluate(([s, h, id]) => {
            const st = document.createElement('style');
            st.textContent = s;
            document.head.appendChild(st);       // exactly what the SDK does
            const target = document.getElementById(id);
            if (!target) return -1;
            target.innerHTML = h;
            return Math.round(target.getBoundingClientRect().height);
        }, [style, markup, slot]);

        await page.waitForTimeout(250);
        const after = await page.evaluate(probe);

        ok(height > 40, file + ': renders with height (' + height + 'px into #' + slot + ' on ' + pageRel + ')');

        const moved = Object.keys(before)
            .filter(k => k !== 'pageWidth' && before[k] !== after[k]);
        ok(moved.length === 0,
            file + ': leaks no CSS onto the host page' +
            (moved.length ? ' (changed: ' + moved.join(', ') + ')' : ''));

        ok(after.pageWidth <= 1280,
            file + ': does not widen the page (' + after.pageWidth + 'px)');

        await ctx.close();
    }

    await browser.close();

    console.log('');
    if (failures) {
        console.log(failures + ' CHECK(S) FAILED');
        process.exit(1);
    }
    console.log('inline content is scoped, renders, and leaves the host page alone');
})().catch(err => { console.error(err); process.exit(1); });
