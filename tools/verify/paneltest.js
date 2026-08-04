// ============================================================================
// paneltest: static and visual checks on every cantu-pneus/panel-content file.
//
//   node tools/verify/paneltest.js
//
// These files are pasted into the Dengage panel by hand, so nothing else in the
// repo can catch a regression in them. What is checked, and why each rule
// exists (all three were live bugs at some point):
//
//   no <script>                  the panel strips script blocks on save
//   every anchor target="_top"   otherwise the link loads the site INSIDE the
//                                content's cross-origin iframe
//   Dn.sendClick on the CTA      the engine counts a click only when the
//                                content reports one; without it CLICK,
//                                UNIQUE CLICK and CTR stay 0
//   Dn.close on the close control, never sendClick, so a dismissal is not
//                                counted as a conversion
//   no em or en dashes           house content rule
//   English only                 the panel content set is English
//   renders with height, images resolve, nothing overflows the root
//   fills the engine's container edge to edge at its configured width, which
//                                is also what the panel PREVIEW mockup shows
//   leaks no CSS onto the host page
//
// Supersedes deftest / injtest / npstest, which tested the removed host-page
// capture bridge.
// ============================================================================
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const DIR = path.join(REPO, 'cantu-pneus/panel-content');

// Three language sets, same structure, same CSS, same click ids. Each site needs
// its own content in the panel because a campaign is bound to one piece of
// content, so each language gets its own campaign and its own event name
// (br_survey / en_survey / ru_survey). See cantuCatalog.js.
const CANTU_LANGS = {
  en: { dir: path.join(DIR, 'en'), htmlLang: 'en',    seg: 'en/' },
  pt: { dir: path.join(DIR, 'pt'), htmlLang: 'pt-BR', seg: ''    },
  ru: { dir: path.join(DIR, 'ru'), htmlLang: 'ru',    seg: 'ru/' },
};

/* A second content set, for the FinTech site.

   NovaPay needs its own campaigns rather than sharing the unprefixed ones,
   because one campaign holds one piece of content: sharing them is why the
   eight Default Scenarios on this site showed tyre-shop creative. Its triggers
   are fintech_ prefixed.

   Only ONE set here, so the "same scenarios in every set" check below is a
   no-op for it. That is correct: there is nothing to stay in step with. */
const FINTECH_DIR = path.join(REPO, 'fintech/panel-content');
const FINTECH_SETS = {
  fintech: { dir: FINTECH_DIR, htmlLang: 'en', seg: '' },
};

/* A third content set, for the Banking site.

   Meridian needs its own campaigns for the same reason NovaPay does: one
   campaign holds one piece of content, so sharing the unprefixed ones is
   exactly why the eight Default Scenarios showed tyre-shop creative on a bank.
   Its triggers are banking_ prefixed.

   One set only, so the "same scenarios in every set" check is a no-op here,
   which is correct: there is nothing to stay in step with. */
const BANKING_DIR = path.join(REPO, 'banking/panel-content');
const BANKING_SETS = {
  banking: { dir: BANKING_DIR, htmlLang: 'en', seg: '' },
};

/* Which site this run covers, from argv[2]. Everything site-specific below
   reads from here, so the two content sets share one implementation rather
   than a forked copy of these checks. */
const SITE_KEY = ['fintech', 'banking'].includes(process.argv[2])
  ? process.argv[2] : 'cantu-pneus';
const SITE = {
  'cantu-pneus': {
    sets: CANTU_LANGS,
    rootPrefix: 'cantu',
    linkRe: /\/dengage-demos\/cantu-pneus\/(en\/|ru\/)?/g,
    linkLabel: 'cantu-pneus',
    hasAb: true,
  },
  fintech: {
    sets: FINTECH_SETS,
    rootPrefix: 'npy',
    linkRe: /\/dengage-demos\/fintech\/()?/g,
    linkLabel: 'fintech',
    hasAb: false,
  },
  banking: {
    sets: BANKING_SETS,
    rootPrefix: 'mrd',
    linkRe: /\/dengage-demos\/banking\/()?/g,
    linkLabel: 'banking',
    hasAb: false,
  },
}[SITE_KEY];

