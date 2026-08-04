"""Scene/hero artwork for the fintech and banking demos, as self-contained SVG."""
import os

W, H = 1200, 800

def svg(uid, pal, body, label):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{label}">
 <defs>
  <linearGradient id="g-{uid}" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="{pal['g1']}"/><stop offset="0.55" stop-color="{pal['g2']}"/><stop offset="1" stop-color="{pal['g3']}"/>
  </linearGradient>
  <linearGradient id="p-{uid}" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#ffffff" stop-opacity="0.96"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.80"/>
  </linearGradient>
  <linearGradient id="a-{uid}" x1="0" y1="1" x2="1" y2="0">
   <stop offset="0" stop-color="{pal['a1']}"/><stop offset="1" stop-color="{pal['a2']}"/>
  </linearGradient>
  <filter id="f-{uid}" x="-20%" y="-20%" width="140%" height="140%">
   <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="{pal['sh']}" flood-opacity="0.34"/>
  </filter>
 </defs>
 <rect width="{W}" height="{H}" fill="url(#g-{uid})"/>
 <g opacity="0.5">
  <circle cx="150" cy="120" r="230" fill="#fff" fill-opacity="0.05"/>
  <circle cx="1080" cy="700" r="290" fill="#fff" fill-opacity="0.04"/>
 </g>
{body}
</svg>'''

def phone(uid, x, y, s=1.0, rows=4):
    bars = ''.join(f'<rect x="34" y="{188+i*54}" width="{212 - (i%3)*46}" height="18" rx="9" fill="#0f172a" fill-opacity="0.14"/>'
                   f'<rect x="{262 - 44}" y="{184+i*54}" width="44" height="26" rx="8" fill="url(#a-{uid})" fill-opacity="0.85"/>'
                   for i in range(rows))
    return f'''
 <g transform="translate({x},{y}) scale({s})" filter="url(#f-{uid})">
  <rect width="330" height="640" rx="46" fill="#101528"/>
  <rect x="12" y="12" width="306" height="616" rx="36" fill="url(#p-{uid})"/>
  <rect x="130" y="26" width="70" height="10" rx="5" fill="#101528" fill-opacity="0.5"/>
  <rect x="34" y="62" width="150" height="16" rx="8" fill="#0f172a" fill-opacity="0.35"/>
  <rect x="34" y="92" width="240" height="46" rx="12" fill="#0f172a" fill-opacity="0.08"/>
  <text x="46" y="124" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="700" fill="#0f172a" fill-opacity="0.78">$12,480.60</text>
  <rect x="34" y="152" width="120" height="12" rx="6" fill="#0f172a" fill-opacity="0.18"/>
  {bars}
 </g>'''

def dashboard(uid, x, y, s=1.0):
    bars = ''.join(f'<rect x="{60+i*52}" y="{250 - h}" width="30" height="{h}" rx="8" fill="url(#a-{uid})" fill-opacity="{0.45+0.09*i:.2f}"/>'
                   for i, h in enumerate((70, 108, 88, 148, 122, 186)))
    return f'''
 <g transform="translate({x},{y}) scale({s})" filter="url(#f-{uid})">
  <rect width="620" height="410" rx="26" fill="url(#p-{uid})"/>
  <rect x="30" y="30" width="180" height="18" rx="9" fill="#0f172a" fill-opacity="0.34"/>
  <rect x="30" y="60" width="110" height="12" rx="6" fill="#0f172a" fill-opacity="0.16"/>
  <rect x="30" y="96" width="560" height="1.5" fill="#0f172a" fill-opacity="0.10"/>
  {bars}
  <path d="M60 200 C 140 150, 220 216, 300 140 S 440 120, 560 74" fill="none" stroke="#0f172a" stroke-opacity="0.30" stroke-width="5" stroke-linecap="round"/>
  <circle cx="560" cy="74" r="9" fill="url(#a-{uid})"/>
  <g transform="translate(30,286)">
   <rect width="270" height="94" rx="16" fill="#0f172a" fill-opacity="0.06"/>
   <rect x="18" y="20" width="120" height="14" rx="7" fill="#0f172a" fill-opacity="0.26"/>
   <rect x="18" y="46" width="180" height="24" rx="8" fill="#0f172a" fill-opacity="0.14"/>
  </g>
  <g transform="translate(320,286)">
   <rect width="270" height="94" rx="16" fill="#0f172a" fill-opacity="0.06"/>
   <rect x="18" y="20" width="150" height="14" rx="7" fill="#0f172a" fill-opacity="0.26"/>
   <rect x="18" y="46" width="120" height="24" rx="8" fill="#0f172a" fill-opacity="0.14"/>
  </g>
 </g>'''

def card_fan(uid, x, y, s=1.0):
    def c(dx, dy, rot, op):
        return (f'<g transform="translate({dx},{dy}) rotate({rot})" filter="url(#f-{uid})">'
                f'<rect width="380" height="240" rx="26" fill="#0f172a" fill-opacity="{op}"/>'
                f'<rect x="30" y="150" width="200" height="16" rx="8" fill="#fff" fill-opacity="0.6"/>'
                f'<rect x="30" y="44" width="52" height="38" rx="8" fill="url(#a-{uid})"/>'
                f'<rect x="30" y="186" width="110" height="12" rx="6" fill="#fff" fill-opacity="0.35"/></g>')
    return f'<g transform="translate({x},{y}) scale({s})">' + c(0, 90, -14, 0.72) + c(90, 40, -7, 0.84) + c(180, 0, 0, 0.95) + '</g>'

def globe(uid, x, y, s=1.0):
    dots = ''
    pts = [(0,0),(60,-40),(-70,30),(110,20),(-40,-70),(40,80),(-110,-20),(90,-80),(130,70),(-90,90)]
    for i,(dx,dy) in enumerate(pts):
        dots += f'<circle cx="{dx}" cy="{dy}" r="{7 if i%3 else 11}" fill="url(#a-{uid})" fill-opacity="0.9"/>'
    arcs = ''.join(f'<path d="M{p[0]} {p[1]} Q {(p[0]+q[0])/2} {(p[1]+q[1])/2 - 90} {q[0]} {q[1]}" fill="none" '
                   f'stroke="#fff" stroke-opacity="0.34" stroke-width="3" stroke-dasharray="7 9"/>'
                   for p, q in zip(pts, pts[1:]))
    return f'''
 <g transform="translate({x},{y}) scale({s})">
  <g fill="none" stroke="#fff" stroke-opacity="0.26" stroke-width="4">
   <circle r="200"/><ellipse rx="82" ry="200"/><ellipse rx="152" ry="200"/>
   <path d="M-200 -66 H200 M-200 0 H200 M-200 66 H200"/>
  </g>
  {arcs}{dots}
 </g>'''

def vault(uid, x, y, s=1.0):
    return f'''
 <g transform="translate({x},{y}) scale({s})" filter="url(#f-{uid})">
  <rect width="440" height="380" rx="30" fill="url(#p-{uid})"/>
  <rect x="34" y="34" width="372" height="312" rx="20" fill="#0f172a" fill-opacity="0.08"/>
  <circle cx="220" cy="190" r="96" fill="none" stroke="#0f172a" stroke-opacity="0.28" stroke-width="16"/>
  <circle cx="220" cy="190" r="52" fill="url(#a-{uid})" fill-opacity="0.9"/>
  <g stroke="#0f172a" stroke-opacity="0.34" stroke-width="14" stroke-linecap="round">
   <path d="M220 62 V96 M220 284 V318 M92 190 H126 M314 190 H348"/>
  </g>
 </g>'''

def people(uid, x, y, s=1.0):
    def person(dx, op, tone):
        return (f'<g transform="translate({dx},0)">'
                f'<circle cx="0" cy="-46" r="42" fill="#fff" fill-opacity="{op}"/>'
                f'<path d="M-62 90 C -62 26, -32 6, 0 6 C 32 6, 62 26, 62 90 Z" fill="{tone}" fill-opacity="{op}"/></g>')
    return (f'<g transform="translate({x},{y}) scale({s})" filter="url(#f-{uid})">'
            + person(-150, 0.80, '#fff') + person(0, 0.96, '#fff') + person(150, 0.80, '#fff')
            + f'<g transform="translate(0,150)"><rect x="-260" y="0" width="520" height="20" rx="10" fill="#fff" fill-opacity="0.45"/></g></g>')

def building(uid, x, y, s=1.0):
    cols = ''.join(f'<rect x="{-150+i*60}" y="-60" width="38" height="200" rx="6" fill="#fff" fill-opacity="0.9"/>' for i in range(6))
    return f'''
 <g transform="translate({x},{y}) scale({s})" filter="url(#f-{uid})">
  <path d="M-230 -60 L0 -190 L230 -60 Z" fill="#fff" fill-opacity="0.96"/>
  {cols}
  <rect x="-250" y="140" width="500" height="34" rx="10" fill="#fff" fill-opacity="0.96"/>
  <rect x="-210" y="-84" width="420" height="26" rx="8" fill="#fff" fill-opacity="0.9"/>
  <g fill="url(#a-{uid})"><rect x="-40" y="10" width="80" height="130" rx="8"/></g>
 </g>'''

FIN = dict(g1='#6366F1', g2='#4F46E5', g3='#312E9E', a1='#34D399', a2='#10B981', sh='#1E1B4B')
FIN2 = dict(g1='#0EA5E9', g2='#2563EB', g3='#1E3A8A', a1='#A7F3D0', a2='#34D399', sh='#0C1D46')
FIN3 = dict(g1='#8B5CF6', g2='#6D28D9', g3='#3B0F73', a1='#FDE68A', a2='#FBBF24', sh='#2A0B57')
BNK = dict(g1='#14406B', g2='#0A2540', g3='#061726', a1='#E4CB8E', a2='#C8A44D', sh='#04101B')
BNK2 = dict(g1='#1F1B16', g2='#12100C', g3='#080706', a1='#E4CB8E', a2='#C8A44D', sh='#000000')
BNK3 = dict(g1='#166534', g2='#14532D', g3='#0B3520', a1='#E4CB8E', a2='#C8A44D', sh='#06200F')

SCENES = {
 'fintech': [
   ('hero-app',      FIN,  lambda u: phone(u, 120, 90, 1.0) + dashboard(u, 500, 210, 0.98), 'NovaPay app balance and spending dashboard'),
   ('hero-cards',    FIN2, lambda u: card_fan(u, 300, 260, 1.05), 'NovaPay card range'),
   ('hero-invest',   FIN3, lambda u: dashboard(u, 290, 200, 1.05), 'NovaPay investing performance dashboard'),
   ('scene-global',  FIN2, lambda u: globe(u, 600, 400, 1.0), 'NovaPay multi-currency coverage'),
   ('scene-vault',   FIN,  lambda u: vault(u, 380, 210, 1.0), 'NovaPay security and custody'),
   ('scene-team',    FIN3, lambda u: people(u, 600, 380, 1.05), 'NovaPay support team'),
   ('scene-savings', FIN,  lambda u: phone(u, 434, 80, 1.0), 'NovaPay savings pots in the app'),
   ('scene-app',     FIN2, lambda u: dashboard(u, 100, 130, 1.05) + phone(u, 760, 120, 0.72), 'NovaPay app and web dashboard'),
 ],
 'banking': [
   ('hero-branch',   BNK,  lambda u: building(u, 600, 400, 1.05), 'Meridian Bank branch'),
   ('hero-cards',    BNK2, lambda u: card_fan(u, 300, 260, 1.05), 'Meridian card range'),
   ('hero-wealth',   BNK,  lambda u: dashboard(u, 290, 200, 1.05), 'Meridian wealth performance review'),
   ('scene-advisor', BNK,  lambda u: people(u, 600, 380, 1.05), 'Meridian advisers'),
   ('scene-vault',   BNK2, lambda u: vault(u, 380, 210, 1.0), 'Meridian security and deposit protection'),
   ('scene-global',  BNK3, lambda u: globe(u, 600, 400, 1.0), 'Meridian international banking'),
   ('scene-app',     BNK,  lambda u: phone(u, 120, 90, 1.0) + dashboard(u, 500, 210, 0.98), 'Meridian mobile banking app'),
 ],
}

for folder, items in SCENES.items():
    out = os.path.join('/workspace/dengage-demos', folder, 'images', 'scenes')
    os.makedirs(out, exist_ok=True)
    for name, pal, fn, label in items:
        uid = name.replace('-', '')
        open(os.path.join(out, name + '.svg'), 'w', encoding='utf-8').write(svg(uid, pal, fn(uid), label))
    print(folder, 'wrote', len(items), 'scenes')
