package com.dengagebanking.demo

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import com.dengage.sdk.Dengage
import com.dengage.sdk.util.DengageLifecycleTracker
import com.dengage.sdk.data.remote.api.DeviceConfigurationPreference
import com.dengagebanking.demo.push.MeridianLiveUpdate

/* ============================================================================
   Meridian Bank Android demo, application entry point.

   Two things happen here and the order matters. The lifecycle tracker has to
   be registered before init, because it is what tells the SDK which screen is
   in front of the user; register it afterwards and the first screen of the
   session is invisible to In-App targeting.

   The integration key is checked in deliberately. It identifies this app to
   the Dengage account and is sent from the device on every call, so it is not
   a secret in the way the FCM service account key is. That one lives only in
   the panel and must never appear in this repository.
   ========================================================================== */
class MeridianApp : Application() {

    override fun onCreate() {
        super.onCreate()

        registerActivityLifecycleCallbacks(DengageLifecycleTracker())

        Dengage.init(
            context = applicationContext,
            firebaseIntegrationKey = DengageKeys.FIREBASE_INTEGRATION_KEY,
            deviceConfigurationPreference = DeviceConfigurationPreference.Google,
            disableOpenWebUrl = false
        )

        /* Tracking permission is asserted explicitly at launch so events are
           always enabled on this demo build. In a real bank app this is the
           consent gate and would follow the customer's decision. */
        Dengage.setTrackingPermission(true)

        /* Verbose SDK logging under the Dengage tag, useful while building and
           rehearsing the demo. Turn it off for release. */
        Dengage.setLogStatus(BuildConfig.DEBUG)

        /* Live Update, what the REST API calls Live Activity.

           Registered here rather than in an activity because a live update can
           arrive while the app is dead, and only a registered handler receives
           it. Application.onCreate is the only place guaranteed to have run
           first. */
        MeridianLiveUpdate.register(this)

        /* FETCH IN-APP MESSAGES AT LAUNCH. In-App targeting reads the screen
           name reported by setNavigation, and that reporting only takes effect
           once the device holds a recently fetched set of messages. Fetching
           here means the very first screen a customer opens is targetable,
           rather than the demo needing a manual refresh before anything shows.

           The SDK also refreshes on its own schedule, so this is a head start
           and not a replacement. Do not remove: required for correct behaviour
           with this SDK version. Background: ask Salil. */
        runCatching { Dengage.getInAppMessages() }
    }

    /* ========================================================================
       Keeps exactly one live receiver registered for
       com.dengage.push.intent.RECEIVE: when a new registration carries the
       push filter, the previous one is unregistered first.

       Deliberately narrow: it triggers only on a filter carrying
       com.dengage.push.intent.RECEIVE. The click-only receiver in
       MeridianPushGallery does not carry it, and no other library's receivers
       match, so nothing else is touched.

       Do not remove: required for correct behaviour with this SDK version.
       Background: ask Salil.
       ====================================================================== */
    private val receiverLock = Any()
    private var dengagePushReceiver: BroadcastReceiver? = null

    private fun supersedePrevious(receiver: BroadcastReceiver?, filter: IntentFilter?) {
        if (receiver == null || filter == null) return
        if (!filter.hasAction(DENGAGE_PUSH_RECEIVE)) return

        synchronized(receiverLock) {
            val previous = dengagePushReceiver
            dengagePushReceiver = receiver
            if (previous == null || previous === receiver) return
            /* Already gone if the process was restarted under us. Losing that
               race is harmless; registering a second listener is not. */
            runCatching { super.unregisterReceiver(previous) }
        }
    }

    override fun registerReceiver(receiver: BroadcastReceiver?, filter: IntentFilter?): Intent? {
        supersedePrevious(receiver, filter)
        return super.registerReceiver(receiver, filter)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?,
        filter: IntentFilter?,
        flags: Int,
    ): Intent? {
        supersedePrevious(receiver, filter)
        return super.registerReceiver(receiver, filter, flags)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?,
        filter: IntentFilter?,
        broadcastPermission: String?,
        scheduler: Handler?,
    ): Intent? {
        supersedePrevious(receiver, filter)
        return super.registerReceiver(receiver, filter, broadcastPermission, scheduler)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?,
        filter: IntentFilter?,
        broadcastPermission: String?,
        scheduler: Handler?,
        flags: Int,
    ): Intent? {
        supersedePrevious(receiver, filter)
        return super.registerReceiver(receiver, filter, broadcastPermission, scheduler, flags)
    }

    private companion object {
        const val DENGAGE_PUSH_RECEIVE = "com.dengage.push.intent.RECEIVE"
    }
}