const LANGS = SITE.sets;
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// files whose CTA is a form submit rather than a link
/* Files that must carry a native data-dn-form-id root AND actually submit.
   On 2 Aug the three FinTech capture popups had the root but no
   Dn.postQuestion / Dn.postSubscription call and no confirmation panel, so a
   visitor clicked and nothing happened at all. Reported from a live demo. */
const FORM_FILES = new Set(['subscripton-popup.html', 'survey.html', 'nps-popup.html',
  // NovaPay's account-opening lead form, fintech only. Native capture is the
  // only way to get values out of a cross-origin iframe, so if this ever loses
  // its data-dn-form-id root it silently collects nothing.
  'lead-form.html']);

// Banner layout is not offered the panel's "Add close button to outside"
// setting, so these two draw their own. Every popup relies on the panel's.
const BANNER_FILES = new Set(['stickey-bar.html', 'image-bar.html',
  // NovaPay's two portal banners. Banner layout is not offered the panel's
  // "Add close button to outside" setting, so unlike the popups these must
  // draw their own close control.
  'low-balance.html', 'fx-unused.html']);

// The card must fill the engine's container exactly at these widths. The two
// bars use the Banner layout, whose container is already fixed and full width;
// 830px is roughly what the panel's preview mockup gives them.
const BOX = {
  'subscripton-popup.html': { w: 560, card: '.su-card' },
  'survey.html': { w: 560, card: '.cs-card' },
  'nps-popup.html': { w: 560, card: '.np-card' },
  'image-popup.html': { w: 560, card: '.ip-card' },
  'cta-image-popup.html': { w: 560, card: '.cp-card' },
  'horizonal-popup.html': { w: 700, card: '.hp-card' },
  'stickey-bar.html': { w: 830, card: '.cb-strip' },
  'image-bar.html': { w: 830, card: '.ib-strip' },
  // the A/B variants share one campaign, so they share one width
  'ab-testing/variant-a.html': { w: 560, card: '.aa-card' },
  'ab-testing/variant-b.html': { w: 560, card: '.ab-card' },
  'ab-testing/variant-c.html': { w: 560, card: '.ac-card' },
};

/* The Banking set, same shape. Widths match the layouts: 560 for a popup,
   700 for the horizontal one, 830 for the two banners. */
const BOX_BANKING = {
  'survey.html': { w: 560, card: '.sv-card' },
  'nps-popup.html': { w: 560, card: '.np-card' },
  'subscripton-popup.html': { w: 560, card: '.sb-card' },
  'image-popup.html': { w: 560, card: '.ip-card' },
  'cta-image-popup.html': { w: 560, card: '.cp-card' },
  'horizonal-popup.html': { w: 700, card: '.hz-card' },
  'stickey-bar.html': { w: 830, card: '.sk-bar' },
  'image-bar.html': { w: 830, card: '.ib-bar' },
};

/* The FinTech set uses its own class names, so its card selectors live here
   rather than being guessed from the CantuPneus ones. */
const BOX_FINTECH = {
  // 520 wide: wide enough for the two-up name and mobile rows without the
  // fields becoming letterbox slots on a phone.
  'lead-form.html': { w: 520, card: '.ld-card' },
  // The five portal scenarios. Three popups at the standard 560, two banners
  // at 830 like the other bars.
  'kyc-incomplete.html': { w: 560, card: '.ky-card' },
  'card-dormant.html': { w: 560, card: '.cd-card' },
  'idle-cash.html': { w: 560, card: '.ic-card' },
  'low-balance.html': { w: 830, card: '.lb-bar' },
  'fx-unused.html': { w: 830, card: '.fx-bar' },
  'survey.html': { w: 560, card: '.sv-card' },
  'nps-popup.html': { w: 560, card: '.np-card' },
  'subscripton-popup.html': { w: 560, card: '.sb-card' },
  'image-popup.html': { w: 560, card: '.ip-card' },
  'cta-image-popup.html': { w: 560, card: '.cp-card' },
  'horizonal-popup.html': { w: 700, card: '.hz-card' },
  'stickey-bar.html': { w: 830, card: '.sk-bar' },
  'image-bar.html': { w: 830, card: '.ib-bar' },
};

