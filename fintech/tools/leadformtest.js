/* ============================================================================
   NovaPay's "Open account" hand-off. tools/verify/push.sh runs this
   automatically because it exists at <site>/tools/*test.js.

   The hero CTA does not navigate. It asks the on-site engine for the lead form
   and, only if no campaign answers, opens the site's own account form instead.
   That hand-off is a race between a network round trip and a timer, and both
   ways of losing it are visible to a prospect:

     - the campaign answers LATE, so the site's form is already open when the
       campaign popup lands on top of it. Two account forms, one of them the
       one we are there to demonstrate.
     - a banner from an UNRELATED campaign is already on the page, is mistaken
       for the lead form, and suppresses the fallback. The hero CTA then does
       nothing at all.

   Neither is visible in a diff and neither fails a shared suite, so they are
   asserted here. The engine is simulated by mounting a node that matches the
   selectors js/novapayLanding.js watches for; nothing here needs a campaign,
   a network or the panel.

   Run directly:  node fintech/tools/leadformtest.js
   ========================================================================== */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');

/* Self-hosting, for the same reason journeytest.js does it: push.sh runs the
   site suites after run.sh has taken its own server down again, so a suite
   that assumes an external server fails with ERR_CONNECTION_REFUSED and reads
   as a broken site. BASE_URL still wins. */
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

/* Mirrors js/novapayLanding.js. Kept in step by the first assertion, which
   fails loudly if the fallback stops opening on this schedule. */
const FALLBACK_AFTER_MS = 1400;
const SETTLE_MS = 400;

const FORM = '#loginModal.active';

let fails = 0;
const ok = (c, l) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l); if (!c) fails++; };

/* Mounts something the engine would mount. A popup id and a banner id are two
   different formats and js/novapayLanding.js has to recognise both. */
const mountEngine = (page, kind) => page.evaluate(k => {
  const el = document.createElement('div');
  if (k === 'banner') el.id = '_dn_onsite-banner';
  else el.id = '_dn_onsite_popup-' + Date.now();
  el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(el);
}, kind);

(async () => {
  const own = process.env.BASE_URL ? null : await serve();
  const ROOT = process.env.BASE_URL || ('http://127.0.0.1:' + own.port);
  const browser = await chromium.launch({ executablePath: CHROME });

  const open = async () => {
    const page = await browser.newPage();
    await page.goto(ROOT + '/fintech/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    return page;
  };
  const forms = page => page.locator(FORM).count();

  try {
    /* --------------------------------------------- 1. no campaign answers */
    {
      const page = await open();
      await page.locator('[data-open-account]').first().click();
      await page.waitForTimeout(FALLBACK_AFTER_MS + SETTLE_MS);
      ok(await forms(page) === 1,
        'campaign dark: the site form opens rather than nothing happening');
      await page.close();
    }

    /* ------------------------------------- 2. the campaign answers in time */
    {
      const page = await open();
      await page.locator('[data-open-account]').first().click();
      await page.waitForTimeout(300);
      await mountEngine(page, 'popup');
      await page.waitForTimeout(FALLBACK_AFTER_MS + SETTLE_MS);
      ok(await forms(page) === 0,
        'campaign in time: the site form never opens, the campaign owns the click');
      await page.close();
    }

    /* ---------------------------------------------- 3. THE REPORTED DEFECT
       The campaign answers after the fallback has already opened. Before the
       watch was added this left both forms on screen at once. */
    {
      const page = await open();
      await page.locator('[data-open-account]').first().click();
      await page.waitForTimeout(FALLBACK_AFTER_MS + SETTLE_MS);
      ok(await forms(page) === 1, 'campaign late: the site form opened first, as designed');
      await mountEngine(page, 'popup');
      await page.waitForTimeout(SETTLE_MS);
      ok(await forms(page) === 0,
        'campaign late: the site form is withdrawn, so the prospect never sees two');
      await page.close();
    }

    /* ------------------------------------- 4. late, but the visitor typed
       Withdrawing a form somebody is filling in loses their work, which is
       worse than the duplicate it would prevent. */
    {
      const page = await open();
      await page.locator('[data-open-account]').first().click();
      await page.waitForTimeout(FALLBACK_AFTER_MS + SETTLE_MS);
      await page.fill('#loginFirstName', 'Alex');
      await mountEngine(page, 'popup');
      await page.waitForTimeout(SETTLE_MS);
      ok(await forms(page) === 1,
        'campaign late but the visitor is typing: their form is left alone');
      ok(await page.inputValue('#loginFirstName') === 'Alex',
        'and what they typed survives');
      await page.close();
    }

    /* ------------------------- 5. an unrelated banner is not the lead form
       The watched selector matches a sticky bar too. One that was already on
       the page at click time used to read as "the campaign answered", which
       suppressed the fallback and left the hero CTA doing nothing. */
    {
      const page = await open();
      await mountEngine(page, 'banner');
      await page.locator('[data-open-account]').first().click();
      await page.waitForTimeout(FALLBACK_AFTER_MS + SETTLE_MS);
      ok(await forms(page) === 1,
        'a banner already on the page does not stand in for the lead form');
      await page.close();
    }

    /* ------------------------------------ 6. the click still reports itself
       The hand-off must not cost the funnel its first row, whichever form the
       visitor ends up seeing. */
    {
      const page = await open();
      await page.evaluate(() => { window.dataLayer = []; });
      await page.locator('[data-open-account]').first().click();
      await page.waitForTimeout(SETTLE_MS);
      const intent = await page.evaluate(() => (window.dataLayer || [])
        .find(e => e && e.event === 'fintech_open_account_intent'));
      ok(!!intent, 'the click still pushes fintech_open_account_intent');
      ok(!!intent && intent.cta_location === 'header',
        'and carries where on the page it came from (' + (intent && intent.cta_location) + ')');
      await page.close();
    }
  } finally {
    await browser.close();
    if (own) own.srv.close();
  }

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nthe account form hand-off holds');
  process.exit(fails ? 1 : 0);
})();
