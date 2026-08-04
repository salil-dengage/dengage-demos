# NovaPay account portal: ten scenarios Dengage can trigger

Ten On-Site scenarios aimed at the **logged-in portal** (`app.html`), each fired
by a `dataLayer` event the app pushes when the customer's situation actually
matches.

This is the point of them, and it is worth saying to a prospect out loud: the
eight Default Scenarios are a **presenter firing a widget on demand**. These ten
fire **because the data says so**. The condition targeted in the panel is the
same condition that produced the row in Data Space, so the demo shows the
platform reacting to behaviour rather than to a button.

Every trigger is derived from state the demo genuinely holds, and every one maps
to a table that genuinely receives rows. Nothing here is staged.

---

## The portal is five pages, and that is what makes these demoable

Until 2 August 2026 the portal was one page with five views, so all ten signals
fired on a single load. Every inline campaign appeared at once and the only way
to show one at a time was to reset between each.

Each view is now a real page that pushes only its own signals:

| Page | Scenarios that fire there |
|---|---|
| `app.html` | 1 KYC incomplete, 8 credit score up |
| `money.html` | 2 low balance, 3 salary landed, 6 travel spender, 9 subscription detected, 10 FX unused |
| `cards.html` | 4 card dormant |
| `grow.html` | 5 goal in reach, 7 idle cash |
| `products.html` | none yet |

**This needed no panel change.** The campaigns trigger on the event name, so an
event that only fires on `cards.html` can only ever show there. The page split
does the targeting; no URL rule is involved.

Two things the split does not fix. The SDK's five-minute popup cooldown is per
browser rather than per page, so scenarios 1, 4 and 7 still queue behind each
other and still need **Reset displays** between them. And a campaign whose
condition the demo does not start in stays quiet until you create the
situation, which is the point of them.

`tools/verify/portaltest.js` asserts that no page fires another page's signals.

---

## How to build one

In the panel: **On-Site Targeting campaign**, `triggerBy = DATA_LAYER_EVENT`,
`eventName` set to the event below. Content per the layout column. Design
settings need **padding 0 and a transparent background** in every case, or the
container's own white box frames the card.

The signals are pushed once per page load, on the portal only. Re-firing on
every render would make `maxShowCount` meaningless, and the SDK's global
five-minute popup cooldown would swallow the rest anyway.

---

## The ten

| # | dataLayer event | Fires when | Layout | Backed by |
|---|---|---|---|---|
| 1 | `fintech_kyc_incomplete` | `kyc_status` is not `approved` | Popup | `fintech_onboarding_events` |
| 2 | `fintech_low_balance` | balance under 100 | Banner, top | `fintech_account_events` |
| 3 | `fintech_salary_landed` | salary transaction in the last 7 days | Inline, `portal_below_balance` | `fintech_account_events` |
| 4 | `fintech_card_dormant` | a card delivered and never activated | Popup | `fintech_card_events` |
| 5 | `fintech_goal_in_reach` | a savings goal between 70% and 99% | Inline, `in_grid` | `fintech_savings_events` |
| 6 | `fintech_travel_spender` | one or more travel-category transactions | Inline, `portal_money_top` | `fintech_transaction_events` |
| 7 | `fintech_idle_cash` | no holdings and balance 500 or more | Popup | `fintech_investment_events` |
| 8 | `fintech_credit_score_up` | credit score rose since last month | Inline, `above_footer` | `fintech_credit_events` |
| 9 | `fintech_subscription_detected` | a recurring transaction in the feed | Inline, `portal_subscriptions` | `fintech_transaction_events` |
| 10 | `fintech_fx_unused` | holds a second currency but has never converted | Banner, bottom | `fintech_transaction_events` |

### What each one should say

1. **KYC incomplete.** "Two minutes to finish opening your account." The highest
   value trigger on the site: an account opened but not usable earns nothing.
2. **Low balance.** "Payday is Friday. An overdraft costs nothing to arrange."
   Fires *before* the problem, which is the whole argument for real-time.
