# NovaPay event model and Data Space table specification

> Status: **built, and delivery confirmed on 31 July 2026.** All ten tables and
> the `fintech_products` dimension exist in the panel, the star schema relations
> are wired, and `tools/verify/liveprobe.js` fired a maximal row into every
> table. Salil confirmed in Data Space that **every table received its row and
> every attribute holds a value**, on both the identified and the anonymous
> path.
>
> **The SDK path is confirmed too.** The probe bypasses the SDK, so on its own
> it proved only the schema, the endpoint and the envelope. Driving the
> published site under `?ck=fintech-live-1` closed that gap the same day: the
> site's own calls land. Delivery is therefore proven end to end.
>
> **Landing is not the same as being segmentable, and that bit is NOT settled.**
> A segment over these tables returned zero while the tables plainly held
> matching rows, because the relation was created against `contact_key` instead
> of `device_id`. See §2.5. Two separate claims, and only the first is proven:
> the rows are there, and reaching them from a segment depends on the relation
> being right.

---

## 1. Why this replaces the ecommerce mapping

The first build of this site was forked from the CantuPneus tyre storefront and
kept its data model: products with a price and an old price, a cart, a checkout
and an order. The application funnel was mapped onto `ec:addToCart`,
`ec:beginCheckout` and `ec:order` so it would populate the standard tables.

That decision is reversed. A digital money app has no cart, no basket total and
no order. `shopping_cart_events`, `order_events`, `order_events_detail`,
`wishlist_events` and `search_events` carry columns (`quantity`, `unit_price`,
`shipping_method`, `stock_count`) that either have no meaning here or have to be
faked, and a FinTech prospect reading those tables in Data Space sees a retail
schema wearing a bank's name.

**What is kept:** `page_view_events`, via the SDK's first-class `pageView` call.
Page views are page views in any industry, and the standard table is the right
home for them.

**What replaces the rest:** ten purpose-built Big Data tables, below, one per
domain of the money-app lifecycle. Each is narrow enough that every column is
populated on most rows, which is what makes a table readable in a demo.

---

## 2. Conventions that apply to every table

**Naming.** Every table is `fintech_<domain>_events`. Every event name is
`snake_case` and carries no prefix inside the table, because the table name
already scopes it. The `fintech_` prefix stays on the **dataLayer** event names
that trigger On-Site campaigns, which is a separate contract (§6).

**Filled by the SDK, do not create and do not write:** `key` and `event_date`.

**Three more columns are filled by the SDK too**, and the site must never write
them by hand: `dn_device_id`, `dn_contact_key` and `session_id`. The SDK puts
them in the event envelope and resolves identity per event, so a hand-written
copy goes stale the moment somebody signs in or out. **Create the columns** so
they receive the SDK's values; just never populate them from the page.
`dn_device_id` carries the same value as `key`. `appevents.js` asserts that no
payload from this site contains any of them.

This reverses an earlier draft here that captured the device id through
`getDeviceId` and buffered every event until it resolved. That was built on a
guess about what the `key` column holds. Settled with Salil on
31 July 2026, and agreed with the Banking session so both finance datasets share
one spine.

**Every column on every table must be created NULLABLE, and created now.** The
platform allows only nullable columns to be added to a table that already holds
records, so a column forgotten today can never be added as required later.
Create the full column list below even where the demo does not populate it yet.

**The common spine.** Every table below carries these nine columns in addition
to its own, and they are identical on the Meridian banking demo, so one segment
can span both brands.

| Column | Type | Written by | Notes |
|---|---|---|---|
| `event_type` | Text | site | the specific event, e.g. `kyc_submitted`. Always sent |
| `event_source` | Text | site | `web` or `android`. The Android app writes the same tables |
| `page_path` | Text | site | the **full URL**, not just the path: the query string carries `?ck=` and campaign parameters, and a path alone loses attribution. The column keeps the shared name |
| `is_authenticated` | Boolean | site | |
| `customer_tier` | Text | site | `prospect`, `classic`, `premier`, `private`. Shared vocabulary, see below |
| `app_version` | Text | site | build identifier, so a segment can exclude an older build |
| `session_id` | Text | **SDK** | declare it or the SDK's value is dropped |
| `dn_contact_key` | Text | **SDK** | resolved at send time, empty for anonymous. Informational, **not** the relation column |
| `dn_device_id` | Text | **SDK** | same value as `key`, named so exports read clearly |

