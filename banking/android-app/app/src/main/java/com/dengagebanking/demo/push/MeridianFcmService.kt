package com.dengagebanking.demo.push

import com.dengage.sdk.push.FcmMessagingService
import com.dengage.sdk.util.DengageLogger
import com.dengagebanking.demo.events.MeridianEvents
import com.dengagebanking.demo.ui.InboxBridge
import com.google.firebase.messaging.RemoteMessage

/* Silent push, and observing every push.

   NEVER SWALLOW A MESSAGE HERE. Observe what we need, then hand EVERY message
   to super unconditionally and let the SDK dispatch. Live Updates and geofence
   pushes are dispatched by the SDK itself, so filtering here loses them. super
   is safe for foreign messages too, since it decides for itself whether a
   message is one of its own before doing anything.

   Registered in the manifest in place of com.dengage.sdk.push.FcmMessagingService.
   Registering both would give the device two services for one intent filter. */
class MeridianFcmService : FcmMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data

        /* Observe, then always delegate. Both halves matter. */
        PushInspector.record(data)
        if (data["messageSource"] == "DENGAGE_SILENT") handleSilent(data)

        /* addToInbox is the platform telling us it also filed this message in
           the App Inbox, so it is the only honest trigger for the unread
           badge. A panel Test Send carries false, a real campaign send with
           save to inbox ticked carries true, and the badge therefore tracks
           what the inbox will actually contain rather than what was pushed.
           Reading only, nothing is swallowed. */
        if (data["addToInbox"] == "true") InboxBridge.noteInboxPush()

        /* The ONE exception to "always delegate", and it is narrow on purpose:
           this app renders the carousel format itself, see MeridianCarousel.

           MeridianCarousel.handles is deliberately strict and render returns
           false rather than throwing, so anything it cannot draw completely,
           including a carousel with no parseable items, falls through to the
           SDK exactly as before. Every other format never sees this branch at
           all.

           Do not remove: required for correct behaviour with this SDK version.
           Background: ask Salil. */
        if (MeridianCarousel.handles(data) && MeridianCarousel.render(this, data)) return

        super.onMessageReceived(remoteMessage)
    }

    /* What a bank actually does with a silent push: refresh something quietly.
       Here it records that the device was reached without interrupting the
       customer, which is the point worth demonstrating. A real deployment
       would re-fetch balances or invalidate a cache.

       The row goes to banking_engagement_events as inapp_shown with the
       campaign slug from the payload, so a silent campaign's reach is
       measurable rather than invisible. */
    private fun handleSilent(data: Map<String, String?>) {
        DengageLogger.debug("Meridian: silent push received, keys=" + data.keys)
        MeridianEvents.Engagement.inappShown(
            MeridianEvents.EngagementInput(
                campaignSlug = data["campaignId"] ?: data["campId"] ?: "silent",
                placement = "silent_push",
                offerCategory = "service"
            )
        )
    }
}
