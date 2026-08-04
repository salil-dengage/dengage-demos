# Meridian Bank: the project log

> **Start here.** One file for the whole Banking build, website and Android app:
> what is done, what is blocked and on whom, what broke and why, what looked
> broken and was not, and what protects this work from the other sessions.
>
> Written to be read cold, months later, by someone who was not here.

Last reviewed **2 August 2026**, against `main`.

---

## 1. Where everything lives

| I want to | Read |
|---|---|
| know the state of the project | this file |
| build or launch a campaign in the panel | `CAMPAIGN-LAUNCH.md` |
| run a sales demo | `SALES-DEMO-GUIDE.md` |
| know what every event and column means | `EVENT-CATALOGUE.md`, `TABLE-DESIGN.md` |
| understand the ten portal scenarios | `PORTAL-SCENARIOS.md` |
| work on the Android app | `../android-app/README.md`, then `../android-app/MOBILE-SURFACES.md` |
| know the original Android brief and its fixed decisions | `ANDROID-APP.md` |

Repo-wide rules that override anything here: `../../CLAUDE.md`.

---

## 2. Status board

### Website, `banking/`

**Complete and verified by the suites.** Tagged as v1.0 in intent; see §6 for the
one piece of that which did not land.

| Piece | State |
|---|---|
| 9 public pages, 5 public journeys | done |
| Online banking portal, 6 screens behind a sign-in gate | done |
| 9 `banking_*` Big Data tables, 86 event types | done, rows confirmed in Data Space |
| 8 Default Scenario creatives + 10 portal scenarios + lead form | done, all firing |
| 5 `dn_inline_target_*` slots | done, byte-identical `inlineSlotOffset.js` |
| Lead form submission acknowledgement | done |
| Recommendation widgets | **on local fallback**, see §4 |

### Android app, `banking/android-app/`

**Code complete, builds, unit tested, and proven on a real handset for
everything that does not need a panel id.**

| Capability | State |
|---|---|
| All 86 event types across all 9 tables | done, rows confirmed in Data Space |
| `pageView`, `setContactKey`, session tracking | done |
| Identifiers screen, 19 identifiers, copy each or copy all | done |
| Push, incl. deep link routing into any screen | done, confirmed on device |
| Silent push | done |
| In-App: full screen, modal, banner, real time | done, confirmed on device |
| App Inbox | done, see §5.4 for which mailbox it reads |
| Tags | done, see §5.5 for where they land |
| Geofence | code done, **needs a fence defined in the panel** |
| In-App inline placement | code done, **needs a property id** |
| App Stories | code done, **needs a property id** |
| Test Area, one button per capability | done |
| Recommendations | **not wired in this app**, see §5.1 |

### Verification actually run, 2 August 2026

- `tools/verify/run.sh banking`: **ALL SUITES PASSED**, 301 assertions, 0 failures.
- `banking/tools/journeytest.js`: five public journeys, ten-card event panel,
  nine tables, no `ec:*` call. Green.
- `banking/tools/portaltest.js`: the portal's six screens, the gate, and every
  row they write. Green.
- `banking/tools/copytest.js`: all 13 pages read as an English UK bank. Green.
- `banking/tools/creativetest.js`: every portal creative matches its format
  contract, its trigger and its inline slot. Green.
- `./gradlew :app:testDebugUnitTest`: 10 tests, 0 failures, including catalogue
  parity against `banking/js/bankingEvents.js` and contact-key parity against
  `banking/js/identity.js`.
- `./gradlew :app:assembleDebug`: 27 MB APK builds.

### The coverage trap: `run.sh banking` is not the whole story

Worth knowing before anyone reads a green run as complete. The shared suites
**skip** five checks on this site, and say so out loud:

```
SKIP  banking has no search or saved items (ecommerceUi: false)
SKIP  banking has no app surface   (appSurface unset in sites.js)
SKIP  banking has no inline content (inlineContent unset in sites.js)
SKIP  banking has no gated surface  (gate unset in sites.js)
SKIP  banking has no portal         (portal unset in sites.js)
```

The first is correct and permanent: this site does not use the ecommerce API.

The other four are **not** correct as descriptions of the site. Banking very
much has a gated portal, inline content and inline slots. What they mean is that
`banking` has never been given the `gate`, `portal`, `inlineContent` and
`appSurface` config keys in `tools/verify/sites.js` that FinTech has, so the
shared `gatetest`, `portaltest` and `inlinetest` have nothing to drive.

**That ground is covered**, by this site's own tools in `banking/tools/`, which
is why the gap is a naming trap rather than a hole. But `run.sh banking` does
not run those tools. **`push.sh` does**: it runs `<site>/tools/*test.js`. All
four banking tools were renamed to end in `test.js` on 2 August precisely so
that convention picks them up, `copysweep.js` and `portalcreatives.js` being
previously invisible to every automated path.

