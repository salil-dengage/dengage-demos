const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();
const fs = require('fs');

const BASE = CFG.home;
const OUT = process.env.OUT_DIR || '/tmp/dengage-verify';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Every widget's expected root element, so "did it render" is a real check
// rather than a guess from body-child count.
const EXPECT = {
  'mega-banner':      ['#sliderBanner', '.banner-slider', '.swiper', '[class*=slider-banner]'],
  'expand-banner':    ['#max-bar-container', '#min-bar-container'],
  'head-banner':      ['#' + CFG.ns + '-head-banner'],
  'notification-icon':['#dng-notification-container', '.dng-bell'],
  'side-bar':         ['#earing-widget'],
  'bottom-assistant': ['#bottom-assistant'],
  'carousel-banner':  ['#' + CFG.ns + '-carousel-inapp-container'],
  'spin-to-win':      ['#dng-cjs-game-form'],
  'scratch-to-win':   ['#dengage-overlay', '#dengage-modal'],
  'santa-deer':       ['#dngCjs-startDiv'],
  'like-card':        ['#dng_cjs_likecard_container', '.tinder'],
  // snowstorm appends 16x18 flake <img> straight onto <html>, not <body>
  'snow':             ['img[src*=snowflake]'],
  'classic-widget':   ['#classicWidget'],
  'banner-widget':    ['#bannerWidget'],
  'tab-widget':       ['#tabWidget'],
  'sidebar-widget':   ['#mostViewedWidget'],
  'popup-widget':     ['#popupWidget', '[id*=popup-widget]', '[class*=popup-widget]'],
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });

  // External hosts are unreachable from this sandbox; fulfil them empty so the
  // run is deterministic and document.fonts.ready still resolves.
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(CFG.root)) return r.continue();
    return r.fulfill({ status: 200, body: '' });
  });

  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const groups = await page.evaluate((BTN) => {
    const modal = document.getElementById('sticky-modal');
    const wrappers = [...modal.querySelectorAll(':scope > div:last-child > div')];
    return wrappers.map((w, gi) => ({
      gi,
      title: w.querySelector('span span span').childNodes[0].textContent.trim(),
      items: [...w.querySelectorAll('button')].filter(b => b.textContent === BTN).map((b, ri) => ({
        ri,
        label: b.parentElement.querySelector('span span').textContent.trim(),
        /* A panel scenario's caption reads "event: <name>"; a local widget's
           is the bare slug. That prefix is the language-independent way to
           tell them apart. Comparing the GROUP TITLE to 'Default Scenarios'
           does not work: the pt-BR site's title is Portuguese, so every
           CantuPneus panel scenario was being judged as a local widget. */
        isPanel: /^event:\s/.test(b.parentElement.querySelector('small').textContent),
        slug: b.parentElement.querySelector('small').textContent.replace('event: ', '').trim(),
      })),
    }));
  }, CFG.launcherButton);
  await page.close();

  const results = [];
  for (const g of groups) {
    for (const it of g.items) {
      const logs = [];
      const p = await ctx.newPage();
      p.on('console', m => { if (m.type() === 'error') logs.push('CONSOLE: ' + m.text()); });
      p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
      p.on('requestfailed', r => { if (r.url().startsWith(CFG.root)) logs.push('REQFAIL: ' + r.url()); });
      p.on('response', r => { if (r.url().startsWith(CFG.root) && r.status() >= 400) logs.push(`HTTP${r.status()}: ${r.url()}`); });

      await p.goto(BASE, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1500);

      await p.evaluate(() => document.getElementById('sticky-icon').click());
      await p.waitForTimeout(400);
      await p.evaluate(({ gi }) => {
        const w = [...document.getElementById('sticky-modal').querySelectorAll(':scope > div:last-child > div')][gi];
        w.querySelector('div[role="button"]').click();
      }, { gi: g.gi });
      await p.waitForTimeout(400);
      /* Some widgets push their own event when they open (asistant.js pushes
         event:'dengage' on open), so "the last entry" is not the launcher's.
         Mark where the dataLayer was before the click and only look after it. */
      const dlBefore = await p.evaluate(() => (window.dataLayer || []).length);

      await p.evaluate(({ gi, ri, BTN }) => {
        const w = [...document.getElementById('sticky-modal').querySelectorAll(':scope > div:last-child > div')][gi];
        [...w.querySelectorAll('button')].filter(b => b.textContent === BTN)[ri].click();
      }, { gi: g.gi, ri: it.ri, BTN: CFG.launcherButton });

      /* A fixed sleep here made this suite flaky: run.sh drives three sites
         at once, and under that load a widget can take longer than 2800ms to
         paint. cantu-pneus-en's popup-widget failed a push that way on 2 Aug,
         with zero console errors, and passed on every isolated re-run.

         So: poll for the widget instead of guessing how long it needs. Same
         assertion, same selectors, same visibility test; it just stops
         depending on how busy the machine is. The 2800ms floor is kept as the
         CEILING for a widget that genuinely never renders, plus headroom. */
      const sel = EXPECT[it.slug];
      if (sel) {
        const deadline = Date.now() + 9000;
        while (Date.now() < deadline) {
          const up = await p.evaluate(sels => sels.some(x => {
            let els = [];
            try { els = [...document.querySelectorAll(x)]; } catch (e) { return false; }
            return els.some(el => {
              const r = el.getBoundingClientRect();
              const st = getComputedStyle(el);
              return r.width > 8 && r.height > 8 && st.display !== 'none'
                  && st.visibility !== 'hidden' && +st.opacity > 0.05;
            });
          }), sel).catch(() => false);
          if (up) break;
          await p.waitForTimeout(250);
        }
      } else {
        await p.waitForTimeout(2800);   // panel-driven: nothing local to wait for
      }

      const rendered = sel ? await p.evaluate((sels) => {
        for (const s of sels) {
          let els = [];
          try { els = [...document.querySelectorAll(s)]; } catch (e) { continue; }
          for (const el of els) {
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            if (r.width > 8 && r.height > 8 && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.05) {
              return { sel: s, w: Math.round(r.width), h: Math.round(r.height) };
            }
          }
        }
        return null;
      }, sel) : 'panel-driven';

      const added = await p.evaluate(n => (window.dataLayer || []).slice(n)
        .filter(d => d && d.actionType), dlBefore);

      /* The event NAME, not just that some event went out. A campaign only
         fires when the pushed name matches its trigger exactly, so a launcher
         pushing the unprefixed slug leaves every panel scenario silently dark
         while this suite still reported dl=yes. That is what happened to
         FinTech's eight Default Scenarios when the prefix was flipped on.

         Default Scenarios use scenarioPrefix; the local widgets use
         eventPrefix. Both come from sites.js so no site's value is duplicated
         here. */
      const isPanel = it.isPanel;
      /* it.slug is read off the drawer caption, so for a panel scenario it is
         the event name the launcher CLAIMS it will push. Two things must hold,
         and only the second one catches the prefix bug:
           1. the push matches the claim, so the drawer does not send a
              presenter looking for the wrong campaign in the panel;
           2. the claim carries this site's configured scenarioPrefix. */
      /* Local widgets do not all name their event the same way. The three
         CantuPneus sites push a literal event:'dengage' with the slug in
         actionType; Banking and FinTech push <prefix><slug>. Read it from
         sites.js rather than assuming, or a correct site reads as broken. */
      const wantEvent = isPanel
        ? it.slug
        : (CFG.localWidgetEvent || (CFG.eventPrefix || '') + it.slug);
      const prefixOk = !isPanel || it.slug.indexOf(CFG.scenarioPrefix || '') === 0;
      const dl = added.find(d => d.event === wantEvent) || added[0] || null;
      /* When the event name is a constant, the slug has to be carried
         somewhere or the push identifies nothing. It is in actionType. */
      const named = CFG.localWidgetEvent && !isPanel
        ? added.some(d => d.event === wantEvent && d.actionType === it.slug)
        : added.some(d => d.event === wantEvent);
      const dlOk = named && prefixOk;
      if (!named) {
        logs.push(`DATALAYER_NAME expected "${wantEvent}"` +
          (CFG.localWidgetEvent && !isPanel ? ` with actionType "${it.slug}"` : '') +
          `, got ${JSON.stringify(added.map(d => d.event + '/' + (d.actionType || '')))}`);
      } else if (!prefixOk) {
        logs.push(`DATALAYER_PREFIX "${it.slug}" is missing this site's scenarioPrefix "${CFG.scenarioPrefix}"`);
      }

      await p.screenshot({ path: `${OUT}/${g.gi}${it.ri}-${it.slug}.png`, timeout: 12000 }).catch(() => logs.push('SHOT_TIMEOUT'));

      results.push({ group: g.title, label: it.label, slug: it.slug, dataLayer: dl,
                     dlExpected: wantEvent, dlOk, rendered, errors: logs });
      const mark = rendered === 'panel-driven' ? 'panel' : (rendered ? `OK ${rendered.sel} ${rendered.w}x${rendered.h}` : 'NOT RENDERED');
      console.log(`${it.slug.padEnd(19)} ${String(mark).padEnd(46)} dl=${dlOk ? wantEvent : 'WRONG'} errs=${logs.length}${logs.length ? ' | ' + logs[0].slice(0, 90) : ''}`);
      await p.close();
    }
  }

  fs.writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 2));
  await browser.close();

  const broken = results.filter(r => r.rendered !== 'panel-driven' && !r.rendered);
  const misnamed = results.filter(r => !r.dlOk);
  console.log(`\n=== ${results.length - broken.length}/${results.length} accounted for; ${broken.length} not rendered ===`);
  broken.forEach(b => console.log('  BROKEN:', b.slug, JSON.stringify(b.errors.slice(0, 2))));
  misnamed.forEach(m => console.log(`  WRONG EVENT NAME: ${m.slug} expected "${m.dlExpected}", got "${m.dataLayer ? m.dataLayer.event : 'nothing'}"`));
  if (broken.length || misnamed.length) process.exit(1);
})();
