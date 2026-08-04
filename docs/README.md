# docs/: which file answers which question

Six documents. This page exists so you read the right one instead of all of
them. Nothing here is optional reading once you are actually changing the thing
it covers.

**If you read only one:** [`DECISIONS-AND-GOTCHAS.md`](DECISIONS-AND-GOTCHAS.md).
Most of what looks oddly indirect in this repository is deliberate, and several
of those patterns have been "fixed" back into bugs by someone who had not
read it.

---

## By question

| Your question | Read |
|---|---|
| "Why is this code written in such a roundabout way?" | [`DECISIONS-AND-GOTCHAS.md`](DECISIONS-AND-GOTCHAS.md) |
| "What event should I fire, with what payload, into what table?" | [`DENGAGE-INTEGRATION.md`](DENGAGE-INTEGRATION.md) |
| "What has to exist in the Dengage panel for this to work?" | [`PANEL-SETUP.md`](PANEL-SETUP.md) |
| "What is actually proven to work, and what only looks like it does?" | [`RELEASE-v1.0.md`](RELEASE-v1.0.md) |
| "How do I start a session on this repo without colliding with the others?" | [`SESSION-PROMPTS.md`](SESSION-PROMPTS.md) |
| "This just stopped working, what now?" | [`DECISIONS-AND-GOTCHAS.md`](DECISIONS-AND-GOTCHAS.md), then the discipline in [`../CLAUDE.md`](../CLAUDE.md) §6 |

---

## The files

### [`DECISIONS-AND-GOTCHAS.md`](DECISIONS-AND-GOTCHAS.md)
The most important file here. Product behaviour that had to be learned by
building against it, the decisions taken because of it, open items, and a
section per working session on what that session cost to learn. Includes **"HTML that works
in the panel, and HTML that does not"**, which is required reading before writing
any panel content, and the Russian-copy failure modes.

Read it **before** changing something that looks wrong. Add to it whenever you
learn something that would have saved you an hour.

### [`DENGAGE-INTEGRATION.md`](DENGAGE-INTEGRATION.md)
The contract between the sites and the platform. What loads on the page, every
event and its payload, the standard and custom tables, the product feed shape,
how On-Site campaigns render (§5 is long and worth it), recommendations, web
push, and what adding another industry site involves.

Read it before changing any event, payload or table, and before adding a site.

### [`PANEL-SETUP.md`](PANEL-SETUP.md)
The panel side of the same contract: web application settings, the Big Data
table definitions, the eight On-Site campaigns and their exact trigger names,
recommendation containers, web push configuration, how to re-run a scenario
during a demo, and A/B testing.

Read it whenever a change has a counterpart someone must click in the panel.

### [`RELEASE-v1.0.md`](RELEASE-v1.0.md)
What the v1.0 tag covers and, more usefully, what it does not. The three
CantuPneus sites were verified live with the real SDK and the stored rows read
back in Data Space; NovaPay and Meridian were deliberately excluded. Lists the
marker contact keys used, and the things that look like bugs and are not.

Read it before telling anyone something is verified.

### [`SESSION-PROMPTS.md`](SESSION-PROMPTS.md)
The session-starter prompts, verbatim and ready to paste: eComm, Finance
(NovaPay and Meridian together), and the two narrower single-site lanes. Also
states who owns what and who may change the five shared modules.

---

## Where the rest lives

| Topic | File |
|---|---|
| The rules, auto-loaded into every session | [`../CLAUDE.md`](../CLAUDE.md) |
| Repository layout, running a site, the 25 scenarios | [`../README.md`](../README.md) |
| Writing panel content, one folder per campaign | [`../cantu-pneus/panel-content/README.md`](../cantu-pneus/panel-content/README.md) |
| What each verification suite checks | [`../tools/verify/README.md`](../tools/verify/README.md) |
| What is specific to one site | `<site>/README.md` |
| Building a demo mobile app, brand-neutral, every trap the banking build hit | [`MOBILE-APP-PLAYBOOK.md`](MOBILE-APP-PLAYBOOK.md) |
| Banking end to end: status, outstanding work, the Android app | [`../banking/docs/PROJECT-LOG.md`](../banking/docs/PROJECT-LOG.md) |
| Every Dengage surface the Android app touches, and its traps | [`../banking/android-app/MOBILE-SURFACES.md`](../banking/android-app/MOBILE-SURFACES.md) |
