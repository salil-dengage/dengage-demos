# Meridian Bank: event catalogue and table specification

> **Status: proposal, nothing built yet.** This document exists so the tables can
> be created in the Dengage panel before any code is written against them.
> Read it, change what you want changed, then I build to it.

Everything here is for `banking/` only. It does not describe `fintech/` or
`cantu-pneus/`.

---

## 0. The decision this document rests on

The ecommerce tables are not used on this site. A mortgage is not a basket item,
and a prospect who knows banking will notice a credit card sitting in
`shopping_cart_events` with a quantity of 1.

| | |
|---|---|
| **Kept** | `pageView`, writing to `page_view_events`. It is also the trigger the eight On-Site Default Scenarios listen for, so removing it would take every scenario dark. |
| **Kept** | `banking_onsite_events`, already live, for the 25 scenario widgets. |
| **Dropped** | `ec:addToCart`, `ec:beginCheckout`, `ec:order`, `ec:addToWishlist`, `ec:removeFromWishlist`, `ec:search`. |
| **Retired** | `banking_events`. Its two events move to `banking_tool_events` and `banking_appointment_events`. Safe to drop once the rebuild ships. |
| **New** | The eight `banking_*` tables below. |

This reverses "The application funnel is mapped onto the ecommerce API" in
`docs/DECISIONS-AND-GOTCHAS.md`, which is a shared file and still governs
`fintech/`. That doc needs updating outside this site's session.

### What the SDK fills in for you

Every custom write is:

```js
window.dengage('sendDeviceEvent', 'banking_application_events', payload);
```

The SDK supplies `key` (contact key), `event_date` and `session_id`. **Do not
declare or send those.** Every column listed below is one this site sends.

### One column that is never sent

`stock_count`. Not on any table, not under any other name. A card, a loan and a
mortgage have no unit count, and a fabricated figure poisons every segment built
on it. Where a count is genuinely absent the site sends nothing rather than `0`,
because `Number(null) === 0` has produced exactly that bug twice in this repo.

---

## 1. Site map the events are designed against

**Public**

Home · product listing per category (current accounts, savings and ISAs,
mortgages, loans, credit cards, wealth, insurance) · product detail · compare ·
mortgage affordability and repayment calculators · savings goal projector ·
eligibility checker · multi-step application journey · appointment booking ·
branch finder · help.

**Signed in**

Overview with accounts and balances · account detail with categorised
transactions · card management · payments, transfers, standing orders and direct
debits · statements and documents · savings goals · offers and rewards ·
marketing preferences · wealth portfolio for the private banking tier.

---

## 2. Columns present on every `banking_*` table

Declare these on all eight. They are what makes cross-table segmentation work.

| Column | Type | Null | Example | Why it exists |
|---|---|---|---|---|
| `event_type` | string | no | `application_submitted` | The sub-action. Every table is a family of events, not one event. Declared explicitly on every table rather than assumed. |
| `event_source` | string | no | `web` | `web` or `android`. The whole point of the mobile app is proving one contact key produces one journey across both. |
| `page_path` | string | yes | `/banking/mortgages.html` | |
| `is_authenticated` | boolean | no | `true` | Splits prospect behaviour from customer behaviour in one filter. |
| `customer_tier` | string | no | `premier` | `prospect`, `classic`, `premier`, `private`. Drives nearly every banking segment. |

---

## 3. The eight tables

### 3.1 `banking_product_events`

Product discovery and consideration on the public site.

`event_type`: `product_viewed`, `product_compared`, `product_shortlisted`,
`product_unshortlisted`, `rate_alert_set`, `rate_alert_cleared`,
`brochure_downloaded`, `product_shared`

| Column | Type | Null | Example |
|---|---|---|---|
| `product_id` | string | no | `MRD-MTG-FIXED5` |
| `product_name` | string | no | `Meridian 5 Year Fixed Mortgage` |
| `product_category` | string | no | `mortgage` |
| `product_subtype` | string | yes | `first_time_buyer` |
| `headline_rate` | decimal | yes | `4.29` |
| `rate_type` | string | yes | `fixed_aer` |
| `term_months` | integer | yes | `60` |
| `fee_amount` | decimal | yes | `999.00` |
| `fee_frequency` | string | yes | `one_off` |
| `min_deposit_pct` | decimal | yes | `10.0` |
| `compared_with` | string | yes | `MRD-MTG-FIXED2,MRD-MTG-TRACKER` |
| `list_name` | string | yes | `Mortgages for first time buyers` |
| `position_in_list` | integer | yes | `3` |

