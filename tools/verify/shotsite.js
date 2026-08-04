const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const url = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost:8101') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('JS: ' + String(e).slice(0, 120)));
  p.on('requestfailed', r => { if (r.url().startsWith('http://localhost:8101')) errs.push('REQFAIL: ' + r.url().replace('http://localhost:8101','')); });
  p.on('response', r => { if (r.url().startsWith('http://localhost:8101') && r.status() >= 400) errs.push('HTTP' + r.status() + ': ' + r.url().replace('http://localhost:8101','')); });
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: out, fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'no errors / no failed requests');
  await b.close();
})();
