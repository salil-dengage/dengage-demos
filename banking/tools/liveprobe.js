/* ============================================================================
   Live delivery probe for the Meridian banking tables

       node banking/tools/liveprobe.js

   WHY THIS EXISTS

   The offline suites stub the SDK. They prove the site makes the right calls
   with the right payloads and NOTHING about delivery. HTTP 200 from
   /api/web/event means accepted; the row in Data Space is the only proof of
   storage.

   So this fires one real row into each of the nine banking_* tables against
   the real account, with a marker contact key, and then a human confirms the
   rows in Data Space. Until that confirmation happens the site is NOT
   verified, and nothing here should claim otherwise.

   WHAT THIS CANNOT PROVE

   Identity. The device id and contact key below are invented, so they have no
   row in master_device or master_contact and nothing joins to them. Segments
   built on these rows return zero contacts, correctly, because the rows are
   orphans. Only a real browser running the real SDK produces a device that
   master_device knows. See docs/TABLE-DESIGN.md, "A curl probe proves storage,
   NOT identity".

   WHY IT IS CURL AND NOT A BROWSER

   Chromium in this environment has no outbound access, re-tested rather than
   assumed. So the envelope is built by hand here instead of by the SDK, which
   makes getting the envelope exactly right the whole job.

   THE ENVELOPE:

     POST https://event.dengage.com/api/web/event
     { accountId, eventTable, key, eventDetails: { session_id, dn_device_id,
       dn_contact_key, ...columns } }

   accountId is the GUID below, not 28: 28 is only the path segment in the
   SDK loader URL.

   DATE AND DATETIME FORMATS. From the Data Space reference, "Data Types":
   DATE is YYYY-MM-DD and DATETIME is YYYY-MM-DD HH:mm. Space separator, no
   seconds, no T, no Z, no offset.

   `key` is the DEVICE id, not the contact key: see
   docs/DENGAGE-INTEGRATION.md. The contact key rides in eventDetails as
   dn_contact_key, empty for an anonymous visitor.
   ========================================================================== */
'use strict';

const https = require('https');

const ENDPOINT   = 'https://event.dengage.com/api/web/event';
const ACCOUNT_ID = '5eb58b77-f506-7303-2225-27172c028c21';

/* Marker identity. NEVER salil-demo: earlier probes used it and filled Salil's
   own contact with test devices. These two strings are what to search for in
   Data Space. */
const CONTACT_KEY = 'v11-banking-probe';
const DEVICE_ID   = 'v11-banking-probe-device';
const SESSION_ID  = 'v11-banking-probe-session';

/* Stamped into page_path on every row so one filter finds the whole probe. */
const MARKER = '/probe/v11-banking';

const COMMON = {
    event_source: 'web',
    page_path: MARKER,
    is_authenticated: true,
    customer_tier: 'premier'
};

const ROWS = [
    ['banking_product_events', {
        event_type: 'product_shortlisted',
        product_id: 'MRD-MTG-FIX5', product_name: 'Five Year Fixed Rate Mortgage',
        product_category: 'mortgage', product_subtype: 'residential',
        headline_rate: 4.09, rate_type: 'fixed', term_months: 60,
        fee_amount: 1499, fee_frequency: 'one_off', min_deposit_pct: 25
    }],
    ['banking_tool_events', {
        event_type: 'mortgage_affordability_calculated',
        tool_name: 'mortgage_affordability', product_category: 'mortgage',
        input_amount: 420000, input_deposit: 42000, input_income_annual: 78000,
        input_outgoings_monthly: 1450, result_max_borrow: 351000,
        loan_to_value_pct: 90, completed: true
    }],
    ['banking_application_events', {
        event_type: 'step_abandoned',
        application_id: 'APP-PROBE-11', product_id: 'MRD-MTG-FIX5',
        product_category: 'mortgage', step_name: 'identity_verification',
        step_index: 4, total_steps: 6, time_on_step_seconds: 184,
        abandoned_at_step: 'identity_verification', documents_outstanding: 2
    }],
    ['banking_appointment_events', {
        event_type: 'appointment_booked',
        appointment_id: 'APT-PROBE-11', appointment_type: 'mortgage_advice',
        appointment_channel: 'video', branch_name: 'Leeds City',
        branch_city: 'Leeds', adviser_name: 'J. Okafor',
        scheduled_at: '2026-08-14 10:30', lead_time_hours: 72,
        product_category: 'mortgage'
    }],
    ['banking_account_events', {
        event_type: 'overdraft_entered',
        account_id_masked: '****4471', account_type: 'current_account',
        balance_amount: -182.40, balance_band: 'overdrawn',
        currency: 'GBP', overdraft_limit: 500, overdraft_used: 182.40
    }],
    ['banking_transaction_events', {
        event_type: 'foreign_transaction',
        transaction_id: 'TXN-PROBE-11', account_id_masked: '****4471',
        amount: 84.20, currency: 'GBP', direction: 'debit',
        merchant_name: 'SNCF Connect', merchant_category: 'travel', mcc: '4112',
        country_code: 'FR', is_foreign: true, payment_channel: 'mobile_wallet'
    }],
    ['banking_card_events', {
        event_type: 'travel_notice_set',
        card_id_masked: '****8820', card_type: 'credit',
        card_product: 'Meridian Platinum Card', travel_country: 'ES',
        travel_start_date: '2026-08-20 00:00',
        travel_end_date: '2026-09-03 00:00'
    }],
    ['banking_wealth_events', {
        event_type: 'portfolio_viewed',
        portfolio_id: 'PF-PROBE-11', portfolio_value_band: '250k_500k',
        risk_profile: 'balanced', adviser_name: 'R. Mehta',
        performance_band: 'up_5_10'
    }],
    ['banking_engagement_events', {
        event_type: 'preference_updated',
        consent_email: true, consent_sms: false,
        consent_push: true, consent_profiling: true
    }]
];


