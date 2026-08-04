"""Generate self-contained SVG product art + scene art for the fintech and
banking demo sites. No external assets, so nothing can 404 at demo time."""
import os, json, math

W, H = 520, 560

def head(extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'role="img" aria-label="{extra}">')

def defs(p):
    return f'''
 <defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="{p['bg1']}"/><stop offset="1" stop-color="{p['bg2']}"/>
  </linearGradient>
  <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="{p['c1']}"/><stop offset="0.55" stop-color="{p['c2']}"/><stop offset="1" stop-color="{p['c3']}"/>
  </linearGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.16"/>
  </linearGradient>
  <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#F3DFA6"/><stop offset="0.5" stop-color="#D9B75F"/><stop offset="1" stop-color="#B48F38"/>
  </linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="{p['a1']}"/><stop offset="1" stop-color="{p['a2']}"/>
  </linearGradient>
  <filter id="sh" x="-30%" y="-30%" width="170%" height="170%">
   <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="{p['shadow']}" flood-opacity="0.30"/>
  </filter>
  <filter id="sh2" x="-30%" y="-30%" width="170%" height="170%">
   <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="{p['shadow']}" flood-opacity="0.22"/>
  </filter>
 </defs>
 <rect width="{W}" height="{H}" fill="url(#bg)"/>'''

def ellipse_shadow():
    return f'<ellipse cx="{W/2}" cy="486" rx="150" ry="20" fill="#000" opacity="0.07"/>'

def chip(x, y):
    return (f'<g transform="translate({x},{y})">'
            f'<rect width="46" height="34" rx="6" fill="url(#chip)"/>'
            f'<g stroke="#8A6A22" stroke-width="1.6" opacity="0.65">'
            f'<path d="M0 11 H46 M0 23 H46 M15 0 V34 M31 0 V34"/></g></g>')

def wifi(x, y, col="#fff"):
    d = []
    for i, r in enumerate((7, 12, 17, 22)):
        d.append(f'<path d="M0 {-r} A {r} {r} 0 0 1 0 {r}" fill="none" stroke="{col}" '
                 f'stroke-width="3" stroke-linecap="round" opacity="{0.95 - i*0.12:.2f}"/>')
    return f'<g transform="translate({x},{y})">' + ''.join(d) + '</g>'

def card_art(p, wordmark, tier, tier_col, pattern):
    """A payment card, tilted, with brand mark, chip, contactless and tier."""
    pat = ''
    if pattern == 'waves':
        pat = ''.join(f'<path d="M-20 {60+i*26} C 90 {30+i*26}, 190 {96+i*26}, 320 {58+i*26}" fill="none" '
                      f'stroke="#fff" stroke-opacity="0.10" stroke-width="10"/>' for i in range(6))
    elif pattern == 'grid':
        pat = ''.join(f'<path d="M{i*34} 0 V210" stroke="#fff" stroke-opacity="0.07" stroke-width="2"/>' for i in range(10)) + \
              ''.join(f'<path d="M0 {i*30} H320" stroke="#fff" stroke-opacity="0.07" stroke-width="2"/>' for i in range(8))
    elif pattern == 'globe':
        pat = ('<g fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="3">'
               '<circle cx="248" cy="150" r="74"/><ellipse cx="248" cy="150" rx="30" ry="74"/>'
               '<path d="M176 128 H320 M176 172 H320"/></g>')
    elif pattern == 'arc':
        pat = ('<g fill="none" stroke="#fff" stroke-opacity="0.11" stroke-width="14">'
               '<path d="M-30 200 A 210 210 0 0 1 250 -10"/><path d="M20 220 A 210 210 0 0 1 300 10"/></g>')
    return f'''
 {ellipse_shadow()}
 <g transform="translate({W/2},262) rotate(-9) translate(-160,-105)" filter="url(#sh)">
  <rect width="320" height="210" rx="22" fill="url(#card)"/>
  <g clip-path="inset(0 round 22px)">{pat}
   <rect width="320" height="210" rx="22" fill="url(#sheen)"/>
  </g>
  <rect x="0.8" y="0.8" width="318.4" height="208.4" rx="21.4" fill="none" stroke="#fff" stroke-opacity="0.22"/>
  {chip(30, 82)}
  {wifi(104, 99)}
  <text x="30" y="46" font-family="Inter,Arial,sans-serif" font-size="21" font-weight="700"
        fill="#fff" letter-spacing="1.2">{wordmark}</text>
  <text x="290" y="46" text-anchor="end" font-family="Inter,Arial,sans-serif" font-size="11.5"
        font-weight="700" fill="{tier_col}" letter-spacing="2.4">{tier}</text>
  <text x="30" y="160" font-family="'Courier New',monospace" font-size="19" fill="#fff"
        fill-opacity="0.92" letter-spacing="2.4">5241  ••••  ••••  8073</text>
  <text x="30" y="186" font-family="Inter,Arial,sans-serif" font-size="11" fill="#fff"
        fill-opacity="0.72" letter-spacing="1.1">VALID THRU  09/29</text>
  <g transform="translate(246,168)" fill="#fff" fill-opacity="0.9">
   <circle cx="12" cy="10" r="11"/><circle cx="30" cy="10" r="11" fill-opacity="0.55"/>
  </g>
 </g>'''

