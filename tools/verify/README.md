# Verification suites

Playwright suites that drive real Chromium against the demo sites and assert
what actually rendered and what the SDK actually received. They exist because
these are demo assets shown live to prospects: a widget that silently stops
rendering, or a payload that quietly changes shape, is only discovered on
stage otherwise.

## Pushing: use push.sh, not git push

Work is split across several sessions (see `CLAUDE.md` §1) and a push is a
deploy, so pushing goes through a wrapper:

```bash
DENGAGE_SESSION=ecomm   tools/verify/push.sh
DENGAGE_SESSION=finance tools/verify/push.sh   # NovaPay and Meridian
DENGAGE_SESSION=fintech tools/verify/push.sh   # NovaPay only
DENGAGE_SESSION=banking tools/verify/push.sh   # Meridian only
```

A session owns a set of demos, not always one: `finance` owns both finance
sites, because the same fix usually belongs in both apps and splitting it
across two pushes lands half of it on a live site. `fintech` and `banking` are
narrower rather than obsolete, and refuse a stray edit to the other site.

It refuses to push files owned by another session, refuses to let a non-eComm
session change the five byte-identical shared modules, runs the suites for the
sites the change reaches plus `<site>/tools/journeytest.js` where it exists,
and only then pushes. Failing suites mean nothing is pushed. `SKIP_SUITES=1`
overrides the suite run.

The session is never inferred from the branch name or the diff. Guessing wrong
is the exact failure the script exists to prevent, so it asks.

## How a suite failure actually reaches the gate (read this before trusting green)

Until 2 August, `run.sh` counted a suite as failed **only** on a non-zero exit
status. 15 of the 25 suites print their own failure banner and exit 0, so
`run.sh` printed `ALL SUITES PASSED` over real failures and `push.sh` let them
through. It hid a genuine FinTech defect from 30 July to 2 August.

`run_target` now captures each suite's **output** as well as its status and
fails on the markers the suites already print:

```bash
|| printf '%s' "$output" | grep -qE '^(FAIL|  FAIL) '
|| printf '%s' "$output" | grep -qE '[0-9]+ (CHECK\(S\)|check\(s\)) FAILED'
|| printf '%s' "$output" | grep -qE '^[0-9]+ (form|viewport|SUITE)'
```

Fixing the runner covers all 25 suites at once rather than trusting 25 files to
remember an exit code. Verified by the FinTech session by planting the defect
back and watching it report `SUITE FAILED: sdkfull on fintech (exit 0)`.

**Checked marker by marker on 2 August**, and one suite is still not covered:

| Suite | Prints on failure | Caught by the runner |
|---|---|---|
| aligntest, modaltest, offsettest, sdkfull, live-display-reset | `  FAIL  ` | yes |
| formtest | `FAIL  <lang>/<file>` | yes |
| pttext, rutext, searchwishtest, slottest, revealtest | `FAIL` | yes |
| **ptsweep** | `FOUND`, `FORBIDDEN COPY` | **NO** |

`ptsweep.js` reports leaked cross-language copy as `FOUND` and
`FORBIDDEN COPY`, never the string `FAIL`, and it does not exit non-zero. It is
the bidirectional language sweep `CLAUDE.md` §7 names for exactly that defect,
so **a Portuguese string leaking into the English site would still pass the
gate.** Fixing it is one line in either file: make `ptsweep` exit non-zero, or
add its markers to the runner. It is left here rather than done quietly because
the runner is shared by every session.

Whatever the runner says, a failure is always visible in the output:

```bash
tools/verify/run.sh > /tmp/run.log 2>&1; grep -nE "FAILURES|^ *FAIL|FORBIDDEN COPY" /tmp/run.log
```

### The failure this used to hide, now fixed

`fintech/js/pageView.js` sent `price` and `discounted_price` on product page
views. `Number(null)` is 0, so a card with no price shipped a fabricated `0` in
both columns, the same trap that produced the `stock_count` bug twice. The
assertion in `sdkfull.js` has covered any site with `usesEcommerceFunnel: false`
since 30 July; banking passed it and fintech did not. The FinTech session
removed both columns on 2 August.

---

## Running them

```bash
tools/verify/run.sh                    # every suite, every site
tools/verify/run.sh fintech            # every suite, one site
tools/verify/run.sh banking review     # one suite, one site
```

