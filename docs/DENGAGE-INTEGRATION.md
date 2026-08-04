# Dengage integration contract

Everything in this file applies to all five demo sites. Where a site
differs, it differs only in its event prefixes and its table names, which are
tabulated below.

Read [`DECISIONS-AND-GOTCHAS.md`](DECISIONS-AND-GOTCHAS.md) alongside this:
several of the rules here capture behaviour learned during the build, and the
reasoning behind them lives there.

---

## 1. What is on the page

Two independent tags sit in the `<head>` of every page, in this order.

### 1.1 GTM container `GTM-NL6J5Z53`

The team's own container, for analytics and future tags.

> **It must never load the Dengage SDK.** The SDK is on the page directly
> (below), and a second copy loaded from a GTM tag double-initialises it.

The container the demo originally inherited, `GTM-5CLZHR7J`, was removed: it
initialised three unrelated Dengage accounts, one of which pushed a video
popup onto the site.

### 1.2 Dengage Web SDK

Between `<!-- DENGAGE SDK START -->` and `<!-- DENGAGE SDK END -->`, verbatim
as the panel issued it:

```
account   28   (web application "BFSI")
app guid  c8d2da44-b982-1925-9ad8-e7caddf0894a
loader    https://pcdn.dengage.com/p/push/28/c8d2da44-b982-1925-9ad8-e7caddf0894a/dengage_sdk_loader.js
```

The snippet installs the `dengage()` queue stub, appends the loader, then
calls `dengage('initialize')` itself.

The loader is a one-liner that appends the real bundle and sets
`window.dn_onsite_filename`, which is how you find the published campaign
bundle (see §5.1).

### 1.3 Required web-application advanced settings

These are panel settings, and the site's code depends on them:

| Setting | Value | Why |
|---|---|---|
| Trigger Initialize on Install | **off** | the snippet calls `initialize()` itself |
| Trigger Page View on Initialize | **off** | `js/pageView.js` sends the page view with real parameters; leaving this on double-counts every page |
| Disable `setNavigation` | **on** | never called here |
| Allow connecting multiple contacts to single device | off | Dengage's own recommendation |

---

## 2. The event contract

### 2.1 Two kinds of dataLayer event

The scenario launcher pushes one of two shapes, and the difference matters.

**Default Scenarios (8).** The event name *is* the scenario slug, carrying that
site's `SCENARIO_EVENT_PREFIX`:

```js
window.dataLayer.push({
  event: 'ru_nps-popup',         // SCENARIO_EVENT_PREFIX + slug
  actionType: 'nps-popup',       // the bare slug, always
  category: 'Default Scenarios'
});
```

| Site | `SCENARIO_EVENT_PREFIX` | Fires | Served by |
|---|---|---|---|
| `cantu-pneus/` | `br_` | `br_nps-popup` | the `br_` campaigns |
| `cantu-pneus/en/` | `en_` | `en_nps-popup` | the `en_` campaigns |
| `cantu-pneus/ru/` | `ru_` | `ru_nps-popup` | the `ru_` campaigns |
| `fintech/`, `banking/` | none | `nps-popup` | the original unprefixed campaigns |

It is set once per site at the top of `js/cantuCatalog.js`.

The two finance sites are unprefixed **deliberately**. Those campaigns carry
display condition `/.*/`, so one campaign per slug serves both with no extra
configuration. The cost is that a campaign holds one piece of content, so their
eight Default Scenarios show CantuPneus content and a CTA clicked there lands on
a tyre shop. The three CantuPneus sites were prefixed precisely to escape that,
and each has its own set of eight campaigns.
**Never delete the unprefixed campaigns**: fintech and banking depend on them.

**A scenario appears only if a campaign exists with that exact trigger name.**
If one is missing, the widget is **silently dark**: nothing errors, it just
never shows. Check the live manifest (§5.1) before suspecting the code.

The eight slugs, **including the three misspellings**, which are part of the
contract and must not be corrected:

```
survey   nps-popup   subscripton-popup   stickey-bar
image-popup   image-bar   horizonal-popup   cta-image-popup
```

**Local widgets (17).** Prefixed per site, so each industry has its own
namespace:

```js
window.dataLayer.push({
  event: 'fintech_mega-banner',  // EVENT_PREFIX + slug
  actionType: 'mega-banner',
  widgetName: 'Mega Banner',
  category: 'Inline Scenarios'
});
```

The prefix is one constant per site, at the top of the launcher module. **This
is a different constant from `SCENARIO_EVENT_PREFIX` above, and the two do not
have the same value on any site.** `EVENT_PREFIX` namespaces the 17 locally
coded widgets into an industry's own custom tables; `SCENARIO_EVENT_PREFIX`
names a campaign in the panel.

| Site | Launcher module | `EVENT_PREFIX` | `SCENARIO_EVENT_PREFIX` |
|---|---|---|---|
| cantu-pneus | `js/cantuCatalog.js` | none, the widgets use the generic `dengage` event | `br_` |
| cantu-pneus/en | `js/cantuCatalog.js` | none | `en_` |
| cantu-pneus/ru | `js/cantuCatalog.js` | none | `ru_` |
| fintech | `js/novapayCatalog.js` | `fintech_` | none |
| banking | `js/meridianCatalog.js` | `banking_` | none |

The SDK watches `window.dataLayer` itself. A campaign set to
`triggerBy = DATA_LAYER_EVENT` fires with **no GTM involvement at all**.

### 2.2 First-class SDK calls

Prefer these over writing to tables by hand: the SDK owns the standard table
shapes and fills `key`, `event_date` and `session_id` for you.