`product_id` is added on `fintech_product_events` and `fintech_credit_events`,
where it is the relation column to `fintech_products`. Omitted elsewhere.

**`customer_tier` uses a shared vocabulary, not NovaPay's plan names.** The
site maps its own tiers onto the four agreed values so a segment means the same
thing on both brands:

| NovaPay state | `customer_tier` |
|---|---|
| not signed up | `prospect` |
| free or plus | `classic` |
| premium | `premier` |
| metal | `private` |

**Amounts.** Every money column is a `decimal` in **minor-unit-free** form, so
`120.50`, not `12050`. Currency always travels in its own `currency` column as a
3-letter ISO code, never baked into the amount.

**Bands, not just raw figures.** Where a raw amount is sensitive or awkward to
segment on, the event carries **both** the figure and a band
(`balance_band`, `credit_score_band`). Bands are what a marketer builds a
segment from without writing SQL.

**Nulls are honest.** A field that does not apply is omitted, never zero-filled.
`Number(null) === 0` has produced a real bug in this repository twice: a null
stock became `0` and every event claimed the catalogue was out of stock. Any
normalizer written for these payloads must be idempotent.

**Column types used below:** `string`, `integer`, `decimal`, `boolean`,
`datetime`. Map each to the nearest type the panel offers when creating the
table.

---

## 2.5 The relational model, and why it is shaped this way

Source: `dev.dengage.com/docs/star-schema-relational-database`.

Data Space is a **star schema**. `master_contact` and `master_device` are the
hubs, every other table hangs off them, and relations are created in the Connect
Toolbox with **New Relation** by matching a column in each table. The platform
supports **1:1, 1:N and N:M**, and **N-level relations** as long as the two
master tables stay the central connection points. `master_contact` is already
1:N to `master_device`.

Two properties of the platform drive the whole design:

- **`contact_key` is nullable in `master_device`**, deliberately, so a device
  with no contact still registers. That is the anonymous visitor, and on an
  acquisition-led FinTech site most of the interesting rows are anonymous. The
  model must not assume a contact exists.
- **`master_device` is structurally read-only.** Nothing here proposes changing
  it.

### The decision: ten fact tables, one dimension, no runtime dimensions

**Every one of the ten event tables is a fact table**, append-only, related
**1:N from `master_device`** matching `device_id` to the table's `key`, and
reached from a contact
through the existing `master_contact` to `master_device` relation rather than
directly. Why that way round is set out under the relation list below.

**One dimension table is added: `fintech_products`** (§3.11). It is static
reference data, 16 rows imported from a CSV, and it is the highest-value
join in the model: `fintech_product_events` and `fintech_credit_events` relate
**N:1** to it on `product_id`. Adding it means a fee change is one row rather
than being wrong across all history.

**No dimension tables for accounts, cards, pots or applications**, and this is
the decision most worth explaining, because a textbook star schema would create
all four.

A dimension table has to be **maintained**: rows inserted and updated as state
changes. The web SDK cannot do that. `sendDeviceEvent` appends an event; it
cannot upsert a dimension row. Maintaining one needs the REST `UpsertData` API,
which requires server-side credentials that a static demo served from GitHub
Pages does not have and must not carry.

So the only ways to keep those four tables current would be hand-editing them
between demos, or standing up a server. Both are worse than the alternative,
because **a stale dimension is more damaging than a denormalised column**: it
makes the joined figures wrong, in front of a prospect, with no error.

Therefore `account_id`, `card_id`, `pot_id` and `application_id` stay as plain
columns on the fact tables. They already group rows correctly, and if a real
customer ever wants those dimensions they are additive later.

### Fact-to-fact relations: define the one that pays

`fintech_transaction_events` **1:N** `fintech_support_events`, matched on
`transaction_id`. A dispute then resolves to the merchant, amount and category
of the transaction it disputes, without duplicating any of it, which is the
single most demo-visible join in the model.

Whether two Big Data tables may relate directly is unconfirmed; ask Salil.
**If the Connect Toolbox refuses this one, nothing breaks**: `transaction_id`
remains a plain column and every row is unchanged.

### The full relation list

**Corrected 31 July 2026.** An earlier version of this section related every
fact table to BOTH masters and then claimed a total of 15. Both were wrong: the
list actually came to 24, and ten of those were redundant. What follows is the
corrected design.

