# NovaPay Android demo: setting up your Mac from nothing

> ## THE canonical Android SDK reference
>
> **https://dev.dengage.com/reference/new-android-sdk**
>
> Read it before writing or changing a line of the app. It supersedes the older
> implementing-the-sdk reference pages: use this one.
>
> What that page establishes, current as of 31 July 2026:
>
> | | |
> |---|---|
> | Dependency | `implementation 'com.github.dengage-tech:dengage-android-sdk:6.0.96'` |
> | Repository | JitPack, implied by the `com.github` group id |
> | Init | `Dengage.init(context, firebaseIntegrationKey, huaweiIntegrationKey, firebaseApp, dengageHmsManager, deviceId, deviceConfigurationPreference, contactKey, partnerDeviceId, disableOpenWebUrl, notificationDisplayPriorityConfiguration)` |
> | Lifecycle | `registerActivityLifecycleCallbacks(DengageLifecycleTracker())` is required |
> | Contact key | `setContactKey(contactKey: String?)` |
> | Page view | `pageView(data: HashMap<String, Any>)` |
> | Custom event | `sendCustomEvent(tableName: String, key: String, data: HashMap)` |
> | In-app | `setNavigation(activity: Activity, screenName: String?)` |
> | App inbox | `getInboxMessages(limit: Int, offset: Int, callback)` |
> | Manifest | four `den_*_api_url` meta-data entries, the Firebase messaging service, and a custom `PushNotificationReceiver` |
>
> `sendCustomEvent(tableName, ...)` is the important one: the app writes the
> **same** Big Data tables as the website, distinguished by
> `event_source = "android"`, so one segment covers both. See
> `fintech/EVENT-MODEL.md`.

> Written for someone who has never built a mobile app. Every step is spelled
> out, including the ones that look obvious. Follow it top to bottom.
>
> Budget about 90 minutes, most of which is downloading. Android Studio and its
> SDK come to roughly 12 GB, so start the download before you read the rest.
>
> **Nothing here needs a paid account.** Android development is free, and unlike
> iOS you do not need a developer programme membership to run an app on a real
> device.

---

## What you are installing, and why each piece exists

| Piece | What it is | Why you need it |
|---|---|---|
| **Android Studio** | The IDE, like VS Code but for Android | It is also the installer for everything below, which is why we do not install them separately |
| **JDK** | Java runtime | Android apps compile to Java bytecode. Android Studio bundles its own, so you do not manage this |
| **Android SDK** | The Android platform libraries | What your app compiles against |
| **Emulator + system image** | A simulated phone on your Mac | So you can demo without a physical Android device |
| **Gradle** | The build tool | Downloads the Dengage SDK and assembles the app. Android Studio runs it for you |
| **Firebase project** | Google's push infrastructure | Android push **only** works through Firebase Cloud Messaging. Dengage sends to Google, Google sends to the phone |

The one thing that is genuinely not optional: **push notifications on Android
require Firebase.** There is no way around it and it is not a Dengage
limitation. Google owns the delivery path.

---

## Part 1: Android Studio

### 1.1 Check which Mac you have

Apple menu > About This Mac. Look at the **Chip** line.

- Says "Apple M1/M2/M3/M4" → **Apple Silicon**
- Says "Intel" → **Intel**

You need this on the next step, and picking wrong means the emulator either
will not start or will run at about a tenth of the speed.

### 1.2 Download

Go to **https://developer.android.com/studio**

Click the big download button. It offers "Mac with Apple chip" or
"Mac with Intel chip". Pick the one matching step 1.1. Accept the terms.

The file is around 1.2 GB and lands in `~/Downloads` as a `.dmg`.

### 1.3 Install

1. Double-click the `.dmg`.
2. A window opens with the Android Studio icon and an Applications folder.
   Drag the icon onto the Applications folder.
3. Wait for the copy to finish, then eject the disk image (drag it to the Bin,
   or right-click > Eject).
4. Open **Applications** and double-click **Android Studio**.
5. macOS will say it was downloaded from the internet. Click **Open**.

### 1.4 First-run wizard

1. "Import Android Studio Settings" → choose **Do not import settings**.
2. It asks about sending usage statistics. Either answer is fine.
3. Setup Wizard → **Next**.
4. Install Type → choose **Standard**. Do not choose Custom; Standard installs
   exactly what this project needs.
5. It shows a licence agreement with several items in a list on the left.
   **You have to accept each one individually**: click each item, then select
   **Accept** on the right. The Finish button stays greyed out until all of them
   are accepted. This trips up almost everyone.
