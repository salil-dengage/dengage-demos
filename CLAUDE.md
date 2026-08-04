# CLAUDE.md: Dengage demo sites (operating instructions)

> Read automatically at session start. This file is deliberately lean: it holds
> the rules you must not break and tells you which document to read before
> touching what. The depth lives in `docs/`. Read the pointed-to file BEFORE
> changing anything it covers, not after something breaks.

---

## 0. What this repository is

Five self-contained demo storefronts used to show the Dengage platform live to
prospects: on-site scenarios, page views, ecommerce events, custom events,
recommendations and web push, all firing against a **real** Dengage account
(BFSI, account **28**, app guid `c8d2da44-b982-1925-9ad8-e7caddf0894a`).

These are sales assets, often edited shortly before or during a call. Two
consequences shape everything here:

1. **A broken demo is a lost deal.** Verify in a browser, not by reading a
   diff. The suites in `tools/verify/` exist for this.
2. **Sites are isolated on purpose, not DRY.** Each duplicates its `js/`,
   `images/`, `vendor/` and stylesheet so a change for one prospect cannot
   break another's demo. Five files are the deliberate exception, see §1.

| Folder | Brand | Industry | Language | Currency | Scenario events | Widget events |
|---|---|---|---|---|---|---|
| `cantu-pneus/` | CantuPneus | B2B tyre distribution | pt-BR | BRL | `br_` | none |
| `cantu-pneus/en/` | CantuPneus | B2B tyre distribution | English | BRL | `en_` | none |
| `cantu-pneus/ru/` | CantuPneus | B2B tyre distribution | Russian | BRL | `ru_` | none |
| `fintech/` | NovaPay | Digital money app | English | USD | none | `fintech_` |
| `banking/` | Meridian Bank | UK retail bank | English | GBP | none | `banking_` |

Served by GitHub Pages from `main` at
`https://salil-dengage.github.io/dengage-demos/<folder>/`. **A push is a deploy.**

---

## 1. Session ownership, and the five shared files

Work on this repository is split across **separate Claude Code sessions** so
they do not collide. A session is a set of demos somebody owns, which is not
always one demo:

| Session | Owns | Must not modify |
|---|---|---|
| **eComm** (`ecomm`) | `cantu-pneus/` and its `en/`, `ru/`, `panel-content/`, plus the five shared modules | `fintech/`, `banking/` |
| **Finance** (`finance`) | `fintech/` and `banking/`, websites and apps both | `cantu-pneus/**`, the five shared modules |
| **FinTech** (`fintech`) | `fintech/` | `cantu-pneus/**`, `banking/`, the five shared modules |
| **Banking** (`banking`) | `banking/` | `cantu-pneus/**`, `fintech/`, the five shared modules |

**One session owns both finance demos.** NovaPay and Meridian share an SDK, an
app shape and a set of questions, so the same fix usually belongs in both, and
splitting one change across two pushes lands half a fix on a live site. Use
`finance` for that work.

`fintech` and `banking` remain valid and are **narrower**, not obsolete: name
one of them when a change is meant to reach a single site, and a stray edit to
the other is still refused. Neither grants the five shared modules to anyone
but eComm.

**Five files are byte-identical across all five sites by contract**, configured
per site from `data-*` attributes on their script tag:

```
js/wishlist.js   js/wishlistUi.js   js/searchPanel.js   js/identity.js
js/inlineSlotOffset.js
```

`searchwishtest.js` and `slottest.js` fail if any copy drifts.

> **RULE: only the eComm session may change these.** Every other session,
> including `finance`, treats them as **read-only**. If one of them needs a
> change there, it must stop and ask Salil to route it through the eComm
> session. Never fork one for a single site, and never edit only your own copy.

Everything else is per site. Do not edit another site to fix your own. Treat
`cantu-pneus/` (the pt-BR original) as the reference build.

### The rule is enforced, not trusted

Several sessions push to one branch, so ownership that lives only in prose gets
broken by accident. Two scripts make it mechanical:

```bash
node tools/verify/ownership.js --session=finance   # did I stay in my lane?
DENGAGE_SESSION=finance tools/verify/push.sh       # the safe way to land it
```

`ownership.js` classifies every changed path into a lane and fails on anything
outside the session's own, including a shared module. It also prints the
verification tier the change earns.

`push.sh` is what you run **instead of `git push`**. It refuses a dirty tree,
merges `origin/main` **first**, re-checks ownership, runs the tier for the
**merged** diff, and starts over if main moved while the suites were running.

**Merge, then verify. Never verify, then merge.** A clean text merge of two
correct changes can still be broken, and only a post-merge run sees it. That is
not hypothetical: on 31 July the concurrent test runner merged with another
session's work without a single conflict, and the result was broken, because
three suites now raced on one shared screenshot directory. The post-merge run
is what caught it.

