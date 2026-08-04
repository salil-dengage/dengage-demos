# Decisions, gotchas and open items

How this project integrates with the platform, the decisions taken and the
reasoning behind them, and what is still open. If something in this
repository looks unnecessarily indirect, the reason is probably here.

---

## Platform behaviour worth knowing

### On-Site content renders in a cross-origin iframe

This was established late, and getting it wrong cost real work, so it is worth
stating plainly.

The panel warns about "script block(s)" when you paste content containing
`<script>`, and content pasted with scripts is not interactive. From that we
concluded the engine injected content with `innerHTML` into the host page, and
built two things on that assumption: pure-CSS interactivity, and an earlier
host-page bridge, a listener on the host page that turned a submit inside the
content into an SDK call.

The first half was right for the wrong reason. The second half cannot work.

On the live site, every message, popup and banner alike, renders in
an `<iframe>` served from `pcdn.dengage.com/onsite-message/initiator.html`,
with the campaign HTML inside that frame and nothing in the host page's DOM.
So:

- **Links navigate the frame,** which is why clicking a popup CTA loaded the
  site *inside* the popup box. Fixed with `target="_top"` on every anchor.
- **A host-page delegated listener never sees clicks in the frame,** because
  it is cross-origin. Our earlier bridge could not receive anything on the
  live site, so the survey, NPS and subscription widgets displayed correctly
  and recorded nothing. The bridge has since been removed.
- **Pure-CSS interactivity is still required,** because the panel strips
  scripts on save, so we cannot ship JS into the frame either.
- **The supported way to collect input** is the engine's own form mechanism:
  content marked `data-dn-form-id="question_form"` or `"subscription_form"`
  gets a handler injected by the engine, which posts `onSubmitForm` /
  `postSubscription` back to the host page over `postMessage`.

Lesson worth keeping: an injection harness that reproduces the *symptom*
(content in the same document) is not proof of the *mechanism*. Confirm the
mechanism against the live site before building on it.

### Nothing reports a click unless the content asks it to

Same root cause, found later, from the same wrong assumption.

Every campaign in the account showed VISITOR and DISPLAY climbing while CLICK,
UNIQUE CLICK and CTR sat at 0, across all nine campaigns, after the popups had
demonstrably been clicked. The reason: our content was not reporting the
clicks. The engine exposes `Dn.sendClick(buttonId)` inside the frame, and a
click is counted when, and only when, the content calls it. A plain `<a>`, or
a `<label>` driving a checkbox, produces no signal on its own.

So a click is a deliberate call from the content, not a side effect of a user
clicking something. Every file now calls `Dn.sendClick()` on its CTA.

Two decisions came out of it:

- **Close controls call `Dn.close()`, never `sendClick`.** Counting a dismissal
  as a click makes CTR meaningless, and in an A/B test it would count a
  dismissal as a conversion, since the click *is* the conversion metric.
- **Close controls keep the CSS `<label for>` fallback alongside
  `onclick="Dn.close()"`.** Two independent paths on the one control the user
  cannot be left without.

This also settles what the A/B demo needs: no `sendClick`, no possible winner.

**Confirmed on published campaigns, 2026-07-30.** The panel strips `<script>`
blocks but **keeps inline event attributes**, so `onclick="Dn.sendClick(...)"`
survives publishing. After republishing the eight files the campaign list moved
off zero: Image Bar and Sticky Bar at 50% CTR, Subscription Popup 40%, Survey
13.33%. Inline handlers are therefore the supported way to reach `window.Dn`
from hand-written content.

### The native question form takes exactly one question

A question form carries exactly one question block; there is no multi-question
question form. The original three-question survey draft had to become one
multi-select question; the 1 to 5 score moved to the NPS scenario, which is
what it was really measuring, and the free-text box was dropped rather than
left on screen collecting nothing.

Two more conventions in the same forms, both deliberate:

- The forms do not use the "Other" free-text option. Do not add one: required
  for correct behaviour with this SDK version. Background: Salil.
- The question forms set `data-dn-is-modal-auto-close-enabled="false"`, so the
  thank-you panel stays on screen after a submit; the subscription form keeps
  auto-close on at 6 seconds. Do not change either setting. Background: Salil.

### A global five-minute cooldown between any two popups

The SDK keeps a per-visitor display history: which campaigns have shown, when,
and whether they were clicked (driving `showEveryXMinutes`, `maxShowCount` and
`dontShowAfterClick`), plus the visitor's pinned A/B variant. On top of that
sits a global five-minute cooldown between *any* two popups.

