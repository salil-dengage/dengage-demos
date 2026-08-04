# Every Dengage surface in the app, and how to drive it

Companion to `README.md`. That file is how to build and run; this is what the
app can do and what has to happen in the panel for each thing to work.

---

## 1. Data: all 86 event types, all nine tables

The app writes the **same nine tables as the website, with the same column
names**. No new table and no new column was created for mobile. The only
difference in any row is `event_source`, which is `android` here and `web`
there, so one contact key produces one journey across both.

| Table | Event types |
|---|---|
| `banking_account_events` | 14 |
| `banking_transaction_events` | 10 |
| `banking_card_events` | 11 |
| `banking_wealth_events` | 8 |
| `banking_product_events` | 8 |
| `banking_tool_events` | 9 |
| `banking_application_events` | 11 |
| `banking_appointment_events` | 5 |
| `banking_engagement_events` | 10 |
| **Total** | **86** |

`EventContractTest` reads the website's own `js/bankingEvents.js` and asserts
the Kotlin catalogue matches it table for table and type for type, so the two
channels cannot drift apart quietly.

### Firing all of them

Tap the **lightning icon** in the app bar for the Event Control Panel, then
**Send all 86**. Every event type fires with **every column of its table
populated**, which is what makes a table's shape visible in Data Space rather
than something to take on trust. Individual tables and individual event types
have their own Send buttons.

Ordinary use of the app writes only the columns a screen knows about, which is
honest but leaves most columns empty. The panel exists to cover the rest.

> A 200 from the event API means accepted, not stored. Sign in as
> `salil@dengage.com`, which resolves to the contact key `salil-demo`, fire the
> catalogue, then look at the table. The row is the only proof.

---

## 2. Identifiers

**Profile > Open identifiers**, or `meridian://identity`.

Every identifier the SDK holds for this device, each one copyable, and a
**Copy all** button that puts the lot on the clipboard as label-value pairs:

contact key, device id, push token, token type, advertising id, partner device
id, integration key, push permission, tracking permission, location permission,
country, language, timezone, carrier, test group, SDK version, app version,
package name, event source.

These come from `Dengage.getSubscription()`, so they are what the platform
believes rather than what the app hoped it sent.

Two readings worth knowing: a blank **push token** means the device never
registered with Firebase, which is the first thing to check when a push does
not arrive. A blank **contact key** means the device is anonymous, which is
correct until someone signs in.

---

## 3. Push

Wired and ready. `FcmMessagingService` is registered in the manifest, which is
what routes a message from Firebase into the SDK.

- Permission is requested on first launch. On Android 13+ the system dialog
  appears; below that the SDK returns without prompting.
- The token appears on the identifiers screen once Firebase issues it.
- To target one device, copy the **device id** and use it in the panel.

---

## 4. In-App messages

Three kinds, and they need different things from you.

**Full screen and modal.** Already working. Every screen change calls
`Dengage.setNavigation(activity, screenName)`, and that call is what In-App
targeting evaluates. Target a campaign at one of these screen names:

```
sign_in  overview  accounts  cards  payments
wealth   profile   products  inbox  events  identity
```

A screen that does not report itself can never be targeted.

**Two conditions, not one.** An In-App shows when the targeted screen is
reported **and** the message is already on the device. The SDK fetches In-App
messages on its own schedule, so one sent seconds ago is usually not there
yet, which is why the refresh button exists. The Test Area has **Refresh
from the server** (`Dengage.getInAppMessages()`) and shows
`Dengage.isInAppFetched()` next to it. The order that works every time:

1. Send the test from the panel, noting which screen name it targets.
2. Test Area > In-App > **Refresh from the server**.
3. Report that exact screen, by opening it or by pressing its Test Area row.

Sending to `overview` and then never returning to `overview` produces nothing,
correctly.

**Inline placements.** The code is in place on the overview screen, under the
account list. It needs a **property id** from the panel, which goes in
`DengageKeys.INAPP_INLINE_PROPERTY_ID`. While that constant is blank the
placement renders nothing at all rather than an empty box.

**App Stories.** Same arrangement: a rail at the top of the overview, needing
`DengageKeys.STORY_PROPERTY_ID`.

> **Needed from Salil:** the inline property id and the story property id.
> Two strings, and both surfaces light up with no other change.

---

## 5. App Inbox

The envelope icon in the app bar. Lists messages, marks them read, and has
delete wired behind `InboxBridge`.

Everything touching the inbox API is isolated in `ui/InboxBridge.kt`, so an
SDK version bump is one file to update.

**Send inbox tests to the contact key, not the device id.** An inbox message
is addressed either to a contact key or to a device id, and a read only sees
the mailbox it asks for. This app calls `setContactKey("salil-demo")` at
launch, so every inbox read asks for the **contact** inbox: a message sent
from the panel to *these device IDs* lands in the device inbox and will not
appear here, however many times you reload. The Test Area prints which mode
this handset is in.

The inbox is also fetched when it is opened, not pushed, so opening it before
the message exists returns `[]` and stays empty until loaded again. Send first,
then open the inbox or press **Load the inbox**. Panel test messages expire
after a day.

