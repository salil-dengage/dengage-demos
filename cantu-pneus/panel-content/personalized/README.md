# personalized

Two On-Site popups that render differently for every signed-in contact. Sign up
as Salil and you get Salil's popup; sign up as Stacy and you get Stacy's. Same
stored content, different output, because the platform evaluates it per contact
before it reaches the browser.

| File | Shape | What it shows off |
|---|---|---|
| `account-panel.html` | Account panel of facts | Ten attributes in one card: name, company, tier and discount, terms, account manager, last order, and the last SKU carried into the CTA link |
| `reorder-nudge.html` | One timed nudge | Nine attributes built around a single number, plus the contact's own promo code and delivery slot |

## The tokens

One form only, direct output of a contact attribute:

```
{%=$Contact.first_name%}
```

**No `{% %}` logic blocks, no fallbacks, no locals.** Two reasons:

- The panel does **not** evaluate tokens in its Preview, so a multi-line logic
  block renders as a wall of visible text in the editor. A first draft did
  exactly that.
- Both demo contacts already carry every attribute, so branching on absence buys
  nothing and only adds ways to fail.

Preview showing `{%=$Contact.first_name%}` as literal text is expected. The
tokens resolve when the campaign is live and a contact is identified.

Reference: [Advanced Personalization](https://dev.dengage.com/reference/advanced-personalization).
`$Contact` exposes columns of `master_contact`. The engine also supports logic
blocks, `$Current`, `$from()` queries and `FormatDate()`; none of that is used
here, deliberately.

## Attributes used

All on `master_contact`, and all present on both demo contacts.

**`account-panel.html`** uses ten:

| Attribute | Example |
|---|---|
| `first_name` | `Salil` |
| `company_name` | `Transportadora Andrade` |
| `pricing_tier` | `Gold` |
| `discount_pct` | `18` |
| `credit_terms_days` | `30` |
| `account_manager_name` | `Marina Alves` |
| `account_manager_phone` | `+55 47 3348 1200` |
| `last_order_name` | `Marshal KLD01 295/80 R22.5` |
| `last_order_sku` | `CNT-CRG-29580-KLD01` |
| `last_order_date` | `2026-06-18` |

**`reorder-nudge.html`** uses nine:

| Attribute | Example |
|---|---|
| `first_name` | `Stacy` |
| `fleet_size` | `12` |
| `main_line` | `Passenger` |
| `usual_size` | `195/65 R15` |
| `reorder_due_days` | `5` |
| `promo_code` | `LITORAL09` |
| `promo_discount_pct` | `9` |
| `next_delivery_date` | `2026-08-05` |
| `preferred_branch` | `Curitiba PR` |

`last_order_sku` also goes into the CTA href, so Reorder now lands on that
contact's own product page.

The two date attributes are output raw. If the platform returns a full timestamp
and it reads long, wrap just that one token:
`{%=FormatDate($Contact.last_order_date,'yyyy-MM-dd')%}`.

## Panel setup

| Field | Value |
|---|---|
| Trigger | **Data Layer Event**, event name `sign_up` |
| Where to display | `/.*/` |
| Layout | Popup, padding 0, transparent background |
| Width | 560px for `account-panel`, 520px for `reorder-nudge` |

**No site change is needed.** The sign-up form resolves the contact key through
`js/identity.js` and calls `setContactKey` with it, then pushes `sign_up` onto the
dataLayer, so the campaign fires on the real event against the right contact.

To demo as a specific contact without signing up, open the site once with
`?ck=salil-demo`. That pins the contact key for the browser.

Two campaigns, one per sample, or one campaign whose content you swap between
runs. Two is better for a live demo: no editing mid-call.

## Confirm substitution on the live campaign

Substitution happens server-side, when the content is fetched for an
identified contact. One quick check confirms the campaign is wired correctly
before a call:

1. Add this line anywhere in the popup body and publish:
   `<p>{%= $Contact.contact_key %}</p>`
   `contact_key` always exists, so no field creation is needed.
2. Sign up on the site with a known email.
3. The popup shows that email address: the tokens are resolving and everything
   here works. Remove the test line afterwards.

Customization tags are refused on real-time On-Site Targeting campaigns; the
restriction is the trigger type, not the tags. These templates therefore
target a standard Data Layer Event trigger, as set out in Panel setup above.
Do not "fix" the templates.

## Demo script

1. **Reset displays** in the launcher, so the five-minute popup cooldown is out
   of the way.
2. Sign up as the first contact and show the panel: their name, their company,
   their tier and discount, their terms, their account manager, their last order.
3. Reset displays, sign up as the second contact. Every one of those ten values
   changes, and the Reorder now button points at a different product page,
   because `last_order_sku` is in the href.

Point out that steps 2 and 3 are **one stored piece of content**, not two
campaigns. That is the part prospects do not expect.

## Verify before pasting

```bash
node tools/verify/persotest.js
```

It rejects any `{% %}` logic block anywhere in the file including comments,
rejects a token naming an attribute this README does not list, substitutes both
demo contacts' values and checks no token survives and nothing reads
`undefined`, then renders each result in a browser and checks height, images and
overflow. It also enforces the same click contract as the rest of the panel
content: exactly one `Dn.sendClick`, and `Dn.close()` on the close control.
