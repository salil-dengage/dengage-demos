# Meridian Bank demo: what to show, and why it lands

Internal guide for the sales team. No technical knowledge needed.

**The site:** `salil-dengage.github.io/dengage-demos/banking/`
**The brand:** Meridian Bank, a fictional UK retail bank. Nothing here is a real
rate or a real product, and the site says so.

**Two halves, and the difference matters in the room:**

- **The public site.** Anyone can see it. This is the *acquisition* story: we do
  not know who this is yet, and we are trying to earn the enquiry.
- **The portal.** The signed-in online banking area. This is the *retention and
  relationship* story: we know exactly who this is, what they hold, and what
  just happened to their money.

Most banks buy the second half. Lead with the first, spend your time on the
second.

---

## Before you start, every time

1. Open the site and **sign in** (register from the home page with any e-mail).
   The portal shows "Please sign in" until you do, and none of the portal
   scenarios exist until then. This is the single most common demo failure.
2. Open the blue **Events** button, bottom left. It is your control panel: it
   fires each scenario on demand and shows what data is being sent.
3. Hit **Reset displays** in that panel between runs, so a message you already
   saw shows again.

Rule of thumb: **one message at a time.** The site is capped so a second message
will not appear within ten seconds of the first. That is deliberate, and it is
worth saying out loud, because "how do I stop bombarding my customers" is a
question every bank asks.

### If you are demoing the Android app, one more rule

4. **Demonstrate App Inbox with a real campaign send with save to inbox
   ticked.** A Test Send does not populate the inbox; a real campaign send
   does. The `[TEST]` prefix on the title is how you spot a test send.

---

## Part 1: the public site, winning the enquiry

Eight message formats, all firing from the Events panel. These are about
**range**: same platform, eight different ways to interrupt or not interrupt.

| # | Use case | Why it matters to a bank | How we solve it | What to show | How to show it |
|---|---|---|---|---|---|
| 1 | Ask a visitor what brought them in | Banks have no idea why someone landed on the mortgage page. Analytics show the click, not the intent. | One question, answered in a tap, stored against that visitor. | **Survey** popup: "What brought you to Meridian today?" | Events panel > Survey |
| 2 | Measure how the site is doing | Every bank tracks NPS by e-mail weeks later. This asks in the moment. | A 0 to 10 score captured on the page. | **NPS** popup | Events panel > NPS Popup |
| 3 | Capture interest when there is no product yet | A visitor watching rates is a lead the bank normally loses. | An e-mail capture tied to a specific rate. | **Rate alert** popup | Events panel > Subscription Popup |
| 4 | Promote without interrupting | Compliance hates popups on product pages. | A slim bar that sits at the edge of the page. | **Sticky bar** | Events panel > Sticky Bar |
| 5 | Put a product in front of the right visitor | Generic homepage banners convert badly. | A visual card for one product, targeted. | **Image popup**, a mortgage offer | Events panel > Image Popup |
| 6 | Same, in the least intrusive form | Some pages tolerate nothing at all. | A quiet image bar. | **Image bar**, affordability calculator | Events panel > Image Bar |
| 7 | Drive an appointment, not a click | Advisers are the bank's conversion engine. | A message whose only job is booking a human. | **Horizontal popup**, book an adviser | Events panel > Horizontal Popup |
| 8 | Sell a card visually | Card design sells cards. | Image-led popup with one clear action. | **CTA image popup** | Events panel > CTA Image Popup |

**The line that lands:** "Eight formats, one platform, and your marketing team
builds and changes every one of these without a developer or a release."

### The lead form

| Use case | Why it matters | How we solve it | What to show | How to show it |
|---|---|---|---|---|
| Turn an anonymous visitor into a named lead | This is the whole point of the acquisition site. Everything else is warm-up. | A form the bank designs itself, opening on a click, feeding straight into the customer record. | **Open an account** form: name, e-mail, mobile, what they want | Click **Open an account** in the site header |

Say clearly: the marketing team builds this form in Dengage. No developer, no
release, no ticket. That is usually the moment a marketing lead sits up.

---

## Part 2: the portal, keeping and growing the customer

This is where a banking prospect stops comparing us to a popup tool.

Every message below is triggered by **something that happened to that
customer's money**, not by which page they opened. Make that distinction
explicitly, more than once. It is the difference between marketing and banking.

### Things the bank notices

