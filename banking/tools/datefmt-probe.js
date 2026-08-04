/* ============================================================================
   Date format matrix for banking_card_events

       node banking/tools/datefmt-probe.js

   WHAT THIS ANSWERS: which date format the travel_start_date and
   travel_end_date columns store. One row per candidate format, each stamped
   with its own card_id_masked.

   Everything else on the row is identical and already known to land, which
   keeps the date the only variable.

   HOW TO READ THE RESULT

   In Data Space, filter banking_card_events on the contact key below. You get
   one row per variant. card_id_masked names the variant on each row; the rows
   with travel_start_date and travel_end_date populated name the formats the
   columns store.
   ========================================================================== */
'use strict';

const https = require('https');

const ENDPOINT   = 'https://event.dengage.com/api/web/event';
const ACCOUNT_ID = '5eb58b77-f506-7303-2225-27172c028c21';

const CONTACT_KEY = 'v12-datefmt-probe';   // never salil-demo
const DEVICE_ID   = 'v12-datefmt-probe-device';

/* One variant per row. The label goes into card_id_masked, which is a plain
   Text column already proven to land, so every row is findable in Data Space
   and names its own variant. */
const VARIANTS = [
    /* Round two. The documented DATETIME format is YYYY-MM-DD HH:mm, with a
       space separator and NO seconds, no T, no Z and no timezone offset:
       dev.dengage.com/reference/intro-to-data-space, "Data Types".

       Round one never sent that shape: every variant we sent was
       ISO-flavoured, and the closest, 'C-space-sep', carried trailing
       seconds. These variants isolate the seconds specifically, since that
       is the single character difference between the documented shape and
       what round one sent. */
    ['I-doc-hh-mm',      '2026-08-20 00:00',    '2026-09-03 00:00'],
    ['J-doc-real-time',  '2026-08-20 09:15',    '2026-09-03 17:40'],
    ['K-doc-with-secs',  '2026-08-20 09:15:00', '2026-09-03 17:40:00'],
    ['L-date-only-again','2026-08-20',          '2026-09-03']
];

function post(columns) {
    const body = JSON.stringify({
        accountId: ACCOUNT_ID,
        eventTable: 'banking_card_events',
        key: DEVICE_ID,
        eventDetails: Object.assign({
            session_id: 'v12-datefmt-probe-session',
            dn_device_id: DEVICE_ID,
            dn_contact_key: CONTACT_KEY,
            event_type: 'travel_notice_set',
            event_source: 'web',
            page_path: '/probe/v12-datefmt',
            is_authenticated: true,
            customer_tier: 'premier',
            card_type: 'credit',
            card_product: 'Meridian Platinum Card',
            travel_country: 'ES'
        }, columns)
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
            res.on('end', () => resolve({ status: res.statusCode, body: out.slice(0, 80) }));
        });
        req.on('error', err => resolve({ status: 0, body: String(err.message) }));
        req.write(body);
        req.end();
    });
}

(async () => {
    console.log('Date format matrix -> banking_card_events');
    console.log('  contact key  ' + CONTACT_KEY);
    console.log('  marker       card_id_masked carries the variant label');
    console.log('');

    for (const [label, start, end] of VARIANTS) {
        const r = await post({
            card_id_masked: label,
            travel_start_date: start,
            travel_end_date: end
        });
        console.log('  ' + (r.status === 200 ? 'accepted' : 'HTTP ' + r.status).padEnd(10)
            + label.padEnd(16) + String(start));
    }

    console.log('');
    console.log('Confirm the rows in Data Space: filter banking_card_events on');
    console.log('    dn_contact_key = ' + CONTACT_KEY);
    console.log('and check which rows have travel_start_date and travel_end_date');
    console.log('populated. card_id_masked names the variant on each row.');
})();
