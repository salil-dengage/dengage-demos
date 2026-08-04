# Dengage demo sites

Five self-contained demo storefronts used to show the Dengage platform live to
prospects: on-site scenarios, page views, ecommerce events, custom events,
recommendations and web push, all firing against a **real** Dengage account.

**For collaborators**

> **History was reset on 2 Aug 2026 and again on 4 Aug 2026
> (owner-authorized).** Every clone made before the latest reset must be
> re-based onto the new root before any further work: git fetch origin &&
> git checkout main && git reset --hard origin/main. Never merge or push
> from a pre-reset clone.

**New here? Read in this order.**

1. This file, for the layout and how to run things.
2. [`CLAUDE.md`](CLAUDE.md), for the rules that must not be broken. Short.
3. [`docs/README.md`](docs/README.md), which says which document answers which
   question.

---

## The sites

| Folder | Brand | Industry | Language | Currency | Scenario events | Widget events |
|---|---|---|---|---|---|---|
| `cantu-pneus/` | CantuPneus | B2B tyre distribution | pt-BR | BRL | `br_` | none |
| `cantu-pneus/en/` | CantuPneus | B2B tyre distribution | English | BRL | `en_` | none |
| `cantu-pneus/ru/` | CantuPneus | B2B tyre distribution | Russian | BRL | `ru_` | none |
| `fintech/` | NovaPay | Digital money app | English | USD | none | `fintech_` |
| `banking/` | Meridian Bank | UK retail and private bank | English | GBP | none | `banking_` |

Two different prefixes, do not confuse them. **Scenario events** name the
panel-driven Default Scenarios, so `br_survey` needs a campaign called
`br_survey` or that widget is silently dark. **Widget events** namespace the 17
locally-coded widgets into their own custom tables.

Published through GitHub Pages from `main`, so **a push is a deploy**:

- https://salil-dengage.github.io/dengage-demos/cantu-pneus/
- https://salil-dengage.github.io/dengage-demos/cantu-pneus/en/
- https://salil-dengage.github.io/dengage-demos/cantu-pneus/ru/
- https://salil-dengage.github.io/dengage-demos/fintech/
- https://salil-dengage.github.io/dengage-demos/banking/

All five load the same Dengage web application (BFSI, account **28**, app guid
`c8d2da44-b982-1925-9ad8-e7caddf0894a`), so a campaign built once can fire on
any of them. That is also why they must stay namespaced from each other.

---

## Repository layout

```
CLAUDE.md               the rules, auto-loaded into every Claude Code session
README.md               this file

cantu-pneus/            pt-BR tyre demo, the reference build
  en/                   English fork
  ru/                   Russian fork
  panel-content/        HTML pasted into the Dengage panel, one file per campaign
    pt/ en/ ru/         one set per language, kept in step
fintech/                NovaPay
banking/                Meridian Bank

docs/                   see docs/README.md for what each file answers
tools/
  verify/               browser suites, run these before pushing
  assets/               SVG generators for the finance sites' artwork

.nojekyll               REQUIRED: Pages runs Jekyll, and "{%" in panel content
                        breaks Liquid. Do not delete.
dengagewebpushsw.js     web push service worker. Path is dictated by the SDK.
```

**Every site has the same shape:**

```
<site>/
  index.html              home: hero, featured product, grid, lines, story, contact
  product.html            product detail, driven by ?id=<sku>
  <brand>-style.css       one stylesheet; the :root token block is the whole theme
  <brand>-main.js         nav, hero rotation, sign-up modal
  <brand>_products.json   the product feed, 16 items
  js/                     the 17 local widgets, cart, renderers, Dengage plumbing
  images/                 products/ and scenes/, committed locally
  vendor/                 swiper, hammer
  README.md               what is specific to this site
```

The sites duplicate their `js/`, `images/`, `vendor/` and stylesheet **on
purpose**. They are sales assets edited under time pressure, and isolation means
a change for one prospect cannot break another's demo.

