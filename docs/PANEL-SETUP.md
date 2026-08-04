# Dengage panel setup

Everything that has to exist inside the Dengage panel for these demos to
work, and the exact settings. Nothing here is code; the code side is in
[`DENGAGE-INTEGRATION.md`](DENGAGE-INTEGRATION.md).

Account: **28**, web application **BFSI**, app guid
`c8d2da44-b982-1925-9ad8-e7caddf0894a`.

---

## 1. Web application advanced settings

| Setting | Value |
|---|---|
| Trigger Initialize on Install | **off** |
| Trigger Page View on Initialize | **off** |
| Disable `setNavigation` | **on** |
| Allow connecting multiple contacts to single device | off |

The first two are not preferences. The site's snippet calls `initialize()`
itself, and `js/pageView.js` sends the page view with real parameters, so
leaving either on double-counts.

---

## 2. Big Data tables

### 2.1 Already exist (standard Data Space tables)

`page_view_events`, `shopping_cart_events`, `wishlist_events`,
`search_events`, `order_events`, `order_events_detail`. The sites populate them
through the SDK's first-class calls, so no setup is needed.

`search_events` and `wishlist_events` were empty until search and saved items
were built, because nothing on the sites used to call `ec:search` or
`ec:addToWishlist` outside the Events panel. They now fill from real visitor
behaviour on all five sites. Two things about their contents are worth knowing
before you build a segment on them:

- **A zero `result_count` row in `search_events` is a real catalogue gap**, not a
  half-typed word. The event fires once per settled query, never per keystroke,
  so the table records intent rather than typing. `filters` is a readable string
  like `category=Truck`, empty when the visitor picked none.
- **`stock_count` in `wishlist_events` is present only for the CantuPneus
  sites.** Fintech and banking omit it, because a card or a mortgage has no unit
  count. A back-in-stock segment therefore only makes sense on the CantuPneus
  rows; on the finance sites use `price` against `discounted_price` for a
  rate-drop trigger instead.

- **Every `wishlist_events` row carries `event_type` and `is_used`.** The sites
  write the rows through `sendDeviceEvent` and supply both columns explicitly,
  with `event_type` set to `add` or `remove`, so a segment can be built on it
  normally. Do not change how these rows are written: required for correct
  behaviour with this SDK version. Background: Salil. Detail in
  `docs/DENGAGE-INTEGRATION.md` §5.11.

Both are populated by `js/searchPanel.js` and `js/wishlist.js`; see
`docs/DENGAGE-INTEGRATION.md` §5.11 for the exact payloads, all of them captured
from the live site against the real SDK rather than inferred.

### 2.2 No table is needed for the three capture widgets

`survey`, `nps-popup` and `subscripton-popup` use the engine's native form
mechanism, which writes a contact and contact tags rather than table rows. See
§3.3. The old `survey_responses`, `nps_responses` and `subscription_signups`
tables are no longer written to and can be ignored or deleted.

### 2.3 Per-site tables

Optional. Until they exist the SDK calls still fire, they simply have
nowhere to land.

| Site | Launcher clicks | Industry events |
|---|---|---|
| cantu-pneus | `onsite_events` | `events` |
| fintech | `fintech_onsite_events` | `fintech_events` |
| banking | `banking_onsite_events` | `banking_events` |

Launcher table columns: `event_name`, `scenario_group`, `widget_name`,
`page_type`, `page_url` (all text).

Industry event tables are schema-light; the event panel sends, for example,
`event_name`, `application_id`, `product_id`, `verification_method`,
`risk_band`, `minutes_to_complete` for `fintech_kyc_completed`.

---

## 3. The eight On-Site campaigns

> **Read this before rebuilding anything.** The per-site scenario prefix is
> **ON for all three CantuPneus sites**: the pt-BR site fires `br_survey`, the
> English site `en_survey` and the Russian site `ru_survey`, and each language
> has its own set of eight campaigns serving its own content.
>
> NovaPay and Meridian fire the **unprefixed** slugs, deliberately, and are
> served by the original campaigns. **Never delete the unprefixed campaigns**:
> deleting them takes eight widgets dark on those two sites. A scenario only
> appears if a campaign exists with that exact trigger name; a missing
> campaign leaves the widget silently dark, with nothing erroring.
>
> Content to paste: `cantu-pneus/panel-content/pt/` for the `br_` campaigns,
> `.../en/` for the `en_` ones and for the two finance sites, `.../ru/` for the
> `ru_` ones. Everything else on this page, layout, width, design and trigger
> type, is unchanged and applies to every language.


