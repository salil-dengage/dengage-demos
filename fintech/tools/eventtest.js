/* ============================================================================
   NovaPay event contract suite

       node fintech/tools/eventtest.js

   WHY THIS EXISTS. On 3 August a handset log showed the Android app sending
   card_id_masked, card_product, card_status, kyc_status and topic. No schema
   defines any of them. Every row returned HTTP 200, because the event API
   accepts whatever it is handed and DROPS the columns the table does not have,
   so those rows landed in Data Space with their interesting half empty and
   nothing anywhere said so.

   The same log showed controlled columns filled with words outside their
   vocabulary: channel "app" where the table lists onsite, inapp, push, inbox;
   method "passport" where the list is email, phone, apple, google and passport
   is a doc_type; status "pending" where the list is started, completed, failed,
   abandoned.

   Neither ParityTest nor playbookcheck could catch any of it. ParityTest
   compares TABLE names and the six SPINE columns; playbookcheck greps for
   constructs. Nothing read the per-table columns, which is precisely where a
   demo quietly stops being a demo.

   BOTH SURFACES, because the website had the same defect and one being clean
   says nothing about the other. It sent product_family: 'all' on its products
   list, merchant_category: 'transfer' where that column is card payments only,
   and scenario_group: 'Landing' where the vocabulary is the panel's own
   scenario groups. All three were dropped on the way in.

   HOW IT WORKS. It parses fintech/EVENT-MODEL.md, so the model is the one
   source of truth and this file holds no second copy to drift from. For every
   Events.<table>(...) call site, in the Android app and in fintech/js, it
   checks:

     1. the event type is one the table declares
     2. every payload key is a column the table declares, or a spine column
     3. every LITERAL value in a closed-vocabulary column is a member of it

   TWO LIMITS, BOTH STATED RATHER THAN PAPERED OVER. Only literal values can be
   checked, because a value read from a variable is invisible here. And on the
   website, only a call site whose payload is an inline object literal can be
   read; the ones that build a payload through a helper are counted and
   reported at the end rather than passing in silence.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const MODEL = path.join(REPO, 'fintech/EVENT-MODEL.md');
const SRC = path.join(REPO, 'fintech/android/app/src/main/java/com/dengagefintech/demo');

/* Written by Events.send on every row, so they are legal everywhere and are
   never named at a call site. */
const SPINE = new Set([
    'event_type', 'event_source', 'page_path', 'is_authenticated',
    'customer_tier', 'app_version', 'session_id', 'dn_contact_key', 'dn_device_id',
]);

/* Events.<name> -> table, from Events.kt's own helper list. */
const HELPER = {
    onboarding: 'fintech_onboarding_events',
    account: 'fintech_account_events',
    transaction: 'fintech_transaction_events',
    card: 'fintech_card_events',
    savings: 'fintech_savings_events',
    investment: 'fintech_investment_events',
    credit: 'fintech_credit_events',
    product: 'fintech_product_events',
    support: 'fintech_support_events',
    engagement: 'fintech_engagement_events',
};

/* Instrumentation, deliberately outside the real catalogue. ParityTest keeps
   them out of Events.Tables; this keeps them out of the event-type check. */
const INSTRUMENTATION = /^test_/;

let problems = 0;
function check(ok, label, detail) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
    if (!ok) problems++;
}

// ------------------------------------------------------------- the model --

/**
 * Reads each `### 3.x \`fintech_*_events\`` section into its columns, its
 * declared event types, and the closed vocabularies its Notes column states.
 */