Two ways work actually disappears, both banned: **never `git push --force`**,
and **never resolve a conflict by taking one side wholesale**. Keep both sides'
intent, or stop and ask.

---

## 2. Read these before touching the integration

| File | When |
|---|---|
| `docs/README.md` | the index: which document answers which question |
| `docs/DECISIONS-AND-GOTCHAS.md` | **before "fixing" anything that looks oddly indirect.** Most important file here. |
| `docs/DENGAGE-INTEGRATION.md` | any change to events, payloads, tables, the SDK, or adding a site |
| `docs/PANEL-SETUP.md` | anything with a counterpart in the Dengage panel |
| `docs/RELEASE-v1.0.md` | before calling anything verified |
| `cantu-pneus/panel-content/README.md` | any panel content change (eComm session) |
| `tools/verify/README.md` | before running or extending the suites |
| `docs/MOBILE-APP-PLAYBOOK.md` | **before building a mobile app for any site.** Brand-neutral; every trap the first one hit |

Several patterns here look oddly indirect until you know the reasoning behind
them. `DECISIONS-AND-GOTCHAS.md` is why.

---

## 3. Non-negotiables

Breaking any of these breaks a live demo or the panel contract.

1. **The eight Default Scenario slugs keep their spelling everywhere**, including
   the three misspellings, which are part of the panel contract:
   `survey`, `nps-popup`, `subscripton-popup`, `stickey-bar`, `image-popup`,
   `image-bar`, `horizonal-popup`, `cta-image-popup`. Never "correct" one.

   **The per-site prefix is ON for all three CantuPneus sites** and set as
   `SCENARIO_EVENT_PREFIX` in each site's catalogue file. So the BR site fires
   `br_survey`, EN fires `en_survey`, RU fires `ru_survey`. FinTech and Banking
   are unprefixed **deliberately** and serve from the original campaigns.

   A scenario only appears if a campaign exists with that exact trigger name. If
   one is missing, that widget is **silently dark**: nothing errors, it just
   never shows. Check the panel before suspecting the code.
   **Never delete the unprefixed campaigns**: FinTech and Banking depend on them.
2. **Never load the Dengage SDK from GTM.** The SDK is on the page directly; a
   GTM copy double-initialises it. `GTM-NL6J5Z53` must stay free of Dengage tags.
3. **Popup and Banner content renders in a cross-origin iframe.** Every link
   needs `target="_top"`; host-page JS cannot see events inside the content; the
   panel strips `<script>` on save, so interactivity is pure CSS plus inline
   `onclick`; input capture must use the engine's `data-dn-form-id` mechanism.
   `docs/DENGAGE-INTEGRATION.md` §5.2.
4. **Inline content is NOT sandboxed.** The SDK puts the `<style>` in
   `document.head`, clones the HTML into the target selector, and runs the
   `<script>` through `new Function()` in page scope. So anchor clicks are
   counted without `Dn.sendClick()`, and CSS leaks page-wide unless every
   selector is namespaced under its own root id. §5.9.
5. **A click only exists if the content reports it.** The CTA calls
   `Dn.sendClick('<scenario>__<action>')`, once per file. A close control calls
   `Dn.close()` and never `sendClick`, so a dismissal is not counted as a
   conversion. Without it a campaign reads 0 clicks and an A/B test can never
   pick a winner. §5.6.
6. **Popups draw no close button.** The panel supplies it via Layout > Close
   Button > "Add close button to outside". A second one inside the card reads as
   a duplicate. The two **banners keep their own**, because Banner layout is not
   offered that setting. Do not confuse the close control with the `-vh`
   visually-hidden class: in `survey.html` and `nps-popup.html` that class hides
   the real inputs behind the styled score buttons, and removing it unstyles the
   whole row.
7. **Each site is written in ONE language, attributes included.** That covers
   `aria-label`, `placeholder`, `alt` and `title`, which is where leaks hide.
   Verify with `ptsweep.js` (bidirectional), `pttext.js` (Portuguese accents and
   encoding) and `rutext.js` (Russian script, encoding, ё, guillemets). Add new
   UI vocabulary to the word lists in `tools/verify/sites.js` at the same time
   you add the UI.
8. **Russian is Cyrillic, so mixed-script words are the hazard.** Cyrillic
   `а е о с р х` and Latin `a e o c p x` are visually identical; copy produced by
   editing English in place ends up with words that render perfectly and break
   search, copy-paste and screen readers. `rutext.js` catches this.
9. **Keep the sites namespaced.** Element ids, CSS classes, the localStorage cart
   key and `<brand>:cart:updated` events are per site (`cantupneus-*`,
   `novapay-*`, `meridian-*`). This is what lets several demos run in one browser.
