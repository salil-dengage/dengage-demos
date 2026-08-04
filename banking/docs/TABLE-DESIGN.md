# Meridian Bank: final table and relationship design

> **This document is the authority.** Where it disagrees with
> `EVENT-CATALOGUE.md`, this wins. The catalogue explains *why* each event
> exists and what campaign it unlocks; this file says exactly what to build in
> the panel. Decided 2026-07-31 against
> `dev.dengage.com/docs/star-schema-relational-database`.

---

## 0. The three rules that shaped this

Read from the Star Schema doc, not assumed.

1. **Big Data tables can join the Star Schema.** "Clients have the flexibility
   to create an unlimited number of additional data entities, or tables... These
   custom tables can then be seamlessly integrated into the Star Schema by using
   Connect toolbox." There is no Big Data exclusion.
2. **Only nullable columns can be added to a table that already holds records.**
   Therefore **every column below is nullable**, including the ones the site
   always sends. A non-nullable column is a decision that cannot be revisited
   once the first row lands, and it buys nothing: the site drops empty values
   before sending, so a null in these tables means "not applicable to this
   event", which is the truth.
3. **`master_device` is structurally read-only.** Nothing can be added to it, so
   any relation to it has to use a column it already has. That column is
   `device_id`.

### A curl probe proves storage, NOT identity

The live probe in `banking/tools/liveprobe.js` fabricates its device id and
contact key. That is fine for proving a table accepts a row, and it is
**useless for proving segmentation**, which was not obvious until a segment
came back empty against a table with visible rows in it.

`master_device` is populated only by the SDK when a real browser registers.
An invented `key` has no row there, so `master_device.device_id = <table>.key`
joins to nothing and every segment reads 0 contacts and 0 anonymous devices.
The rows are real, correct and **orphaned**.

| The probe proves | The probe cannot prove |
|---|---|
| Endpoint, envelope, accountId | That events join to a contact |
| Table names accept writes | That segmentation returns anybody |
| Column names and types | That the twelve relations resolve |
| The datetime format | Anything about real identity |

**Identity can only be verified from a real browser running the real SDK.**
Chromium in the build container has no outbound access, so that pass has to
happen on a machine that does, against the deployed site. Visit with
`?ck=<marker>`, use the journeys, then re-run the segment.

Corollary worth remembering: a segment returning 0 over a table that visibly
has rows is far more likely to be an identity problem than a data problem.
Check `master_device` for the `key` before suspecting anything else.

### Date and datetime are NOT ISO 8601

The single most expensive detail in this design, confirmed against the live
account. From the Data Space reference, "Data Types":

| Type | Format | Example |
|---|---|---|
| `DATE` | `YYYY-MM-DD` | `2024-12-18` |
| `DATETIME` | `YYYY-MM-DD HH:mm` | `2025-12-31 15:30` |

Space separator. **No seconds, no `T`, no `Z`, no timezone offset.** A value
carrying any of those arrives empty while the endpoint still answers 200. That
is exactly how `travel_start_date` and
`travel_end_date` were lost on the first probe: they went as
`2026-08-20T00:00:00Z`, which is the format almost every other platform wants.

`js/bankingEvents.js` owns the formatting through `toDengageDateTime()` and
`toDengageDate()`, so no page can reinvent the shape. Anything writing a
datetime must go through them.

Two more settings, decided rather than offered:

- **Retention: 24 months** on every table. The panel defaults to 3 and warns it
  cannot be changed after creation. Three months means a product demo given in
  August has an empty table by November, and the only remedy is deleting and
  rebuilding the table.
- **`key` is the device id, not the contact key.** Verified in this repo against
  the real SDK: "The row `key` is the device id in both cases." A known visitor
  also gets `dn_contact_key` populated; an anonymous one gets an empty string.
  This is why the join goes through `master_device`.

---

## 1. What to build

**Ten objects, plus one that already exists.**