6. Click **Finish** and let it download. This is the ~10 GB part. It takes 20 to
   60 minutes depending on your connection.

### 1.5 Confirm it worked

When it finishes you land on the Android Studio welcome screen.

Click the **three-dot menu** (or "More Actions") > **SDK Manager**. You should
see at least one Android version with "Installed" next to it. If you do, Part 1
is done.

---

## Part 2: Create the emulator

This is the simulated phone you will demo on.

1. From the welcome screen: three-dot menu > **Virtual Device Manager**.
2. Click **+** (or "Create Virtual Device").
3. Category **Phone**, pick **Pixel 8**. Click **Next**.
4. System image: pick the one with the **highest API level** offered, currently
   API 35 or 36. Click the **download arrow** next to its name and wait.
   - On Apple Silicon make sure the ABI column says **arm64-v8a**.
   - On Intel it should say **x86_64**.
   - Choosing the wrong one gives you an emulator that crawls or refuses to
     boot.
5. Click **Next**, then **Finish**.
6. Back in the device list, click the **play triangle** next to your new device.

A phone appears on your screen and boots. First boot takes a few minutes;
afterwards it is quick. Leave it running while you work.

**If the emulator will not start**, the usual cause is the wrong ABI in step 4.
Delete the device and recreate it with the right one.

---

## Part 3: Firebase, for push notifications

Free, and takes about ten minutes.

### 3.1 Create the project

1. Go to **https://console.firebase.google.com** and sign in with a Google
   account. A personal Gmail is fine for a demo.
2. Click **Create a project**.
3. Name it `novapay-demo`. Click **Continue**.
4. Google Analytics: **turn it off**. We do not need it and it adds a
   configuration step. Click **Create project**.
5. Wait, then click **Continue**.

### 3.2 Register the Android app

1. On the project overview page, click the **Android icon** (a small robot)
   under "Get started by adding Firebase to your app".
2. **Android package name**: type exactly

   ```
   com.dengagefintech.demo
   ```

   This must match the app's code character for character, and it must match the
   **Alias** field on the Dengage application (Part 4.1). Three places have to
   agree: Firebase, Dengage and the app's own build file.
3. **App nickname**: `NovaPay Demo`. Optional.
4. **Debug signing certificate SHA-1**: leave blank. Only needed for Google
   Sign-In and Dynamic Links, neither of which we use.
5. Click **Register app**.

### 3.3 Download google-services.json

1. The next screen offers **google-services.json**. Download it.
2. It goes to `~/Downloads`. **Keep it there for now**, I will tell you exactly
   where to put it when the project exists.
3. Click **Next**, **Next**, then **Continue to console**. Skip the code
   snippets it shows; those are for people wiring Firebase by hand and I will
   have done that part.

**Is this file secret?** No. `google-services.json` is client configuration and
ships inside every copy of the app, so it is safe to commit to the repository.
The file in Part 3.4 is the opposite and must never be committed.

### 3.4 The service account JSON, which is what Dengage uploads

This is the one part where Firebase and Dengage meet.

Google **retired the legacy FCM "server key" in June 2024**, so a Firebase
project created today only offers the V1 API, which authenticates with a
**service account JSON file**. The Dengage panel matches this: its Push
Notifications section asks for **Cloud Messaging Credentials** as a **file
upload**, not a key string. Confirmed from the panel on 31 July 2026.

**Getting the file:**

1. In the Firebase console, click the **gear icon** next to "Project Overview"
   at the top left, then **Project settings**.
2. Open the **Service accounts** tab (along the top, after General, Cloud
   Messaging, Integrations).
3. The panel shows "Firebase Admin SDK" and a button
   **Generate new private key**. Click it.
4. A warning dialog appears saying the key grants admin access. Click
   **Generate key**.
5. A `.json` file downloads immediately, named something like
   `novapay-demo-firebase-adminsdk-a1b2c-1234567890.json`. That is the file.

**This one is a real secret.** It grants send access to your Firebase project
to anyone holding it.

- Do not commit it to the repository.
- Do not paste it into chat or a ticket.
- Upload it only into the Dengage panel, Part 4.
- If it ever leaks, return to this screen and generate a new one; the old key
  can be revoked from the Google Cloud console.

It is a different file from `google-services.json` in step 3.3, which is client
configuration and safe to commit. If you get them the wrong way round, the app
will not build and the panel will reject the upload, so the mistake is loud.

---

## Part 4: The Dengage side, section by section

The application is `DND - FinTech Demo`, public ID
`2408eae9-7b9c-5b95-e8a7-6809aa97d62c`, on the **Istanbul** datacenter
(`app.dengage.com`), same BFSI account 28 as the five web demos.

