const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const { site, offlineRoute, stubDengage } = require('./sites');
const CFG = site();
const fail = [];
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail.push(m); };

// buttons in the same visual row must share the same bottom edge
async function checkRow(p, containerSel, btnSel, label) {
  const data = await p.evaluate(({ containerSel, btnSel }) => {
    const c = document.querySelector(containerSel);
    if (!c) return null;
    // only buttons whose CARD sits on the first visual row (same top)
    const all = [...c.querySelectorAll(btnSel)].filter(b => b.getBoundingClientRect().width > 0);
    const cardOf = b => b.closest('.product-card,.reco-product-card,.popup-card') || b;
    const firstTop = all.length ? Math.round(cardOf(all[0]).getBoundingClientRect().top) : 0;
    const btns = all
      .filter(b => Math.abs(Math.round(cardOf(b).getBoundingClientRect().top) - firstTop) <= 2)
      .slice(0, 5)
      .map(b => Math.round(b.getBoundingClientRect().bottom));
    /* Same first-row filter the button check above uses. Without it this
       compared a card on row 1 against one on row 2, which are legitimately
       different heights once cards carry variable content. The check is
       "cards in the row", so it has to be one row. */
    const allCards = [...c.querySelectorAll('.product-card,.reco-product-card,.popup-card')]
      .filter(el => el.getBoundingClientRect().width > 0);
    const cardTop = allCards.length ? Math.round(allCards[0].getBoundingClientRect().top) : 0;
    const cards = allCards
      .filter(el => Math.abs(Math.round(el.getBoundingClientRect().top) - cardTop) <= 2)
      .slice(0, 5)
      .map(el => Math.round(el.getBoundingClientRect().height));
    return { btns, cards };
  }, { containerSel, btnSel });
  if (!data || !data.btns.length) { ok(false, label + ': widget/buttons not found'); return; }
  const sameB = data.btns.every(v => Math.abs(v - data.btns[0]) <= 1);
  const sameH = data.cards.every(v => Math.abs(v - data.cards[0]) <= 1);
  ok(sameB, label + ': cart buttons share one bottom line ' + JSON.stringify(data.btns));
  ok(sameH, label + ': cards in the row have equal heights ' + JSON.stringify(data.cards));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => r.request().url().startsWith(CFG.root) ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  await p.goto(CFG.home, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  // 1) mega banner: NOT present on load, appears on demand, then scrolls
  ok(!(await p.$('#' + CFG.ns + '-highlights-slider')), 'mega banner absent on page load');
  await p.evaluate(() => window.showSliderBanner());
  await p.waitForTimeout(1200);
  ok(await p.$('#' + CFG.ns + '-highlights-slider'), 'mega banner inserted after the button call');
  ok(await p.$eval('#' + CFG.ns + '-highlights-slider .banner-slide img', i => i.complete && i.naturalWidth > 0), 'mega banner slide image renders');

  // 2) site product grid alignment
  //    Sites differ here, and both cases are real. FinTech has no shoppable
  //    grid at all, so there is no row to align. Banking HAS a grid but its
  //    card control is a shortlist button, not a cart button, so hard-coding
  //    '.product-card-cart-btn' would report a missing widget on a site whose
  //    grid is present and correct.
  //
  //    So: take the selector from sites.js, and skip only when the button is
  //    genuinely absent from the page. That covers both without a flag.
  const cardBtn = CFG.hooks.cardButton;
  if (!(await p.$('#productGrid ' + cardBtn))) {
    console.log('  SKIP  site product grid: ' + CFG.key + ' has no card action button');
  } else {
    await checkRow(p, '#productGrid', cardBtn, 'site grid (' + CFG.gridLabel + ')');
  }

  // 3) classic widget (reco-product-card slider)
  await p.evaluate(() => { try { ClassicWidget(); } catch (e) { console.log(e); } });
  await p.waitForTimeout(1500);
  await checkRow(p, '#classicWidget', '.reco-product-cart-btn', 'classic reco widget');

  // 4) popup widget
  await p.evaluate(() => { try { PopupWidget(); } catch (e) { console.log(e); } });
  await p.waitForTimeout(1500);
  if (await p.$('#popupWidget')) await checkRow(p, '#popupWidget', '.popup-card-cart', 'popup reco widget');

  await p.screenshot({ path: 'align-home.png' });

  // 5) product page: similar products slider
  const p2 = await ctx.newPage();
  await p2.goto(CFG.product, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2500);
  const simSel = await p2.evaluate(() => {
    const el = document.querySelector('.reco-product-card');
    if (!el) return null;
    let n = el; while (n && n !== document.body && !n.id) n = n.parentElement;
    return n && n.id ? '#' + n.id : 'body';
  });
  if (simSel) await checkRow(p2, simSel, '.reco-product-cart-btn', 'similar products slider');
  else ok(false, 'similar products widget not found');
  const simShot = await p2.$('.reco-product-card');
  if (simShot) await p2.screenshot({ path: 'align-similar.png' });

  await b.close();
  console.log('\n================  ' + (fail.length ? fail.length + ' FAILURES' : 'ALL CHECKS PASSED') + '  ================');
  process.exit(fail.length ? 1 : 0);
})();
