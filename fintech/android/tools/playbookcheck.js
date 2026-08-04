/* ============================================================================
   playbookcheck: does the NovaPay app cover docs/MOBILE-APP-PLAYBOOK.md?

       node fintech/android/tools/playbookcheck.js

   Every item in the playbook's own checklist (15) plus the rules from 0.5 to
   12.5, checked against the SOURCE rather than against anyone's memory. Each
   row names the section it comes from so a failure is traceable to the rule.

   This is an audit, not a test suite: it greps for the presence or absence of
   specific constructs. It cannot prove behaviour on a handset, and 13 is
   explicit that only a person with a phone can. What it can do is stop a
   checklist item being quietly dropped.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'app');
const SRC = path.join(APP, 'src/main/java/com/dengagefintech/demo');
const ANDROID = path.resolve(__dirname, '..');
const SITE = path.resolve(__dirname, '..', '..');

const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const all = (dir, ext = '.kt') => {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (p.endsWith(ext)) out.push(p);
    }
  })(dir);
  return out;
};
const SOURCE = all(SRC).map(read).join('\n');
const MANIFEST = read(path.join(APP, 'src/main/AndroidManifest.xml'));
const GRADLE = read(path.join(APP, 'build.gradle.kts'));
const PROPS = read(path.join(ANDROID, 'gradle.properties'));

let pass = 0, fail = 0;
const rows = [];
function check(section, label, ok, detail) {
  rows.push({ section, label, ok: !!ok, detail: detail || '' });
  ok ? pass++ : fail++;
}

/* ------------------------------------------------------------------ setup */
check('2', 'JitPack repository declared',
  read(path.join(ANDROID, 'settings.gradle.kts')).includes('jitpack.io'));
check('2', 'sdk AND sdk-geofence, the separate artifact',
  GRADLE.includes(':sdk:6.0.96') && GRADLE.includes('sdk-geofence:6.0.96'));
check('2', 'android.useAndroidX=true', PROPS.includes('android.useAndroidX=true'));
check('2', 'buildConfig = true, BuildConfig is referenced',
  GRADLE.includes('buildConfig = true') && SOURCE.includes('BuildConfig.DEBUG'));
check('2', 'In-App host is an AppCompatActivity',
  read(path.join(SRC, 'MainActivity.kt')).includes(': AppCompatActivity()'));
check('2', 'package name contains a dot',
  /applicationId = "com\.[a-z]+\.[a-z]+"/.test(GRADLE));
check('1', 'google-services.json present, service account key absent',
  fs.existsSync(path.join(APP, 'google-services.json')) &&
  !/private_key|service_account/.test(read(path.join(APP, 'google-services.json'))));

/* ------------------------------------------------------------------ wiring */
const appKt = read(path.join(SRC, 'NovaPayApp.kt'));
check('3', 'DengageLifecycleTracker registered BEFORE init',
  appKt.indexOf('DengageLifecycleTracker()') > -1 &&
  appKt.indexOf('DengageLifecycleTracker()') < appKt.indexOf('Dengage.init'));
check('3', 'setTrackingPermission(true)', appKt.includes('setTrackingPermission(true)'));
check('3', 'setLogStatus(BuildConfig.DEBUG)', appKt.includes('setLogStatus(BuildConfig.DEBUG)'));
check('3', 'import paths for DeviceConfigurationPreference and DengageLifecycleTracker',
  appKt.includes('com.dengage.sdk.data.remote.api.DeviceConfigurationPreference') &&
  appKt.includes('com.dengage.sdk.util.DengageLifecycleTracker'));
check('4', 'contact key resolved through the website map, not the raw email',
  read(path.join(SRC, 'Identity.kt')).includes('KNOWN_CONTACTS') &&
  SOURCE.includes('Identity.resolve('));
check('4', 'a test reads identity.js and fails on drift',
  read(path.join(APP, 'src/test/java/com/dengagefintech/demo/ParityTest.kt'))
    .includes("read(\"identity.js\")"));
check('5', 'every screen has a stable name and setNavigation is called',
  read(path.join(SRC, 'Screen.kt')).includes('object Screen') &&
  SOURCE.includes('Dengage.setNavigation('));