3. **Salary landed.** "Your salary arrived. Move 200 into Japan 2027?" The one
   moment in the month the customer has money to move.
4. **Card dormant.** "Your card arrived on Tuesday. Tap to activate." Plastic
   already paid for and earning nothing.
5. **Goal in reach.** "Japan 2027 is 78% funded. 880 to go." Encouragement
   works here and nowhere else on the journey.
6. **Travel spender.** "You have been spending abroad. The Travel plan applies
   no FX markup." Stated as a RATE, not a figure. A specific "you would have
   saved $4.20" needs the actual markup on the actual transaction, and inline
   content cannot compute it without a script. An invented number on a
   financial promotion is not acceptable.
7. **Idle cash.** "2,480 sitting still. A balanced portfolio starts at 1."
8. **Credit score up.** "Your score went up 12 points." One of the few
   notifications a customer is pleased to receive, which is worth showing a
   prospect who is worried about notification fatigue.
9. **Subscription detected.** "Spotify, 9.99 a month, every month since March."
   Detected from the feed rather than declared by the customer.
10. **FX unused.** "You hold 310 EUR. Convert at the real rate, no markup."

---

## Payload on each event

Every push carries the fields the campaign needs for **content
personalisation** and for **filtering**, so a campaign can target
`balance_band = 0-99` rather than just "someone with a low balance".

```js
{ event: 'fintech_salary_landed', amount_band: '2000+', balance_band: '2000-9999' }
{ event: 'fintech_travel_spender', travel_txn_count: 1, product_id: 'NPY-CRD-TRAVEL' }
{ event: 'fintech_goal_in_reach',  pot_name: 'Japan 2027', progress_pct: 78 }
{ event: 'fintech_credit_score_up', score_change: 12, credit_score_band: 'good' }
```

Full list in the `portalSignals()` function in `js/novapayApp.js`.

---

## Making each one fire during a demo

Seven fire on the portal's default state. Three depend on the customer's
situation, which is correct: they exist to prove the platform reacts to
behaviour. Each is two clicks away.

| Scenario | Default state | How to make it fire |
|---|---|---|
| 1, 3, 6, 7, 8, 9, 10 | fire on load | open the portal |
| 2 `low_balance` | balance is 2,480 | Send money, 2,400. Reload |
| 4 `card_dormant` | the seed card is activated | Cards, Order a card. Reload |
| 5 `goal_in_reach` | goals at 38% and 15% | Grow, Add money to a goal until 70%. Reload |

The reload is needed because the signals are pushed once per load, deliberately.
Use **Reset displays** in the scenario launcher between attempts: the SDK's
five-minute popup cooldown otherwise holds back the second popup. The cooldown
is documented in `docs/DECISIONS-AND-GOTCHAS.md`.

---

## The creatives

Five of the ten are inline, and they are written:
`fintech/panel-content/inline/`

| File | Scenario | Slot |
|---|---|---|
| `salary-landed.html` | 3 | `portal_below_balance` |
| `goal-in-reach.html` | 5 | `in_grid` |
| `travel-spender.html` | 6 | `portal_money_top` |
| `credit-score-up.html` | 8 | `above_footer` |
| `subscription-detected.html` | 9 | `portal_subscriptions` |

`subscription-detected` moved to its **own slot**,
`dn_inline_target_portal_subscriptions`, on 2 August 2026. It previously shared
`portal_money_top` with `travel-spender`, and two campaigns aimed at one target
can only show one at a time, so each now has a slot of its own. **This
is the one creative you must repaste in the panel**, because its Inline Target
Selector changed.

`tools/verify/inlinetest.js` injects each one the way the SDK does, style into
`document.head` and HTML cloned into the slot, then compares the portal's own
computed styles before and after. It was verified by adding a rule that wins on
specificity and watching it go red.

The other five follow the **popup and banner** contract, not the inline one, so
they live in `fintech/panel-content/` proper:

| File | Scenario | Layout | Page |
|---|---|---|---|
| `kyc-incomplete.html` | 1 | Popup, 560 | `app.html` |
| `low-balance.html` | 2 | Banner, top, 830 | `money.html` |
| `card-dormant.html` | 4 | Popup, 560 | `cards.html` |
| `idle-cash.html` | 7 | Popup, 560 | `grow.html` |
| `fx-unused.html` | 10 | Banner, bottom, 830 | `money.html` |

### These five need repasting: the live campaigns carry relative links

Observed on the live site on 3 August 2026. The **Convert now** button on the
`fx-unused` banner and the CTA on the `idle-cash` popup send the visitor to
`https://pcdn.dengage.com/onsite-message/money.html`, which is an S3
`NoSuchKey` error page rather than NovaPay.

**This is not a defect in these files.** The five here all carry absolute
`https://salil-dengage.github.io/...` hrefs and pass `paneltest.js`, which
fails a relative one by name. The campaign in the panel is an **older copy**
that still has `href="money.html"`, and a relative href in a popup or banner
resolves against the iframe's own origin, `pcdn.dengage.com`, not against the
page the visitor is reading. `target="_top"` does not save it: the anchor
resolves before the target is applied.

Nothing in this repository can fix that, because the panel holds its own copy
of the content and the panel is what visitors see. **Repaste all five from
`fintech/panel-content/` into their campaigns.** The same check is worth
running over the CantuPneus and Meridian campaigns, since the drift is a
property of how content is deployed rather than of this site.

Two things about these that are easy to get backwards:

**The two banners draw their own close control; the three popups must not.**
Banner layout is not offered the panel's Layout > Close Button >
"Add close button to outside" setting, so a banner without one cannot be
dismissed, while a popup with one shows two. `paneltest.js` asserts both
directions, and both were checked by planting the violation.

**None of the five states a figure.** The payloads carry `balance_band`,
`days_since_order` and the rest, but popup and banner content cannot read them:
the message is a cross-origin iframe and the panel strips `<script>`. Any
amount, date or saving in this copy would be invented, and on a low-balance or
an investment message that is a financial promotion rather than demo text. They
state the product and the pricing, which is true for every customer.
`idle-cash.html` carries a capital-at-risk warning for the same reason.

## Where inline content lands

Since the split into five pages, each page carries only the anchors its own
scenarios need. `app.html` carries three: `below_header`, `portal_below_balance`
and `above_footer`. `portal_money_top` and `portal_subscriptions` live on
`money.html`, and `in_grid` on `grow.html`. The `below_header`, `in_grid` and
`above_footer` slots are the canonical ones shared with every page on every
site; the portal-specific ones exist because an inline campaign aimed at an
account holder wants to sit next to what it is talking about.

| Slot id | Page | Where it sits | Good for |
|---|---|---|---|
| `dn_inline_target_below_header` | every portal page | directly under the fixed header | a Story rail |
| `dn_inline_target_portal_below_balance` | `app.html`, `money.html` | under the balance card | the balance-driven scenario, 3 |
| `dn_inline_target_portal_money_top` | `money.html` | above the transaction list | travel spender, 6 |
| `dn_inline_target_portal_subscriptions` | `money.html` | below the transaction list | subscription detected, 9 |
| `dn_inline_target_in_grid` | `grow.html`, `products.html` | at the end of the view | goals and products, 5 |
| `dn_inline_target_above_footer` | every portal page | above the footer | low-urgency, 8 |

Every slot is empty and inert until a campaign fills it. **Inline content is
NOT sandboxed**: the SDK appends the `<style>` to `document.head` and clones the
HTML into the target, so every selector must sit under its own root id or it
restyles the whole portal. `docs/DENGAGE-INTEGRATION.md` 5.9.

Anchor clicks on the inline path are counted **without** `Dn.sendClick()`,
because the SDK attaches its own listener to every injected `a[href]`. That is
the opposite of the popup and banner path, where nothing is counted unless the
content asks.
