# tools/

Nothing here is served to a browser by GitHub Pages. It is the machinery for
checking and generating what is.

| Folder | What it is |
|---|---|
| `verify/` | Browser suites that drive real Chromium against the sites and assert what rendered and what the SDK received. Run before pushing. See [`verify/README.md`](verify/README.md) for what each suite checks. |
| `assets/` | Generators for the committed SVG artwork on the finance sites and the Story rail. Output is committed so a demo cannot depend on a CDN. |

```bash
tools/verify/run.sh                  # all suites, all sites
tools/verify/run.sh fintech          # all suites, one site
tools/verify/run.sh banking review   # one suite, one site
JOBS=1 tools/verify/run.sh           # serial, instead of three sites at a time
```

Scope the run to what the change can reach. The tiers are in
[`../CLAUDE.md`](../CLAUDE.md) §4: docs need no suite at all, one site's own
files need `run.sh <site>`, and the four shared modules or anything under
`verify/` need the full sweep with no exceptions.

**A passing suite is not proof an event was stored.** `POST /api/web/event`
returns 200 whether the row is written or discarded. To prove storage, fire with
a marker contact key and read the table in Data Space. Never use `salil-demo` as
that key.

`assets/` generators overwrite committed files in place:

```bash
python3 tools/assets/finassets.py                   # product art
python3 tools/assets/scenes.py                      # hero and section art
python3 tools/assets/story.py                       # Story rail panel art
node    tools/assets/contact-sheet.js <dir> out.png # visual check, writes a PNG
```