One campaign per slug, per prefix. The eight described below are the
**unprefixed** campaigns, and because the display condition is `/.*/` a single
campaign per slug serves fintech and banking. The three CantuPneus sets differ
only in trigger name and pasted content.

### 3.1 Settings common to all eight

| Field | Value |
|---|---|
| Trigger | **Data Layer Event** |
| Event name | the slug, exactly (see table below) |
| Where to display | `/.*/` |
| Status | Active |
| Show every X minutes | 1 |
| Max show count | 100 |

> Note the deliberate misspellings in three slugs. They must match the
> site's dataLayer exactly.

### 3.2 Per-campaign content and layout

Content to paste is in `cantu-pneus/panel-content/`. Each file is a complete
HTML document that can be pasted **whole** into the HTML editor: all CSS is
scoped to the widget's root id, so nothing leaks onto the page.

| Slug | File | Layout | Design settings |
|---|---|---|---|
| `survey` | `survey.html` | Popup | width 460 to 480, padding 0, transparent background |
| `nps-popup` | `nps-popup.html` | Popup | width 460 to 480, padding 0, transparent background |
| `subscripton-popup` | `subscripton-popup.html` | Popup | width 460 to 480, padding 0, transparent background |
| `image-popup` | `image-popup.html` | Popup | width 460 to 520, padding 0, transparent background |
| `horizonal-popup` | `horizonal-popup.html` | Popup | width 640 to 720, padding 0, transparent background |
| `cta-image-popup` | `cta-image-popup.html` | Popup | width 440 to 480, padding 0, transparent background |
| `stickey-bar` | `stickey-bar.html` | **Banner**, position **Top**, keep in place on scroll | padding 0, transparent background |
| `image-bar` | `image-bar.html` | **Banner**, position **Bottom**, keep in place on scroll | padding 0, transparent background |

**Why padding 0 and a transparent background:** the engine's own container
otherwise draws a white box around the card, which reads as an unwanted
frame. The card supplies its own white, corner radius and shadow.

**Why the two bars are Banner and not Popup:** the Banner container is
already fixed and full width, so the content just fills it. Do not switch
them to Popup and do not add `position: fixed` to the content.

### 3.3 Three of them capture data, natively

`survey`, `nps-popup` and `subscripton-popup` collect input through the
engine's own form mechanism, so **nothing is needed in the panel** for them:
no table, no container, no extra setting. Paste the file and publish.

| Scenario | Lands as |
|---|---|
| `subscripton-popup` | a contact, with email and SMS permission |
| `survey` | contact tags `tyre_line_interest`, up to 3 per response |
| `nps-popup` | contact tag `nps_score`, `0` to `10` |

Where to look after a demo submit: **Audience, contact card, Tags** for survey
and NPS; the contact itself for a subscription. Build the NPS segment on the
tag: promoters 9 to 10, passives 7 to 8, detractors 0 to 6.

The `survey_responses`, `nps_responses` and `subscription_signups` tables from
the earlier design are no longer written to. Leave them or delete them, they
are unused either way.

### 3.4 Clicks only count when the content reports them

The engine counts a click when, and only when, the content calls
`Dn.sendClick(buttonId)`. Nothing is wired automatically. If a campaign shows
DISPLAY climbing while CLICK, UNIQUE CLICK and CTR stay 0, the content is
missing that call; it is not a panel setting.

Every file in `cantu-pneus/panel-content/` reports one click on its CTA and
calls `Dn.close()`, not `sendClick`, on its close control, so CTR reflects
interest rather than dismissals. Button ids follow `<scenario>__<action>`, for
example `stickey-bar__claim-offer`.

**Check this first after publishing any updated content**, because the click is
also the only conversion metric the A/B engine supports.

### 3.5 The A/B test campaign

One campaign, `CantuPneus - A/B Testing`, template type **AB**, holding three
variants. It is a ninth campaign, separate from the eight above.

