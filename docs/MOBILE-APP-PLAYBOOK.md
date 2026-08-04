# Building a Dengage demo mobile app: the playbook

> **Who this is for.** A session about to build the **NovaPay (FinTech) Android
> app**. It is written to be brand-neutral and industry-neutral. Every rule here
> was paid for during the Meridian Bank Android build in July and August 2026,
> most of them by long debugging cycles.
>
> **What this is not.** It is not a description of the banking app and you are
> not porting the banking app. See §0 for the hard line between the two.

Everything below was verified **on a real handset with real campaign sends**.
Where a class name, package or signature is stated, it is pinned: this app
compiles against SDK 6.0.96 with exactly these signatures. Re-check the pinned
facts on every SDK upgrade.

---

## 0. The line between your app and the banking app

**Do not copy code, content, tables, event names, screens or branding from
`banking/android-app`.** It is a different industry with a different data model,
and its session owns it.

**Do copy the shape**: the module layout, the pacing queue, the identifiers
screen, the Test Area, the doc structure. Those are generic.

The distinction that matters most:

| Copy this | Never copy this |
|---|---|
| The architecture and the traps in §3 to §12 | Any `banking_*` table name |
| The pacing queue, verbatim if you like | Any banking event type or column |
| The identifiers screen and the Test Area | Meridian's palette, copy or icon |
| The date helpers and contact-key resolution | The nine-table design |
| The `MOBILE-SURFACES.md` doc shape | Anything about mortgages, ISAs or overdrafts |

Your app's tables, events and columns come from **the FinTech site's own event
layer** (`fintech/js/`) and whatever exists in the panel for FinTech. Read those
and mirror them exactly. If the app and the website disagree about a column
name, the rows still store and the mismatched column stays empty, §6.3.

One shared rule, from `CLAUDE.md`: this session owns `fintech/` only. The five
byte-identical shared modules are read-only to you.

### Where the reference implementation is, file by file

Read these while you build. They are the working answers to everything in this
playbook, in a different industry, so read them for shape and never for content.

| File in `banking/android-app/app/src/main/java/com/dengagebanking/demo/` | What it solves |
|---|---|
| `MeridianApp.kt` | init order, Live Update registration, and the `registerReceiver` override that keeps push on a single receiver (§0.5) |
| `MainActivity.kt` | one activity, deep link routing from three sources, `setNavigation` on every screen change |
| `events/MeridianEvents.kt` | the paced queue, date helpers, the whole event surface |
| `events/EventSamples.kt` | the sample payload per event, used by the Test Area |
| `push/MeridianFcmService.kt` | never swallow a message, silent push, the one guarded intercept |
| `push/MeridianCarousel.kt` | a full host-rendered notification: RemoteViews, paging arrows, prefetch, `sendOpenEvent` |
| `push/MeridianLiveUpdate.kt` | Live Update handler and a local player |
| `push/MeridianPushGallery.kt` | the local gallery of every push format |
| `push/PushInspector.kt` | last-push card, the fastest way to see what actually arrived |
| `ui/InboxBridge.kt` | every App Inbox call, seeding, unread badge, the logging that solved it |
| `ui/TestArea.kt` | the button-per-capability screen |
| `ui/IdentityScreen.kt` | the identifiers screen |
| `ui/JourneyScreens.kt` | journeys as screens, each firing its own events |
| `app/src/test/.../EventContractTest.kt` | unit tests that read the **website's** JS so app and site cannot drift |

And these documents:

| Document | Why |
|---|---|
| `banking/docs/ANDROID-APP.md` | the per-surface state of the banking app |
| `banking/docs/PROJECT-LOG.md` §5.19 to §5.26 | the debugging narrative for push, carousel, inbox and the badge, including the wrong turns |
| `banking/android-app/README.md` | how to build and run it, and the honest state section |

---

## 0.5 Three push directives to pin before you write any push code

These are pinned to SDK 6.0.96 and were confirmed with real campaign sends on
a handset on 2 August 2026. **Re-check each one on every SDK upgrade.**
Background on all three: ask Salil.