So: **`push.sh` is the real gate, not `run.sh`.** If you only ever run `run.sh`,
you are not testing the portal.

The tidier fix, left undone deliberately, is to give banking the four config
keys in `sites.js` so the shared suites cover it the way they cover FinTech.
That is a change to shared tooling, it escalates every session to the full
sweep, and it is not worth doing at the end of a session with nobody awake to
look at the result. It is a good first task for whoever picks this up.

Nothing in the app can be verified from the build container beyond compilation
and unit tests: push, In-App and geofence need Google Play services on a real
handset. Everything marked "confirmed on device" was confirmed by Salil, from
logcat and from rows appearing in the panel, not by me.

---

## 3. Outstanding work

### Needs Salil, and nothing can proceed without it

1. **Two property ids from the panel.** `INAPP_INLINE_PROPERTY_ID` and
   `STORY_PROPERTY_ID` in `android-app/.../DengageKeys.kt`. Both are `""`, and
   both surfaces deliberately render nothing while blank rather than showing an
   empty box. Two strings and they light up.
2. **Recommendation container keys** for the website. `MERIDIAN_RECO_CONTAINERS`
   is empty, so five widgets run on local fallback content. Panel > the
   recommendation the widget should serve > its container key.
3. **The `banking-v1.0` tag.** Created locally; the push was refused with HTTP
   403 by this session's git proxy, which blocks tag refs. It has to be pushed
   from a normal clone: `git tag banking-v1.0 <commit> && git push origin
   banking-v1.0`.
4. **Test Area campaigns**, if the Test Area is to be handed to anyone else.
   - **In-App: ready to build.** Campaigns targeted at screen names
     `test_inapp_full`, `test_inapp_modal`, `test_inapp_banner`,
     `test_inapp_realtime`. Nothing blocks these.
   - **Push: nothing to configure.** Every format is drawn on the device by
     `MeridianPushGallery`, so the Test Area needs no campaign and no
     credentials. Real delivery is driven from the panel.
   - **Inbox: still needs a route.** `test_inbox_message` has no transactional
     equivalent wired, so it remains an event with nothing listening. An
     automation flow with a Fire Campaign action is the candidate, and it rests
     on confirming a flow can trigger on a custom Big Data table event.

   Full sheet in `android-app/MOBILE-SURFACES.md` §11.
5. **A geofence area in the panel.** The app reports position against fences it
   does not define.

### Not blocking anything

6. The lead form's acknowledgement is CSS only, because the panel strips
   `<script>` on save. It works; it is just worth knowing it is a
   `:checked ~ sibling` trick and not a real submit handler.

---

## 4. Decisions worth not relitigating

**The finance sites use no `ec:*` calls at all.** A bank has no cart, no basket
total and no order. `shopping_cart_events` and friends carry columns that could
only be faked here. So Meridian uses `pageView`, which is industry neutral, plus
nine purpose-built Big Data tables. This reversed an earlier decision; the
reasoning is in `../../docs/DECISIONS-AND-GOTCHAS.md`.

**`stock_count` is never sent from this site.** A mortgage has no unit count. A
fabricated figure poisons every back-in-stock segment. Watch
`Number(null) === 0`, which has caused that bug twice elsewhere.

**Banking's scenario events are unprefixed on purpose.** The three CantuPneus
sites use `br_` / `en_` / `ru_`; FinTech and Banking serve from the original
unprefixed campaigns. Never delete those campaigns, and never correct the three
deliberate misspellings in the slugs (`subscripton-popup`, `stickey-bar`,
`horizonal-popup`), which are part of the panel contract.

**The app resolves the contact key rather than sending the email.** `js/identity.js`
maps `salil@dengage.com` to `salil-demo`; the app carries the same map, and a
unit test fails if the two drift. Without it, one person becomes two contacts.

**Every event goes through one paced background queue**, 120ms apart. Not
politeness: see §5.3.

---

## 5. Lessons that cost real time

Each of these cost real time. They are recorded so the next person does not
pay for them twice.

### 5.1 Recommendations are not wired in this app

Recommendations are not part of this app's build. The Test Area says so on
screen rather than offering a button that does nothing. The website's
recommendation widgets are a separate matter and run on local fallback until
their container keys arrive, §3.

### 5.2 A 200 from the event API means accepted, not stored

`/api/web/event` returns 200 with an empty body. A 200 means accepted; the
only proof that an event landed is a row in Data Space, queried by a marker
contact key. Skipping that step produced two confident and wrong "it is
working" claims.

### 5.3 No rows at all: it was DNS on the device