def tile(p, glyph_svg, label):
    """A generic product tile used for non-card products."""
    return f'''
 {ellipse_shadow()}
 <g transform="translate({W/2},258) translate(-135,-135)" filter="url(#sh)">
  <rect width="270" height="270" rx="34" fill="url(#card)"/>
  <g clip-path="inset(0 round 34px)">
   <rect width="270" height="270" rx="34" fill="url(#sheen)"/>
   <circle cx="238" cy="34" r="72" fill="#fff" fill-opacity="0.07"/>
  </g>
  <rect x="0.8" y="0.8" width="268.4" height="268.4" rx="33.4" fill="none" stroke="#fff" stroke-opacity="0.22"/>
  <g transform="translate(135,124)">{glyph_svg}</g>
  <text x="135" y="232" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="13"
        font-weight="700" fill="#fff" fill-opacity="0.95" letter-spacing="1.6">{label}</text>
 </g>'''

# ---- glyphs, drawn centred on (0,0) ----
G = {}
G['chart'] = ('<g stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none">'
              '<path d="M-62 34 L-22 -6 L10 20 L62 -40"/></g>'
              '<g fill="#fff" fill-opacity="0.85"><circle cx="62" cy="-40" r="9"/></g>'
              '<g fill="#fff" fill-opacity="0.30">'
              '<rect x="-70" y="44" width="20" height="26" rx="5"/><rect x="-36" y="26" width="20" height="44" rx="5"/>'
              '<rect x="-2" y="36" width="20" height="34" rx="5"/><rect x="32" y="8" width="20" height="62" rx="5"/></g>')
G['coin'] = ('<g fill="none" stroke="#fff" stroke-width="8"><circle cx="0" cy="0" r="46"/></g>'
             '<text x="0" y="17" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="52"'
             ' font-weight="700" fill="#fff">$</text>'
             '<g fill="#fff" fill-opacity="0.35"><ellipse cx="0" cy="62" rx="52" ry="12"/></g>')
G['pot'] = ('<g fill="#fff" fill-opacity="0.92"><path d="M-52 -12 h104 a10 10 0 0 1 10 10 v34 a34 34 0 0 1 -34 34 '
            'h-56 a34 34 0 0 1 -34 -34 v-34 a10 10 0 0 1 10 -10 z"/></g>'
            '<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round">'
            '<path d="M-30 -12 v-16 a30 30 0 0 1 60 0 v16"/></g>'
            '<g fill="url(#acc)"><circle cx="0" cy="24" r="17"/></g>')
G['vault'] = ('<g fill="#fff" fill-opacity="0.92"><rect x="-56" y="-52" width="112" height="104" rx="14"/></g>'
              '<g fill="none" stroke="url(#acc)" stroke-width="8"><circle cx="0" cy="0" r="30"/></g>'
              '<g stroke="url(#acc)" stroke-width="8" stroke-linecap="round">'
              '<path d="M0 -42 V-30 M0 30 V42 M-42 0 H-30 M30 0 H42"/></g>')
G['shield'] = ('<g fill="#fff" fill-opacity="0.92"><path d="M0 -56 L52 -36 V6 C52 40 28 58 0 68 '
               'C-28 58 -52 40 -52 6 V-36 Z"/></g>'
               '<g fill="none" stroke="url(#acc)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">'
               '<path d="M-22 2 L-4 22 L26 -18"/></g>')
G['globe'] = ('<g fill="none" stroke="#fff" stroke-width="8"><circle cx="0" cy="0" r="50"/>'
              '<ellipse cx="0" cy="0" rx="20" ry="50"/><path d="M-50 -16 H50 M-50 16 H50"/></g>')
G['arrows'] = ('<g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'
               '<path d="M-46 -18 H36 L18 -38 M46 18 H-36 L-18 38"/></g>')