1. **Keep push delivery on exactly one receiver.** Override the four
   `Application.registerReceiver` overloads so that exactly one live receiver
   holds `com.dengage.push.intent.RECEIVE`: when a registration arrives with
   that action, unregister the previous receiver first. Copy
   `banking/android-app/.../MeridianApp.kt`, where the trigger is a single
   action string and it touches nothing else. Do not remove: required for
   correct behaviour with this SDK version.

2. **Render the CAROUSEL format in the app.** Build the carousel notification
   from the campaign payload, routed through the SDK's parsing, and report the
   open with `Dengage.sendOpenEvent`. The working implementation is
   `push/MeridianCarousel.kt`, guarded so every other format takes the
   standard path, §7.4.

3. **Demo the App Inbox with a real campaign send.** Only a real campaign send
   with save to inbox ticked files an inbox row; a panel Test Send does not.
   So the inbox and any unread badge are demoed with a real send, never a Test
   Send, §9.2.

---

## 1. Decide these before writing a line

Answer all of them up front. Every one was a mid-build interruption last time.

| Question | Banking's answer, as an example only |
|---|---|
| Package name, matching Firebase exactly | `com.dengagebanking.demo` |
| App name on the phone | Demo - Meridian Bank |
| Where the project lives | `<site>/android-app` |
| Scope | Mirror the website's logged-in portal, screen for screen |
| Which tables it writes | The site's own, all of them, every column |
| Which contact keys it recognises | Whatever `<site>/js/identity.js` maps |

**From the Dengage panel, before the first build:**

1. A **Firebase project** and its `google-services.json`, dropped into `app/`.
2. The **FCM service account key uploaded into the panel**. This is a real
   secret: it goes into the panel directly and **must never be committed or
   pasted into a chat**.
3. The **`firebaseIntegrationKey`** the panel issues for the app. This one is
   not a secret in the same way, it is sent from the device on every call, so it
   is fine checked in.
4. The **app id / guid** for the mobile app, which is separate from the web guid.

Do not go looking for encoding bugs in the integration key. The panel shows it
containing `_p_l_` and `_e_q_` and that is exactly what you send. A whole cycle
went into a theory that those were a broken escaping of `+` and `=`; a
screenshot of the panel killed it.

---

## 2. Project setup that compiles first time

Versions that are known to work together, as of August 2026:

```
AGP 8.7.3 · Kotlin 2.0.21 · compileSdk 35 · minSdk 24 · targetSdk 35
Java 17 · Compose BOM 2024.10.01 · google-services 4.4.2
com.github.dengage-tech.dengage-android-sdk:sdk:6.0.96          (JitPack)
com.github.dengage-tech.dengage-android-sdk:sdk-geofence:6.0.96 (separate artifact)
```

`sdk-geofence` is a **separate dependency**. `DengageGeofence` lives in
`com.dengage.geofence`, not in the main SDK package, and the class simply will
not resolve without it.

Add JitPack to `settings.gradle.kts` repositories, and the Google Services
plugin to both the root and the app build files.

**Four build failures that will happen otherwise**, all cheap to prevent:

- `android.useAndroidX=true` in `gradle.properties`. Missing it fails obscurely.
- The package name must contain a dot. `demo` alone is rejected.
- `buildFeatures { buildConfig = true }` if you reference `BuildConfig` at all.
- The activity hosting In-App must be an `AppCompatActivity`. A plain
  `ComponentActivity` crashes when the SDK inflates its message layout.

Android Studio on a Mac needs a **JDK 17 toolchain**; a machine defaulting to
JDK 25 fails the Gradle sync with an incompatibility dialog before anything
builds.

---

## 3. Initialisation, and the order that matters

```kotlin
class NovaPayApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // BEFORE init. This is what tells the SDK which screen is in front of
        // the user; register it after init and the first screen of the session
        // is invisible to In-App targeting.
        registerActivityLifecycleCallbacks(DengageLifecycleTracker())

        Dengage.init(
            context = applicationContext,
            firebaseIntegrationKey = DengageKeys.FIREBASE_INTEGRATION_KEY,
            deviceConfigurationPreference = DeviceConfigurationPreference.Google,
            disableOpenWebUrl = false
        )

        Dengage.setTrackingPermission(true)   // see below
        Dengage.setLogStatus(BuildConfig.DEBUG)
    }
}
```