| Call | Where | Populates |
|---|---|---|
| `dengage('pageView', {...})` | `js/pageView.js` | `page_view_events` |
| `dengage('ec:addToCart', {...})` | `js/cartManager.js` | `shopping_cart_events` |
| `dengage('ec:removeFromCart', {...})` | `js/cartManager.js` | `shopping_cart_events` |
| `dengage('ec:deleteCart', {})` | `js/cartManager.js` | `shopping_cart_events` |
| `dengage('ec:beginCheckout', {...})` | `js/cartManager.js` | `shopping_cart_events` |
| `dengage('ec:order', {...})` | `js/cartManager.js` | `order_events` + `order_events_detail` |
| `dengage('ec:addToWishlist', {...})` | event panel | `wishlist_events` |
| `dengage('setContactKey', email)` | sign-up, subscription widget | identity |
| `dengage('sendDeviceEvent', table, payload)` | launcher, bridges, event panel | any Big Data table |
| `dengage('getRecommendation', key, {}, cb)` | `js/allReco.js` | reads a recommendation container |
| `dengage('getContactKey' / 'getDeviceId', cb)` | event panel launcher | identity readout |
| `dengage('showCustomPrompt' / 'showNativePrompt')` | launcher push row | web push opt-in |

Other `ec:` verbs available but unused here:
`ec:removeFromWishlist`, `ec:setCart`, `ec:viewCart`, `ec:search`,
`ec:cancelOrder`, `ec:pageView`.

**`pageView` payload** (product pages wait for the product to resolve, with a
4 s fallback so a slow feed still reports the visit):

```js
{ page_type: 'product', product_id, category_path, price,
  discounted_price, stock_count }
```

`page_type` is `home`, `product` or `category`.

**Cart payload.** Every `ec:*` cart call wants the *whole* basket in
`cartItems`, not just the item that changed:

```js
{ product_id, product_variant_id, quantity, unit_price, discounted_price,
  cartItems: [ { product_id, product_variant_id, quantity,
                 unit_price, discounted_price }, ... ] }
```

`unit_price` is the pre-discount price and `discounted_price` what is
actually charged; when there is no discount they are equal.

### 2.3 Numbers must be numbers

The event panel coerces anything that looks numeric before sending, because
the standard tables have real number columns and a quoted `"240.00"` lands
badly. If you add a payload by hand, send `240` not `'240'`.

---

## 3. Tables

### 3.1 Standard Data Space tables

Filled by the first-class calls above. They already exist in account 28:

`page_view_events` · `shopping_cart_events` · `wishlist_events` ·
`order_events` · `order_events_detail`

Columns the sites populate are listed per call in §2.2. `key`, `event_date`,
`session_id`, `event_type`, `event_id`, `camp_id`, `send_id` are filled by
the SDK or the platform, never by the site.

### 3.2 Custom Big Data tables, per site

| Purpose | cantu-pneus | fintech | banking |
|---|---|---|---|
| Scenario launcher clicks | `onsite_events` | `fintech_onsite_events` | `banking_onsite_events` |
| Industry events (event panel cards 7 and 8) | `events` | `fintech_events` | `banking_events` |

Launcher table columns: `event_name`, `scenario_group`, `widget_name`,
`page_type`, `page_url`.

Industry event examples: `fintech_kyc_completed`,
`fintech_transfer_completed`, `banking_mortgage_calculated`,
`banking_appointment_booked`.

### 3.3 Data capture from panel content

Three of the eight panel scenarios collect input. **None of it goes through a
Big Data table and none of it goes through site JavaScript.** Content renders
in a cross-origin iframe (§5.2), so a listener on the host page can never see
a submit inside it. The only path that works is the engine's own form
mechanism, described in §5.6.

| Scenario | Root | Submit call | Where the data lands |
|---|---|---|---|
| `subscripton-popup` | `data-dn-form-id="subscription_form"` | `Dn.postSubscription()` | a real **contact**: `email`, `emailPermission`, `gsmPermission` |
| `survey` | `data-dn-form-id="question_form"` | `Dn.postQuestion()` | **contact tags** `tyre_line_interest`, one per selected line |
| `nps-popup` | `data-dn-form-id="question_form"` | `Dn.postQuestion()` | **contact tag** `nps_score`, value `0` to `10` |

So read survey and NPS results on the contact card and segment on the tags:
promoters `nps_score` 9 to 10, passives 7 to 8, detractors 0 to 6. There is
nothing to create in Data Space for these three.

An earlier host-page bridge wrote `survey_responses`, `nps_responses` and
`subscription_signups` rows. Because the content renders in a cross-origin
iframe, capture goes through the engine's form mechanism instead, and the
bridge is gone. If those tables still exist in the panel they are unused.

`tools/verify/formtest.js` drives the engine's real `form-handler.js` against
the three files, so the contract is checked against the implementation rather
than against a reading of it.

---

## 4. Product feed

One JSON array per site (`<brand>_products.json`), 16 items, read by the
product grid, the product detail page, the similar-products slider and all
five recommendation widgets.

```json
{
  "id": "NPY-CRD-METAL",
  "name": "NovaPay Metal Card",
  "desc": "...",
  "price": "240.00",
  "currency": "USD",
  "image": ["images/products/NPY-CRD-METAL.svg"],
  "category": "Products > Cards > Premium",
  "brand": "NovaPay Cards",
  "availability": true,
  "colors": ["2% cashback", "Metal, contactless"],
  "oldPrice": "299.00"
}
```

Notes that matter:

- `category` is a `A > B > C` path. The recommendation tab widget filters on
  a substring of it (`'> Cards >'`), so **the tab definitions in
  `js/allReco.js` and the feed must be kept in step** or a tab renders empty.
- `oldPrice` is optional; when present and greater than `price`, the UI shows
  a strikethrough and the cart sends it as `unit_price`.