function parseModel() {
    const md = fs.readFileSync(MODEL, 'utf8');
    const tables = {};
    const sections = md.split(/^### /m).slice(1);

    for (const section of sections) {
        const name = (section.match(/^[\d.]+\s+`(fintech_[a-z_]+_events)`/) || [])[1];
        if (!name) continue;

        const columns = new Set(SPINE);
        const vocab = {};

        for (const [, col, , notes] of section.matchAll(
            /^\|\s*`([a-z_]+)`\s*\|([^|]*)\|([^|]*)\|/gm)) {
            columns.add(col);

            /* A Notes cell is a CLOSED VOCABULARY only when it is nothing but
               backticked tokens and separators. That distinguishes
               "`started`, `completed`" from "always positive; direction is in
               `transaction_type`", where the backticked word is a column name
               rather than a permitted value.

               THE FULL STOP IS NOT A SEPARATOR, and stripping it as one was a
               bug in the first version of this parser: scenario_slug reads
               "`survey`, `spin-to-win`, ..." and the ellipsis vanished, so an
               open list was enforced as a closed one and a correct row failed.
               Leaving "." in place makes the ellipsis survive as remainder,
               which is exactly what it means. */
            const tokens = [...notes.matchAll(/`([^`]+)`/g)].map(m => m[1]);
            const remainder = notes.replace(/`[^`]+`/g, '').replace(/[\s,;]/g, '');
            if (tokens.length >= 2 && remainder === '') vocab[col] = new Set(tokens);
        }

        const events = new Set(
            [...(section.match(/\*\*Events:\*\*([\s\S]*?)\n\n/) || [, ''])[1]
                .matchAll(/`([a-z_]+)`/g)].map(m => m[1]));

        tables[name] = { columns, events, vocab };
    }
    return tables;
}

// --------------------------------------------------------------- the app --

function kotlinFiles(dir) {
    const out = [];
    (function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (p.endsWith('.kt')) out.push(p);
        }
    })(dir);
    return out;
}

/** Balanced-paren slice starting at the '(' that follows `from`. */
function callArgs(src, from) {
    const open = src.indexOf('(', from);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) return src.slice(open + 1, i);
    }
    return null;
}

const model = parseModel();

console.log('\n################  the model  ################');
check(Object.keys(model).length === 10,
    'ten tables parsed from EVENT-MODEL.md', `found ${Object.keys(model).length}`);
for (const [t, m] of Object.entries(model)) {
    check(m.events.size > 0 && m.columns.size > SPINE.size,
        t, `${m.columns.size - SPINE.size} columns, ${m.events.size} event types, ` +
           `${Object.keys(m.vocab).length} closed vocabularies`);
}

console.log('\n################  what the app sends  ################');

/* Events.Tables.ONBOARDING -> fintech_onboarding_events, read from Events.kt so
   the constant names are never copied here. EventSamples names its table that
   way rather than through a helper, and the first version of this suite did not
   look at EventSamples at all, which is exactly where the five invented columns
   were sitting. */
const TABLE_CONST = {};
for (const [, name, value] of fs.readFileSync(path.join(SRC, 'Events.kt'), 'utf8')
    .matchAll(/const val ([A-Z_]+)\s*=\s*"(fintech_[a-z_]+_events)"/g)) {
    TABLE_CONST[name] = value;
}