**Set `setTrackingPermission(true)` explicitly.** Events and `sessionStart`
are sent only while tracking permission is on. It defaults on, but state it in
code anyway: a device with tracking off reports **zero sessions while its push
token looks perfectly healthy**, and nothing on screen distinguishes the two
states. One line makes that state impossible.

**Import paths, pinned for 6.0.96.** This app compiles against these packages;
re-check them on an SDK upgrade:

| Class | Package |
|---|---|
| `DeviceConfigurationPreference` | `com.dengage.sdk.data.remote.api` |
| `DengageLifecycleTracker` | `com.dengage.sdk.util` |
| `DengageGeofence` | `com.dengage.geofence`, separate artifact |

---

## 4. Identity: one person, not two

The app must resolve an email to the **same contact key the website uses**, from
`<site>/js/identity.js`. Sending the raw email creates a second contact for the
same human and quietly splits every segment and every journey.

```kotlin
private val KNOWN_CONTACTS = mapOf("someone@example.com" to "their-contact-key")
fun resolve(email: String) = KNOWN_CONTACTS[email.lowercase()] ?: email.lowercase()
```

**Write a unit test that reads the website's `identity.js` and fails if the two
maps drift.** Banking has one and it has already earned its place.

Call `setContactKey` at launch if a session exists, on login, and on logout.
Anonymous is a legitimate state: no contact key means the device is anonymous
and that is correct until someone signs in.

---

## 5. Login and screens

Mirror the website's portal screen for screen, and give every screen a **stable
screen name** in one `Screen` object. Those names are the entire targeting
surface for In-App, so they are a contract, not labels:

```kotlin
object Screen {
    const val SIGN_IN = "sign_in"
    const val OVERVIEW = "overview"
    // ... one per screen, plus inbox, events, identity, test
}
```

Every navigation calls `Dengage.setNavigation(activity, screenName)`. It takes
a plain `Activity`. **A screen that never reports itself can never be
targeted, and nothing on screen tells you so**, which is why the call belongs
in the navigation path itself, not in each screen's own code.

Include the sign-in screen in that list. A push that deep links into a gated
screen while the user is logged out has to land somewhere sensible.

---

## 6. Events: the part that looks like it is not working

### 6.1 Pace them, or DNS will kill you

The single most expensive bug of the banking build. Firing 86 events in ~100ms
produced:

```
HTTP FAILED: java.net.UnknownHostException: Unable to resolve host "event.dengage.com"
```

The **device resolver** was exhausted by simultaneous lookups. Nothing was wrong
with the SDK, the key or the payloads, and the failure looks exactly like a
server rejecting you.

Route every send through one background channel with a gap. This also fixes
dropped frames and the batch dying when the user navigates away mid-send:

```kotlin
private const val GAP_MS = 120L
private val queue = Channel<Triple<String, String, HashMap<String, Any>>>(Channel.UNLIMITED)
private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO).also { s ->
    s.launch {
        for ((table, eventType, payload) in queue) {
            try { Dengage.sendDeviceEvent(table, payload) } catch (e: Throwable) { /* log it */ }
            delay(GAP_MS)
        }
    }
}
```

Own the queue in a singleton, not in a screen, so navigation cannot cancel it.

### 6.2 Date formats, exactly

```
DATE      yyyy-MM-dd
DATETIME  yyyy-MM-dd HH:mm      no seconds, no T, no Z, no offset
```

Send exactly these formats: no ISO 8601, no `T`, no `Z`, no offset, no
seconds. Then confirm the stored value in Data Space under a marker contact
key.

### 6.3 Column names must match exactly

A row stores only the columns the table defines; a misspelled column stays
empty. Banking shipped `card_id`, `card_last_four` and `category_path` when
the real names were `card_id_masked`, `card_product` and `product_category`,
and the only symptom was a column that was always empty in Data Space.

**Take the column names from the website's event layer and assert them in a unit
test.** Do not retype them.

### 6.4 A 200 means accepted, not stored

A 200 from `POST /api/event` means accepted. **The only proof an event landed
is a row visible in Data Space**, fired under a marker contact key. Two
confident and wrong "it is working" claims came from skipping that step.