| From | To | Type | Matched on |
|---|---|---|---|
| `master_contact` | `master_device` | 1:N | `contact_key` (platform default, already exists) |
| `master_device` | each of the 10 fact tables | 1:N | **`master_device.device_id` = `<table>.key`** |
| `fintech_products` | `fintech_product_events` | 1:N | `product_id` |
| `fintech_products` | `fintech_credit_events` | 1:N | `product_id` |
| `fintech_transaction_events` | `fintech_support_events` | 1:N | `transaction_id` |

**14 relations across 12 tables**, of which 13 need creating: the
contact-to-device one already exists.

### Why the fact tables hang off master_device and NOT off master_contact

This is the part most worth understanding, because relating them to both looks
more thorough and is actively worse.

**The contact path already exists.** `master_contact` is 1:N to
`master_device`, and the platform supports N-level relations with the two
masters as the central connection points. So a contact already reaches its
events in two hops, contact to device to event. Adding a direct
contact-to-event relation creates a second path to the same rows: pure
duplication, and two paths that can disagree once a device is reassigned.

**A direct contact relation would silently drop the most valuable rows.**
`contact_key` is null for anonymous visitors, by design, and on an
acquisition-led site most of the interesting rows are anonymous: the person
comparing two cards before they have an account. A relation matched on
`contact_key` cannot see any of them. The device relation can, because the SDK
fills `dn_device_id` on every row.

**It also survives the moment someone signs up.** Setting a contact key stamps
it onto the device record, so a visitor's earlier anonymous events become
reachable from the contact retroactively, through the device. That is exactly
the "what did they look at before they signed up" question a FinTech prospect
asks, and it works for free through the device path and not at all through a
direct contact path.

`dn_contact_key` stays as a **column** on every fact table, filled by the SDK,
because it is worth having on an export and it leaves the option of adding the
direct relation later. It is just not a relation.

### THE RELATION MUST MATCH device_id TO key. Not contact_key.

Define the relation on the correct key columns **before** building the segment:
a segment over a misdefined relation returns zero rows. That happened here, a
segment over `fintech_credit_events` returned zero contacts and zero devices
while the table plainly held matching rows, because the relation had been
created against `contact_key`.

`key` holds the **device id**, whether the visitor is identified or not, so a
relation on `contact_key` matches nothing.

**Correct:** match `master_device.device_id` to `<table>.key`, on all ten fact
tables. Then the contact path works through the existing
`master_contact` to `master_device` relation, and the anonymous branch becomes
what it was meant to be: join on device, keep the devices with no contact.

This is the same argument as the one against relating fact tables to
`master_contact` directly, made concrete: any join through `contact_key` drops
every anonymous visitor, and on an acquisition-led site that is most of
the interesting data.

**A date filter is mandatory on a Big Data table** in the segment builder, so
every segment over these tables carries one. That is a platform rule.

### One thing to check in the Connect Toolbox

Whether the ten device relations need creating at all, or whether the platform
already links an SDK-written Big Data table to `master_device` through the `key`
column it fills itself. If it does, only three relations need creating by hand:
the two on `fintech_products` and the one from transactions to support.

Try `fintech_transaction_events` first and see whether it is already related
before creating anything.

No N:M relation is needed anywhere, which is worth noting because N:M is the one
that usually needs a join table and ongoing maintenance.

---

## 3. The nine tables

### 3.1 `fintech_onboarding_events`

The acquisition and KYC funnel, from anonymous visitor to a usable account.
This is the table that shows abandonment, and it is the strongest single table
in a FinTech demo because every step is a campaign trigger.

| Column | Type | Notes |
|---|---|---|
| *common spine* | | see §2 |
| `step` | string | `signup_started`, `email_verified`, `phone_verified`, `kyc_started`, `doc_uploaded`, `selfie_captured`, `kyc_submitted`, `kyc_approved`, `kyc_rejected`, `account_opened` |
| `step_index` | integer | 1 to 10, so a funnel chart sorts without a lookup |
| `status` | string | `started`, `completed`, `failed`, `abandoned` |
| `method` | string | `email`, `phone`, `apple`, `google` |
| `doc_type` | string | `passport`, `national_id`, `driving_licence` |
| `failure_reason` | string | `blurred_document`, `expired_document`, `name_mismatch`, `sanctions_hit`, `age_check_failed` |
| `product_intent` | string | product id the visitor arrived wanting, if any |
| `referral_code` | string | |
| `time_on_step_sec` | integer | how long the step took, for a "stuck in KYC" segment |