/* ---------------------------------------------------------------- full mode

   node banking/tools/liveprobe.js --full

   The first pass sends a representative subset per table, so a blank column
   in Data Space might simply be a column the probe never sent.

   Full mode sends EVERY column declared in docs/TABLE-DESIGN.md, with a
   type-appropriate value in each. After it runs, any column still empty is a
   mismatch between this repo and the panel, and names the exact field to
   fix. Marker key differs so the two passes can be told apart.
   ------------------------------------------------------------------------ */
const FULL_ROWS = [
    ['banking_product_events', {
        event_type: 'product_compared',
        product_id: 'MRD-MTG-FIX5', product_name: 'Five Year Fixed Rate Mortgage',
        product_category: 'mortgage', product_subtype: 'residential',
        headline_rate: 4.09, rate_type: 'fixed', term_months: 60,
        fee_amount: 1499, fee_frequency: 'one_off', min_deposit_pct: 25,
        compared_with: 'MRD-MTG-FIRST,MRD-MTG-BTL',
        list_name: 'Mortgages', position_in_list: 3
    }],
    ['banking_tool_events', {
        event_type: 'mortgage_affordability_calculated',
        tool_name: 'mortgage_affordability', product_category: 'mortgage',
        product_id: 'MRD-MTG-FIX5',
        input_amount: 420000, input_deposit: 42000, input_term_months: 300,
        input_income_annual: 78000, input_outgoings_monthly: 1450, input_rate: 4.09,
        result_monthly_payment: 1812.44, result_total_repayable: 543732,
        result_max_borrow: 351000, result_projected_value: 24380,
        loan_to_value_pct: 90, eligibility_outcome: 'likely',
        eligibility_score_band: 'good', completed: true
    }],
    ['banking_application_events', {
        event_type: 'decision_returned',
        application_id: 'APP-PROBE-FULL', product_id: 'MRD-MTG-FIX5',
        product_category: 'mortgage', step_name: 'review', step_index: 6,
        total_steps: 6, time_on_step_seconds: 96, requested_amount: 378000,
        requested_term_months: 300, decision: 'referred',
        decline_reason_code: 'AFFORDABILITY', documents_outstanding: 1,
        channel_started: 'web', channel_completed: 'android',
        abandoned_at_step: 'income_and_employment'
    }],
    ['banking_appointment_events', {
        event_type: 'appointment_rescheduled',
        appointment_id: 'APT-PROBE-FULL', appointment_type: 'wealth_review',
        appointment_channel: 'branch', branch_name: 'Edinburgh George Street',
        branch_city: 'Edinburgh', adviser_name: 'S. Caldwell',
        scheduled_at: '2026-09-02 14:00', lead_time_hours: 168,
        product_category: 'wealth'
    }],
    ['banking_account_events', {
        event_type: 'savings_goal_reached',
        account_id_masked: '****9920', account_type: 'savings',
        balance_amount: 20450.75, balance_band: '20k_50k',
        available_balance: 20450.75, currency: 'GBP',
        overdraft_limit: 0, overdraft_used: 0, days_since_last_login: 19,
        goal_name: 'Deposit', goal_target_amount: 20000,
        goal_progress_pct: 102.3, support_topic: 'savings_maturity'
    }],
    ['banking_transaction_events', {
        event_type: 'direct_debit_cancelled',
        transaction_id: 'TXN-PROBE-FULL', account_id_masked: '****4471',
        amount: 1330.19, currency: 'GBP', direction: 'debit',
        merchant_name: 'Meridian Mortgages', merchant_category: 'mortgage',
        mcc: '6012', country_code: 'GB', is_foreign: false,
        payment_channel: 'online', payee_name: 'Meridian Mortgages',
        frequency: 'monthly', is_recurring: true
    }],
    ['banking_card_events', {
        event_type: 'limit_change_requested',
        card_id_masked: '****8820', card_type: 'credit',
        card_product: 'Meridian Platinum Card',
        previous_limit: 3000, new_limit: 5000, freeze_reason: 'misplaced',
        wallet_type: 'google', travel_country: 'ES',
        travel_start_date: '2026-08-20 00:00',
        travel_end_date: '2026-09-03 00:00'
    }],
    ['banking_wealth_events', {
        event_type: 'contribution_made',
        portfolio_id: 'PF-PROBE-FULL', portfolio_value_band: '250k_500k',
        asset_class: 'equities', holding_name: 'Global Sustainable Fund',
        risk_profile: 'balanced', contribution_amount: 10000,
        contribution_frequency: 'annual', withdrawal_amount: 25000,
        adviser_name: 'R. Mehta', performance_band: 'up_5_10'
    }],
    ['banking_engagement_events', {
        event_type: 'offer_accepted',
        offer_id: 'OFR-TRAVEL-01', offer_category: 'insurance',
        placement: 'dashboard_offer_rail', consent_email: true,
        consent_sms: false, consent_push: true, consent_profiling: true,
        campaign_slug: 'banking_image-popup'
    }]
];

