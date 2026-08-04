const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();
if (!CFG.sweep || !CFG.sweep.enabled) {
  console.log('copy sweep skipped for ' + CFG.key + ' (nothing forbidden on this site)');
  process.exit(0);
}

// Portuguese-only signals in visible text. Brand words (CantuPneus) and
// currency (R$) are legitimately kept on the EN site.
const PT = new RegExp('\\b(' + (CFG.sweep.forbid || 'a^') + ')\\b');

const WIDGETS = [
  ['mega-banner', () => window.showSliderBanner()],
  ['expand-banner', () => ExpandBanner()],
  ['head-banner', () => window.showHeadBanner()],
  ['notification-icon', () => addIcon()],
  ['side-bar', () => { if (!window.EaringWidget) earingWidget(); window.EaringWidget.open(); }],
  ['bottom-assistant', () => { if (!window.openBottomAssistant) BottomAssistant(); window.openBottomAssistant(); }],
  ['carousel-banner', () => carouselBanner()],
  ['spin-to-win', () => WheelGame()],
  ['scratch-to-win', () => ScratchGame()],
  ['santa-deer', () => SantaGame()],
  ['like-card', () => LikeCardGame()],
  ['classic-widget', () => ClassicWidget()],
  ['banner-widget', () => BannerWidget()],
  ['tab-widget', () => TabWidget()],
  ['sidebar-widget', () => SideBarWidget()],
  ['popup-widget', () => PopupWidget()],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const findings = [];

  async function scan(page, label) {
    const bad = await page.evaluate((ptSrc) => {
      const re = new RegExp(ptSrc, '');
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const el = n.parentElement;
        if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
        const t = (n.textContent || '').trim();
        if (t.length < 3) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const m = t.match(re);
        if (m) out.push(m[0] + ' :: ' + t.slice(0, 80));
      }
      // also aria-labels / placeholders / alt / title
      document.querySelectorAll('[aria-label],[placeholder],[alt],[title]').forEach(el => {
        ['aria-label', 'placeholder', 'alt', 'title'].forEach(a => {
          const v = el.getAttribute(a);
          if (v && v.length > 2) { const m = v.match(re); if (m) out.push('@' + a + ' ' + m[0] + ' :: ' + v.slice(0, 70)); }
        });
      });
      return [...new Set(out)];
    }, PT.source);
    if (bad.length) findings.push([label, bad]);
    return bad.length;
  }

  // --- home page, base state ---
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  await p.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  console.log('home base:', await scan(p, 'home/base') === 0 ? 'clean' : 'FORBIDDEN COPY');

  // cart drawer + login modal + launcher + event panel
  //    The drawer's copy still needs sweeping wherever one EXISTS, and what
  //    exists differs: the retail sites drive a cart, banking drives a
  //    shortlist, fintech has neither. Selectors come from sites.js and the
  //    step is skipped only when the control is genuinely absent. Hard-coding
  //    [data-cart-add] here previously CRASHED the suite on banking rather
  //    than reporting a language leak, which is the worse failure of the two.
  if (!(await p.$(CFG.hooks.add))) {
    console.log('basket drawer: SKIP (' + CFG.key + ' has none)');
  } else {
    await p.evaluate(sel => document.querySelector(sel)?.click(), CFG.hooks.add);
    await p.evaluate(sel => document.querySelector(sel)?.click(), CFG.hooks.open);
    await p.waitForTimeout(700);
    console.log('basket drawer:', await scan(p, 'basket-drawer') === 0 ? 'clean' : 'FORBIDDEN COPY');
    await p.evaluate(sel => document.querySelector(sel)?.click(), CFG.hooks.close);
  }
  await p.evaluate(() => document.querySelector('[data-login-btn]').click());
  await p.waitForTimeout(600);
  console.log('login modal:', await scan(p, 'login-modal') === 0 ? 'clean' : 'FORBIDDEN COPY');
  await p.evaluate(() => document.querySelector('[data-close-login]').click());
  await p.evaluate(() => document.getElementById('cantupneus-sticky-icon')?.click() || document.querySelector('[id*=sticky-icon]')?.click());
  await p.waitForTimeout(700);
  console.log('scenario launcher:', await scan(p, 'launcher') === 0 ? 'clean' : 'FORBIDDEN COPY');
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.getElementById('event-modal-icon').click());
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll('#event-manager-modal .event-header').forEach(h => h.click()));
  await p.waitForTimeout(600);
  console.log('event panel:', await scan(p, 'event-panel') === 0 ? 'clean' : 'FORBIDDEN COPY');
  await p.keyboard.press('Escape');

  // search panel and saved items, added because these were built after this
  // sweep was written and their labels are chosen from <html lang> at runtime,
  // which is exactly the kind of thing that goes wrong silently
  await p.evaluate(() => document.querySelector('[data-dns-open]')?.click());
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const i = document.querySelector('[data-dns-input]');
    if (i) { i.value = 'r'; i.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await p.waitForTimeout(700);
  console.log('search panel:', await scan(p, 'search-panel') === 0 ? 'clean' : 'FORBIDDEN COPY');
  // and the no-results state, which has copy of its own
  await p.evaluate(() => {
    const i = document.querySelector('[data-dns-input]');
    if (i) { i.value = 'zzqqxx'; i.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await p.waitForTimeout(600);
  console.log('search empty:', await scan(p, 'search-no-results') === 0 ? 'clean' : 'FORBIDDEN COPY');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // saved items: empty drawer first, then with an item in it
  await p.evaluate(() => document.querySelector('[data-dnw-open]')?.click());
  await p.waitForTimeout(500);
  console.log('saved empty:', await scan(p, 'wishlist-empty') === 0 ? 'clean' : 'FORBIDDEN COPY');
  await p.evaluate(() => document.querySelector('[data-dnw-close]')?.click());
  await p.evaluate(() => document.querySelector('.product-card .dnw-heart')?.click());
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-dnw-open]')?.click());
  await p.waitForTimeout(600);
  console.log('saved drawer:', await scan(p, 'wishlist-drawer') === 0 ? 'clean' : 'FORBIDDEN COPY');
  await p.evaluate(() => document.querySelector('[data-dnw-close]')?.click());
  await p.waitForTimeout(300);

  // --- each widget in a fresh page ---
  for (const [name, fn] of WIDGETS) {
    const c2 = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await c2.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));
    const q = await c2.newPage();
    await q.goto(CFG.home, { waitUntil: 'domcontentloaded' });
    await q.waitForTimeout(2000);
    try { await q.evaluate(fn); } catch (e) { console.log(name, 'launch error', String(e).slice(0, 60)); }
    await q.waitForTimeout(2200);
    const n = await scan(q, 'widget:' + name);
    console.log((n ? 'FOUND     ' : 'clean     ') + name);
    await c2.close();
  }

  // --- product page ---
  const c3 = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await c3.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const r3 = await c3.newPage();
  await r3.goto(CFG.product, { waitUntil: 'domcontentloaded' });
  await r3.waitForTimeout(3000);
  console.log('product page:', await scan(r3, 'product') === 0 ? 'clean' : 'FORBIDDEN COPY');

  // product page with something in the cart, so the drawer's item rows render;
  // those rows carry their own quantity controls and their own labels
  await r3.evaluate(() => document.querySelector('[data-product-add-to-cart]')?.click());
  await r3.evaluate(() => document.querySelector('[data-cart-open]')?.click());
  await r3.waitForTimeout(700);
  console.log('product cart rows:', await scan(r3, 'product-cart-rows') === 0 ? 'clean' : 'FORBIDDEN COPY');

  await b.close();
  console.log('\n============ FINDINGS ============');
  if (!findings.length) console.log('NO FORBIDDEN COPY IN VISIBLE TEXT');
  for (const [label, list] of findings) {
    console.log('\n## ' + label);
    list.slice(0, 25).forEach(x => console.log('   ' + x));
  }
})();