`run.sh` starts a static server on port 8101 rooted at the repository root if
nothing is listening there, and stops it again afterwards. Override with
`PORT=8102` or point at something else with `BASE_URL=https://...`.

**Sites run three at a time.** Each site's output is buffered and printed whole
in the usual order, so the log reads the same as it did when this was serial.
`JOBS=1` restores serial. Concurrency changes nothing about what is asserted,
and it is worth only about 15% here because the suites are CPU-bound: a full
sweep measures 10m50, one site 5m15, the panel-content four 37s.

**Run what the change can reach, not everything every time.** The tiers are in
[`CLAUDE.md`](../../CLAUDE.md) §4 and are the standing rule. The short version:
docs need no suite, one site's own files need `run.sh <site>`, and the five
shared modules or anything in this folder need the full sweep with no
exceptions, because those break demos you are not looking at.

Every suite also runs directly, taking the site name as its argument:

```bash
node tools/verify/review.js fintech
```

Known site names: `cantu-pneus`, `cantu-pneus-en`, `cantu-pneus-ru`, `fintech`,
`banking`.

`run.sh` splits the suites in two. The **per-site** ones run once for each of
the five sites: `review`, `sdkfull`, `aligntest`, `modaltest`, `ptsweep`,
`revealtest`, `slottest`, `searchwishtest`, `appevents`. The **panel-content**
ones run once over `cantu-pneus` (`paneltest`, `formtest`, `persotest`,
`offsettest`, `pttext`, `rutext`) and once over `fintech`'s own set
(`paneltest`).

One more never runs automatically, because it needs outbound access:
`live-display-reset.js`.

## Several sessions, one branch

Two scripts here are not suites. They exist because several Claude Code sessions
push to `main` at once and git will merge two disjoint directories without a
word of complaint.

```bash
node tools/verify/ownership.js --session=finance    # did I stay in my lane?
DENGAGE_SESSION=finance tools/verify/push.sh        # merge, verify, then push
```

`ownership.js` classifies every changed path into a lane (`ecomm`, `fintech`,
`banking`, `shared-module`, `asset-tooling`, `tooling`, `docs`, `root`) and
exits non-zero if the session touched one it does not own. It prints the
verification tier the change earns from the same input, because "what did you
change" answers both questions. Touching `tooling`, `root` or a shared module
escalates to the full sweep automatically: those break sites whose session is
not in the room.

**A lane is a demo; a session is a set of lanes.** `finance` owns `fintech` and
`banking` both, so a change spanning the two finance demos is expected and is
checked as one change rather than split across two pushes. It is not inferred
though: name it. A diff reaching two live demos at once is the shape most worth
a human looking at, and inferring it would be the one case waved through
unasked. Anything reaching `cantu-pneus/` as well belongs to no session and
needs Salil.

`push.sh` replaces `git push`. It refuses a dirty tree, merges `origin/main`
**first**, re-runs the lane check, runs the tier against the **merged** diff,
and starts over if main moved while the suites were running.

**The ordering is the whole point.** Verify-then-merge proves nothing about
what you push. On 31 July the concurrent runner and another session's work
merged with zero conflicts and the result was broken: three targets each cleared
the same `/tmp/dengage-verify` before creating it, so one deleted the directory
another was writing into. Only the post-merge run saw it. `run_target` now gives
each target its own `OUT_DIR`.

## Per-site configuration lives in one file

`sites.js` holds each site's path, brand namespace, product ids, currency,
event prefix, table names, expected event-panel payloads and copy-sweep word
lists.

**This matters more than it looks.** Element ids and CSS classes are
namespaced per site on purpose, so the five demos cannot collide in one
browser. A suite therefore cannot hard-code `#cantupneus-head-banner`; it
reads `CFG.ns` instead. During development several apparent widget failures
turned out to be stale selectors in a test rather than a broken widget, so if
a suite reports a widget missing, check the selector before the widget.

When you add a site, add an entry to `sites.js` and add it to `SITES_ALL` in
`run.sh`. Never hard-code a per-site value in a suite. Duplicating one has
caused real failures twice: `TRACKS_STOCK` and `launcherButton` were each held
in two places, and the copy in the suite went on asserting the old truth after
`sites.js` was updated.