The app fired 86 events in about 100ms. Every one returned
`UnknownHostException: Unable to resolve host "event.dengage.com"`: the device
resolver had been exhausted by 86 simultaneous lookups. Nothing was wrong with
the SDK, the integration key or the payloads.

Fixed by routing every send through a single background channel with a 120ms
gap, in `events/MeridianEvents.kt`. That also fixed the dropped frames and the
batch being cancelled when the user navigated away mid-send.

**The general lesson:** a batch of independent network calls on a phone is not
free, and the failure looks exactly like a server rejecting you.

### 5.4 The inbox is per identity: contact inbox or device inbox

When a contact key is set, the app reads the **contact** inbox; when it is
blank, it reads the **device** inbox. This app sets a contact key at launch, so
it only ever reads contact mail. A test message sent from the panel to a
**device id** lands in the device inbox and will not appear, and the request
comes back as an empty list, which looks exactly like a healthy empty inbox.

Send inbox tests to the contact key. The Test Area prints which mode the handset
is in.

### 5.5 Tags attach to the device, not the contact

A tag lands on the device record, not on the contact's Fields tab. Look at the
device record, or segment on the tag.

Send tags after the app has settled: the request goes out once the SDK has
fetched its configuration, a few seconds after a cold start. Then confirm the
result on the device record in the panel.

### 5.6 A push opened the login screen instead of the deep link

A push destination can arrive as intent data or as the string extra
`targetUrl` / `dn_target_url`. The app was reading only `intent.data`, so the
destination was sitting in an extra nobody read. `MainActivity.routeFor` now
reads all of them, in both `onCreate` and `onNewIntent`.

### 5.7 An In-App needs two conditions, not one

The targeted screen must be reported **and** the message must already be fetched
onto the handset. The SDK fetches on its own schedule, so a message sent seconds
ago is usually not there. The Test Area has a Refresh button and shows
`isInAppFetched()`. Sending to `overview` and never returning to `overview`
produces nothing, correctly.

### 5.8 The portal is gated, so incognito shows nothing

`banking/js/portal.js` `gate()` returns null without `localStorage.meridian_user`.
No sign-in means no slots and no `banking_portal_*` events, so every portal
scenario is dark. This was the real cause of "all the campaigns are live but
nothing comes up", and it is correct behaviour.

### 5.9 Frequency caps are per visitor and survive a hard reload

"It only shows after Reset displays" is expected behaviour. The engine keeps
per-visitor display history, and a hard reload does not clear it. The
launcher's Reset displays control clears that history and reloads, so
scenarios can be repeated without clearing cache and cookies.

### 5.10 The column names are the contract

The app first wrote `card_id`, `card_last_four` and `category_path`. The real
names are `card_id_masked`, `card_product` and `product_category`. Only
declared columns are stored: every row stored fine, and each mismatched column
simply arrives empty in Data Space. A column that is always empty in Data
Space is the symptom.

### 5.11 An inline creative cannot go in a Popup campaign

Inline content is injected into a page element; a Popup campaign has no element
to inject into, so it renders nothing there. It has to be created as an Inline
campaign with the `#`-prefixed selector. The selector is a CSS selector: a
missing `#` reads as a tag name and matches nothing.

### 5.12 Push has no real-time campaign type, so a button cannot summon one

Raised by Salil on 2 August, and he is right. The Test Area's push buttons were
documented as needing "a real-time campaign triggered on the event". That
wording is borrowed from **In-App**, where *Real Time* is a genuine campaign
type. **Push has no equivalent.** A push campaign is one-time or recurring, and
both take a **segment**; segments refresh on a schedule of tens of minutes, so a
segment-based push can never answer a button press.

Three routes exist. What is verified about each:

| Route | Latency | Secret on device? | Status |
|---|---|---|---|
| Automation flow on the event, Fire Campaign action | seconds | no | **the intended route**, needs one panel confirmation |
| Transactional Push API | immediate | yes, unless relayed | usable only behind a relay |
| Panel test send, by hand | manual | no | what has been used so far |

**Route 1.** A recurring campaign set to *Trigger Externally* is fired by an
automation flow rather than by a schedule, so no segment refresh sits in the
path. `dev.dengage.com/docs/directly-on-flow-push` documents the Fire Campaign
action. **Unconfirmed and load-bearing:** whether a flow can trigger on a custom
Big Data table event, which is what the Test Area writes. Check this in the
panel before relying on it.

**Route 2, the Transactional Push API.** Reading the reference, this is exactly
the right shape for a demo trigger:

```
POST https://api.dengage.com/rest/transactional/push
Authorization: <access token>
{ "contentId": "<uuid of a push content template>",
  "contactKey": "salil-demo",          // or "token" + "appId"
  "sendToAll": true,                   // all devices for that contact key
  "customParameters": [...],           // personalisation
  "inboxParams": {...}, "tags": [...] }
```

