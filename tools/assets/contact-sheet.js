const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const dir = process.argv[2], out = process.argv[3];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort();
const cells = files.map(f => {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  return `<figure><div class="wrap">${svg}</div><figcaption>${f.replace('.svg','')}</figcaption></figure>`;
}).join('');
const html = `<style>body{margin:0;background:#fff;font:12px Inter,sans-serif}
main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px}
figure{margin:0;text-align:center}.wrap svg{width:100%;height:auto;display:block}
figcaption{padding:4px;color:#222;font-weight:700}</style><main>${cells}</main>`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
  await p.setContent(html);
  await p.waitForTimeout(1000);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
