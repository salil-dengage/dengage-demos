const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();
const fs = require('fs');
const fail = [];
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail.push(m); };
const barHtml = fs.readFileSync(require('path').join(REPO, 'cantu-pneus/panel-content/en/stickey-bar.html'), 'utf8');
const imgBarHtml = fs.readFileSync(require('path').join(REPO, 'cantu-pneus/panel-content/en/image-bar.html'), 'utf8');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  await p.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);

  const headerTop = () => p.$eval('.site-header', h => Math.round(h.getBoundingClientRect().top));
  ok(await headerTop() === 0, 'header at top:0 with no banner');

  // --- 1) TOP banner, content inside an IFRAME (worst case for CSS reach) ---
  await p.evaluate((html) => {
    const c = document.createElement('div');
    c.className = '_dn_onsite-banner';
    c.id = '__sim_top';
    c.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;';
    const f = document.createElement('iframe');
    f.style.cssText = 'width:100%;height:54px;border:0;display:block;';
    c.appendChild(f);
    document.body.appendChild(c);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  }, barHtml);
  await p.waitForTimeout(1200);
  const t1 = await headerTop();
  ok(t1 === 54, 'TOP banner (iframed): header pushed down by banner height (' + t1 + 'px)');
  await p.screenshot({ path: 'offset-top.png' });

  // banner removed (engine close) -> header back
  await p.evaluate(() => document.getElementById('__sim_top').remove());
  await p.waitForTimeout(1000);
  ok(await headerTop() === 0, 'header returns to 0 when banner is removed');

  // --- 2) BOTTOM banner: header untouched ---
  await p.evaluate((html) => {
    const c = document.createElement('div');
    c.className = '_dn_onsite-banner';
    c.id = '__sim_bottom';
    c.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483000;';
    c.innerHTML = html;
    document.body.appendChild(c);
  }, imgBarHtml);
  await p.waitForTimeout(1200);
  ok(await headerTop() === 0, 'BOTTOM banner: header stays at 0 (not affected)');
  await p.screenshot({ path: 'offset-bottom.png' });
  await p.evaluate(() => document.getElementById('__sim_bottom').remove());
  await p.waitForTimeout(800);

  // --- 3) popup overlay: header untouched ---
  await p.evaluate(() => {
    const o = document.createElement('div');
    o.className = '_dn_onsite-overlay';
    o.id = '__sim_popup';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(26,16,48,.5);z-index:2147483000;display:flex;align-items:center;justify-content:center;';
    o.innerHTML = '<div class="_dn_onsite-modal" style="width:400px;height:300px;background:#fff;border-radius:16px;"></div>';
    document.body.appendChild(o);
  });
  await p.waitForTimeout(1000);
  ok(await headerTop() === 0, 'popup overlay: header stays at 0 (not affected)');
  await p.evaluate(() => document.getElementById('__sim_popup').remove());

  // --- 4) content-close inside iframe (our X) also releases the header ---
  await p.evaluate((html) => {
    const c = document.createElement('div');
    c.className = '_dn_onsite-banner';
    c.id = '__sim_top2';
    c.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;';
    const f = document.createElement('iframe');
    f.id = '__sim_frame';
    f.style.cssText = 'width:100%;height:54px;border:0;display:block;';
    c.appendChild(f);
    document.body.appendChild(c);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  }, barHtml);
  await p.waitForTimeout(1200);
  ok(await headerTop() === 54, 'second TOP banner: header pushed again');
  // click the X inside the iframe; strip hides, iframe stays 54 -> header stays (engine
  // normally removes the container; here we then shrink the iframe like the engine's resize)
  const frame = p.frames().find(f => f.parentFrame() !== null);
  await frame.click('.cb-close');
  await p.evaluate(() => { document.getElementById('__sim_frame').style.height = '0px'; });
  await p.waitForTimeout(1200);
  ok(await headerTop() === 0, 'closing the bar content releases the header');
  await p.evaluate(() => document.getElementById('__sim_top2').remove());

  await b.close();
  console.log('\n================  ' + (fail.length ? fail.length + ' FAILURES' : 'ALL CHECKS PASSED') + '  ================');
  process.exit(fail.length ? 1 : 0);
})();
