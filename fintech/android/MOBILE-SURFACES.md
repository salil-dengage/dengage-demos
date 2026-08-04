# NovaPay Android: one section per Dengage surface

What is wired, what it needs from the panel, and the trap in it. Ends with what
is **not** wired and what is **blocked**, so the gaps are as findable as the
features.

---

## 1. Initialisation

`NovaPayApp.onCreate`. The order matters:

```kotlin
registerActivityLifecycleCallbacks(DengageLifecycleTracker())   // BEFORE init
Dengage.init(context, firebaseIntegrationKey, deviceConfigurationPreference, disableOpenWebUrl)
Dengage.setTrackingPermission(true)
Dengage.setLogStatus(BuildConfig.DEBUG)
```

Register the lifecycle tracker **before** `init`: that is what reports the
first screen of the session to In-App targeting.

Keep `setTrackingPermission(true)`: it ensures events and `sessionStart` are
always recorded.

**Do not reorder or remove any of these lines: ask Salil.**

**Import paths this app compiles against:**

| Class | Package |
|---|---|
| `DeviceConfigurationPreference` | `com.dengage.sdk.data.remote.api` |
| `DengageLifecycleTracker` | `com.dengage.sdk.util` |
| `DengageGeofence` | `com.dengage.geofence`, a **separate artifact** |

Panel needs: nothing. Endpoints are manifest `meta-data`, Istanbul, in
`AndroidManifest.xml`.

---

## 2. Identity

`Identity.resolve(email)` maps through the same table as
`fintech/js/identity.js`, so `salil@dengage.com` becomes `salil-demo` on both
surfaces. `setContactKey` is called on sign-in and at launch when a session
exists.

**Trap.** Sending the raw email where a mapping exists creates a **second contact
for one human** and quietly splits every segment and journey. `ParityTest` reads
the website file and fails if the two maps drift.

Anonymous is a legitimate state. No contact key means the device is anonymous,
which is correct until somebody signs in.

Panel needs: nothing.

---

## 3. Events

Every event goes through `EventQueue`, one paced channel with a **120ms gap**,
owned by a singleton.

**Trap, the expensive one.** Firing a batch flat out exhausts the **device's**
DNS resolver and produces `UnknownHostException: Unable to resolve host
"event.dengage.com"`. Nothing is wrong with the SDK, the key or the payloads, and
it looks exactly like the server rejecting you.

**Trap.** Own the queue in a singleton. In a screen or a ViewModel, navigation
cancels the scope and the rest of the batch is silently lost.

**Trap.** `sendDeviceEvent(table, data, context)` takes a **Context**. The
2-argument form only works via Kotlin defaults.

**Contract.** Dates are `yyyy-MM-dd` and `yyyy-MM-dd HH:mm`. **No seconds, no T,
no Z, no offset.** Any other format leaves the column empty in Data Space, so
verify the stored row, not the request.

**Contract.** Column names must match the schema exactly: a mismatched column
stays empty in Data Space. Nothing here is retyped from the website:
`ParityTest` compares.

**Trap.** Never invent a value. There is no `stock_count` in this app: a card has
no unit count and a fabricated figure poisons every segment built on it. A test
scans every source file for it.

Tables, identical to the website's, distinguished by `event_source = "android"`:

```
fintech_onboarding_events   fintech_account_events    fintech_transaction_events
fintech_card_events         fintech_savings_events    fintech_investment_events
fintech_credit_events       fintech_product_events    fintech_support_events
fintech_engagement_events
```

Nine-column spine. Six written here (`event_type`, `event_source`, `page_path`,
`is_authenticated`, `customer_tier`, `app_version`), three written by the SDK
(`session_id`, `dn_contact_key`, `dn_device_id`) and never set by hand.
`page_path` carries the **screen name**, since an app has no URL.

### What actually writes them

The Test Area fires one sample row per table, which proves the plumbing. The
**five journey screens** write the shape a real customer leaves behind: several
rows in order under one shared reference, ending in a completion or in the exact
failure a campaign is meant to recover.