One push, one recipient, sent immediately, from a template. Max 30 requests per
second per IP, with `traceId` for idempotency.

**Decision, 2 August 2026: the app sends no push of its own.** The Test Area
renders every push format on the device with `MeridianPushGallery`, and real
delivery is driven from the panel, so the app holds no credentials at all.
That keeps a shareable APK free of secrets and still shows every format.
Mitigation applied in the guidance: use a **dedicated API user** from
Settings > API User with the narrowest role that can send a transactional push,
so a leak costs one rotation rather than an administrator.

Route 1 remains the only route that needs no secret at all, and the buttons
still fire their events alongside the transactional send, so switching to it
later costs nothing on the app side.

**Two operational requirements confirmed against the live API, 2 August 2026.**
Both are worth knowing before anyone debugs from scratch.

**a. The REST API is IP-allowlisted for API users.**

`api.dengage.com/rest` is the management API that API users authenticate
against, and it is IP-allowlisted: a request from an unlisted IP is refused
before authentication, so a refusal there says nothing about whether the
credentials are right. Allowlist entries live under Settings > Identity &
Access Management > API IP Restriction and take effect in about five minutes.

**This is why the app does not call the management API from a handset in the
wild.** A phone's public IP is a carrier NAT address that changes with the
network, so there is nothing stable to list. That is one of the reasons the app
sends no push of its own: it renders the formats on the device and leaves
delivery to the panel.

Practical positions, in order of preference: the **automation flow** route,
which makes no REST call at all; or a **relay on one fixed IP** holding any
credentials server-side, so nothing ships in the app.

The SDK hosts (`push.dengage.com`, `event.dengage.com`, `*.lib.dengage.com`)
are a different matter: they serve every handset on the internet and are not
IP-restricted, which is why the app's events and inbox work fine from a phone
on mobile data. So a demo app is not expected to send its own push: the app
renders the push **formats** locally, and real **delivery** is driven from the
panel. Those are different claims, and a prospect may well ask which one they
are watching.

**b. Push content must be saved as transactional for that API.**

The transactional endpoint uses transactional push content, so a content saved
as marketing is not the one to reference there.
Save the content as transactional and the id resolves.

**End to end, this route is proven.** With the container's range allowlisted, a
send to `salil-demo` returned Successful with two tracking ids, one per
registered device, and the push arrived. So the mechanism works. What remains
open is only **where the call is made from**, per (a).

**Compliance note worth carrying into a demo.** Transactional exists so service
messages reach a customer regardless of marketing permission. Marking
offer-style content transactional is fine for a fictional brand on a demo, and
wrong in a real deployment, where offers would be marketing campaigns that
respect permission. A bank's compliance team will ask, so say it first.

### 5.13 Live Update: available on Android, and not implemented here

Also raised by Salil on 2 August. The three REST endpoints
(`/liveActivity/start`, `/update`, `/end`) support **both iOS and Android**.
This app compiles against the following Android surface:

```kotlin
DengageLiveUpdateManager.register(activityType: String, handler: LiveUpdateHandler)
DengageLiveUpdateManager.unregister(activityType) / isRegistered / isActive

interface LiveUpdateHandler {
    val channelId: String
    val channelName: String
    val channelDescription: String
    fun buildNotification(context, payload: LiveUpdatePayload): Notification
    fun onUpdate(context, payload: LiveUpdatePayload)
}

class LiveUpdatePayload(activityType, event: START|UPDATE|END,
                        activityId, contentState: Map<String,String>, dismissalDate)
```

The `LiveUpdateHandler` properties are Kotlin vals. On Android this is **the
app building its own ongoing notification** from a `contentState` map the
server sends, not an OS widget system like Apple's ActivityKit: the FCM
message reaches the registered handler and the app decides what it looks like.

**Not implemented in this app.** It was never requested. It is a genuinely good
demo, a payment or an application progressing on the lock screen, and the work
is small: one `LiveUpdateHandler`, registered at launch, plus a Test Area row.
The starts, updates and ends come from the REST endpoints, which have the same
access-token constraint as §5.12. Ask Salil for the Android Live Update
material before building it.

### 5.14 One live push receiver, registered by MeridianApp

The app keeps exactly **one** live receiver for
`com.dengage.push.intent.RECEIVE`, registered by `MeridianApp`. Do not add
another, and do not change the mechanism. Do not remove: required for correct
behaviour with this SDK version. Background: ask Salil. How it is built is in
§5.23.

### 5.15 Mobile In-App content uses the mobile bridge contract, not the web one

The panel is the same and the HTML looks the same, but the contract on mobile
is different, in two places:

1. **Navigation goes through `Dn.androidUrl`.** A link is
   `onclick="Dn.androidUrl('meridian://<screen>')"`; a plain
   `<a href="meridian://...">` does not navigate. `target="_top"` is web-only
   and meaningless here: there is no cross-origin iframe on mobile.
2. **Input capture is `Dn.setTags('tag:<key>,value:<value>')`**, one
   comma-separated string with the literal keys `tag` and `value`.
   `data-dn-form-id` is the web mechanism and does not apply on mobile.

All six mobile content files originally shipped with the web contract. They
would have rendered perfectly and done nothing on tap.
`banking/tools/mobiletest.js` now fails on either mistake, plus on any `Dn.*`
call that is not a real bridge method.

### 5.16 An In-App is HTML plus positioning parameters, so no template is a special case

An In-App message is HTML plus positioning parameters: position (TOP, MIDDLE,
BOTTOM, FULL), max width, radius, margins and dismiss-on-touch-outside. That is
the whole envelope.

So every template in the panel gallery, Banner, Modal, Image Modal, Full
Screen, Full Image, Survey, NPS, Countdown to Win, Scratch to Win, Spin to Win,
is preset HTML in that same envelope. **Nothing is gated behind a template.**
The templates give a starting point, and the three Gamification ones wire a
coupon pool to a `{{#coupon}}` / `{{couponCode}}` Mustache pass that the SDK
runs over the content before display.

Practical effect: the app needs nothing per layout. It reports a screen name
and the campaign decides what appears there. Adding an eleventh template means
adding a row to `MeridianInApp.PLACEMENTS` and a campaign, and no Kotlin.

### 5.17 The SDK surface this app builds on

Pinned here so nobody has to rediscover it. This app compiles against these
signatures:

- **Inbox:** `getInboxMessages(offset, limit, callback)`, plus
  `deleteInboxMessage`, `deleteAllInboxMessages`, `setInboxMessageAsClicked`
  and `setAllInboxMessagesAsClicked`.
- **Tags:** `Dengage.setTags(List<TagItem>)`. `TagItem` carries `removeTime`,
  `changeTime` and `changeValue`.

**Present and now wired up:**

- `setCountry`, `setState`, `setCity`. Geographic segments with no location
  permission at all, which is a different and much cheaper thing than the
  geofence. Test Area > Device context.
- `setInAppDeviceInfo(key, value)` / `getInAppDeviceInfo()` /
  `clearInAppDeviceInfo()`. Arbitrary key/value pairs an In-App display rule
  can read, so a real-time message can be gated on something the app knows and
  the server has not been told yet.
- `setCategoryPath`. Same idea for the browsing context.
- `getUserPermission()`. Nullable on purpose: null is "never asked", which is a
  different state from a refusal and a different segment.
- `TagItem`'s `removeTime`. Campaign eligibility that expires on schedule.
  A `rate_week_eligible` tag with no expiry is a segment that is quietly wrong
  six months later.

**Deliberately still not used:**

- `setCart`, `setCartAmount`, `setCartItemCount`. Ecommerce. A bank has no
  basket, and CLAUDE.md §3.10 bans the `ec:*` model on the finance sites.
- `setPartnerDeviceId`. Adjust attribution, which is not part of this story.
- `addToCart`, `order`, `search`, `addToWishList` and the rest of the
  ecommerce API, for the same reason.

### 5.18 The app had a pipe but no journeys, which demos badly

Until 2 August the app could be browsed, and the Events screen could fire all
86 types on demand. That proves the plumbing and demos poorly: a prospect
watching a button labelled "send event" is watching instrumentation.

Four screens now do the thing a customer does, and the row appears because they
did it. **No new table and no new event type**, so every segment still catches
the web customer and the app customer together, separated only by
`event_source`:

| Screen | Writes | The campaign it exists to trigger |
|---|---|---|
| Send money | `transfer_made`, `large_transaction`, or `payment_failed` | real-time transactional messaging, and the service message a declined payment obliges |
| Apply for a card | `application_started`, `step_completed`, `document_uploaded`, `application_submitted`, `decision_returned`, `offer_accepted` / `offer_declined`, `account_activated`, **or** `step_abandoned` | the abandonment journey, the highest-value automation a retail bank runs |
| Raise a complaint | `support_contacted` and `complaint_raised` | **suppression.** The right response is to stop selling, which demos better than another offer |
| Book an adviser | `appointment_booked` with `lead_time_hours`, then `appointment_attended` or `appointment_no_show` | a reminder journey with a real deadline, and the no-show follow-up |

The failure paths are the point. A transfer over the available balance writes
`payment_failed` rather than refusing quietly, and leaving the application
half way writes `step_abandoned` naming the step. Demos usually show only the
happy path, and the happy path is not what marketing automation is for.