**Use case it unlocks.** Rate-drop. Everyone with `rate_alert_set` on a product
whose `headline_rate` has since moved is a segment, and `product_shortlisted`
without a matching `application_started` is a nurture audience.

---

### 3.2 `banking_tool_events`

Calculators and the eligibility checker. The richest first-party data on the
public site, because the customer volunteers their own numbers.

`event_type`: `mortgage_affordability_calculated`,
`mortgage_repayment_calculated`, `overpayment_calculated`,
`savings_goal_projected`, `isa_projection_run`, `loan_quote_generated`,
`eligibility_check_started`, `eligibility_check_completed`,
`eligibility_check_abandoned`

| Column | Type | Null | Example |
|---|---|---|---|
| `tool_name` | string | no | `mortgage_affordability` |
| `product_category` | string | no | `mortgage` |
| `input_amount` | decimal | yes | `420000.00` |
| `input_deposit` | decimal | yes | `42000.00` |
| `input_term_months` | integer | yes | `300` |
| `input_income_annual` | decimal | yes | `78000.00` |
| `input_outgoings_monthly` | decimal | yes | `1450.00` |
| `input_rate` | decimal | yes | `4.29` |
| `result_monthly_payment` | decimal | yes | `1812.44` |
| `result_total_repayable` | decimal | yes | `543732.00` |
| `result_max_borrow` | decimal | yes | `351000.00` |
| `result_projected_value` | decimal | yes | `24380.00` |
| `loan_to_value_pct` | decimal | yes | `90.0` |
| `eligibility_outcome` | string | yes | `likely` |
| `eligibility_score_band` | string | yes | `good` |
| `completed` | boolean | no | `true` |

**Use case it unlocks.** The single best demo moment on the site. "Everyone who
modelled a mortgage over 400k at above 85% LTV in the last 7 days and did not
start an application" is one filter, and it is a real audience a bank would pay
for. `result_max_borrow` below `input_amount` is a distinct and very actionable
segment: they want more than they can have, and a broker appointment is the
answer.

---

### 3.3 `banking_application_events`

The funnel that used to be `ec:addToCart` and friends. Step-level, because
mid-application abandonment is the retail banking trigger.

`event_type`: `application_started`, `step_completed`, `step_abandoned`,
`document_uploaded`, `document_rejected`, `application_submitted`,
`decision_returned`, `offer_accepted`, `offer_declined`, `account_activated`,
`application_withdrawn`

| Column | Type | Null | Example |
|---|---|---|---|
| `application_id` | string | no | `APP-8842190` |
| `product_id` | string | no | `MRD-MTG-FIXED5` |
| `product_category` | string | no | `mortgage` |
| `step_name` | string | yes | `income_and_employment` |
| `step_index` | integer | yes | `3` |
| `total_steps` | integer | yes | `6` |
| `time_on_step_seconds` | integer | yes | `184` |
| `requested_amount` | decimal | yes | `378000.00` |
| `requested_term_months` | integer | yes | `300` |
| `decision` | string | yes | `referred` |
| `decline_reason_code` | string | yes | `AFFORDABILITY` |
| `documents_outstanding` | integer | yes | `2` |
| `channel_started` | string | yes | `web` |
| `channel_completed` | string | yes | `android` |
| `abandoned_at_step` | string | yes | `income_and_employment` |

**Use case it unlocks.** Abandonment by step, which is what a bank actually
optimises. Dropping at `identity_verification` needs a different message from
dropping at `income_and_employment`. `documents_outstanding` above 0 for more
than 48 hours is a chase campaign that pays for itself. `channel_started`
against `channel_completed` proves cross-device continuity live on the call.

---

### 3.4 `banking_appointment_events`

`event_type`: `appointment_booked`, `appointment_rescheduled`,
`appointment_cancelled`, `appointment_attended`, `appointment_no_show`

| Column | Type | Null | Example |
|---|---|---|---|
| `appointment_id` | string | no | `APT-40912` |
| `appointment_type` | string | no | `mortgage_advice` |
| `appointment_channel` | string | no | `video` |
| `branch_name` | string | yes | `Leeds City` |
| `branch_city` | string | yes | `Leeds` |
| `adviser_name` | string | yes | `J. Okafor` |
| `scheduled_at` | datetime | no | `2026-08-14T10:30:00Z` |
| `lead_time_hours` | integer | yes | `72` |
| `product_category` | string | yes | `mortgage` |