### 6.5 Never invent a value to fill a column

If the site does not track a figure, the app does not send one. Banking omits
`stock_count` entirely because a mortgage has no unit count, and a fabricated
number poisons every segment built on it. Watch `Number(null) === 0`, which has
produced that bug twice in this repository.

---

## 7. Push

### 7.1 The deep link can arrive two ways, so read both

A push deep link reaches your activity either as `intent.data` or as a
**string extra named `targetUrl`**. An app that reads only `intent.data` can
get nothing and open its launch screen.

```kotlin
val raw = intent.data?.toString()
    ?: intent.getStringExtra("targetUrl")
    ?: intent.getStringExtra("dn_target_url")
    ?: return null
```

Handle it in **both** `onCreate` and `onNewIntent`. Also read a `screen` custom
parameter first and let it win: a custom parameter is set per send, so one
campaign can point at different destinations without a template each.

### 7.2 Declare `launchMode="singleTask"`, or the deep link destroys your app

This cost several hours. With the default (`standard`) launch mode a deep link
does `LAUNCH_MULTIPLE`: Android builds a **second** instance of your activity
and destroys the first, and `onNewIntent` is never called. Anything in flight
at that moment lands in a composition that is already being torn down. The App
Inbox was the visible casualty, because its fetch completes a second after the
tap:

```
23:05:25.866  visibilityChanged oldVisibility=true newVisibility=false
23:05:25.869  Meridian inbox: 1 message(s)          <- lands in the dying activity
23:06:26.459  removeAppToken: ActivityRecord{... .MainActivity}
```

A comment in the code claimed it behaved like singleTop "in practice via
onNewIntent". It did not, and no test caught it because the manifest was never
checked against the claim. **Verify launch mode from the log, not the comment**:
a correct deep link reads `LAUNCH_SINGLE_TASK ... result code=3`.

### 7.3 Never swallow a message in your FCM service

Subclass the SDK's `FcmMessagingService`, observe what you need, then hand
**every** message to `super` unconditionally and let the SDK dispatch: it
routes Live Updates (`live_notification` in the data), geofence pushes
(`sourceType: geofence`) and standard notifications itself.

Do not filter on `messageSource`: required for correct behaviour with this SDK
version. Background: Salil. The banking app originally called `super` only for
`"DENGAGE"` and that cut off Live Updates and geofence pushes. `super` is safe
for foreign messages: it checks that a message is Dengage's before drawing
anything.

Register **only** your subclass in the manifest. Registering both gives the
device two services for one intent filter.

### 7.4 If you must intercept, make it fail safe

The one intercept in the banking app is the carousel, and it is guarded twice:

```kotlin
if (MeridianCarousel.handles(data) && MeridianCarousel.render(this, data)) return
super.onMessageReceived(remoteMessage)
```

`handles` returns false for a Live Update, for a geofence push, for anything
whose `notificationType` is not CAROUSEL, and for a carousel whose items do not
parse. `render` catches everything and returns false rather than throwing. So
the only way to reach the new path is a push the app can draw completely, and
every other format is byte for byte what it was.

**A host app rendering a notification itself must still report the open.**
Route the push payload through the SDK's own parsing and call
`Dengage.sendOpenEvent(buttonId, itemId, message)`, which is public, so opens
still land on the campaign. Skip that and the campaign reads zero opens and an
A/B test can never pick a winner.

### 7.5 A local push gallery is worth building, and is not a substitute for a send

The banking app has a Test Area gallery that constructs each notification
format locally and posts it through the SDK's notification pipeline. It is the
fastest way to check layout, arrows and deep links without waiting for a
campaign.

It also fooled us. A locally built payload carries `dengageCampId: 0` and never
reaches Dengage, so it **cannot** produce an inbox row, an open, or anything
server side, whatever its JSON says. Label those rows in the UI as local, and
when a format does not look right, **reproduce it with a real campaign send
before concluding anything**. Two wrong root causes were published before that
rule was adopted.

### 7.6 Live Update (the "live activity" surface)