- `colors` is the source template's name for a small attribute list. It is
  relabelled per industry on the detail page ("Key terms" on the finance
  sites, "Construction" on the tyre site).
- `availability: false` renders the disabled state instead of the add button.

---

## 5. On-Site campaigns

### 5.1 Where the published campaigns live

The loader sets `window.dn_onsite_filename`, e.g. `campaigns.1adbf52c.js`.
The published bundle is then:

```
https://pcdn.dengage.com/p/push/28/<app-guid>/onsite/<dn_onsite_filename>
```

It is a single call, `__dn_set_messages__(JSON.parse('...'))`, containing
each campaign's `publicId`, `triggerSettings`, `displayCondition` and status.
Fetching it is the fastest way to confirm what is live.

Trigger types: `DATA_LAYER_EVENT`, `CUSTOM_EVENT`, `EXIT_INTENT`,
`ON_SCROLL`.

### 5.2 Content renders inside a cross-origin iframe

**Verified against the live site, and it constrains everything about panel
content.** Every On-Site message, popup and banner alike, is rendered in an
`<iframe>` whose document is served from
`https://pcdn.dengage.com/onsite-message/initiator.html`. The campaign HTML is
not injected into the host page's DOM.

Consequences, all of which have bitten us:

1. **A plain `<a href>` navigates the iframe, not the page.** The site loads
   *inside* the popup box. Every anchor in panel content therefore needs
   **`target="_top"`**. All files in `cantu-pneus/panel-content/` carry it.
2. **Host-page JavaScript cannot see events inside the frame.** The document
   is cross-origin, so a delegated listener on the host page never receives a
   click from the content. Host-page code cannot read a form inside the
   frame; use the engine's form mechanism instead.
3. **The panel strips `<script>` from content on save** (it warns about
   "script block(s)"), so you cannot ship your own JS inside the frame either.
   Interactivity must be pure CSS: hidden radios and checkboxes driven by
   `<label for>`, `:has()` gating a submit control, `#id:checked ~` swapping
   in a thank-you state.
4. **Data capture must use the engine's own form mechanism** (below), which is
   the only supported way to get values out of the frame.

The engine injects its own resources into the frame: shared CSS, shared JS,
container CSS, and, only when the content contains
`data-dn-form-id="subscription_form"` or `data-dn-form-id="question_form"`,
a form handler (`formHandlerJsText`). The frame then talks to the host page
over `postMessage`, and the SDK handles these actions:

| Action from the frame | What the SDK does |
|---|---|
| `onSubmitForm` | records the submitted form |
| `postSubscription`, `postSubscriptionWithTags` | creates or updates the contact |
| `onSubmitTags`, `setTags` | applies tags |
| `sendClick` | records the click against the campaign |
| `openUrl` | opens the URL on the host page (`_blank` or `_self`) |
| `dismiss`, `close` | closes the message |
| `getGameWinner` | draws a gamification prize |
| a height message | resizes the iframe to fit the content |

So: use `data-dn-form-id` for anything that collects input, and
`target="_top"` for anything that links out.

### 5.3 Layouts: Popup vs Banner

The panel offers two layouts and they behave differently.

**Popup.** The engine wraps the content in its own centred container. Content
should be `width: 100%` inside a `max-width`-less root, and the width set in
the campaign's design settings (460 to 480 px for the cards here). Set
**padding 0 and a transparent background** in design settings, otherwise the
container's own white box shows as a frame around the card.

**Banner.** The engine's container is *already* `position: fixed` and full
width, with Top or Bottom position and a "keep in place on scroll" option.
Content must therefore be **ordinary in-flow `width: 100%`**. Do not use
`position: fixed` or `100vw` in banner content: it double-positions, and the
panel's preview (a simulated browser window, not a real viewport) renders it
clipped.

**Top banners cover the site's fixed header.** `js/bannerOffset.js` handles
this: it watches only for the engine's `_dn_onsite-banner` container, and
while one is pinned at the top it pushes `.site-header` down by the banner's
measured height, restoring it when the banner closes. Bottom banners,
popups and overlays are ignored.

### 5.4 Display frequency, and why repeat demos need a reset

The SDK keeps per-visitor On-Site display history in browser storage, and
three pieces of it shape a repeat demo:

| Behaviour | Effect |
|---|---|
| Global popup cooldown | a **5-minute cooldown between any two popups**, independent of campaign settings |
| Per-campaign history | display time and click state, driving `showEveryXMinutes`, `maxShowCount` and `dontShowAfterClick` |
| A/B assignment | which A/B variant this visitor is pinned to |

The global cooldown is the reason a second scenario does not show right after
the first, regardless of the campaign's own frequency settings.

Each site's launcher therefore has a **Reset displays** button. It clears
this visitor's On-Site display history and A/B assignment and reloads, so
scenarios can be repeated without clearing cache and cookies. The device id,
contact key and push subscription are left alone, so the visitor keeps their
identity and Data Space history stays on one device.

Demo loop: trigger a scenario, **Reset displays**, trigger the next.

### 5.5 A/B testing

The SDK supports it natively: an A/B campaign pins each visitor to one
variant, and the assignment is sticky for that visitor.

The split runs in the panel, but **every variant is our own HTML** in the HTML
editor rather than the drag-and-drop designer, so the visual quality matches
everything else.

Built here as one campaign, `CantuPneus - A/B Testing`, triggered by the
dataLayer event **`ab-testing`** from the English site's launcher:

| Variant | File | Design under test | Click id |
|---|---|---|---|
| A | `panel-content/{en,pt}/ab-testing/variant-a.html` | editorial minimal | `ab-testing__A` |
| B | `panel-content/{en,pt}/ab-testing/variant-b.html` | bold medallion | `ab-testing__B` |
| C | `panel-content/{en,pt}/ab-testing/variant-c.html` | photo and proof | `ab-testing__C` |

