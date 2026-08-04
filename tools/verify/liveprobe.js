/* ============================================================================
   liveprobe: fire one maximal row into every NovaPay table, against the REAL
   Dengage account, so the schema can be checked in Data Space.

       node tools/verify/liveprobe.js                 # all tables
       node tools/verify/liveprobe.js --key=my-marker # a different contact key
       node tools/verify/liveprobe.js --dry-run       # print, send nothing

   WHY THIS EXISTS, AND WHAT IT DOES NOT PROVE

   Every other suite here runs offline with the SDK stubbed. They prove the
   site makes the right calls with the right payloads, and NOTHING about
   whether a row is stored.

   This one posts to event.dengage.com for real. It still does not prove
   storage: a 200 means the request is accepted, nothing more. So a green run
   here means "accepted", and the ONLY evidence a row landed is reading it in
   Data Space.

   THE ENVELOPE

   Matches the envelope sent by the account's SDK bundle (2.5.0):

     POST https://event.dengage.com/api/web/event
     { accountId, eventTable, key, eventDetails: { ...identity, ...payload } }

   where the SDK merges three identity fields into eventDetails on every event:
   session_id, dn_device_id and dn_contact_key. `key` is the device id in both
   the anonymous and the identified case.

   This probe supplies those three BY HAND, because it bypasses the SDK. The
   site must never do that, and appevents.js asserts it does not.

   MAXIMAL ROWS, ON PURPOSE

   Every column in fintech/EVENT-MODEL.md is populated here, including the ones
   a real event legitimately omits (a successful transfer has no
   failure_reason). The question this answers is "does the column exist and
   accept a value", which is a schema question, not a behaviour question.
   ========================================================================== */

const https = require('https');

const ACCOUNT_ID = '5eb58b77-f506-7303-2225-27172c028c21';
const HOST = 'event.dengage.com';
const PATH = '/api/web/event';

const args = process.argv.slice(2);
const arg = (n, d) => {
    const hit = args.find(a => a.startsWith('--' + n + '='));
    return hit ? hit.slice(n.length + 3) : d;
};
const DRY = args.includes('--dry-run');

/* A marker contact key, so the rows can be found and so they never touch a
   real contact. NEVER salil-demo: earlier probes used it and filled Salil's
   own contact with test devices. */
const CONTACT_KEY = arg('key', 'fintech-probe');
const DEVICE_ID = arg('device', 'probe-device-' + process.pid);
const SESSION_ID = 's-probe-' + Date.now().toString(36);

/* The six spine columns the SITE writes. */
const spine = eventType => ({
    event_type: eventType,
    event_source: 'web',
    page_path: 'https://salil-dengage.github.io/dengage-demos/fintech/app.html?ck=' + CONTACT_KEY,
    is_authenticated: true,
    customer_tier: 'premier',
    app_version: 'web-2.0.0-probe',
});

/* The three the SDK normally merges in. Supplied here only because this script
   bypasses the SDK. */
const identity = () => ({
    session_id: SESSION_ID,
    dn_device_id: DEVICE_ID,
    dn_contact_key: CONTACT_KEY,
});