function post(table, columns) {
    const body = JSON.stringify({
        accountId: ACCOUNT_ID,
        eventTable: table,
        key: DEVICE_ID,
        eventDetails: Object.assign({
            session_id: SESSION_ID,
            dn_device_id: DEVICE_ID,
            dn_contact_key: KEY
        }, COMMON, { page_path: PATH }, columns)
    });

    return new Promise(resolve => {
        const req = https.request(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let out = '';
            res.on('data', d => { out += d; });
            res.on('end', () => resolve({ table, status: res.statusCode, body: out.slice(0, 120) }));
        });
        req.on('error', err => resolve({ table, status: 0, body: String(err.message) }));
        req.write(body);
        req.end();
    });
}

const FULL = process.argv.includes('--full');
const ROWS_TO_SEND = FULL ? FULL_ROWS : ROWS;
const KEY = FULL ? CONTACT_KEY + '-full' : CONTACT_KEY;
const PATH = FULL ? MARKER + '-full' : MARKER;

(async () => {
    console.log('Live delivery probe' + (FULL ? '  [FULL COLUMN MODE]' : ''));
    console.log('  endpoint    ' + ENDPOINT);
    console.log('  accountId   ' + ACCOUNT_ID);
    console.log('  contact key ' + KEY + '   (never salil-demo)');
    console.log('  device id   ' + DEVICE_ID);
    console.log('  marker      page_path = ' + PATH);
    console.log('');

    const results = [];
    for (const [table, columns] of ROWS_TO_SEND) {
        const r = await post(table, columns);
        results.push(r);
        const flag = r.status === 200 ? 'accepted' : 'HTTP ' + r.status;
        console.log('  ' + flag.padEnd(10) + table + (r.body ? '   ' + r.body : ''));
    }

    const accepted = results.filter(r => r.status === 200).length;
    console.log('');
    console.log(accepted + '/' + results.length + ' accepted by the endpoint.');
    console.log('');
    console.log('THIS IS NOT PROOF OF DELIVERY. The row in Data Space is the only evidence.');
    console.log('');
    console.log('To confirm, in Data Space search each banking_* table for:');
    console.log('    dn_contact_key = ' + KEY);
    console.log('    page_path      = ' + PATH);
    console.log('Nine tables, one row each. Any table with no row did not land.');
    if (FULL) {
        console.log('');
        console.log('FULL MODE: every column declared in docs/TABLE-DESIGN.md was sent with a');
        console.log('value. Any column still EMPTY on these rows is a real mismatch between');
        console.log('this repo and the panel, and names the exact field to fix.');
    }
})();