The complaint free text is deliberately **not** sent. A complaint body is
exactly the kind of unstructured personal data that should not sit in a
marketing table, and a prospect in financial services will ask.

### 5.19 The click receiver filter carries exactly three actions

The app's click receiver filter carries exactly `ACTION_CLICK`, `ITEM_CLICK`
and `CAROUSEL_ITEM_CLICK`. `OPEN` and `DELETE` are handled elsewhere. Do not
add `RECEIVE` to the filter, and do not change the mechanism. Do not remove:
required for correct behaviour with this SDK version. Background: ask Salil.

### 5.20 The carousel format is drawn by this app

`push/MeridianCarousel.kt` renders the carousel format from the campaign
payload delivered over FCM, and taps go through `Dengage.sendOpenEvent` so
opens land on the campaign. Do not remove: required for correct behaviour with
this SDK version. Background: ask Salil.

### 5.21 Only a real campaign send fills the App Inbox

A panel Test Send does not save to the inbox; a real campaign send with save
to inbox ticked does. So after a Test Send the inbox correctly stays empty.
**Verify App Inbox with a real campaign send, never with Test Send.** The
`[TEST]` title prefix is the tell.

### 5.22 RICH from the panel works end to end

A RICH campaign posts normally from a real send: push delivery, the channel,
the CDN image and the action buttons are all fine end to end.

### 5.23 How push handling is built in this app

Two pieces of the push path are built in this app, on purpose. Both carry a
do-not-remove directive.

**One live push receiver.** `MeridianApp` overrides all four
`registerReceiver` overloads: when a filter carries
`com.dengage.push.intent.RECEIVE` it unregisters the previous registration
first, so exactly one live push receiver exists at any time. Nothing is
swallowed: every push is still handled and every click still reports. The
trigger is a single action string, so the click-only receiver in
`MeridianPushGallery`, which does not carry it, and every other library's
receivers are untouched. Do not remove: required for correct behaviour with
this SDK version. Background: ask Salil.

**The carousel renderer.** `MeridianCarousel` draws the carousel format: a
`RemoteViews` body inside `DecoratedCustomViewStyle`, one image at a time
bounded to 512px wide, arrows that page in place via a manifest-declared
receiver, and neighbour prefetch so the first press is not a blank frame. The
payload is still Dengage's, still delivered over FCM, and taps go through
`Dengage.sendOpenEvent`, so opens land on the campaign exactly as they would
have. Do not remove: required for correct behaviour with this SDK version.
Background: ask Salil.

**What keeps this from touching the nine formats that already work.** The
interception in `MeridianFcmService` is one line guarded twice:

```kotlin
if (MeridianCarousel.handles(data) && MeridianCarousel.render(this, data)) return
super.onMessageReceived(remoteMessage)
```

`handles` returns false for a Live Update, for a geofence push, for anything
whose `notificationType` is not CAROUSEL, and for a carousel whose items do
not parse. `render` catches everything and returns false rather than throwing.
So the only way to reach the new code is a carousel this app can draw
completely, and every other path is byte for byte what it was. **Never swallow
a message** is the rule this app has broken once before, in exactly this file.

Unverified on a handset at the time of writing. It builds, the eleven unit
tests pass and the manifest merges, which is not the same thing. Treat the
first run on a device as the real test.

### 5.24 The inbox screen: the data was right, the list was the problem

Three rounds of "the inbox is empty" had three different causes, and only the
third was in this repository.

1. The screen was correct and the inbox genuinely was empty, because a panel
   Test Send does not save to the inbox. §5.21.
2. A real campaign send filled it, the platform returned the message, and the
   screen was still blank with nothing logged anywhere. That is why
   `InboxBridge` was instrumented.
3. The instrumentation answered it on the first run:

```
22:53:20.811  Meridian inbox: requesting
22:53:21.255  Meridian inbox: 1 message(s)
22:53:21.255  Meridian inbox: P-19385-1 Test
```

The request fires, the callback fires, the mapping produces a row with a title.
Everything from the SDK to `InboxRow` is good, so what was left was the list.

`InboxScreen` drew its rows in a `LazyColumn`. A `LazyColumn` does not read the
state list in the composition that owns it; it reads it inside its own item
provider, so whether the screen redraws depends on that observation rather than
on `InboxScreen` itself. It is now a plain scrolling `Column` with
`messages.forEach`, which reads the state list in the one place recomposition is
certain. The inbox is capped at 20 rows, so laziness was buying nothing and
cost a demo. The two long lists that genuinely need it, transactions and
products, keep their `LazyColumn`.