| # | Table | Type | Purpose |
|---|---|---|---|
| 1 | `banking_products` | **Regular** | Product dimension. The 25 products, one row each. |
| 2 | `banking_product_events` | Big Data | Discovery and consideration |
| 3 | `banking_tool_events` | Big Data | Calculators and eligibility |
| 4 | `banking_application_events` | Big Data | Step-level application funnel |
| 5 | `banking_appointment_events` | Big Data | Adviser appointments |
| 6 | `banking_account_events` | Big Data | Servicing and account state |
| 7 | `banking_transaction_events` | Big Data | Spending, payments, mandates |
| 8 | `banking_card_events` | Big Data | Card controls and travel notices |
| 9 | `banking_wealth_events` | Big Data | Private banking |
| 10 | `banking_engagement_events` | Big Data | Offers, consent, message response |
| - | `banking_onsite_events` | Big Data | Already exists. The 25 scenario widgets. Leave alone. |

**If you are building eight rather than ten, skip `banking_wealth_events` and
`banking_products`.** Those two are the only ones whose absence I can handle
cleanly in code: wealth events are suppressed behind a single flag, and without
the dimension the event rows still carry every product attribute inline. Skipping
any of the other eight loses a journey, because a write to a table that does
not exist returns HTTP 200 and is not stored.

---

## 2. Columns on every Big Data table (tables 2 to 10)

`key` and `event_date` are created by the panel. Do not add them.

Add these nine to all nine event tables, **all nullable**:

| Column | Type | Notes |
|---|---|---|
| `event_type` | Text | The sub-action. Always sent. |
| `event_source` | Text | `web` or `android`. |
| `page_path` | Text | |
| `is_authenticated` | Boolean | |
| `customer_tier` | Text | `prospect`, `classic`, `premier`, `private`. |
| `session_id` | Text | The SDK sends it; declaring the column is what stores it. |
| `dn_contact_key` | Text | Contact key as resolved at send time. Empty for anonymous. Informational, **not** the relation column. |
| `dn_device_id` | Text | Same value as `key`, named so exports read clearly. |
| `product_id` | Text | On tables 2, 3 and 4 this is the relation column. Elsewhere omit it. |

> The site never writes `dn_contact_key`, `dn_device_id` or `session_id` by hand.
> The SDK puts them in the envelope and resolves identity per event, so a
> hand-written copy would go stale the moment somebody signs in or out. These
> columns exist to *receive* the SDK's values. A suite asserts no payload
> contains them.

---

## 3. Table-specific columns

All nullable. Types are the panel's own vocabulary: Text, Integer, Decimal,
Boolean, Date & Time.

### 1. `banking_products` (Regular, the dimension)

One row per product, 25 rows. Import file generated from
`banking/meridian_products.json`.

| Column | Type | Example |
|---|---|---|
| `product_id` | Text | `MRD-MTG-FIX5` |
| `product_name` | Text | `Five Year Fixed Rate Mortgage` |
| `product_category` | Text | `mortgage` |
| `product_subtype` | Text | `residential` |
| `category_path` | Text | `Products > Mortgages > Fixed rate` |
| `headline_rate` | Decimal | `4.09` |
| `rate_type` | Text | `fixed` |
| `rate_display` | Text | `4.09%` |
| `term_months` | Integer | `60` |
| `fee_amount` | Decimal | `1499` |
| `fee_frequency` | Text | `one_off` |
| `min_deposit_pct` | Decimal | `25` |
| `max_ltv` | Decimal | `75` |
| `min_amount` | Decimal | `25000` |
| `max_amount` | Decimal | `2000000` |
| `tier` | Text | `classic` |

**Why this table earns its place.** It makes the rate-drop campaign a one-row
update. Change `headline_rate` on `MRD-MTG-FIX5` here, and everyone holding a
`rate_alert_set` or `product_shortlisted` row against that product is a segment.
Without it you are comparing event rows to each other over time to infer that a
rate moved, which is fragile to build and awkward to explain on a call.