Split Control 10 / A 30 / B 30 / C 30. Control sees nothing.

Design settings are **per campaign, not per variant**, so all three are authored
to one width (560px). All three also state the same offer, threshold, CTA
wording and destination, so a winner is attributable to design and nothing else;
`tools/verify/paneltest.js` fails if one variant's copy drifts.

**The conversion metric is the click, and only the click.** The panel's own
rules text says so: "Currently, only click-based conversion is supported."
A variant that does not call `Dn.sendClick()` (§5.6) can never win, no matter
how it performs. Dengage also wants **100 visitors and 25 conversions per
variant** at 95% confidence before it names a winner, and the control group is
excluded from winner selection, so a live demo shows the mechanism, not a
verdict.

Because assignment is sticky, use **Reset displays** (it clears the A/B
assignment too) or an incognito window to re-roll on stage.

### 5.6 The `window.Dn` API, and why clicks read 0 without it

Inside the frame the engine exposes `window.Dn` (from
`https://pcdn.dengage.com/onsite-message/shared.js`). This is the whole
interface between pasted content and the platform.

| Call | What it does |
|---|---|
| `Dn.sendClick(buttonId)` | **records a click against the campaign** |
| `Dn.close()` | closes the message properly, removing the frame |
| `Dn.dismiss()` | closes and marks dismissed |
| `Dn.openUrl(url, newTab)` | navigates the host page |
| `Dn.copyText()` | copies a coupon or code |
| `Dn.setTags(tags)` | applies contact tags |
| `Dn.getGameWinner()` | draws a gamification prize |
| `Dn.updateHeight()` | resizes the frame to the content |
| `Dn.postMessageToParent(action, data)` | the low-level channel the above use |

Injected only when the content carries a `data-dn-form-id` root:
`Dn.postSubscription()`, `Dn.postSubscriptionWithTags()`, `Dn.postQuestion()`.

**Nothing is wired automatically.** A plain `<a>` or a styled `<label>` on
its own produces no click event: the content reports the click by calling
`Dn.sendClick()`. Before our content did, every campaign showed VISITOR and
DISPLAY populated but CLICK, UNIQUE CLICK and CTR at 0.

House rules that follow, enforced by `tools/verify/paneltest.js`:

- the CTA calls `Dn.sendClick('<scenario>__<action>')`, exactly once per file
- the close control calls `Dn.close()` and **never** `sendClick`, so a
  dismissal is not counted as a conversion and CTR stays honest
- every anchor keeps `target="_top"` as well, so the click is reported *and*
  the navigation leaves the frame

#### Native form contract

The engine's `form-handler.js` is vendored at
`tools/verify/fixtures/form-handler.js`, and `formtest.js` drives it against
the three form files, so everything below is exercised, not assumed.

Root, one of:

```html
<form class="form" data-dn-form-id="subscription_form" data-dn-validation-language="en">
<form class="form" data-dn-form-id="question_form"     data-dn-validation-language="en">
```

**Subscription form.** Each field carries `data-dn-id="<payload key>"` and
`data-dn-type`, plus optional `data-dn-required="true"`.

The complete type vocabulary, with the validation bounds the handler applies:

| Type | Accepts |
|---|---|
| `TEXT` | under 50 characters |
| `EMAIL` | a valid address |
| `GSM` | 7 to 15 characters, with a country-code selector |
| `DATEPICKER` | a date earlier than today, so: date of birth |
| `OTHER_TEXT` | free text under 120 characters |
| `OTHER_INTEGER` | a number between -10000 and 10000 |
| `OTHER_REQUIRED` | must be filled |
| `PERMISSION_CHECKBOX` | consent, required for the subscription |
| `TAGS`, `RADIO`, `CHECKBOX` | the `question_form` path, not this one |

`data-dn-id` is **not** a fixed whitelist, it is read off the element and
becomes the payload key.

`fintech/panel-content/lead-form.html` exercises six fields at once and
`formtest.js` asserts the payload, so `name`, `surname`, `gsm` and a
`DATEPICKER` are now proven rather than assumed:

```json
{"name":"Alex","surname":"Morgan","email":"alex.morgan@example.com",
 "gsm":"7700900000","birthdate":"1990-04-12T00:00:00.000Z",
 "emailPermission":true,"gsmPermission":true}
```

Note the engine converts `DATEPICKER` to an ISO timestamp itself. A sibling `[data-dn-invalid-message-type="<TYPE>"]`
is where the handler writes the message; the handler stamps
`data-dn-invalid="true"` on the failing field, so style off that. `data-dn-id`
`mergedPermission` expands to `emailPermission` **and** `gsmPermission`.
Submit with `Dn.postSubscription()`.

**Question form.** The handler reads **only the first `.form-block`**, so the
native mechanism supports exactly one question per message. That block carries:

| Attribute | Meaning |
|---|---|
| `data-dn-name` | the tag name every answer is written to |
| `data-dn-is-radio="true"` | single choice; omit for multi choice |
| `data-dn-min-selection`, `data-dn-max-selection` | multi choice bounds |

It must contain `input[type=radio]` (or `checkbox`) and a `div.form-message`
for the validation text, which the handler writes unconditionally on submit,
so hide it unless the block is `data-dn-invalid="true"`. Submit with
`Dn.postQuestion()`. Answers become contact tags, not table rows.

Do not use the `otherRadio` / `otherInput` "Other" option on question forms
in this repo. Background: ask Salil.

**Confirmation panel.** On success the engine posts `closeForm` back into the
frame. The handler stamps `data-dn-is-submitted="true"` on `.container` and
reads settings off `.submitted-content`:

```html
<div class="container">   <!-- gets data-dn-is-submitted -->
  <div class="form-view">...</div>
  <div class="submitted-content" data-dn-is-enabled="true"
       data-dn-is-modal-auto-close-enabled="false" data-dn-modal-close-seconds="6">
```

Disable auto-close on tag submissions so the thank-you state shows: set
`data-dn-is-modal-auto-close-enabled="false"` on question forms and leave it
`"true"` (6 seconds) on subscription forms. Background: ask Salil.

> **Inline handlers are the mechanism, and they survive publishing.** These
> calls sit in inline `onclick` attributes, because the panel strips `<script>`
> blocks on save. Confirmed on published campaigns (2026-07-30): the sanitizer
> removes script blocks but keeps inline event attributes, and the campaign list
> went from 0% CTR everywhere to 50% on the two bars, 40% on the subscription
> popup and 13.33% on the survey. So inline `onclick` is how hand-written
> content reaches `window.Dn`.

### 5.7 Inline campaigns and the target slots

An **inline** campaign injects into the site's own DOM rather than floating over
it. The campaign carries an inline target:

| Field | Meaning |
|---|---|
| `selector` | a **plain CSS selector**, run through `document.querySelectorAll()` against the host page |
| mode | `Fill` replaces the target's content; other modes insert adjacent to it |

So **the site needs no special markup for this to work.** The SDK writes
`data-dn-inline-id` and `data-dn-inline-index` on what it injects, and in `Fill`
mode stamps `data-dn-inline-reserved` on the target so a second inline campaign
cannot claim the same node. Those attributes appear at render time; there is
nothing to inspect on the page beforehand.

#### The panel's Inline Target Selector

Open the site with `?dn_inline_target_selector=true` and the SDK loads the
panel's picker overlay. Per the reference, it "scans all HTML nodes in page and
finds the ones that contains search word on their **class or id**", then offers
optimised query selectors (id first, tag added when it narrows the count). The
initial search retries 5 times over 5 seconds, because nodes can appear late.

`dn_inline_target` is only the **default search word**, not a required
attribute. A page with nothing matching it shows "No targetable nodes found",
which is not an integration failure: type a real word into **Search Again** and
it works. Searching `product` on the English site returns `#products`,
`#productGrid` and `.product-grid` at one match each.

#### Named slots

Hand-written selectors are fragile for a demo: they break silently when a class
is restyled, and a word like `container` matches 8 nodes. So every site carries
five empty placeholders whose ids contain `dn_inline_target`, which the picker's
default search lands on directly.

| Slot id | Where | Emitted by |
|---|---|---|
| `dn_inline_target_below_header` | top of page, directly under the header, **on both pages**. The one to target for a Story rail | `index.html`, `product.html` |
| `dn_inline_target_below_hero` | between the hero and the featured product | `index.html` |
| `dn_inline_target_in_grid` | last cell of the product grid | `js/productList.js` |
| `dn_inline_target_above_footer` | end of page, after the contact section | `index.html` |
| `dn_inline_target_pdp_below_price` | product page, under the price | `js/productDetail.js` |

Two are emitted by the renderers rather than written in the HTML, because both
of those regions are rebuilt with `innerHTML`, which would wipe a static
placeholder.

#### The top slot needs a measured header clearance

`.site-header` is `position: fixed`, and on the home page the hero starts at
flow position 0 behind it. A slot placed after `</header>` therefore renders
*under* the header unless it clears it, and a constant will not do: the header
is 117px on desktop, 110px on mobile, shrinks again when `.scrolled` applies,
and `js/bannerOffset.js` pushes it further down while a Dengage top banner is
pinned.

`js/inlineSlotOffset.js` measures the header's **bottom edge**, not its height,
and publishes it as `--dn-header-clearance` on `:root`. Measuring the bottom is
what makes it compose with `bannerOffset.js`: banner plus Story rail plus hero
stack correctly with no overlap, verified. The CSS applies it as `padding-top`
on the filled slot with a `7rem` fallback, and paints that band in the hero's
cream, because the unscrolled header has no background of its own and a
transparent band would show the body colour through it.

They are inert until used: `.dn-inline-slot:empty { display: none }` keeps them
out of the layout entirely. That matters most in the product grid, where an
empty cell would otherwise take a full card's worth of space under the
card-alignment rules. `Fill` mode puts content inside the node, `:empty` stops
matching, and the slot appears. In the grid the slot defaults to a full-width
row; add `dn-inline-slot--card` to make it occupy a single card cell instead.

A filled slot is also `overflow-x: auto`. A Story rail is wider than a phone
viewport, and without that the injected content moved the whole page sideways:
782px of scroll width in a 420px viewport. Containing it also gives the rail the
swipe behaviour it should have. The product page needed one extra fix for this
to bite: `.product-detail-info` is a flex container and a grid item, so it kept
the default `min-width: auto`, sized itself to its widest content and stretched
the slot with it, meaning nothing ever clipped. It now carries `min-width: 0`.
That was a latent bug of the page, not of the slot: any long unbroken string
would have done the same.

#### All five sites carry the same five slots

The port is mechanical because every site shares one page skeleton: the same
anchors, the same renderers, the same `--color-cream` token. `js/inlineSlotOffset.js`
is byte-identical across sites, and the CSS layer is the same block appended to
each stylesheet, so the clearance band picks up whichever brand background that
site defines.

| Site | Slots | Clearance watcher |
|---|---|---|
| `cantu-pneus/` | 5 | yes |
| `cantu-pneus/en/` | 5 | yes |
| `cantu-pneus/ru/` | 5 | yes |
| `fintech/` | 5 | yes |
| `banking/` | 5 | yes |

So an inline campaign can target any site. What is **not** shared is content: see
§5.8.

### 5.8 One campaign, one piece of content, and what that costs

