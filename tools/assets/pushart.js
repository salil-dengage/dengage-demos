/* ============================================================================
   NovaPay push artwork

       node tools/assets/pushart.js

   Renders the notification images to fintech/images/push/ and commits them as
   PNG.

   WHY PNG HERE WHEN THE REST OF THIS REPOSITORY IS SVG. A notification image is
   decoded by BitmapFactory, which reads PNG, JPEG and WebP and does not read
   SVG. An SVG mediaUrl fails silently: the push arrives, the expanded view is
   blank, and nothing in the logs says why. In-App content is the opposite case,
   because it is drawn by a WebView, which is why fintech/images/inapp/ is SVG.

   WHY 1024x512. BigPictureStyle carries one image and Android downsamples it,
   so this is comfortable. Carousel artwork is the size that has to be watched:
   a notification's RemoteViews crosses a Binder transaction capped at roughly
   1MB and a carousel decodes three bitmaps into one, so those stay at 200x200.
   NovaPay's carousel is drawn by the app from local vector drawables and needs
   no bitmaps at all, which is why none are generated here.

   The source is SVG, drawn below and rendered through the Chromium that is
   already installed for the verification suites, so re-running this reproduces
   the files byte for byte from the same input rather than from a design tool
   nobody else has.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'fintech/images/push');
const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const W = 1024, H = 512;

/* NovaPay's palette, from the website's stylesheet. */
const BLUE = '#125cfa', DEEP = '#0a3a9e', NIGHT = '#050f2e', MINT = '#7ef0bd';

/* Every gradient id is prefixed per scene. Several of these end up inlined in
   one document while checking them side by side, and unprefixed ids all
   resolve to the first definition, which this repository has paid for once. */
const scene = ({ slug, eyebrow, title, sub, art }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
 <defs>
  <linearGradient id="${slug}-bg" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="${NIGHT}"/><stop offset="0.55" stop-color="${DEEP}"/><stop offset="1" stop-color="${BLUE}"/>
  </linearGradient>
 </defs>
 <rect width="${W}" height="${H}" fill="url(#${slug}-bg)"/>
 <g fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="3">
  <circle cx="900" cy="86" r="170"/><circle cx="900" cy="86" r="260"/>
 </g>
 ${art}
 <g transform="translate(68,74)">
  <rect width="64" height="64" rx="18" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-opacity="0.3" stroke-width="2"/>
  <text x="32" y="44" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">N</text>
 </g>
 <text x="68" y="238" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="6" fill="${MINT}">${eyebrow}</text>
 <text x="68" y="316" font-family="Inter, Helvetica, Arial, sans-serif" font-size="58" font-weight="700" fill="#ffffff">${title}</text>
 <text x="68" y="372" font-family="Inter, Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.74">${sub}</text>
 <text x="68" y="458" font-family="Inter, Helvetica, Arial, sans-serif" font-size="19" fill="#ffffff" fill-opacity="0.5">NovaPay is a fictional brand used for demonstration.</text>
</svg>`;

/* A month of balance with the last column rising. Deliberately unlabelled: the
   shape is the point, and a figure on a column would be an invented one. */
const bars = `
 <g transform="translate(720,150)">
  <rect x="0"   y="132" width="38" height="78"  rx="9" fill="#ffffff" fill-opacity="0.2"/>
  <rect x="56"  y="104" width="38" height="106" rx="9" fill="#ffffff" fill-opacity="0.2"/>
  <rect x="112" y="150" width="38" height="60"  rx="9" fill="#ffffff" fill-opacity="0.2"/>
  <rect x="168" y="82"  width="38" height="128" rx="9" fill="#ffffff" fill-opacity="0.2"/>
  <rect x="224" y="0"   width="38" height="210" rx="9" fill="${MINT}" fill-opacity="0.85"/>
 </g>`;

const globe = `
 <g fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3" transform="translate(824,262)">
  <circle r="118"/><ellipse rx="118" ry="47"/><ellipse rx="59" ry="118"/><path d="M-118 0 H118"/>
 </g>`;

const card = `
 <g transform="translate(700,178) rotate(-8)">
  <rect width="270" height="170" rx="20" fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.32" stroke-width="2"/>
  <rect x="22" y="26" width="40" height="30" rx="6" fill="#f3dfa6"/>
  <g stroke="#8a6a22" stroke-width="1.6" opacity="0.6"><path d="M22 36 H62 M22 46 H62 M35 26 V56 M49 26 V56"/></g>
  <text x="22" y="120" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">NovaPay Plus</text>
  <text x="22" y="148" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#ffffff" fill-opacity="0.7">Everything in one plan</text>
 </g>`;

const SCENES = [
  {
    file: 'payday.png',
    slug: 'pd',
    eyebrow: 'PAY DAY',
    title: 'Your pay has landed',
    sub: 'Move some of it before the month does it for you.',
    art: bars,
  },
  {
    file: 'travel.png',
    slug: 'tv',
    eyebrow: 'TRAVEL PLAN',
    title: 'Spend abroad with no markup',
    sub: 'Every conversion at the real rate, fee shown before you confirm.',
    art: globe,
  },
  {
    file: 'plan.png',
    slug: 'pl',
    eyebrow: 'NOVAPAY PLUS',
    title: 'Everything in one plan',
    sub: 'One monthly fee, and the extras stop arriving one at a time.',
    art: card,
  },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });

  for (const s of SCENES) {
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:${NIGHT};}
       svg{display:block;}</style>${scene(s)}`,
      { waitUntil: 'load' }
    );
    const file = path.join(OUT, s.file);
    await page.screenshot({ path: file, type: 'png' });
    console.log('wrote', path.relative(REPO, file));
  }

  await browser.close();
})();
