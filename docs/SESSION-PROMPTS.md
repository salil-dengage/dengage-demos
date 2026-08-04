# Session starter prompts

Separate Claude Code sessions run against this repository so they do not
collide. Paste the matching prompt as the first message of a new session.

> **History was reset on 2 Aug 2026 (owner-authorized).** Every clone made
> before the reset must be re-based onto the new root before any further
> work: git fetch origin && git checkout main && git reset --hard
> origin/main. Never merge or push from a pre-reset clone.

Ownership is enforced in `CLAUDE.md` §1. The short version:

| Session | Owns | Read-only | Prompt |
|---|---|---|---|
| eComm (`ecomm`) | `cantu-pneus/**` and the five shared modules | `fintech/`, `banking/` | §1 |
| Finance (`finance`) | `fintech/` and `banking/`, websites and apps | everything else | §2 |
| FinTech (`fintech`) | `fintech/` | everything else | §3 |
| Banking (`banking`) | `banking/` | everything else | §4 |

**One session owns both finance demos, and it is the usual one to start.**
NovaPay and Meridian share an SDK, an app shape and a set of questions, so the
same fix usually belongs in both, and splitting one change across two pushes
lands half a fix on a live site. §3 and §4 are narrower lanes for work that is
genuinely one site's, not replacements for §2.

The five shared modules (`wishlist.js`, `wishlistUi.js`, `searchPanel.js`,
`identity.js`, `inlineSlotOffset.js`) are **byte-identical across all five
sites** and may only be changed by the eComm session.

Ownership is enforced by `tools/verify/ownership.js`, and every session lands
its work with `tools/verify/push.sh` rather than `git push`. See `CLAUDE.md`
1.

---

## 1. eComm session (CantuPneus, three languages)

```
You are working on the CantuPneus ecommerce demo in salil-dengage/dengage-demos.

Read CLAUDE.md first, then docs/DECISIONS-AND-GOTCHAS.md. Do not skip the
second one: most of what looks oddly indirect in this repo is deliberate, and
several such patterns have been "fixed" back into bugs.

The repo is public and customer-facing throughout: write everything in it as
product documentation, and hand internal engineering notes and diagnostics
directly to Salil instead.

SCOPE. You own the three CantuPneus sites and their panel content:
  cantu-pneus/        pt-BR, fires br_ scenario events
  cantu-pneus/en/     English, en_
  cantu-pneus/ru/     Russian, ru_
  cantu-pneus/panel-content/{pt,en,ru}/
Do not modify fintech/ or banking/. Those have their own sessions.

You are also the ONLY session allowed to change the five shared modules
(js/wishlist.js, js/wishlistUi.js, js/searchPanel.js, js/identity.js,
js/inlineSlotOffset.js). They are byte-identical across all five sites by
contract; change one, copy to all five, and searchwishtest.js and slottest.js
will verify it.

STATE. This demo was tagged v1.0 on 31 July 2026 and verified end to end. All
nine event tables were confirmed live against the published sites with the real
SDK, and the stored rows checked in Data Space under contact keys v10-br-demo,
v10-en-demo and v10-ru-demo. The offline suites pass at ~1200 assertions.
docs/RELEASE-v1.0.md is the record. The v1.0 git tag was created but never
pushed, because the environment's git proxy refuses tag pushes.

WHAT I WILL ASK YOU FOR. New panel content (HTML widgets), new creatives, new
event triggering, new scenarios, copy changes across the three languages, and
occasionally a new language. Before writing any panel HTML, read
cantu-pneus/panel-content/README.md and the "HTML that works in the panel"
section of docs/DECISIONS-AND-GOTCHAS.md. The rules that catch people out: the
panel strips <script>, links need target="_top", popups draw NO close button
(the panel supplies it) but banners keep theirs, and the -vh visually-hidden
class is NOT close plumbing, it hides the real inputs behind styled score
buttons.

Deliver panel content as complete HTML documents inline in chat, safe for me to
paste whole into the panel editor, as well as committing them.

LANGUAGE DISCIPLINE. Each site is written in ONE language, attributes included:
aria-label, placeholder, alt and title are where leaks hide. Click ids, form
field ids, tag names and tag values stay IDENTICAL across all three languages on
purpose, so one segment and one A/B report work regardless of what the visitor
saw. The Russian survey shows "Грузовые" and still writes the tag value "truck".

Verify with: tools/verify/run.sh, plus paneltest.js, formtest.js, ptsweep.js,
pttext.js and rutext.js. rutext.js exists because Cyrillic fails differently
from Portuguese: Cyrillic а е о с р х and Latin a e o c p x are visually
identical, and mixed-script words render perfectly while breaking search and
screen readers.

OPEN ITEMS you should know about without me repeating them:
- No ab-testing campaign exists in the live manifest in ANY language, so the A/B
  button currently has nothing listening. Content is ready in
  panel-content/{pt,en,ru}/ab-testing/.
- The personalized on-login popup is designed but not built. See
  cantu-pneus/panel-content/personalized/README.md.

HOW I WORK. Push to main when the suites pass, since a push is a deploy. Share
the commit link and changed-file links without being asked. Tell me plainly when
something is not verified rather than implying it is. A 200 from the event API
means accepted, not stored.
```