| Field | Value |
|---|---|
| Trigger | **Data Layer Event** |
| Event name | `ab-testing` |
| Where to display | `/.*/` |
| Layout | Popup, width **560px**, padding 0, transparent background |
| Split | Control **10**, A **30**, B **30**, C **30** |

Content: `cantu-pneus/panel-content/{en,pt}/ab-testing/variant-a.html`, `variant-b.html`
and `variant-c.html`, one per variant slot. The design settings are per
campaign, not per variant, which is why all three are authored to one width.

The launcher's **A/B Testing** group on the English site pushes the event. It is
only on that site, so the test stays scoped to the English demo.

**What is under test is design, nothing else.** All three variants state the
same offer, the same R$ 5,000 threshold, the same CTA wording and the same
destination. Only the visual treatment changes:

| Variant | Design | Click id |
|---|---|---|
| A | Editorial minimal, white, no imagery, large type | `ab-testing__A` |
| B | Bold medallion, dark purple, yellow badge | `ab-testing__B` |
| C | Photo and proof, freight photo, three-up stat grid | `ab-testing__C` |

Three things to say out loud when demoing it:

1. **Assignment is sticky per visitor.** Trigger
   it twice and you get the same design. **Reset displays** re-rolls it, and so
   does an incognito window. Show this deliberately: it is the correct behaviour
   for a test, not a glitch.
2. **The control group sees nothing at all.** That 10% is the baseline the
   variants are measured against, and it is excluded from winner selection.
3. **Conversion is the click.** The panel's rules panel says "Currently, only
   click-based conversion is supported", and it wants 100 visitors plus 25
   conversions per variant at 95% confidence before it declares a winner. A demo
   shows the mechanism, not a verdict. Say so before a prospect asks.

Each variant shows a small "Variant A/B/C" pill so you can see on screen which
design you were served. Delete that one `<span>` for anything customer-facing.

### 3.6 Picking an inline target

For an **inline** campaign the panel asks for a target selector. Open the site
with `?dn_inline_target_selector=true` to get the visual picker:

```
https://salil-dengage.github.io/dengage-demos/cantu-pneus/en/?dn_inline_target_selector=true
```

Every site carries the same five named slots, so the picker's default search
finds them with no typing:

| Slot id | Where |
|---|---|
| `dn_inline_target_below_header` | top of page, under the header, on both pages. **Use this one for a Story campaign** |
| `dn_inline_target_below_hero` | between the hero and the featured product |
| `dn_inline_target_in_grid` | last cell of the product grid |
| `dn_inline_target_above_footer` | end of page, after the contact section |
| `dn_inline_target_pdp_below_price` | product page, under the price |

Pick one, Confirm Target, and the panel receives the selector plus its match
count. Each of these matches exactly one node.