Here is what to put in each section of the panel's application screen, and why.

### 4.1 GENERAL

| Field | Value | Notes |
|---|---|---|
| Active | on | |
| Name | `DND - FinTech Demo` | free text, appears in campaign pickers |
| Icon/Badge URL | leave blank | must be https and jpeg/jpg/png. Optional, and we have no hosted logo yet. It sets the small badge on a push notification, so worth filling in later |
| **Alias** | `com.dengagefintech.demo` | **required.** The panel says it is for Social Ad campaigns and must be the package name. Make it identical to the app's package name or the two will not line up |

### 4.2 PUSH NOTIFICATIONS

| Field | Value | Notes |
|---|---|---|
| Enabled | on | |
| **Cloud Messaging Credentials** | upload the service account JSON from Part 3.4 | This is the file upload, which confirms the panel wants the V1 service account and not a legacy server key |
| Uninstall Tracking | **tick it** | free to enable and gives a genuinely good demo moment: a segment of people who removed the app |
| **App Inbox Enabled** | **tick it** | off by default. The SDK's `getInboxMessages()` returns nothing unless this is on, so tick it before demoing the inbox screen |

### 4.3 IN-APP MESSAGING

Enabled: on. Then **change both defaults**, because they are tuned for
production and will make a live demo look dead:

| Field | Default | Set to | Why |
|---|---|---|---|
| Minimum Interval For Fetching Messages | 30 minutes | **the lowest allowed, ideally 1** | This is how often the app asks the server for new in-app content. At 30 minutes you create a campaign in the panel and it does not reach the phone for half an hour, which is the whole demo |
| Minimum Duration Between Displaying Messages | 300 seconds | **the lowest allowed, ideally 0 or 1** | A five minute gap between any two in-app messages means the second scenario you demo does not appear |

That second setting is configurable, so configure it: a five minute gap is
right for production and wrong for a demo that shows two scenarios in a row.
If the panel refuses a value below some floor, tell me the floor and I will
account for it in the demo script.

### 4.4 APP TRACKING

**Turn this off.**

It is for detecting which *other* apps are installed on the device, and each row
needs an alias and a package name. Toggling it on with empty rows fails
validation with "The field is required" on each row, which is the panel
validating as designed. We do not need it, and switching it off clears the
errors.

If you ever do want it, the rows would be things like alias `whatsapp`, package
`com.whatsapp`. Note that Android 11 and later restrict app visibility, so it
needs extra manifest declarations to work at all. Not worth it for this demo.

### 4.5 The endpoints, confirmed

Istanbul datacenter. These go straight into the manifest:

```xml
<meta-data android:name="den_event_api_url"    android:value="https://tr-event.dengage.com" />
<meta-data android:name="den_push_api_url"     android:value="https://tr-push.dengage.com" />
<meta-data android:name="den_geofence_api_url" android:value="https://tr-push.dengage.com/geoapi/" />
<meta-data android:name="den_in_app_api_url"   android:value="https://tr-inapp.lib.dengage.com" />
```

For reference, the general API host for this datacenter is
`https://tr-api.dengage.com`. The SDK does not need it; it is the REST API host
used by the server-side endpoints in `dev.dengage.com/reference`.

Note these carry a `tr-` prefix while the web SDK on the same account posts to
`event.dengage.com` and `push.dengage.com` without one. Both are Istanbul. The
unprefixed names are the older global aliases.

### 4.6 The integration key

Supplied from the panel on 31 July 2026. It is **not** the public ID; it is a
separate 196-character string:

```
N2A7bUiV0FjaJ6ckw_p_l_K3hEswBsmNm2_s_l_WW_p_l_qr6MX2Ay8sgzrYv6hj97ZQL4FUpbGj2bwMhEaCPVB7GBdB4BpHngtoxJ2_p_l_LKV_s_l_Kv1E6c0cvj10q0E3ISsShVZ_s_l_D_s_l_n_s_l_BOJJ8qdOQpjdrc_s_l_WUkSzwwos6Q_e_q__e_q_
```

**Pass it verbatim**, exactly as copied from the panel. The SDK reference says
to use it as-is and describes no decoding step.

**What those `_p_l_` sequences are.** The key is base64 that has been escaped so
it survives being carried in a URL or a form field:

| Sequence | Real character |
|---|---|
| `_p_l_` | `+` |
| `_s_l_` | `/` |
| `_e_q_` | `=` |

Unescaping gives valid base64 that decodes to a 112-byte blob, which confirms
the reading. **Do not unescape it in the app.** The transformation is recorded
here only so that, if no device appears in the panel, we have an obvious second
thing to try rather than an unexplained string.

