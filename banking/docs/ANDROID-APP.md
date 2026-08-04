# Meridian Bank Android app: the brief

> **Status: not started.** The website rebuild comes first, by decision. This
> file exists so nothing about the app has to be rediscovered later.

## Fixed decisions

| | |
|---|---|
| Package name | **`com.dengagebanking.demo`** |
| App key / guid | **Its own**, separate from the web guid `c8d2da44-b982-1925-9ad8-e7caddf0894a`, sitting in the **same BFSI account, 28**. |
| Language | Kotlin |
| Tables | The same nine `banking_*` tables as the website. The app writes `event_source = 'android'`; everything else is identical, so one contact key produces one journey across web and app. |
| Where it lives | A folder in this repository, alongside the site. |

## The authoritative reference

**<https://dev.dengage.com/reference/new-android-sdk->**

This is the **New Android SDK** page, not the older `new-android-sdk` (without
the trailing hyphen), which is the deprecated version. Read the new one.

Related pages, all confirmed to exist in `dev.dengage.com/llms.txt`:

- `reference/firebase-sdk-setup` , FCM setup
- `reference/huawei-sdk-setup` , HMS, only if a Huawei demo is ever needed
- `reference/tagging-mobilesdk` , tagging
- `reference/recommendation-ios-android-sdk` , recommendations
- `reference/inbox` , App Inbox
- `reference/silent-push`
- `docs/in-app` and `docs/creating-in-app-content` , In-App messaging, panel side

## What the SDK reference specifies

Captured 2026-07-31 so the shape of the work is known before starting.

**Dependency**, via JitPack:

```groovy
implementation 'com.github.dengage-tech.dengage-android-sdk:sdk:6.0.96'
```

Optional modules: `sdk-geofence`, `sdk-hms`.

**Initialisation**, in `Application.onCreate()`:

```kotlin
Dengage.init(
    context = applicationContext,
    firebaseIntegrationKey = "<from the Dengage panel>",
    deviceConfigurationPreference = DeviceConfigurationPreference.Google,
    disableOpenWebUrl = false
)
```

**Firebase**: complete the standard Android setup, put `google-services.json` in
the app directory, add the Google Services plugin to the root `build.gradle`,
and register `FcmMessagingService` inside `<application>` in the manifest.

**Identity**: `Dengage.setContactKey(contactKey = "...")` at launch, on login and
on logout.

**Events**:

- Custom tables: `Dengage.sendDeviceEvent("banking_product_events", data)` , the
  same call shape as the web SDK, so `js/bankingEvents.js` ports across almost
  directly.
- First-class: `pageView`, `addToCart`, `removeFromCart`, `viewCart`,
  `beginCheckout`, `order`, `cancelOrder`, `search`, `addToWishList`,
  `removeFromWishList`. **Only `pageView` is used on this brand**, for the same
  reason as the website: a mortgage is not a basket item.

**In-App messaging**: `Dengage.setNavigation(activity, screenName)` on every
screen change. No special permission required.

**App Inbox**: `getInboxMessages(limit, offset, callback)`,
`deleteInboxMessage(messageId)`, `setInboxMessageAsClicked(messageId)`.

**Permissions**: `POST_NOTIFICATIONS` on Android 13+, requested via
`Dengage.requestNotificationPermission(activity)`. `ACCESS_FINE_LOCATION` and
`ACCESS_BACKGROUND_LOCATION` only if geofence is demonstrated.

## As built: where each surface actually stands

Written after the 2 August device session.

| Surface | State | Note |
|---|---|---|
| Events, 86 types across nine tables | working | contract-tested against `banking/js/` |
| Page views and `setNavigation` | working | every screen reports itself |
| Push, RICH | working | real campaign send, open reported |
| Push, CAROUSEL | working | drawn by `push/MeridianCarousel.kt` from the campaign payload; opens report to the campaign. Do not remove: required for correct behaviour with this SDK version |
| Push, receiver lifecycle | working | `MeridianApp` keeps a single receiver registered. Do not remove: required for correct behaviour with this SDK version. Background: Salil |
| Deep links | working | `launchMode="singleTask"` is required, see the playbook §7.2 |
| Silent push | working | recorded as `inapp_shown` |
| Live Update | handler registered, local player in the Test Area | a real send is still unproven |
| In-App | working | needs the screen reported **and** the message already fetched |
| App Inbox | working | three seeded rows plus real campaign rows, Clear all, unread badge |
| In-App inline placement | wired, unconfirmed | seven ids in `DengageKeys.InlineProperty`, blocked on the panel |
| App Stories | wired, unconfirmed | three ids in `DengageKeys.StoryProperty`; stories arrive through the inline path with a story property id |
| Geofence | engine runs | no fences defined in the panel yet |

Two things that are true of the inbox:

- only a **real campaign send** with save to inbox ticked writes a row. A panel
  Test Send does not save to the inbox, and the app's own Test Area push never
  reaches Dengage at all
- the three seeded messages are local. Clear all removes them for the session
  and they return on the next launch; a real campaign message is deleted on the
  platform and does not return

---

## What has to come from Salil, and when

Nothing is needed until the build starts. At that point, three things, each of
which will get step-by-step instructions written for macOS with no Android
experience assumed:

1. A **Firebase project** and its `google-services.json`.
2. The **FCM service account key uploaded into the Dengage panel**, which is what
   allows Dengage to send to the app.
3. The **`firebaseIntegrationKey`** the panel issues for this app.

## Honest constraint

The build container has JDK 21 and Gradle but **no Android SDK and no
emulator**, and no device. So the project will be written complete and wired,
and will be **code-complete but unrun** until someone presses Run once. Push and
In-App cannot be verified from here at all, because they need Google Play
services on a real device. That will be stated plainly rather than described as
working.
