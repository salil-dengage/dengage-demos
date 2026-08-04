// ============================================================================
// formtest: runs Dengage's REAL On-Site form handler against the three
// data-capturing panel-content files and asserts what would reach Dengage.
//
//   node tools/verify/formtest.js
//
// The engine renders On-Site content inside a cross-origin iframe, so nothing
// on the host page can observe a submit in there. The only supported capture
// path is the native form: content that carries data-dn-form-id gets the
// engine's form-handler.js injected and window.Dn exposed inside the frame.
// This suite drives that handler directly, so the contract is verified against
// the actual implementation rather than against our reading of it.
//
// Per file it checks:
//   1. an empty submit is rejected and the engine's validation text is visible
//   2. a valid submit produces the right payload (contact fields, or tags)
//   3. exactly one click is reported, so CTR is not inflated by dismissals
//   4. the engine's success reply swaps the form for the confirmation panel
//
// The handler source is vendored in fixtures/ so this runs offline. See
// fixtures/README.md to refresh it.
// ============================================================================
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const DIR = path.join(REPO, 'cantu-pneus/panel-content');

/* Both language sets are exercised. The Portuguese and English versions of a
   capture widget must produce the SAME payload: the selectors, the data-dn-id
   values, the tag names and the tag values are all identical by design, because
   a segment built on tyre_line_interest or nps_score has to work regardless of
   which language the visitor saw. Only the words on screen differ. */
const LANGS = ['en', 'pt'];
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// unwrap __dn_onsite_form_handler_js__(`...`) into runnable source
function loadHandler() {
  const wrapped = fs.readFileSync(path.join(__dirname, 'fixtures/form-handler.js'), 'utf8');
  const inner = wrapped.replace(/^__dn_onsite_form_handler_js__\(`/, '').replace(/`\)\s*$/, '');
  return inner.replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
}

const CASES = [
  {
    file: 'subscripton-popup.html',
    submit: '.su-send',
    call: 'Dn.postSubscription()',
    reply: 'success',
    expectClick: 'subscripton-popup__subscribe',
    fill: async p => p.fill('input[data-dn-id="email"]', 'fleet.buyer@example.com'),
    // a subscription creates a contact, so the payload is the form object
    checkPayload: c => c[0] === 'postMessageToParent'
      && c[2] && c[2].form && c[2].form.email
      && c[2].form.emailPermission === true && c[2].form.gsmPermission === true,
  },
  {
    file: 'survey.html',
    submit: '.cs-send',
    call: 'Dn.postQuestion()',
    reply: 'tagsSuccess',
    expectClick: 'survey__submit',
    fill: async p => { await p.click('label[for="cs-c1"]'); await p.click('label[for="cs-c3"]'); },
    // a question form writes contact tags, one per selected answer
    checkPayload: c => c[0] === 'setTags' && c[1].length === 2
      && c[1].every(t => t.tag === 'tyre_line_interest'),
  },
  {
    file: 'nps-popup.html',
    submit: '.np-send',
    call: 'Dn.postQuestion()',
    reply: 'tagsSuccess',
    expectClick: 'nps-popup__submit',
    fill: async p => p.click('label[for="np-s9"]'),
    checkPayload: c => c[0] === 'setTags' && c[1].length === 1
      && c[1][0].tag === 'nps_score' && c[1][0].value === '9',
  },
];

/* NovaPay's account-opening lead form. It is the only capture file outside
   CantuPneus, and it exercises fields the three above never do: name, surname,
   GSM and DATEPICKER. Those keys are NOT proven anywhere else in this repo, so
   this case is the only thing standing between a plausible-looking form and one
   that silently collects an email and nothing else. */
const FINTECH_CASES = [
  {
    dir: path.join(REPO, 'fintech/panel-content'),
    lang: 'fintech',
    file: 'survey.html',
    submit: '.sv-submit',
    call: 'Dn.postQuestion()',
    reply: 'tagsSuccess',
    expectClick: 'fintech_survey__submit',
    fill: async p => p.click('label[for="npy-sv-2"]'),
    checkPayload: c => c[0] === 'setTags' && c[1].length === 1
      && c[1][0].tag === 'fintech_signup_reason' && c[1][0].value === 'saving',
  },
  {
    dir: path.join(REPO, 'fintech/panel-content'),
    lang: 'fintech',
    file: 'nps-popup.html',
    submit: '.np-submit',
    call: 'Dn.postQuestion()',
    reply: 'tagsSuccess',
    expectClick: 'fintech_nps-popup__submit',
    fill: async p => p.click('label[for="npy-np-9"]'),
    checkPayload: c => c[0] === 'setTags' && c[1].length === 1
      && c[1][0].tag === 'nps_score' && c[1][0].value === '9',
  },
  {
    dir: path.join(REPO, 'fintech/panel-content'),
    lang: 'fintech',
    file: 'subscripton-popup.html',
    submit: '.sb-submit',
    call: 'Dn.postSubscription()',
    reply: 'success',
    expectClick: 'fintech_subscripton-popup__subscribe',
    fill: async p => {
      await p.fill('input[data-dn-id="email"]', 'rates@example.com');
      await p.check('input[data-dn-id="mergedPermission"]');
    },
    checkPayload: c => c[0] === 'postMessageToParent'
      && c[2] && c[2].form && c[2].form.email === 'rates@example.com'
      && c[2].form.emailPermission === true && c[2].form.gsmPermission === true,
  },
  {
    dir: path.join(REPO, 'fintech/panel-content'),
    lang: 'fintech',
    file: 'lead-form.html',
    submit: '.ld-submit',
    call: 'Dn.postSubscription()',
    reply: 'success',
    expectClick: 'fintech_open-account__submit',
    fill: async p => {
      await p.fill('input[data-dn-id="name"]', 'Alex');
      await p.fill('input[data-dn-id="surname"]', 'Morgan');
      await p.fill('input[data-dn-id="email"]', 'alex.morgan@example.com');
      await p.fill('input[data-dn-id="gsm"]', '7700900000');
      await p.fill('input[data-dn-id="birthdate"]', '1990-04-12');
      await p.check('input[data-dn-id="mergedPermission"]');
    },
    checkPayload: c => c[0] === 'postMessageToParent'
      && c[2] && c[2].form
      && c[2].form.email === 'alex.morgan@example.com'
      && c[2].form.emailPermission === true && c[2].form.gsmPermission === true,
  },
];

