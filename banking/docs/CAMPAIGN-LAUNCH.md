# Meridian Bank: launch sheet for all 21 On-Site campaigns

> One row per campaign, in the order worth building them. Every value in the
> tables is exact: the trigger names are copied from the code that pushes them,
> the selectors from the divs that receive them. Nothing here needs typing from
> memory.
>
> `docs/PORTAL-SCENARIOS.md` explains *why* each portal scenario exists.
> This file is *how to launch them*.

---

## 0. Do these three things once, before any campaign

**a. Check the application.** Every campaign has a **Web Site** dropdown. Pick
the application whose app guid is `c8d2da44-b982-1925-9ad8-e7caddf0894a`, which
is the one the banking pages load. All five demo sites share the origin
`https://salil-dengage.github.io`, so the label alone does not tell you which is
which. Getting this wrong produces a campaign that is live, correct, and
invisible.

**b. Set the global cooldown.** Settings > Integrations > Applications >
On-Site Messaging > *"After showing an Onsite Message do not show for X
seconds"*. At its default, the cooldown holds back the next scenario you
trigger for longer than a demo wants, so the second widget never appears. Set
it to **10**.

**c. Decide the delivery settings once and reuse them.** These are demo
campaigns shown repeatedly to the same device, which is the exact case the
defaults suppress. On step 4 of every campaign below:

| Setting | Demo value | Why |
|---|---|---|
| Maximum show count | 100 | plenty for a call, and the counter is per device |
| Show every X minutes | 1 | 5 blocks the second reload |
| Do not show after engage | **off** | otherwise clicking the CTA once kills it for good |

`-1` in both fields is also valid and means limitless. `0` is fine too and was
verified rendering live, so there is no need to go back and change a campaign
that already has it.

The setting that actually bites is **"do not show after engage"**. Leave it on
and one click on the CTA retires the campaign for that device permanently,
which during a demo looks exactly like a broken campaign.

A hard reload does **not** clear display history. Use the launcher's
**Reset displays** button between runs. It clears
only the display counters and leaves the device id, contact key and push
subscription intact.

**d. The portal is gated, and that gate is upstream of everything.** The six
portal pages render nothing until `js/portal.js` finds a user in
`localStorage.meridian_user`. Signed out, `gate()` replaces the page with "Please
sign in" and returns, so no portal code runs: **the inline target divs are never
created and no `banking_portal_*` event is ever pushed.** There is nothing for a
campaign to match, however perfectly it is configured.

This makes **incognito the wrong tool for testing the portal**. A fresh window
is signed out by definition, so all ten portal campaigns look dead. Sign in
first (register from the home page as `salil@dengage.com`), then test. Incognito
is still the right tool for the eight Default Scenarios and the lead form, which
are public.

---

## 1. The eight Default Scenarios

All eight fire from the **Events** launcher panel, which is on all twelve pages,
public and portal. So they need no URL targeting: leave **Where to Show** as
all pages.

Trigger type is **DATA_LAYER_EVENT** for all eight. The event name is the
slug with the `banking_` prefix, and **the three misspellings are deliberate**:
`subscripton`, `stickey`, `horizonal`. They are part of the panel contract on
this account. Do not correct them, in the trigger or anywhere else.

| # | Content file | Layout | eventName | Click id it reports |
|---|---|---|---|---|
| 1 | `panel-content/survey.html` | Popup | `banking_survey` | `banking_survey__submit` |
| 2 | `panel-content/nps-popup.html` | Popup | `banking_nps-popup` | `banking_nps-popup__submit` |
| 3 | `panel-content/subscripton-popup.html` | Popup | `banking_subscripton-popup` | `banking_subscripton-popup__subscribe` |
| 4 | `panel-content/stickey-bar.html` | **Banner** | `banking_stickey-bar` | `banking_stickey-bar__view-saver` |
| 5 | `panel-content/image-popup.html` | Popup | `banking_image-popup` | `banking_image-popup__view-mortgage` |
| 6 | `panel-content/image-bar.html` | **Banner** | `banking_image-bar` | `banking_image-bar__affordability` |
| 7 | `panel-content/horizonal-popup.html` | Popup | `banking_horizonal-popup` | `banking_horizonal-popup__book-adviser` |
| 8 | `panel-content/cta-image-popup.html` | Popup | `banking_cta-image-popup` | `banking_cta-image-popup__view-card` |

