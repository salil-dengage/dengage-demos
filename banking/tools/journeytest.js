/* ============================================================================
   Meridian journey suite

   Drives the five public journeys and asserts they write the rows
   docs/TABLE-DESIGN.md says they should. The suites in tools/verify cover the
   things every site shares; this one covers what only this site has, so it
   lives here and adds no coupling to the other four demos.

       cd <repo> && python3 -m http.server 8101
       node banking/tools/journeytest.js

   What it is actually guarding:

     - the calculators fire ONE row per settled calculation, never per
       keystroke. Six input events while somebody types "320000" would write
       3, 32, 320, 3200, 32000, 320000 and describe typing rather than intent.
     - the application writes a step_completed PER STEP, which is the whole
       reason this site does not use the ecommerce funnel.
     - every page loads without a console error. The hero slideshow threw a
       TypeError every four seconds on each non-home page and nothing visible
       broke, so only this check caught it.
   ========================================================================== */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:8101/banking/';

const MOCK = () => {
  window.__sent = [];
  window.dengage = function () { window.__sent.push([...arguments]); };
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE.replace('/banking/', ''))
      ? r.continue() : r.fulfill({ status: 200, body: '' }));
  let problems = 0;

  async function open(path) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(MOCK);
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1800);
    return { p, errs };
  }
  const rows = p => p.evaluate(() => (window.__sent || [])
      .filter(c => c[0] === 'sendDeviceEvent').map(c => ({ table: c[1], type: c[2] && c[2].event_type })));
  function check(ok, label, extra) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
    if (!ok) problems++;
  }

  // calculators
  let { p, errs } = await open('calculators.html');
  await p.fill('#affIncome', '78000');
  await p.waitForTimeout(1400);
  let r = await rows(p);
  check(errs.length === 0, 'calculators.html loads clean', errs[0] || '');
  check(r.some(x => x.table === 'banking_tool_events' && x.type === 'mortgage_affordability_calculated'),
        'affordability writes banking_tool_events');
  const perKeystroke = r.filter(x => x.type === 'mortgage_affordability_calculated').length;
  check(perKeystroke <= 2, 'one row per settled calculation, not per keystroke', `rows=${perKeystroke}`);
  await p.close();

  // eligibility
  ({ p, errs } = await open('eligibility.html'));
  await p.fill('#eligAmount', '12000');
  await p.click('#eligibilitySubmit');
  await p.waitForTimeout(500);
  r = await rows(p);
  check(errs.length === 0, 'eligibility.html loads clean', errs[0] || '');
  check(r.some(x => x.type === 'eligibility_check_started'), 'fires eligibility_check_started');
  check(r.some(x => x.type === 'eligibility_check_completed'), 'fires eligibility_check_completed');
  await p.close();

  // appointments
  ({ p, errs } = await open('appointments.html'));
  await p.click('#appointmentSubmit');
  await p.waitForTimeout(400);
  r = await rows(p);
  check(errs.length === 0, 'appointments.html loads clean', errs[0] || '');
  check(r.some(x => x.table === 'banking_appointment_events' && x.type === 'appointment_booked'),
        'writes banking_appointment_events');
  await p.close();

  // compare
  ({ p, errs } = await open('compare.html?ids=MRD-MTG-FIX5,MRD-MTG-FIRST'));
  r = await rows(p);
  check(errs.length === 0, 'compare.html loads clean', errs[0] || '');
  check(r.filter(x => x.type === 'product_compared').length === 2, 'one product_compared row per product');
  check(await p.locator('.compare-table').count() === 1, 'comparison table renders');
  await p.close();

  // apply, all six steps
  ({ p, errs } = await open('apply.html?product=MRD-MTG-FIX5&application=APP-9999999'));
  // steps: 0 about_you, 1 income, 2 borrowing, 3 identity, 4 documents, 5 review
  for (let i = 0; i < 4; i++) { await p.click('[data-apply-next]'); await p.waitForTimeout(250); }
  await p.click('[data-apply-doc="Proof of income"]'); await p.waitForTimeout(250);
  await p.click('[data-apply-doc="Proof of address"]'); await p.waitForTimeout(250);
  await p.click('[data-apply-next]'); await p.waitForTimeout(300);   // documents -> review
  await p.click('[data-apply-next]'); await p.waitForTimeout(400);   // submit
  const decided = await p.locator('.calc-headline-value').count();
  r = await rows(p);
  check(errs.length === 0, 'apply.html loads clean', errs[0] || '');
  check(r.filter(x => x.type === 'step_completed').length >= 5, 'writes a step_completed per step');
  check(r.filter(x => x.type === 'document_uploaded').length === 2, 'writes document_uploaded per document');
  check(r.some(x => x.type === 'application_submitted'), 'writes application_submitted');
  check(r.some(x => x.type === 'decision_returned'), 'writes decision_returned');
  check(decided === 1, 'shows a decision screen at the end');
  const decision = r.find(x => x.type === 'decision_returned');
  check(!!decision, 'decision row present', JSON.stringify(decision || {}));
  await p.close();

  // ---------------------------------------------------------- the event panel
  /* Covered here rather than in tools/verify/modaltest.js, which describes the
     ecommerce panel: eight cards firing ec:addToCart and friends. This site's
     panel is ten cards, one per table in docs/TABLE-DESIGN.md, and makes no
     ec:* call at all. Six of its cards used to fire the ecommerce funnel and
     two wrote to banking_events, a table that no longer exists, so on a call
     it would have described a basket and then written rows nowhere. */
  ({ p, errs } = await open('index.html'));
  await p.evaluate(() => document.getElementById('event-modal-icon').click());
  await p.waitForTimeout(600);
  const cardCount = await p.locator('.event-card').count();
  const fired = await p.evaluate(async () => {
    const btns = [...document.querySelectorAll('.send-btn')];
    for (const b of btns) { b.click(); await new Promise(r => setTimeout(r, 60)); }
    return btns.length;
  });
  await p.waitForTimeout(400);
  const panelTables = await p.evaluate(() => [...new Set((window.__sent || [])
      .filter(c => c[0] === 'sendDeviceEvent').map(c => c[1]))].sort());
  const anyEc = await p.evaluate(() => (window.__sent || []).some(c => String(c[0]).startsWith('ec:')));
  const EXPECTED = [
    'banking_account_events', 'banking_application_events', 'banking_appointment_events',
    'banking_card_events', 'banking_engagement_events', 'banking_product_events',
    'banking_tool_events', 'banking_transaction_events', 'banking_wealth_events'
  ];
  check(errs.length === 0, 'event panel opens clean', errs[0] || '');
  check(cardCount === 10, 'ten cards, one per table', `cards=${cardCount}`);
  check(fired === 10, 'every card has a send button', `buttons=${fired}`);
  check(JSON.stringify(panelTables) === JSON.stringify(EXPECTED),
        'the nine banking_* tables are exactly what the panel writes',
        JSON.stringify(panelTables));
  check(!anyEc, 'the panel makes no ec:* call');
  await p.close();

  await b.close();
  console.log(problems ? `\n${problems} problem(s)` : '\nall five new pages behave');
  process.exit(problems ? 1 : 0);
})();
