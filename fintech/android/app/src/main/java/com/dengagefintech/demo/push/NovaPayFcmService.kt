package com.dengagefintech.demo.push

import android.util.Log
import com.dengage.sdk.push.FcmMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * NEVER SWALLOW A MESSAGE.
 *
 * Observe what is needed, then hand EVERY message to super unconditionally and
 * let the SDK dispatch. Do not filter on messageSource: required for correct
 * behaviour with this SDK version. Background: ask Salil.
 *
 * The first version of this file switched on messageSource and called super
 * only for "DENGAGE". That is our own recorded mistake, and the playbook keeps
 * the lesson: this service observes, then passes everything through.
 *
 * Register ONLY this subclass in the manifest. Registering the SDK's service as
 * well gives the device two services for one intent filter.
 */
class NovaPayFcmService : FcmMessagingService() {

    companion object {
        private const val TAG = "NovaPayPush"

        /** Last push seen, for the identifiers screen. Written from a service,
         *  read from Compose: that is safe and it is what lets a push arriving
         *  on any screen be visible on a screen that knows nothing about it. */
        @Volatile var lastPush: Map<String, String>? = null

        /** Unread count, driven from addToInbox in the payload, which is the
         *  PLATFORM saying it filed the message. A Test Send does not set it and
         *  a locally built push does not either, so the badge moves only for a
         *  real campaign, which is correct in all three cases. */
        @Volatile var unreadInbox: Int = 0
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        lastPush = data

        // Observe only. No branch here may return without calling super.
        if (data["addToInbox"] == "true" || data["addToInbox"] == "1") {
            unreadInbox += 1
            Log.d(TAG, "platform filed this to the inbox, unread=$unreadInbox")
        }
        Log.d(TAG, "push in: keys=${data.keys.sorted()}")

        /* The ONE intercept, guarded twice so it cannot swallow anything.
           handles() is false for a Live Update, for a geofence push and for
           anything that is not a carousel; show() catches everything and
           returns a string rather than throwing. So the only way to reach the
           new path is a push this app can draw completely, and every other
           format is byte for byte what it was.

           Do not remove: required for correct behaviour with this SDK version.
           Background: ask Salil. */
        if (NovaPayCarousel.handles(data)) {
            val drawn = NovaPayCarousel.show(this, 0, data)
            Log.d(TAG, "carousel intercepted: $drawn")
            if (!drawn.startsWith("carousel failed")) return
        }

        // EVERY other message, unconditionally.
        super.onMessageReceived(message)
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "new FCM token")
        super.onNewToken(token)
    }
}