This is why triggering a second scenario immediately after the first appears
to do nothing, even with "show every 1 minute" and "max 100" configured. The
campaign settings are fine; the global cooldown applies first.

Clearing cache and cookies would let the second popup show, but it is
heavy-handed and throws away the device identity that ties a demo's events
together.

**What we do instead:** a **Reset displays** button in each site's launcher
clears the visitor's On-Site display history, the popup cooldown and the A/B
pinning, then reloads. `deviceId`, `contactKey` and the push subscription are
deliberately untouched. Verified end to end against the live site: scenario
shows, second is held back, one reset, second shows, same `deviceId`
throughout.

### Banner and Popup layouts need different CSS

The Popup container is centred and sized by the campaign's design settings.
The Banner container is *already* `position: fixed` and full width.

Content written for one breaks in the other. Full-bleed CSS
(`position: fixed`, `100vw`) in banner content double-positions and renders
clipped in the panel preview, because the preview is a simulated browser
window inside the page rather than a real viewport. Banner content must be
ordinary in-flow `width: 100%`.

In both layouts the container's own white background and padding show as a
frame around the card, so design settings need **padding 0 and a transparent
background**.

### Top banners cover a fixed site header

Nothing in the campaign can fix this, because the engine's container sits
outside the content's reach (and may be an iframe). `js/bannerOffset.js`
solves it from the site: it watches only for `_dn_onsite-banner`, and while
one is pinned at the top it pushes `.site-header` down by the banner's
measured height, restoring it on close. Bottom banners, popups and overlays
are explicitly ignored.

### The service worker filename is not ours to choose

The account's SDK configuration supplies both the worker URL,
`/dengage-webpush-sw.js`, and the VAPID `applicationServerKey`. The worker has
to be at the **origin root** under **that exact name**. We briefly renamed it
and broke registration; the name and location are fixed by the account
configuration and are not ours to choose.

Because these demos are served from a project path
(`salil-dengage.github.io/dengage-demos/...`), the origin root is a
**different repository**: `salil-dengage/salil-dengage.github.io`.

### SVG gradient ids are document-scoped

Sixteen separate SVG files each defining `id="card"` are fine as `<img>`
sources, but inline several into one document and they all resolve to the
first definition, so every product silently renders in the first product's
colours. `tools/assets/finassets.py` prefixes every id per file to make this
impossible.

### Only Popup and Banner content is sandboxed; inline content is not

The iframe warning everywhere in these docs applies to the **Popup and Banner
layouts** only. Inline content is injected straight into the page: the `<style>` is
appended to `document.head`, the HTML is cloned into the target selector, and
the `<script>` runs through `new Function()` in the page's global scope.

So the rules invert on the inline path. Anchor clicks are counted **without**
`Dn.sendClick()`, because the SDK attaches its own listener to every `a[href]`
it injects. And inline CSS is **not scoped**: it lands in the document head and
applies to the whole page, so every selector has to be namespaced under its own
root id or it will restyle the site. Full detail in
`docs/DENGAGE-INTEGRATION.md` §5.9.

### Customization tags are refused on real-time On-Site campaigns

The panel will not save a real-time On-Site Targeting campaign whose content
contains `{%= ... %}`:

> We currently do not support customization tags for real-time On-Site Targeting
> campaigns. Please remove customization to create a campaign, or save your
> content and use it in a campaign flow to use customization.

The tags are not the problem. The panel's Preview resolves them correctly
against a real contact, so the templates in
`cantu-pneus/panel-content/personalized/` are right. The restriction is on the
trigger type. Options and the recommendation are in §5.9; the short version is
that a campaign flow keeps the tags, and an inline campaign personalized by its
own script sidesteps them entirely.

### The wishlist writes `wishlist_events` directly

`js/wishlist.js` writes wishlist rows with
`sendDeviceEvent('wishlist_events', ...)`, carrying `event_type` (`add` or
`remove`) and `is_used` explicitly on every row. Do not change this to another
call: required for correct behaviour with this SDK version. Background: Salil.
`searchwishtest.js` guards it.

### A 200 from the event API does not mean the row landed

Worth internalising beyond the wishlist. `/api/web/event` answers 200 with an
empty body: a 200 means the request was accepted, and a captured request only
proves the browser did its job. **The row in Data Space is the only proof an
event landed.** This produced a confident and wrong "the events are coming in"
once, corrected only because the table kept saying otherwise.