G['percent'] = ('<g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round">'
                '<circle cx="-24" cy="-24" r="15"/><circle cx="24" cy="24" r="15"/><path d="M36 -38 L-36 38"/></g>')
G['phone'] = ('<g fill="#fff" fill-opacity="0.92"><rect x="-34" y="-56" width="68" height="112" rx="12"/></g>'
              '<g fill="url(#acc)"><rect x="-24" y="-42" width="48" height="60" rx="6"/></g>'
              '<g fill="#fff" fill-opacity="0.5"><rect x="-12" y="34" width="24" height="6" rx="3"/></g>')
G['bag'] = ('<g fill="#fff" fill-opacity="0.92"><path d="M-46 -14 h92 l-8 74 a12 12 0 0 1 -12 11 h-52 '
            'a12 12 0 0 1 -12 -11 z"/></g>'
            '<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round">'
            '<path d="M-24 -14 v-16 a24 24 0 0 1 48 0 v16"/></g>'
            '<g fill="none" stroke="url(#acc)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="M-18 26 L-2 42 L22 12"/></g>')
G['plane'] = ('<g fill="#fff" fill-opacity="0.94"><path d="M-58 8 L48 -30 L58 -18 L-6 26 L-10 52 L-22 44 '
              'L-24 22 L-52 22 Z"/></g>')
G['building'] = ('<g fill="#fff" fill-opacity="0.92"><path d="M-60 -20 L0 -54 L60 -20 V16 H-60 Z"/>'
                 '<rect x="-64" y="16" width="128" height="14" rx="5"/></g>'
                 '<g fill="url(#acc)"><rect x="-40" y="-10" width="16" height="26" rx="4"/>'
                 '<rect x="-8" y="-10" width="16" height="26" rx="4"/><rect x="24" y="-10" width="16" height="26" rx="4"/></g>')
G['ladder'] = ('<g fill="#fff" fill-opacity="0.35"><rect x="-64" y="16" width="34" height="46" rx="7"/></g>'
               '<g fill="#fff" fill-opacity="0.65"><rect x="-18" y="-14" width="34" height="76" rx="7"/></g>'
               '<g fill="#fff" fill-opacity="0.95"><rect x="28" y="-46" width="34" height="108" rx="7"/></g>'
               '<g fill="none" stroke="url(#acc)" stroke-width="8" stroke-linecap="round">'
               '<path d="M-52 -30 L-6 -52 L46 -66"/></g>')
G['house'] = ('<g fill="#fff" fill-opacity="0.94"><path d="M0 -58 L62 -8 H44 V56 H-44 V-8 H-62 Z"/></g>'
              '<g fill="url(#acc)"><rect x="-16" y="10" width="32" height="46" rx="4"/></g>')
G['heart'] = ('<g fill="#fff" fill-opacity="0.94"><path d="M0 56 C-52 22 -66 -6 -50 -28 C-36 -47 -10 -44 0 -22 '
              'C10 -44 36 -47 50 -28 C66 -6 52 22 0 56 Z"/></g>'
              '<g fill="none" stroke="url(#acc)" stroke-width="8" stroke-linecap="round">'
              '<path d="M-28 -4 H-12 L-4 -18 L6 8 L14 -4 H28"/></g>')
G['scales'] = ('<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round">'
               '<path d="M0 -50 V44 M-52 -34 H52 M-52 -34 L-64 4 H-40 Z M52 -34 L40 4 H64 Z M-30 52 H30"/></g>')
G['clock'] = ('<g fill="none" stroke="#fff" stroke-width="8"><circle cx="0" cy="0" r="48"/></g>'
              '<g stroke="url(#acc)" stroke-width="8" stroke-linecap="round"><path d="M0 -26 V4 L22 18"/></g>')
G['star'] = ('<g fill="#fff" fill-opacity="0.94"><path d="M0 -56 L16 -18 L58 -14 L26 12 L36 54 L0 32 '
             'L-36 54 L-26 12 L-58 -14 L-16 -18 Z"/></g>')

def write(path, body, label, p, uid=''):
    svg = head(label) + defs(p) + body + '</svg>'
    if uid:
        # ids are document-scoped: prefix them so inlining many of these SVGs
        # into one page cannot make them all resolve to the first definition
        for name in ('bg', 'card', 'sheen', 'chip', 'acc', 'sh', 'sh2'):
            svg = svg.replace('id="%s"' % name, 'id="%s-%s"' % (name, uid))
            svg = svg.replace('url(#%s)' % name, 'url(#%s-%s)' % (name, uid))
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(svg)