There was a second cause, found the same evening and just as necessary.
`MainActivity` declared no `launchMode`, so it was `standard`, and every deep
link did `LAUNCH_MULTIPLE`: Android built a **second** `MainActivity` and
destroyed the first, which is why `onNewIntent` never fired despite a comment
claiming it did. The inbox result was landing in a composition already being
torn down, 3ms after `visibilityChanged newVisibility=false`. It is
`singleTask` now, and the deep link reports `LAUNCH_SINGLE_TASK ... result
code=3`, meaning delivered to the live instance.

**Confirmed on the handset on 2 August**: the Inbox screen shows "1 message."
and the campaign's card. Neither fix worked alone. The `Column` gets the rows
into the composition; `singleTask` keeps the composition alive to receive them.

The status line now also carries the count, so it reads "1 message." next to
whatever the list is doing. That single string would have named this in one
look instead of four rebuilds, which is the lesson: **when a screen and its
data disagree, put the count on the screen.** A diagnostic that only reaches
logcat still needs somebody to go and read logcat.

### 5.25 The App Inbox ships with three messages of its own

The inbox is server-side, and only a real campaign send with save to inbox
ticked writes a row. Neither the app's own Test Area push nor a panel Test Send
does: a Test Send does not save to the inbox, and the Test Area push is built
on the device, so Dengage is never told about it.

So out of the box the screen was empty until someone had run a campaign, and an
empty screen sells nothing. `SEEDED_INBOX` now supplies three Meridian service
messages, statement ready, travel notice, Rate Week, and real campaign rows are
appended below them, so a live send is still visibly a live send.

Three things follow from the rows being local, all handled in `InboxBridge`:

- **Writes take the row, not the id.** Passing a seeded id to
  `setInboxMessageAsClicked` would be a request about a message the platform
  has never seen, so `markClicked` and `delete` return early for local rows and
  the screen only draws "Mark as read" on real ones.
- **An inbox error still shows the seeded rows.** On bad wifi an empty screen
  and a failed request look identical, and the seeded rows do not need the
  network.
- **Clear all clears both halves, and they are not equally reversible.** The
  seeded rows come back on the next launch, because the flag is in memory and
  nowhere else; a real campaign message is deleted on the platform and does
  not. The status line says exactly that instead of leaving it to be discovered
  mid-demo.

### 5.26 An unread badge, because a filed message was invisible

A campaign with save to inbox ticked arrived, filed itself, and the app gave
no sign of it. Nothing was broken: there was simply no indicator, and the
inbox only re-reads when the screen is opened or Refresh is tapped. In a demo
that reads as a feature that does not work, and it also loses the point of an
App Inbox, which is the difference between a push that interrupts once and a
message the customer can come back to.

The Inbox icon now carries a count. It is driven from `addToInbox` in the push
payload, which is the platform saying it filed the message, so:

- a real campaign send with save to inbox ticked moves the badge,
- a panel Test Send does not, because a Test Send does not save to the inbox,
  §5.21,
- the app's own Test Area push does not, because it never reaches Dengage.

That is the correct behaviour in all three cases, and it makes the Test Send
semantics visible instead of confusing: the push arrives, the badge does not
move, and the reason is the type of send rather than the app.

The count is Compose state on `InboxBridge`, written from `MeridianFcmService`,
which is not a composable. That is safe, and it is what lets a push arriving on
the Wealth screen move a badge that screen knows nothing about. It clears when
the inbox is actually read, not on navigation, because reading the list is the
moment the customer has caught up.

---

## 6. Where I was wrong

Recorded because the wrong answers are as expensive as the right ones, and
because two of them were corrected by Salil, not by me.

1. **"`maxShowCount: 0` is why nothing displays."** It is not:
   `maxShowCount: 0` still permits the first display, verified rendering live.
   Salil pushed back, correctly. The real cause was the portal gate, §5.8.
   Corrected in the committed launch sheet in `2d43573`.
2. **"The integration key is being double-escaped."** The `_p_l_` and `_e_q_`
   sequences looked like an encoding bug. Salil's panel screenshot showed the
   identical string, so the key was never wrong.
3. **"The tracking-permission gate is off."** It was not; the events were being
   sent all along. The real cause was DNS, §5.3.
4. **"Check the contact's Fields tab for the tags."** Wrong place entirely,
   §5.5. This one was in the app's own on-screen text, so it actively misled.
5. **The v1.0 tag was reported as done before it was.** The tag exists locally;
   the push was refused with a 403 and the work item is still open, §3.3.
6. **"Build a real-time campaign on the event"** for the Test Area's push
   buttons. There is no such thing for push; I carried the term over from
   In-App without checking. Salil caught it. The Test Area's push buttons
   therefore have **no working panel recipe yet**, only a candidate one, §5.12.
   Everything on-device in the Test Area is unaffected.

---

