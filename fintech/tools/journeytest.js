/* ============================================================================
   NovaPay's own journey suite. tools/verify/push.sh runs this automatically
   because it exists at <site>/tools/journeytest.js.

   The shared suites know nothing about one site's own screens. This asserts the
   things that would let a wrong table name or a stray ecommerce call reach a
   live demo:

     - every table the portal writes is a fintech_ table
     - the portal makes NO ec:* call, ever
     - stock_count is never sent from a finance site
     - the six-column spine is on every row, and the site never writes the
       three columns the SDK owns

   Run directly:  node fintech/tools/journeytest.js
   ========================================================================== */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');

/* Serves the repository itself on a free port. push.sh runs this suite without
   starting a server, and the shared suites each assume one is already up, so a
   suite that depends on an external server fails the push with
   ERR_CONNECTION_REFUSED and looks like a broken site. Self-hosting removes the
   dependency entirely. BASE_URL still wins if you want to point it elsewhere. */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.svg': 'image/svg+xml',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(REPO, rel);
      if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end();
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const PAGES = ['app.html', 'money.html', 'cards.html', 'grow.html', 'products.html'];
const SPINE = ['event_type', 'event_source', 'page_path',
               'is_authenticated', 'customer_tier', 'app_version'];
const SDK_OWNED = ['session_id', 'dn_contact_key', 'dn_device_id'];

let fails = 0;
const ok = (c, l) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l); if (!c) fails++; };

(async () => {
  const own = process.env.BASE_URL ? null : await serve();
  const ROOT = process.env.BASE_URL || ('http://127.0.0.1:' + own.port);

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  await ctx.route('**/*', r => r.request().url().startsWith(ROOT)
    ? r.continue() : r.fulfill({ status: 200, body: '' }));
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('novapay_user', JSON.stringify(
        { firstName: 'Journey', lastName: 'Test', email: 'journey@example.com' }));
    } catch (e) {}
    window.__sent = [];
    window.dengage = function () {
      const a = [].slice.call(arguments);
      if (a[0] === 'getDeviceId' && typeof a[1] === 'function') { setTimeout(() => a[1]('t'), 0); return; }
      window.__sent.push(a);
    };
  });

  const rows = [];
  for (const rel of PAGES) {
    const p = await ctx.newPage();
    await p.goto(ROOT + '/fintech/' + rel, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    rows.push(...await p.evaluate(() => window.__sent || []));
    await p.close();
  }
  await browser.close();
  if (own) own.srv.close();

  const ec = rows.filter(r => typeof r[0] === 'string' && r[0].indexOf('ec:') === 0);
  ok(ec.length === 0, 'the portal makes no ec:* call' +
     (ec.length ? ' (' + ec.map(r => r[0]).join(', ') + ')' : ''));

  const devEvents = rows.filter(r => r[0] === 'sendDeviceEvent');
  ok(devEvents.length > 0, 'the portal writes device events at all (' + devEvents.length + ')');

  const tables = [...new Set(devEvents.map(r => r[1]))];
  const foreign = tables.filter(t => String(t).indexOf('fintech_') !== 0);
  ok(foreign.length === 0, 'every table written is a fintech_ table' +
     (foreign.length ? ' (foreign: ' + foreign.join(', ') + ')' : ' (' + tables.length + ')'));

  const payloads = devEvents.map(r => r[2] || {});
  const missingSpine = SPINE.filter(c => !payloads.every(p => c in p));
  ok(missingSpine.length === 0, 'every row carries the six spine columns' +
     (missingSpine.length ? ' (missing: ' + missingSpine.join(', ') + ')' : ''));

  const wroteSdkOwned = SDK_OWNED.filter(c => payloads.some(p => c in p));
  ok(wroteSdkOwned.length === 0, 'the site never writes the three columns the SDK owns' +
     (wroteSdkOwned.length ? ' (wrote: ' + wroteSdkOwned.join(', ') + ')' : ''));

  ok(payloads.filter(p => 'stock_count' in p).length === 0,
     'stock_count is never sent from a finance site');

  console.log('');
  if (fails) { console.log(fails + ' CHECK(S) FAILED'); process.exit(1); }
  console.log('the NovaPay portal writes only its own tables, with the full spine');
})().catch(e => { console.error(e); process.exit(1); });
