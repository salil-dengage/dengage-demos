// ============================================================================
// ownership: does this change stay inside the session's lane?
//
//   node tools/verify/ownership.js                    # staged + unstaged vs origin/main
//   node tools/verify/ownership.js --session=finance  # override the session
//   node tools/verify/ownership.js --base=HEAD~3      # a different comparison point
//
// Separate Claude Code sessions work on this repository at once, and they push
// to the same branch. Git merges two disjoint directories without complaint, so
// nothing in git stops one session editing another's demo and nobody noticing
// until a call.
//
// This is the mechanical version of the rule in CLAUDE.md 1. It classifies
// every changed path into a lane and fails if the session touched one it does
// not own. It also reports which verification tier the change earns, because
// the two questions have the same input: what did you actually change?
//
// A LANE IS A DEMO. A SESSION IS A SET OF LANES SOMEBODY OWNS, and the two are
// not the same shape: `finance` owns fintech/ and banking/ both, because one
// session runs both finance demos. Declaring that here is what keeps a change
// spanning the two checked rather than merely unexplained.
//
// Exit 0 clean, 1 violation. Session comes from --session, $DENGAGE_SESSION,
// or is inferred from the diff itself when the diff is unambiguous.
// ============================================================================
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------- the lanes
//
// Order matters. The shared modules live INSIDE the site directories, so they
// have to be classified before the directory rules see them.

// Byte-identical across all five sites by contract. Change one, copy to all
// five, or searchwishtest and slottest fail for everybody. Only eComm may.
const SHARED_MODULES = [
    'js/wishlist.js',
    'js/wishlistUi.js',
    'js/searchPanel.js',
    'js/identity.js',
    'js/inlineSlotOffset.js',
];

const LANES = [
    { lane: 'shared-module', test: p => SHARED_MODULES.some(m => p.endsWith('/' + m)) },
    { lane: 'ecomm',   test: p => p.startsWith('cantu-pneus/') },
    { lane: 'fintech', test: p => p.startsWith('fintech/') },
    { lane: 'banking', test: p => p.startsWith('banking/') },

    /* ARTWORK GENERATORS ARE NOT SUITES, and lumping them in with the rest of
       tools/ was costing a ten-minute five-site sweep for a change that could
       not reach four of those sites.

       What makes tools/verify/ dangerous is that every site RUNS it: a change
       to a suite or to sites.js can turn a demo red for a session that is not
       in the room, so it escalates. tools/assets/ is the opposite. Nothing
       imports it, no suite runs it, no page loads it. It is run by hand, it
       writes committed artwork, and the artwork is what ships. So the risk it
       carries is the risk of the files it wrote, which is the site tier.

       CLAUDE.md 4 already said exactly this, "Artwork regenerated under
       tools/assets/ -> run.sh <affected site>". This lane is what makes the
       code agree with the table. It MUST sit above the tooling rule, which
       would otherwise swallow it. */
    { lane: 'asset-tooling', test: p => p.startsWith('tools/assets/') },

    { lane: 'tooling', test: p => p.startsWith('tools/') },
    { lane: 'docs',    test: p => p.startsWith('docs/') || /^(README|CLAUDE)\.md$/.test(p) },
    { lane: 'root',    test: p => /^(\.gitignore|\.nojekyll|dengagewebpushsw\.js)$/.test(p) },
];

const SESSIONS = {
    ecomm:   { owns: ['ecomm', 'shared-module'], label: 'eComm (CantuPneus)' },

    /* ONE SESSION OWNS BOTH FINANCE DEMOS. Use this whenever the work spans
       them, which is most of it: NovaPay and Meridian share an SDK, an app
       shape and a set of questions, so the same fix usually belongs in both.
       Splitting one change across two pushes to satisfy a narrower lane was
       the alternative, and it lands half a fix on a live site. */
    finance: { owns: ['fintech', 'banking'],     label: 'Finance (NovaPay + Meridian)' },

    /* The single-demo sessions stay, and they are NARROWER than finance rather
       than obsolete. Run with --session=fintech and a stray banking/ edit is
       still refused, which is what you want when the change is meant to reach
       one site only. Nothing here grants the shared modules to anyone but
       eComm; that rule is unchanged. */
    fintech: { owns: ['fintech'],                label: 'FinTech (NovaPay)' },
    banking: { owns: ['banking'],                label: 'Banking (Meridian)' },
};