| Journey | Writes | Its branch |
|---|---|---|
| Send money | `transfer_sent`, with the FX columns filled | `transaction_failed`, `insufficient_funds` |
| Top up | `low_balance_detected` then `topup_completed` | `transaction_failed`, `limit_exceeded` |
| Verify identity | the KYC funnel, one row per step, with `step_index` | `kyc_abandoned`, naming the step reached |
| Apply for a plan | `product_viewed` through `application_approved`, one `application_id` | `application_abandoned`, with `abandon_step` |
| Raise a dispute | `card_payment_made`, then the case that names its `transaction_id` | `case_updated`, `awaiting_customer` |

The dispute journey writes **both sides** of the one fact-to-fact relation the
model defines, so the case joins to a transaction that exists rather than to an
id nothing carries.

**Some steps write nothing, and the screen says so.** A transfer has one event,
fired when the money moves; there is no `transfer_started`, deliberately. A row
in `fintech_transaction_events` is money that moved, and filling the table with
intentions makes every total, every fee sum and every has-transacted segment
wrong. The honest way to retarget an abandoned transfer is a page view or an
In-App impression, not a fabricated transaction.

**The Cards screen covers one whole table on its own.** `fintech_card_events`
declares fourteen event types and nine columns of its own, more than any other
table here, and all fourteen are reachable from the controls on that screen:
order, delivery, activation, freeze and unfreeze, PIN view and change,
contactless, spend limits, wallet, replacement, cancellation and virtual cards.
`CARD_EVENTS` in `Screens.kt` lists them, so the count shown on the screen is
derived rather than typed.

The screen seeds **two** cards, and the second one is the demonstration: it was
delivered and never activated. That is the state this table's talk track is
written around, `card_delivered` with no `card_activated` after three days being
the dormant-card push, and one permanently active card cannot show it.

One step deliberately writes nothing there too. Delivery moves `ordered` to
`printed` to `dispatched` to `delivered`, and the model has event types for the
last two only, so `printed` moves the state and says on screen that no row was
written. Inventing `card_printed` to fill the gap would put a value in the table
no segment could trust.

### The failure this table cannot show you, and the check that can

A row can be **accepted and still be wrong**. The event API takes whatever it is
handed and silently DROPS any column the table does not define, so a payload
with an invented column returns `200` and lands with that column empty. The same
is true of a controlled column filled with a word outside its vocabulary.

Both happened here, and a handset log on 3 August is what exposed them:

| Sent | Should have been |
|---|---|
| `card_id_masked`, `card_product`, `card_status` | `card_id`, `card_type`, `card_tier`, `action` |
| `kyc_status`, `topic` | no such columns; `status` and `category` carry it |
| `transaction_date` | no such column; the platform stamps its own time |
| `product_id` on an investment row | `instrument_id`, with `instrument_name` and `asset_class` |
| `amount` and `currency` on `pot_funded` | `current_amount`, the balance after |
| `channel = "app"` | `android` on an account row, `inapp` / `push` / `inbox` on engagement |
| `method = "passport"` | `doc_type = "passport"`; method is how they signed up |
| `status = "pending"` | `started`, `completed`, `failed` or `abandoned` |
| `complaint_raised` | `complaint_logged` |
| `interaction = "opened"` / `"granted"` / `"denied"` | `clicked` / `clicked` / `dismissed` |

Nothing caught any of it. `ParityTest` compares table names and the six spine
columns; `playbookcheck` greps for constructs. Neither reads a payload.

`node fintech/tools/eventtest.js` now does. It parses `EVENT-MODEL.md` itself,
so there is no second copy of the schema to drift from, and for every call site
in the app it checks the event type, every column, and every literal value in a
closed-vocabulary column. `push.sh` runs it automatically, because it globs
`<site>/tools/*test.js`.

Its one limit, stated rather than papered over: **only literal values can be
checked.** A value read from a variable is invisible to it.

Panel needs: the ten tables, which already exist for the website.

### Page views, the one standard table this app writes

Everything above goes to the purpose-built `fintech_*` tables, because a money
app has no cart, no basket total and no order, so the ecommerce tables could
only be filled with invented figures.