**Use case it unlocks.** Reminder sequences keyed on `lead_time_hours`, and a
no-show recovery journey. `appointment_no_show` against `customer_tier` of
`private` is an escalation, not an email.

---

### 3.5 `banking_account_events`

Signed-in account state and servicing.

`event_type`: `account_opened`, `account_closed`, `balance_viewed`,
`low_balance_reached`, `overdraft_entered`, `overdraft_exited`,
`salary_credited`, `savings_goal_created`, `savings_goal_reached`,
`round_up_enabled`, `round_up_disabled`, `statement_viewed`,
`document_downloaded`, `support_contacted`, `complaint_raised`

| Column | Type | Null | Example |
|---|---|---|---|
| `account_id_masked` | string | no | `****4471` |
| `account_type` | string | no | `current_account` |
| `balance_amount` | decimal | yes | `2184.55` |
| `balance_band` | string | yes | `1k_5k` |
| `available_balance` | decimal | yes | `2684.55` |
| `currency` | string | no | `GBP` |
| `overdraft_limit` | decimal | yes | `500.00` |
| `overdraft_used` | decimal | yes | `0.00` |
| `days_since_last_login` | integer | yes | `19` |
| `goal_name` | string | yes | `Deposit` |
| `goal_target_amount` | decimal | yes | `42000.00` |
| `goal_progress_pct` | decimal | yes | `61.4` |
| `support_topic` | string | yes | `card_replacement` |

Both `balance_amount` and `balance_band` are declared on purpose. The band is
what you build durable segments on, since exact balances change hourly and a
segment defined on one is unstable.

**Use case it unlocks.** `overdraft_entered` three months running is a
consolidation loan conversation. `savings_goal_progress_pct` crossing 75 is a
congratulation and an ISA cross-sell. `days_since_last_login` is the dormancy
trigger every retail bank runs.

---

### 3.6 `banking_transaction_events`

Spending behaviour, payments and mandates. The strongest personalisation signal
a bank owns.

`event_type`: `transaction_posted`, `payment_made`, `transfer_made`,
`payment_failed`, `standing_order_created`, `standing_order_cancelled`,
`direct_debit_created`, `direct_debit_cancelled`, `large_transaction`,
`foreign_transaction`

| Column | Type | Null | Example |
|---|---|---|---|
| `transaction_id` | string | no | `TXN-99120384` |
| `account_id_masked` | string | no | `****4471` |
| `amount` | decimal | no | `84.20` |
| `currency` | string | no | `GBP` |
| `direction` | string | no | `debit` |
| `merchant_name` | string | yes | `Trainline` |
| `merchant_category` | string | yes | `travel` |
| `mcc` | string | yes | `4112` |
| `country_code` | string | yes | `FR` |
| `is_foreign` | boolean | no | `true` |
| `payment_channel` | string | yes | `mobile_wallet` |
| `payee_name` | string | yes | `Npower` |
| `frequency` | string | yes | `monthly` |
| `is_recurring` | boolean | yes | `true` |

**Use case it unlocks.** This is the section to demo. A `foreign_transaction` in
France triggers travel insurance and an FX message in real time. Recurring
`merchant_category` of `subscriptions` totalling over 60 a month is a spend
insight card. `direct_debit_cancelled` on a mortgage is a churn alarm that
should reach a human, not a campaign.

---

### 3.7 `banking_card_events`

`event_type`: `card_viewed`, `card_frozen`, `card_unfrozen`, `pin_viewed`,
`pin_changed`, `limit_change_requested`, `card_replaced`, `card_reported_lost`,
`added_to_wallet`, `contactless_toggled`, `travel_notice_set`

| Column | Type | Null | Example |
|---|---|---|---|
| `card_id_masked` | string | no | `****8820` |
| `card_type` | string | no | `credit` |
| `card_product` | string | yes | `Meridian Platinum Card` |
| `previous_limit` | decimal | yes | `3000.00` |
| `new_limit` | decimal | yes | `5000.00` |
| `freeze_reason` | string | yes | `misplaced` |
| `wallet_type` | string | yes | `google` |
| `travel_country` | string | yes | `ES` |
| `travel_start_date` | datetime | yes | `2026-08-20T00:00:00Z` |
| `travel_end_date` | datetime | yes | `2026-09-03T00:00:00Z` |

**Use case it unlocks.** `travel_notice_set` is the cleanest trigger on the whole
site: a known destination and a known date range, so travel insurance, FX and
lounge access all become relevant and timely rather than guessed.
`limit_change_requested` declined is a moment to explain rather than ignore.

---

### 3.8 `banking_wealth_events`

