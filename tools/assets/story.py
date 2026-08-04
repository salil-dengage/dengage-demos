#!/usr/bin/env python3
"""
Generates the artwork for the CantuPneus Story on-site campaign.

Two shapes, because Dengage's Story template uses two kinds of image:

  covers  square, cropped to a circle in the rail. One per story set, so five.
  slides  portrait 1080x1920, the full-screen story frame. The panel renders
          the CTA button itself, so every slide leaves its lower fifth clear.

Output goes to cantu-pneus/en/images/story/ and is committed, because the repo
rule is that a demo never depends on a third-party image host. The panel takes
absolute URLs, so paste the salil-dengage.github.io form (see
cantu-pneus/panel-content/story/README.md).

Every id in a file is prefixed with that file's slug. Inline several of these
into one document without it and all the gradients resolve to the first
definition, which is a trap this repo has already paid for once.

    python3 tools/assets/story.py
"""
import os
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]
OUT = REPO / 'cantu-pneus/en/images/story'

PURPLE = '#4E018F'
PURPLE_DK = '#35015F'
INK = '#1A1030'
YELLOW = '#FFE958'
CREAM = '#F6F4FA'

# One entry per story set: the rail circle plus its slides.
SETS = [
    {
        'slug': 'truck',
        'label': 'Truck',
        'tint': ('#4E018F', '#2A0148'),
        'motif': 'lug',
        'slides': [
            {'slug': 'truck-1', 'kicker': 'Truck line',
             'head': 'Built for the\nlong haul',
             'body': '295/80 R22.5 drive and trailer, cut-resistant compound,\ncasing rated for multiple retreads.',
             'stat': '12,000', 'statlabel': 'tyres in ready stock'},
            {'slug': 'truck-2', 'kicker': 'Retreadable',
             'head': 'Three lives\nper casing',
             'body': 'Reinforced belt package holds its shape, so the same\ncasing comes back twice after the first tread.',
             'stat': '3x', 'statlabel': 'retread cycles per casing'},
            {'slug': 'truck-3', 'kicker': 'Fleet pricing',
             'head': 'From twenty\ntyres up',
             'body': 'Tiered wholesale price list, scheduled delivery and\ninvoicing inside 24 hours.',
             'stat': '24h', 'statlabel': 'to invoice'},
        ],
    },
    {
        'slug': 'passenger',
        'label': 'Passenger',
        'tint': ('#5B1BA8', '#2F0A5C'),
        'motif': 'rib',
        'slides': [
            {'slug': 'passenger-1', 'kicker': 'Passenger line',
             'head': 'Quiet on\nthe highway',
             'body': 'Asymmetric rib pattern from 175/70 R13 up to 235/45 R18,\ntuned for wet grip and low noise.',
             'stat': '40+', 'statlabel': 'sizes in stock'},
            {'slug': 'passenger-2', 'kicker': 'Wet braking',
             'head': 'Shorter stop,\nfull tread',
             'body': 'Four circumferential channels clear standing water at\nspeed instead of floating on it.',
             'stat': 'A', 'statlabel': 'wet grip class'},
        ],
    },
    {
        'slug': 'agricultural',
        'label': 'Agricultural',
        'tint': ('#3F6212', '#1F3606'),
        'motif': 'bar',
        'slides': [
            {'slug': 'agricultural-1', 'kicker': 'Agricultural line',
             'head': 'Traction in\nwet soil',
             'body': 'R1W deep bar tread for tractors and implements,\n12.4-24 through 18.4-34.',
             'stat': 'R1W', 'statlabel': 'deep bar tread'},
            {'slug': 'agricultural-2', 'kicker': 'Harvest ready',
             'head': 'Less time\nin the shed',
             'body': 'Stocked per distribution centre through the season, so a\nchange does not stop the run.',
             'stat': '4', 'statlabel': 'distribution centres'},
        ],
    },
    {
        'slug': 'industrial-otr',
        'label': 'Industrial and OTR',
        'tint': ('#9A3412', '#4A1607'),
        'motif': 'block',
        'slides': [
            {'slug': 'industrial-otr-1', 'kicker': 'Industrial and OTR',
             'head': 'Loaders,\nlifts, quarries',
             'body': 'AL37 and E3 patterns for wheel loaders and forklifts,\n8.25-15 through 17.5-25.',
             'stat': 'E3', 'statlabel': 'earthmover rating'},
            {'slug': 'industrial-otr-2', 'kicker': 'Cut resistance',
             'head': 'Rock does\nnot win',
             'body': 'Extra-deep tread and a puncture-resistant carcass for\nquarry and demolition floors.',
             'stat': '+40%', 'statlabel': 'tread depth over standard'},
        ],
    },
    {
        'slug': 'wheels-tubes',
        'label': 'Wheels and tubes',
        'tint': ('#1F4E79', '#0C243B'),
        'motif': 'rim',
        'slides': [
            {'slug': 'wheels-tubes-1', 'kicker': 'Wheels and tubes',
             'head': 'The parts\naround the tyre',
             'body': 'Steel rims, inner tubes, flaps and valves for every line\nwe carry, ordered on the same invoice.',
             'stat': '1', 'statlabel': 'invoice for the whole axle'},
            {'slug': 'wheels-tubes-2', 'kicker': 'Same-day pairing',
             'head': 'Fitted before\nit ships',
             'body': 'Ask for the rim mounted and balanced with the tyre and it\nleaves the centre ready to bolt on.',
             'stat': '0', 'statlabel': 'extra trips to a fitter'},
        ],
    },
]