// The A/B engine scores on clicks only, so every variant must report its own
// button id or it can never win. Same offer across all three: only the design
// is under test, so a copy change would confound the result.
const AB_VARIANTS = {
  'ab-testing/variant-a.html': 'A',
  'ab-testing/variant-b.html': 'B',
  'ab-testing/variant-c.html': 'C',
};

// Substance every variant must state identically: the same threshold, the same
// CTA wording and the same destination. If one variant drifts, the winner is no
// longer attributable to design.
const AB_OFFER = {
  en: ['R$ 5,000', 'Claim free freight',
       '/cantu-pneus/en/index.html#products',
       'Registered businesses only. Offer runs while stock lasts.'],
  pt: ['R$ 5.000', 'Quero o frete gr\u00e1tis',
       '/cantu-pneus/index.html#products',
       'Somente para empresas com CNPJ. Oferta v\u00e1lida enquanto durar o estoque.'],
  ru: ['R$ 5 000', '\u041f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u0443\u044e \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443',
       '/cantu-pneus/ru/index.html#products',
       '\u0422\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0439. \u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442, \u043f\u043e\u043a\u0430 \u0435\u0441\u0442\u044c \u0442\u043e\u0432\u0430\u0440 \u043d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435.'],
};

// Portuguese markers, accent-independent so "Mais vendido" is caught too. The
// brand name itself is exempt.
const PT_WORDS = ['aproveitar', 'fechar', 'oferta', 'estoque', 'frete', 'gr[aá]tis',
  'pedidos', 'semana', 'consultor', 'frota[s]?\\b', 'borrachudo', 'passeio',
  'agr[ií]cola', 'c[aâ]mara', 'obrigado', 'enviar', 'pesquisa', 'inscri',
  'voc[eê]', 'entrega', 'atacado', 'vendido', 'produto[s]?\\b', 'linha'];

// English markers, to catch copy left untranslated in the Portuguese set. Same
// idea as PT_WORDS in reverse. Brand and technical tokens are exempt.
const EN_WORDS = ['\\bfreight\\b', '\\bstock\\b', '\\boffer\\b', '\\bclaim\\b',
  '\\bfleet[s]?\\b', '\\bthanks\\b', '\\bsend\\b', '\\bweek\\b', '\\bsurvey\\b',
  '\\btruck\\b', '\\bpassenger\\b', '\\bagricultural\\b', '\\bwholesale\\b',
  '\\bbestseller\\b', '\\bdelivery\\b', '\\bproduct\\b', '\\bline\\b', '\\bfree\\b'];

// Russian is the only Cyrillic set, so one script check catches a leak of it
// into either Latin-script set without needing a word list at all.
const RU_WORDS = [{ w: '[\\u0400-\\u04FF]+', label: 'Russian' }];

// Wording that belongs to the tyre business the FinTech site was forked from.
// A money app must not mention any of it, and it is the leak most likely to
// survive a copy pass because it reads as ordinary English.
const TYRE_WORDS = ['CantuPneus', 'tyres?', 'tires?', 'truck', 'trucker',
  'freight', '\\blug\\b', 'retread', 'tractor', 'forklift', '\\bOTR\\b'];

/* Only the words a visitor actually reads. The marker sweeps below must not see
   CSS, HTML comments, CSS comments, or attribute values: "line-height" is not
   the English word "line", and value="truck" on a survey checkbox is a tag value
   that stays identical in both languages on purpose, because segments are built
   on it. Scanning the raw markup produced dozens of false positives. */
function visibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

/* Every card animates in with a scale, and several use an overshoot easing
   (cubic-bezier with a control point above 1), so mid-animation the element is
   momentarily WIDER than its final size. Measuring during that window made the
   container-fit check report 561px in a 560px box, at random, depending on how
   the 350ms wait landed against a 400ms animation.

   So animations and transitions are switched off before anything is measured.
   This measures the resting state, which is the thing that actually matters. */
