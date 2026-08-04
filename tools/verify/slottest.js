// ============================================================================
// slottest: the Dengage inline target slots, on every site.
//
//   node tools/verify/slottest.js              # all four sites
//   node tools/verify/slottest.js fintech      # one site
//
// All four sites carry the same five slots at the same anchors, because they
// share one page skeleton. The suite reads the site list from sites.js so a new
// site is covered automatically.
//
// Empty placeholders whose ids contain "dn_inline_target", so the panel's
// Inline Target Selector finds them on its default search rather than making
// you hand-write a CSS selector against classes that may be restyled later.
//
// Three are static in the HTML, including the top-of-page one on both pages.
// The other two are emitted by the renderers, because those regions are rebuilt
// with innerHTML, which would wipe a slot placed in the HTML.
//
// What this checks, and why:
//   present            a missing slot means the panel picker finds nothing,
//                      which is the exact symptom that started this
//   empty and hidden   an unused slot must cost nothing. In the product grid an
//                      empty cell would take a whole card's space under the
//                      card-alignment rules
//   reveals when filled  the engine's "Fill" mode puts content inside the node,
//                      so :empty stops matching and the slot appears
//   clears the header  the top-of-page slot sits at flow position 0, behind the
//                      fixed header, so its content must start at or below the
//                      header's bottom edge and its clearance band must be
//                      opaque, or the body colour shows through the header
//   contains overflow  a Story rail is wider than a phone viewport. Unchecked
//                      it pushed the whole page sideways, 782px of scrollWidth
//                      in a 420px viewport, which reads as a broken site
//   no console errors  the renderer changes must not break either page
// ============================================================================
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const { site, allSites } = require('./sites');
const ROOT = process.env.BASE_URL || 'http://localhost:8101';
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// one site if named on the command line, otherwise every site in sites.js
const TARGETS = process.argv[2] ? [process.argv[2]] : allSites();