Six popups, two banners. The two banners are the only ones that draw their own
close control, because Banner layout is not offered the close-button setting.

**Three of these capture input**, using the engine's native form mechanism.
Nothing extra to configure, but it is worth knowing what lands where:

- `subscripton-popup.html` uses `subscription_form`, so a submit creates or
  updates a **real contact** via `Dn.postSubscription()`.
- `survey.html` and `nps-popup.html` use `question_form`, which stores an answer
  against the campaign, not the contact.

---

## 2. The ten portal scenarios

Trigger type **DATA_LAYER_EVENT** for all ten. Every event name below is pushed
by `banking/js/portal.js` at the moment the behaviour happens, so the campaign
fires on the behaviour, not on the URL.

**Where to Show** is listed because it costs nothing and stops a portal message
appearing on a public page if a trigger is ever reused.

| # | Content file | Layout | eventName | Where to Show (URL contains) | Inline Target Selector | Fires when |
|---|---|---|---|---|---|---|
| 1 | `portal/low-balance.html` | **Banner** | `banking_portal_low_balance` | `banking/dashboard.html` | n/a | current account under £500 |
| 2 | `portal/inline/overdraft-habit.html` | Inline | `banking_portal_overdraft_habit` | `banking/dashboard.html` | `#dn_inline_target_dashboard_offer` | repeated overdraft use |
| 3 | `portal/inline/salary-landed.html` | Inline | `banking_portal_salary_credited` | `banking/dashboard.html` | `#dn_inline_target_dashboard_offer` | salary credit detected |
| 4 | `portal/inline/subscriptions.html` | Inline | `banking_portal_subscriptions` | `banking/account.html` | `#dn_inline_target_account_activity` | recurring subscription spend |
| 5 | `portal/foreign-spend.html` | Popup | `banking_portal_foreign_spend` | `banking/dashboard.html` | n/a | a payment in another currency |
| 6 | `portal/inline/travel-notice.html` | Inline | `banking_portal_travel_notice` | `banking/cards.html` | `#dn_inline_target_cards_travel` | customer sets a travel notice |
| 7 | `portal/card-frozen.html` | Popup | `banking_portal_card_frozen` | `banking/cards.html` | n/a | customer freezes a card |
| 8 | `portal/mortgage-dd-cancelled.html` | Popup | `banking_portal_mortgage_dd_cancelled` | `banking/payments.html` | n/a | mortgage direct debit cancelled |
| 9 | `portal/inline/goal-reached.html` | Inline | `banking_portal_goal_reached` | `banking/dashboard.html` | `#dn_inline_target_dashboard_offer` | a savings goal reaches 100% |
| 10 | `portal/inline/wealth-review.html` | Inline | `banking_portal_wealth_review` | `banking/wealth.html` | `#dn_inline_target_wealth_review` | portfolio viewed, review overdue |

### What actually fires, and when, in the demo data

Five of these fire **on load of `dashboard.html`**, once per session, because the
demo customer's data meets each condition: the current account sits at £412.86
so low balance and overdraft habit fire, the Holiday goal is fully funded so
goal reached fires, and the transaction stream carries both a salary credit and
a foreign payment. That is five messages competing on one page load, which is
what the 10 second global cooldown in §0b is for. Demo them one at a time.

The other five need an action: freeze a card, submit the travel notice form,
cancel the mortgage direct debit, open `account.html`, open `wealth.html`.

Three of the dashboard five share one slot, `dn_inline_target_dashboard_offer`.
Whichever campaign the SDK resolves first wins the slot for that load. This is
fine for a demo, where you trigger the one you want to talk about, but do not
expect all three visible at once.

---

## 3. The lead form

| Content file | Layout | eventName | Where to Show | Click id |
|---|---|---|---|---|
| `portal/lead-form.html` | Popup | `banking_open_account` | all pages | `banking_open_account__submit` |

Pushed by `banking/js/openAccount.js` from the **Open an account** control in
the site header, which is on every page. Uses `subscription_form`, so a
submission creates a real contact rather than a campaign answer.

