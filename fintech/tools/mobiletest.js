/* ============================================================================
   Mobile In-App content contract suite

       node fintech/tools/mobiletest.js

   WHY THIS EXISTS, AND WHY IT IS NOT paneltest.js. The content in
   fintech/panel-content/mobile/ is pasted into the same panel as the website's
   creatives, and looks identical, and obeys a DIFFERENT contract. That is the
   trap this suite is here to hold shut.

     WEB (cross-origin iframe)          MOBILE (WebView, bridge injected)
     <a href> plus target="_top"        Dn.androidUrl('novapay://<screen>')
     Dn.postQuestion / postSubscription Dn.setTags('tag:k,value:v')
     data-dn-form-id root               no form mechanism at all

   On mobile a novapay:// href fails with ERR_UNKNOWN_URL_SCHEME, silently,
   and no click is recorded. Navigation goes through Dn.androidUrl.

   The rules below are the mobile In-App content contract for this SDK
   version.

   It also checks the thing most likely to rot: that every screen name a file
   claims is one NovaPayInApp actually reports. A campaign bound to a screen
   name the app never sends is silently dark.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const DIR = path.join(REPO, 'fintech/panel-content/mobile');
const CATALOGUE = path.join(REPO,
    'fintech/android/app/src/main/java/com/dengagefintech/demo/inapp/NovaPayInApp.kt');

/* Banners draw their own close control, because Banner layout is not offered
   the panel's "add close button to outside" setting. Everything else must not,
   or the card shows two. */
const BANNERS = new Set(['inapp-banner.html', 'inapp-bar.html']);

/* Inline content is injected into the app's own view rather than shown as a
   message, so it is neither dismissible nor triggered by a screen name. */
const INLINE = new Set(['inline-offer.html']);

/* Not bridge content: the App Inbox is drawn by the app's own Compose UI from
   title and message. The file is a copy deck, not a webview page. */
const NOT_BRIDGE = new Set(['inbox-message.html']);

/* The methods the Dn bridge defines. Anything else is a typo, and an
   undefined call inside an inline onclick throws into a console nobody is
   reading. */
const BRIDGE_METHODS = new Set([
    'dismiss', 'androidUrl', 'androidUrlN', 'sendClick', 'close', 'closeN',
    'setTags', 'iosUrl', 'iosUrlN', 'promptPushPermission', 'showRating',
    'openSettings', 'copyToClipboard',
]);

/* Every screen a novapay:// link can reach, READ FROM Screen.kt rather than
   copied. A deep link to a host the app does not route lands nowhere, and the
   customer stays on whatever screen was in front of them. Keeping a second
   copy of this list here is how that check quietly stops being true. */
const SCREEN_KT = path.join(REPO,
    'fintech/android/app/src/main/java/com/dengagefintech/demo/Screen.kt');
const SCREENS = new Set(
    [...fs.readFileSync(SCREEN_KT, 'utf8')
        .matchAll(/const val [A-Z_]+\s*=\s*"([a-z_]+)"/g)].map(m => m[1]));

let problems = 0;
function check(ok, label, detail) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
    if (!ok) problems++;
}

const stripComments = html => html.replace(/<!--[\s\S]*?-->/g, '');
const bodyOf = html => (html.match(/<body>([\s\S]*)<\/body>/) || [null, html])[1];

// ------------------------------------------------------------------ files --

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html')).sort();

console.log('\n################  mobile in-app content  ################');
check(files.length >= 15, 'every layout has a file', `found ${files.length}`);

const screensInContent = new Set();

