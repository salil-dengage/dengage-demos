const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();
const base = process.argv[2], prefix = process.argv[3];
const SECTIONS = ['#products', '#collections', '#story', '#craftsmanship', '#contact'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost:8101') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('JS: ' + String(e).slice(0, 140)));
  p.on('response', r => { if (r.url().startsWith('http://localhost:8101') && r.status() >= 400) errs.push('HTTP' + r.status() + ' ' + r.url().replace('http://localhost:8101','')); });
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  // product grid must be populated from the feed
  const cards = await p.$$eval('#productGrid .product-card', els => els.length);
  console.log('product cards rendered:', cards);
  const imgs = await p.evaluate(() => {
    const bad = [];
    document.querySelectorAll('img').forEach(i => { if (!(i.complete && i.naturalWidth > 0)) bad.push(i.getAttribute('src')); });
    return bad;
  });
  console.log('broken images:', imgs.length ? imgs.join(', ') : 'none');
  for (const sel of SECTIONS) {
    const el = await p.$(sel);
    if (!el) { console.log('MISSING SECTION', sel); continue; }
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(900);
    await p.screenshot({ path: prefix + sel.replace('#','') + '.png' });
  }
  console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'no JS errors / no bad responses');
  await b.close();
})();