### 2. `banking_product_events`

`compared_with` Text · `list_name` Text · `position_in_list` Integer ·
`product_name` Text · `product_category` Text · `product_subtype` Text ·
`headline_rate` Decimal · `rate_type` Text · `term_months` Integer ·
`fee_amount` Decimal · `fee_frequency` Text · `min_deposit_pct` Decimal

Product attributes are carried on the event as well as in the dimension, on
purpose: the event records the rate **as it was when the customer saw it**,
which is what makes a rate-drop provable rather than inferred.

### 3. `banking_tool_events`

`tool_name` Text · `product_category` Text · `input_amount` Decimal ·
`input_deposit` Decimal · `input_term_months` Integer ·
`input_income_annual` Decimal · `input_outgoings_monthly` Decimal ·
`input_rate` Decimal · `result_monthly_payment` Decimal ·
`result_total_repayable` Decimal · `result_max_borrow` Decimal ·
`result_projected_value` Decimal · `loan_to_value_pct` Decimal ·
`eligibility_outcome` Text · `eligibility_score_band` Text · `completed` Boolean

### 4. `banking_application_events`

`application_id` Text · `product_category` Text · `step_name` Text ·
`step_index` Integer · `total_steps` Integer · `time_on_step_seconds` Integer ·
`requested_amount` Decimal · `requested_term_months` Integer · `decision` Text ·
`decline_reason_code` Text · `documents_outstanding` Integer ·
`channel_started` Text · `channel_completed` Text · `abandoned_at_step` Text

### 5. `banking_appointment_events`

`appointment_id` Text · `appointment_type` Text · `appointment_channel` Text ·
`branch_name` Text · `branch_city` Text · `adviser_name` Text ·
`scheduled_at` **Date & Time** · `lead_time_hours` Integer ·
`product_category` Text

### 6. `banking_account_events`

`account_id_masked` Text · `account_type` Text · `balance_amount` Decimal ·
`balance_band` Text · `available_balance` Decimal · `currency` Text ·
`overdraft_limit` Decimal · `overdraft_used` Decimal ·
`days_since_last_login` Integer · `goal_name` Text ·
`goal_target_amount` Decimal · `goal_progress_pct` Decimal · `support_topic` Text

### 7. `banking_transaction_events`

`transaction_id` Text · `account_id_masked` Text · `amount` Decimal ·
`currency` Text · `direction` Text · `merchant_name` Text ·
`merchant_category` Text · `mcc` Text · `country_code` Text ·
`is_foreign` Boolean · `payment_channel` Text · `payee_name` Text ·
`frequency` Text · `is_recurring` Boolean

### 8. `banking_card_events`

`card_id_masked` Text · `card_type` Text · `card_product` Text ·
`previous_limit` Decimal · `new_limit` Decimal · `freeze_reason` Text ·
`wallet_type` Text · `travel_country` Text ·
`travel_start_date` **Date & Time** · `travel_end_date` **Date & Time**

### 9. `banking_wealth_events`

`portfolio_id` Text · `portfolio_value_band` Text · `asset_class` Text ·
`holding_name` Text · `risk_profile` Text · `contribution_amount` Decimal ·
`contribution_frequency` Text · `withdrawal_amount` Decimal ·
`adviser_name` Text · `performance_band` Text

### 10. `banking_engagement_events`

`offer_id` Text · `offer_category` Text · `placement` Text ·
`consent_email` Boolean · `consent_sms` Boolean · `consent_push` Boolean ·
`consent_profiling` Boolean · `campaign_slug` Text

Only three columns in the entire design are Date & Time: `scheduled_at`,
`travel_start_date`, `travel_end_date`.

---

## 4. Relationship design

### The shape

