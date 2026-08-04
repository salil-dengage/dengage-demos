package com.dengagefintech.demo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.dengage.sdk.Dengage
import com.dengagefintech.demo.ui.NovaPayApp as NovaPayUi

/**
 * The single activity.
 *
 * It is an AppCompatActivity ON PURPOSE. Do not change it to a plain
 * ComponentActivity: AppCompatActivity is required for correct In-App display
 * with this SDK version. Background: ask Salil.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        /** Last deep link the app received, shown on the identifiers screen.
         *  This is what turns "the push did not open the right screen" into an
         *  answerable question. */
        var lastDeepLink: String? = null

        /** How long to wait between checks that the launch In-App fetch has
         *  landed, and how many checks before giving up. 250ms for 10 seconds:
         *  long enough for a slow round trip on a conference network, short
         *  enough that nothing is left polling. */
        private const val IN_APP_WAIT_MS = 250L
        private const val IN_APP_WAIT_ATTEMPTS = 40
    }

    private var screen by mutableStateOf(Screen.SIGN_IN)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DemoState.load(this)

        screen = if (DemoState.signedIn) Screen.HOME else Screen.SIGN_IN
        handleDeepLink(intent)

        askForNotifications()

        setContent {
            NovaPayUi(
                screen = screen,
                onNavigate = { navigate(it) }
            )
        }
        report(screen)
        reportAgainWhenInAppIsReady()
    }

    /* ========================================================================
       THE LAUNCH RACE, AND WHY THE FIRST SCREEN IS REPORTED TWICE

       setNavigation is only honoured once the device holds a recently fetched
       set of In-App messages. NovaPayApp fires that fetch from
       Application.onCreate, but a fetch is a network round trip and report()
       runs synchronously here, so on a cold start the first report loses the
       race and the SDK says so:

           setNavigation blocked: No successful in-app message fetch in the
           last 120 minutes

       THE CONSEQUENCE IS NARROW AND EASY TO MISREAD. A classic In-App campaign
       aimed at the launch screen does not appear until the customer navigates
       away and back. Real-time campaigns are unaffected, because they do not
       read the fetched set, which is why one shows and the other does not.

       Note the 120 minute window: a second launch inside two hours finds the
       previous fetch still valid and shows no symptom at all, so this hides
       until the demo that matters. It was caught on the Meridian handset log
       of 3 August and fixed in both apps, because the shape is identical.

       The wait WATCHES isInAppFetched() rather than sleeping a guessed
       interval, because the SDK offers no completion callback and reading the
       flag is observation where a fixed delay would be a guess. It gives up
       after a bounded number of attempts, so a handset with no network does
       not poll for the life of the process.

       Only setNavigation is repeated. report() would also fire a second page
       view, which would put a duplicate row in the customer's history for a
       screen they opened once. */
    private val ui = android.os.Handler(android.os.Looper.getMainLooper())
    private var reReported = false

    private fun reportAgainWhenInAppIsReady(attempt: Int = 0) {
        if (reReported || attempt >= IN_APP_WAIT_ATTEMPTS) return
        if (DengageCompat.isInAppFetched() == true) {
            reReported = true
            // screen is read now rather than captured at launch, so navigating
            // during the wait re-targets where the customer actually is.
            runCatching { Dengage.setNavigation(this, screen) }
            return
        }
        ui.postDelayed({ reportAgainWhenInAppIsReady(attempt + 1) }, IN_APP_WAIT_MS)
    }

    override fun onDestroy() {
        ui.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    /** singleTask, so a second launch arrives here rather than in onCreate.
     *  Handling only one of the two is how a deep link works from cold start
     *  and silently does nothing when the app is already open. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    fun navigate(to: String) {
        screen = to
        report(to)
    }

    /**
     * Every navigation reports twice, and the two are different things.
     *
     * setNavigation is TARGETING: it tells the SDK which screen is in front of
     * the customer, and it is the entire surface an In-App campaign aims at. A
     * screen that never reports itself can never be targeted, and the campaign
     * simply never shows there.
     *
     * pageView is HISTORY: it writes a row a segment or a journey can read
     * later. Events.pageViewForScreen fires only for the customer-facing
     * screens, so the demo scaffolding does not pollute that history.
     *
     * Also keeps Events.currentScreen in step, which is what every custom row
     * sends as page_path.
     */
    private fun report(name: String) {
        Events.currentScreen = name
        runCatching { Dengage.setNavigation(this, name) }
        Events.pageViewForScreen(name)
    }

    /**
     * Android 13 and up will not show a notification until the user grants
     * POST_NOTIFICATIONS. Declaring it in the manifest is not enough, and the
     * failure is silent: the token registers, the campaign reports delivered,
     * and nothing appears on the phone. Asked once, at launch, because a demo
     * that has to hunt through system settings mid-call is worse than a prompt.
     */
    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            onNotificationAnswer(granted)
        }

    /**
     * TELL DENGAGE THE ANSWER. Asking Android is only half of it: without
     * setUserPermission the platform still believes this device can be
     * notified, so a "push reachable" segment counts handsets that will never
     * show a notification, and the campaign reports delivered to people who
     * saw nothing.
     *
     * The event alongside it is what makes the refusal segmentable, so a
     * journey can fall back to e-mail or in-app for exactly those customers.
     */
    private fun onNotificationAnswer(granted: Boolean) {
        runCatching { Dengage.setUserPermission(granted) }
        Events.engagement(
            if (granted) "push_permission_granted" else "push_permission_denied",
            mapOf(
                "channel" to "push",
                "widget_name" to "system_permission_dialog",
                /* interaction is the engagement table's widget vocabulary:
                   triggered, displayed, clicked, dismissed, submitted. A grant
                   is a click on the dialog and a refusal is a dismissal.
                   Inventing "granted" put a word outside the vocabulary into
                   the column, which is the same as leaving it empty. */
                "interaction" to if (granted) "clicked" else "dismissed"
            )
        )
    }

    private fun askForNotifications() {
        // Below Android 13 there is no runtime permission: notifications are
        // granted at install, so report that rather than leaving it unset.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            runCatching { Dengage.setUserPermission(true) }
            return
        }
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        // Already granted on a later launch: report it every time, because the
        // customer can revoke it in system settings between runs.
        if (granted) runCatching { Dengage.setUserPermission(true) }
        else notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /**
     * Where the push deep link arrives.
     *
     * Read the destination from EVERY place it can arrive: intent.data for a
     * link opened directly, plus the targetUrl and dn_target_url string extras
     * used when a push launches this activity. An app that reads only
     * intent.data can open on its launch screen instead of the destination.
     */
    private fun handleDeepLink(intent: Intent?) {
        val raw = intent?.data?.toString()
            ?: intent?.getStringExtra("targetUrl")
            ?: intent?.getStringExtra("dn_target_url")
            ?: return

        lastDeepLink = raw
        val target = Screen.fromDeepLink(raw) ?: return

        // A link into a gated screen while signed out lands on sign-in, which
        // is why SIGN_IN is in the Screen list at all.
        val safe = if (!DemoState.signedIn && target != Screen.SIGN_IN) Screen.SIGN_IN else target
        screen = safe
        report(safe)

        Events.engagement("deep_link_opened", mapOf(
            "channel" to "push",
            "widget_name" to target,
            // Opening a notification is a click on it. See the note above.
            "interaction" to "clicked"
        ))
    }
}