/* A lane, as an argument to run.sh. eComm is the odd one: that lane is THREE
   run targets (pt-BR, en, ru) and only the author knows which of them a change
   reaches, so it stays a prompt rather than a command. */
const RUN_TARGET = {
    ecomm:   '<cantu-pneus|cantu-pneus-en|cantu-pneus-ru>',
    fintech: 'fintech',
    banking: 'banking',
};

// Lanes any session may change. Most are not free: a suite, sites.js or a root
// file can break a site the author is not looking at, so touching them
// escalates to the full sweep. asset-tooling is the exception, for the reason
// given beside its lane. See the tier table at the bottom.
const COMMON = ['asset-tooling', 'tooling', 'docs', 'root'];

function classify(p) {
    const hit = LANES.find(l => l.test(p));
    return hit ? hit.lane : 'unclassified';
}

// ------------------------------------------------------------ the mobile tier
//
// A site's app folder is compiled into an APK. Nothing in it is served by
// GitHub Pages, so no change inside it can alter a page the browser suites
// load, and running them against it proves nothing about the change.
//
// The folder is not named the same on every site (`fintech/android`,
// `banking/android-app`), so this matches the shape rather than a list, and
// asks the filesystem where the suites are rather than assuming.
//
// DELIBERATELY NARROW. Panel content is excluded even under `mobile/`: it is
// pasted into campaigns that also render on the website, and paneltest reads
// it. Docs are excluded because the docs tier already covers them and a change
// that is docs plus app should run the app suites, which is what happens when
// this returns false for the doc and the site branch is reached instead.
const MOBILE_DIR = /^(cantu-pneus|fintech|banking)\/android[^/]*\//;

function isMobileOnly(p) {
    return MOBILE_DIR.test(p);
}

/* sites[] holds LANE names, and one of them is not its directory: the eComm
   lane lives in cantu-pneus/. Reading the folders off the diff avoids having to
   remember that here, and it is only ever called once every path has already
   been confirmed to be under an app folder.

   It returns a LIST, because a session can own two demos and the apps are the
   most alike part of them. One fix landing in fintech/android/ and
   banking/android-app/ together is the normal case, not an odd one. */
function siteDirs(paths) {
    return [...new Set(paths.map(p => p.split('/')[0]))];
}

/* The static suites that DO cover a mobile change: the bridge contract between
   the app and the panel creatives, the playbook checklist, and the event model,
   which the app can break as easily as the website can. Only the ones a site
   actually has, so adding a suite to a site is enough to get it run here. */
function mobileSuites(site) {
    const found = [];
    const add = rel => { if (fs.existsSync(path.join(REPO, rel))) found.push(rel); };
    add(`${site}/tools/mobiletest.js`);
    add(`${site}/tools/eventtest.js`);
    for (const dir of fs.readdirSync(path.join(REPO, site), { withFileTypes: true })) {
        if (dir.isDirectory() && dir.name.startsWith('android')) {
            add(`${site}/${dir.name}/tools/playbookcheck.js`);
        }
    }
    return found;
}

/* The suites for EVERY app folder the diff touched, or nothing at all.
   All-or-nothing on purpose: if one of the two apps has no mobile suite, the
   cheap tier would run a full list for one demo and an empty list for the
   other while reporting the change checked. Returning [] there drops it to the
   site tier, which is the honest answer. */
function mobileSuitesFor(paths) {
    const perSite = siteDirs(paths).map(mobileSuites);
    return perSite.every(list => list.length) ? perSite.flat() : [];
}

// ------------------------------------------------------------------- inputs
const args = process.argv.slice(2);
const arg = name => {
    const hit = args.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
};