const NO_ANIMATION = `<style>*,*::before,*::after{
  animation:none !important; transition:none !important;
}</style>`;

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

// just the content, without the preview-only doctype and head wrapper
function bodyOf(html) {
  const m = html.match(/<body>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

// the sandbox blocks Chromium's network, so serve site assets off disk
function serveFromDisk(route) {
  const rel = new URL(route.request().url()).pathname.replace(/^\/dengage-demos\//, '');
  const file = path.join(REPO, rel);
  if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  const type = { jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' }
    [path.extname(file).slice(1)] || 'application/octet-stream';
  route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
}

(async () => {
  const files = [];
  for (const [lang, cfg] of Object.entries(LANGS)) {
    if (!fs.existsSync(cfg.dir)) { console.log('missing language set: ' + lang); process.exit(1); }
    const top = fs.readdirSync(cfg.dir).filter(f => f.endsWith('.html')).sort();
    const ab = fs.existsSync(path.join(cfg.dir, 'ab-testing'))
      ? fs.readdirSync(path.join(cfg.dir, 'ab-testing')).filter(f => f.endsWith('.html')).sort()
        .map(f => 'ab-testing/' + f)
      : [];
    for (const rel of top.concat(ab)) files.push({ lang, rel, id: lang + '/' + rel });
  }
  if (!files.length) { console.log('no panel-content files found'); process.exit(1); }

  // The two sets must stay in step: the same scenarios in both languages, or a
  // campaign in one language has no counterpart in the other.
  const byLang = {};
  files.forEach(f => { (byLang[f.lang] = byLang[f.lang] || []).push(f.rel); });
  const langKeys = Object.keys(byLang);
  const missing = langKeys.flatMap(a => langKeys.flatMap(b =>
    a === b ? [] : byLang[a].filter(r => !byLang[b].includes(r)).map(r => `${r} exists in ${a} but not ${b}`)));
  if (missing.length) {
    missing.forEach(m => console.log('FAIL  ' + m));
    console.log(`\n${missing.length} language-set mismatch(es)`);
    process.exit(1);
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  let fails = 0;

  for (const entry of files) {
    const { lang, rel } = entry;
    const f = rel;                          // keeps the per-file lookups below working
    const L = LANGS[lang];
    const raw = fs.readFileSync(path.join(L.dir, rel), 'utf8');
    const live = stripComments(raw.includes('<body>') ? raw.split('<body>')[1] : raw);
    const problems = [];

    if (/<script/i.test(live)) problems.push('contains a <script> block');
    for (const tag of live.match(/<a\b[^>]*>/gi) || []) {
      if (!/target="_top"/.test(tag)) problems.push('anchor without target="_top"');
      /* And the href must be ABSOLUTE. This content renders in an iframe served
         from pcdn.dengage.com, so a relative href resolves against THAT origin:
         href="grow.html" becomes pcdn.dengage.com/onsite-message/grow.html and
         the visitor gets an S3 NoSuchKey page. target="_top" does not save you,
         it navigates the top window to the already-wrong URL.

         Reported from a live demo on 2 Aug 2026. The eight original popups were
         absolute; the five portal ones added on 2 Aug were not, and nothing
         here checked. INLINE content is the opposite and is not scanned by this
         suite: it is cloned into the page, so relative is correct there. */
      const href = (tag.match(/href="([^"]*)"/) || [])[1];
      if (href && !/^(https?:)?\/\//.test(href) && !href.startsWith('#')) {
        problems.push(`relative href "${href}": in the iframe this resolves against pcdn.dengage.com`);
      }
    }
    if (/[–—]/.test(raw)) problems.push('contains an em or en dash');

    const clicks = [...live.matchAll(/Dn\.sendClick\('([^']+)'\)/g)].map(m => m[1]);
    if (clicks.length !== 1) problems.push(`expected 1 Dn.sendClick, found ${clicks.length}`);
    if (clicks.some(id => id.endsWith('__close'))) problems.push('close control reports a click');

    // Popups get their close control from the panel: Layout > Close Button >
    // "Add close button to outside". A second one drawn in the HTML sits inside
    // the card and reads as a duplicate, so the popups carry none. Banners are
    // not offered that setting, so they keep theirs.
    const isBanner = BANNER_FILES.has(f);
    const hasOwnClose = /onclick="Dn\.close\(\)"/.test(live);
    if (isBanner && !hasOwnClose) problems.push('banner has no close control calling Dn.close()');
    if (!isBanner && hasOwnClose) problems.push('popup draws its own close control, the panel supplies it');

    // Stripping the close control once took the visually-hidden helper with it,
    // which unstyled the NPS score radios. Any class used in the markup must
    // still have a rule.
    for (const cls of new Set([...live.matchAll(/class="([a-z]{2}-vh)"/g)].map(m => m[1]))) {
      if (!new RegExp('\\.' + cls + '\\{').test(raw)) problems.push(`.${cls} used but has no CSS rule`);
    }
    if (FORM_FILES.has(f)) {
      if (!/data-dn-form-id="(subscription|question)_form"/.test(live)) {
        problems.push('capture file without a native data-dn-form-id root');
      }
      /* A root alone captures nothing. The submit must call the engine's post
         function, and there must be a confirmation panel for it to reveal, or
         the visitor clicks and the popup just sits there. */
      if (!/Dn\.post(Question|Subscription|SubscriptionWithTags)\(\)/.test(live)) {
        problems.push('capture file never calls Dn.postQuestion/postSubscription, so it submits nothing');
      }
      if (!/class="submitted-content"/.test(live)) {
        problems.push('capture file has no .submitted-content confirmation panel');
      }
    }
    const variant = AB_VARIANTS[f];
    if (variant) {
      if (clicks[0] !== `ab-testing__${variant}`) {
        problems.push(`variant ${variant} reports "${clicks[0]}", must be ab-testing__${variant}`);
      }
      if (!new RegExp(`data-variant="${variant}"`).test(live)) {
        problems.push(`variant ${variant} root missing data-variant="${variant}"`);
      }
      // per language: the three variants of a language must state the same
      // offer, since only the design is under test within a campaign
      const missingOffer = AB_OFFER[lang].filter(t => !live.includes(t));
      if (missingOffer.length) {
        problems.push('variant copy drifted from the shared offer ('
          + missingOffer.join(' | ') + '), the test would be confounded');
      }
    }
    // the document must declare the language it is written in
    const declared = (raw.match(/<html lang="([^"]+)"/) || [])[1];
    if (declared !== L.htmlLang) {
      problems.push(`declares lang="${declared}", expected "${L.htmlLang}"`);
    }

    // and its links must point at the site that speaks that language
    for (const m of live.matchAll(SITE.linkRe)) {
      const seg = m[1] || '';
      if (seg !== L.seg) {
        problems.push(`links to /${SITE.linkLabel}/${seg} from ${lang} content, `
          + `expected /${SITE.linkLabel}/${L.seg}`);
        break;
      }
    }

    // untranslated copy: each language is checked against every other language's
    // markers, so a leak in any direction is caught. Russian is Cyrillic, so a
    // single script check covers it in both directions.
    const OTHERS = {
      en: [...PT_WORDS.map(w => ({ w, label: 'Portuguese' })), ...RU_WORDS],
      pt: [...EN_WORDS.map(w => ({ w, label: 'English' })), ...RU_WORDS],
      ru: [...PT_WORDS.map(w => ({ w, label: 'Portuguese' })),
           ...EN_WORDS.map(w => ({ w, label: 'English' }))],
      /* English content for a money app: no Portuguese, no Russian, and no
         wording belonging to the tyre business it was forked from. */
      fintech: [...PT_WORDS.map(w => ({ w, label: 'Portuguese' })), ...RU_WORDS,
                ...TYRE_WORDS.map(w => ({ w, label: 'tyre trade' }))],
      /* English content for a UK bank: no Portuguese, no Russian, none of the
         tyre wording it was forked from, and no NovaPay, since the two finance
         sets are easy to cross-contaminate by copy-paste. */
      banking: [...PT_WORDS.map(w => ({ w, label: 'Portuguese' })), ...RU_WORDS,
                ...TYRE_WORDS.map(w => ({ w, label: 'tyre trade' })),
                { w: 'NovaPay', label: 'fintech brand' }],
    };
    const markers = OTHERS[lang];
    const readable = visibleText(live);
    for (const { w, label } of markers) {
      const re = new RegExp('(?<![\\w-])' + w, 'gi');
      for (const m of readable.matchAll(re)) {
        const ctx = readable.slice(Math.max(0, m.index - 30), m.index + 30);
        if (/CantuPneus|cantu-pneus/.test(ctx)) continue;
        problems.push(`${label} "${m[0]}" in ...${ctx}...`);
      }
    }

    // visual pass
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('about:blank');
    await page.route('**/dengage-demos/**', serveFromDisk);
    await page.setContent(raw + NO_ANIMATION, { waitUntil: 'load' });
    await page.waitForTimeout(350);
    const view = await page.evaluate((rootPrefix) => {
      const root = document.querySelector(
        'body > div[id^="' + rootPrefix + '"], body > form[id^="' + rootPrefix + '"]');
      if (!root) return { err: 'no scoped root element (#' + rootPrefix + '-*) directly under body' };
      const rb = root.getBoundingClientRect();
      return {
        w: Math.round(rb.width), h: Math.round(rb.height),
        broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.src),
        overflow: [...root.querySelectorAll('*')].filter(e => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > rb.right + 2 || b.left < rb.left - 2);
        }).length,
      };
    }, SITE.rootPrefix);
    await page.close();

    if (view.err) problems.push(view.err);
    else {
      if (view.h < 30) problems.push(`rendered only ${view.h}px tall`);
      view.broken.forEach(s => problems.push('broken image ' + s));
      if (view.overflow) problems.push(`${view.overflow} element(s) overflow the root`);
    }

    // container fit and CSS containment: drop the content into a fixed-width
    // box on a host page, the way the engine's container holds it
    const box = ({ fintech: BOX_FINTECH, banking: BOX_BANKING }[SITE_KEY] || BOX)[f];
    if (box) {
      const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await host.route('**/dengage-demos/**', serveFromDisk);
      await host.setContent(
        '<style>body{margin:0;background:rgb(240,240,240);font-size:16px}</style>'
        + NO_ANIMATION
        + `<div id="host-box" style="width:${box.w}px">${bodyOf(raw)}</div>`,
        { waitUntil: 'load' });
      await host.waitForTimeout(350);
      const fit = await host.evaluate(sel => {
        const b = document.getElementById('host-box');
        const card = document.querySelector(sel);
        return {
          box: Math.round(b.getBoundingClientRect().width),
          card: card ? Math.round(card.getBoundingClientRect().width) : null,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          bodyFont: getComputedStyle(document.body).fontSize,
        };
      }, box.card);
      await host.close();
      if (fit.card === null) problems.push(`card ${box.card} not found in the container`);
      else if (fit.card !== fit.box) {
        problems.push(`card is ${fit.card}px in a ${fit.box}px container, must fill it`);
      }
      if (fit.bodyBg !== 'rgb(240, 240, 240)') problems.push('CSS leaked onto the host body background');
      if (fit.bodyFont !== '16px') problems.push('CSS leaked onto the host body font size');
    }

    if (problems.length) fails++;
    const size = view.err ? '' : `${view.w}x${view.h}`;
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${entry.id.padEnd(30)} ${size.padEnd(10)} click=${clicks[0] || 'none'}`);
    [...new Set(problems)].forEach(p => console.log('      - ' + p));
  }

  await browser.close();
  console.log(fails ? `\n${fails} file(s) failed` : `\nall ${files.length} panel-content files clean`);
  process.exit(fails ? 1 : 0);
})();