`pageView` is the deliberate exception. It is industry neutral, the website
already sends it from `js/pageView.js`, and it is what a "last seen" or a
browse-abandon journey reads without any custom table at all. It is also the
only place this app uses a first-class SDK action instead of `sendDeviceEvent`.

`Events.pageViewForScreen(screen)` fires from `MainActivity.report()`, so every
navigation reports twice and the two are different things:

| Call | What it is | Read by |
|---|---|---|
| `setNavigation` | targeting, which screen is in front of the customer | In-App campaigns |
| `pageView` | history, a row written for later | segments and journeys |

`page_type` mirrors the website's vocabulary one for one, so a segment written
on `page_type` covers both surfaces:

| Screen | `page_type` | Website page |
|---|---|---|
| `home` | `home` | `app.html` |
| `money` | `money` | `money.html` |
| `cards` | `cards` | `cards.html` |
| `grow` | `grow` | `grow.html` |
| `products` | `products` | `products.html` |
| `inbox` | `inbox` | none, app only |

The demo scaffolding (`sign_in`, `test`, `events`, `identity`) fires **no** page
view on purpose. Those screens are the control panel rather than the product, and
a page view from them would put rows in a customer's history that no customer
ever generated.

A product row on the Products screen also fires a product-level page view
carrying `product_id` and `category_path`, the same row the website writes when
somebody opens a product page.

**Contract.** No `price` and no `discounted_price`, ever. A NovaPay product is a
card, a plan or a portfolio: it has a monthly fee or a rate, not a shelf price,
and the catalogue carries no such figure. Sending `0` to fill the column would be
a fabricated value in every segment built on it.

The SDK sends this one itself, so it does **not** go through `EventQueue`. It is
recorded in the queue's log afterwards, so the Events screen shows it beside the
custom rows, badged `SENT BY THE SDK` rather than passed off as a queued row.

### The Events screen shows where each row has got to

The queue's log used to be written at the moment a row was enqueued and never
touched again, so a batch of ten read as ten completed sends while nine were
still waiting behind the 120ms gap. The pacing is the most surprising thing this
app does and the screen could not show it.

Each row now carries `QUEUED`, `HANDED OVER` or `FAILED` and moves as it moves,
and rows group by table with a filter chip each. **`HANDED OVER` means the SDK
call returned without throwing, which is not the same as stored**, and the screen
says so: a `200` is acceptance, the row in Data Space is the proof. Every row
copies as JSON for exactly that comparison.

The six spine columns are listed under their own heading rather than inline,
because they are identical on every row and they buried the two or three columns
that differ. The three the SDK owns are absent and their absence is correct: they
go in the envelope, not the payload, so the app never sees the values it did not
write. The IDs screen reads them back off the SDK.

---

## 4. Screens and In-App targeting

`Screen` holds every name. `Dengage.setNavigation(activity, name)` runs on every
navigation.

**Trap.** These names are the **entire** targeting surface for In-App, so they
are a contract, not labels. A screen that never reports itself can never be
targeted.

**Trap.** `setNavigation` takes a plain `Activity`.

Fifteen names, in three groups:

| Group | Names |
|---|---|
| The portal, one per website page | `home`, `money`, `cards`, `grow`, `products` |
| The journeys | `send_money`, `top_up`, `verify`, `apply`, `dispute` |
| Everything else | `sign_in`, `inbox`, `events`, `identity`, `test` |

Plus the thirteen `test_inapp_*` names in `inapp/NovaPayInApp.kt`, which are
reported on demand from the Test Area rather than by navigating.

**The journeys are screens in their own right, and that is the reason they
exist.** A customer halfway through a transfer, or stuck on a document upload,
is only reachable by an In-App if that moment reports itself. Folding them into
`money` and `products` would have made those two moments untargetable.

Panel needs: the screen names, when building an In-App campaign.

---

## 5. Push

Standard FCM.

**Where the deep link arrives.** The destination arrives as `intent.data` or as
a **string extra named `targetUrl`**. `MainActivity` reads `intent.data`, then
`targetUrl`, then `dn_target_url`, in **both** `onCreate` and `onNewIntent`.
Do not remove any of those reads: required for correct behaviour with this SDK
version. Background: ask Salil.

