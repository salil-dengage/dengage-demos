package com.dengagebanking.demo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.dengage.sdk.Dengage
import androidx.core.content.ContextCompat
import com.dengagebanking.demo.events.MeridianEvents
import com.dengagebanking.demo.ui.MeridianApplicationUi

/* One AppCompatActivity for the whole app, with Compose inside it.

   AppCompatActivity rather than ComponentActivity because the In-App surface
   needs one: showRealTimeInApp takes an Activity and the theme has to descend
   from AppCompat. Making this a ComponentActivity would rule out In-App
   messaging entirely.

   Every screen change calls setNavigation(). That call is what In-App
   targeting reads, so every screen reports itself.

   The activity is launchMode singleTask, declared in the manifest, so a deep
   link arriving while the app is open comes through onNewIntent and moves the
   current screen. It used to say "singleTop in practice via onNewIntent" and
   declare nothing, which was wrong: with the default mode Android stacks a
   second copy and destroys the first, and onNewIntent is never called. */
class MainActivity : AppCompatActivity() {

    private companion object {
        /** How long to wait between checks that the launch In-App fetch has
         *  landed, and how many checks before giving up. 250ms for 10 seconds:
         *  long enough for a slow round trip on a conference network, short
         *  enough that nothing is left polling. */
        const val IN_APP_WAIT_MS = 250L
        const val IN_APP_WAIT_ATTEMPTS = 40
    }

    var screen by mutableStateOf(DengageKeys.Screen.SIGN_IN)
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        /* Android 13+ shows the system dialog; below that the SDK returns
           without prompting. Asking on first launch is the honest place for a
           banking app, because push here is a service channel first. */
        Dengage.requestNotificationPermission(this)

        setContent {
            MeridianApplicationUi(
                activity = this,
                screen = screen,
                onNavigate = ::navigate
            )
        }