For a **Story** rail, target `#dn_inline_target_below_header` with mode
**Replace** (the engine's `Fill`), so the rail lands in the slot rather than
beside it. The slot handles the fixed header for you: it takes a measured
clearance so the rail sits below the menu bar, and it keeps working when a top
banner is also on screen, because the clearance tracks the header's real bottom
edge. Verified with a banner and a rail up at once.

Two panel settings to check on that campaign, both easy to get wrong:

- **Select Website is per origin, not per demo site.** All five demos share
  account 28 and one app guid, `c8d2da44-b982-1925-9ad8-e7caddf0894a`, because
  they are all folders under `salil-dengage.github.io`. `BR - cantu-pneus` is
  that single web application and its label is just a name; there is no separate
  English one to pick. What scopes a campaign to a demo site is the page path
  underneath it, for example **On Different Page** with
  `/dengage-demos/cantu-pneus/en/`.
- **Web** and **Mobile Web** are separate checkboxes. With only Mobile Web
  ticked the campaign will not show on a desktop browser, which is usually not
  what you want for a live demo.

**"No targetable nodes found" is not a broken integration.** `dn_inline_target`
is just the picker's default search word, and it searches class names and ids.
On any page without those slots, for example the pt-BR site or the two finance
sites, use **Search Again** with a real word instead: `product` returns
`#products` and `#productGrid` at one match each. Full mechanism in
[`DENGAGE-INTEGRATION.md`](DENGAGE-INTEGRATION.md) §5.7.

A known-good inline configuration, for reference:

| Field | Value |
|---|---|
| Select Website | `BR - cantu-pneus` (the one app guid for the whole origin) |
| Page | **On Different Page**, `/dengage-demos/cantu-pneus/en/` |
| Target Selector | `#dn_inline_target_below_header` |
| Mode | **Replace** |

The five modes map onto the engine's placement: **Replace** fills the node,
**Start of** and **End of** insert inside it, **Add before** and **Add after**
insert as siblings. Prefer Replace or Start of for these slots. The two sibling
modes put the content *outside* the slot, which means it does not inherit the
header clearance and, on the top slot, will render behind the header again.

**Confirmed working 2026-07-30:** a Story campaign renders on the live English
site with no recommendation container configured, so the earlier caveat about
needing one is resolved.

**If the rail appears over the header instead of in a slot, the campaign has no
Target Selector.** That field is required, and without it the engine falls back
to a default position at the very top of the body, underneath the fixed header.
Fill it with `#dn_inline_target_below_header` and the slot handles the rest.

`?dn_content_preview=true` also bypasses display conditions, so a campaign can
look fine in preview while its website, targeting and Web/Mobile Web settings
are still wrong. Preview proves the content, not the targeting.

### 3.7 The Story campaign

A worked inline campaign, and the one to demo the Story template with. Every
field value, the artwork URLs and the Styles settings are in
[`cantu-pneus/panel-content/story/README.md`](../cantu-pneus/panel-content/story/README.md).

In short: content name `CantuPneus - Story Inline`, trigger event `story`, target
`#dn_inline_target_below_header`, mode Replace, five story sets and 11 slides.
The launcher's **Inline Scenarios** group on the English site has a
**Story (panel)** button that fires it, with no local fallback, so nothing
appears unless the campaign is live.

Artwork is committed under `cantu-pneus/en/images/story/` and regenerated with
`python3 tools/assets/story.py`, because a demo must not depend on a
third-party image host.

---

## 4. Recommendation containers

Optional. Create up to five containers and put their keys in the
`<BRAND>_RECO_CONTAINERS` map at the top of each site's `js/allReco.js`.

Until real keys are present, all five recommendation widgets run on the
site's own product feed, which is why they look correct in a demo with no
recommendation configuration at all.

---

## 5. Web push

- The service worker must be at the **origin root** with the filename the
  SDK's embedded config expects: `/dengage-webpush-sw.js`. For these demos
  the origin root is a different repository,
  `salil-dengage/salil-dengage.github.io`.
- Nothing needs configuring on the page: `swUrl` and the VAPID
  `applicationServerKey` are both embedded in the account's SDK bundle.
- The launcher's push row triggers the opt-in on demand rather than on page
  load, which is better for a live demo.

**Sending a test:** use an actual campaign send to demonstrate push. A real
campaign exercises the full delivery path a subscriber sees, notification and
all.

---

## 6. Re-running scenarios during a demo

The SDK enforces a **global five-minute cooldown between any two On-Site
popups**, independent of each campaign's own frequency settings. That is why
a second scenario silently declines to show right after the first.

Each site's scenario launcher has a **Reset displays** button that clears
just that cooldown and the per-campaign history, keeping the visitor's
identity and push subscription. Use:

**trigger a scenario, Reset displays, trigger the next.**

There is no need to clear browser cache or cookies, and clearing them would
lose the device identity that ties the demo's events together.

---

## 7. A/B testing

Create the campaign as an A/B campaign, but author **every variant as HTML**
in the HTML editor rather than in the drag-and-drop designer, so the design
quality matches the rest.

Conversion is the click, so give each variant's CTA its own
`Dn.sendClick` id (`ab-testing__A`, `ab-testing__B`, `ab-testing__C`). That is
what lets the campaign report attribute conversions per variant; a variant
without the call can never win.

Variant assignment is sticky per visitor, so use **Reset displays** (it
clears the A/B assignment as well) or an incognito window to see the other
variant.

For a variant that captures input, use the engine's native form mechanism,
`data-dn-form-id="subscription_form"` or `"question_form"`, the same contract
as the subscription popup: the submission lands as a contact or contact tags,
which gives the test a real conversion outcome beyond the click.