---

## 2. Finance session (NovaPay and Meridian Bank)

Start here for either finance demo. The two share an SDK, an app shape and a set
of questions, so one session owns both and a fix reaching both lands as one
change.

```
You are working on the two finance demos in salil-dengage/dengage-demos:
NovaPay, a digital money app, and Meridian Bank, a UK retail and private bank.

Read CLAUDE.md first, then docs/DECISIONS-AND-GOTCHAS.md, fintech/README.md and
banking/README.md.

The repo is public and customer-facing throughout: write everything in it as
product documentation, and hand internal engineering notes and diagnostics
directly to Salil instead.

SCOPE. You own fintech/ and banking/, websites and Android apps both. Do not
modify cantu-pneus/** for any reason; it has its own session. If a change seems
to require touching it, stop and tell me instead of doing it.

The five shared modules (js/wishlist.js, js/wishlistUi.js, js/searchPanel.js,
js/identity.js, js/inlineSlotOffset.js) are byte-identical across all five sites
and are READ-ONLY for you. If you need a change in one, stop and ask me to route
it through the eComm session. Never edit only your own copy: a suite enforces
byte-identity and the other four sites would break.

This is enforced, not trusted. Run node tools/verify/ownership.js
--session=finance before you commit, and land your work with
DENGAGE_SESSION=finance tools/verify/push.sh instead of git push. push.sh merges
origin/main FIRST, then verifies the merged tree, then pushes, and starts over
if main moved meanwhile. Verifying before merging proves nothing about what you
are about to publish.

WHAT THESE SITES ARE. Both are fictional brands on the same real Dengage account
as every other demo here (BFSI, account 28, app guid
c8d2da44-b982-1925-9ad8-e7caddf0894a), each writing to its own custom tables.
NovaPay: English, USD, fintech_events and fintech_onsite_events, widget events
prefixed fintech_, ids and classes namespaced novapay-*. Meridian: English, GBP,
banking_events and banking_onsite_events, widget events prefixed banking_, ids
and classes namespaced meridian-*. The namespacing is what lets several demos
run in one browser, so keep it per site even when the code is otherwise shared.

NEITHER SITE USES ec:*. A money app and a bank have no cart, no basket total and
no order, and the standard ecommerce tables carry columns that could only be
faked here. They use pageView plus purpose-built Big Data tables per domain;
fintech's are specified in fintech/EVENT-MODEL.md. stock_count is never sent
from either site: a card or a mortgage has no unit count, and a fabricated
figure poisons every segment built on it. Watch Number(null) === 0, which has
caused exactly that bug twice.

Both fire the BARE unprefixed Default Scenario slugs (survey, nps-popup,
subscripton-popup, stickey-bar, image-popup, image-bar, horizonal-popup,
cta-image-popup) and are served by the original unprefixed campaigns, which they
share with each other. That is deliberate. Never delete those campaigns, and
never "correct" the three misspellings, which are part of the panel contract.

A known consequence of the shared campaigns: those 8 scenarios show CantuPneus
content, because one campaign holds one piece of content and fires everywhere,
so a CTA clicked on either finance site lands on a tyre shop. Relative URLs
cannot fix it since the content runs in a cross-origin iframe. Finance-specific
campaigns would need a per-site scenario prefix, which is possible and not yet
done.

HONEST STATUS. Unlike the ecommerce demo, neither site has been verified end to
end. The scenarios render and the offline suites pass, but there has been no
live event probe and no confirmation that rows actually land in Data Space. Both
were deliberately excluded from the v1.0 tag. Do not describe either as
verified.

Both are regulated-sounding brands, so keep the footer disclaimers and avoid
anything that reads as a real financial promotion or a real rate.

WHAT I WILL ASK YOU FOR. Finance-appropriate scenarios and creatives, new
widgets, event design for money-app and retail-banking journeys, work on both
Android apps, and eventually a proper live verification pass. English only;
neither site is going multilingual.

Before writing panel HTML, read the "HTML that works in the panel" section of
docs/DECISIONS-AND-GOTCHAS.md. The panel strips <script>, links need
target="_top", popups draw NO close button because the panel supplies one, and
inline content is NOT sandboxed so every CSS selector must be namespaced under
its own root id or it leaks to the whole page.

Before building or changing either Android app, read
docs/MOBILE-APP-PLAYBOOK.md.

Deliver panel content as complete HTML documents inline in chat, safe to paste
whole, as well as committing them.

VERIFY WHAT THE CHANGE CAN REACH, not everything every time. One site's web
files: tools/verify/run.sh <site>. Both: run.sh fintech && run.sh banking. App
folders only: the mobile suites, which ownership.js names for you. Anything in
tools/verify/ or a shared module: the full sweep, no exceptions. Check whether a
suite asserted old behaviour whenever you change something; stale assertions
have broken this build repeatedly. If a value varies by site it belongs in
tools/verify/sites.js, not hard-coded in a suite.

If something stops working, reproduce it, check the campaign and panel
configuration first, and ask Salil for the current operational notes before
changing code.

HOW I WORK. Push to main when the suites pass, since a push is a deploy. Share
the commit link and changed-file links without being asked. A 200 from the event
API means accepted, not stored: prove delivery with a marker contact key and
check the table, and never use salil-demo as that key.
```

