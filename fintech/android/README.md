# NovaPay Android demo app

The mobile half of the NovaPay demo. It mirrors the website's logged-in portal
screen for screen and writes **the same ten Dengage tables the website writes**,
so one segment covers both surfaces.

- Package: `com.dengagefintech.demo`
- App name on the phone: **Demo - NovaPay**
- Deep links: `novapay://<screen>`, route table in
  [`MOBILE-SURFACES.md`](MOBILE-SURFACES.md)
- Dengage Android SDK **6.0.96**, Istanbul datacenter

Setting up the Firebase and Dengage side, with no Android experience assumed:
[`SETUP-MAC.md`](SETUP-MAC.md).

---

## State of it, honestly

This matters more than a feature list, so it is first.

**Proven in the build container, as of the build that produced this table**

The rows below were observed on a container with the Android SDK installed.
**The work added since then has NOT been compiled**: the In-App catalogue, the
five journey screens, the thirteen-format push gallery, the Story placements and
the rewritten Test Area were written and reviewed on a container without an
Android SDK, so `assembleDebug` could not run. Build it once before a call and
this line goes away.

| | |
|---|---|
| Compiles against the real SDK | `./gradlew :app:assembleDebug` produces `app-debug.apk`, 27 MB |
| Unit tests | 8 of 8 green |
| Table names match the website | the test READS `fintech/js/novapayEvents.js` and compares |
| Spine columns match the website | same, and asserts the app never writes the SDK's three |
| Contact-key map matches | reads `fintech/js/identity.js` |
| Bands match | balance and credit-score buckets, value by value |
| Date formats | `yyyy-MM-dd` and `yyyy-MM-dd HH:mm`, no seconds, not ISO |
| No `stock_count` anywhere | scans every Kotlin source |
| Deep-link routing | `novapay://cards` resolves, `novapay://nope` does not |

The parity tests were checked by planting a drift: renaming one table to
`fintech_cards_events` turns them red with "app and website disagree about the
table list".

**NOT proven, and only provable on a handset**

Push delivery, deep-link routing from a real notification, In-App rendering,
inbox contents, tags landing on the device record, geofence, and **rows actually
arriving in Data Space**. None of that has been observed by anyone yet. A 200
from the event API means accepted, not stored.

When you have run it, what you confirm is confirmed by **you**; this README will
say so rather than claiming it was verified here.

**Blocked**

| What | On whom |
|---|---|
| Push delivery | the FCM **service account key** must be uploaded in the Dengage panel. It is a real secret: panel only, never committed, never pasted into a chat |
| **App Stories** | nothing in the app. The three story property ids in `ui/Surfaces.kt` are app-chosen and their rails are mounted, exactly like the five inline placements. What is missing is a **Story set in the panel** targeting one of them, and until there is, each rail collapses rather than showing an empty frame |
| Recommendations | not offered by the Android SDK; the Test Area states this on screen, see below |

---

## Running it on a Mac

No Android experience assumed.

1. **Install Android Studio** from `developer.android.com/studio`. Accept the
   default SDK components when it offers them.
2. **Open this folder**: Android Studio, *Open*, choose
   `dengage-demos/fintech/android`. Not the repository root, not `app/`.
3. **Point it at your SDK.** Copy `local.properties.example` to
   `local.properties` and set `sdk.dir` to your own path, usually
   `/Users/<you>/Library/Android/sdk`. This file is deliberately gitignored:
   every machine's path is different.
4. **Use JDK 17 or 21.** *Settings, Build, Build Tools, Gradle, Gradle JDK*.
   Both work: the CI container builds this project on JDK 21.0.10. The version
   that is known to FAIL is JDK 25, which stops the sync with an
   incompatibility dialog before anything builds.
5. **Let it sync.** First sync downloads the SDK from JitPack and takes a few
   minutes.
6. **Plug the phone in** with USB debugging on (*Settings, About phone*, tap
   *Build number* seven times, then *Developer options, USB debugging*). The
   device appears in the toolbar dropdown.
7. **Press Run.**

If push does not arrive, open the **IDs** screen first. It reads the contact
key, device id, push token and last deep link straight from the SDK, which turns
"the push did not arrive" into an answerable question in about ten seconds.

---

## Gradle sync fails on first open

If it does, the wrapper is trying to download Gradle itself, about 130MB, and
your network is too slow for it to finish.