| # | Use case | Why it matters | How we solve it | What to show | How to show it |
|---|---|---|---|---|---|
| 9 | Balance running low | The bank's cheapest retention moment. Say nothing and they go overdrawn and blame you. | A service warning, not an offer. | **Low balance** bar | Sign in, open **Overview** |
| 10 | Overdraft used month after month | An expensive habit the customer has not noticed. The honest move is also the profitable one. | Offer a cheaper loan, with the actual saving in pounds. | **"You have used your overdraft three months running"** panel | Sign in, open **Overview** |
| 11 | Salary just landed | The one day a month the customer has money to move. | Suggest moving some to savings, that day. | **Salary landed** panel | Sign in, open **Overview** |
| 12 | Savings goal reached | A genuinely good moment, and banks almost never mark it. | Congratulate, then suggest the next goal. | **Goal reached** panel | Sign in, open **Overview** |
| 13 | Payment abroad appears | Travel is a buying signal for cards, insurance and FX. | Explain their fees and offer cover, before the trip goes wrong. | **"Travelling? Two things worth knowing"** popup | Sign in, open **Overview** |
| 14 | Subscription creep | The customer is paying for things they forgot. Showing them buys trust. | Surface the recurring spend and offer to manage it. | **Subscriptions** panel | Sign in, open **Accounts** |
| 15 | Investment review overdue | High-value customers drift away quietly. | Prompt the review while they are looking at the portfolio. | **"Your review with R. Mehta is due"** panel | Sign in, open **Wealth** |

### Things the customer does

| # | Use case | Why it matters | How we solve it | What to show | How to show it |
|---|---|---|---|---|---|
| 16 | Customer freezes a card | Usually fear: lost, stolen, or a payment they do not recognise. Silence here is a complaint. | Reassure immediately and offer the next step. | **Card frozen** popup | Sign in > **Cards** > Freeze card |
| 17 | Customer sets a travel notice | They have told you they are leaving the country. Almost no bank acts on it. | Confirm it, and offer travel cover. | **Travel notice** panel | Sign in > **Cards** > Set travel notice |
| 18 | Mortgage direct debit cancelled | The strongest churn signal in retail banking. Most banks find out at month end. | Intervene the same second, with a human, not an offer. | **Mortgage mandate** popup | Sign in > **Payments** > Cancel the mortgage direct debit |

**The line that lands, on 18:** "Your retention team currently finds this out in
a monthly report. Here it is a phone call the same afternoon."

### Two spare panels

There are also two general-purpose panels, a consolidation offer on the overview
and a spending insight on accounts, that run on page load rather than on
behaviour. Use them only if someone asks "what if the customer has done nothing
interesting yet". Otherwise skip them: they compete for the same space as the
behaviour-driven ones above, which are the better story.

---

## The three questions you will get

**"Is this just popups?"**
No. Six of the ten portal messages are *inline*: they appear inside the page as
part of the design, not laid over it. Point at one on the overview page. Inside
online banking, interrupting a customer who came to check a balance is the wrong
answer, and the platform lets you choose.

**"Who builds these?"**
Marketing, in the Dengage panel. Show that the message on screen is content
someone typed, not code someone shipped. Changing the offer is an edit, not a
release.

**"How do you decide who sees what?"**
Every message is tied to a real event on that customer's account, and those
events are stored. So the same signal that shows a message can also build a
segment, feed an e-mail, or trigger a push notification. Open the Events panel
and show the data landing.

---

## What to skip

- Do not open the Events panel and fire six things in a row. It looks like a toy.
- Do not demo the public site to a retention or CRM buyer. Go straight to the
  portal.
- Do not promise these exact rates or products. It is a fictional bank and the
  footer says so, which is deliberate: financial promotions are regulated.

---

## A ten minute run that works

1. Sign in. Land on **Overview**.
2. Let the **low balance** and **overdraft** messages appear. Explain that both
   came from the balance, not the page.
3. Open **Payments**, cancel the mortgage direct debit. Let the popup land. This
   is your strongest moment: spend time here.
4. Open **Cards**, freeze a card. Show the immediate reassurance.
5. Open **Wealth**, show the review prompt sitting inside the page rather than
   over it.
6. Open the **Events** panel and show the data behind everything they just saw.
7. Only if there is time, go to the public site and show two or three formats
   plus the **Open an account** form.