To confirm a table is filling: send a row with a distinctive marker value in an
id column, then find that row in Data Space.

### `Number(null)` is 0, and it made every wishlist event lie

`js/wishlist.js` normalizes an item, and because `toggle()` normalizes before
calling `add()`, which normalizes again, every field makes the trip twice. Stock
was read with `Number(raw.stock)`, so a null stock became `0` on the second
pass, and every wishlist event went out with `stock_count: 0`. A
back-in-stock campaign reading that table would conclude the whole catalogue was
out of stock.

The lesson generalises: **any normalize function that can be applied twice must
be idempotent.** `countOrNull()` exists only to keep absent, `null` and `''`
all mapping to `null`.

### The header had no room left for another button

Before search and saved items were added, the nav's right edge met its
container's right edge to the pixel at both 1280 and 1440, because the gap
between nav items is 4rem and there were already eight of them. Adding two
42px buttons pushed the cart button off the right of the screen on all three
English sites.

Worth remembering before adding a third control: **there is no slack in that
header.** `js/searchPanel.js` makes its own room by adding a `dns-nav-compact`
class to a nav it has put a button in and tightening the gap in three steps.
Anything further needs the gap tightened again or a nav item removed.

---

### Language leaks go BOTH ways, and attributes leak most

For a long time only one direction was checked: the English sites were swept for
Portuguese, and the Portuguese site was not swept at all, on the reasoning that
it is "legitimately Portuguese". That left real faults live on both sides:

| Site | Leak |
|---|---|
| EN | `aria-label="Diminuir quantidade"` and `"Aumentar quantidade"` on the cart quantity buttons |
| EN | `'Esgotado'` as the out-of-stock label on the product page |
| BR | `Remove` on the cart row, `Unavailable` on a sold-out card, `Your cart is empty.`, `Purchase successful.` |
| BR | `aria-label="Decrease quantity"` / `"Increase quantity"` on the product page |
| BR | `aria-label="Close"` on four of the local widgets |

Two lessons worth keeping.

**Attributes leak more than text**, because they are invisible on screen and
nobody proofreads them. `aria-label`, `placeholder`, `alt` and `title` all need
translating and all need sweeping.

**A word list is only as good as its words.** The Portuguese list had no entry
for "Diminuir", "Aumentar", "quantidade" or "Esgotado", which is precisely why
those four sat on the English site through several passes. When adding UI, add
its vocabulary to the list in `tools/verify/sites.js` at the same time.

`ptsweep.js` now runs in both directions, driven by `sweep.forbid` per site, and
covers the search panel, the saved-items drawer and the cart rows, all of which
were built after the sweep was written.

### "Is there English on it" is not the same as "is the Portuguese good"

A word-list sweep cannot see a missing accent. `coracao` for `coração` passes
every check and reads as broken to any Brazilian. Same for mojibake, where
latin-1 bytes read as UTF-8 turn `ç` into `Ã§`: it renders as garbage and every
structural test still passes.

`tools/verify/pttext.js` covers that gap. It checks the Portuguese panel content
and the `pt` branch of the shared modules for unaccented spellings of words that
always carry an accent, and for mojibake byte patterns. It found exactly one
fault on its first run, `coracao` in the saved-items empty state, written the
same day by the same hand that wrote the sweep.

Ambiguous words are skipped rather than guessed: `esta`, `so`, `ja` and `ate`
are real words as well as unaccented forms, so context would be needed and a
false positive is worse than a miss here.

## Decisions taken

### The eight Default Scenarios: unprefixed on the finance sites, prefixed on CantuPneus

> **This section describes a decision that was later half reversed.** Read it
> with "The scenario prefix, now switched ON" further down, which is the
> current state.

The original decision was that the eight panel-driven slugs stay unprefixed on
every site, unlike the local widget events (`fintech_`, `banking_`).

**Why:** those campaigns live in the panel with display condition `/.*/`, so
one campaign per slug fires everywhere with zero additional setup. Prefixing
them would mean building more campaigns for every extra site.

**The trade-off:** one campaign holds one piece of content, so those eight
widgets showed Portuguese content on the English and finance sites while
everything else was English.

**What changed.** Adding the English and Russian CantuPneus sites made that
trade-off unacceptable for those sites, so the prefix was switched on for the
three CantuPneus sites only:

| Site | Fires | Served by |
|---|---|---|
| `cantu-pneus/` | `br_survey`, ... | the `br_` campaigns |
| `cantu-pneus/en/` | `en_survey`, ... | the `en_` campaigns |
| `cantu-pneus/ru/` | `ru_survey`, ... | the `ru_` campaigns |
| `fintech/`, `banking/` | `survey`, ... unprefixed | the original campaigns |

**The finance sites still carry the original trade-off**: their eight Default
Scenarios show CantuPneus content, and a CTA clicked there lands on a tyre
shop. Fixing it means a `fintech_` / `banking_` scenario prefix plus 16 more
campaigns, which is a small code change (one constant per site) and real panel
work. Not yet done.

**Never delete the unprefixed campaigns.** Two sites depend on them.

### The three misspelled slugs are kept

`subscripton-popup`, `horizonal-popup`, `stickey-bar`. They are part of the
contract with the panel; correcting them would break every campaign.

### REVERSED: the application funnel is no longer mapped onto the ecommerce API

**Superseded on 31 July 2026. Kept because the original reasoning is sound and
explains why the code looked the way it did.**

The original decision: on the finance sites there is no shopping cart in the
retail sense, but "products added to an application" maps cleanly onto
`ec:addToCart` / `ec:beginCheckout` / `ec:order`. Doing it that way populates
the **standard** Data Space tables with their real columns, which is a much
stronger demonstration than writing to a custom table, and it is what the event
panel shows.

**Why it was reversed.** The argument holds for the tables and fails for the
columns. `shopping_cart_events` wants `quantity` and `unit_price`;
`order_events` wants a `shipping_method` and a basket total; `wishlist_events`
wants `stock_count`. A card, a loan and a mortgage have none of those, so every
one of them is either faked or left null, and a prospect reading Data Space
during a demo sees a retail schema with a bank's name on it. That is worse than
a custom table, not better, because it is the schema itself that says "this was
not built for you".

It also produced the deeper problem: the FinTech site was forked from the tyre
storefront and, because the ecommerce mapping made a cart *look* justified, the
cart, the product grid, the checkout and a price-with-discount catalogue all
survived into what was supposed to be a money app.

**What replaces it.** `pageView` stays, because a page view is a page view in
any industry and the standard table is the right home for it. Every `ec:*` call
goes. The journey lands in Big Data tables built per domain, with columns that
mean something in finance: `monthly_fee` rather than `price`, `apr` and `aer`,
`kyc_status`, `balance_band`, `credit_score_band`, `merchant_category`.

Full specification for NovaPay: `fintech/EVENT-MODEL.md`. Meridian Bank needs
the same treatment and it belongs to the Banking session.

**The general lesson:** when a mapping requires you to fake a column, the
mapping is wrong. Reaching a standard table is not worth arriving there with
invented data.

### Each site is a full copy rather than a shared library

The five sites duplicate `js/`, `images/`, `vendor/` and the stylesheet
instead of sharing them. That is deliberate: the sites are demo assets edited
under time pressure, often mid-call, and a shared library means a change for
one prospect can break another's demo. Isolation is worth the duplication
here.

Isolation is enforced, not assumed: element ids, CSS classes, the
localStorage cart key and the `<brand>:cart:updated` custom events are all
namespaced per site, so three demos open in one browser keep separate carts
and widget state.

### The Mega Banner no longer runs on page load

`sliderBanner.js` used to build its section on `DOMContentLoaded`, so by the
time the presenter clicked "Mega Banner" the section already existed and the
click did nothing visible. It now only runs when the launcher calls it.

### Card alignment is one CSS layer, not per-widget fixes

Product cards come from four different renderers with different class names.
Rather than patching each, one block at the end of each stylesheet governs
them all: equal-height cards per row, a fixed two-line name slot, a
single-line price row, and the cart button pinned to the card base. It uses
`!important` on purpose, because widgets inject their own `<style>` after the
site stylesheet.

---

## Open items

### The custom push prompt configuration is not finished

The web application's custom permission prompt is not yet configured to show
on these sites. The launcher's push button calls `showCustomPrompt()` and, if
permission is still pending after a few seconds, follows with the browser's
native prompt, so the button always completes the flow. **Parked at the user's
request**; the remaining work is the custom-prompt configuration on the web
application.

### Demonstrate push with a real campaign send

Use an actual campaign send when demonstrating web push. That exercises the
full delivery path a subscriber sees, notification and all.

### Copy to sanity-check before a call

CantuPneus figures (founded 2006, Itajaí SC, 31 branches, 4 distribution
centres, brand list) come from public sources. NovaPay and Meridian Bank are
entirely fictional, and their rates and figures are illustrative; both sites
carry a footer disclaimer saying so, which matters because financial
promotions are regulated.