def motif(kind, p):
    """Line-specific tread motif, drawn in the cover circle."""
    if kind == 'lug':          # chunky drive-axle blocks
        return ''.join(
            f'<rect x="{58 + i * 46}" y="{96 + (i % 2) * 26}" width="30" height="120" rx="7" '
            f'fill="#fff" opacity="{0.30 + (i % 3) * 0.14:.2f}"/>' for i in range(5))
    if kind == 'rib':          # fine circumferential ribs
        return ''.join(
            f'<rect x="{50 + i * 30}" y="70" width="12" height="172" rx="6" '
            f'fill="#fff" opacity="{0.24 + (i % 4) * 0.13:.2f}"/>' for i in range(7))
    if kind == 'bar':          # angled agricultural bars
        return ''.join(
            f'<rect x="{40 + i * 44}" y="60" width="26" height="190" rx="10" '
            f'fill="#fff" opacity="{0.28 + (i % 3) * 0.15:.2f}" '
            f'transform="rotate({-26 if i % 2 == 0 else -18} 156 156)"/>' for i in range(6))
    if kind == 'block':        # deep OTR blocks
        return ''.join(
            f'<rect x="{54 + (i % 3) * 68}" y="{78 + (i // 3) * 78}" width="52" height="58" rx="9" '
            f'fill="#fff" opacity="{0.26 + (i % 4) * 0.13:.2f}"/>' for i in range(6))
    # rim: concentric wheel
    return (f'<circle cx="156" cy="156" r="82" fill="none" stroke="#fff" stroke-width="16" opacity=".38"/>'
            f'<circle cx="156" cy="156" r="44" fill="#fff" opacity=".30"/>'
            + ''.join(f'<circle cx="{156 + 62 * __import__("math").cos(i * 1.0472):.1f}" '
                      f'cy="{156 + 62 * __import__("math").sin(i * 1.0472):.1f}" r="9" '
                      f'fill="{p}" opacity=".9"/>' for i in range(6)))


def cover(s):
    """Square cover, cropped to a circle by the panel. 312x312."""
    p = s['slug']
    a, b = s['tint']
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 312" width="312" height="312" role="img" aria-label="{s['label']}">
  <defs>
    <linearGradient id="{p}-cover-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/>
    </linearGradient>
    <clipPath id="{p}-cover-clip"><circle cx="156" cy="156" r="156"/></clipPath>
  </defs>
  <g clip-path="url(#{p}-cover-clip)">
    <rect width="312" height="312" fill="url(#{p}-cover-bg)"/>
    {motif(s['motif'], b)}
    <circle cx="156" cy="156" r="156" fill="none" stroke="{YELLOW}" stroke-width="10" opacity=".9"/>
  </g>