`DengageLiveUpdateManager.register(activityType, handler)` must run in
`Application.onCreate`, **not** in an activity, because the push can arrive when
no activity exists. The activity type is a plain string you choose and the panel
must send the same one.

The push carries `live_notification`, which the SDK's `FcmMessagingService`
detects **before anything else** and routes to the manager. This is exactly
why §7.3 says to hand every message to `super` unconditionally: an FCM service
that filters on `messageSource` never lets this surface reach the manager.

Build a local player for it in the Test Area. `LiveUpdatePayload` and
`LiveUpdateEvent` are public, so the app can step START, UPDATE, END through the
handler and prove the rendering without a campaign. Say on the row that it is
local, per §7.5.

---

## 8. In-App: two conditions, not one

An In-App shows when the targeted screen is reported **and** the message is
already fetched onto the device. The SDK fetches on its own schedule, so a
message sent seconds ago is usually not there yet, and the test looks broken
when nothing is wrong.

Give the Test Area a **Refresh** button calling `Dengage.getInAppMessages()` and
show `Dengage.isInAppFetched()` beside it. Then the order that always works is:
send from the panel, refresh, report the target screen.

**Inline placements and App Stories** both need a **property id** from the
panel. Keep them as blank constants and render **nothing at all** while blank.
An empty frame in a demo reads as a bug; a missing section reads as a section
that was never there.

`showInlineInApp` in 6.0.96 takes
`(screenName, element, activity, customParams, propertyId, hideIfNotFound)`.

---

## 9. App Inbox: four separate reasons it can look empty

This surface took four rounds to get right. Work through the causes in this
order.

### 9.1 There are two mailboxes

The inbox is addressed per identity: a **contact inbox**, read when a contact
key is set, and a **device inbox**, used while the handset is anonymous. An
app that sets a contact key reads **contact mail only**. A panel test sent to
a **device id** lands in the device inbox, will never come back to a signed-in
app, and the request still answers an empty list, which looks identical to a
healthy empty inbox. Send inbox tests to the contact key, and print which mode
the handset is in.

The inbox callback takes a `MutableList`.

### 9.2 Only a real campaign send fills it

The inbox is **server side**. The row is written when the platform sends the
campaign, and the app reads that store back. Therefore:

| Send | Inbox row |
|---|---|
| Panel campaign send, save to inbox ticked | **yes** |
| Panel **Test Send** | **no**, a Test Send does not save to the inbox |
| Your own locally built push | **no**, Dengage was never told it happened |

Both negatives were mistaken for app bugs on this project. The tells in the payload
are `dengageCampId: 0`, `messageId: 0` and a `[TEST]` title prefix. Note also
that a custom parameter named `inbox` is **not** the inbox flag, which is an
easy thing to assume when the real flag is absent.

### 9.3 Seed the screen, or the demo opens on nothing

Because of 9.2, a brand new install shows an empty inbox until somebody has run
a campaign, and an empty screen sells nothing. Ship three of your own service
messages and append real campaign rows below them.

Three consequences follow from those rows being local, and all three bit:

- **Writes must take the row, not the id.** Passing a seeded id to
  `setInboxMessageAsClicked` is a request about a message the platform has never
  seen. Skip local rows, and only draw the read control on real ones.
- **An inbox error should still show the seeded rows.** On bad wifi an empty
  screen and a failed request look identical.
- **Clear all clears both halves and they are not equally reversible.** The
  seeds come back on next launch (keep the flag in memory only); a real campaign
  message is deleted on the platform and does not. Say so on screen.
  `deleteAllInboxMessages` returns Unit with no callback, so do **not** re-read
  immediately: you will race the delete and redraw the message you just deleted,
  which on stage reads as a broken button.

### 9.4 Nothing tells the customer a message arrived

The inbox re-reads on open or on Refresh, so a campaign can file a message and
the app shows no sign of it. Put an unread badge on the Inbox icon, driven from
**`addToInbox` in the push payload**, which is the platform saying it filed the
message. Then a real campaign moves the badge, a Test Send does not, and a
local push does not, which is correct in all three cases.

Keep the count in Compose state on the same object that loads the inbox, written
from the FCM service, which is not a composable. That is safe, and it is what
lets a push arriving on any screen move a badge that screen knows nothing about.
Clear it when the inbox is actually read, not on navigation.

