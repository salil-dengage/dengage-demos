# Demo - Meridian Bank, Android app

The mobile half of the Meridian Bank demo. Same Dengage account as the
website, same nine tables, same contact keys, so one person signing in on both
produces one journey rather than two.

| | |
|---|---|
| Package | `com.dengagebanking.demo` |
| App name on the phone | Demo - Meridian Bank |
| Language / UI | Kotlin, Jetpack Compose |
| Dengage SDK | `com.github.dengage-tech.dengage-android-sdk:sdk:6.0.96` (JitPack) |
| Firebase project | `dengagebanking` |
| min / target SDK | 24 / 35 |

---

## State of it

**Built and unit-tested here; run on a real handset by Salil.** This container
has a JDK, Gradle and the Android SDK, so `assembleDebug` produces a real APK
and the unit tests pass. It has no emulator (`/dev/kvm` is absent) and no phone,
so anything below the compiler is proven by **someone else running it**, from
logcat and from rows appearing in the panel, and is reported as such rather than
as verified from here.

Proven in this container:

- it compiles against the real SDK, linked from JitPack, producing a 27 MB debug APK
- the nine table names, the two date formats and contact-key normalisation are
  asserted by `EventContractTest` (11 tests, 0 failures), which also reads the
  website's own event layer and asserts the 86 event types match table for
  table, and reads `banking/js/identity.js` and asserts the contact-key map
  matches
- the SDK API surface used here is pinned: the SDK 6.0.96 signatures this app
  compiles against are listed below

Confirmed on a device, by Salil, on 2 August:

- all 86 event types landing in all nine tables under contact key `salil-demo`
- push arriving, and its deep link routing to the right screen
- In-App messages rendering
- the RICH format from a real campaign send, and its open reported back
- the CAROUSEL format, drawn by this app from the campaign payload, with opens
  reported to the campaign
- the App Inbox: a real campaign message read back, plus the three seeded rows
- single-delivery notification handling confirmed, with one push receiver live
  per process

Still unconfirmed anywhere:

- **the unread badge**, which needs a real campaign send with save to inbox
  ticked to move. The logic is one payload field, but treat the first send as
  the test
- geofence entry and exit, the inline placement and App Stories, all of which
  need something created in the panel first

See [`../docs/PROJECT-LOG.md`](../docs/PROJECT-LOG.md) §3.

---

## Running it on a Mac

1. Install **Android Studio** from `developer.android.com/studio`. Take the
   Standard setup and let it download the SDK.
2. **File > Open**, choose `banking/android-app`. Not the repository root:
   Gradle needs the folder that holds `settings.gradle.kts`.
3. Wait for the first Gradle sync. It downloads the SDK and the Compose
   libraries, so allow ten minutes on a cold machine.
4. Plug in an Android phone with **USB debugging** on (Settings > About phone,
   tap Build number seven times, then Developer options > USB debugging), or
   create an emulator with **Device Manager**.
5. Press **Run**. Accept the notification permission when it asks.

To see what the SDK is doing, open **Logcat** and filter on `Dengage`. Every
decision is logged because `setLogStatus` is on in debug builds.

## Proving it reached Dengage

Sign in with **`salil@dengage.com`**, which resolves to the contact key
**`salil-demo`**, the same one the website produces. Then check Data Space for
that contact key.

The mapping matters. A Dengage contact key is not necessarily an e-mail, and
this account's is `salil-demo`. `js/identity.js` maps it on the website and
`MeridianEvents.normaliseContactKey` maps it here; a test reads the website's
file and asserts the two agree. Send the raw e-mail from one channel and the
same human arrives as two contacts.

For a throwaway run that keeps the demo contact clean, sign in with any other
address. It becomes its own contact key with no mapping and no code change.

Remember the rule from the website: **HTTP 200 means accepted, not stored.**
The only proof is the row.

---

## SDK 6.0.96 signatures this app compiles against

The SDK API surface used here is pinned to these signatures:

| API | Signature in this app |
|---|---|
| `DeviceConfigurationPreference` | imports from `com.dengage.sdk.data.remote.api` |
| `DengageLifecycleTracker` | imports from `com.dengage.sdk.util` |
| `getInboxMessages` | callback is `DengageCallback<MutableList<InboxMessage>>` |
| `setNavigation` | takes a plain `Activity` |
| Geofence | package `com.dengage.geofence`, separate artifact `sdk-geofence` |
| `showInlineInApp` | parameter order is `(screenName, element, activity, customParams, propertyId, hideIfNotFound)` |

Everything that touches the App Inbox is isolated in `ui/InboxBridge.kt` so a
version bump is one file to update rather than nine call sites.

This app's inbox uses the `getInboxMessages` API family, which records clicks
and deletions; recommendations and inbox impression analytics are not part of
this app version. See `MOBILE-SURFACES.md` §10 and §10.1.

---

## What each file is for

```
app/src/main/java/com/dengagebanking/demo/
  MeridianApp.kt        Application. Lifecycle tracker, then Dengage.init().
                        Order matters: register the tracker first or the
                        session's first screen is invisible to In-App.
  MainActivity.kt       The only Activity. Calls setNavigation() on every
                        screen change, which is what In-App targeting reads.
  DengageKeys.kt        Integration key, event_source, and the screen-name
                        vocabulary used for In-App targeting.
  data/DemoData.kt      The same demo customer as the web portal, figures
                        included, so both demos tell one story.
  events/MeridianEvents.kt
                        The single event layer. Nine tables, no ec:* calls,
                        Dengage date formats, nulls dropped not coerced.
  ui/MeridianUi.kt      Compose UI for the banking screens.
  ui/JourneyScreens.kt  The four things a customer actually DOES: send money,
                        apply for a card, raise a complaint, book an adviser.
                        No new table and no new event type; every row is one
                        of the 86 the website also sends.
  ui/InboxBridge.kt     Everything touching the App Inbox API.
```

## The four journeys

The Events screen can fire all 86 types on demand, which proves the pipe and
demos badly: a prospect watching a button labelled "send event" is watching
instrumentation. These four screens are the customer doing the thing, and the
row appears because they did it.

| Reached from | Writes | The campaign it exists to trigger |
|---|---|---|
| Pay > Send money | `transfer_made`, `large_transaction`, or `payment_failed` over the available balance | real-time transactional messaging, and the service message a declined payment obliges |
| Products > Apply | `application_started`, `step_completed`, `document_uploaded`, `application_submitted`, `decision_returned`, `offer_accepted` / `offer_declined`, `account_activated`, **or** `step_abandoned` | the abandonment journey, the highest-value automation a retail bank runs |
| Profile > Raise a complaint | `support_contacted`, `complaint_raised` | **suppression.** The right answer is to stop selling, which demos better than another offer |
| Products > Book an adviser | `appointment_booked` with `lead_time_hours`, then `appointment_attended` or `appointment_no_show` | a reminder journey with a real deadline, and the no-show follow-up |

Each has its own screen name, so a push can deep link straight into it:
`meridian://send_money`, `meridian://apply`, `meridian://complaint`,
`meridian://appointment`. `EventContractTest` fails if a screen is declared and
not routed.

**The failure paths are the point.** Send more than the account holds and it
writes `payment_failed` rather than refusing quietly; leave the application
half way and it writes `step_abandoned` naming the step. Demos usually show
only the happy path, and the happy path is not what marketing automation is
for.

The complaint free text is deliberately not sent. A complaint body is exactly
the kind of unstructured personal data that should not sit in a marketing
table.

## Secrets

`google-services.json` and the integration key are committed on purpose:
neither can send anything, and the build needs both.

**The FCM service account key is not here and must never be.** It can send
push as Meridian Bank. It is uploaded directly into the Dengage panel.

## Surfaces

See **MOBILE-SURFACES.md** for what each one needs. In short:

| Surface | State |
|---|---|
| Nine tables, all 86 event types | wired, with an in-app panel that fires every one |
| Identifiers screen | wired, everything copyable |
| Push | wired |
| In-App full screen and modal | wired via setNavigation on every screen |
| In-App inline | wired, needs a property id from the panel |
| App Stories | wired, needs a property id from the panel |
| App Inbox | wired |
| Geofence | wired behind an explicit permission flow |
| Deep links | wired, `meridian://` scheme |
| Tags, Huawei, silent push | not wired |