## What each suite checks

| Suite | Per site | Checks |
|---|---|---|
| `review.js` | yes | All 25 scenarios. Clicks every launcher button, waits, and asserts the widget's real root element exists with non-zero size. Also records console errors and failed requests per scenario. |
| `sdkfull.js` | yes | The SDK integration end to end: `pageView` on home and product with the right `page_type` and product fields, `ec:addToCart` / `ec:beginCheckout` / `ec:order` with a `cartItems` array, `setContactKey` on sign-up, and that a Default Scenario stays on the page instead of reloading. |
| `aligntest.js` | yes | Product-card alignment across all four card renderers: equal card heights per row and cart buttons sharing one baseline, on the site grid, the classic and popup recommendation widgets and the similar-products slider. Also that the Mega Banner is absent on load and inserts on demand. |
| `modaltest.js` | yes | The Events panel: all 8 cards fire the right SDK verb, numeric columns arrive as numbers, cart calls build `cartItems`, the two custom cards write to that site's custom table, and the destination-table field is locked on the six first-class cards. |
| `revealtest.js` | yes | That every `<section>` actually becomes visible, at 390px, 512px and 1440px, after scrolling the page top to bottom. Sections start at opacity 0 and are revealed by an IntersectionObserver, which failed silently and permanently when the observer's threshold could not be satisfied: a fractional threshold is a share of the observed element, so the ~10900px products section on a 512px viewport needed 1090px on screen in an 800px window. The whole catalogue was invisible on mobile on every site then existing while desktop looked perfect. |
| `ptsweep.js` | yes | Rendered-copy sweep. Walks the visible text, `aria-label`s, placeholders, `alt` and `title` of both pages plus all 21 widgets, the cart drawer, the sign-up modal, the launcher and the event panel, looking for words that should not appear on that site. Bidirectional: English on the pt-BR site, Portuguese on the English and Russian sites, Cyrillic anywhere it does not belong. Its word lists live in `sites.js`, and they cover launcher and panel chrome as well as storefront copy, because the launcher button read "Exibir" on all five sites for weeks while a storefront-only list passed. |
| `pttext.js` | once | The quality of the Portuguese itself, which `ptsweep` cannot judge. Missing accents typed on an ASCII keyboard (`coracao`, `gratis`, `voce`), and mojibake from a latin-1 file served as UTF-8. Covers the Portuguese panel content and the `pt` branch of the shared modules. |
| `rutext.js` | once | The quality of the Russian, whose failure modes are not Portuguese's. Mixed script is the main one: Cyrillic `а е о с р х` and Latin `a e o c p x` are visually identical, so a word edited in place from English renders perfectly and still breaks search, copy-paste and screen readers. Also mojibake, `ё` consistency and guillemets. Proven to work by injecting one Latin `o` into `Грузовые`. |
| `paneltest.js` | once | The eight panel-content files, which nothing else in the repo can guard because they are pasted into the panel by hand. Asserts: no `<script>`, `target="_top"` on every anchor, exactly one `Dn.sendClick` and it is not on the close control, `Dn.close()` present, a native `data-dn-form-id` root on the three capture files, no em or en dashes, no Portuguese, and visually that it renders with height, images resolve, nothing overflows the root, the card fills the engine container at its configured width, and no CSS leaks onto the host page. |
| `formtest.js` | once | Runs **Dengage's own `form-handler.js`** (vendored in `fixtures/`) against the three capture files and asserts the payload that would reach the platform: contact fields for the subscription form, `tyre_line_interest` and `nps_score` tags for the question forms. Also that an empty submit is rejected with the engine's own message, that exactly one click is reported, and that the success reply swaps in the confirmation panel. |
| `slottest.js` | yes | The five Dengage inline target slots, on **every** site (it reads the list from `sites.js`, so a new site is covered automatically): present, empty and hidden so an unused slot costs nothing (an empty cell in the product grid would otherwise take a whole card's space), revealing when filled the way the engine's "Fill" mode fills them, and no console errors from the two renderers that emit them. |
| `persotest.js` | once | The two personalized popups in `panel-content/personalized/`. They carry Dengage's `{% %}` Advanced Personalization syntax, which the platform evaluates server-side, so a browser cannot check them and a template mistake would only surface live. This compiles the same dialect, renders both files against five contact profiles (enriched, urgent, overdue, name-only, and anonymous with a null `$Contact`), and asserts nothing is left raw, no `undefined` reaches visible text, each profile's own values appear, and the result survives a browser. It already caught one real bug: literal delimiters inside an HTML comment, which the engine would have executed. |
| `offsettest.js` | once | That a top Dengage banner pushes the site header down by its measured height and releases it on close, while bottom banners and popups leave the header alone. Simulates the engine's container, including an iframed one. |
| `live-display-reset.js` | manual | Runs against the **live** GitHub Pages site with the real SDK, to prove the global popup cooldown blocks a second scenario and that Reset displays clears it while keeping `deviceId`. Needs outbound access; uses a curl bridge because Chromium cannot reach the proxy directly. |
| `secshot.js`, `shotsite.js` | helpers | Screenshots. `secshot.js` scrolls section by section, which is necessary because these pages reveal on scroll: a `fullPage` screenshot captures revealed sections at opacity 0 and the page looks half empty. |

## Why the suites stub the SDK

Chromium here has no outbound access, so every non-local request is fulfilled
empty and `window.dengage` is replaced with a recorder that pushes each call
into `window.__sent`. That makes the suites deterministic and lets them assert
on exact payloads. The cost is that they do not exercise the real SDK; that is
what `live-display-reset.js` and a manual pass on the live site are for.

## The one suite to run when translating or adding a site

`ptsweep.js`. It reads rendered text rather than source, so it catches strings
that a diff review misses: it found untranslated Portuguese inside
recommendation widget headings, and tyre product names still hardcoded in the
gaming and notification widgets on the finance sites, in both cases after the
code looked clean.

## searchwishtest

```bash
node tools/verify/searchwishtest.js            # every site
node tools/verify/searchwishtest.js fintech    # one site
```

Site search and the wishlist, and the two event contracts behind them. It also
runs as part of `run.sh`, once per site.

The point of the suite is the **payloads**. Both features are easy to make look
right on screen while writing the wrong shape into `search_events` and
`wishlist_events`, and a wrong shape stays invisible until somebody tries to
build a segment on the table months later. So every assertion is against
[the documented contract](https://dev.dengage.com/docs/ecommerce-events) key by
key, **including which keys must be absent**:

| Event | Keys asserted |
|---|---|
| `ec:search` | `keywords`, `result_count`, `filters`, and nothing else |
| `ec:addToWishlist` | `list_name`, `product_id`, `product_variant_id`, `expire_date`, `price`, `discounted_price`, plus `stock_count` only where the catalogue tracks stock |
| `ec:removeFromWishlist` | `list_name` and `product_id`, and nothing else |

It also pins the two behaviours that are judgement calls rather than documented
rules, because both are easy to regress:

- **One event per settled query, not one per keystroke.** The suite types a term
  one character at a time and asserts that nothing has been reported yet, then
  waits for the settle window and asserts exactly one event. It also checks that
  Enter reports immediately, that a filter change with a query present counts as
  a new search, and that the same keywords plus filters pair is not reported
  twice.
- **`stock_count` present only where stock is real.** A number on the three
  CantuPneus sites, absent on fintech and banking. Which sites those are is read
  from `sites.js`, not restated here, after a hard-coded copy asserted the
  opposite of the truth for the Russian site.

Plus the things that broke while building it, so they cannot break again:

- **byte-identity** of `wishlist.js`, `wishlistUi.js`, `searchPanel.js` and
  `identity.js` across all five sites, which is the property that stops five
  copies drifting. Only the eComm session may change them, see `CLAUDE.md` §1
- **header fit at six widths** against the container, not the viewport, because
  the first attempt pushed the cart button off the right of the screen
- **no sideways scroll at 420px** with the drawer open and with the search panel
  open
- **nothing regressed**: add-to-cart still fires `ec:addToCart`, the cart button
  is still alone in the header, and the product page's own add button is intact

### One thing to know if you extend it

Use **a fresh browser context per site**. All five demo sites are served from one
origin, and the Portuguese and English CantuPneus sites share one wishlist
storage key on purpose, since they are the same shop in two languages. Reusing a
context carried saved items from one site's run into the next, and the later site
failed on a badge count that was correct for the state it had inherited.