**Trap.** Subclass `FcmMessagingService`, never replace it, and register **only**
the subclass in the manifest. Registering both gives the device two services for
one intent filter.

Panel needs: the **FCM service account key uploaded**. Without it, nothing
delivers. It is a real secret: panel only.

### Deep link route table, for campaign authors

| URL | Screen |
|---|---|
| `novapay://home` | portal home |
| `novapay://money` | money |
| `novapay://cards` | cards |
| `novapay://grow` | savings and investing |
| `novapay://products` | products |
| `novapay://inbox` | app inbox |
| `novapay://events` | events sent this session |
| `novapay://identity` | identifiers |
| `novapay://test` | test area |
| `novapay://sign_in` | sign-in |
| `novapay://send_money` | the send money journey |
| `novapay://top_up` | the top up journey |
| `novapay://verify` | the identity check journey |
| `novapay://apply` | the plan application journey |
| `novapay://dispute` | the dispute journey |

### The gallery, and what it is worth

`push/NovaPayPushGallery.kt` assembles thirteen payloads on the device and hands
each to the **SDK's own receiving path**, so the parsing, the target URL
resolution, the custom parameters, the expiry and the drawing are all the SDK's.
Only the transport is skipped.

Which is exactly why it proves rendering and app handling and **nothing about
delivery**. Nothing reached the platform, so no gallery row can produce an inbox
copy, an open or a campaign statistic. The three personalisation rows print the
resolved output next to the tag to paste into a panel campaign, with a copy
control, so one real send closes the gap.

Artwork is at `fintech/images/push/*.png`, generated by `tools/assets/pushart.js`
and committed. **PNG rather than SVG**: a notification image is decoded by
`BitmapFactory`, which does not read SVG, and the failure is a silently blank
expanded view.

A link into a gated screen while signed out lands on sign-in, which is why
`sign_in` is in the list at all.

---

## 6. In-App

**Trap, three conditions not one, and none of them reports an error.**

1. **The targeted screen is reported.** A campaign aimed at a screen name the
   app never sends is silently dark.
2. **The message is already FETCHED onto the device.** The SDK fetches on its
   own schedule, so a campaign saved seconds ago is usually not on the handset
   yet. That is the fetch schedule at work, not a problem.
3. **Delivery Control has not already spent it.** Trigger > Delivery Limit caps
   how often one visitor sees one campaign, and the default carries a total
   count plus a "once in every N minutes" window. Both are held against the
   visitor on the platform, so **force stopping the app resets neither**. A
   message that appeared once and then stops on repeated relaunches is almost
   always this. Widen the window while rehearsing and set it back before the
   call.

The order that always works: **send from the panel, press Refresh in the Test
Area, then open the target screen.**

Thirteen layouts, one row each in the Test Area, catalogued in
`inapp/NovaPayInApp.kt` with the content to paste in
`../panel-content/mobile/`. There is nothing per layout in this app and there
does not need to be: an In-App is HTML plus a position, so modal, banner, NPS,
survey and spin to win are one mechanism with different content.

Read the fetch state through `DengageCompat.isInAppFetched()`: required for
correct behaviour with this SDK version. Background: ask Salil.

The SDK's In-App layout requires an `AppCompatActivity` host. The host activity
here is one; do not change it.

### Reading the fetch in logcat, and the one response that means "never configured"

The device asks for its manifest at
`tr-inapp.lib.dengage.com/<account>/<appId>/v2/campaign.json`, and the answer
tells you which problem you have.

| Response | What it means |
|---|---|
| `200 []` | the object exists and is empty. No campaign is live for this app right now. Normal. |
| `200 [ ... ]` | campaigns fetched. If nothing shows, it is the screen name or Delivery Control. |
| `404 NoSuchKey` | the object has **never been written**. No In-App campaign has ever been saved against this application, so there is nothing to generate it. |

The 404 is the one worth knowing, because it looks like a broken endpoint and is
not: the SDK then retries the pre-`v2` path and gets the same 404, which reads
like two failures. Observed on 3 August against the NovaPay app while Meridian,
on the same account, returned `200 []`. Save one campaign for the application
and the key appears.

### One manifest entry left unfilled, deliberately