**Events:** `signup_started`, `email_verified`, `phone_verified`, `kyc_started`,
`kyc_doc_uploaded`, `kyc_selfie_captured`, `kyc_submitted`, `kyc_approved`,
`kyc_rejected`, `kyc_abandoned`, `account_opened`.

**Talk track.** `kyc_abandoned` with `step = doc_uploaded` and
`failure_reason = blurred_document` is a push notification that says "your photo
was too blurry, try again in daylight". That is the single most requested
FinTech use case and it is one row in this table.

---

### 3.2 `fintech_account_events`

Account state, session security and the housekeeping a money app does. Security
lives here rather than in its own table because in a demo the interesting
segments (new device, failed logins) sit next to the account they belong to.

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `account_id` | string | |
| `account_type` | string | `current`, `savings`, `multi_currency`, `joint`, `business` |
| `currency` | string | ISO 4217 |
| `balance` | decimal | balance after the event |
| `balance_band` | string | `negative`, `0-99`, `100-499`, `500-1999`, `2000-9999`, `10000+` |
| `action` | string | see events below |
| `channel` | string | `web`, `android`, `ios`, `branch`, `call_centre` |
| `device_name` | string | for the security events |
| `is_new_device` | boolean | |
| `failure_reason` | string | `wrong_password`, `expired_otp`, `locked_out` |

**Events:** `account_opened`, `balance_viewed`, `statement_downloaded`,
`account_frozen`, `account_closed`, `low_balance_detected`, `salary_detected`,
`login_succeeded`, `login_failed`, `device_added`, `two_factor_enabled`,
`password_changed`, `suspicious_activity_flagged`.

**Talk track.** `low_balance_detected` three days before `salary_detected` is
the trigger for an overdraft or a Savings Boost offer, and `is_new_device = true`
on `login_succeeded` is a security in-app message. Both are real bank campaigns.

---

### 3.3 `fintech_transaction_events`

Money movement. The highest-volume table and the one that makes the demo feel
like a real bank.

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `transaction_id` | string | |
| `transaction_type` | string | `topup`, `transfer_out`, `transfer_in`, `card_payment`, `direct_debit`, `standing_order`, `atm_withdrawal`, `fx_conversion`, `refund` |
| `amount` | decimal | always positive; direction is in `transaction_type` |
| `currency` | string | |
| `amount_home_currency` | decimal | converted to the account's currency, so totals work |
| `fee` | decimal | |
| `fx_rate` | decimal | null when no conversion happened |
| `currency_from` | string | FX and international transfers only |
| `currency_to` | string | |
| `country_to` | string | ISO country, for corridor segments |
| `merchant_name` | string | card payments only |
| `merchant_category` | string | `groceries`, `transport`, `eating_out`, `subscriptions`, `travel`, `bills`, `shopping`, `cash` |
| `is_recurring` | boolean | detected subscription |
| `status` | string | `completed`, `pending`, `failed`, `reversed` |
| `failure_reason` | string | `insufficient_funds`, `limit_exceeded`, `blocked_by_rules`, `recipient_invalid` |

**Events:** `topup_completed`, `transfer_sent`, `transfer_received`,
`card_payment_made`, `fx_conversion_completed`, `direct_debit_created`,
`standing_order_created`, `atm_withdrawal`, `transaction_failed`,
`transaction_reversed`, `first_transaction_completed`.

**Talk track.** `first_transaction_completed` is the activation event the whole
onboarding funnel exists to reach: everyone who opened an account and has not
fired it within seven days is the reactivation segment. `merchant_category` plus
`is_recurring` gives the subscription-detection story with no extra work.

---

### 3.4 `fintech_card_events`

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `card_id` | string | |
| `card_type` | string | `physical`, `virtual`, `disposable` |
| `card_tier` | string | `plus`, `travel`, `metal`, `business` |
| `action` | string | see events |
| `reason` | string | `lost`, `stolen`, `damaged`, `expired`, `user_request`, `fraud_suspected` |
| `limit_type` | string | `daily_spend`, `atm`, `online`, `contactless` |
| `limit_amount` | decimal | |
| `delivery_status` | string | `ordered`, `printed`, `dispatched`, `delivered` |
| `days_since_order` | integer | drives the "activate your card" nudge |