The eight Default Scenarios plus the A/B and Story campaigns all use display
condition `/.*/`, so a single campaign fires on **every demo site**. That is
deliberate and it is what makes the demo cheap to run, but it has one consequence
worth knowing before a call.

**Every CTA in the shared panel content links to the CantuPneus English site**,
absolutely:

```
https://salil-dengage.github.io/dengage-demos/cantu-pneus/en/index.html#products
https://salil-dengage.github.io/dengage-demos/cantu-pneus/en/product.html?id=CNT-CRG-29580-KLD01
```

Click "View stock" on the banking demo and it lands on a tyre shop. This cannot
be fixed with relative URLs: the content runs in an iframe served from
`pcdn.dengage.com`, so a relative href resolves against that origin, not the host
page, and the content cannot read the parent URL because it is cross-origin.

Three honest options, in order of effort:

1. **Run the 8 scenarios on the CantuPneus English site**, which is where the
   links point. Fine for most demos and costs nothing.
2. **Show the scenarios on another site but do not click the CTAs.** Display,
   forms, NPS and the survey all work correctly; only the outbound link is wrong.
3. **Duplicate the campaigns per site** with per-site event names, for example
   `fintech_survey`, and per-site links. That is 8 more campaigns per site and
   breaks the "one campaign, every site" property, so only worth it if a prospect
   will click through on their own industry's site.

The same applies to the A/B variants (a CantuPneus freight offer) and the Story
rail (tyre-line artwork). Those are **brand content, not infrastructure**: they
would need rewriting per industry, not copying.

`tools/verify/slottest.js` covers every slot: present, inert while empty,
revealed when filled, clearing the header, and containing overflow at 420px.

#### Confirmed working, and one configuration to recognise

A Story campaign rendered on the live English site on 2026-07-30, so **an inline
campaign does not need a configured recommendation container** after all. A
container key is for recommendation-backed inline content specifically, not for
inline injection in general. That earlier `[VERIFY]` is resolved.

The configuration to recognise: the rail rendered at the very top of the body,
overlapping the fixed header, instead of in a slot. That is what an inline
campaign with **no Target Selector** looks like. With no target the content
falls back to a default position, which on these pages is flow position 0,
behind `.site-header`. It is a campaign configuration gap, not a site problem.
Set Target Selector to `#dn_inline_target_below_header` and the slot's measured
clearance puts the rail below the header.

Note also that `?dn_content_preview=true` bypasses display conditions, so a
campaign can render in preview while its real targeting, website and
Web/Mobile Web settings are still wrong. Preview proves the content; it does
not prove the targeting.

### 5.9 Inline content is NOT sandboxed, and what that unlocks

§5.2 says On-Site content renders in a cross-origin iframe. That is true of the
**Popup and Banner layouts only**. The inline path is different, and the
difference is large enough to change what is worth building.

The inline render does three things:

| Part of the content | What the SDK does with it |
|---|---|
| `.dn-inline-style` | clones it and appends it to `document.head` |
| `.dn-inline-html` | clones it into every node matching the target selector, rewrites each `a[href]` to an absolute URL and attaches its own click listener |
| `.dn-inline-script` | `new Function(source)()`, so it runs in the **page's global scope** |

Only the popup and banner path uses the iframe. Inline content renders in the
page itself.

Four consequences:

1. **Inline content can read and write the host page.** Its script sees `window`,
   `localStorage`, the site's own globals, everything.
2. **No `Dn.sendClick()` plumbing is needed for inline.** The SDK attaches a
   click listener to every `a[href]` it injects, so anchor clicks are counted
   without the content asking. This is the opposite of the popup path, where
   nothing is counted unless the content calls `Dn.sendClick()` (§5.6).
3. **Inline CSS is not scoped.** That `<style>` lands in `document.head` and
   applies to the whole page, so every selector in inline content must be
   namespaced under its own root id or it will restyle the site.
4. **The five-minute popup cooldown does not apply**, because the cooldown is
   keyed on popup display (§5.4 and the gotchas file).

#### Why this matters for personalization

The panel refuses customization tags on a real-time On-Site Targeting campaign:

> We currently do not support customization tags for real-time On-Site Targeting
> campaigns. Please remove customization to create a campaign, or save your
> content and use it in a campaign flow to use customization.

The tags themselves are fine. The panel's own Preview resolves
`{%=$Contact.first_name%}` and the rest correctly, so
`cantu-pneus/panel-content/personalized/` is written correctly; it is the
**trigger type** that is restricted. Two ways round it:

1. **A campaign flow / journey**, which is what the warning itself points at.
   Keeps the tags and keeps the property that matters commercially: the platform
   personalizes, not the website. `[VERIFY]` in the panel whether the journey
   builder in account 28 exposes an On-Site step before promising it on a call.
2. **An inline campaign instead of a popup**, personalized by its own inline
   script at render time from data the page already has, or from the client's own
   API. No tags, so nothing to block. Style it `position:fixed` with a backdrop
   and it still reads as a popup.

Option 2 works today and is verified on the live site. Be straight about the
trade with a technical prospect: the substitution happens in the page rather than
server-side, fed by an API the client owns. That is a legitimate production
architecture, and it is the same thing `$CustomApi` does on the server side.

### 5.10 The SDK ships its own on-site search provider

Not currently used by these demos, and worth knowing before anyone builds
search UI a second time. The SDK offers a search provider with a container
key and its own settings:

| Setting | Meaning |
|---|---|
| `searchContainerKey` | the configured search container, like a recommendation container |
| `debounceDuration` | how long to wait before querying |
| `minChars` | minimum query length |
| `maxResultCount` | results to return |
| `totalResults` | count returned with the results |
| `currentSearchWord` | the visitor's current query, also sent as a recommendation input |