**If no device appears in the panel** after a first run, the two candidates in
order are: this key needing the unescaped form after all, and the Firebase
service account not being uploaded. Check the panel's device list after each
change.

### 4.7 A note on keeping the key in the repository

This key is embedded in the app, so every copy of the APK contains it, exactly
as the web application guid `c8d2da44-b982-1925-9ad8-e7caddf0894a` is visible in
the page source of all five web demos. Committing it therefore adds no exposure
that shipping the demo does not already create, and it keeps the demo working
for anyone who clones the repository.

It is still a credential in the weak sense: anyone holding it can send events
into account 28 from a fake device. For a demo account that is an acceptable
trade and consistent with how the web guid is already handled here.

**If you would rather it stayed out of git**, say so and I will read it from
`local.properties`, which Android Studio already excludes from version control,
with the value documented here instead. That is a five minute change now and a
tedious one later.

---

## Part 5: Running the app

1. In Android Studio: **File > Open**, navigate to the cloned repository, select
   the `fintech/android` folder, click **Open**.
2. A "Trust Gradle project?" dialog appears. Click **Trust Project**.
3. The bottom status bar says "Gradle sync in progress". First sync downloads
   the dependencies and takes several minutes. Wait for "Gradle sync finished".
4. Copy `google-services.json` from `~/Downloads` into the **`app` folder**
   inside `fintech/android`. In Finder that is
   `.../dengage-demos/fintech/android/app/google-services.json`.
   It must sit next to `build.gradle.kts`, not at the top of `android/`.
5. Make sure your emulator from Part 2 is running, or plug in a physical Android
   phone with USB debugging enabled.
6. Click the green **play triangle** in the toolbar.

The app installs on the emulator and opens.

### Building a shareable APK

For putting the demo on someone else's phone:

**Build > Build Bundle(s) / APK(s) > Build APK(s)**

When it finishes, a notification appears with a **locate** link. The file is at
`fintech/android/app/build/outputs/apk/debug/app-debug.apk`. Send that file to
any Android phone, open it there, and allow "install from unknown sources".

This is a debug build, which is right for a demo. Publishing to the Play Store
is a different process with a paid account and review, and we do not need it.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Finish button greyed out in the setup wizard | You have not accepted every licence in the list. Click each item on the left and accept it individually |
| Emulator will not boot, or is unusably slow | Wrong ABI. Apple Silicon needs `arm64-v8a`, Intel needs `x86_64`. Delete the virtual device and recreate it |
| "SDK location not found" | Android Studio did not finish its first-run download. Reopen it and let the wizard complete |
| Gradle sync fails on a network error | Usually a corporate proxy or VPN. Try off the VPN first |
| App installs but no push arrives | Check in order: notification permission granted on the device, `google-services.json` in the right folder, the Firebase credential uploaded to the Dengage panel, and the device visible in the panel's device list |
| "Default FirebaseApp is not initialized" | `google-services.json` is missing or in the wrong folder. It goes in `app/`, not `android/` |

---

## Status of the values the app needs

| Value | Status |
|---|---|
| Package name | **settled**: `com.dengagefintech.demo` |
| Firebase credential type | **settled**: service account JSON, file upload |
| Event API URL | **settled**: `https://tr-event.dengage.com` |
| Push API URL | **settled**: `https://tr-push.dengage.com` |
| Geofence API URL | **settled**: `https://tr-push.dengage.com/geoapi/` |
| In-app API URL | **settled**: `https://tr-inapp.lib.dengage.com` |
| Application public ID | **settled**: `2408eae9-7b9c-5b95-e8a7-6809aa97d62c` |
| `firebaseIntegrationKey` | **settled**: see Part 4.6. Passed verbatim, escaping included |
| `google-services.json` | Salil to generate in Part 3.3 |
| Service account JSON | Salil to generate in Part 3.4 and upload in Part 4.2 |

Settled since first drafting: the app writes the **same** custom tables as the
web, distinguished by `event_source = "android"`, exactly as
`fintech/EVENT-MODEL.md` specifies. `ParityTest` reads the website's catalogue
and fails if the two ever drift.

Still open, and not blocking anything:

- The Big Data column type list and any cap on columns per table.

---

## Build state

The app is written and builds. In the build container it compiles on JDK 21
with `./gradlew :app:assembleDebug`, all 8 unit tests are green, and the output
is `app/build/outputs/apk/debug/app-debug.apk`. The remaining verification is
on-device: press play in Android Studio and walk the surfaces.
