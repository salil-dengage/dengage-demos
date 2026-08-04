// ============================================================================
// persotest: the personalized panel content in cantu-pneus/panel-content/personalized/
//
//   node tools/verify/persotest.js
//
// These files carry Dengage Advanced Personalization tokens, which the platform
// substitutes per contact before the content reaches the browser.
//
// They are DIRECT OUTPUT ONLY: every value is a single {%=$Contact.field%} token.
// No {% %} logic blocks, no fallbacks. Two reasons, both learned the hard way:
//
//   1. The panel does not evaluate tokens in its Preview, so a multi-line logic
//      block renders as a wall of visible text in the editor. A first draft did
//      exactly that and it looked broken to the person building the campaign.
//   2. Both demo contacts already carry every attribute, so branching on absence
//      buys nothing and only adds ways to fail.
//
// What this checks, per file:
//   no logic blocks    only {%= ... %} output is allowed anywhere in the file,
//                      including inside HTML comments, because the engine
//                      evaluates the whole document
//   known attributes   every token names an attribute documented in
//                      personalized/README.md, so a typo cannot ship
//   substitutes clean  with each demo contact's values filled in, no token
//                      survives and nothing reads "undefined" or "MISSING"
//   real values        the contact's own values actually appear in the output
//   renders            real height, images resolve, nothing overflows the root
//   click contract     exactly one Dn.sendClick, and the close calls Dn.close()
// ============================================================================
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const DIR = path.join(REPO, 'cantu-pneus/panel-content/personalized');
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ----------------------------------------------------------- token handling
const OUTPUT = /\{%=\s*\$Contact\.([A-Za-z0-9_]+)\s*%\}/g;
// any {% that is not the start of an output token is a logic block
const LOGIC = /\{%(?!=)/;

// every attribute documented in personalized/README.md
const KNOWN = new Set([
  'contact_key',
  'first_name', 'company_name', 'pricing_tier', 'discount_pct',
  'account_manager_name', 'account_manager_phone', 'credit_terms_days',
  'last_order_name', 'last_order_sku', 'last_order_date',
  'fleet_size', 'main_line', 'usual_size', 'reorder_due_days',
  'promo_code', 'promo_discount_pct', 'next_delivery_date', 'preferred_branch',
]);

function substitute(html, contact) {
  return html.replace(OUTPUT, (_, field) =>
    contact[field] === undefined ? '((MISSING:' + field + '))' : String(contact[field]));
}

// ------------------------------------------------------------------ contacts
// Both demo contacts carry every attribute, which is the stated setup.
const CONTACTS = {
  'salil-demo': {
    contact_key: 'salil-demo',
    first_name: 'Salil', company_name: 'Transportadora Andrade',
    pricing_tier: 'Gold', discount_pct: 18, credit_terms_days: 30,
    account_manager_name: 'Marina Alves', account_manager_phone: '+55 47 3348 1200',
    last_order_name: 'Marshal KLD01 295/80 R22.5',
    last_order_sku: 'CNT-CRG-29580-KLD01', last_order_date: '2026-06-18',
    fleet_size: 42, main_line: 'Truck', usual_size: '295/80 R22.5',
    reorder_due_days: 24, promo_code: 'ANDRADE18', promo_discount_pct: 18,
    next_delivery_date: '2026-08-11', preferred_branch: 'Itajai SC',
  },
  'stacy-demo': {
    contact_key: 'stacy-demo',
    first_name: 'Stacy', company_name: 'Frota Litoral',
    pricing_tier: 'Silver', discount_pct: 9, credit_terms_days: 14,
    account_manager_name: 'Rafael Souza', account_manager_phone: '+55 41 3232 8800',
    last_order_name: 'Ecosport ECS 195/65 R15',
    last_order_sku: 'CNT-PAS-19565-ECS', last_order_date: '2026-07-02',
    fleet_size: 12, main_line: 'Passenger', usual_size: '195/65 R15',
    reorder_due_days: 5, promo_code: 'LITORAL09', promo_discount_pct: 9,
    next_delivery_date: '2026-08-05', preferred_branch: 'Curitiba PR',
  },
};

(async () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html')).sort();
  if (!files.length) { console.log('no personalized files found'); process.exit(1); }

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/dengage-demos/**', route => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/dengage-demos\//, '');
    const file = path.join(REPO, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const type = { jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' }
      [path.extname(file).slice(1)] || 'application/octet-stream';
    route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
  });

  const problems = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
    console.log(`\n--- ${f} ---`);
    const bad = [];

    // 1. no logic blocks, anywhere
    if (LOGIC.test(raw)) {
      const at = raw.search(LOGIC);
      bad.push('contains a {% logic block at offset ' + at
        + ', only {%= output is allowed: ' + JSON.stringify(raw.slice(at, at + 60)));
    }

    // 2. every token names a documented attribute
    const fields = [...raw.matchAll(OUTPUT)].map(m => m[1]);
    if (!fields.length) bad.push('no personalization tokens at all');
    for (const field of new Set(fields)) {
      if (!KNOWN.has(field)) bad.push(`token $Contact.${field} is not a documented attribute`);
    }

    // 3. click contract, same rules as the rest of the panel content
    const clicks = [...raw.matchAll(/Dn\.sendClick\('([^']+)'\)/g)].map(m => m[1]);
    if (clicks.length !== 1) bad.push(`expected 1 Dn.sendClick, found ${clicks.length}`);
    if (!/onclick="Dn\.close\(\)"/.test(raw)) bad.push('no close control calling Dn.close()');
    if (/[–—]/.test(raw)) bad.push('contains an em or en dash');

    bad.forEach(b => problems.push(`${f}: ${b}`));
    console.log(`  ${bad.length ? 'FAIL' : 'PASS'}  direct-output contract`
      + `  (${new Set(fields).size} attribute(s), click=${clicks[0] || 'none'})`);
    bad.forEach(b => console.log('        - ' + b));

    // 4. substitute each contact and render
    for (const [key, contact] of Object.entries(CONTACTS)) {
      const out = substitute(raw, contact);
      const rbad = [];
      if (OUTPUT.test(out)) rbad.push('a token survived substitution');
      if (out.includes('((MISSING:')) {
        rbad.push('references an attribute the demo contact does not have: '
          + (out.match(/\(\(MISSING:[a-z_]+\)\)/g) || []).join(', '));
      }
      const visible = out.replace(/<style[\s\S]*?<\/style>/g, '')
                         .replace(/<!--[\s\S]*?-->/g, '')
                         .replace(/<[^>]+>/g, ' ');
      for (const w of ['undefined', 'null', 'NaN']) {
        if (new RegExp('\\b' + w + '\\b').test(visible)) rbad.push(`renders "${w}" as visible text`);
      }
      // the contact's own values must actually be on screen
      for (const probe of [contact.first_name, String(contact.reorder_due_days)]) {
        if (raw.includes('$Contact.first_name') && probe === contact.first_name
            && !visible.includes(probe)) rbad.push(`first_name "${probe}" missing from output`);
      }

      const p = await ctx.newPage();
      await p.setContent(out, { waitUntil: 'load' });
      await p.waitForTimeout(300);
      const view = await p.evaluate(() => {
        const root = document.querySelector('body > div[id^="cantu"]');
        if (!root) return { err: 'no scoped root element under body' };
        const rb = root.getBoundingClientRect();
        return {
          h: Math.round(rb.height),
          broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.src),
          overflow: [...root.querySelectorAll('*')].filter(e => {
            const b = e.getBoundingClientRect();
            return b.width > 0 && (b.right > rb.right + 2 || b.left < rb.left - 2);
          }).length,
        };
      });
      await p.close();
      if (view.err) rbad.push(view.err);
      else {
        if (view.h < 120) rbad.push(`rendered only ${view.h}px tall`);
        view.broken.forEach(s => rbad.push('broken image ' + s));
        if (view.overflow) rbad.push(`${view.overflow} element(s) overflow the root`);
      }

      rbad.forEach(b => problems.push(`${f} [${key}]: ${b}`));
      console.log(`  ${rbad.length ? 'FAIL' : 'PASS'}  as ${key.padEnd(12)}`
        + (view.h ? ` ${view.h}px` : ''));
      rbad.forEach(b => console.log('        - ' + b));
    }
  }

  await browser.close();
  console.log(problems.length
    ? `\n${problems.length} problem(s)`
    : '\nboth personalized popups are direct-output only and render for both contacts');
  process.exit(problems.length ? 1 : 0);
})();
