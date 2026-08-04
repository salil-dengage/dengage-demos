# Portal scenarios: ten On-Site messages for online banking

> Panel build sheet. Every scenario here is triggered by a **dataLayer event**
> the portal already pushes, and every one is justified by a row that already
> lands in an existing table. Nothing here needs a new table, a new column, or
> a new event.

Read `docs/TABLE-DESIGN.md` for the tables and
`docs/DECISIONS-AND-GOTCHAS.md` for the HTML rules. This file is the mapping
between them.

---

## Why dataLayer triggers rather than page targeting

Page targeting can only say *which page*. These ten need to say *why*, and the
why is behaviour: an overdraft habit, a foreign card payment, a cancelled
mortgage mandate. The portal pushes a named dataLayer event at the exact moment
it detects or performs each one, so the campaign fires on the behaviour rather
than on the URL.

In the panel each is **triggerBy = DATA_LAYER_EVENT** with **eventName** set to
the trigger below. That is the same mechanism the eight Default Scenarios use,
so there is nothing new to learn.

**One display setting to get right.** Settings > Integrations > Applications >
On-Site Messaging has *"After showing an Onsite Message do not show for X
seconds"*, a global cooldown between popups. The docs recommend at least 10.
Three of these ten are popups and a demo can trigger two within seconds, so if
the second one "does not work", check this before suspecting the campaign.
There is also separate per-device display history, which is what the
launcher's **Reset displays** button clears.

---

## The ten

| # | Scenario | Trigger (dataLayer event) | Format | Where | Fires when | Backed by |
|---|---|---|---|---|---|---|
| 1 | Low balance | `banking_portal_low_balance` | Banner, top | any portal page | current account under £500 | `banking_account_events` `low_balance_reached` |
| 2 | Overdraft habit | `banking_portal_overdraft_habit` | Inline | `#dn_inline_target_dashboard_offer` | overdraft used repeatedly | `banking_account_events` `overdraft_entered` |
| 3 | Salary landed | `banking_portal_salary_credited` | Inline | `#dn_inline_target_dashboard_offer` | salary credit detected | `banking_account_events` `salary_credited` |
| 4 | Subscription creep | `banking_portal_subscriptions` | Inline | `#dn_inline_target_account_activity` | recurring subscription spend | `banking_transaction_events` `is_recurring` |
| 5 | Foreign spend | `banking_portal_foreign_spend` | Popup | dashboard | a payment in another currency | `banking_transaction_events` `foreign_transaction` |
| 6 | Travel notice set | `banking_portal_travel_notice` | Inline | `#dn_inline_target_cards_travel` | customer sets a travel notice | `banking_card_events` `travel_notice_set` |
| 7 | Card frozen | `banking_portal_card_frozen` | Popup | cards | customer freezes a card | `banking_card_events` `card_frozen` |
| 8 | Mortgage mandate cancelled | `banking_portal_mortgage_dd_cancelled` | Popup | payments | mortgage direct debit cancelled | `banking_transaction_events` `direct_debit_cancelled` |
| 9 | Savings goal met | `banking_portal_goal_reached` | Inline | `#dn_inline_target_dashboard_offer` | a goal reaches 100% | `banking_account_events` `savings_goal_reached` |
| 10 | Wealth review due | `banking_portal_wealth_review` | Inline | `#dn_inline_target_wealth_review` | portfolio viewed, review overdue | `banking_wealth_events` `portfolio_viewed` |

Six inline, three popups, one banner. That split is deliberate: **inline is the
default inside online banking.** A customer who signed in to check a balance
did not ask to be interrupted, and a bank that interrupts them reads as a
retailer. The three popups are reserved for moments where interrupting is the
correct behaviour: money left the country, a card was frozen, a mortgage
mandate was cancelled. The banner is a service warning, not marketing.

---

## The four inline target divs

The Inline Target Selector scans every node's **class and id** for a search
word and prefers id queries, so searching `dn_inline_target` in the panel lists
all of these. Two already existed, two are added with these scenarios.

| Selector | Page | Sits |
|---|---|---|
| `#dn_inline_target_dashboard_offer` | dashboard | as a fourth card in the offer rail, beside three behaviour-driven ones |
| `#dn_inline_target_account_activity` | account | directly above the transaction list |
| `#dn_inline_target_cards_travel` | cards | under the travel notice form |
| `#dn_inline_target_wealth_review` | wealth | under the portfolio summary |

All four are empty and zero-height until a campaign fills them, which
`banking/tools/portaltest.js` asserts.

They are **portal-only and deliberately not mirrored** to the other demo sites,
which have no signed-in area to mirror them into. The five site-wide slots that
must stay in step across all five sites are on home and product, and
`slottest.js` covers those.

---

## Content files

Popups and banners follow the popup contract: `target="_top"` on every anchor,
exactly one `Dn.sendClick()`, `Dn.close()` on a close control and never
`sendClick`, banners draw their own close control and popups do not.

Inline files are the **opposite** on three points, because inline content is
not sandboxed: every selector namespaced under its own root id, **no**
`Dn.sendClick()` because the SDK counts injected anchors itself, and no
`target="_top"` because there is no frame.

```
banking/panel-content/portal/
  low-balance.html                  banner
  foreign-spend.html                popup
  card-frozen.html                  popup
  mortgage-dd-cancelled.html        popup
  inline/
    overdraft-habit.html
    salary-landed.html
    subscriptions.html
    travel-notice.html
    goal-reached.html
    wealth-review.html
```

`banking/tools/creativetest.js` enforces the right contract per format, and
knows which is which. It lives here rather than in `tools/verify/` because
`paneltest.js` scans only a site's top-level `panel-content` directory and
applies the popup contract to everything it finds, which would fail every
inline file for not calling `sendClick`.

---

## What to build in the panel

For each row in the table above:

1. New On-Site campaign, layout per the Format column.
2. Trigger: **DATA_LAYER_EVENT**, eventName exactly as in the trigger column.
3. Paste the matching file whole.
4. Inline scenarios: set the **Inline Target Selector** to the id in the table.
5. Popups: Layout > Close Button > **"Add close button to outside"**, and
   design settings **padding 0, transparent background**, or the container's
   own white shows as a frame around the card.
6. Banners: nothing extra. The file draws its own close control because Banner
   layout is not offered the close-button setting.

If a campaign does not exist for a trigger, that scenario is **silently dark**.
Nothing errors, it simply never shows. That is the single most common cause of
"the widget is broken" during a demo. Check the campaign exists before reading
any code.