```
master_contact
     │ 1:N   (platform-provided, already exists, on contact_key)
     ▼
master_device
     │ 1:N   ← draw these nine, on master_device.device_id = <table>.key
     ├──< banking_product_events
     ├──< banking_tool_events
     ├──< banking_application_events
     ├──< banking_appointment_events
     ├──< banking_account_events
     ├──< banking_transaction_events
     ├──< banking_card_events
     ├──< banking_wealth_events
     └──< banking_engagement_events

banking_products
     │ 1:N   ← draw these three, on banking_products.product_id = <table>.product_id
     ├──< banking_product_events
     ├──< banking_tool_events
     └──< banking_application_events
```

**Twelve relations to draw. Nine to `master_device`, three from
`banking_products`.**

### Relations to draw, exactly

| # | From (the 1 side) | Column | To (the N side) | Column | Type |
|---|---|---|---|---|---|
| 1 | `master_device` | `device_id` | `banking_product_events` | `key` | 1:N |
| 2 | `master_device` | `device_id` | `banking_tool_events` | `key` | 1:N |
| 3 | `master_device` | `device_id` | `banking_application_events` | `key` | 1:N |
| 4 | `master_device` | `device_id` | `banking_appointment_events` | `key` | 1:N |
| 5 | `master_device` | `device_id` | `banking_account_events` | `key` | 1:N |
| 6 | `master_device` | `device_id` | `banking_transaction_events` | `key` | 1:N |
| 7 | `master_device` | `device_id` | `banking_card_events` | `key` | 1:N |
| 8 | `master_device` | `device_id` | `banking_wealth_events` | `key` | 1:N |
| 9 | `master_device` | `device_id` | `banking_engagement_events` | `key` | 1:N |
| 10 | `banking_products` | `product_id` | `banking_product_events` | `product_id` | 1:N |
| 11 | `banking_products` | `product_id` | `banking_tool_events` | `product_id` | 1:N |
| 12 | `banking_products` | `product_id` | `banking_application_events` | `product_id` | 1:N |

`master_contact` to `master_device` already exists and needs nothing done.

### Why the join is `master_device.device_id`, not `master_contact.contact_key`

Three reasons, in order of importance.

1. **`key` is the device id.** Every row already carries it, and it is always
   populated. Joining on a column that is always present is the only join that
   never leaves rows behind.
2. **Anonymous behaviour survives.** `master_device.contact_key` is nullable by
   design so unidentified devices are still registered. Because the events hang
   off the device, a visitor who browses mortgages anonymously and signs up two
   days later brings that whole history with them: the device is already
   theirs, so the contact inherits it. Joining directly on contact key would
   have thrown away every pre-signup event, which on an acquisition site is most
   of the interesting ones.
3. **The doc calls this the intended shape.** N-level relations with
   `master_contact` and `master_device` as "the central connection points".
   Contact-level segmentation still works, it just travels
   `master_contact → master_device → banking_*`, which is one hop the segment
   builder makes for you.

`dn_contact_key` is still declared on every table, but as an informational
column for exports and debugging, **not** as a relation. Relating on it as well
would give two paths from a contact to the same row, which is how a segment
starts double-counting.

### Why `banking_products` relates only to the event tables

It is a dimension, not a contact-owned entity. Nobody "has" a product row. It
reaches the contact through the events, which is exactly the N-level relation
the platform advertises: `master_contact → master_device → banking_product_events
→ banking_products`.

---

## 5. Build order

The relations need both tables to exist, so:

1. Create `banking_products` (Regular), import the 25 rows.
2. Create the nine Big Data tables. Retention **24 months**, everything nullable.
3. Draw relations 1 to 9 from each event table's Connect Toolbox.
4. Draw relations 10 to 12 from `banking_products`.

The three tables already created need `session_id`, `dn_contact_key` and
`dn_device_id` adding via Edit Table. That is safe: they are nullable, and the
tables have no records yet. **Check their retention setting**, because that one
cannot be fixed by editing.
