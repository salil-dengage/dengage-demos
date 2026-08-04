/* ============================================================================
   Meridian online banking portal suite

       cd <repo> && python3 -m http.server 8101
       node banking/tools/portaltest.js

   Drives all six signed-in pages and asserts the rows they write into the
   four tables the public site cannot reach: banking_account_events,
   banking_transaction_events, banking_card_events and banking_wealth_events,
   plus consent in banking_engagement_events.

   What it is really guarding:

     - a signed-OUT visitor writes NOTHING. Anonymous is anonymous, and a
       portal that reports balances for somebody who is not signed in would
       be the worst possible bug on a banking demo.
     - travel dates leave as YYYY-MM-DD HH:mm, the format the DATETIME
       columns store.
     - portfolio value is banded, never exact.
     - no ec:* call anywhere, and every table written is a banking_ one.
   ========================================================================== */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:8101/banking/';
const USER = { firstName: 'Eleanor', lastName: 'Whitfield', email: 'eleanor@example.co.uk' };
let problems = 0;
function check(ok, label, extra) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) problems++;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost:8101')
      ? r.continue() : r.fulfill({ status: 200, body: '' }));

  async function open(path, signedIn = true) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(u => {
      window.__sent = []; window.dengage = function(){ window.__sent.push([...arguments]); };
      if (u) localStorage.setItem('meridian_user', JSON.stringify(u));
      else localStorage.removeItem('meridian_user');
      sessionStorage.clear();
    }, signedIn ? USER : null);
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    return { p, errs };
  }
  const rows = p => p.evaluate(() => (window.__sent || [])
      .filter(c => c[0] === 'sendDeviceEvent').map(c => ({ t: c[1], e: c[2] && c[2].event_type, p: c[2] })));

  // gate
  let { p, errs } = await open('dashboard.html', false);
  check((await p.locator('.portal-gate').count()) === 1, 'signed-out visitor gets the sign-in gate');
  check((await rows(p)).length === 0, 'signed-out visitor writes no rows');
  await p.close();

  // dashboard
  ({ p, errs } = await open('dashboard.html'));
  let r = await rows(p);
  check(errs.length === 0, 'dashboard loads clean', errs[0] || '');
  check((await p.locator('.pa-card').count()) === 4, 'four account cards render');
  check(r.filter(x => x.e === 'balance_viewed').length === 4, 'one balance_viewed per account');
  check(r.some(x => x.e === 'low_balance_reached'), 'detects the low balance');
  check(r.some(x => x.e === 'salary_credited'), 'detects the salary credit');
  check(r.some(x => x.t === 'banking_transaction_events' && x.e === 'foreign_transaction'), 'detects the foreign transaction');
  check(r.some(x => x.e === 'large_transaction'), 'detects the large transaction');
  check(r.some(x => x.e === 'savings_goal_reached'), 'detects the met savings goal');
  /* Ten portal scenarios are triggered by dataLayer events, not by page
     targeting. A trigger that never fires is a campaign that is silently
     dark. */
  const trig = await p.evaluate(() => (window.dataLayer || [])
      .map(x => x.event).filter(e => /^banking_portal_/.test(e)));
  check(trig.includes('banking_portal_low_balance'), 'pushes the low balance trigger');
  check(trig.includes('banking_portal_goal_reached'), 'pushes the goal reached trigger');
  check(trig.includes('banking_portal_foreign_spend'), 'pushes the foreign spend trigger');
  check(r.filter(x => x.e === 'offer_viewed').length === 3, 'three offers viewed');
  check(r.every(x => x.p.customer_tier === 'premier'), 'every row carries customer_tier premier');
  await p.click('[data-offer-dismiss]'); await p.waitForTimeout(200);
  check((await rows(p)).some(x => x.e === 'offer_dismissed'), 'dismissing an offer writes a row');
  await p.close();

  // account
  ({ p, errs } = await open('account.html?id=4471'));
  r = await rows(p);
  check(errs.length === 0, 'account page loads clean', errs[0] || '');
  await p.click('[data-statement]'); await p.waitForTimeout(200);
  check((await rows(p)).some(x => x.e === 'statement_viewed'), 'statement download writes a row');
  await p.close();

  // cards
  ({ p, errs } = await open('cards.html'));
  await p.click('[data-card-freeze]'); await p.waitForTimeout(200);
  await p.click('[data-travel-set]'); await p.waitForTimeout(300);
  r = await rows(p);
  check(errs.length === 0, 'cards page loads clean', errs[0] || '');
  check(r.some(x => x.e === 'card_frozen'), 'freezing a card writes a row');
  const tn = r.find(x => x.e === 'travel_notice_set');
  check(!!tn, 'travel notice writes a row');
  check(!!(tn && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(tn.p.travel_start_date)),
        'travel dates use YYYY-MM-DD HH:mm', tn && tn.p.travel_start_date);
  await p.close();

  // payments
  ({ p, errs } = await open('payments.html'));
  await p.click('[data-pay-send]'); await p.waitForTimeout(200);
  await p.click('[data-dd-cancel]'); await p.waitForTimeout(200);
  r = await rows(p);
  check(errs.length === 0, 'payments page loads clean', errs[0] || '');
  check(r.some(x => x.e === 'payment_made'), 'a payment writes a row');
  check(r.some(x => x.e === 'direct_debit_cancelled'), 'cancelling a direct debit writes a row');
  await p.close();

  // wealth
  ({ p, errs } = await open('wealth.html'));
  await p.click('[data-holding]'); await p.waitForTimeout(150);
  await p.click('[data-wealth-contribute]'); await p.waitForTimeout(150);
  r = await rows(p);
  check(errs.length === 0, 'wealth page loads clean', errs[0] || '');
  check(r.some(x => x.e === 'portfolio_viewed'), 'portfolio view writes a row');
  check(r.some(x => x.e === 'holding_viewed'), 'holding view writes a row');
  check(r.some(x => x.e === 'contribution_made'), 'contribution writes a row');
  check(r.every(x => x.p.portfolio_value_band === undefined || /_/.test(x.p.portfolio_value_band)),
        'portfolio value is banded, never exact');
  await p.close();

  // profile
  ({ p, errs } = await open('profile.html'));
  // the input is visually hidden behind the switch, which is the correct
  // markup: a user clicks the switch, so the test does too
  await p.click('.pp-row:has([data-consent="sms"]) .pp-switch span'); await p.waitForTimeout(200);
  await p.click('.pp-row:has([data-consent="profiling"]) .pp-switch span'); await p.waitForTimeout(200);
  await p.click('[data-support="complaint"]'); await p.waitForTimeout(200);
  r = await rows(p);
  check(errs.length === 0, 'profile page loads clean', errs[0] || '');
  check(r.filter(x => x.e === 'preference_updated').length === 2, 'each preference change writes a row');
  check(r.some(x => x.e === 'consent_withdrawn'), 'withdrawing profiling consent writes a row');
  check(r.some(x => x.e === 'complaint_raised'), 'a complaint writes a row');
  await p.close();

  // no ecommerce anywhere
  ({ p, errs } = await open('dashboard.html'));
  const anyEc = await p.evaluate(() => (window.__sent||[]).some(c => String(c[0]).startsWith('ec:')));
  check(!anyEc, 'the portal makes no ec:* call');
  const tables = await p.evaluate(() => [...new Set((window.__sent||[])
      .filter(c => c[0]==='sendDeviceEvent').map(c => c[1]))]);
  check(tables.every(t => t.startsWith('banking_')), 'every table written is a banking_ table', tables.join(','));
  await p.close();

  await b.close();
  console.log(problems ? `\n${problems} problem(s)` : '\nthe portal behaves');
  process.exit(problems ? 1 : 0);
})();