function pagesFor(cfg) {
  return [
    {
      url: cfg.path + '/index.html',
      slots: [
        { id: 'dn_inline_target_below_header', parent: null, clearsHeader: true },
        { id: 'dn_inline_target_below_hero', parent: null },
        { id: 'dn_inline_target_in_grid', parent: cfg.inGridParent || 'productGrid' },
        { id: 'dn_inline_target_above_footer', parent: null },
      ],
    },
    {
      url: cfg.path + '/product.html?id=' + cfg.productId,
      slots: [
        { id: 'dn_inline_target_below_header', parent: null, clearsHeader: true },
        { id: 'dn_inline_target_pdp_below_price', parent: null },
      ],
    },
  ];
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // the sandbox blocks Chromium's outbound network, so everything off-origin is
  // fulfilled empty. The SDK is not needed here: these are host-page slots.
  await ctx.route('**/*', r => r.request().url().startsWith(ROOT)
    ? r.continue() : r.fulfill({ status: 200, body: '' }));

  const problems = [];
  const PAGES = TARGETS.flatMap(name => pagesFor(site(name)));

  for (const page of PAGES) {
    const p = await ctx.newPage();
    const errors = [];
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(ROOT + page.url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2600);
    console.log(`\n--- ${page.url} ---`);

    for (const slot of page.slots) {
      const r = await p.evaluate(id => {
        const el = document.getElementById(id);
        if (!el) return { missing: true };
        return {
          empty: !el.innerHTML.trim(),
          display: getComputedStyle(el).display,
          height: el.getBoundingClientRect().height,
          parentId: el.parentElement.id || null,
        };
      }, slot.id);

      const bad = [];
      if (r.missing) bad.push('not on the page');
      else {
        if (!r.empty) bad.push('ships with content in it');
        if (r.display !== 'none') bad.push(`display is ${r.display}, must be none while empty`);
        if (r.height !== 0) bad.push(`takes ${Math.round(r.height)}px while empty`);
        if (slot.parent && r.parentId !== slot.parent) {
          bad.push(`parent is ${r.parentId}, expected ${slot.parent}`);
        }
      }
      bad.forEach(b => problems.push(`${slot.id}: ${b}`));
      console.log(`  ${bad.length ? 'FAIL' : 'PASS'}  ${slot.id} inert while empty`);
      bad.forEach(b => console.log('        - ' + b));
    }

    // simulate the engine's Fill mode
    const filled = await p.evaluate(ids => {
      const out = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) { out[id] = { missing: true }; continue; }
        el.dataset.dnInlineReserved = 'slottest';
        el.innerHTML = '<div style="height:90px"></div>';  // firstElementChild is measured above
        out[id] = {
          display: getComputedStyle(el).display,
          height: Math.round(el.getBoundingClientRect().height),
        };
      }
      return out;
    }, page.slots.map(s => s.id));

    for (const slot of page.slots) {
      const f = filled[slot.id];
      const ok = !f.missing && f.display !== 'none' && f.height >= 88;
      if (!ok) problems.push(`${slot.id}: does not reveal when filled (${JSON.stringify(f)})`);
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${slot.id} reveals when filled (${f.height}px)`);
    }

    // a top-of-page slot must render BELOW the fixed header, not behind it
    for (const slot of page.slots.filter(s => s.clearsHeader)) {
      await p.waitForTimeout(600);   // the clearance watcher is debounced
      const geo = await p.evaluate(id => {
        const el = document.getElementById(id);
        const inner = el.firstElementChild;
        const hd = document.querySelector('.site-header');
        return {
          contentTop: Math.round(inner.getBoundingClientRect().top),
          headerBottom: Math.round(hd.getBoundingClientRect().bottom),
          clearance: getComputedStyle(document.documentElement)
            .getPropertyValue('--dn-header-clearance').trim(),
          bg: getComputedStyle(el).backgroundColor,
        };
      }, slot.id);
      const clears = geo.contentTop >= geo.headerBottom - 1;
      const opaque = geo.bg !== 'rgba(0, 0, 0, 0)';
      if (!clears) {
        problems.push(`${slot.id}: content top ${geo.contentTop}px is above header bottom ${geo.headerBottom}px, it would render behind the header`);
      }
      if (!opaque) problems.push(`${slot.id}: clearance band is transparent, the body colour shows through the header`);
      console.log(`  ${clears && opaque ? 'PASS' : 'FAIL'}  ${slot.id} clears the header`
        + ` (content ${geo.contentTop}px vs header bottom ${geo.headerBottom}px,`
        + ` --dn-header-clearance ${geo.clearance || 'unset'}, bg ${geo.bg})`);
    }

    // wide injected content must scroll inside the slot, not move the page
    await p.setViewportSize({ width: 420, height: 800 });
    await p.waitForTimeout(400);
    const overflow = await p.evaluate(ids => {
      const doc = document.documentElement;
      const before = doc.scrollWidth;
      const wide = '<div style="display:flex"><div style="flex:0 0 900px;height:60px"></div></div>';
      const out = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.innerHTML = wide;
        out[id] = { pageScrollWidth: doc.scrollWidth, viewport: doc.clientWidth };
        el.innerHTML = '';
      }
      out._before = before;
      return out;
    }, page.slots.map(s => s.id));

    for (const slot of page.slots) {
      const o = overflow[slot.id];
      if (!o) continue;
      const contained = o.pageScrollWidth <= o.viewport + 1;
      if (!contained) {
        problems.push(`${slot.id}: 900px of content pushed the page to ${o.pageScrollWidth}px in a ${o.viewport}px viewport`);
      }
      console.log(`  ${contained ? 'PASS' : 'FAIL'}  ${slot.id} contains overflow at 420px`
        + ` (page ${o.pageScrollWidth}px / viewport ${o.viewport}px)`);
    }
    await p.setViewportSize({ width: 1440, height: 900 });

    if (errors.length) {
      problems.push(`${page.url}: console errors ${errors.slice(0, 2).join(' | ')}`);
      console.log('  FAIL  console errors: ' + errors.slice(0, 2).join(' | '));
    } else {
      console.log('  PASS  no console errors');
    }
    await p.close();
  }

  await browser.close();
  console.log(problems.length
    ? `\n${problems.length} problem(s)`
    : `\nall inline target slots behave correctly on ${TARGETS.length} site(s)`);
  process.exit(problems.length ? 1 : 0);
})();
