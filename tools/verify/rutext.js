// ============================================================================
// rutext: the quality of the Russian itself.
//
//   node tools/verify/rutext.js
//
// ptsweep and paneltest answer "is there English or Portuguese on the Russian
// site". Neither can answer "is the Russian any good", and a Russian-speaking
// prospect notices the difference immediately. The faults worth catching here
// are not the same ones Portuguese has, so this is not pttext with a different
// word list.
//
//   1. MIXED SCRIPT. Cyrillic а е о с р х у А В С Е Н К М О Р Т Х are visually
//      identical to Latin a e o c p x y A B C E H K M O P T X. A word that
//      mixes the two renders perfectly and is still broken: it fails search,
//      breaks copy and paste, and reads as gibberish to a screen reader. This
//      is the single most common way Russian copy goes wrong when it is
//      produced by editing English text in place, which is exactly how this
//      site was built.
//   2. MOJIBAKE. A file saved as cp1251 and served as UTF-8 turns Cyrillic
//      into "Ð¨Ð¸Ð½Ñ‹". Renders as garbage, passes every other check.
//   3. INCONSISTENT Ё. Russian tolerates ё being written as е, but not both
//      spellings of the same word in the same product. Mixed usage looks
//      careless.
//   4. STRAIGHT QUOTES. Russian typography uses guillemets, «ёлочка», not
//      "ёлочка". A straight double quote around Cyrillic is a typographic tell.
//
// Scope: the Russian panel content, the Russian site, and the ru branch of the
// shared modules that pick their language from <html lang>.
// ============================================================================
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');

const TARGETS = [
  'cantu-pneus/panel-content/ru',
  'cantu-pneus/ru',
  'cantu-pneus/js',          // holds the ru table too: one file, three languages
];

const CYR = 'Ѐ-ӿ';
const MOJIBAKE = /Ð[\x80-\xbf]|Ñ[\x80-\xbf]|â€|ï¿½/;

// Latin characters that have an identical-looking Cyrillic twin. A token
// containing both scripts is almost always one of these substituted by mistake.
const CONFUSABLE = 'aeocpxyABCEHKMOPTXaeopcyx';

// Words that legitimately mix, or are brand and technical tokens sitting next
// to Cyrillic without a space. Kept deliberately short: every entry here is a
// hole in the check.
const MIXED_OK = /^(CantuPneus|Dengage|WhatsApp|SpeedMax|Itaro)$/;

// Words where this site commits to the ё spelling. Both spellings appearing in
// the same body of copy is the fault, not either one on its own.
const YO_WORDS = [
  ['ёлочк', 'елочк'],   // ёлочка
  ['надёжн', 'надежн'], // надёжн
  ['тёр', 'тер'],                           // (partial) -тёр
  ['счёт', 'счет'],               // счёт
  ['расчёт', 'расчет'], // расчёт
  ['ёмк', 'емк'],                           // ёмк
];

const problems = [];

function visibleFromHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function visibleFromJs(src) {
  const out = [];
  for (const m of src.matchAll(/'([^'\\\n]{2,200})'|"([^"\\\n]{2,200})"/g)) {
    const v = m[1] || m[2];
    if (!new RegExp('[' + CYR + ']').test(v)) continue;   // only Russian strings
    out.push(v);
  }
  return out.join(' \n ');
}

function walk(dir) {
  const abs = path.join(REPO, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() && e.name !== 'vendor' && e.name !== 'images'
      ? walk(path.join(dir, e.name))
      : /\.(html|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

const files = TARGETS.flatMap(walk);
console.log(`checking Russian in ${files.length} file(s)\n`);

// ё consistency is a property of the whole body of copy, not of one file
const yoSeen = {};

for (const rel of files) {
  const raw = fs.readFileSync(path.join(REPO, rel), 'utf8');
  const text = rel.endsWith('.html') ? visibleFromHtml(raw) : visibleFromJs(raw);
  const found = [];

  if (MOJIBAKE.test(raw)) {
    found.push('mojibake: the file looks like cp1251 bytes read as UTF-8');
  }

  // 1. mixed script inside a single word
  for (const m of text.matchAll(new RegExp('[' + CYR + 'A-Za-z]{2,}', 'g'))) {
    const word = m[0];
    if (MIXED_OK.test(word)) continue;
    const hasCyr = new RegExp('[' + CYR + ']').test(word);
    const hasLat = /[A-Za-z]/.test(word);
    if (!hasCyr || !hasLat) continue;
    const latin = [...word].filter(c => /[A-Za-z]/.test(c));
    const confusable = latin.filter(c => CONFUSABLE.includes(c));
    found.push(`mixed script "${word}": Latin ${JSON.stringify(latin.join(''))}`
      + (confusable.length ? ` (${confusable.join('')} look identical to Cyrillic)` : '')
      + ' inside a Cyrillic word');
  }

  // 4. straight double quotes wrapping Cyrillic. The lookbehind matters: these
  //    files build HTML by concatenation, so aria-label="Закрыть" is an
  //    attribute delimiter, not a Russian quotation mark. Only a quote that
  //    does not follow "=" is prose.
  for (const m of text.matchAll(new RegExp('(?<![=\\w])"[' + CYR + '][^"\\n]{0,40}"', 'g'))) {
    found.push(`straight quotes around Cyrillic ${m[0]}, Russian uses « »`);
  }

  // 3. record ё usage for the cross-file check below
  for (const [withYo, withoutYo] of YO_WORDS) {
    const key = withYo;
    yoSeen[key] = yoSeen[key] || { yes: [], no: [] };
    if (text.toLowerCase().includes(withYo)) yoSeen[key].yes.push(rel);
    if (text.toLowerCase().includes(withoutYo)) yoSeen[key].no.push(rel);
  }

  const uniq = [...new Set(found)];
  console.log(`${uniq.length ? 'FAIL' : 'PASS'}  ${rel}`);
  uniq.forEach(f => { console.log('      - ' + f); problems.push(rel + ': ' + f); });
}

console.log('');
for (const [word, use] of Object.entries(yoSeen)) {
  if (use.yes.length && use.no.length) {
    const msg = `ё inconsistency on "${word}...": spelled with ё in `
      + `${use.yes.length} file(s) and without in ${use.no.length} `
      + `(${use.no.slice(0, 3).join(', ')})`;
    console.log('FAIL  ' + msg);
    problems.push(msg);
  }
}

console.log(problems.length
  ? `\n${problems.length} Russian copy problem(s)`
  : '\nRussian copy is single-script, correctly encoded and consistent on ё');
process.exit(problems.length ? 1 : 0);