10. **The ecommerce API belongs to CantuPneus only.** On the three CantuPneus
    sites, prefer first-class SDK calls (`pageView`, `ec:*`, `setContactKey`)
    over writing to standard tables by hand; the one deliberate exception is the
    wishlist, which writes its table directly with sendDeviceEvent; do not
    change this, background: Salil.

    **The finance sites do not use `ec:*` at all.** A money app and a bank have
    no cart, no basket total and no order, and `shopping_cart_events`,
    `order_events`, `order_events_detail`, `wishlist_events` and `search_events`
    carry columns (`quantity`, `unit_price`, `shipping_method`, `stock_count`)
    that can only be faked there. Instead they use `pageView`, which is
    industry-neutral and stays, plus purpose-built Big Data tables per domain.
    FinTech's are specified in `fintech/EVENT-MODEL.md`. Banking needs the
    equivalent and is the Banking session's to build.

    This reverses an earlier decision; the reasoning is in
    `docs/DECISIONS-AND-GOTCHAS.md`.
11. **`stock_count` is never sent from a finance site**, and on CantuPneus only
    where the catalogue tracks stock. The three CantuPneus catalogues carry a
    `stock` figure; a card or a mortgage has no unit count. Never invent one: a
    fabricated figure poisons every back-in-stock segment.
    Watch `Number(null) === 0`, which has caused this bug twice.
12. **`ec:search` fires once per settled query, never per keystroke** (700ms
    pause, Enter, or a filter change). Otherwise `search_events` records typing
    instead of intent.
13. **All artwork is committed SVG or local raster.** Never reference an external
    image host; a demo must not depend on a third-party CDN.
14. **The site header has no horizontal slack.** Adding a nav control needs room
    made first, in the `dns-nav-compact` rules in `js/searchPanel.js`. Russian
    and Portuguese labels run longer than English; prefer shorter idiomatic
    labels over squeezing shared CSS.
15. **Customization tags (`{%= ... %}`) are refused on real-time On-Site
    Targeting campaigns.** The tags are correct and Preview resolves them; the
    restriction is the trigger type. Do not "fix" the templates in
    `cantu-pneus/panel-content/personalized/`.
16. **The five `dn_inline_target_*` slots exist on every site**, at the same
    anchors, with a byte-identical `js/inlineSlotOffset.js`. Add a slot to one
    site and add it to all, or `slottest.js` fails. Content is the opposite: the
    A/B variants and the Story rail are CantuPneus brand content and must not be
    copied to another industry.
17. **This repository is a public sales asset: everything in it is
    customer-facing.** Files, code comments, UI strings, log and test output,
    commit messages, all of it. Write all of it as product documentation:
    what this project does and how to operate it. Internal engineering notes,
    diagnostics, and vendor correspondence are not content for this repo,
    whatever the session: they go directly to Salil. Workaround code stays
    and carries a neutral comment: "Do not remove: required for correct
    behaviour with this SDK version. Background: Salil."

---

## 4. How to work here

### Run a site

```bash
cd <repo> && python3 -m http.server 8101
# http://localhost:8101/fintech/
```

Serve from the **repository root**, not a site folder, so every site resolves.

### Verify a change: match the check to the blast radius

```bash
tools/verify/run.sh                  # all suites, all sites
tools/verify/run.sh fintech          # all suites, one site
tools/verify/run.sh banking review   # one suite, one site
```

Sites run three at a time. `JOBS=1` forces serial, `JOBS=5` may help on a
machine with more cores and the memory for five Chromiums. Concurrency is worth
roughly 15% here and no more: the suites are CPU-bound, so **scoping the run is
what actually saves time, not parallelism.**

**Run what the change can actually reach, not everything every time.** A full
sweep on a change that cannot touch four of the five sites is not rigour, it is
ten wasted minutes, and the habit of skipping the suite because it is slow is
worse than the rule it replaces.

Timings are measured on this container, not estimates.

| What you changed | What to run | Measured |
|---|---|---|
| Docs, README, comments only | nothing. Check relative links resolve and no em or en dashes crept in | seconds |
| Panel content under `panel-content/` | `paneltest.js`, `formtest.js`, plus `pttext.js` / `rutext.js` if you touched pt or ru copy | 37s |
| App folders only, `<site>/android*/`, one site or both finance apps | each site's `mobiletest.js`, `eventtest.js` and `playbookcheck.js` | 12s |
| One site's own `js/`, HTML, stylesheet or catalogue | `run.sh <site>` | 5m15 |
| Artwork regenerated under `tools/assets/` | `run.sh <affected site>` | 5m15 |
| Both finance websites in one change | `run.sh fintech && run.sh banking` | two site runs, back to back |
| **The five shared modules**, anything in `tools/verify/`, or anything in the SDK plumbing | **full `run.sh`, no exceptions** | 10m50 |