### 9.5 Log the count that matches the screen

The diagnostic that finally solved this printed the number of rows **from
Dengage**. Once seeded rows existed, it read `0 message(s)` while three rows
were on screen, which reads as an inbox problem all over again. Log both numbers
and label each row by origin:

```
Meridian inbox: 0 from Dengage, 3 shown
Meridian inbox: seeded meridian-seed-1 Your July statement is ready
```

**When a screen and its data disagree, put the count on the screen.** A
diagnostic that only reaches logcat still needs somebody to go and read logcat.
That single string would have saved four rebuilds.

---

## 10. Tags attach to the device

Tags are stored on the **device record**, not on the contact, so they never
appear on the contact's Fields tab. Look at the device record, or segment on
the tag.

Send tags after the app has settled: the request goes out once the SDK has
fetched its configuration, a few seconds after a cold start. Then confirm the
result on the device record in the panel.

There is no `removeTag`. Setting a tag to an empty value clears it.

---

## 11. Geofence and recommendations

**Geofence.** Needs `sdk-geofence`, the location permissions, and a fence
**defined in the panel**. Put it behind a control rather than starting it at
launch: background location is the most intrusive permission an app can ask
for, and asking at first launch reads badly in a demo. Coarse and fine come
first, background is a second, separate grant.

**Recommendations are not part of this Android build.** This app compiles
against SDK 6.0.96, which exposes no recommendation API. Leave the surface out
rather than shipping a button that cannot work, and do not spend an evening
looking for it. Re-check on SDK upgrades. Background: ask Salil.

**Live Update does exist, and the banking app does not use it.** The opposite
case, and worth knowing before you scope: the SDK ships
`com.dengage.sdk.liveupdate` with `DengageLiveUpdateManager`,
`LiveUpdateHandler`, `LiveUpdatePayload` and a `START | UPDATE | END` enum, and
the `/liveActivity/*` REST endpoints are documented for Android as well as iOS.

On Android this is **the app drawing its own ongoing notification** from a
`contentState: Map<String,String>` the server sends, not an OS widget system
like Apple's ActivityKit:

```kotlin
DengageLiveUpdateManager.register(activityType, object : LiveUpdateHandler {
    override fun buildNotification(ctx, payload): Notification { /* yours */ }
    override fun onUpdate(ctx, payload) { /* re-notify */ }
    // + channelId, channelName, channelDescription
})
```

A payment or an application progressing on the lock screen demos extremely
well, and the app-side work is one handler registered at launch. The starts
and updates come from the REST endpoints, so they carry the same access-token
constraint as the transactional push discussed in §12. **Ask Dengage for the
Android Live Update guide** for the campaign-side setup.

---

## 12. Two screens every demo app needs

### The identifiers screen

Everything that identifies the app to Dengage, each individually copyable plus a
copy-all. Read them **from the SDK**, via `Dengage.getSubscription()`, so the
screen reports what the platform holds rather than what the app believes it
sent. Banking surfaces 19: contact key, device id, push token, token type,
advertising id, partner device id, integration key, the permissions, and the
last deep link received.

This screen is what turns "the push did not arrive" into an answerable question
in ten seconds. Build it early, not last.

### The Test Area

One button per capability, so anyone handed the APK can press and see the real
thing. **The shape is forced by one fact: an app cannot send itself a push.**
A push originates on Dengage's servers, and the only way for a button to produce
one directly would be to call the REST API with an account secret, which is a
secret published inside an APK. So the buttons split:

- **Server round trip.** The button fires a distinctly named event
  (`test_push_text`, `test_push_rich`, `test_inbox_message`, ...), something on
  the server side reacts to it, and the message comes back. Nothing secret on
  device. **Settle what that "something" is before you build the buttons**, see
  the warning below.
- **On device.** In-App, inbox reads, tags, geofence and deep links are SDK
  calls, so the button does the thing immediately.

Write the event name each campaign must listen for **on the button's own row**,
so the panel can be configured while looking at the phone. Keep the `test_*`
event types **out of** your real event catalogue: they are instrumentation, and
a parity test against the website should keep failing if they leak in.