const ROWS = [
    ['fintech_onboarding_events', {
        ...spine('kyc_submitted'),
        step: 'kyc_submitted', step_index: 7, status: 'completed', method: 'email',
        doc_type: 'passport', failure_reason: 'blurred_document',
        product_intent: 'NPY-CRD-METAL', referral_code: 'PROBE-REF',
        time_on_step_sec: 42,
    }],
    ['fintech_account_events', {
        ...spine('balance_viewed'),
        account_id: 'ACC-USD-01', account_type: 'current', currency: 'USD',
        balance: 2480.55, balance_band: '2000-9999', action: 'view',
        channel: 'web', device_name: 'Probe Chrome', is_new_device: true,
        failure_reason: 'wrong_password',
    }],
    ['fintech_transaction_events', {
        ...spine('transfer_sent'),
        transaction_id: 'TXN-PROBE-0001', transaction_type: 'transfer_out',
        amount: 120.50, currency: 'USD', amount_home_currency: 120.50,
        fee: 0.99, fx_rate: 0.92, currency_from: 'USD', currency_to: 'EUR',
        country_to: 'DE', merchant_name: 'Sam Whitfield',
        merchant_category: 'transfer', is_recurring: false,
        status: 'completed', failure_reason: 'insufficient_funds',
    }],
    ['fintech_card_events', {
        ...spine('card_frozen'),
        card_id: 'CRD-PROBE-01', card_type: 'physical', card_tier: 'metal',
        action: 'freeze', reason: 'fraud_suspected', limit_type: 'daily_spend',
        limit_amount: 500.00, delivery_status: 'delivered', days_since_order: 12,
    }],
    ['fintech_savings_events', {
        ...spine('pot_funded'),
        pot_id: 'POT-PROBE-01', pot_name: 'Japan 2027', goal_amount: 4000.00,
        current_amount: 1250.00, progress_pct: 31,
        target_date: '2027-06-01T00:00:00.000Z', funding_method: 'round_up',
        interest_rate: 4.85, is_shared: true,
    }],
    ['fintech_investment_events', {
        ...spine('investment_made'),
        instrument_id: 'NPY-INV-ROBO', instrument_name: 'Managed Portfolio',
        asset_class: 'managed_portfolio', risk_profile: 'balanced',
        amount: 500.00, currency: 'USD', order_type: 'market',
        is_recurring: false, holding_value: 1500.00, pnl_pct: -2.40,
    }],
    ['fintech_credit_events', {
        ...spine('loan_quote_requested'),
        product_id: 'NPY-CRE-LOAN', product_name: 'Personal Loan',
        credit_type: 'personal_loan', requested_amount: 8000.00,
        approved_amount: 8000.00, term_months: 36, apr: 6.90,
        monthly_repayment: 237.78, decision: 'quoted',
        decline_reason: 'affordability', credit_score: 688,
        credit_score_band: 'good', score_change: 12,
    }],
    ['fintech_product_events', {
        ...spine('application_submitted'),
        product_id: 'NPY-CRD-METAL', product_name: 'NovaPay Metal Card',
        product_family: 'cards', plan_tier: 'metal', monthly_fee: 16.99,
        headline_rate: 2.00, rate_type: 'cashback',
        application_id: 'APP-PROBE-0001', funnel_step: 'submitted',
        step_index: 7, products_in_application: 2,
        comparison_set: 'NPY-CRD-METAL,NPY-CRD-TRAVEL',
        abandon_step: 'details_entered',
    }],
    ['fintech_support_events', {
        ...spine('dispute_raised'),
        case_id: 'CASE-PROBE-0001', case_type: 'dispute', category: 'card',
        channel: 'in_app', transaction_id: 'TXN-PROBE-0001',
        disputed_amount: 120.50, resolution_status: 'open',
        time_to_resolution_hours: 18, satisfaction_score: 4,
    }],
    ['fintech_engagement_events', {
        ...spine('scenario_displayed'),
        scenario_slug: 'fintech_cta-image-popup',
        scenario_group: 'Default Scenarios', widget_name: 'CTA Image Popup',
        channel: 'onsite', page_type: 'app', interaction: 'displayed',
        reward: 'fee_free_month',
    }],
];

function post(table, details) {
    const body = JSON.stringify({
        accountId: ACCOUNT_ID,
        eventTable: table,
        key: DEVICE_ID,
        eventDetails: { ...identity(), ...details },
    });
    return new Promise(resolve => {
        const req = https.request({
            host: HOST, path: PATH, method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, res => {
            let out = '';
            res.on('data', c => out += c);
            res.on('end', () => resolve({ status: res.statusCode, body: out.slice(0, 120) }));
        });
        req.on('error', e => resolve({ status: 0, body: e.message }));
        req.write(body);
        req.end();
    });
}

(async () => {
    console.log('account   ' + ACCOUNT_ID);
    console.log('contact   ' + CONTACT_KEY + '   <- find the rows with this');
    console.log('device    ' + DEVICE_ID);
    console.log('session   ' + SESSION_ID);
    console.log('');

    let sent = 0, failed = 0;
    for (const [table, details] of ROWS) {
        const cols = Object.keys(details).length + 3;
        if (DRY) {
            console.log('DRY   ' + table.padEnd(30) + cols + ' columns');
            continue;
        }
        const r = await post(table, details);
        const okish = r.status === 200;
        if (okish) sent++; else failed++;
        console.log((okish ? 'sent  ' : 'FAIL  ') + table.padEnd(30) +
            cols + ' columns   HTTP ' + r.status +
            (r.body ? '  body: ' + r.body : '  body: (empty)'));
    }

    if (DRY) { console.log('\ndry run, nothing sent'); return; }

    console.log('\n' + sent + ' accepted, ' + failed + ' rejected');
    console.log('');
    console.log('ACCEPTED IS NOT STORED. A 200 means the request was accepted,');
    console.log('and the only evidence a row landed is reading it in Data Space:');
    console.log('');
    console.log('  filter dn_contact_key = ' + CONTACT_KEY);
    console.log('  or     key            = ' + DEVICE_ID);
    console.log('');
    console.log('Check every column, not just that a row exists, and confirm each');
    console.log('value against the table definition in Data Space.');
    process.exit(failed ? 1 : 0);
})();