---

## 6. Geofence and location

**Profile > Location and geofence.**

Deliberately behind a control rather than started on launch. Location is the
one surface that cannot be switched on quietly: it needs foreground location,
and to fire while the app is closed, which is the only interesting case for a
bank, it needs **background** location too. Android asks for those in two
separate prompts and will not accept both at once. Starting that on first
launch buries the demo under permission dialogs before anyone has seen a
balance.

**In the app:** tap once for foreground, tap again for background, then
**Start geofence**.

On Android 11 and later the background grant is not a dialog at all: the
system sends the customer to Settings, where they have to pick **Allow all the
time**. The card says so on screen when that is where you are.

**In the panel:** the geofences themselves are defined in Dengage, not in the
app. The app subscribes; the platform decides where the fences are and what
happens on enter or exit. So the setup is:

1. Define a geofence area in the Dengage panel (a branch, a partner retailer, a
   competitor's branch, an airport for the travel story).
2. Attach a campaign to enter or exit.
3. In the app, grant location and press Start geofence.
4. The device reports position; the platform matches it against the fences.

Nothing about the fence lives in this code, which is the point: a new location
is a panel change, not a release.

The geofence artifact is separate (`sdk-geofence`) and lives in its own
package, `com.dengage.geofence`. Everything that touches it is isolated in
`ui/DengageGeofenceBridge.kt`, so a version bump is one file.

---

## 7. Deep links

The app answers the `meridian://` scheme. Put one of these in a campaign's
target URL and tapping the push or the In-App opens that screen directly:

```
meridian://overview      meridian://accounts     meridian://cards
meridian://payments      meridian://wealth       meridian://profile
meridian://products      meridian://inbox        meridian://events
meridian://identity
```

`meridian://open?screen=wealth` works too, for panel fields that want a
conventional URL shape. An unknown target lands on the overview rather than a
blank screen.

**Test one without a campaign**, over USB:

```bash
adb shell am start -a android.intent.action.VIEW -d "meridian://wealth"
```

Two things that catch people out:

- **A link arriving while the app is already open** is handled in
  `onNewIntent`. Miss that and a push tapped during a demo appears to do
  nothing, because the app was already in the foreground.
- **If no filter matches, the SDK opens a browser.** That is the usual cause of
  "the push opened Chrome instead of the app". `disableOpenWebUrl = false` in
  `Dengage.init` is what allows the fallback.

A custom scheme rather than an https App Link, on purpose: the https URLs
belong to the demo website, and claiming them here would mean tapping a link to
the site opened the app instead.

### Adding a new deep link target

1. Add the screen name to `DengageKeys.Screen`.
2. Add it to the `known` list in `MainActivity.routeFor`.
3. Add a branch to the `when` in `MeridianApplicationUi`.

No manifest change: the filter matches the whole scheme, not one host.

---

## 8. Tags

**Profile > Tags.** Set four demo tags, or clear them.

Tags are the durable facts; the nine tables carry what **happened**. A bank
segments on both together, which is why the demo has both: "customers with a
mortgage who went overdrawn last month" is one of each.

**They attach to the device, not the contact**, and this is worth knowing
before you go looking for them. A tag set from the app will not show up on the
contact's Fields tab, which holds contact attributes fed from elsewhere. Look
at the device record, or segment on the tag.

Send tags after the app has settled: the tags request goes out once the SDK
has fetched its configuration, a few seconds after a cold start. Send tags
after that point, then confirm the result on the device record in the panel.

This app sends each tag as a plain `(tag, value)` pair. Scheduled tag changes
(`changeTime`, `changeValue`, `removeTime`) are settable on the model and not
used here, because a scheduled change is invisible for as long as the schedule
takes and demos badly. To clear a tag, set it to an empty value.

---

## 9. Silent push

Handled by `push/MeridianFcmService`, which subclasses the SDK's own service
rather than replacing it. A visible push (`messageSource = DENGAGE`) goes
straight to `super` and draws exactly as before; only `DENGAGE_SILENT` is
handled here, and anything that is not a Dengage message is left alone.

**The manifest registers our subclass in place of
`com.dengage.sdk.push.FcmMessagingService`.** Registering both gives the device
two services competing for one intent filter.

On a silent push the app records a row in `banking_engagement_events` as
`inapp_shown` with the campaign slug, so a silent campaign's reach is
measurable rather than invisible. A real deployment would re-fetch balances or
invalidate a cache instead.

---

## 10. Recommendations: not wired in this app

This app does not include a recommendation surface. Before promising one in a
demo, ask Salil.

### 10.1 The inbox API this app uses

```kotlin
Dengage.getInboxMessages(offset, limit, callback)  // InboxMessage
Dengage.setInboxMessageAsClicked(id)
Dengage.setAllInboxMessagesAsClicked()
Dengage.deleteInboxMessage(id)
Dengage.deleteAllInboxMessages()
```

This API family records clicks and deletions. Recommendations and inbox
impression analytics are not part of this app version.

---

## 11. The Test Area

The flask icon in the app bar. One screen with a button per Dengage capability,
so anyone handed the APK can press a thing and see the real thing happen.

**An app cannot send itself a push.** A push originates on Dengage's servers,
so a button here cannot produce one directly; it could only do so by calling
the REST API with an account secret, and a secret shipped inside an APK is a
secret published. So the buttons split in two, and the split is worth saying
out loud in a demo because it is how a real integration works.

### Buttons that need a campaign (server round trip)

Each fires a distinctly named event into `banking_engagement_events`.

**Correction, 2 August 2026.** This section used to say "build a real-time
campaign triggered on that event type". That is wrong for push, and the wording
came from In-App, where *Real Time* genuinely is a campaign type. **Push has no
real-time campaign type.** A push campaign is either one-time or recurring, and
both take a **segment**, which refreshes on a schedule measured in tens of
minutes. So a segment-based push cannot answer a button press.

**The Test Area sends no push of its own.** Every format is drawn on the device
by `MeridianPushGallery`, which hands the SDK's own receiving path the same
intent a real payload produces, so what appears on screen is drawn by the SDK
from a Dengage payload. The app therefore needs no campaign, no segment and no
credentials, which keeps a shareable APK free of secrets.

Real **delivery** is driven from the panel, and that split is worth saying out
loud in a demo: the buttons prove how every format looks and how this app
handles it, and the panel proves delivery.

If a button press should one day trigger a real send, the route is an
**automation flow triggered on the event, with a Fire Campaign action**: a
recurring campaign set to *Trigger Externally* is fired by automation rather
than by a schedule, so no segment refresh sits in the path. **Confirm in the
panel that a flow can trigger on a custom Big Data table event** before relying
on it.


| Button | Event type it also writes | Deep link the notification carries |
|---|---|---|
| Text only | `test_push_text` | `meridian://accounts` |
| Rich, with an image | `test_push_rich` | `meridian://products` |
| Carousel | `test_push_carousel` | `meridian://cards`, three frames |
| Ask for an inbox message | `test_inbox_message` | event only |

Three further pieces, action buttons, silent and a deep-link push, were
specified and then **dropped on 2 August**. They are gone from the app rather
than left half-wired. Deep linking is not lost with them: all three contents
above carry a `meridian://` target, so tapping any of them lands on the right
screen. Silent handling also stays in `MeridianFcmService`, since it is an app
capability rather than a test button.

These event types are deliberately **not** in `MeridianEvents.CATALOGUE`: they
are instrumentation, not part of the bank's 86, and a unit test asserts that
catalogue still matches the website's exactly. They are new *values* in
`event_type`, not new tables or columns.

### Buttons that work on the device

| Button | What it calls | What you need in the panel |
|---|---|---|
| Full screen / Modal / Banner | `setNavigation` on `test_inapp_full`, `test_inapp_modal`, `test_inapp_banner` | an In-App campaign per screen name |
| Real time, with params | `showRealTimeInApp` on `test_inapp_realtime` with `tier` and `surface` | a real-time In-App campaign |
| Dismiss | `removeInAppMessageDisplay` | nothing |
| Load inbox / mark all / delete all | the inbox API | nothing, but a message has to exist |
| Deep links | opens `meridian://…` locally | nothing |
| Set four demo tags | `setTags` | nothing |
| Geofence start / stop | `startGeofence` / `stopGeofence` | a fence defined in the panel |
| Send all 86 | the whole event catalogue | nothing |

An inbox with no messages and an inbox that has not loaded yet look identical,
which is why the load button reports the count rather than just filling a list.

### No recommendation button

Recommendations are not wired in this app. See section 10.

---

## 12. What is not wired

- **Huawei** (`sdk-hms`). Only needed for a Huawei device demo.
- **In-App context setters** (`setCart`, `setCartAmount`, `setCategoryPath`).
  Ecommerce shaped, deliberately unused: a current account is not a basket.
  `setState` and `setCity` would be useful for location targeting and are not
  wired yet.
- **Recommendations.** Not wired in this app. §10.

## 13. Blocked on something in the panel

These are coded and will work the moment the panel side exists. Nothing in the
app needs changing for any of them.

| Surface | What it needs | Where it goes |
|---|---|---|
| In-App inline placement | a property id | `DengageKeys.INAPP_INLINE_PROPERTY_ID` |
| App Stories | a story property id | `DengageKeys.STORY_PROPERTY_ID` |
| Geofence entry and exit | a fence defined in the panel | nothing in the app |
| Test Area push and inbox buttons | real-time campaigns on the `test_*` events in §11 | nothing in the app |

Both property id constants are `""` today, and both surfaces render **nothing**
while blank rather than an empty frame. That is deliberate: an empty frame in a
demo looks like a bug, and a missing section looks like a section that was never
there.

The live status of all of this is tracked in
[`../docs/PROJECT-LOG.md`](../docs/PROJECT-LOG.md) §3, which is the one place to
update when something unblocks.
