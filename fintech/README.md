# NovaPay, the FinTech demo site

> Shared platform knowledge lives one level up:
> [repository README](../README.md) ·
> [`docs/DENGAGE-INTEGRATION.md`](../docs/DENGAGE-INTEGRATION.md) ·
> [`docs/PANEL-SETUP.md`](../docs/PANEL-SETUP.md) ·
> [`docs/DECISIONS-AND-GOTCHAS.md`](../docs/DECISIONS-AND-GOTCHAS.md)

A self-contained demo of a digital money app, in English only. Live at:
`https://salil-dengage.github.io/dengage-demos/fintech/`

NovaPay is fictional. It sells cards, savings, investing, credit, global
accounts and protection, so the product catalogue, the copy, the widgets
and the events are all consumer-finance rather than retail.

## Event naming

Industry events are prefixed `fintech_`. Local widget clicks push
`{ event: 'fintech_<slug>', actionType, widgetName, category }` to the dataLayer,
and the scenario surface also writes `fintech_engagement_events`.

**The eight Default Scenarios are live on their own `fintech_` campaigns**, and
were confirmed rendering against the real account on 2 August 2026.

They were dark for a day and it is worth knowing why. The prefix flip changed
`SCENARIO_EVENT_PREFIX` and the `scenario_slug` written to the Big Data row, but
not the dataLayer push that actually triggers the campaign, so the panel had
`fintech_survey` and the page pushed `survey`. A missing campaign is not an
error: the widget is silently dark, nothing shows and nothing logs.
`review.js` now asserts the pushed event name rather than merely that some
event fired.

## Tables

`page_view_events` is the one standard table kept, because a page view is a page
view in any industry. Everything else goes to purpose-built Big Data tables:

| Step | SDK call | Table |
|---|---|---|
| Any page view | `pageView` | `page_view_events` |
| Everything else | `sendDeviceEvent` | the ten `fintech_*` tables |

Full column list and the relational model: `fintech/EVENT-MODEL.md`.

## Isolation

This folder carries its own `js/`, `images/`, `vendor/`, stylesheet and
product feed. Every element id, CSS class, localStorage key and custom
event is namespaced `novapay-*` / `novapay_*`, so the cart, widgets and
state cannot collide with the CantuPneus or Meridian demos even in the
same browser. The three sites share only the Dengage account.

## Artwork

All imagery is generated SVG committed to the repo: four card designs,
twelve product tiles and eight scenes. Nothing is fetched from an external
host, so nothing can fail to load mid-demo.

## Verification status

**Data delivery is confirmed end to end, 31 July 2026.** All ten custom tables
and the `fintech_products` dimension exist in the panel with the star schema
wired. `tools/verify/liveprobe.js` proved every table receives a row with every
attribute populated, on both the identified and the anonymous path, and a
click-through of the published site under `?ck=fintech-live-1` proved the
**site's own** SDK calls land too.

This site was deliberately excluded from the v1.0 tag as unverified. That is no
longer true of its data layer.

Still unproven, and worth saying before a call:

| | |
|---|---|
| Native form capture | `survey`, `nps-popup`, `subscripton-popup` and `lead-form` render and report their click; the form widgets are demoed per the demo script. Ask Salil |
| Web push | never demonstrated from this site |
| The Android app | not written yet, see `fintech/android/SETUP-MAC.md` |

## The portal is five pages

`app.html` (Home), `money.html`, `cards.html`, `grow.html`, `products.html`.
Generated from `app.html` so the head, header, footer and script list cannot
drift: only the title, `data-portal-view` on `<body>`, the active tab and the
contents of `<main>` differ.

Each page pushes only its own portal signals, which is what lets a single inline
campaign be demoed without resetting. It needed **no panel change**: campaigns
trigger on the event name, so an event that only fires on one page can only
appear there. See `PORTAL-SCENARIOS.md` for the page-to-scenario map and
`tools/verify/portaltest.js` for what is asserted.

## The portal is closed, and "Open account" is a lead form

Until 1 August 2026 the "Open account" CTA was a link to `app.html`, and the
portal was open to anyone with the URL. That skipped the single most valuable
moment on a finance site, the lead, and it meant the portal was not somewhere a
visitor arrived, just another page.

Now:

| Control | What it does |
|---|---|
| **Open account** (4 CTAs) | pushes `fintech_open_account_intent`, does **not** navigate. A Dengage On-Site campaign renders `panel-content/lead-form.html`. |
| **Profile icon** | opens the account form. On submit it writes the session, identifies the contact, and lands in the portal. |
| **`app.html`** | guarded by `js/novapayGate.js`. No session, no portal. |

Two dataLayer events to build campaigns on:

| Event | Payload | Use it for |
|---|---|---|
| `fintech_open_account_intent` | `product_intent`, `cta_location` (`header`, `mobile_nav`, `hero`, `closing`) | the lead form itself, dressed differently per CTA |
| `fintech_portal_gate_blocked` | none | someone tried to reach the portal and could not, which is real intent |

Three things about the gate are easy to get wrong and are all covered by
`tools/verify/gatetest.js`:

- **It is the first script on the page**, ahead of GTM and the SDK snippet.
  `location.replace()` in the head does **not** stop the rest of the document
  executing, so a gate placed lower still lets `initialize` and `pageView` fire
  and writes a portal page view for somebody who never got in.
- **`?ck=` survives the bounce** and the return trip, because that is how any
  contact is demoed without touching code.
- **A dark campaign does not kill the CTA.** If no campaign answers
  `fintech_open_account_intent` within 1.4s, the site's own account form opens.
  When the campaign exists the engine wins and the fallback never runs.

  That hand-off is a race, and `fintech/tools/leadformtest.js` covers both ways
  of losing it, because both are visible to a prospect and neither shows up in
  a diff. A campaign answering **after** 1.4s used to leave the site's form
  open with the campaign popup on top of it, two account forms at once; the
  site's form is now withdrawn when the campaign arrives late, unless the
  visitor has started typing into it. And a **banner from an unrelated
  campaign** already on the page used to be mistaken for the lead form, which
  suppressed the fallback and left the hero CTA doing nothing; only elements
  that appear after the click are counted now.

Suites that open `app.html` must seed the session through `seedSession()` in
`tools/verify/sites.js`. Without it they bounce to the landing page and keep
passing while measuring the wrong page.

## No cart, no search, no saved items

This site does **not** use the ecommerce API. It has no cart, no search panel
and no saved-items drawer, because all three write the standard tables through
`ec:*`, and a card has no quantity, a loan has no shipping method, and an
application is approved or declined rather than ordered.

The honest replacement for a saved item is `product_shortlisted` in
`fintech_product_events`. `tools/verify/appevents.js` asserts that no `ec:*`
call is ever made, and it was checked by injecting one and watching the suite
go red.

Reasoning: `docs/DECISIONS-AND-GOTCHAS.md`, "REVERSED: the application funnel is
no longer mapped onto the ecommerce API".