/** Every (table, eventType, payload) the app can send, from both shapes. */
function* callSitesIn(src) {
    // Events.card("card_activated", mapOf( ... ))
    for (const m of src.matchAll(/Events\.([a-z]+)\(\s*"([a-z_]+)"/g)) {
        const table = HELPER[m[1]];
        if (!table) continue;
        const args = callArgs(src, m.index + 'Events.'.length + m[1].length);
        if (args !== null) yield { table, eventType: m[2], args };
    }
    // Sample("label", Events.Tables.CARD, "card_activated", mapOf( ... ))
    for (const m of src.matchAll(
        /Sample\(\s*"[^"]*",\s*Events\.Tables\.([A-Z_]+),\s*"([a-z_]+)"/g)) {
        const table = TABLE_CONST[m[1]];
        if (!table) continue;
        const args = callArgs(src, m.index + 'Sample'.length - 1);
        if (args !== null) yield { table, eventType: m[2], args };
    }
}

let callSites = 0;
for (const file of kotlinFiles(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(REPO, file);

    for (const { table, eventType, args } of callSitesIn(src)) {
        callSites++;

        const issues = [];
        const spec = model[table];

        if (!INSTRUMENTATION.test(eventType) && !spec.events.has(eventType)) {
            issues.push(`event type "${eventType}" is not one ${table} declares`);
        }

        for (const [, key] of args.matchAll(/"([a-z_]+)"\s+to\s/g)) {
            if (!spec.columns.has(key)) issues.push(`column "${key}" is not in ${table}`);
        }

        /* Literal values only. A value read from a variable cannot be checked
           from here, and pretending otherwise would make this suite's silence
           mean less than it does. */
        for (const [, key, value] of args.matchAll(/"([a-z_]+)"\s+to\s+"([^"$]*)"/g)) {
            const allowed = spec.vocab[key];
            if (allowed && !allowed.has(value)) {
                issues.push(`${key} = "${value}" is outside its vocabulary ` +
                            `(${[...allowed].join(', ')})`);
            }
        }

        check(issues.length === 0, `${rel}  ${table} <- ${eventType}`, issues.join('; '));
    }
}

check(callSites >= 20, 'app call sites found', `${callSites}`);

// ----------------------------------------------------------- the website --
//
// THE SAME CHECK ON THE OTHER SURFACE, and it is not symmetry for its own
// sake. The website sent product_family: 'all' on its products list, which is
// the identical defect the app was just corrected for: a word outside the
// column's vocabulary, dropped on the way in, so the column arrived empty and
// every segment written on it silently excluded the row. One surface being
// clean says nothing about the other, and both write the same ten tables.

console.log('\n################  what the website sends  ################');

/** Balanced-brace slice starting at the first '{' after `from`. */
function objectAt(src, from) {
    const open = src.indexOf('{', from);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
    }
    return null;
}

let siteSites = 0;
const SITE_JS = path.join(REPO, 'fintech/js');
for (const name of fs.readdirSync(SITE_JS).filter(f => f.endsWith('.js')).sort()) {
    const src = fs.readFileSync(path.join(SITE_JS, name), 'utf8');

    /* The payload must be an object literal STARTING RIGHT HERE. Matching a
       looser "somewhere after the comma" made the first version follow
       Events.product('x', payload({...})) past its own argument and brace-match
       to the end of the file, reporting two hundred phantom columns on one row.
       A call like payload(...) builds its keys somewhere else and is skipped,
       which is the same limit as a value read from a variable. */
    for (const m of src.matchAll(/Events\.([a-z]+)\(\s*'([a-z_]+)'\s*,\s*\{/g)) {
        const table = HELPER[m[1]];
        if (!table) continue;
        const eventType = m[2];
        const body = objectAt(src, m.index + m[0].length - 1);
        if (body === null) continue;
        siteSites++;

        const issues = [];
        const spec = model[table];

        if (!INSTRUMENTATION.test(eventType) && !spec.events.has(eventType)) {
            issues.push(`event type "${eventType}" is not one ${table} declares`);
        }
        /* A key only counts when it opens a property, so a colon inside a
           nested value or a string cannot be mistaken for one. */
        for (const [, key] of body.matchAll(/(?:^|[{,])\s*([a-z_]+)\s*:/g)) {
            if (!spec.columns.has(key)) issues.push(`column "${key}" is not in ${table}`);
        }
        for (const [, key, value] of body.matchAll(/(?:^|[{,])\s*([a-z_]+)\s*:\s*'([^']*)'/g)) {
            const allowed = spec.vocab[key];
            if (allowed && !allowed.has(value)) {
                issues.push(`${key} = '${value}' is outside its vocabulary ` +
                            `(${[...allowed].join(', ')})`);
            }
        }

        check(issues.length === 0, `fintech/js/${name}  ${table} <- ${eventType}`,
              issues.join('; '));
    }
}

check(siteSites >= 10, 'website call sites found', `${siteSites}`);

/* NO SILENT CAP. A call site whose payload is built by a helper, like
   Events.product('x', payload({...})), cannot be resolved from here, and a
   suite that passes quietly while skipping a third of the file would read as
   coverage it does not have. Count them and say so. */
let siteTotal = 0;
for (const name of fs.readdirSync(SITE_JS).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(SITE_JS, name), 'utf8');
    for (const m of src.matchAll(/Events\.([a-z]+)\(\s*'([a-z_]+)'\s*,/g)) {
        if (HELPER[m[1]]) siteTotal++;
    }
}
console.log(`\n  NOTE  ${siteSites} of ${siteTotal} website call sites carry an inline ` +
            `payload and were checked.\n        The other ${siteTotal - siteSites} build ` +
            `theirs through a helper and cannot be read statically,\n        as literal ` +
            `values can be and values from variables cannot.`);

console.log(problems
    ? `\n${problems} problem(s). A 200 from the event API is not proof: a column ` +
      `the table does not have is dropped, and the row lands half empty.`
    : '\nevery column and every literal value, in the app AND on the website,\n'
      + 'is one the model declares');
process.exit(problems ? 1 : 0);