## 7. How Banking is protected from the other sessions

Several sessions push to one branch, so this matters. The protection is
mechanical, not a promise.

**Since 3 August, NovaPay and Meridian are owned by one `finance` session**, so
the boundary that matters is no longer Banking against FinTech: it is the two
finance demos against eComm. The lanes below are unchanged; what changed is
which sets of them a session may hold.

**What enforces it**

- `tools/verify/ownership.js` classifies every changed path into a lane
  (`ecomm`, `fintech`, `banking`, `shared-module`, `asset-tooling`, `tooling`,
  `docs`, `root`) and **fails** if a session touched a lane it does not own.
  `banking` owns `banking/`; `finance` owns `banking/` and `fintech/` both.
- `tools/verify/push.sh` is what replaces `git push`. It refuses a dirty tree,
  **merges `origin/main` first**, re-checks ownership, runs the verification
  tier the merged diff earns, and starts over if main moved while the suites
  were running. Merge, then verify. Never verify, then merge.

**Why Banking cannot be broken by an eComm merge**

- Every file under `banking/` is Banking's alone. The sites duplicate their
  `js/`, `images/`, `vendor/` and stylesheets **on purpose**, so a change made
  for one prospect cannot reach another's demo. This is not un-DRY by accident.
- The five shared modules (`wishlist.js`, `wishlistUi.js`, `searchPanel.js`,
  `identity.js`, `inlineSlotOffset.js`) are byte-identical by contract and are
  **read-only for this session**. Only eComm may change them, and
  `searchwishtest.js` and `slottest.js` fail the whole build if any copy drifts.
  So a divergence is loud, not silent.
- A change to a shared module, to `tools/`, or to the SDK plumbing escalates
  that session to the **full sweep across all five sites**, which includes every
  banking suite. Banking's assertions run on their change, not just theirs.
- Nothing in Banking's panel configuration is shared with the other brands
  except the eight unprefixed Default Scenario campaigns, which NovaPay also
  serves from. Those must never be deleted, by anyone.

**The one thing no script can catch**

NovaPay and Meridian both serve from the **unprefixed** Default Scenario
campaigns. Change the content of one of those eight and it appears on both
sites, because one campaign holds one piece of content and fires everywhere. If
either site needs different content, it needs its own prefixed campaigns and a
`SCENARIO_EVENT_PREFIX`, the way the three CantuPneus sites do it. That is a
panel-side risk, so no script in this repository can see it. Owning both demos
in one session makes it easier to notice, not impossible to cause.

**One more thing worth knowing**

- NovaPay already has the `gate`, `portal`, `appSurface` and `sessionSeed` keys
  in `tools/verify/sites.js` that Meridian lacks, §2. If anyone adds them for
  Meridian, that is a shared-tooling change and triggers the full five-site
  sweep, which runs every site's suites. That is the system working, not a
  collision.

---

## 8. Verifying Banking end to end, from cold

The site's own tools need a static server on 8101, served from the **repository
root**: `python3 -m http.server 8101`. `run.sh` starts its own and takes it down
again, so run the two separately.

```bash
# website
tools/verify/run.sh banking                 # shared suites, about 5m15
node banking/tools/journeytest.js           # 5 public journeys, 10-card panel
node banking/tools/portaltest.js            # the portal and its gate
node banking/tools/copytest.js              # 13 pages, English UK bank
node banking/tools/creativetest.js          # portal creatives and inline slots

# app
cd banking/android-app
./gradlew :app:testDebugUnitTest            # catalogue and identity parity
./gradlew :app:assembleDebug                # produces an installable APK

# ownership, before any push
node tools/verify/ownership.js --session=finance    # or =banking, the narrow lane
DENGAGE_SESSION=finance tools/verify/push.sh
```

**`push.sh` refuses to run from a session branch.** It asserts the branch is
`main`, and this session is required by its own configuration to develop on
`claude/meridian-bank-demo-it3exf`, so it exits before doing anything. That is
the wrapper being careful, not a bug, but it means the guarantees have to be
reproduced by hand from a session branch:

```bash
git fetch origin main
git rev-list --count HEAD..origin/main       # must be 0, else merge first
node tools/verify/ownership.js --session=finance
tools/verify/run.sh banking                  # AFTER the merge, never before
git push -u origin <session-branch>
git push origin HEAD:main
```

Anyone working directly on `main` should just use `push.sh` and skip all of
that. Never `git push --force`, and never resolve a conflict by taking one side
wholesale.

To prove an event genuinely lands, fire it and confirm the row in Data Space
under a **dedicated marker contact key**, never `salil-demo`: that is Salil's
own contact and filling it with test devices costs a real demo. A 200 proves
nothing, §5.2, and `CLAUDE.md` §5.