> ### Warning: there is no real-time PUSH campaign
>
> In-App has a *Real Time* campaign type. **Push does not.** A push campaign is
> one-time or recurring, and both take a **segment**, which refreshes on a
> schedule of tens of minutes. So no push campaign can answer a button press,
> and "build a real-time campaign on the event" is wrong for push however
> natural it sounds after wiring In-App. That sentence shipped in the banking
> docs and had to be corrected.
>
> Two routes are worth evaluating, and **you should settle this before building
> the push buttons**, because it may change what they do:
>
> 1. **Automation flow triggered on the event, with a Fire Campaign action.** A
>    recurring campaign set to *Trigger Externally* is fired by automation, not
>    by a schedule, so no segment refresh is in the path. Needs no secret and no
>    infrastructure. **First confirm in the panel that a flow can trigger on a
>    custom Big Data table event**: everything rests on it.
> 2. **The Transactional Push API**,
>    `POST https://api.dengage.com/rest/transactional/push`. Purpose-built:
>    one push to one `contactKey` or `token` from a `contentId` template, sent
>    immediately, 30 req/s per IP. Proven working on the banking account.
>    **But the app cannot call it from a handset**, for two reasons found by
>    testing rather than reading:
>
>    - **The REST API is IP-allowlisted and blocks everything by default.** A
>      phone's public IP is carrier NAT and changes, so there is nothing to
>      list. Allowlisting `0.0.0.0/0` to work around it, combined with
>      credentials in a shareable APK, hands account-wide REST access to
>      anyone. Note that wrong credentials return the **same 403** as an
>      unlisted IP, so a 403 tells you nothing about your credentials.
>    - **Credentials are account-wide**, covering Dataspace, Contacts, Sends
>      and Settings, and an access token expires in 3600s so the APK would have
>      to carry the username and password.
>
>    Both are fixed at once by a **relay on a fixed IP** that holds the
>    credentials and gets allowlisted. That is the shape to plan for if you
>    want a button that sends a real push.
>
>    Also: **push content must be saved as transactional**, or the API returns
>    `404 "<id> content is null"`, which reads exactly like a wrong id. The flag
>    is `is_transactional_content`.
>
> Either way, the on-device half of the Test Area is unaffected and worth
> building first.

---

## 12.5 Compose traps, and the per-site journey test

### Data delivered by a callback needs a composition that reads it directly

The App Inbox drew nothing for three rounds while the log proved the rows
existed. The cause was a `LazyColumn`: it does not read the state list in the
composition that owns it, it reads it inside its own item provider, so whether
the screen redraws depends on that indirection rather than on your composable.

For a list that is short and bounded, use a plain `Column` with `forEach` inside
a `verticalScroll`. It reads the state list where recomposition is certain, and
laziness buys nothing under a few dozen rows. Keep `LazyColumn` for the genuinely
long lists (transactions, products).

Two more, both cheap:

- Hop SDK callbacks to the main thread once, in the bridge object, not at each
  call site. The callback arrives on whatever thread the request finished on.
- Never do network or disk work on the thread that a push handler runs on. A
  `NetworkOnMainThreadException` surfaces as a **null message** in the log, which
  reads as "no error" and wastes an hour.

### Ship a per-site journey test

The shared suites in `tools/verify/` know nothing about one site's own screens.
Each site that has real journeys should carry `<site>/tools/journeytest.js`,
which `tools/verify/push.sh` runs automatically. The banking one drives the five
public journeys and the ten card event panel and asserts, among other things,
that the portal makes **no** `ec:*` call and that every table written starts
with the site's prefix. Copy that shape: the assertions that matter are the ones
that would let a wrong table name reach production.

---

## 13. Verifying, and what you can honestly claim

The build container has no emulator (`/dev/kvm` is absent) and no phone. So:

**Provable in the container**

- it compiles against the real SDK, and `assembleDebug` produces an APK
- unit tests: table names, column names, date formats, contact-key parity, and
  catalogue parity against the website's own event layer

**Only provable on a handset, by whoever has one**

- push delivery and deep link routing, In-App rendering, inbox contents,
  geofence, and rows actually landing