It renders its own results UI and calls `onOpen` / `onInput` / `onClose`
callbacks. So Dengage can own the search experience end to end, given a
configured container.

These demos deliberately do **not** use it, because the point of `ec:search` in
this repo is to show the event contract and populate `search_events` from a
site's own search. §5.11 covers what was built. If a prospect asks whether
Dengage can supply the search UI itself as well, the answer is yes and the
container is the thing to configure. `[VERIFY]` before promising it on a call:
nobody has configured a search container on account 28 yet.

### 5.11 Search and the wishlist

Both features are real site behaviour wired to the documented ecommerce events,
rather than buttons in the Events panel. Three modules, each **byte-identical
across all five sites**, configured from `data-*` attributes on the script tag
the way `js/identity.js` already is:

| File | Job |
|---|---|
| `js/wishlist.js` | saved-items state, `ec:addToWishlist`, `ec:removeFromWishlist` |
| `js/wishlistUi.js` | header button, a heart on every product card, a save button on the product page, and the saved-items drawer |
| `js/searchPanel.js` | header search button, overlay with filter chips and live results, `ec:search` |

```html
<script src="js/wishlist.js" data-store="cantupneus_wishlist" data-ns="cantupneus"
        data-catalog="CantuCatalogData" data-global="CantuWishlist"
        data-list-name="favorites"></script>
<script src="js/wishlistUi.js" data-ns="cantupneus" data-global="CantuWishlist"
        data-catalog="CantuCatalogData"></script>
<script src="js/searchPanel.js" data-ns="cantupneus" data-catalog="CantuCatalogData"></script>
```

None of the three ships a stylesheet change. Each injects its own CSS written in
the design tokens every site already defines (`--color-gold`, `--color-charcoal`,
`--font-display`), so the same rules come out purple on CantuPneus, indigo on
NovaPay and navy on Meridian.

#### `ec:search`: one event per settled query

Results update on every keystroke. **The event does not.** Firing per keystroke
would write `m`, `ma`, `mar`, `mars` into `search_events`, and the table would
describe typing rather than intent: every prefix on the way to a word that does
match would look like a failed search.

So one event per settled query, where settled means the visitor stopped typing
for 700 ms, or pressed Enter, or changed a filter while a query was present. The
same `keywords` plus `filters` pair is never sent twice in a row, so reopening
the panel does not inflate the table.

The payoff is that **a zero-result row in `search_events` is a real gap in the
catalogue**, which is the only reason to collect the table: it is the input to a
"we do not stock what you asked for" campaign.

`filters` is typed as a string, so it carries a readable description
(`category=Truck`) and is an empty string when the visitor picked nothing.

Size matching folds separators away on both sides, so `195/65 R15`,
`195 65 r15` and `19565r15` all find the same tyre.

#### `ec:addToWishlist`: what is sent, and what is deliberately not

| Field | Value |
|---|---|
| `list_name` | `favorites` (from `data-list-name`) |
| `product_id`, `product_variant_id` | from the catalogue |
| `expire_date` | now plus 90 days, ISO 8601, so a campaign can stop chasing a stale save |
| `price` | **list** price, as a 2-decimal string |
| `discounted_price` | what the customer would pay, as a 2-decimal string |
| `stock_count` | number, **only where the catalogue tracks stock** |

The docs type `price` and `discounted_price` as **strings** for the wishlist
events, unlike the cart events which take numbers. They go out as strings.

`stock_count` is sent on the two CantuPneus sites, whose catalogues now carry a
`stock` figure per product, and **omitted** on fintech and banking, because
"units in stock" is meaningless for a card or a mortgage. The field is optional,
so omitting it is the honest answer. Sending an invented number would poison any
back-in-stock segment built on `wishlist_events`.

`ec:removeFromWishlist` sends `list_name` and `product_id` and **nothing else**,
which is the whole documented contract. Clearing the list sends one remove per
product, because there is no bulk remove in the contract.

#### Identity: the SDK stamps it, and it reads it fresh every time

Neither module attaches a contact key or a device id, and neither should. The
SDK stamps `session_id`, `dn_device_id` and `dn_contact_key` onto every event
envelope itself, and three things follow:

1. **Identity is resolved at send time, not at initialize.** A visitor who
   signs in mid-session has their very next event attributed to the contact
   with no re-initialisation.
2. **A known visitor gets `dn_contact_key` populated; an anonymous one gets an
   empty string**, and `dn_device_id` is always present either way. The row `key`
   is the device id in both cases, so anonymous behaviour is still collected and
   still merges onto the contact when they identify.
3. **Tracking permission gates the whole thing.** With tracking permission off
   no event is sent.

Which means search and saved items inherit the identity fix in `js/identity.js`
for free: because that file resolves the contact key synchronously and feeds it
to `initialize`, everything after it is attributed correctly. Nothing
feature-specific was needed.

The one thing a feature CAN get wrong here is writing an identity field into the
payload by hand, which would shadow the SDK's own and go stale the moment
somebody signs in or out. `searchwishtest.js` asserts that no payload contains
`contact_key`, `device_id`, `session_id` or any casing variant of them, that
`initialize` carried the resolved contact key, and that every event fires after
`initialize` rather than before it.

These modules always send `list_name` explicitly rather than leaning on any
default.

#### Verified in Data Space

Verified on 2026-07-30 on the published site: search, save and remove all
fire, and the rows are in `search_events` and `wishlist_events` in Data Space,
attributed to the signed-in contact, which is the identity behaviour described
above observed live.

#### How the wishlist rows are written

`js/wishlist.js` writes `wishlist_events` rows with
`sendDeviceEvent('wishlist_events', ...)`, the SDK's documented custom-table
write, and sets `event_type` (`add` / `remove`) and `is_used` itself. The
stored row carries every field listed above plus those two.

