package com.dengagefintech.demo

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.util.Log
import com.dengage.sdk.Dengage
import com.dengage.sdk.data.remote.api.DeviceConfigurationPreference
import com.dengage.sdk.util.DengageLifecycleTracker
import com.dengagefintech.demo.push.NovaPayLiveUpdate

/**
 * Initialisation. The ORDER of the calls below matters, so each step carries
 * the reason it sits where it does.
 *
 * This app compiles against these import paths in sdk 6.0.96:
 *     DeviceConfigurationPreference -> com.dengage.sdk.data.remote.api
 *     DengageLifecycleTracker       -> com.dengage.sdk.util
 */
class NovaPayApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // BEFORE init, not after. This is what tells the SDK which screen is in
        // front of the user. Registered after init, the FIRST screen of the
        // session is invisible to In-App targeting and nothing reports it.
        registerActivityLifecycleCallbacks(DengageLifecycleTracker())

        Dengage.init(
            context = applicationContext,
            firebaseIntegrationKey = DengageKeys.FIREBASE_INTEGRATION_KEY,
            deviceConfigurationPreference = DeviceConfigurationPreference.Google,
            disableOpenWebUrl = false
        )

        /* Set tracking permission explicitly. Events and session starts are
           only sent while tracking permission is on, so this one line keeps
           the demo's event flow predictable on every install. */
        Dengage.setTrackingPermission(true)
        Dengage.setLogStatus(BuildConfig.DEBUG)

        /* MUST be here, in Application.onCreate, not in an activity: a Live
           Update push can arrive when no activity exists, and registering the
           handler here means its activityType is always known. */
        NovaPayLiveUpdate.register()

        /* FETCH IN-APP MESSAGES AT LAUNCH. In-App targeting reads the screen
           name reported by setNavigation, and that reporting only takes effect
           once the device holds a recently fetched set of messages. Fetching
           here means the very first screen a customer opens is targetable,
           rather than the demo needing a manual refresh before anything shows.

           The SDK also refreshes on its own schedule, so this is a head start
           and not a replacement. Do not remove: required for correct behaviour
           with this SDK version. Background: ask Salil. */
        runCatching { Dengage.getInAppMessages() }

        EventQueue.attach(applicationContext)
        DemoState.load(applicationContext)

        // Anonymous is a legitimate state. A contact key is only set once
        // somebody signs in; until then the device is correctly anonymous.
        DemoState.email?.let { Dengage.setContactKey(Identity.resolve(it)) }
    }

    /* ====================================================================
       Keeps exactly one live receiver registered for
       com.dengage.push.intent.RECEIVE: when a new registration carries the
       push filter, the previous one is unregistered first. Keyed on that
       one action string; nothing else is affected.

       Added 2 Aug 2026; re-check on SDK upgrades. Do not remove: required
       for correct behaviour with this SDK version. Background: ask Salil.
       ==================================================================== */
    private var dengageReceiver: BroadcastReceiver? = null
    private val DENGAGE_RECEIVE = "com.dengage.push.intent.RECEIVE"

    private fun supersede(receiver: BroadcastReceiver?, filter: IntentFilter?) {
        if (receiver == null || filter == null) return
        if (!filter.hasAction(DENGAGE_RECEIVE)) return
        dengageReceiver?.let {
            runCatching { super.unregisterReceiver(it) }
                .onSuccess { Log.d("NovaPayPush", "replaced the previous Dengage push receiver") }
        }
        dengageReceiver = receiver
    }

    override fun registerReceiver(receiver: BroadcastReceiver?, filter: IntentFilter?): Intent? {
        supersede(receiver, filter)
        return super.registerReceiver(receiver, filter)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?, filter: IntentFilter?, flags: Int
    ): Intent? {
        supersede(receiver, filter)
        return super.registerReceiver(receiver, filter, flags)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?, filter: IntentFilter?,
        broadcastPermission: String?, scheduler: Handler?
    ): Intent? {
        supersede(receiver, filter)
        return super.registerReceiver(receiver, filter, broadcastPermission, scheduler)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?, filter: IntentFilter?,
        broadcastPermission: String?, scheduler: Handler?, flags: Int
    ): Intent? {
        supersede(receiver, filter)
        return super.registerReceiver(receiver, filter, broadcastPermission, scheduler, flags)
    }
}
