/* ============================================================================
   Meridian rendered-copy sweep

       cd <repo> && python3 -m http.server 8101
       node banking/tools/copysweep.js

   tools/verify/ptsweep.js covers the home and product pages only. This site
   now has thirteen, and the eleven it added were unswept, which is how
   "Campanha Frotista" and "Pos-venda & Craft" survived on a UK bank.

   Walks the RENDERED text of every page, signed out and signed in, and fails
   on Portuguese, Cyrillic, tyre-trade wording or the other finance brand.
   Rendered, not source: a comment explaining the CantuPneus campaigns is
   fine, the same word on screen is not.
   ========================================================================== */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:8101/banking/';
const USER = { firstName: 'Eleanor', lastName: 'Whitfield', email: 'eleanor@example.co.uk', tier: 'premier' };

const FORBID = [
  [/\bCantuPneus\b/i, 'tyre brand'], [/\bpneus?\b/i, 'Portuguese'],
  [/\btyres?\b/i, 'tyre trade'], [/\btires\b/i, 'tyre trade'],
  [/\bfrota\b/i, 'Portuguese'], [/\bfrete\b/i, 'Portuguese'],
  [/\bcarreteiro\b/i, 'Portuguese'], [/\bfrotista\b/i, 'Portuguese'],
  [/p[oó]s-venda/i, 'Portuguese'], [/\bbrinde\b/i, 'Portuguese'],
  [/\bsurpresa\b/i, 'Portuguese'], [/\btabela\b/i, 'Portuguese'],
  [/\bantecipada\b/i, 'Portuguese'], [/\bpontos\b/i, 'Portuguese'],
  [/\bcarrinho\b/i, 'Portuguese'], [/\bcomprar\b/i, 'Portuguese'],
  [/\badicionar\b/i, 'Portuguese'], [/\bexibir\b/i, 'Portuguese'],
  [/\bcen[aá]rios?\b/i, 'Portuguese'], [/\bsenha\b/i, 'Portuguese'],
  [/[Ѐ-ӿ]{2,}/, 'Cyrillic'], [/\bNovaPay\b/i, 'other finance brand'],
];

const PAGES = [
  ['index.html', false], ['product.html?id=MRD-MTG-FIX5', false],
  ['calculators.html', false], ['eligibility.html', false],
  ['appointments.html', false], ['compare.html?ids=MRD-MTG-FIX5,MRD-MTG-FIRST', false],
  ['apply.html?product=MRD-MTG-FIX5', false],
  ['dashboard.html', true], ['account.html?id=4471', true], ['cards.html', true],
  ['payments.html', true], ['wealth.html', true], ['profile.html', true],
];

let problems = 0;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost:8101')
      ? r.continue() : r.fulfill({ status: 200, body: '' }));

  for (const [path, signedIn] of PAGES) {
    const p = await ctx.newPage();
    await p.addInitScript(u => {
      window.dengage = function () {};
      if (u) localStorage.setItem('meridian_user', JSON.stringify(u));
      else localStorage.removeItem('meridian_user');
    }, signedIn ? USER : null);
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1800);

    /* Open the scenario launcher too: its chrome is copy nobody proofreads,
       and 'Exibir' sat untranslated on three sites for exactly that reason. */
    await p.evaluate(() => {
      const l = document.querySelector('[id*=sticky-icon]');
      if (l) l.click();
    }).catch(() => {});
    await p.waitForTimeout(600);

    const text = await p.evaluate(() => document.body.innerText || '');
    const hits = [];
    for (const [re, label] of FORBID) {
      const m = text.match(re);
      if (m) hits.push(label + ' "' + m[0] + '"');
    }
    console.log(`  ${hits.length ? 'FAIL' : 'PASS'}  ${path}${hits.length ? '   ' + hits.join(', ') : ''}`);
    if (hits.length) problems++;
    await p.close();
  }

  await b.close();
  console.log(problems ? `\n${problems} page(s) with foreign or off-brand copy` : '\nall 13 pages read as an English UK bank');
  process.exit(problems ? 1 : 0);
})();