Two fields are proven to land: `email` (`data-dn-type="EMAIL"`) and the
permission checkbox (`data-dn-type="PERMISSION_CHECKBOX"`). The name, surname
and mobile fields are in the file and follow the documented pattern; check one
submission on a contact record in the panel before building a demo moment on
them.

---

## 4. The two spare inline creatives

These predate the portal set and target the same two slots. They are **static
placements**, not behaviour-driven, so they carry no matching dataLayer event.

| Content file | Layout | Trigger | Where to Show | Inline Target Selector |
|---|---|---|---|---|
| `panel-content/inline/dashboard-consolidation.html` | Inline | Page load | `banking/dashboard.html` | `#dn_inline_target_dashboard_offer` |
| `panel-content/inline/account-subscriptions.html` | Inline | Page load | `banking/account.html` | `#dn_inline_target_account_activity` |

**They collide with the portal scenarios by design**, sharing a slot with
numbers 2, 3, 9 and 4 above. Two sensible ways to use them:

- **As the fallback.** Launch them on page load so the slot is never empty for a
  customer whose behaviour triggers nothing. Then keep them paused during a demo
  of the behaviour-driven ones.
- **As the A/B control.** Run one against a behaviour-triggered variant in the
  same slot to show split testing on identical real estate.

Pick one posture per demo. Running all of them live at once means the slot's
content depends on resolution order, which is not a story worth telling.

---

## 5. Per-format checklist

Get these wrong and the campaign is live but wrong-looking. They are the same
three mistakes every time.

**Popup**
- Layout > Close Button > **"Add close button to outside"**. The files draw no
  close control of their own, on purpose. A second one inside the card reads as
  a duplicate.
- Design settings: **padding 0**, **background transparent**. Otherwise the
  container's own white renders as a frame around the card.

**Banner**
- Nothing extra. The file draws its own close control, because Banner layout is
  not offered the close-button setting. Do not add a second one.

**Inline**
- Set the **Inline Target Selector**. This field exists only on the Inline
  layout, which is the whole reason an inline creative pasted into a Popup
  campaign renders as a floating card and never reaches its div.
- **Keep the leading `#`.** The selector is a CSS selector: without the hash
  the id reads as an HTML tag name and matches nothing.
- Search `dn_inline_target` in the selector field and it lists every slot on the
  site. The selector scans class and id and prefers id queries, which is why all
  slots here are ids.
- No close button setting, and none in the file. Inline content is part of the
  page, not something laid over it.

---

## 6. How to tell a campaign is actually working

In order, cheapest first.

1. **The launcher caption.** Each Default Scenario button prints the exact event
   name it pushes. If the caption and the campaign's eventName differ by even
   the prefix, that mismatch is the cause.
2. **Nothing at all happens.** A trigger with no campaign is **silently dark**:
   no error, no console warning, it simply never shows. Check the campaign
   exists and is running before reading any code.
3. **Nothing on a portal page, and the page says "Please sign in".** You are
   signed out. No portal event fires and no inline slot exists. §0d. This is the
   single most common cause of "the whole portal set is dead", and incognito
   reproduces it every time.
4. **It worked once and then stopped.** Display history working as configured. §0c.
5. **It renders as a floating card instead of in the page.** The campaign is a
   Popup and the content is Inline. §5.
6. **Read the campaign's live settings rather than guessing.** The on-site
   campaign manifest the page loads carries the live trigger name, URL regex
   and inline selector for every campaign, which is faster and more certain
   than clicking through 21 campaign summaries.

   Watch for a **tab or space pasted into the URL rule**. The value is a regex,
   so `/\tbanking\/dashboard\.html/` requires a literal tab in the URL and can
   never match. It looks completely normal in the panel field.
7. **Clicks read 0 and an A/B test can never pick a winner.** Only for popups
   and banners, where the click has to be reported by the content. Each file
   calls `Dn.sendClick()` exactly once, with the id in the tables above. Inline
   content deliberately does not, because the SDK counts injected anchors
   itself.

---

## 7. Count

| Group | Count |
|---|---|
| Default Scenarios (§1) | 8 |
| Portal scenarios (§2) | 10 |
| Lead form (§3) | 1 |
| Spare inline (§4) | 2 |
| **Total** | **21** |
