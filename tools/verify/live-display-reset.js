const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFile } = require('child_process');
const fs = require('fs');
function curlFetch(url, method, postData, contentType) {
  return new Promise((resolve) => {
    const hdrFile = '/tmp/h' + Math.floor(Math.random() * 1e9);
    const args = ['-sS','--max-time','45','-L','-X',method||'GET','-D',hdrFile,'-o','-','-A','Mozilla/5.0',url];
    if (postData && postData.length) { args.push('--data-binary','@-'); if (contentType) args.push('-H','Content-Type: '+contentType); }
    const child = execFile('curl', args, { encoding:'buffer', maxBuffer:32*1024*1024 }, (err, stdout) => {
      let status=200, ct='application/octet-stream';
      try { const h=fs.readFileSync(hdrFile,'utf8'); const bl=h.trim().split(/\r?\n\r?\n/); const last=bl[bl.length-1];
        const m=last.match(/^HTTP\/[\d.]+ (\d+)/); if(m) status=parseInt(m[1],10);
        const c=last.match(/^content-type:\s*(.+)$/im); if(c) ct=c[1].trim(); fs.unlinkSync(hdrFile);}catch(e){}
      resolve(err && !stdout ? {status:502,contentType:'text/plain',body:Buffer.from('')} : {status,contentType:ct,body:stdout||Buffer.from('')});
    });
    if (postData && postData.length) child.stdin.write(postData);
    child.stdin.end();
  });
}
const URL0 = 'https://salil-dengage.github.io/dengage-demos/cantu-pneus/index.html';
const fail = [];
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail.push(m); };
const POPUP = '[id^="_dn_onsite_popup-"]';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{width:1440,height:900}, locale:'pt-BR' });
  await ctx.route('**/*', async r => {
    const res = await curlFetch(r.request().url(), r.request().method(), r.request().postDataBuffer(), r.request().headers()['content-type']);
    r.fulfill({ status:res.status, contentType:res.contentType, body:res.body }).catch(()=>{});
  });
  const p = await ctx.newPage();
  await p.goto(URL0, { waitUntil:'domcontentloaded', timeout:120000 });
  await p.waitForFunction(() => typeof window.dengage === 'function', { timeout: 60000 });
  await p.waitForTimeout(6000);

  const dev0 = await p.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const name = dbs.map(d => d.name).find(n => /^Dengage /.test(n));
    const db = await new Promise((res, rej) => { const rq = indexedDB.open(name); rq.onsuccess = () => res(rq.result); rq.onerror = rej; });
    const id = await new Promise((res, rej) => { const t = db.transaction('activeState','readonly').objectStore('activeState').get('deviceId'); t.onsuccess = () => res(t.result); t.onerror = rej; });
    db.close(); return id;
  });
  console.log('  deviceId before: ' + dev0);

  await p.evaluate(() => { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event:'survey', actionType:'survey' }); });
  await p.waitForTimeout(5000);
  ok(await p.$(POPUP), 'scenario 1 (survey) displays');

  await p.evaluate(() => { window.dataLayer.push({ event:'nps-popup', actionType:'nps-popup' }); });
  await p.waitForTimeout(5000);
  const popups = await p.$$(POPUP);
  ok(popups.length === 1, 'scenario 2 blocked right after (global 5-min cooldown is active)');

  // === the new button's routine, verbatim ===
  await p.evaluate(async () => {
    function scrubVisitor(v) { if (!v || typeof v !== 'object') return v;
      delete v.lastOnsitePopupDisplayTime; v.onsiteMessageHistories = {}; v.onsiteABContentIds = {}; return v; }
    try { const m = JSON.parse(localStorage.getItem('_dn_visitors')); if (m) localStorage.setItem('_dn_visitors', JSON.stringify(scrubVisitor(m))); } catch (e) {}
    try { localStorage.removeItem('_dn_show'); } catch (e) {}
    const dbs = await indexedDB.databases();
    const name = dbs.map(d => d.name).filter(Boolean).find(n => n.indexOf('Dengage ') === 0);
    if (name) await new Promise((resolve) => {
      const rq = indexedDB.open(name);
      rq.onerror = resolve;
      rq.onsuccess = () => { const db = rq.result;
        const tx = db.transaction('visitors','readwrite');
        const cur = tx.objectStore('visitors').openCursor();
        cur.onsuccess = ev => { const c = ev.target.result; if (!c) return; c.update(scrubVisitor(c.value)); c.continue(); };
        tx.oncomplete = tx.onabort = tx.onerror = () => { db.close(); resolve(); }; };
    });
  });

  await p.goto(URL0, { waitUntil:'domcontentloaded', timeout:120000 });
  await p.waitForFunction(() => typeof window.dengage === 'function', { timeout: 60000 });
  await p.waitForTimeout(6000);

  const dev1 = await p.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const name = dbs.map(d => d.name).find(n => /^Dengage /.test(n));
    const db = await new Promise((res, rej) => { const rq = indexedDB.open(name); rq.onsuccess = () => res(rq.result); rq.onerror = rej; });
    const id = await new Promise((res, rej) => { const t = db.transaction('activeState','readonly').objectStore('activeState').get('deviceId'); t.onsuccess = () => res(t.result); t.onerror = rej; });
    db.close(); return id;
  });
  ok(dev0 && dev1 === dev0, 'device identity preserved through reset (' + dev1 + ')');

  await p.evaluate(() => { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event:'nps-popup', actionType:'nps-popup' }); });
  await p.waitForTimeout(5000);
  ok(await p.$(POPUP), 'scenario 2 (nps) displays right after reset, no browser clearing');

  // and once more: reset again in-page, reload, survey again -> repeatable forever
  await p.evaluate(async () => {
    function scrubVisitor(v) { if (!v || typeof v !== 'object') return v;
      delete v.lastOnsitePopupDisplayTime; v.onsiteMessageHistories = {}; v.onsiteABContentIds = {}; return v; }
    try { const m = JSON.parse(localStorage.getItem('_dn_visitors')); if (m) localStorage.setItem('_dn_visitors', JSON.stringify(scrubVisitor(m))); } catch (e) {}
    const dbs = await indexedDB.databases();
    const name = dbs.map(d => d.name).filter(Boolean).find(n => n.indexOf('Dengage ') === 0);
    if (name) await new Promise((resolve) => {
      const rq = indexedDB.open(name);
      rq.onerror = resolve;
      rq.onsuccess = () => { const db = rq.result;
        const tx = db.transaction('visitors','readwrite');
        const cur = tx.objectStore('visitors').openCursor();
        cur.onsuccess = ev => { const c = ev.target.result; if (!c) return; c.update(scrubVisitor(c.value)); c.continue(); };
        tx.oncomplete = tx.onabort = tx.onerror = () => { db.close(); resolve(); }; };
    });
  });
  await p.goto(URL0, { waitUntil:'domcontentloaded', timeout:120000 });
  await p.waitForFunction(() => typeof window.dengage === 'function', { timeout: 60000 });
  await p.waitForTimeout(6000);
  await p.evaluate(() => { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event:'survey', actionType:'survey' }); });
  await p.waitForTimeout(5000);
  ok(await p.$(POPUP), 'survey displays AGAIN after second reset -> repeatable demo loop');

  await b.close();
  console.log('\n================  ' + (fail.length ? fail.length + ' FAILURES' : 'ALL CHECKS PASSED') + '  ================');
  process.exit(fail.length ? 1 : 0);
})();