**Events:** `card_ordered`, `card_dispatched`, `card_delivered`,
`card_activated`, `card_frozen`, `card_unfrozen`, `card_replaced`,
`card_cancelled`, `pin_changed`, `pin_viewed`, `contactless_toggled`,
`card_limit_changed`, `virtual_card_created`, `card_added_to_wallet`.

**Talk track.** `card_delivered` with no `card_activated` after three days is the
classic dormant-card push. `card_frozen` with `reason = fraud_suspected` opens
the support journey in §3.9.

---

### 3.5 `fintech_savings_events`

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `pot_id` | string | |
| `pot_name` | string | free text the customer chose, e.g. "Japan 2027" |
| `goal_amount` | decimal | |
| `current_amount` | decimal | |
| `progress_pct` | integer | 0 to 100, precomputed so a segment does not need arithmetic |
| `target_date` | datetime | |
| `funding_method` | string | `manual`, `round_up`, `payday_split`, `recurring` |
| `interest_rate` | decimal | AER as a percentage, e.g. `4.85` |
| `is_shared` | boolean | |

**Events:** `pot_created`, `pot_funded`, `pot_withdrawn`, `pot_closed`,
`goal_set`, `goal_reached`, `round_up_enabled`, `round_up_disabled`,
`payday_split_enabled`, `savings_rate_viewed`.

**Talk track.** `progress_pct` crossing 50 or 90 is a congratulation message
that costs nothing and drives deposits. `goal_reached` is the moment to offer
the investing product in §3.6.

---

### 3.6 `fintech_investment_events`

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `instrument_id` | string | |
| `instrument_name` | string | |
| `asset_class` | string | `stocks`, `etf`, `crypto`, `managed_portfolio`, `bonds` |
| `risk_profile` | string | `cautious`, `balanced`, `adventurous` |
| `amount` | decimal | |
| `currency` | string | |
| `order_type` | string | `market`, `limit`, `recurring` |
| `is_recurring` | boolean | |
| `holding_value` | decimal | portfolio value after the event |
| `pnl_pct` | decimal | can be negative |

**Events:** `portfolio_viewed`, `risk_profile_set`, `instrument_viewed`,
`watchlist_added`, `watchlist_removed`, `investment_made`, `investment_sold`,
`recurring_buy_created`, `recurring_buy_cancelled`, `first_investment_made`.

**Note on `watchlist_added`.** This is the honest FinTech replacement for the
retail wishlist, and it deliberately does **not** use `ec:addToWishlist`:
`wishlist_events` carries `stock_count`, which is meaningless for an instrument.

---

### 3.7 `fintech_credit_events`

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `product_id` | string | |
| `product_name` | string | |
| `credit_type` | string | `personal_loan`, `credit_builder`, `overdraft`, `credit_card`, `bnpl` |
| `requested_amount` | decimal | |
| `approved_amount` | decimal | |
| `term_months` | integer | |
| `apr` | decimal | |
| `monthly_repayment` | decimal | |
| `decision` | string | `quoted`, `approved`, `declined`, `referred` |
| `decline_reason` | string | `affordability`, `thin_file`, `existing_debt`, `failed_verification` |
| `credit_score` | integer | |
| `credit_score_band` | string | `poor`, `fair`, `good`, `very_good`, `excellent` |
| `score_change` | integer | signed, so `-12` is a drop |

**Events:** `credit_score_viewed`, `credit_score_changed`,
`loan_calculator_used`, `loan_quote_requested`, `loan_application_started`,
`loan_application_submitted`, `loan_approved`, `loan_declined`,
`repayment_made`, `repayment_missed`, `credit_limit_increased`.

**Talk track.** `loan_calculator_used` with no `loan_quote_requested` inside an
hour is the highest-intent abandonment on the whole site. `credit_score_changed`
with a positive `score_change` is a genuinely welcome notification, which is a
useful thing to show a prospect worried about notification fatigue.

---

### 3.8 `fintech_product_events`