### Recommendation containers are not wired

`<BRAND>_RECO_CONTAINERS` in each `js/allReco.js` has no real container keys,
so all five recommendation widgets run on the local product feed. Fine for a
demo, but it is a fallback, not the real recommendation engine.

---

## Testing notes for whoever comes next

- The suites in `tools/verify/` are the fast way to check you have not broken
  anything: `tools/verify/run.sh` covers all five sites.
- **Beware selectors in tests.** Element ids are namespaced per site, so a
  suite must read the namespace from `tools/verify/sites.js` rather than
  hard-coding `#cantupneus-...`. Several apparent widget failures during
  development were stale test selectors, not broken widgets.
- `ptsweep.js` is the highest-value suite when adding or translating a site:
  it walks the rendered text of both pages and all 21 widgets looking for
  Portuguese and for wording belonging to another industry. It caught leaks
  that reading the diff did not.
- A full-page screenshot is misleading on these sites: sections reveal on
  scroll, so `fullPage: true` captures them at opacity 0 and the page looks
  half empty. Use `secshot.js`, which scrolls section by section.
- Chromium in this environment has no outbound access, so the suites fulfil
  every non-local request empty. That also makes them deterministic. Suites
  that need the real SDK (`live-display-reset.js`) drive the live GitHub
  Pages site through a curl bridge instead.

---

# Session of 30-31 July 2026: the three-language build, and what it taught

Added when the Russian site landed and the eComm demo was tagged v1.0. Kept
separate rather than merged above, so the chronology stays readable.

## HTML that works in the panel, and HTML that does not

Learned the hard way, one live bug at a time. `paneltest.js` enforces all of it.

**Does not work:**

- **`<script>` blocks.** The panel strips them on save. Interactivity has to be
  pure CSS plus inline `onclick` attributes, which do survive.
- **Links without `target="_top"`.** Popup and Banner content is in a
  cross-origin iframe, so a normal link navigates the popup, not the page.
- **A second close button on a Popup.** The panel draws its own via Layout >
  Close Button > "Add close button to outside". Two of them reads as a
  duplicate. **Banners are the exception**: Banner layout is not offered that
  setting, so `stickey-bar.html` and `image-bar.html` keep theirs.
- **Customization tags on real-time On-Site Targeting campaigns.** `{%= ... %}`
  is refused by the panel for that trigger type. The tags themselves are
  correct and Preview resolves them.
- **Em dashes and en dashes.** House style, everywhere.
- **Unscoped CSS on the inline path.** Inline content is not sandboxed, so a
  bare `.card { }` leaks to the whole host page. Every selector must sit under
  the file's own `#cantu-*` root.

**Does work:**

- Pure-CSS interactivity: `:checked` siblings, `:hover`, labels driving hidden
  inputs. The score buttons and multi-select chips are all built this way.
- Inline `onclick="Dn.sendClick('id')"` and `onclick="Dn.close()"`.
- The engine's native form contract, `data-dn-form-id="question_form"` or
  `"subscription_form"`, which is the only supported way to capture input.

**The trap that bit hardest:** the `-vh` visually-hidden helper class looks like
close-button plumbing and is not. In `survey.html` and `nps-popup.html` it hides
the real radios and checkboxes behind the styled buttons. Removing it while
stripping close buttons unstyled the entire NPS 0-to-10 row. `paneltest.js` now
fails any file that uses a `-vh` class without a rule for it.

## Adding a third language

The pattern, in the order it has to happen:

1. Copy the EN site wholesale. Structure, images and vendor libs carry over.
2. Translate the two pages, then the JS that carries copy. **Diff the pt and en
   copies of each JS file** to find exactly which strings are translatable;
   guessing from string literals produces enormous noise.
3. Translate the product catalogue JSON: `category`, `desc`, `colors`, and the
   accessory `name`s. Category paths are localised per site, which BR
   established, so `Tires > Truck > Lug` becomes `Шины > Грузовые > Ёлочка`.
   **Keep `allReco.js`'s `match:` strings in step with them** or the tab widget
   silently matches nothing.
4. Set `<html lang>` and `SCENARIO_EVENT_PREFIX`.
5. Build the panel content set, pointing its CTAs at the new site.
6. Register the site in `tools/verify/sites.js` and `run.sh`.

