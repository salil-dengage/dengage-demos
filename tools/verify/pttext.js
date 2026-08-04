// ============================================================================
// pttext: the quality of the Portuguese itself.
//
//   node tools/verify/pttext.js
//
// ptsweep answers "is there English on the Portuguese site". It cannot answer
// "is the Portuguese any good", and a Brazilian prospect notices the difference
// immediately. Two faults it would miss, both of which were real here:
//
//   1. MISSING ACCENTS. "coracao", "gratis", "voce", "disponivel". Written by
//      anyone typing Portuguese on an ASCII keyboard, invisible to a word-list
//      sweep, and glaring to a native reader.
//   2. MOJIBAKE. A file saved as latin-1 and served as UTF-8 turns "ç" into
//      "Ã§". Renders as garbage, passes every other check.
//
// Scope: the Portuguese panel content, and the pt branch of the shared modules
// that pick their language from <html lang>.
// ============================================================================
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');

const TARGETS = [
  'cantu-pneus/panel-content/pt',
  'cantu-pneus/js',
  'cantu-pneus/en/js',       // holds the pt table too: one file, both languages
];

// Unaccented spellings of words that always carry an accent in Portuguese.
// Each maps to what it should be, so the failure message is actionable.
const NEEDS_ACCENT = {
  'coracao': 'coração', 'gratis': 'grátis', 'voce': 'você', 'disponivel': 'disponível',
  'indisponivel': 'indisponível', 'catalogo': 'catálogo', 'proxima': 'próxima',
  'proximo': 'próximo', 'minimo': 'mínimo', 'maximo': 'máximo', 'ultimo': 'último',
  'unico': 'único', 'pagina': 'página', 'usuario': 'usuário', 'endereco': 'endereço',
  'preco': 'preço', 'servico': 'serviço', 'opcao': 'opção', 'opcoes': 'opções',
  'informacao': 'informação', 'informacoes': 'informações', 'confirmacao': 'confirmação',
  'expedicao': 'expedição', 'reposicao': 'reposição', 'recomendacao': 'recomendação',
  'tracao': 'tração', 'carcaca': 'carcaça', 'agricola': 'agrícola', 'camara': 'câmara',
  'camaras': 'câmaras', 'caminhao': 'caminhão', 'nao': 'não', 'sao': 'são',
  'entao': 'então', 'tres': 'três', 'mes': 'mês', 'ja': 'já', 'esta': 'está',
  'ate': 'até', 'so': 'só', 'e-mails': 'e-mails', 'negocios': 'negócios',
  'provavel': 'provável', 'valida': 'válida', 'rapida': 'rápida', 'multiplas': 'múltiplas',
  'horario': 'horário', 'comercio': 'comércio', 'agronegocio': 'agronegócio',
  'obrigatorio': 'obrigatório', 'numero': 'número', 'codigo': 'código',
};

// Words above that are also legitimate as-is, so they can only be judged in
// context and are skipped rather than reported wrongly. "esta" is a real word
// (this), "so" appears inside English and in CSS, "ja" and "e" are too short.
const AMBIGUOUS = new Set(['esta', 'so', 'ja', 'ate', 'sao', 'e-mails']);

const MOJIBAKE = /Ã[\x80-\xbf]|â€|Â[\x80-\xbf]|ï¿½/;

const problems = [];

/* Only what a visitor reads: no CSS, no comments, no attribute names, no code.
   For a .js file that means the quoted strings; for HTML, the text nodes. */
function visibleFromHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function visibleFromJs(src) {
  // string literals only, and only ones that look like prose rather than ids
  const out = [];
  for (const m of src.matchAll(/'([^'\\\n]{4,120})'|"([^"\\\n]{4,120})"/g)) {
    const v = m[1] || m[2];
    if (/^[a-z0-9_\-.#\[\]:>= /]+$/i.test(v) && !/\s[a-z]{3,}\s/i.test(v)) continue;
    out.push(v);
  }
  return out.join(' \n ');
}

function walk(dir) {
  const abs = path.join(REPO, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name))
      : /\.(html|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

const files = TARGETS.flatMap(walk);
console.log(`checking Portuguese in ${files.length} file(s)\n`);

for (const rel of files) {
  const raw = fs.readFileSync(path.join(REPO, rel), 'utf8');
  const text = rel.endsWith('.html') ? visibleFromHtml(raw) : visibleFromJs(raw);
  const found = [];

  if (MOJIBAKE.test(raw)) {
    found.push('mojibake: the file looks like latin-1 bytes read as UTF-8');
  }

  for (const [wrong, right] of Object.entries(NEEDS_ACCENT)) {
    if (AMBIGUOUS.has(wrong)) continue;
    const re = new RegExp('(?<![\\w-])' + wrong + '(?![\\w-])', 'gi');
    for (const m of text.matchAll(re)) {
      const ctx = text.slice(Math.max(0, m.index - 34), m.index + 34).replace(/\s+/g, ' ').trim();
      found.push(`"${m[0]}" should be "${right}"  ...${ctx}...`);
    }
  }

  const uniq = [...new Set(found)];
  console.log(`${uniq.length ? 'FAIL' : 'PASS'}  ${rel}`);
  uniq.forEach(f => { console.log('      - ' + f); problems.push(rel + ': ' + f); });
}

console.log(problems.length
  ? `\n${problems.length} Portuguese spelling problem(s)`
  : '\nPortuguese copy is correctly accented and correctly encoded');
process.exit(problems.length ? 1 : 0);