Consideration and the application funnel. This is what replaces
`shopping_cart_events` and `order_events`, in finance vocabulary.

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `product_id` | string | `NPY-CRD-METAL` etc |
| `product_name` | string | |
| `product_family` | string | `cards`, `savings`, `investing`, `credit`, `global`, `protection` |
| `plan_tier` | string | `free`, `plus`, `premium`, `metal`, `business` |
| `monthly_fee` | decimal | the real pricing model for a money app, not a one-off price |
| `headline_rate` | decimal | AER or APR, whichever the product quotes |
| `rate_type` | string | `aer`, `apr`, `fx_markup`, `none` |
| `application_id` | string | groups every row of one application |
| `funnel_step` | string | `viewed`, `compared`, `shortlisted`, `eligibility_checked`, `application_started`, `details_entered`, `submitted`, `approved`, `declined`, `abandoned` |
| `step_index` | integer | |
| `products_in_application` | integer | replaces "items in cart" |
| `comparison_set` | string | comma-separated product ids compared together |
| `abandon_step` | string | populated only on `application_abandoned` |

**Events:** `product_viewed`, `product_compared`, `product_shortlisted`,
`product_unshortlisted`, `eligibility_checked`, `application_started`,
`application_step_completed`, `application_submitted`, `application_approved`,
`application_declined`, `application_abandoned`.

**Talk track.** `product_compared` with a `comparison_set` of two cards, then no
`application_started`, is the on-site scenario trigger: show the comparison they
abandoned. `monthly_fee` rather than a one-off price is the detail that tells a
FinTech prospect this was built for them.

---

### 3.9 `fintech_support_events`

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `case_id` | string | |
| `case_type` | string | `dispute`, `chargeback`, `complaint`, `query`, `fraud_report` |
| `category` | string | `card`, `transfer`, `account`, `app`, `fees` |
| `channel` | string | `chat`, `phone`, `email`, `in_app` |
| `transaction_id` | string | links a dispute to §3.3 |
| `disputed_amount` | decimal | |
| `resolution_status` | string | `open`, `awaiting_customer`, `resolved`, `rejected` |
| `time_to_resolution_hours` | integer | |
| `satisfaction_score` | integer | 1 to 5, captured after resolution |

**Events:** `chat_started`, `faq_viewed`, `dispute_raised`,
`chargeback_requested`, `complaint_logged`, `fraud_reported`, `case_updated`,
`case_resolved`, `satisfaction_submitted`.

---

### 3.10 `fintech_engagement_events`

The Dengage surface itself: which scenario or widget was shown and what the
visitor did with it. This replaces the current `fintech_onsite_events` table,
which only ever carried five columns.

| Column | Type | Notes |
|---|---|---|
| *common spine* | | |
| `scenario_slug` | string | `survey`, `spin-to-win`, ... |
| `scenario_group` | string | `Default Scenarios`, `Inline Scenarios`, `On Site Scenarios`, `Gamification Scenarios`, `Product Recommendations` |
| `widget_name` | string | display name |
| `channel` | string | `onsite`, `inapp`, `push`, `inbox` |
| `page_type` | string | `landing`, `dashboard`, `product`, `transfers`, `cards`, `savings`, `investing`, `credit`, `support` |
| `interaction` | string | `triggered`, `displayed`, `clicked`, `dismissed`, `submitted` |
| `reward` | string | gamification outcome, e.g. `cashback_5`, `fee_free_month` |

**Events:** `scenario_triggered`, `section_read`, `push_permission_granted`,
`push_permission_denied`, `deep_link_opened`, `silent_push_received`.

This was the one table with no declared event list, and the omission had a
cost: nothing could tell a legitimate row from an invented one, so the app
sent `channel = "app"`, which is not a member of the vocabulary two rows
above, and the column arrived empty. The list is now what the website and the
app actually send, and `fintech/tools/eventtest.js` checks both against it.

**`interaction` is a widget vocabulary and everything maps onto it.** A push
permission granted is a `clicked`, a permission denied is a `dismissed`, and a
notification opened is a `clicked`. Adding members for each new surface would
make the column mean nothing; mapping onto the five keeps one funnel readable
across onsite, in-app, push and inbox.

That is ten fact tables in total, not nine: the nine journey tables plus this one.

---

### 3.11 `fintech_products`, the one dimension table

Static reference data. 16 rows, imported once from
`fintech/fintech_products.csv`, never written by the SDK. It exists so a product's fee and rate live in one place
instead of being copied onto every event row, which is what §2.5 explains.

Relates **1:N** to `fintech_product_events` and `fintech_credit_events` on
`product_id`.

