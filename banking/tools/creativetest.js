/* ============================================================================
   Portal creative contract suite

       node banking/tools/portalcreatives.js

   The ten portal On-Site messages in banking/panel-content/portal/ come in two
   formats whose rules are OPPOSITES, which is exactly why they need checking
   rather than eyeballing.

     POPUP / BANNER          INLINE
     renders in an iframe    injected straight into the page
     needs target="_top"     no frame to break out of
     exactly one sendClick   NO sendClick: the SDK counts injected anchors
                             itself, so calling it double-counts
     CSS is sandboxed        CSS is NOT: an unscoped selector restyles the
                             customer's whole banking session

   tools/verify/paneltest.js cannot do this. It scans only a site's top-level
   panel-content directory and applies the popup contract to everything it
   finds, so every inline file would fail for not calling sendClick. Hence a
   banking-local suite, which also keeps the shared suites free of this site's
   specifics.

   It also checks the thing most likely to rot: that every trigger named in a
   creative is one js/portal.js actually pushes. A creative bound to a trigger
   nothing fires is silently dark, and nothing errors.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const DIR = path.join(REPO, 'banking/panel-content/portal');
/* Triggers come from more than one module: the ten portal scenarios from
   portal.js, and the lead form from openAccount.js, which is separate because
   the header CTA is not a portal page. */
const TRIGGER_SOURCES = ['banking/js/portal.js', 'banking/js/openAccount.js']
    .map(rel => path.join(REPO, rel));

/* Which file is which format. Named rather than inferred from the directory,
   because getting this wrong silently applies the opposite contract. */
const BANNERS = new Set(['low-balance.html']);
const POPUPS = new Set(['foreign-spend.html', 'card-frozen.html',
                        'mortgage-dd-cancelled.html', 'lead-form.html']);
/* Files that collect input. These MUST carry a native data-dn-form-id root:
   the content is in a cross-origin iframe, so host-page JS cannot see a
   keystroke, and a hand-rolled form would look perfect and capture nothing. */
const FORMS = new Set(['lead-form.html']);

let problems = 0;
function check(ok, label, detail) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
    if (!ok) problems++;
}

function stripComments(html) {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}

function bodyOf(html) {
    const m = html.match(/<body>([\s\S]*)<\/body>/);
    return m ? m[1] : html;
}

function listFiles() {
    const out = [];
    for (const f of fs.readdirSync(DIR).sort()) {
        if (f.endsWith('.html')) out.push({ rel: f, inline: false });
    }
    const inlineDir = path.join(DIR, 'inline');
    if (fs.existsSync(inlineDir)) {
        for (const f of fs.readdirSync(inlineDir).sort()) {
            if (f.endsWith('.html')) out.push({ rel: 'inline/' + f, inline: true });
        }
    }
    return out;
}

const sources = TRIGGER_SOURCES.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const firedTriggers = new Set([
    ...[...sources.matchAll(/trigger\('(banking_[a-z_]+)'/g)].map(m => m[1]),
    ...[...sources.matchAll(/var TRIGGER = '(banking_[a-z_]+)'/g)].map(m => m[1]),
]);
const slotsInPortal = new Set(
    [...sources.matchAll(/id="(dn_inline_target_[a-z_]+)"/g)].map(m => m[1]));

const files = listFiles();
console.log(`\n################  portal creatives  ################`);
check(files.length === 11, 'eleven portal creatives present', `found ${files.length}`);

const seenTriggers = new Set();

for (const { rel, inline } of files) {
    const raw = fs.readFileSync(path.join(DIR, rel), 'utf8');
    const live = stripComments(bodyOf(raw));
    const issues = [];

    if (/<script/i.test(live)) issues.push('contains a <script> block');
    if (/[–—]/.test(raw)) issues.push('contains an em or en dash');

    /* The trigger must be declared in the header AND actually pushed. */
    const trig = raw.match(/eventName\s*=\s*(banking_[a-z_]+)/);
    if (!trig) issues.push('header does not name its DATA_LAYER_EVENT trigger');
    else {
        seenTriggers.add(trig[1]);
        if (!firedTriggers.has(trig[1])) {
            issues.push(`trigger ${trig[1]} is never pushed by js/portal.js, so it is dark`);
        }
    }

    /* Root id, and every CSS selector under it. Inline is not sandboxed. */
    const root = (live.match(/id="(mrd-[a-z-]+)"/) || [])[1];
    if (!root) issues.push('no #mrd-* root element');
    else {
        const css = (raw.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
        const unscoped = css
            .split('}')
            .map(b => b.split('{')[0].trim())
            .filter(Boolean)
            .filter(sel => sel && !sel.startsWith('@') && !sel.includes('#' + root));
        if (unscoped.length) {
            issues.push(`unscoped CSS selector "${unscoped[0]}" would leak to the whole page`);
        }
    }

    const clicks = [...live.matchAll(/Dn\.sendClick\('([^']+)'\)/g)].map(m => m[1]);
    const hasClose = /onclick="Dn\.close\(\)"/.test(live);
    const anchors = live.match(/<a\b[^>]*>/gi) || [];

    if (inline) {
        /* The SDK counts injected anchors itself. */
        if (clicks.length) issues.push(`inline file calls Dn.sendClick ${clicks.length} time(s); the SDK already counts its anchors`);
        if (hasClose) issues.push('inline file draws a close control; inline content is not dismissible');
    } else {
        if (clicks.length !== 1) issues.push(`expected exactly 1 Dn.sendClick, found ${clicks.length}`);
        if (clicks.some(id => id.endsWith('__close'))) issues.push('close control reports a click');
        for (const tag of anchors) {
            if (!/target="_top"/.test(tag)) issues.push('anchor without target="_top"');
        }
        const isBanner = BANNERS.has(rel);
        if (isBanner && !hasClose) issues.push('banner draws no close control');
        if (!isBanner && hasClose) issues.push('popup draws its own close control; the panel supplies it');
        if (!isBanner && !POPUPS.has(rel)) issues.push('file is in neither BANNERS nor POPUPS');
        if (FORMS.has(rel) && !/data-dn-form-id="(subscription|question)_form"/.test(live)) {
            issues.push('capture file without a native data-dn-form-id root');
        }
    }

    check(issues.length === 0, rel, issues.join('; '));
}

console.log(`\n################  wiring  ################`);

/* Every trigger the portal pushes should have a creative, and vice versa.
   A pushed trigger with no campaign is the documented silent-dark failure. */
for (const t of [...firedTriggers].sort()) {
    check(seenTriggers.has(t), `${t} has a creative`);
}

const NEEDED_SLOTS = [
    'dn_inline_target_dashboard_offer',
    'dn_inline_target_account_activity',
    'dn_inline_target_cards_travel',
    'dn_inline_target_wealth_review',
];
for (const s of NEEDED_SLOTS) {
    check(slotsInPortal.has(s), `${s} exists in js/portal.js`);
}

console.log(problems
    ? `\n${problems} problem(s)`
    : '\nevery portal creative matches its format contract and its trigger');
process.exit(problems ? 1 : 0);