for (const rel of files) {
    const raw = fs.readFileSync(path.join(DIR, rel), 'utf8');
    const live = stripComments(bodyOf(raw));
    const issues = [];

    if (/<script/i.test(live)) issues.push('contains a <script> block; the panel strips it on save');
    // Escaped rather than literal, so this file does not itself trip a sweep
    // for the characters it is here to ban.
    if (/[\u2013\u2014]/.test(raw)) issues.push('contains an em or en dash');

    /* No third-party image host. A demo that depends on one shows an empty
       card the day that host is slow, and an image-only layout shows nothing
       else at all. */
    for (const [, src] of live.matchAll(/src="(https?:\/\/[^"]+)"/g)) {
        if (!src.startsWith('https://salil-dengage.github.io/dengage-demos/fintech/')) {
            issues.push(`image is not committed in this repository: ${src}`);
        }
    }

    /* Namespaced root. Inline content is NOT sandboxed, and on mobile neither
       is anything else: it is one WebView per message, but a leaking selector
       still restyles the whole card. */
    const root = (live.match(/id="(npy-[a-z-]+)"/) || [])[1];
    if (!root) issues.push('no #npy-* root element');
    else {
        /* @keyframes blocks are stripped first: their "from" and "to" are
           frame selectors, not page selectors, and cannot leak anywhere. */
        const css = ((raw.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '')
            .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
        const unscoped = css
            .split('}')
            .map(b => b.split('{')[0].trim())
            .filter(Boolean)
            .filter(sel => !sel.startsWith('@') && !sel.includes('#' + root));
        if (unscoped.length) issues.push(`unscoped CSS selector "${unscoped[0]}"`);
    }

    if (NOT_BRIDGE.has(rel)) {
        /* Nothing further: no bridge, so no bridge contract. */
        check(issues.length === 0, rel, issues.join('; '));
        continue;
    }

    // -------------------------------------------------------- the bridge --

    /* THE HEADLINE RULE. On mobile, navigation goes through Dn.androidUrl. */
    for (const tag of live.match(/<a\b[^>]*>/gi) || []) {
        if (/href="novapay:\/\//.test(tag)) {
            issues.push('anchor navigates by href; on mobile navigation goes through Dn.androidUrl');
        }
        if (/target="_top"/.test(tag)) {
            issues.push('anchor carries target="_top"; that is the web contract, there is no frame here');
        }
        if (/href="#"/.test(tag) && !/return false/.test(tag)) {
            issues.push('anchor with href="#" and no return false will scroll the card');
        }
    }

    /* A deep link to a screen the app does not route lands nowhere. */
    for (const [, screen] of live.matchAll(/novapay:\/\/([a-z_]+)/g)) {
        if (!SCREENS.has(screen)) issues.push(`novapay://${screen} is not a screen the app routes`);
    }

    /* The web capture mechanism does not exist on mobile and would look
       completely correct sitting in the file. */
    if (/data-dn-form-id/.test(live)) {
        issues.push('data-dn-form-id is a web-only mechanism; mobile capture is Dn.setTags');
    }
    for (const m of ['postQuestion', 'postSubscription']) {
        if (live.includes('Dn.' + m)) issues.push(`Dn.${m} does not exist on mobile`);
    }

    /* Every Dn call must be one the bridge defines. */
    for (const [, name] of live.matchAll(/Dn\.([A-Za-z]+)\s*\(/g)) {
        if (!BRIDGE_METHODS.has(name)) issues.push(`Dn.${name} is not a bridge method`);
    }

    /* setTags takes ONE comma-separated string with the literal keys tag and
       value. Use exactly this shape. */
    for (const [, arg] of live.matchAll(/Dn\.setTags\(([^)]*)\)/g)) {
        if (arg.trim() && !/'tag:[a-z_]+,value:/.test(arg)) {
            issues.push(`setTags argument is not 'tag:<key>,value:<value>': ${arg.trim().slice(0, 40)}`);
        }
    }

    const clicks = [...live.matchAll(/Dn\.sendClick\('([^']+)'\)/g)].map(m => m[1]);
    const hasClose = /Dn\.close\(\)/.test(live);

    if (INLINE.has(rel)) {
        if (hasClose) issues.push('inline content draws a close control; it is not dismissible');
    } else {
        if (clicks.length !== 1) issues.push(`expected exactly 1 Dn.sendClick, found ${clicks.length}`);
        if (clicks.some(id => id.endsWith('__close'))) issues.push('close control reports a click');
        if (BANNERS.has(rel) && !hasClose) issues.push('banner draws no close control');
        if (!BANNERS.has(rel) && hasClose && !/type="button"/.test(live)) {
            issues.push('popup draws its own close control; the panel supplies it');
        }
        /* The screen name is the whole targeting contract, so it has to be
           stated in the file and it has to match the app. */
        const screen = (raw.match(/screen name\s+(test_inapp_[a-z_]+)/) || [])[1];
        if (!screen) issues.push('header does not name its trigger screen');
        else {
            screensInContent.add(screen);
            if (!clicks.every(c => c.startsWith(screen + '__')) && clicks.length) {
                issues.push(`sendClick id "${clicks[0]}" is not <screen>__<action>`);
            }
        }
    }

    check(issues.length === 0, rel, issues.join('; '));
}

// -------------------------------------------------------------- wiring --

console.log('\n################  wiring  ################');

const kt = fs.readFileSync(CATALOGUE, 'utf8');
const screensInApp = new Set(
    [...kt.matchAll(/"(test_inapp_[a-z_]+)"/g)].map(m => m[1]));
const filesInApp = new Set(
    [...kt.matchAll(/"(inapp-[a-z-]+\.html)"/g)].map(m => m[1]));

for (const s of [...screensInApp].sort()) {
    check(screensInContent.has(s), `${s} has content to paste`);
}
for (const s of [...screensInContent].sort()) {
    check(screensInApp.has(s), `${s} is reported by the app`,
        screensInApp.has(s) ? '' : 'no button reports it, so the campaign is dark');
}
for (const f of [...filesInApp].sort()) {
    check(files.includes(f), `${f} exists`);
}

/* The artwork the image-only layouts depend on. Those two carry no HTML copy,
   so a missing file is a blank card rather than a broken image. */
console.log('\n################  artwork  ################');
for (const art of ['fx-free.svg', 'plus-plan.svg', 'payday.svg']) {
    check(fs.existsSync(path.join(REPO, 'fintech/images/inapp', art)),
        `images/inapp/${art} is committed`);
}

console.log(problems
    ? `\n${problems} problem(s)`
    : '\nevery mobile creative matches the bridge contract and the app agrees');
process.exit(problems ? 1 : 0);