SDK 6.0.96 also reads `fetch_real_time_in_app_api_url` from the manifest
metadata; this manifest declares the four `den_*_api_url` entries and leaves
that fifth one out. **The correct Istanbul value is not known here and has
deliberately not been guessed:** a missing entry falls back safely, a wrong
one would not.

The real-time path works without it: the account reports
`realTimeInAppEnabled: true`, and the foreground call to
`tr-push.dengage.com/realtime-inapp/event` returns 200, so real-time In-App
is reaching the platform. Get the value from the SDK reference or from Salil
before adding it.

Panel needs: an In-App campaign targeting a screen name.

---

## 7. App Inbox

**There are two mailboxes.** The inbox is per identity: with a contact key set,
the handset reads the **contact inbox**; without one, it reads the **device
inbox**. A message addressed to the other identity does not appear.

**Send inbox tests to the contact key.** The Inbox screen prints which mode the
handset is in.

The callback takes a `MutableList`.

**Trap.** The inbox is fetched on open, not pushed. Loading before the message
exists returns empty and stays empty until loaded again.

Panel needs: an inbox message sent to the **contact key**.

---

## 8. Tags

`Dengage.setTags(listOf(TagItem(tag, value)), context)`.

**Trap.** Tags attach to the **device**, not the contact. There is no contact key
in the request, so they never appear on the contact's Fields tab. Look at the
device record, or segment on the tag.

Send tags after the app has settled: the request goes out once the SDK has
fetched its configuration, a few seconds after a cold start. Then confirm the
result on the device record in the panel.

There is no `removeTag`. Setting a tag to an empty value clears it.

---

## 9. Device context, for rules events cannot express

Four SDK setters that are neither events nor tags, all on the Test Area screen.
They are the difference between a targeting rule that can be written and one
that cannot.

| Call | What it does | Why it matters |
|---|---|---|
| `setCountry`, `setState`, `setCity` | geography on the device record | a geographic segment with **no location permission at all** |
| `setInAppDeviceInfo(k, v)` | arbitrary key/value an In-App display rule can read | gate a real-time message on something the app knows and the server has not been told yet |
| `getInAppDeviceInfo` / `clearInAppDeviceInfo` | read back and reset | the Test Area prints the current contents |
| `setCategoryPath` | the customer's current category | an In-App rule can match it without waiting for a page view to land |

Geography answers "where does this handset live". Geofence answers "is it inside
that circle right now". They are different questions and both are wired.

**Notification permission is reported back.** `MainActivity` calls
`Dengage.setUserPermission(granted)` after the Android 13 prompt, on every launch
where permission is already held, and unconditionally below Android 13 where
notifications are granted at install. Without it the platform still believes the
device can be notified, so a "push reachable" segment counts handsets that will
never show a notification. The answer is also written as
`push_permission_granted` or `push_permission_denied` to
`fintech_engagement_events`, so a journey can fall back to another channel for
exactly those customers.

---

## In-App inline placements

**The app names these, the panel does not issue them.** `showInlineInApp` takes
a `propertyId` as a plain string this app chooses, and a Real Time In-App inline
campaign targets that string. They are a contract the app publishes, exactly
like the `dn_inline_target_*` ids on the website, and they are named to mirror
the web vocabulary so a marketer sees the same words on both surfaces.

A placement is the pair **(screen name, property id)**, so the same id on a
different screen is a different placement.

### Three things a placement can do

A placement is not a blank area waiting to be filled. Campaign content can be
**inserted above** a piece of the app, **inserted below** it, or **replace** it
outright, and the five placements are chosen to show all three rather than five
variations of one.

**Nothing in the SDK call distinguishes them.** `showInlineInApp` is identical
in every case. The app decides, by where it mounts the element, and for a
replacement by drawing its own card only while the element is empty. That is
worth saying out loud on a call, because the question it answers is "how much
of this needs an app release", and the answer is: the placement does, the
relationship does not.

| Property id | Screen | Does |
|---|---|---|
| `novapay_home_below_balance` | `home` | inserts **below** the balance card |
| `novapay_money_top` | `money` | inserts **above** the transaction list |
| `novapay_money_subscriptions` | `money` | inserts **below** the transaction list |
| `novapay_grow_goals` | `grow` | **replaces** the investing card |
| `novapay_products_end` | `products` | inserts **after** the product list |

