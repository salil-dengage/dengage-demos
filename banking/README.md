# Meridian Bank, the Banking demo site

> **State of the project, everything that broke and why, and what is still
> outstanding: [`docs/PROJECT-LOG.md`](docs/PROJECT-LOG.md). Read that first.**

> Shared platform knowledge lives one level up:
> [repository README](../README.md) ·
> [`docs/DENGAGE-INTEGRATION.md`](../docs/DENGAGE-INTEGRATION.md) ·
> [`docs/PANEL-SETUP.md`](../docs/PANEL-SETUP.md) ·
> [`docs/DECISIONS-AND-GOTCHAS.md`](../docs/DECISIONS-AND-GOTCHAS.md)

A self-contained demo of a UK retail and private bank, in English only. Live at:
`https://salil-dengage.github.io/dengage-demos/banking/`

Meridian Bank is fictional, established 1874 in the story. It offers current
accounts, credit cards, savings and ISAs, loans, mortgages, wealth management
and insurance, so the catalogue, copy, widgets and events are all retail banking.

## Event naming

Industry events are prefixed `banking_`:

- Local widget clicks push `{ event: 'banking_<slug>', actionType, widgetName, category }`
- Catalog clicks also write to the Big Data table `banking_onsite_events`
- The event panel's last two cards write to `banking_events`
  (`banking_mortgage_calculated`, `banking_appointment_booked`)

The eight panel-built Default Scenarios are the deliberate exception. They
keep their original unprefixed slugs (`survey`, `nps-popup`,
`subscripton-popup`, `stickey-bar`, `image-popup`, `image-bar`,
`horizonal-popup`, `cta-image-popup`), because those campaigns already
exist in the Dengage panel with display condition `/.*/`, so they fire on
this site with no extra setup.

## Standard tables

**`pageView` and nothing else.** This table was rewritten on 2 August 2026: it
previously described an `ec:addToCart` / `ec:beginCheckout` / `ec:order` mapping
that this site abandoned, and the stale version survived the change.

A bank has no basket, no checkout and no order, so the application funnel is
**not** mapped onto the ecommerce actions. It writes step-level rows to
`banking_application_events` instead, and the shortlist writes to
`banking_product_events` rather than to `shopping_cart_events`.

| Step | SDK call | Table |
|---|---|---|
| Any page viewed | `pageView` | `page_view_events` |
| Everything else | `sendDeviceEvent` | one of the nine `banking_*` tables |

`sites.js` encodes this as `ecommerceUi: false`, `usesEcommerceFunnel: false`
and `hasSearchAndWishlist: false`, and `journeytest.js` asserts the site makes
**no `ec:*` call at all**. Reasoning: `docs/TABLE-DESIGN.md`.

## Isolation

This folder carries its own `js/`, `images/`, `vendor/`, stylesheet and
product feed. Every element id, CSS class, localStorage key and custom
event is namespaced `meridian-*` / `meridian_*`, so the cart, widgets and
state cannot collide with the CantuPneus or NovaPay demos even in the
same browser. The three sites share only the Dengage account.

## Artwork

All imagery is generated SVG committed to the repo: four card designs,
twelve product tiles and seven scenes. Nothing is fetched from an external
host, so nothing can fail to load mid-demo.

## The shortlist, not search and saved items

Also corrected on 2 August 2026. This section previously described site search
and a wishlist writing `ec:search`, `ec:addToWishlist` and
`ec:removeFromWishlist`. **None of that is on this site.** `js/searchPanel.js`
and `js/wishlist.js` exist in this folder only to satisfy the byte-identity
contract across the five sites; `index.html` does not load them.

What the site actually has is a **shortlist**: a customer shortlists products to
compare and then applies for one. No basket, no quantities, no total.

| Action | Call | Table |
|---|---|---|
| shortlist a product | `sendDeviceEvent` | `banking_product_events` |
| compare, then apply | `sendDeviceEvent` | `banking_application_events` |

Driven by `js/shortlist.js`, with the DOM hooks declared under `banking.hooks`
in `tools/verify/sites.js`.

### One difference from the retail demo

This catalogue does **not** send `stock_count`. Units in stock is meaningless
for a card, a loan or a mortgage, the field is optional in the contract, and
sending an invented figure would poison any segment built on it. The CantuPneus
demo does send it, which is where a back-in-stock alert belongs. Say this
plainly if a prospect asks; it is a better answer than a fabricated number.

Exact payloads: `docs/EVENT-CATALOGUE.md` and `docs/TABLE-DESIGN.md`.
Verify with `node banking/tools/journeytest.js`, which asserts no `ec:*` call is
made anywhere on the site.