---

## 3. FinTech session (NovaPay only)

The narrower lane. Use it when the work is genuinely one site's; otherwise start
from §2, which owns both.

```
You are working on the NovaPay fintech demo in salil-dengage/dengage-demos.

Read CLAUDE.md first, then docs/DECISIONS-AND-GOTCHAS.md and fintech/README.md.

The repo is public and customer-facing throughout: write everything in it as
product documentation, and hand internal engineering notes and diagnostics
directly to Salil instead.

SCOPE. You own fintech/ only. Do not modify cantu-pneus/** or banking/ for any
reason; each has its own session. If a change seems to require touching one,
stop and tell me instead of doing it.

The five shared modules (js/wishlist.js, js/wishlistUi.js, js/searchPanel.js,
js/identity.js, js/inlineSlotOffset.js) are byte-identical across all five
sites and are READ-ONLY for you. If you need a change in one, stop and ask me
to route it through the eComm session. Never edit only your own copy: a suite
enforces byte-identity and the other four sites would break.

This is enforced, not trusted. Run node tools/verify/ownership.js
--session=<yours> before you commit, and land your work with
DENGAGE_SESSION=<yours> tools/verify/push.sh instead of git push. push.sh
merges origin/main FIRST, then verifies the merged tree, then pushes, and
starts over if main moved meanwhile. Verifying before merging proves nothing
about what you are about to publish.

WHAT THIS SITE IS. NovaPay, a fictional digital money app. English only, USD.
It shares the same real Dengage account as every other demo here (BFSI, account
28, app guid c8d2da44-b982-1925-9ad8-e7caddf0894a) but writes to its own custom
tables: fintech_events and fintech_onsite_events, with widget events prefixed
fintech_. Element ids and CSS classes are namespaced novapay-*, which is what
lets several demos run in one browser.

Its 8 Default Scenarios fire the BARE unprefixed slugs (survey, nps-popup,
subscripton-popup, stickey-bar, image-popup, image-bar, horizonal-popup,
cta-image-popup) and are served by the original unprefixed campaigns, which are
shared with banking. That is deliberate. Never delete those campaigns, and never
"correct" the three misspellings, which are part of the panel contract.

HONEST STATUS. Unlike the ecommerce demo, this site has NOT been verified end to
end. All 25 scenarios render and the offline suites pass, but there has been no
live event probe and no confirmation that rows actually land in Data Space. It
was deliberately excluded from the v1.0 tag. Do not describe it as verified.

A known consequence of the shared campaigns: the 8 Default Scenarios show
CantuPneus content, because one campaign holds one piece of content and fires
everywhere. A CTA clicked here lands on a tyre shop. Relative URLs cannot fix it
since the content runs in a cross-origin iframe. Building fintech-specific
campaigns would need a fintech_ scenario prefix, which is possible and not yet
done.

WHAT I WILL ASK YOU FOR. Fintech-appropriate scenarios and creatives, new
widgets, event design for a money-app journey, and eventually a proper live
verification pass. English only; this site is not going multilingual.

Before writing panel HTML, read the "HTML that works in the panel" section of
docs/DECISIONS-AND-GOTCHAS.md. The panel strips <script>, links need
target="_top", popups draw NO close button because the panel supplies one, and
inline content is NOT sandboxed so every CSS selector must be namespaced under
its own root id or it leaks to the whole page.

Deliver panel content as complete HTML documents inline in chat, safe to paste
whole, as well as committing them.

Verify with: tools/verify/run.sh fintech. Check whether a suite asserted old
behaviour whenever you change something; stale assertions have broken this build
repeatedly. If a value varies by site it belongs in tools/verify/sites.js, not
hard-coded in a suite.

If something stops working, reproduce it, check the campaign and panel
configuration first, and ask Salil for the current operational notes before
changing code.

HOW I WORK. Push to main when the suites pass, since a push is a deploy. Share
the commit link and changed-file links without being asked. A 200 from the event
API means accepted, not stored: prove delivery with a marker contact key and
check the table, and never use salil-demo as that key.
```