Do not swap these calls to `ec:addToWishlist` / `ec:removeFromWishlist`, and
do not drop the `event_type` and `is_used` lines: this write path is required
for correct behaviour with this SDK version. Background: Salil.
`searchwishtest.js` fails if the calls are changed. `ec:search` uses the
first-class call and needs nothing extra; cart and order events likewise.

#### The discipline worth carrying

**HTTP 200 from `/api/web/event` means accepted.** The only proof that an
event landed is the row in Data Space. So verify a new event by firing it with
a distinctive marker contact key and confirming the row there, never by
watching the network tab alone.

#### Two of our own bugs worth remembering

**`Number(null)` is `0`.** `toggle()` normalizes its argument and hands the
result to `add()`, which normalizes again, so every field makes the trip twice.
A null stock came back as `0` on the second pass and every wishlist event
claimed `stock_count: 0`, which a back-in-stock campaign would read as the
entire catalogue being out of stock. Normalization has to be **idempotent**;
`countOrNull()` in `js/wishlist.js` exists for that reason alone.

**The header had exactly zero horizontal slack.** Measured before anything was
added: at both 1280 and 1440 the nav's right edge met its container's right edge
to the pixel, because the gap between nav items is 4rem and there were already
eight of them. The first attempt at adding two controls pushed the cart button
clean off the right of the screen. `js/searchPanel.js` therefore adds a
`dns-nav-compact` class to any nav it puts a button in and tightens the gap,
which also closed a pre-existing overflow between 1100 and 1200 on the English
CantuPneus site. Still overflowing there, and left alone: 861 to 880, the last
slice before `.nav-main` is hidden at 860. It was worse before (26px against
14px now) and it is a 20px-wide window.

`tools/verify/searchwishtest.js` covers all of this on all five sites: every
payload key by key including which keys must be absent, the settle behaviour,
header fit at six widths, and no sideways scroll at 420px.

---

## 6. Recommendations

`js/allReco.js` builds five widgets (classic, banner, tab, sidebar, popup).
Each one:

1. calls `dengage('getRecommendation', containerKey, {}, cb)`,
2. maps the response onto the local card renderer,
3. falls back to the site's own product feed after 3 s or on error.

Container keys live in one map at the top of the file
(`<BRAND>_RECO_CONTAINERS`). Until real container keys are filled in, the
widgets run entirely on the local feed, which is why they look correct in a
demo with no recommendation setup at all.

---

## 7. Web push

- The service worker must sit at the **origin root** with the **exact
  filename the SDK's configuration expects**: `/dengage-webpush-sw.js`.
  The VAPID `applicationServerKey` comes from the SDK's configuration too;
  neither is something you supply from the page.
- These demos are served from `salil-dengage.github.io/dengage-demos/...`,
  so the origin root is a **different repository**:
  [`salil-dengage/salil-dengage.github.io`](https://github.com/salil-dengage/salil-dengage.github.io),
  which holds `dengage-webpush-sw.js` (and a `dengagewebpushsw.js` copy) at
  its root. A copy also sits in this repo for reference, but the one that
  matters is the one at the origin root.
- The launcher's push row asks for permission on demand: it calls
  `showCustomPrompt()` first, and because the Dengage prompt is asynchronous,
  the flow moves on to the browser's own `Notification.requestPermission()`
  after a few seconds if permission is still pending, so the button always
  completes the flow. On-demand is better on stage than an automatic prompt
  because you can show the opt-in as it happens. See
  [`DECISIONS-AND-GOTCHAS.md`](DECISIONS-AND-GOTCHAS.md).

---

## 8. Reference documentation

- Getting started: https://dev.dengage.com/docs/getting-started
- API reference: https://dev.dengage.com/reference/general
- Changelog: https://dev.dengage.com/changelog
- Panel: https://app.dengage.com

---

## 9. Adding another industry site

The five existing sites are the same machinery, so this is mechanical:

1. **Copy the English base.** `cp -r cantu-pneus/en <new>` gives you working
   English machinery. Delete `panel-content/` from the copy.
2. **Namespace it.** Replace `CantuPneus`/`cantupneus`/`Cantu`/`cantu` and
   `CANTU`/`CANTU-` with the new brand across `js/*.js` and the main script.
   This is what keeps element ids, CSS classes, the localStorage cart key and
   the `<brand>:cart:updated` custom events from colliding with the other
   sites in one browser. Rename the launcher module to `<brand>Catalog.js`.
3. **Theme it.** Copy a stylesheet and replace only the `:root` token block
   at the top, plus the display font. Everything downstream resolves from
   those tokens.
4. **Feed and artwork.** Write `<brand>_products.json` (§4) and add the
   items to `tools/assets/finassets.py` and `tools/assets/scenes.py`, then
   regenerate. Keep SVG gradient ids unique per file, which the generator
   does with a per-file prefix, otherwise inlining several in one document
   makes them all resolve to the first definition.
5. **Set the event contract.** In the launcher module set
   `EVENT_PREFIX = '<industry>_'` and
   `DENGAGE_EVENT_TABLE = '<industry>_onsite_events'`. Leave the eight
   Default Scenario slugs unprefixed.
6. **Rewrite the copy.** Both pages, and the industry-specific strings in
   `allGaming`, `allReco`, `sliderBanner`, `carouselBanner`, `expandBanner`,
   `headbanner`, `notificationIcon`, `earing`, `asistant`, `cartUi`,
   `productList`, `productDetail`, `similarProducts`, plus the event-panel
   templates. Remember the recommendation tab filters must match the new
   feed's category paths.
7. **Register it** in `tools/verify/sites.js` and run
   `tools/verify/run.sh <new>`. The copy sweep (`ptsweep.js`) is the one that
   catches wording left over from another industry.