</svg>
'''


def slide(s, sl, index, total):
    """Portrait 1080x1920 story frame. Lower fifth stays clear for the panel CTA."""
    p = sl['slug']
    a, b = s['tint']
    head = sl['head'].split('\n')
    body = sl['body'].split('\n')
    # progress pips, so a set of three reads as a sequence
    pips = ''.join(
        f'<rect x="{72 + i * (936 / total)}" y="72" width="{936 / total - 12:.0f}" height="6" rx="3" '
        f'fill="#fff" opacity="{1 if i == index else 0.3}"/>' for i in range(total))
    heads = ''.join(
        f'<tspan x="72" dy="{0 if i == 0 else 104}">{line}</tspan>' for i, line in enumerate(head))
    bodies = ''.join(
        f'<tspan x="72" dy="{0 if i == 0 else 46}">{line}</tspan>' for i, line in enumerate(body))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" role="img" aria-label="{s['label']}: {sl['head'].replace(chr(10), ' ')}">
  <defs>
    <linearGradient id="{p}-bg" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <linearGradient id="{p}-veil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INK}" stop-opacity=".55"/>
      <stop offset="0.42" stop-color="{INK}" stop-opacity="0"/>
      <stop offset="1" stop-color="{INK}" stop-opacity=".82"/>
    </linearGradient>
    <clipPath id="{p}-frame"><rect width="1080" height="1920" rx="0"/></clipPath>
  </defs>
  <g clip-path="url(#{p}-frame)">
    <rect width="1080" height="1920" fill="url(#{p}-bg)"/>

    <!-- tread motif, scaled up as the frame's texture -->
    <g transform="translate(300 620) scale(3.1)" opacity=".22">{motif(s['motif'], b)}</g>
    <circle cx="890" cy="360" r="300" fill="{YELLOW}" opacity=".07"/>
    <rect width="1080" height="1920" fill="url(#{p}-veil)"/>

    {pips}

    <text x="72" y="150" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30"
          font-weight="700" letter-spacing="6" fill="{YELLOW}">{sl['kicker'].upper()}</text>

    <text x="72" y="820" font-family="'Barlow Condensed', Impact, sans-serif" font-size="112"
          font-weight="600" fill="#ffffff">{heads}</text>

    <text x="72" y="1030" font-family="Inter, Helvetica, Arial, sans-serif" font-size="38"
          fill="#ffffff" opacity=".84">{bodies}</text>

    <!-- the one number this frame is making -->
    <g transform="translate(72 1180)">
      <rect x="0" y="0" width="6" height="150" rx="3" fill="{YELLOW}"/>
      <text x="34" y="86" font-family="'Barlow Condensed', Impact, sans-serif" font-size="120"
            font-weight="600" fill="{YELLOW}">{sl['stat']}</text>
      <text x="34" y="132" font-family="Inter, Helvetica, Arial, sans-serif" font-size="32"
            fill="#ffffff" opacity=".72">{sl['statlabel']}</text>
    </g>

    <!-- brand mark, bottom left. Everything below y=1560 is left clear so the
         panel's own CTA button has room. -->
    <g transform="translate(72 1450)">
      <rect x="0" y="0" width="58" height="58" rx="15" fill="#ffffff" opacity=".16"/>
      <g transform="translate(11 17) scale(0.3)" stroke="#fff" stroke-width="13" stroke-linecap="round" fill="none">
        <path d="M52 18 H32 a14 14 0 0 0 0 28 h20"/><path d="M68 46 H88 a14 14 0 0 0 0-28 H68"/>
      </g>
      <text x="76" y="39" font-family="'Barlow Condensed', Impact, sans-serif" font-size="40"
            font-weight="600" letter-spacing="3" fill="#ffffff">CANTUPNEUS</text>
    </g>
  </g>
</svg>
'''


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for s in SETS:
        f = OUT / f"cover-{s['slug']}.svg"
        f.write_text(cover(s), encoding='utf-8')
        written.append(f)
        total = len(s['slides'])
        for i, sl in enumerate(s['slides']):
            f = OUT / f"slide-{sl['slug']}.svg"
            f.write_text(slide(s, sl, i, total), encoding='utf-8')
            written.append(f)
    for f in written:
        print(f"{f.relative_to(REPO)}  {f.stat().st_size / 1024:.1f} kB")
    print(f"\n{len(SETS)} covers, {len(written) - len(SETS)} slides, {len(written)} files")


if __name__ == '__main__':
    main()