**This project deliberately pins the same Gradle version as the other Android
project in this repository, 8.11.1.** A machine that has opened that one
already has the distribution in `~/.gradle/wrapper/dists`, so this project
finds it there and downloads NOTHING. That is the fix, and it is why the
version is what it is: do not "upgrade" it to a version the other project does
not use without checking, or the first sync on a fresh machine goes back to
being a 130MB download.

AGP 8.7.3 requires Gradle 8.9 or newer, so anything from 8.9 up is technically
valid. Matching the neighbour is what makes it free.

Two syncs failed before this was understood, and the second is the interesting
one:

```
Could not install Gradle distribution from
  https://services.gradle.org/distributions/gradle-8.9-bin.zip
Reason: java.net.SocketTimeoutException: Connect timed out
```

- first failure at **10s 594ms**, the wrapper's generated `networkTimeout=10000`
- second failure at **1m 0s 811ms**, after the timeout was raised to 60s

Raising the timeout did not fix it. The same machine reaches
`services.gradle.org` perfectly well, it took 5m37s to fetch 8.11.1 for the
other project, so the answer was to need no download rather than to wait longer.

If you still see it, in order:

**1. Check the other Android project has been opened on this machine at least
once.** That is what puts 8.11.1 in the shared cache. `ls ~/.gradle/wrapper/dists`
should list `gradle-8.11.1-bin`.

**2. On a VPN or corporate network,** put the proxy in
`~/.gradle/gradle.properties`:

```
systemProp.https.proxyHost=your.proxy.host
systemProp.https.proxyPort=8080
```

**3. Skip the wrapper entirely.** `brew install gradle`, then **Android Studio
> Settings > Build, Execution, Deployment > Build Tools > Gradle**, set **Use
Gradle from** to *Specified location*.

While you are in that screen, check **Gradle JDK is 17 or 21**. Both are fine.
JDK 25 is the one that fails, with an incompatibility dialog before anything
builds, which looks like a different problem entirely.

## What is in it

**Five portal screens** mirroring the website page for page: Home, Money, Cards,
Grow, Products.

**Five journeys**, reached from Money, Products and Home: send money, top up,
verify identity, apply for a plan, raise a dispute. Each writes several rows in
order under one shared reference, and each carries the failure or abandonment a
campaign is meant to recover: `insufficient_funds`, `limit_exceeded`,
`kyc_abandoned` naming the step, `application_abandoned` with `abandon_step`, and
a dispute left `awaiting_customer`. Every event type and column is already in
`../EVENT-MODEL.md`; where the model has no event, the screen says **"writes
nothing, on purpose"** rather than inventing one.

Plus sign-in, and the screens every demo app needs:

- **IDs**, everything that identifies this app to Dengage, each line copyable
  plus a copy-all. Read via `Dengage.getSubscription()`, so it reports what the
  platform holds rather than what the app believes it sent.
- **Inbox**, read from the server, with three locally seeded rows that say so.
- **Events**, every row this session sent, with its table and payload.
- **Test**, one control per capability. The controls split in two because **an
  app cannot send itself a push**: a push originates on Dengage's servers, and
  the only way a button could make one directly is by calling the REST API with
  an account secret, which would mean shipping that secret inside an APK. So
  server-round-trip buttons fire a distinctly named event for a real-time
  campaign to answer, and the event name each campaign must listen for is
  printed **on the button's own row**. On-device controls do the thing
  immediately: the thirteen In-App layouts, the thirteen push formats, four
  device tags, the Story and inline placement ids with copy controls, and every
  `novapay://` deep link a campaign author can put in a Target URL.

`test_*` event types are instrumentation and are deliberately kept **out of** the
real catalogue. A parity test fails if one leaks in.

**What to paste into the panel** is in
[`../panel-content/mobile/README.md`](../panel-content/mobile/README.md): one
HTML file per In-App layout, on the mobile bridge contract, plus the inline and
Story placement ids. `node fintech/tools/mobiletest.js` fails the build if a
creative drifts back to the website's contract or names a screen the app never
reports.

---

## Two integration notes

**Recommendations are not offered by the Android SDK.** The web demo shows the
recommendation widgets instead, and the Test Area states this on screen rather
than offering a button that cannot work.

**In-App fetch state is read through `DengageCompat.isInAppFetched()`.** It
returns `null` when the state is unavailable, so the screen shows "unknown"
rather than a guess. This is required for correct behaviour with this SDK
version: do not change it without asking Salil.

---

NovaPay is a fictional brand built to demonstrate the Dengage platform. No
account exists, no money moves and every figure is illustrative.