`novapay_grow_goals` is the one to demonstrate. The app's own investing card is
the fallback: it is what a customer sees while no campaign targets the
placement, and the moment one does the campaign content stands in its place
instead of appearing beside it. A marketer swaps a generic house card for a
targeted offer without an app release.

### An empty placement is visible, on purpose

`hideIfNotFound` is true, so a slot with no campaign behind it takes no height.
That used to mean it rendered nothing whatsoever, which made the surface
impossible to point at: a prospect had to take on faith that there was a slot
under the balance card.

An empty placement now draws a **dashed marker** naming its property id and the
relationship a campaign there would have. A filled one never draws it, so the
marker is exactly what an empty slot looks like and never overlaps real content.

Markers are a demo affordance rather than product behaviour. **Test Area >
Placement markers** turns them off process-wide, which is what to do once real
campaigns are running or when showing the app as a customer would see it.

They are listed and individually copyable in the Test Area, so the panel can be
configured while looking at the phone.

## App Stories placements

**Stories works exactly the same way, and this document used to say otherwise.**
It described a Story property id as something the panel had to issue, which was
the same mistake the inline placements had already been corrected for, and it
had the same cost: with a blank id there was nothing for a Story campaign to
target, so none could be built. `showStoriesList` takes `storyPropertyId` as a
plain string argument exactly as `showInlineInApp` takes `propertyId`, and
nothing in the call reads an id back from the platform.

So the app declares these too, in `ui/Surfaces.kt`, `StoryPlacements`:

| Property id | Screen | Sits |
|---|---|---|
| `novapay_stories_home` | `home` | under the balance card |
| `novapay_stories_grow` | `grow` | above the savings goals |
| `novapay_stories_products` | `products` | at the head of the products |

All three rails are mounted and live. Each takes no height of its own until a
Story set targets its pair, because `hideIfNotFound` is true, and while empty it
draws the same dashed marker the inline placements do, for the same reason and
under the same Test Area toggle. Frame copy and artwork are in
`fintech/panel-content/mobile/README.md` §3.

A rail is always an insertion: a Story set appears above whatever follows it and
pushes the rest of the screen down. Replacement is an inline behaviour, because
it needs a piece of app content to stand in for.

## Live Update

An ongoing notification the **app** draws from a map the server sends. On
Android this is not an OS widget system like Apple's ActivityKit: the platform
pushes `live_notification`, the SDK routes it to `DengageLiveUpdateManager`, and
everything on screen comes from `NovaPayLiveUpdate.buildNotification`.

`NovaPayFcmService` observes what it needs, then hands **every** message to
`super` unconditionally and lets the SDK dispatch. Do not filter on
`messageSource`: required for correct behaviour with this SDK version.
Background: ask Salil.

**App side, done.** The handler is registered for its `activityType` in
`Application.onCreate`, which is required rather than stylistic: the push can
arrive when no activity exists.

| Setting | Value |
|---|---|
| `activityType` the panel must send | `novapay_transfer` |
| Notification channel | `novapay_live_update`, "Payments in progress" |

**The keys this app reads**, sent flat at the top level of `androidPayload`:

| Key | Meaning |
|---|---|
| `title` | headline, defaults to "Transfer in progress" |
| `status` | line under the title |
| `amount` | shown after the status |
| `recipient` | shown as "to <name>" |
| `progress` | 0 to 100, drives the bar. Omitted on END |

A key the panel does not send falls back rather than crashing, so a partial map
degrades cleanly.

### Driving it from the server

Three REST endpoints, all `POST` to `https://api.dengage.com/rest/` with
`Authorization: {access_token}`:

| Endpoint | Body |
|---|---|
| `liveActivity/start` | `activityType`, `appGuids`, one of `contactKeys` / `deviceIds` / `segmentGuid`, and `androidPayload`. `activityId` optional, generated if omitted |
| `liveActivity/update` | `activityId` **required**, plus `androidPayload` |
| `liveActivity/end` | `activityId` |