| Column | Type | Notes |
|---|---|---|
| `product_id` | string | the match column, e.g. `NPY-CRD-METAL` |
| `product_name` | string | |
| `product_family` | string | `cards`, `savings`, `investing`, `credit`, `global`, `protection` |
| `plan_tier` | string | `free`, `plus`, `premium`, `metal`, `business` |
| `monthly_fee` | decimal | the money-app pricing model. Not a one-off price |
| `headline_rate` | decimal | AER or APR, whichever the product quotes |
| `rate_type` | string | `aer`, `apr`, `cashback`, `fx_markup`, `none` |
| `is_active` | boolean | so a withdrawn product stops appearing without deleting history |

**16 rows, not nine.** An earlier version of this section listed only the nine
products the app's own catalogue screen shows. That was wrong: the
recommendation widgets, the similar-products slider and the product page can
all fire `product_shortlisted` for any product in `novapay_products.json`, which
carries 16. A nine-row dimension would fail to join on the other seven,
returning fewer rows rather than an error.

**Import `fintech/fintech_products.csv`**, which is generated from the site
rather than typed by hand: product names come from the feed, and the fee, rate
and tier for the nine catalogue products are read out of the `PRODUCTS` array in
`js/novapayApp.js`, because that array is what the site puts INTO the event
payloads. If the dimension disagreed with the facts, a joined report would show
one figure while the event row showed another.

| product_id | product_name | family | tier | monthly_fee | headline_rate | rate_type |
|---|---|---|---|---|---|---|
| `NPY-CRD-METAL` | NovaPay Metal Card | cards | metal | 16.99 | 2.00 | cashback |
| `NPY-CRD-PLUS` | NovaPay Plus Card | cards | plus | 0.00 | 1.00 | cashback |
| `NPY-CRD-TRAVEL` | NovaPay Travel Card | cards | premium | 6.99 | 0.00 | fx_markup |
| `NPY-CRD-BIZ` | NovaPay Business Card | cards | business | 9.99 | | none |
| `NPY-INV-STOCKS` | Stocks Pro | investing | plus | 0.00 | | none |
| `NPY-INV-CRYPTO` | Crypto Vault | investing | plus | 0.00 | | none |
| `NPY-INV-ROBO` | Managed Portfolio | investing | premium | 0.45 | | none |
| `NPY-SAV-BOOST` | Savings Boost | savings | plus | 0.00 | 4.85 | aer |
| `NPY-SAV-POTS` | Goal Pots Pro | savings | plus | 1.99 | 4.85 | aer |
| `NPY-CRE-BUILD` | Credit Builder | credit | free | 4.99 | | none |
| `NPY-CRE-LOAN` | Personal Loan | credit | free | 0.00 | 6.90 | apr |
| `NPY-GLB-ACCOUNT` | Multi-Currency Account | global | plus | 0.00 | 0.00 | fx_markup |
| `NPY-GLB-TRANSFER` | Global Transfers Pro | global | plus | 0.00 | 0.00 | fx_markup |
| `NPY-PRO-TRAVEL` | Travel Insurance | protection | premium | 9.99 | | none |
| `NPY-PRO-DEVICE` | Device Insurance | protection | plus | 6.99 | | none |
| `NPY-PRO-PURCHASE` | Purchase Protection | protection | plus | 4.99 | | none |

An empty `headline_rate` means the product quotes no headline rate, which is why
`rate_type` is `none`. It is left empty rather than zero: a 0.00% APR is a claim,
and an absent rate is not.

**The event tables keep their copies of `product_name`, `plan_tier` and
`monthly_fee` as well.** That looks like the duplication the dimension was meant
to remove, and it is deliberate: it is the historical value at the moment of the
event, which is what a report about last quarter needs, while the dimension
carries today's value, which is what a campaign targeting current customers
needs. Losing either one costs more than the duplicated column.

---

## 4. Custom contact attributes

Events describe what happened. These describe who the contact **is**, and they
are what a marketer actually builds segments on. Created as contact extension
columns rather than event columns.

