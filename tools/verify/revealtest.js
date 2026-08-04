// ============================================================================
// revealtest: every page section becomes visible, at every viewport width.
//
//   node tools/verify/revealtest.js            (site from tools/verify/sites.js)
//
// Sections start at opacity 0 and are revealed by an IntersectionObserver in
// each site's main script. That is decorative, but it has a catastrophic
// failure mode: a section that never satisfies the observer stays invisible
// forever, and the content is simply gone.
//
// It happened. The observer used `threshold: 0.1`, and a fractional threshold is
// a share of the OBSERVED ELEMENT's area, not of the viewport. On a 512px
// viewport the products section is about 10900px tall, so it needed 1090px on
// screen inside an 800px window, which cannot happen. The entire product
// catalogue was invisible on mobile while desktop looked perfect, because the
// same section is only ~2600px wide-screen. All four sites shared the bug.
//
// This suite scrolls each page top to bottom the way a visitor would, at narrow
// and wide widths, then asserts no section is left under opacity 0.9. Keep
// `threshold: 0` in the site scripts and this stays green.
// ============================================================================
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { site } = require('./sites');

const CFG = site();
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// 390 and 512 are the widths where sections grow tall enough to expose a
// fractional threshold; 1440 is the desktop case that always looked fine.
const WIDTHS = [390, 512, 1440];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  await ctx.route('**/*', r => r.request().url().startsWith(CFG.root)
    ? r.continue() : r.fulfill({ status: 200, body: '' }));

  const problems = [];

  for (const page of [CFG.home, CFG.product]) {
    if (!page) continue;
    for (const width of WIDTHS) {
      const p = await ctx.newPage();
      await p.setViewportSize({ width, height: 800 });
      await p.goto(page, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1800);

      // walk the page the way a visitor scrolls it
      await p.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 90));
        }
        window.scrollTo(0, document.body.scrollHeight);
      });
      await p.waitForTimeout(1200);

      const hidden = await p.evaluate(() =>
        [...document.querySelectorAll('section')]
          .filter(s => parseFloat(getComputedStyle(s).opacity) < 0.9)
          .map(s => ({
            id: s.id || s.className.split(' ')[0],
            opacity: getComputedStyle(s).opacity,
            height: Math.round(s.getBoundingClientRect().height),
          })));
      await p.close();

      const label = `${page.replace(CFG.root, '')} at ${width}px`;
      if (hidden.length) {
        hidden.forEach(h => problems.push(
          `${label}: section "${h.id}" stuck at opacity ${h.opacity} (${h.height}px tall)`));
        console.log(`FAIL  ${label}`);
        hidden.forEach(h => console.log(`        ${h.id} opacity ${h.opacity}, ${h.height}px tall`));
      } else {
        console.log(`PASS  ${label}  every section revealed`);
      }
    }
  }

  await browser.close();
  console.log(problems.length
    ? `\n${problems.length} section(s) never became visible`
    : '\nevery section reveals at every width');
  process.exit(problems.length ? 1 : 0);
})();