**iOS and Android differ in payload shape and it is easy to get wrong.** iOS
nests under `iosPayload.contentState`; **Android is a flat dynamic object, keys
at the top level of `androidPayload`**. Send the Android keys nested under a
`contentState` and they arrive as nothing.

```json
{
  "activityType": "novapay_transfer",
  "appGuids": ["2408eae9-7b9c-5b95-e8a7-6809aa97d62c"],
  "contactKeys": ["salil-demo"],
  "androidPayload": {
    "title": "Sending money",
    "status": "On its way",
    "amount": "$120.00",
    "recipient": "Sam Whitfield",
    "progress": "65"
  }
}
```

Note `activityId` is **blocked for 13 hours after use**, so a demo that re-runs
should let the platform generate one rather than reusing a fixed string.

The same access-token constraint as the rest of the REST API applies: it is
IP-allowlisted and the credentials are account-wide, so this is driven from a
laptop or a relay, never from the handset.

### The local player

The Test Area steps START, UPDATE and END through the handler directly. It is
labelled LOCAL on screen because it **never reaches Dengage**: it proves the
drawing and nothing else, no campaign statistics and no server state. A local
payload that looks right has caused wrong conclusions on this project before.

## Behaviours this app handles itself

Two behaviours are implemented in the app because they are required for correct
behaviour with this SDK version. Both are dated **2 August 2026**: re-check
whether each is still needed whenever the SDK version changes. Background: ask
Salil.

- **Push receiver registration.** `NovaPayApp` overrides all four
  `registerReceiver` overloads and supersedes the previous receiver when the
  filter carries `com.dengage.push.intent.RECEIVE`, so exactly one receiver is
  live at a time.
- **Carousel rendering.** `NovaPayCarousel` draws carousel pushes with
  `RemoteViews`, pages with Back and Next, and deep links per card. The FCM
  intercept is guarded twice and falls through untouched if drawing fails, so a
  Live Update or a geofence push always reaches the SDK.

One plain fact for demoing the inbox: a panel Test Send does not save to the
inbox; a real campaign send with save to inbox ticked does. This is stated on
the Inbox screen so it never has to be rediscovered.

## What is not wired, and why each is a decision rather than a gap

- **Recommendations.** Not offered by the Android SDK; the web demo shows the
  recommendation widgets instead. The Test Area says so on screen rather than
  shipping a button that cannot work.
- **A button that sends a real push.** There is no real-time push campaign type,
  so nothing currently answers the `test_push_*` events. The two routes are an
  Automation flow triggered on the event with a Fire Campaign action, or the
  Transactional Push API behind a relay on a fixed IP. Undecided, and the Test
  Area says so rather than implying a campaign will reply.

## What IS wired and needs only the panel

- **In-App, all thirteen layouts.** Every screen name is reported and every
  creative is written. It needs a campaign per layout, which is the whole
  setup: Trigger > Where to Show > Specific Screens.
- **Inline placements, all five.** App-declared ids, mounted, collapsing until
  a campaign targets them.
- **App Stories, all three rails.** Same arrangement, same collapse. It needs a
  Story set built against one of the ids.
- **Geofence.** `sdk-geofence` is in, the permissions are declared, and the Test
  Area has grant, start and stop behind an explicit control rather than at
  launch. It needs a **fence defined in the panel**: without one there is
  nothing to match against, so starting the service succeeds and nothing
  happens.
- **Notifications.** `POST_NOTIFICATIONS` is asked at launch on Android 13 and
  up. The runtime grant is what lets notifications appear on the phone, so the
  manifest declaration alone is not the whole story.

## What is blocked, and on whom

| Item | Whose move | Effect until then |
|---|---|---|
| FCM service account key uploaded to the panel | Salil | push cannot deliver at all, however healthy the token looks |
| A **Story set** built against one of the app's three story property ids | campaign author | the rails collapse; nothing is blocked in the app |
| How a button press produces a **real push** | decision needed | the push rows in the Test Area fire an event; nothing answers it yet. There is no real-time push campaign type, so the routes are an Automation flow with Fire Campaign, or the Transactional Push API behind a relay on a fixed IP |