const base = arg('base') || 'origin/main';

function git(cmd) {
    return execSync(`git ${cmd}`, { cwd: REPO, encoding: 'utf8' });
}

let changed;
try {
    // Everything this session would be adding to base: committed, staged and
    // working-tree alike, so the check is honest before a commit as well as
    // after one.
    const merge = git(`merge-base ${base} HEAD`).trim();
    changed = git(`diff --name-only ${merge}`).split('\n')
        .concat(git('diff --name-only --cached').split('\n'))
        .concat(git('ls-files --others --exclude-standard').split('\n'))
        .map(s => s.trim()).filter(Boolean);
    changed = [...new Set(changed)].sort();
} catch (e) {
    console.error(`could not diff against ${base}: ${e.message.split('\n')[0]}`);
    console.error('fetch first:  git fetch origin main');
    process.exit(1);
}

if (!changed.length) {
    console.log(`no changes against ${base}`);
    process.exit(0);
}

const byLane = new Map();
for (const p of changed) {
    const lane = classify(p);
    if (!byLane.has(lane)) byLane.set(lane, []);
    byLane.get(lane).push(p);
}

// --------------------------------------------------------- who is this session
let session = arg('session') || process.env.DENGAGE_SESSION || null;

if (!session) {
    /* Infer only when the diff names exactly one site lane. Anything else is
       ambiguous and guessing would defeat the point of the check.

       A fintech + banking diff is DELIBERATELY NOT inferred as finance, even
       though that session exists and owns both. Inferring it would mean the one
       shape this check most needs a human to look at, a change reaching two
       live demos at once, is the shape it waves through unasked. Naming the
       session costs one word and makes the claim somebody's. */
    const siteLanes = ['ecomm', 'fintech', 'banking'].filter(l => byLane.has(l));
    if (byLane.has('shared-module')) session = 'ecomm';
    else if (siteLanes.length === 1) session = siteLanes[0];
}

console.log(`base            ${base}`);
console.log(`files changed   ${changed.length}`);
for (const [lane, files] of [...byLane].sort()) {
    console.log(`  ${lane.padEnd(15)} ${files.length}`);
}

if (!session) {
    console.log('');
    console.log('SESSION UNKNOWN. This diff touches more than one site lane, or no');
    console.log('site lane at all, so it cannot be inferred. Say which session you are:');
    console.log(`  node tools/verify/ownership.js --session=${Object.keys(SESSIONS).join('|')}`);
    console.log('');
    console.log('fintech and banking together is a --session=finance change: one session');
    console.log('owns both finance demos, so that diff is expected and is checked as one.');
    console.log('A diff that also reaches cantu-pneus/ is the thing this check exists to');
    console.log('catch. If that is deliberate, it needs Salil, not a flag.');
    process.exit(1);
}

if (!SESSIONS[session]) {
    console.error(`unknown session "${session}". One of: ${Object.keys(SESSIONS).join(', ')}`);
    process.exit(1);
}

const { owns, label } = SESSIONS[session];
console.log(`session         ${label}`);
console.log('');

// ------------------------------------------------------------------ verdict
const violations = [];
for (const [lane, files] of byLane) {
    if (owns.includes(lane) || COMMON.includes(lane)) continue;
    violations.push([lane, files]);
}

const WHY = {
    ecomm:   'cantu-pneus/ belongs to the eComm session',
    fintech: 'fintech/ belongs to FinTech, or to finance, which owns both demos',
    banking: 'banking/ belongs to Banking, or to finance, which owns both demos',
    'shared-module':
        'byte-identical across all five sites; only the eComm session may change one',
    unclassified:
        'not in any known lane. Add a rule to LANES, or it is in the wrong place',
};

if (violations.length) {
    console.log('OUT OF LANE');
    for (const [lane, files] of violations) {
        console.log(`\n  ${lane}: ${WHY[lane] || 'not yours'}`);
        for (const f of files) console.log(`    ${f}`);
    }
    console.log('');
    console.log('Do not "just fix it here". Two sessions editing the same file is how');
    console.log('one silently reverts the other. Stop and route it through Salil.');
    process.exit(1);
}