# --------------------------------------------------------------- palettes
FIN = dict(bg1='#F5F6FF', bg2='#E4E6FA', c1='#6366F1', c2='#4F46E5', c3='#312E9E',
           a1='#34D399', a2='#10B981', shadow='#1E1B4B')
BNK = dict(bg1='#F7F5F0', bg2='#E7E2D6', c1='#164574', c2='#0A2540', c3='#061726',
           a1='#D9B863', a2='#B8933C', shadow='#08131F')

def variant(p, **kw):
    q = dict(p); q.update(kw); return q

# --------------------------------------------------------------- fintech items
FIN_ITEMS = [
 ('NPY-CRD-METAL',    'card', dict(wordmark='NovaPay', tier='METAL',    tier_col='#E9E4FF', pattern='arc'),
  variant(FIN, c1='#2A2A3E', c2='#16161F', c3='#0A0A10', a1='#C8CBF5', a2='#9FA3E8')),
 ('NPY-CRD-PLUS',     'card', dict(wordmark='NovaPay', tier='PLUS',     tier_col='#D7FBEC', pattern='waves'), FIN),
 ('NPY-CRD-TRAVEL',   'card', dict(wordmark='NovaPay', tier='TRAVEL',   tier_col='#FFF3CF', pattern='globe'),
  variant(FIN, c1='#0EA5E9', c2='#2563EB', c3='#1E3A8A')),
 ('NPY-CRD-BIZ',      'card', dict(wordmark='NovaPay', tier='BUSINESS', tier_col='#D9FBEA', pattern='grid'),
  variant(FIN, c1='#0F766E', c2='#115E59', c3='#0B3B37')),
 ('NPY-INV-STOCKS',   'tile', dict(glyph=G['chart'],   label='STOCKS PRO'), FIN),
 ('NPY-INV-CRYPTO',   'tile', dict(glyph=G['vault'],   label='CRYPTO VAULT'),
  variant(FIN, c1='#7C3AED', c2='#5B21B6', c3='#3B0F73')),
 ('NPY-INV-ROBO',     'tile', dict(glyph=G['scales'],  label='MANAGED'),
  variant(FIN, c1='#0EA5E9', c2='#0369A1', c3='#075985')),
 ('NPY-SAV-BOOST',    'tile', dict(glyph=G['ladder'],  label='SAVINGS BOOST'),
  variant(FIN, c1='#10B981', c2='#059669', c3='#065F46')),
 ('NPY-SAV-POTS',     'tile', dict(glyph=G['pot'],     label='GOAL POTS'),
  variant(FIN, c1='#14B8A6', c2='#0D9488', c3='#0F766E')),
 ('NPY-CRE-BUILD',    'tile', dict(glyph=G['star'],    label='CREDIT BUILDER'),
  variant(FIN, c1='#F59E0B', c2='#D97706', c3='#92400E', a1='#FDE68A', a2='#FBBF24')),
 ('NPY-CRE-LOAN',     'tile', dict(glyph=G['percent'], label='PERSONAL LOAN'),
  variant(FIN, c1='#6366F1', c2='#4338CA', c3='#312E81')),
 ('NPY-GLB-ACCOUNT',  'tile', dict(glyph=G['globe'],   label='MULTI-CURRENCY'),
  variant(FIN, c1='#2563EB', c2='#1D4ED8', c3='#1E3A8A')),
 ('NPY-GLB-TRANSFER', 'tile', dict(glyph=G['arrows'],  label='TRANSFERS PRO'),
  variant(FIN, c1='#0891B2', c2='#0E7490', c3='#155E75')),
 ('NPY-PRO-TRAVEL',   'tile', dict(glyph=G['plane'],   label='TRAVEL COVER'),
  variant(FIN, c1='#F43F5E', c2='#E11D48', c3='#9F1239', a1='#FECDD3', a2='#FDA4AF')),
 ('NPY-PRO-DEVICE',   'tile', dict(glyph=G['phone'],   label='DEVICE COVER'),
  variant(FIN, c1='#64748B', c2='#475569', c3='#334155')),
 ('NPY-PRO-PURCHASE', 'tile', dict(glyph=G['bag'],     label='PURCHASE COVER'),
  variant(FIN, c1='#8B5CF6', c2='#6D28D9', c3='#4C1D95')),
]