| Attribute | Type | Notes |
|---|---|---|
| `kyc_status` | string | `none`, `pending`, `approved`, `rejected` |
| `account_opened_date` | datetime | |
| `lifecycle_stage` | string | `visitor`, `applicant`, `onboarding`, `activated`, `engaged`, `dormant`, `churned` |
| `plan_tier` | string | `free`, `plus`, `premium`, `metal` |
| `products_held` | string | comma-separated families |
| `product_count` | integer | |
| `primary_currency` | string | |
| `balance_band` | string | as §3.2 |
| `monthly_inflow_band` | string | `0`, `1-999`, `1000-2999`, `3000+` |
| `credit_score_band` | string | as §3.7 |
| `has_card` / `has_savings` / `has_investment` / `has_credit` | boolean | four flags, because cross-sell segments are built on exactly these |
| `days_since_last_transaction` | integer | the dormancy trigger |
| `preferred_channel` | string | `push`, `email`, `sms`, `inapp` |
| `marketing_consent` | boolean | keep it explicit; financial promotions are regulated |

---

## 5. What is deliberately NOT used

| Not used | Why |
|---|---|
| `shopping_cart_events` | there is no cart; `quantity` and `unit_price` are meaningless for a card |
| `order_events`, `order_events_detail` | an application is approved or declined, it is not an order with a shipping method |
| `wishlist_events` | replaced by `watchlist_added` in §3.6 |
| `search_events` | replaced by in-app search inside `fintech_engagement_events` if search survives the rebuild |
| `stock_count` anywhere | a card has no unit count; a fabricated figure poisons every segment built on it |
| `page_view_events` | **this one IS used**, via the first-class `pageView` call |

---

## 6. The two event contracts, unchanged in shape

Keeping these separate is what stops the panel contract from drifting.

**Contract 1, On-Site campaign triggers.** A `dataLayer` push whose `event` name
matches a campaign trigger in the panel. These are **`fintech_` prefixed for
all 25 scenarios**, including the eight defaults, so NovaPay serves its own
creative. The eight keep their exact slugs, misspellings included:

```
fintech_survey              fintech_nps-popup        fintech_subscripton-popup
fintech_stickey-bar         fintech_image-popup      fintech_image-bar
fintech_horizonal-popup     fintech_cta-image-popup
```

**The switch is one constant** (`SCENARIO_EVENT_PREFIX`), ON since 31 July
2026, and the eight `fintech_` campaigns exist in the panel and render. A
campaign must exist before a prefix change, because a missing campaign is not
an error: the widget is silently dark.

**Contract 2, data.** `sendDeviceEvent('<table>', payload)` into the tables
above. Independent of whether any campaign exists.

---

## 7. Proving it landed

**A 200 from `/api/web/event` means accepted, not stored.** The endpoint answers
200 with an empty body even for a completely empty request, so a captured
request only proves the browser did its job. The row in Data Space is the only
evidence.

### What has been proven, 31 July 2026

`tools/verify/liveprobe.js` fired one maximal row into each of the ten tables,
twice: once with contact key `fintech-probe`, once anonymous with an empty
`dn_contact_key`. Salil confirmed in Data Space that **every table received its
row and every attribute holds a value**, on both paths.

So the schema is right, the column names are right, the envelope is right, and
the anonymous path works. That last one matters most, because the acquisition
half of this demo lives there.

### The SDK path, confirmed the same day

The probe bypasses the SDK, so it could not say whether the site's own calls
land. That was closed by driving the **published** site with the marker
`?ck=fintech-live-1` and clicking the whole journey: verify identity, send
money, freeze a card, fund a goal, invest, run the loan calculator, shortlist
and apply, raise a dispute. Salil confirmed rows arriving.

A sample of tables was checked rather than all ten, and that is sufficient here:
every table goes through the **same** `send()` in `js/novapayEvents.js`, so the
SDK path is one code path, not ten. Per-table schema was already settled by the
probe. What the click-through adds is that the path works at all, and one
sample proves that as well as ten would.

**So delivery is now proven end to end**: the site makes the call, the SDK adds
identity, the row lands, every column is populated, and the anonymous path works
too.

### What is still unproven

| | |
|---|---|
| Segments over these tables | the relation must match `device_id` to `key`, see §2.5. Until that is fixed and retested, no segment returns anything |
| The probe's own rows | they carry invented device ids that were never registered, so they can never join to `master_device`. Only the click-through rows can |
| The eight Default Scenarios | **now proven**: the `fintech_` campaigns exist and were confirmed rendering against the real account on 2 August 2026 |
| Web push | never demonstrated from this site |
| The Android app | not written; `fintech/android/SETUP-MAC.md` |
| `page_view_events` | worth a glance next time, it is the one standard table still in use |

**Never use `salil-demo` as the marker.** Earlier probes did and filled Salil's
own contact with test devices.