The last row is the one that matters. Those changes break demos you are not
looking at, which is exactly the failure the suites exist to catch. Everything
above it is local enough that a scoped run proves the same thing.

The mobile row is narrow on purpose. A site's app folder is compiled into an
APK, and nothing in it is served by GitHub Pages, so no change inside it can
alter a page the browser suites load. Touch anything outside the app folder in
the same change, panel content or a site's `js/` included, and it is a site
change again. `ownership.js` decides this, so you do not have to.

**Two demos is not automatically the full sweep.** The sites are isolated by
design, so a change spanning `fintech/` and `banking/` cannot reach CantuPneus,
and sweeping all five would spend most of ten minutes proving three untouched
sites still work. The two finance rows above say what that earns instead. The
one thing that always escalates is a change reaching `cantu-pneus/` as well,
which no session owns and which needs Salil.

**Two things are never optional, whatever you changed:**

- If you fixed something, check whether a suite asserted the old behaviour.
  Stale assertions have broken this build repeatedly.
- If a value belongs to a site, put it in `tools/verify/sites.js` and read it
  from there. Duplicating one has caused real failures twice (`TRACKS_STOCK`,
  `launcherButton`).

**When in doubt, run the full sweep.** Being unsure which sites a change can
reach is itself the signal that it reaches more than you think.

### Screenshots

Use `tools/verify/secshot.js`, which scrolls section by section. These pages
reveal on scroll, so a `fullPage` screenshot captures revealed sections at
opacity 0 and looks half empty. That is a screenshot artifact, not a bug.

### Git

> **History was reset on 2 Aug 2026 (owner-authorized).** Every clone made
> before the reset must be re-based onto the new root before any further
> work: git fetch origin && git checkout main && git reset --hard
> origin/main. Never merge or push from a pre-reset clone.

Commit on `main`, then land it with **`tools/verify/push.sh`, not `git push`**.
It merges `origin/main` first, verifies the merged tree at the tier the table
above earns, and pushes only if main has not moved meanwhile. See §1.

```bash
DENGAGE_SESSION=ecomm   tools/verify/push.sh
DENGAGE_SESSION=finance tools/verify/push.sh             # NovaPay and Meridian
DENGAGE_SESSION=fintech tools/verify/push.sh             # NovaPay only
DENGAGE_SESSION=banking tools/verify/push.sh             # Meridian only
DENGAGE_SESSION=ecomm   tools/verify/push.sh --dry-run   # everything but the push
```

It refuses the two mistakes that cost a live demo:

1. **Pushing another session's files.** The split in §1 is otherwise
   honour-based, and a push is a deploy, so one distracted session can put
   another's broken demo live.
2. **Editing one of the five shared modules from a non-eComm session.** They
   are byte-identical by contract; changing one copy breaks the build for all
   five sites.

It also runs `<site>/tools/journeytest.js` where a site has one, for behaviour
the shared suites do not know about. `banking/` has one covering its five
public journeys and its ten-card event panel.

The session is deliberately never guessed from the branch or the diff.
Guessing wrong is the exact failure the wrapper exists to prevent.

**After any commit and push, share the clickable commit link and the
changed-file links** in the reply without being asked:
`https://github.com/salil-dengage/dengage-demos/commit/<hash>`.

---

## 5. Proving something works

**HTTP 200 from `/api/web/event` means accepted, not stored.** The row in Data
Space is the only proof, and skipping that check has produced two confident and
wrong "it is working" claims.

To prove an event actually lands: fire it with a distinctive marker contact key,
then confirm the row in Data Space. Use a dedicated key (`v10-ru-demo`, `diag`,
...), **never `salil-demo`**, or Salil's own contact fills with test devices.

Anonymous visitors are correctly anonymous: `js/identity.js` returns `null` and
leaves `window.__dnInit` undefined, so the SDK initialises with no contact key.
`salil-demo` is only ever assigned by signing up as `salil@dengage.com`, by
`?ck=salil-demo`, or from localStorage set by one of those.

---

## 6. When something stops working

Reproduce the symptom, check the campaign and panel configuration first, and
**ask Salil for the current operational notes** before changing code here. Most
"regressions" in a demo turn out to be configuration, and a code change made on
the wrong diagnosis costs a second debugging cycle on top of the first.

---

## 7. Content and tone for anything client-facing

- **No em dashes or en dashes.** Use commas, periods, colons, or rephrase.
- Plain, confident product language. No filler, no invented metrics.
- The finance sites are fictional brands: keep the footer disclaimer, because
  financial promotions are regulated.
- Match the site's language exactly, attributes included.