# --------------------------------------------------------------- banking items
BNK_ITEMS = [
 ('MRD-CRD-INFINITE', 'card', dict(wordmark='MERIDIAN', tier='INFINITE', tier_col='#F0E2BC', pattern='arc'),
  variant(BNK, c1='#1F1B16', c2='#12100C', c3='#080706', a1='#E4CB8E', a2='#C8A44D')),
 ('MRD-CRD-PLATINUM', 'card', dict(wordmark='MERIDIAN', tier='PLATINUM', tier_col='#E7EDF3', pattern='grid'),
  variant(BNK, c1='#5B6D7C', c2='#3B4C59', c3='#22303B')),
 ('MRD-CRD-CLASSIC',  'card', dict(wordmark='MERIDIAN', tier='CLASSIC',  tier_col='#F0E2BC', pattern='waves'), BNK),
 ('MRD-CRD-STUDENT',  'card', dict(wordmark='MERIDIAN', tier='STUDENT',  tier_col='#DFF3EC', pattern='waves'),
  variant(BNK, c1='#0F766E', c2='#0B5C55', c3='#073F3A')),
 ('MRD-ACC-CURRENT',  'tile', dict(glyph=G['building'], label='CURRENT ACCOUNT'), BNK),
 ('MRD-ACC-PREMIER',  'tile', dict(glyph=G['star'],     label='PREMIER ACCOUNT'),
  variant(BNK, c1='#1F1B16', c2='#12100C', c3='#080706', a1='#E4CB8E', a2='#C8A44D')),
 ('MRD-ACC-BUSINESS', 'tile', dict(glyph=G['scales'],   label='BUSINESS ACCOUNT'),
  variant(BNK, c1='#14406B', c2='#0C2C4C', c3='#071B30')),
 ('MRD-SAV-ISA',      'tile', dict(glyph=G['pot'],      label='CASH ISA'),
  variant(BNK, c1='#166534', c2='#14532D', c3='#0B3520')),
 ('MRD-SAV-FIXED',    'tile', dict(glyph=G['clock'],    label='FIXED SAVER'),
  variant(BNK, c1='#0E7490', c2='#155E75', c3='#0C4A5E')),
 ('MRD-LON-PERSONAL', 'tile', dict(glyph=G['percent'],  label='PERSONAL LOAN'),
  variant(BNK, c1='#1D4ED8', c2='#1E3A8A', c3='#172554')),
 ('MRD-LON-CAR',      'tile', dict(glyph=G['arrows'],   label='CAR FINANCE'),
  variant(BNK, c1='#B45309', c2='#92400E', c3='#6B2E09', a1='#FDE9C0', a2='#EAB308')),
 ('MRD-MTG-FIRST',    'tile', dict(glyph=G['house'],    label='FIRST HOME'),
  variant(BNK, c1='#155E9C', c2='#0A2540', c3='#061726')),
 ('MRD-MTG-REMORT',   'tile', dict(glyph=G['ladder'],   label='REMORTGAGE'),
  variant(BNK, c1='#3F6212', c2='#365314', c3='#1F2E0A')),
 ('MRD-WLT-PORTFOLIO','tile', dict(glyph=G['chart'],    label='WEALTH PORTFOLIO'),
  variant(BNK, c1='#4C1D95', c2='#3B1178', c3='#2A0B57', a1='#E4CB8E', a2='#C8A44D')),
 ('MRD-INS-HOME',     'tile', dict(glyph=G['shield'],   label='HOME INSURANCE'),
  variant(BNK, c1='#0F766E', c2='#0B5C55', c3='#073F3A')),
 ('MRD-INS-LIFE',     'tile', dict(glyph=G['heart'],    label='LIFE COVER'),
  variant(BNK, c1='#9F1239', c2='#831843', c3='#500724', a1='#FBCFE8', a2='#F9A8D4')),
]

def build(folder, items):
    out = os.path.join(folder, 'images', 'products')
    os.makedirs(out, exist_ok=True)
    for pid, kind, kw, pal in items:
        if kind == 'card':
            body = card_art(pal, kw['wordmark'], kw['tier'], kw['tier_col'], kw['pattern'])
            label = f"{kw['wordmark']} {kw['tier']} card"
        else:
            body = tile(pal, kw['glyph'], kw['label'])
            label = kw['label'].title()
        write(os.path.join(out, pid + '.svg'), body, label, pal, uid=pid.lower())
    print(folder, 'wrote', len(items), 'product SVGs')

build('/workspace/dengage-demos/fintech', FIN_ITEMS)
build('/workspace/dengage-demos/banking', BNK_ITEMS)