**Shared modules take the language, not a fork.** `searchPanel.js` and
`wishlistUi.js` used to be a binary `PT ? {} : {}`. They now key a `COPY` table
off `<html lang>` and stay byte-identical across all five sites.

**A near-miss worth remembering.** Russian needs three plural forms, so a
`plural()` helper went in. Applying the Slavic rule to every language looks free
because `resultsFew === resultsMany` in pt and en, and it is not: the rule
returns the **singular** at 21, 31, 41, so English would have started printing
"21 result". The helper is now scoped to Russian. This was caught by diffing the
new copy tables against the old ones value by value, not by any test.

## Russian copy: different failure modes from Portuguese

`rutext.js` exists because `pttext.js` checks the wrong things for Cyrillic.

- **Mixed script is the real hazard.** Cyrillic `а е о с р х` and Latin
  `a e o c p x` are visually identical. Copy produced by editing English in place
  ends up with words that render perfectly and break search, copy-paste and
  screen readers. Proven to be caught by injecting one Latin `o` into `Грузовые`.
- **Count agreement has three forms**: `21 типоразмер`, `32 типоразмера`,
  `48 типоразмеров`, and the teens all take the third.
- **Guillemets, not straight quotes**: `«ёлочка»`. The checker skips quotes
  preceded by `=`, since those are HTML attribute delimiters inside JS strings.
- **`ё` consistency** across the whole body of copy, not per file.
- Number formatting is `ru-RU`, and word order differs: `осталось 6`, not
  `6 left`.

## The scenario prefix, now switched ON

All three CantuPneus sites fire prefixed events. The rule that matters:

> A scenario appears only if a campaign exists with that exact trigger name.
> Missing campaign means the widget is **silently dark**. Nothing errors.

This was nearly shipped as a real regression: turning the prefix on before the
campaigns existed would have taken 8 scenarios plus the A/B test dark on two
sites at once. It shipped switched off and was flipped only once the campaigns
were confirmed in the live manifest.

**How to check a campaign really exists:** open it in the panel, confirm it is
Active with the exact trigger name, and use Preview
(`?dn_content_preview=true`) to see the content render on the site. Preview
proves the content; the trigger name and Active status are what keep the
scenario from being silently dark.

At the time of writing there are 8 campaigns each for `br_`, `en_` and `ru_`.
Before demoing the A/B button, confirm the `ab-testing` campaign is live; if
it is missing, that button is silently dark like any other scenario.

## Duplicated config is a bug waiting to happen

Two failures in one session from the same cause: a suite keeping its own copy of
something that belongs to `sites.js`.

- `TRACKS_STOCK` was a local map in `searchwishtest.js`. Adding the RU site set
  it in `sites.js` and not there, so the suite asserted the opposite of the truth.
- `'Exibir'` was hard-coded in `review.js` and `sdkfull.js` to find launcher
  buttons. Translating that label broke both suites.

Both now read from `sites.js` (`tracksStock`, `launcherButton`). **If a value
varies by site, it lives in `sites.js` and nowhere else.**

## The launcher button said "Exibir" on every site

Including both English sites and the new Russian one, from the day each was
forked from the Portuguese original. Found by driving the live sites, not by any
suite: `ptsweep.js` does open the launcher and scan it, but `PT_WORDS` only
covered storefront copy. The word list now covers launcher chrome too, verified
by re-introducing the word and watching the sweep go red.

**The general lesson:** a sweep is only as good as its vocabulary. Add new UI
vocabulary to `sites.js` at the same time as the UI.

## Verification: what a v1.0 actually required

Offline suites are necessary and not sufficient. They stub the SDK, so they
prove the site makes the right calls with the right payloads, and nothing about
delivery.

The live probe that closed the gap drove the **published** sites with the real
SDK through a curl bridge, captured the outgoing request bodies, and used
distinct marker contact keys per site (`v10-br-demo`, `v10-en-demo`,
`v10-ru-demo`) so the rows could be found in Data Space afterwards.

Nine tables confirmed: `page_view_events`, `shopping_cart_events` (add and
checkout), `order_events`, `order_events_detail`, `search_events`,
`wishlist_events` (add and remove), `events`, `onsite_events`, and the two
webpush permission tables.

**Cyrillic survives the round trip.** `category_path` goes out as
`Шины > Грузовые > Ёлочка` and `page_title` in full Russian, correctly UTF-8
encoded in the request body.

**Use a dedicated marker key, never `salil-demo`.** Earlier probes used it and
filled Salil's own contact with test devices.
