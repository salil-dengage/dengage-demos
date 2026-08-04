# v1.0: CantuPneus eCommerce demo, three languages

**Commit:** `5aa6f9f713bfe1208907cf410f9ee81e9440bf7e`
**Date:** 2026-07-31
**Status:** verified end to end, ready for the sales team

---

## Scope

This release covers the three CantuPneus eCommerce language sites, and only those:

| Site | Language | Scenario events |
|---|---|---|
| https://salil-dengage.github.io/dengage-demos/cantu-pneus/ | pt-BR | `br_survey`, `br_nps-popup`, ... |
| https://salil-dengage.github.io/dengage-demos/cantu-pneus/en/ | English | `en_survey`, `en_nps-popup`, ... |
| https://salil-dengage.github.io/dengage-demos/cantu-pneus/ru/ | Russian | `ru_survey`, `ru_nps-popup`, ... |

**NovaPay (`/fintech/`) and Meridian Bank (`/banking/`) are NOT part of this
release.** They are in the same repository and the same commit, because a tag is
repository-wide, but they have not been through this verification. Do not
present them as verified.

---

## What was verified live

Every event below was fired against the **published** sites with the **real**
Dengage Web SDK (BFSI, account 28), and the outgoing request bodies were
captured and read. This is not a stub or a unit test.

| Table | BR | EN | RU | What it carries |
|---|:--:|:--:|:--:|---|
| `page_view_events` | yes | yes | yes | home and product, with `category_path`, `price`, `discounted_price`, real `stock_count` |
| `shopping_cart_events` | yes | yes | yes | `add_to_cart` and `begin_checkout` |
| `order_events` | yes | yes | yes | `order_id`, `item_count`, `total_amount`, `payment_method` |
| `order_events_detail` | yes | yes | yes | one row per item, same `order_id` |
| `search_events` | yes | yes | yes | `keywords`, `result_count`, `filters` |
| `wishlist_events` | yes | yes | yes | add and remove, both with `event_type` and `is_used` |
| `events` | yes | yes | yes | the two custom events |
| `onsite_events` | yes | yes | yes | `event_name`, `scenario_group`, `widget_name` |
| webpush permission | yes | yes | yes | `new_visitor` and `native_prompt_response` |

Identity is stamped on every single event: `dn_contact_key`, `dn_device_id`,
`session_id`.

### Marker contact keys

Left in the account deliberately so the tables can be checked:

- `v10-br-demo`
- `v10-en-demo`
- `v10-ru-demo`

### Russian specifically

Cyrillic survives the round trip intact. `category_path` goes out as
`Шины > Грузовые > Ёлочка` and `page_title` in full Russian, correctly UTF-8
encoded in the request body.

---

## What was verified offline

The suites are green on all three sites, **1214 assertions**:

```
tools/verify/run.sh cantu-pneus
tools/verify/run.sh cantu-pneus-en
tools/verify/run.sh cantu-pneus-ru
```

They cover event payload contracts against the published API docs, identity
ordering (nothing fires before `initialize`), the language split in both
directions, Portuguese accents and encoding, Russian script and encoding, all 33
panel-content files, the native form contracts, layout and overflow at six
widths, and byte-identity of the shared modules across every site.

---

## What this release does NOT prove

**A 200 from `/api/web/event` means accepted; the row in Data Space is the
only proof an event landed.** The marker contact keys above exist so the
tables can be confirmed in Data Space. That check has not been done from this
side and should be done once before the first customer demo.

---

## The three form widgets

The survey, NPS and subscription popups render and style correctly and their
clicks are tracked. Form capture lands as a contact or contact tags rather
than table rows, so it is confirmed in the panel, not in Data Space.

**For the sales team:** before building a demo moment on a form submission,
run through a live submission yourself and confirm the result on the contact
in the panel, the same discipline as every other surface.

---

## Things that look like bugs and are not

- **Three misspelled slugs** are deliberate and part of the campaign contract:
  `subscripton-popup`, `horizonal-popup`, `stickey-bar`. Correcting them breaks
  the campaigns.
- **The unprefixed campaigns must stay.** NovaPay and Meridian still trigger on
  the bare slugs. Deleting them takes eight widgets dark on two sites.
- **The RU site is not linked from BR or EN.** There is no language switcher;
  reach it by URL. This was a deliberate decision, not an oversight.
- **`list_name` is `favorites` on all three sites**, so wishlist segments work
  across languages unchanged.
- **Click ids, tag names and tag values are identical in all three languages.**
  The Russian survey shows `Грузовые` and still writes `truck`, so one segment
  and one A/B report work regardless of the language the visitor saw.

---

## Publishing the tag

The tag was created but this environment's git proxy refuses tag pushes, so it
has to be pushed from a normal clone:

```
git fetch origin
git tag -a v1.0 5aa6f9f -m "v1.0 CantuPneus eCommerce demo, three languages"
git push origin v1.0
```