        navigate(routeFor(intent) ?: DengageKeys.Screen.SIGN_IN)
        reportAgainWhenInAppIsReady()
    }

    /* ========================================================================
       THE LAUNCH RACE, AND WHY THE FIRST SCREEN IS REPORTED TWICE

       setNavigation is only honoured once the device holds a recently fetched
       set of In-App messages. MeridianApp fires that fetch from
       Application.onCreate, but a fetch is a network round trip and
       setNavigation runs synchronously in onCreate and onResume, so on a cold
       start the first report loses the race and the SDK says so:

           setNavigation blocked: No successful in-app message fetch in the
           last 120 minutes

       Observed on a handset on 3 August: the two blocked calls landed at
       45.285 and 45.337, and getMessages only returned at 46.749.

       THE CONSEQUENCE IS NARROW AND EASY TO MISREAD. A classic In-App campaign
       aimed at the launch screen does not appear until the customer navigates
       away and back. Real-time campaigns are unaffected, because they do not
       read the fetched set, which is why one shows and the other does not.
       On a live demo that reads as "the popup did not come".

       Note the 120 minute window: a second launch inside two hours finds the
       previous fetch still valid and shows no symptom at all, so this is
       exactly the kind of defect that hides until the demo that matters.

       So the current screen is reported AGAIN once the fetch has actually
       landed. The wait WATCHES isInAppFetched() rather than sleeping a guessed
       interval, because the SDK offers no completion callback and reading the
       flag is observation where a fixed delay would be a guess. It gives up
       after a bounded number of attempts, so a handset with no network does
       not poll for the life of the process. */
    private val ui = Handler(Looper.getMainLooper())
    private var reReported = false

    private fun reportAgainWhenInAppIsReady(attempt: Int = 0) {
        if (reReported || attempt >= IN_APP_WAIT_ATTEMPTS) return
        if (runCatching { Dengage.isInAppFetched() }.getOrDefault(false)) {
            reReported = true
            // screen is read now rather than captured at launch, so navigating
            // during the wait re-targets where the customer actually is.
            Dengage.setNavigation(this, screen)
            return
        }
        ui.postDelayed({ reportAgainWhenInAppIsReady(attempt + 1) }, IN_APP_WAIT_MS)
    }

    override fun onDestroy() {
        ui.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    /* A deep link that arrives while the app is already open comes here rather
       than through onCreate. Miss this and a push tapped during a demo appears
       to do nothing, because the app was already foreground. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        routeFor(intent)?.let { navigate(it) }
    }

    fun navigate(target: String) {
        screen = target
        MeridianEvents.currentScreen = target
        /* Tell the SDK which screen is in front of the user. In-App campaigns
           targeted at this screen name are evaluated on this call. */
        Dengage.setNavigation(this, target)
    }

    override fun onResume() {
        super.onResume()
        Dengage.setNavigation(this, screen)
        reportPushPermission()
    }

    private var pushPermissionReported = false

    /* push_permission_granted and push_permission_denied are the two events in
       the catalogue with no web counterpart, because a browser has no
       notification permission dialog. They are what lets the engagement table
       answer "who actually has push on", which is the first question asked of
       any push campaign's reach.

       Reported on resume rather than from a permission callback so the answer
       is right when someone changes it in Settings and comes back, which is
       exactly how a customer turns notifications off. */
    private fun reportPushPermission() {
        if (pushPermissionReported) return
        val granted = android.os.Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        pushPermissionReported = true
        val payload = MeridianEvents.EngagementInput(consentPush = granted, placement = "app_launch")
        if (granted) MeridianEvents.Engagement.pushGranted(payload)
        else MeridianEvents.Engagement.pushDenied(payload)
        Dengage.setUserPermission(granted)
    }

    /** The last deep link this activity was handed, whatever form it arrived
     *  in. Shown on the identifiers screen, because "the push opened the app
     *  but not the right screen" is otherwise undiagnosable from the device. */
    var lastLink: String = "(none)"
        private set

    /** meridian://wealth and meridian://open?screen=wealth both resolve, so a
     *  campaign author can use whichever form the panel field accepts. An
     *  unknown target lands on the overview rather than a blank screen.
     *
     *  TWO PLACES TO LOOK: the destination can arrive as intent data or as the
     *  string extra "targetUrl" (or "dn_target_url"), depending on how the
     *  push was routed. Read all of them, in onCreate and onNewIntent both. */
    private fun routeFor(intent: Intent?): String? {
        if (intent == null) return null

        /* A CUSTOM PARAMETER CAN OVERRIDE THE TARGET URL, and this is the
           clearest thing custom parameters do. The target URL is fixed when
           the content is built; a custom parameter is set per send, so a
           campaign can point one push at the account it is actually about
           without a template per destination.
           Send screen=<name> as a custom parameter to see it. */
        intent.getStringExtra("screen")?.let { fromParam ->
            knownScreen(fromParam)?.let { return it }
        }

        val raw = intent.data?.toString()
            ?: intent.getStringExtra("targetUrl")
            ?: intent.getStringExtra("dn_target_url")
            ?: return null
        lastLink = raw
        val uri: Uri = runCatching { Uri.parse(raw) }.getOrNull() ?: return null
        if (uri.scheme != "meridian") return null

        val requested = uri.host?.takeIf { it.isNotBlank() && it != "open" }
            ?: uri.getQueryParameter("screen")
            ?: uri.lastPathSegment

        return knownScreen(requested) ?: DengageKeys.Screen.OVERVIEW
    }

    /** Resolves a screen name against the declared vocabulary, so a typo in a
     *  campaign lands nowhere rather than crashing or opening something odd. */
    private fun knownScreen(name: String?): String? {
        if (name.isNullOrBlank()) return null
        val known = listOf(
            DengageKeys.Screen.OVERVIEW, DengageKeys.Screen.ACCOUNTS,
            DengageKeys.Screen.CARDS, DengageKeys.Screen.PAYMENTS,
            DengageKeys.Screen.WEALTH, DengageKeys.Screen.PROFILE,
            DengageKeys.Screen.PRODUCTS, DengageKeys.Screen.INBOX,
            DengageKeys.Screen.EVENTS, DengageKeys.Screen.IDENTITY,
            DengageKeys.Screen.TEST,
            DengageKeys.Screen.SEND_MONEY, DengageKeys.Screen.APPLY,
            DengageKeys.Screen.COMPLAINT, DengageKeys.Screen.APPOINTMENT
        )
        return known.firstOrNull { it.equals(name, ignoreCase = true) }
    }
}