(async () => {
  const HANDLER = loadHandler();
  const browser = await chromium.launch({ executablePath: CHROME });
  let fails = 0;

  const ALL = LANGS
    .flatMap(lang => CASES.map(c => ({ ...c, lang, dir: path.join(DIR, lang) })))
    .concat(FINTECH_CASES);

  for (const langCase of ALL) {
    const c = langCase;
    const page = await browser.newPage();
    await page.goto('about:blank');
    // the sandbox blocks Chromium's network, so serve site assets off disk
    await page.route('**/dengage-demos/**', route => {
      const rel = new URL(route.request().url()).pathname.replace(/^\/dengage-demos\//, '');
      const file = path.join(REPO, rel);
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const type = { jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' }
        [path.extname(file).slice(1)] || 'application/octet-stream';
      route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
    });
    await page.setContent(fs.readFileSync(path.join(c.dir, c.file), 'utf8'), { waitUntil: 'load' });

    // stand in for the engine's shared.js: record what the content asks for
    await page.evaluate(() => {
      window.__calls = [];
      window.Dn = {
        updateHeight: () => {},
        close: () => window.__calls.push(['close']),
        sendClick: id => window.__calls.push(['sendClick', id]),
        setTags: t => window.__calls.push(['setTags', t]),
        postMessageToParent: (a, d) => window.__calls.push(['postMessageToParent', a, d]),
      };
    });
    await page.evaluate(HANDLER);

    // 1. empty submit
    await page.evaluate(call => eval(call), c.call);
    const emptyBlocked = (await page.evaluate(() => window.__calls)).length === 0;
    const messages = await page.evaluate(() =>
      [...document.querySelectorAll('.form-message,[data-dn-invalid-message-type]')]
        .filter(e => getComputedStyle(e).display !== 'none' && e.innerText.trim())
        .map(e => e.innerText.trim()));

    // 2 and 3. valid submit
    await c.fill(page);
    await page.click(c.submit);
    const calls = await page.evaluate(() => window.__calls);
    const clicks = calls.filter(x => x[0] === 'sendClick').map(x => x[1]);
    const payload = calls.find(x => x[0] === 'setTags' || x[0] === 'postMessageToParent');

    // 4. the engine's success reply
    await page.evaluate(s => window.postMessage({ action: 'closeForm', status: s }, '*'), c.reply);
    await page.waitForTimeout(250);
    const view = await page.evaluate(() => {
      const box = document.querySelector('.container');
      const thanks = document.querySelector('.submitted-content');
      return {
        stamped: !!box && box.dataset.dnIsSubmitted === 'true',
        thanksVisible: !!thanks && getComputedStyle(thanks).display !== 'none',
        formHidden: [...document.querySelectorAll('.su-body,.cs-body,.np-body,.ld-live,.sv-body,.sb-body')]
          .every(e => getComputedStyle(e).display === 'none'),
      };
    });

    const problems = [];
    if (!emptyBlocked) problems.push('empty submit was accepted');
    if (!messages.length) problems.push('no validation message shown on empty submit');
    if (!payload) problems.push('valid submit sent nothing');
    else if (!c.checkPayload(payload)) problems.push('unexpected payload ' + JSON.stringify(payload));
    if (clicks.length !== 1) problems.push('expected 1 click, got ' + JSON.stringify(clicks));
    else if (clicks[0] !== c.expectClick) problems.push('click id is ' + clicks[0]);
    if (!view.stamped) problems.push('container not stamped data-dn-is-submitted');
    if (!view.thanksVisible) problems.push('confirmation panel stayed hidden');
    if (!view.formHidden) problems.push('form stayed visible after submit');

    if (problems.length) fails++;
    console.log(`${problems.length ? "FAIL" : "PASS"}  ${c.lang}/${c.file}`);
    console.log(`      validation : ${JSON.stringify(messages)}`);
    console.log(`      click      : ${JSON.stringify(clicks)}`);
    console.log(`      payload    : ${JSON.stringify(payload)}`);
    problems.forEach(p => console.log('      - ' + p));
    await page.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} form(s) failed` : '\nall native form contracts satisfied');
  process.exit(fails ? 1 : 0);
})();