**Five files are the deliberate exception** and are byte-identical everywhere,
configured per site from `data-*` attributes on their script tag:
`js/wishlist.js`, `js/wishlistUi.js`, `js/searchPanel.js`, `js/identity.js`,
`js/inlineSlotOffset.js`. A suite fails if any copy drifts. See
[`CLAUDE.md`](CLAUDE.md) §1 for who is allowed to change them.

## Several sessions, one branch

Several Claude Code sessions work here at once: `ecomm` owns CantuPneus and the
shared modules, `finance` owns both NovaPay and Meridian, and `fintech` and
`banking` are the narrower single-site lanes. Ownership is enforced rather than
trusted, and nobody runs `git push` directly:

```bash
node tools/verify/ownership.js --session=finance   # did I stay in my lane?
DENGAGE_SESSION=finance tools/verify/push.sh       # merge, verify, then push
```

`push.sh` merges `origin/main` **before** verifying, because a clean text merge
of two correct changes can still be broken. [`CLAUDE.md`](CLAUDE.md) §1.

---

## Running a site locally

Serve from the **repository root** so every site resolves:

```bash
cd <repo>
python3 -m http.server 8101
# http://localhost:8101/cantu-pneus/
# http://localhost:8101/fintech/
```

The Dengage SDK, Google Fonts and GTM come from the network. Without outbound
access the pages still render and the 17 local widgets still work; only the
panel-driven scenarios and web push need the real SDK.

---

## The 25 scenarios

Each site has a floating **scenario launcher** (bottom left) listing 25 On-Site
scenarios in five groups. Two different contracts sit behind it:

- **8 Default Scenarios** have no local code. They are built in the Dengage
  panel and triggered by a dataLayer event whose name is the scenario slug,
  prefixed per site. No campaign means no widget, silently.
- **17 local widgets** are coded in `js/`. The button fires a prefixed dataLayer
  event *and* runs the local function, so the demo works whether or not a
  matching campaign exists.

A second floating panel, **Events**, fires SDK events by hand with realistic
payloads already filled in, so you can show a row landing in Data Space without
touching the site.

---

## Verifying a change

The suites drive real Chromium against the sites and assert what actually
rendered and what the SDK actually received:

```bash
tools/verify/run.sh                 # every suite, every site
tools/verify/run.sh fintech         # every suite, one site
tools/verify/run.sh banking review  # one suite, one site
```

Sites run three at a time; `JOBS=1` restores serial.

Scope the run to what the change can actually reach. Docs need no suite, one
site's own files need `run.sh <site>`, and the five shared modules or anything
under `tools/verify/` need the full sweep with no exceptions.
[`CLAUDE.md`](CLAUDE.md) §4 has the full table;
[`tools/verify/README.md`](tools/verify/README.md) says what each suite checks.

**A passing suite is not proof an event was stored.** A 200 from
`POST /api/web/event` means accepted; the row in Data Space is the only proof.
Fire with a marker contact key and read the table in Data Space.

---

## Regenerating the artwork

Product and scene art for the finance sites is generated SVG, committed so
nothing can fail to load during a demo:

```bash
python3 tools/assets/finassets.py                      # product art
python3 tools/assets/scenes.py                         # hero and section art
python3 tools/assets/story.py                          # Story rail panel art
node    tools/assets/contact-sheet.js <dir> out.png    # visual check
```

The contact sheet writes a PNG. `.gitignore` keeps stray PNGs out of the repo
root on purpose: four of them were committed once and sat there referenced by
nothing.

---

## Status

The **three CantuPneus sites** were verified end to end and tagged `v1.0` on
31 July 2026: nine event tables confirmed live against the published sites with
the real SDK, and the stored rows checked in Data Space. See
[`docs/RELEASE-v1.0.md`](docs/RELEASE-v1.0.md).

**NovaPay and Meridian have not been verified end to end.** Their scenarios
render and the offline suites pass, but there has been no live event probe. Do
not describe them as verified.

If something stops working, reproduce it, check the campaign and panel
configuration first, and ask Salil for the current operational notes before
changing code. See [`CLAUDE.md`](CLAUDE.md) §6.