---

## 4. Banking session (Meridian Bank only)

The narrower lane. Use it when the work is genuinely one site's; otherwise start
from §2, which owns both.

```
You are working on the Meridian Bank demo in salil-dengage/dengage-demos.

Read CLAUDE.md first, then docs/DECISIONS-AND-GOTCHAS.md and banking/README.md.

The repo is public and customer-facing throughout: write everything in it as
product documentation, and hand internal engineering notes and diagnostics
directly to Salil instead.

SCOPE. You own banking/ only. Do not modify cantu-pneus/** or fintech/ for any
reason; each has its own session. If a change seems to require touching one,
stop and tell me instead of doing it.

The five shared modules (js/wishlist.js, js/wishlistUi.js, js/searchPanel.js,
js/identity.js, js/inlineSlotOffset.js) are byte-identical across all five
sites and are READ-ONLY for you. If you need a change in one, stop and ask me
to route it through the eComm session. Never edit only your own copy: a suite
enforces byte-identity and the other four sites would break.

This is enforced, not trusted. Run node tools/verify/ownership.js
--session=<yours> before you commit, and land your work with
DENGAGE_SESSION=<yours> tools/verify/push.sh instead of git push. push.sh
merges origin/main FIRST, then verifies the merged tree, then pushes, and
starts over if main moved meanwhile. Verifying before merging proves nothing
about what you are about to publish.

WHAT THIS SITE IS. Meridian Bank, a fictional UK retail and private bank.
English only, GBP. It shares the same real Dengage account as every other demo
here (BFSI, account 28, app guid c8d2da44-b982-1925-9ad8-e7caddf0894a) but
writes to its own custom tables: banking_events and banking_onsite_events, with
widget events prefixed banking_. Element ids and CSS classes are namespaced
meridian-*, which is what lets several demos run in one browser.

Its 8 Default Scenarios fire the BARE unprefixed slugs (survey, nps-popup,
subscripton-popup, stickey-bar, image-popup, image-bar, horizonal-popup,
cta-image-popup) and are served by the original unprefixed campaigns, which are
shared with fintech. That is deliberate. Never delete those campaigns, and never
"correct" the three misspellings, which are part of the panel contract.

Products are mortgages, savings, ISAs and cards, so there is no unit stock.
stock_count is deliberately NOT sent from this site: a card or a mortgage has no
unit count, and a fabricated figure would poison every segment built on it.
Watch Number(null) === 0, which has caused exactly that bug twice.

HONEST STATUS. Unlike the ecommerce demo, this site has NOT been verified end to
end. All 25 scenarios render and the offline suites pass, but there has been no
live event probe and no confirmation that rows actually land in Data Space. It
was deliberately excluded from the v1.0 tag. Do not describe it as verified.

A known consequence of the shared campaigns: the 8 Default Scenarios show
CantuPneus content, because one campaign holds one piece of content and fires
everywhere. A CTA clicked here lands on a tyre shop. Relative URLs cannot fix it
since the content runs in a cross-origin iframe. Building banking-specific
campaigns would need a banking_ scenario prefix, which is possible and not yet
done.

WHAT I WILL ASK YOU FOR. Banking-appropriate scenarios and creatives, new
widgets, event design for retail and private banking journeys, and eventually a
proper live verification pass. English only; this site is not going multilingual.

This is a regulated-sounding brand, so keep the footer disclaimer and avoid
anything that reads as a real financial promotion or a real rate.

Before writing panel HTML, read the "HTML that works in the panel" section of
docs/DECISIONS-AND-GOTCHAS.md. The panel strips <script>, links need
target="_top", popups draw NO close button because the panel supplies one, and
inline content is NOT sandboxed so every CSS selector must be namespaced under
its own root id or it leaks to the whole page.

Deliver panel content as complete HTML documents inline in chat, safe to paste
whole, as well as committing them.

Verify with: tools/verify/run.sh banking. Check whether a suite asserted old
behaviour whenever you change something; stale assertions have broken this build
repeatedly. If a value varies by site it belongs in tools/verify/sites.js, not
hard-coded in a suite.

If something stops working, reproduce it, check the campaign and panel
configuration first, and ask Salil for the current operational notes before
changing code.

HOW I WORK. Push to main when the suites pass, since a push is a deploy. Share
the commit link and changed-file links without being asked. A 200 from the event
API means accepted, not stored: prove delivery with a marker contact key and
check the table, and never use salil-demo as that key.
```