Private banking. Small volume, high value, and the tier a BFSI prospect asks
about.

`event_type`: `portfolio_viewed`, `holding_viewed`, `rebalance_requested`,
`contribution_made`, `withdrawal_requested`, `adviser_contacted`,
`risk_profile_completed`, `report_downloaded`

| Column | Type | Null | Example |
|---|---|---|---|
| `portfolio_id` | string | no | `PF-3391` |
| `portfolio_value_band` | string | yes | `250k_500k` |
| `asset_class` | string | yes | `equities` |
| `holding_name` | string | yes | `Global Sustainable Fund` |
| `risk_profile` | string | yes | `balanced` |
| `contribution_amount` | decimal | yes | `10000.00` |
| `contribution_frequency` | string | yes | `annual` |
| `withdrawal_amount` | decimal | yes | `25000.00` |
| `adviser_name` | string | yes | `R. Mehta` |
| `performance_band` | string | yes | `up_5_10` |

Value is banded rather than exact throughout. A demo that displays a named
customer's precise portfolio value reads badly in a room, and banded is what a
real deployment would use anyway.

---

### 3.9 `banking_engagement_events`

Offers, consent and message interaction. Separate from `banking_onsite_events`,
which keeps doing the 25 scenario widgets.

`event_type`: `offer_viewed`, `offer_accepted`, `offer_dismissed`,
`preference_updated`, `consent_granted`, `consent_withdrawn`,
`push_permission_granted`, `push_permission_denied`, `inapp_shown`,
`inapp_clicked`

| Column | Type | Null | Example |
|---|---|---|---|
| `offer_id` | string | yes | `OFR-TRAVEL-01` |
| `offer_category` | string | yes | `insurance` |
| `placement` | string | yes | `dashboard_offer_rail` |
| `consent_email` | boolean | yes | `true` |
| `consent_sms` | boolean | yes | `false` |
| `consent_push` | boolean | yes | `true` |
| `consent_profiling` | boolean | yes | `true` |
| `campaign_slug` | string | yes | `banking_image-popup` |

Consent is modelled explicitly because a UK bank cannot demo personalisation
without being asked about it. Being able to show a preference change landing as
an event, and a segment respecting it, answers the question before it is asked.

---

## 4. Summary for the panel

Nine tables to create, plus `banking_onsite_events` which already exists.

| Table | Events | Primary demo use |
|---|---|---|
| `banking_product_events` | 7 | Rate-drop alerts, shortlist nurture |
| `banking_tool_events` | 9 | Calculator intent, affordability gap |
| `banking_application_events` | 11 | Step-level abandonment, cross-device |
| `banking_appointment_events` | 5 | Reminders, no-show recovery |
| `banking_account_events` | 15 | Overdraft, dormancy, savings goals |
| `banking_transaction_events` | 10 | Spend triggers, foreign spend, churn |
| `banking_card_events` | 11 | Travel notice, limit requests |
| `banking_wealth_events` | 8 | Private banking journeys |
| `banking_engagement_events` | 10 | Offers, consent, message response |

---

## 5. Platform answers, confirmed by Salil 2026-07-31

These were open questions. They are now settled, and the answers shaped the
design above. Recorded here so nobody has to ask again.

| Question | Answer | Consequence |
|---|---|---|
| Are `string`, `integer`, `decimal`, `boolean`, `datetime` the types the panel offers? | Yes, and those are the right names. | The column specs above are usable as written. |
| Is there a required-column rule for custom tables? Does `is_used` apply, as it does on `wishlist_events`? | No, nothing is mandatory. | `is_used` is **not** declared on any of the nine. `event_type` still is, on every table, because it is what makes them queryable. |
| If the site sends an undeclared column, is the column dropped or the whole row? | The **column** is dropped. The row still lands. | The schema can be extended safely. Tables can be created incrementally and columns added later without losing rows in the meantime, so this document does not have to be perfect before code is written. |
| Column count and row size limits? | Unlimited. | No need to economise on columns. Where a banded and an exact value are both useful, both are declared. |
| Can the Android app share the web app guid `c8d2da44-b982-1925-9ad8-e7caddf0894a`? | **No.** The Android app needs its own app key, sitting in the same BFSI account (28) as the eComm and FinTech demos. | The app guid distinguishes the two sources at the platform level. `event_source` stays anyway, because it is what a segment filters on without having to know a guid. |

The one discipline still worth respecting: **an HTTP 200 from `/api/web/event`
means accepted.** A row in Data Space is the only proof an event landed, and
this site has not had that proof yet.