// ------------------------------------------------------------- the tier earned
//
// Same input, second question. Touching a suite, a root file or a shared module
// escalates to the full sweep, because any of them can break a demo whose
// session is not in this room. An artwork generator cannot, so it does not.
const touched = new Set(byLane.keys());
const sites = [...touched].filter(l => ['ecomm', 'fintech', 'banking'].includes(l));
let tier, cmd;

if ([...touched].every(l => l === 'docs')) {
    tier = 'documentation only';
    cmd  = 'no browser suite. Check links resolve and no em or en dashes.';
} else if (touched.has('tooling') || touched.has('shared-module') || touched.has('root')) {
    tier = 'FULL SWEEP, no exceptions';
    cmd  = 'tools/verify/run.sh';
} else if (changed.every(isMobileOnly) && mobileSuitesFor(changed).length) {
    /* Nothing under a site's app folder is served by GitHub Pages, so a change
       confined to one cannot reach the website the browser suites drive. Making
       it pay for them anyway is what taught people to skip the suites, which is
       a worse habit than the rule it replaced. The mobile contract suites still
       run, and they are static, so this is seconds rather than minutes.

       IT SITS ABOVE THE MULTI-SITE BRANCH, and that ordering is the point of
       this rule for a session that owns two demos. The same app fix usually
       belongs in both finance apps, and "two sites" would otherwise escalate a
       pair of app changes to a ten-minute five-site website sweep that cannot
       reach a single line of what changed.

       The second half of the condition is the guard against cheapening a change
       that nothing then checks: an app folder whose site has no mobile suite
       falls through to the site tier rather than earning a tier that runs an
       empty list. */
    tier = 'the mobile app only';
    cmd  = mobileSuitesFor(changed).map(s => `node ${s}`).join(' && ');
} else if (sites.length > 1 && sites.every(l => l !== 'ecomm')) {
    /* Reachable only for a session that owns more than one demo, which today
       means finance. THE SITES ARE ISOLATED BY DESIGN, so a change spanning
       fintech/ and banking/ cannot reach CantuPneus, and the full sweep would
       spend most of ten minutes proving three untouched sites still work. Run
       the ones the change can actually reach, which is CLAUDE.md 4's rule, not
       an exception to it. */
    tier = `more than one site: ${sites.join(' and ')}`;
    cmd  = sites.map(l => `tools/verify/run.sh ${RUN_TARGET[l]}`).join(' && ');
} else if (sites.length > 1) {
    /* The eComm lane is in the list, so one of the targets is really three and
       the diff crosses industries as well. Nothing about that is a routine
       change, and the full sweep is the only answer that is certainly enough. */
    tier = 'more than one site, including eComm';
    cmd  = 'tools/verify/run.sh';
} else if (!sites.length) {
    /* Reached only when a generator changed with no regenerated artwork beside
       it, which is worth saying out loud rather than guessing a site for: the
       generator is not what ships, its committed output is, and a generator
       edited without its output is a change nobody can see yet. */
    tier = 'an artwork generator, with no regenerated artwork beside it';
    cmd  = 'tools/verify/run.sh <the site whose images/ this generator writes>, '
         + 'and commit the regenerated files in the same change';
} else if (changed.every(p => p.includes('panel-content/'))) {
    tier = 'panel content only';
    cmd  = 'paneltest.js, formtest.js, and pttext.js / rutext.js if pt or ru copy changed';
} else {
    tier = 'one site';
    cmd  = `tools/verify/run.sh ${RUN_TARGET[sites[0]]}`;
}

console.log('IN LANE');
console.log('');
console.log(`verification tier   ${tier}`);
console.log(`run                 ${cmd}`);
console.log('');
console.log('Run it AFTER merging origin/main, not before. A tree that was green');
console.log('before the merge is not evidence about the tree you are pushing.');