Report the second group as *confirmed by the person who ran it*, never as
verified by you. Getting this wrong is how two false "it is working" claims got
made on this project.

**Probing technique that works:** verify where the result lives. The questions
that resolve almost everything: does a row exist in Data Space under the
marker key, what does the device record in the panel show, and what does the
identifiers screen on the handset report.

Add unit tests that read the **website's** files, so app and site cannot drift:

```kotlin
// reads ../../js/<site>Events.js and asserts the event catalogue matches
// reads ../../js/identity.js and asserts the contact-key map matches
```

---

## 14. Documentation the app must ship with

Two files, and keep them current as you go rather than at the end.

- **`README.md`**: what it is, how to open and run it on a Mac with no Android
  experience assumed, and an honest **state of it** section separating what is
  proven in the container from what was confirmed on a device.
- **`MOBILE-SURFACES.md`**: one section per Dengage surface, what is wired,
  what it needs from the panel, and the trap in it. Finish with **what is not
  wired** and **what is blocked on the panel**, so the gaps are as findable as
  the features.

Record what is blocked, on whom, in one place. If a property id is missing, that
belongs in writing, not in a chat message that scrolls away.

---

## 15. The checklist

Setup

- [ ] Firebase project, `google-services.json` in `app/`, service account key in the panel only
- [ ] Integration key checked in, service account key never committed
- [ ] JitPack repo, `sdk` + `sdk-geofence`, `useAndroidX`, `buildConfig`, AppCompat activity

Wiring

- [ ] `DengageLifecycleTracker` registered **before** `init`
- [ ] `setTrackingPermission(true)`, `setLogStatus(BuildConfig.DEBUG)`
- [ ] Contact key resolved through the website's map, asserted by a test
- [ ] Every screen has a stable name and calls `setNavigation`
- [ ] Every event goes through one paced queue
- [ ] Dates in `yyyy-MM-dd` and `yyyy-MM-dd HH:mm`
- [ ] Column names taken from the website and asserted by a test
- [ ] Deep links read `intent.data` **and** the `targetUrl` extra, in both entry points
- [ ] Silent push subclasses the SDK service; only the subclass is in the manifest
- [ ] Inline and Stories render nothing while their property ids are blank
- [ ] `android:launchMode="singleTask"` on the main activity, verified from a log line
- [ ] FCM service hands **every** message to `super`; any intercept is guarded and fails safe
- [ ] Live Update handler registered in `Application.onCreate`
- [ ] `Application.registerReceiver` overridden so exactly one live receiver holds `com.dengage.push.intent.RECEIVE`, §0.5
- [ ] Host-rendered notifications still call `Dengage.sendOpenEvent`
- [ ] Inbox seeded, writes skip local rows, Clear all says what does and does not come back
- [ ] Unread badge driven from `addToInbox`, cleared on read
- [ ] Callback-fed lists drawn in a plain `Column`, not a `LazyColumn`

Screens

- [ ] Identifiers screen, read from the SDK, copyable
- [ ] Test Area, one button per capability, event names on the rows

Closing

- [ ] Unit tests green, APK builds
- [ ] `README.md` and `MOBILE-SURFACES.md` current and honest
- [ ] Everything blocked is written down with whose move it is
- [ ] `<site>/tools/journeytest.js` exists and passes
- [ ] Every SDK-version directive from §0.5 is dated and flagged for a re-check on SDK upgrades

---

## 16. If you take three things

1. **Pin what you verified, and re-check the pins on every SDK upgrade.** The
   packages, signatures and directives in this playbook are pinned to 6.0.96
   and were verified on a real handset.
2. **Assume nothing landed until something you can see says it did.** Tracking
   left off, a mistyped column name, a screen that never reports itself: none
   of them draw an error on screen. The row in Data Space, the device record
   in the panel, and the identifiers screen are the proof.
3. **A 200 is not proof, and neither is my word.** Prove it with a row, and
   report who proved it.

And one more that cost this project a whole evening: **after two wrong root
causes, stop patching and run the experiment that settles the question.** The
carousel was patched twice (the arrows, then the artwork size) before anyone
sent a real campaign and watched what actually happened on the handset. That
single send was worth more than both patches.