check('5', 'sign_in is in the screen list', read(path.join(SRC, 'Screen.kt')).includes('SIGN_IN'));
check('6.1', 'one paced queue in a singleton, with a gap',
  read(path.join(SRC, 'EventQueue.kt')).includes('object EventQueue') &&
  /GAP_MS\s*=\s*\d+/.test(read(path.join(SRC, 'EventQueue.kt'))));
check('6.2', 'date formats yyyy-MM-dd and yyyy-MM-dd HH:mm, no seconds',
  read(path.join(SRC, 'Events.kt')).includes('"yyyy-MM-dd"') &&
  read(path.join(SRC, 'Events.kt')).includes('"yyyy-MM-dd HH:mm"'));
check('6.3', 'column names asserted against the website by a test',
  read(path.join(APP, 'src/test/java/com/dengagefintech/demo/ParityTest.kt'))
    .includes('novapayEvents.js'));
check('6.5', 'stock_count is never sent', !/"stock_count"/.test(SOURCE.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')));
check('7.1', 'deep link read from intent.data AND the targetUrl extra',
  SOURCE.includes('intent?.data') && SOURCE.includes('"targetUrl"'));
check('7.1', 'handled in BOTH onCreate and onNewIntent',
  read(path.join(SRC, 'MainActivity.kt')).includes('override fun onNewIntent') &&
  (read(path.join(SRC, 'MainActivity.kt')).match(/handleDeepLink\(/g) || []).length >= 3);
check('7.2', 'launchMode="singleTask" on the main activity',
  /android:name="\.MainActivity"[\s\S]{0,300}?android:launchMode="singleTask"/.test(MANIFEST));
const fcm = read(path.join(SRC, 'push/NovaPayFcmService.kt'));
check('7.3', 'FCM service hands EVERY message to super',
  fcm.includes('super.onMessageReceived(message)') &&
  !/if\s*\([^)]*messageSource[^)]*\)\s*\{[\s\S]{0,400}?return/.test(fcm));
check('7.3', 'only our subclass is registered in the manifest',
  MANIFEST.includes('.push.NovaPayFcmService') &&
  !MANIFEST.includes('com.dengage.sdk.push.FcmMessagingService'));
check('7.6', 'Live Update handler registered in Application.onCreate',
  appKt.includes('NovaPayLiveUpdate.register()'));
check('0.5', 'registerReceiver keeps a single Dengage push receiver',
  (appKt.match(/override fun registerReceiver/g) || []).length === 4 &&
  appKt.includes('com.dengage.push.intent.RECEIVE'));
check('0.5', 'the receiver shim is dated and marked for re-check',
  /Added 2 Aug 2026; re-check on SDK upgrades/.test(appKt));
const surfaces = read(path.join(SRC, 'ui/Surfaces.kt'));
/* BOTH vocabularies are the app's. This check used to assert the opposite for
   Stories, that its id was blank and waiting on the panel, which was the same
   mistake the inline placements had already been corrected for: showStoriesList
   takes storyPropertyId as a plain argument exactly as showInlineInApp takes
   propertyId, and nothing reads an id back from the platform. A blank id meant
   no Story campaign could be built at all. Assert the corrected shape, or the
   suite pins the bug in place. */
const objectBlock = (name) => {
  const start = surfaces.indexOf('object ' + name);
  if (start < 0) return '';
  const end = surfaces.indexOf('\n}', start);
  return end < 0 ? surfaces.slice(start) : surfaces.slice(start, end);
};
const idsIn = (name) =>
  [...objectBlock(name).matchAll(/const val ([A-Z_]+)\s*=\s*"novapay_/g)].map(m => m[1]);

check('8', 'inline placements are declared by the app and collapse when untargeted',
  idsIn('InlinePlacements').length >= 5 &&
  /showInlineInApp\([\s\S]{0,200}propertyId, true\s*\)/.test(surfaces));
check('8', 'Story placements are declared by the app and collapse when untargeted',
  idsIn('StoryPlacements').length >= 3 &&
  /storyPropertyId = propertyId[\s\S]{0,80}hideIfNotFound = true/.test(surfaces));
check('8', 'every declared placement is actually mounted on a screen',
  (function () {
    const screens = read(path.join(SRC, 'ui/Screens.kt'));
    const inline = idsIn('InlinePlacements');
    const story = idsIn('StoryPlacements');
    return inline.length >= 5 && story.length >= 3 &&
      inline.every(id => screens.includes('InlinePlacements.' + id)) &&
      story.every(id => screens.includes('StoryPlacements.' + id));
  })());
check('8', 'a Refresh calls getInAppMessages and isInAppFetched is shown',
  SOURCE.includes('Dengage.getInAppMessages()') && SOURCE.includes('isInAppFetched'));
check('9.1', 'inbox callback takes MutableList and the inbox addressing is on screen',
  surfaces.includes('DengageCallback<MutableList<InboxMessage>>') &&
  /CONTACT (mail|inbox)/i.test(surfaces));
check('9.3', 'inbox is seeded so a new install opens on something',
  surfaces.includes('SEEDED') && (surfaces.match(/SeedRow\(/g) || []).length >= 3);
/* Structure, not prose. The first version of this check looked for a sentence
   and failed on correct code, because the sentence is split across a Kotlin
   string concatenation. Assert the SHAPE: exactly one call site, and none of it
   inside the seeded block. */
const seededBlock = surfaces.slice(
  surfaces.indexOf('if (!seedsCleared) SEEDED.forEach'),
  surfaces.indexOf('Note("The inbox is fetched on open'));
check('9.3', 'writes skip local rows: the read control exists once, and not on seeded rows',
  (surfaces.match(/setInboxMessageAsClicked/g) || []).length === 1 &&
  seededBlock.length > 0 &&
  !seededBlock.includes('setInboxMessageAsClicked') &&
  !seededBlock.includes('Mark as read'));
check('9.4', 'unread badge driven from addToInbox',
  fcm.includes('addToInbox') && read(path.join(SRC, 'ui/NovaPayUi.kt')).includes('unreadInbox'));
check('9.5', 'both counts are printed, from Dengage and shown',
  surfaces.includes('from Dengage,') && surfaces.includes('shown'));
check('10', 'tags go through setTags with a Context',
  SOURCE.includes('Dengage.setTags('));
check('11', 'geofence is behind a control, not started at launch',
  SOURCE.includes('DengageGeofence.startGeofence()') && !appKt.includes('startGeofence'));
check('11', 'recommendation surfaces are stated as not part of this app version',
  SOURCE.includes('Recommendation surfaces are not part of this app version'));
check('12', 'identifiers screen reads from the SDK',
  surfaces.includes('Dengage.getSubscription()'));
check('12', 'Test Area prints the event name on each row',
  read(path.join(SRC, 'ui/TestArea.kt')).includes('campaign listens for:'));
check('12', 'no claim that a real-time PUSH campaign can answer a button',
  !/real-time campaign[\s\S]{0,80}push/i.test(read(path.join(SRC, 'ui/TestArea.kt'))) &&
  read(path.join(SRC, 'ui/TestArea.kt')).includes('PUSH CANNOT'));
check('12', 'test_ events stay out of the real catalogue',
  !read(path.join(SRC, 'Events.kt')).includes('test_'));
check('12.5', 'callback-fed lists use a plain Column, not LazyColumn',
  !surfaces.includes('LazyColumn'));
check('12.5', 'SDK callbacks hop to the main thread in the bridge',
  surfaces.includes('Looper.getMainLooper()'));
check('12.5', 'a per-site journeytest exists',
  fs.existsSync(path.join(SITE, 'tools/journeytest.js')));
check('14', 'README.md and MOBILE-SURFACES.md ship with the app',
  fs.existsSync(path.join(ANDROID, 'README.md')) &&
  fs.existsSync(path.join(ANDROID, 'MOBILE-SURFACES.md')));
check('14', 'what is blocked is written down with whose move it is',
  read(path.join(ANDROID, 'MOBILE-SURFACES.md')).includes('Whose move'));

/* ------------------------------------------------------------------ report */
const by = {};
rows.forEach(r => { (by[r.section] = by[r.section] || []).push(r); });
for (const sec of Object.keys(by).sort((a, b) => parseFloat(a) - parseFloat(b))) {
  console.log('');
  console.log('---- playbook ' + sec + ' ----');
  by[sec].forEach(r => console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.label));
}
console.log('');
console.log(pass + '/' + (pass + fail) + ' playbook checklist items covered in code');
if (fail) {
  console.log('');
  console.log('NOT COVERED:');
  rows.filter(r => !r.ok).forEach(r => console.log('  ' + r.section + '  ' + r.label));
  process.exit(1);
}
