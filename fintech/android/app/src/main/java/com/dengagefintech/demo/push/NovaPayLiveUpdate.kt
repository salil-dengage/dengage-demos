package com.dengagefintech.demo.push

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import com.dengage.sdk.liveupdate.DengageLiveUpdateManager
import com.dengage.sdk.liveupdate.LiveUpdateEvent
import com.dengage.sdk.liveupdate.LiveUpdateHandler
import com.dengage.sdk.liveupdate.LiveUpdatePayload
import com.dengagefintech.demo.R

/**
 * Live Update: an ongoing notification the APP draws, from a contentState map
 * the server sends.
 *
 * On Android this is not an OS widget system like Apple's ActivityKit. The
 * platform sends the Live Update in the push data and the SDK routes it to
 * DengageLiveUpdateManager, which calls the handler registered for the matching
 * activityType. Everything drawn below is ours, which is one more reason
 * NovaPayFcmService hands every message to super and lets the SDK dispatch.
 *
 * API used, SDK 6.0.96:
 *
 *   DengageLiveUpdateManager.register(String, LiveUpdateHandler)
 *   LiveUpdateHandler { channelId, channelName, channelDescription,
 *                       buildNotification(Context, LiveUpdatePayload),
 *                       onUpdate(Context, LiveUpdatePayload) }
 *   LiveUpdatePayload(activityType, event, activityId,
 *                     contentState: Map<String,String>, dismissalDate: Long?)
 *   LiveUpdateEvent = START | UPDATE | END
 *
 * The contentState keys below are this app's own contract: the panel campaign
 * must send the same ones, and a real send is what confirms the pairing.
 */
object NovaPayLiveUpdate {

    /** The panel must send this exact string as the activity type. */
    const val ACTIVITY_TYPE = "novapay_transfer"

    private const val CHANNEL_ID = "novapay_live_update"
    private const val NOTIFICATION_ID = 90210

    /* The contentState keys this handler reads. A key the panel does not send
       simply falls back, so a partial map degrades rather than crashing. */
    const val KEY_TITLE = "title"
    const val KEY_STATUS = "status"
    const val KEY_AMOUNT = "amount"
    const val KEY_RECIPIENT = "recipient"
    const val KEY_PROGRESS = "progress"     // 0 to 100

    private val handler = object : LiveUpdateHandler {
        /* The interface declares these as vals, so they are properties here,
           not getter methods. */
        override val channelId = CHANNEL_ID
        override val channelName = "Payments in progress"
        override val channelDescription =
            "A transfer you can follow without opening the app"

        override fun buildNotification(context: Context, payload: LiveUpdatePayload): Notification {
            ensureChannel(context)
            val s = payload.contentState ?: emptyMap()

            val title = s[KEY_TITLE] ?: "Transfer in progress"
            val status = s[KEY_STATUS] ?: "Sending"
            val amount = s[KEY_AMOUNT]
            val to = s[KEY_RECIPIENT]
            val progress = s[KEY_PROGRESS]?.toIntOrNull() ?: 0
            val ended = payload.event == LiveUpdateEvent.END

            val line = buildString {
                append(status)
                if (!amount.isNullOrBlank()) append("  ").append(amount)
                if (!to.isNullOrBlank()) append("  to ").append(to)
            }

            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_novapay)
                .setContentTitle(title)
                .setContentText(line)
                .setOnlyAlertOnce(true)
                // Ongoing until END, or the customer can swipe away a payment
                // that is still running.
                .setOngoing(!ended)
                .apply {
                    if (!ended) setProgress(100, progress.coerceIn(0, 100), false)
                }
                .build()
        }

        override fun onUpdate(context: Context, payload: LiveUpdatePayload) {
            // Re-notify on the same id so the existing notification changes in
            // place rather than stacking.
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, buildNotification(context, payload))
        }
    }

    private fun ensureChannel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Payments in progress",
                NotificationManager.IMPORTANCE_LOW).apply {
                description = "A transfer you can follow without opening the app"
                setShowBadge(false)
            }
        )
    }

    /**
     * MUST be called from Application.onCreate, not from an activity: the push
     * can arrive when no activity exists, and the handler must already be
     * registered for its activityType by then, or there is nothing to draw the
     * update.
     */
    fun register() {
        runCatching { DengageLiveUpdateManager.register(ACTIVITY_TYPE, handler) }
    }

    fun isRegistered(): Boolean =
        runCatching { DengageLiveUpdateManager.isRegistered(ACTIVITY_TYPE) }.getOrDefault(false)

    fun isActive(): Boolean =
        runCatching { DengageLiveUpdateManager.isActive(ACTIVITY_TYPE) }.getOrDefault(false)

    /* ------------------------------------------------------------- local player
       Steps START, UPDATE, END through the handler WITHOUT a campaign, so the
       rendering can be proven on a bench.

       This is local. It never reaches Dengage, so it proves the drawing and
       nothing else: no campaign statistics, no server state. The Test Area
       labels it as such, because a local payload that looks right has fooled
       this project before. */
    fun playLocally(context: Context, step: LiveUpdateEvent, progress: Int) {
        val payload = LiveUpdatePayload(
            ACTIVITY_TYPE, step, "local-demo",
            mapOf(
                KEY_TITLE to "Sending money",
                KEY_STATUS to when (step) {
                    LiveUpdateEvent.START -> "Checking the details"
                    LiveUpdateEvent.UPDATE -> "On its way"
                    LiveUpdateEvent.END -> "Delivered"
                },
                KEY_AMOUNT to "$120.00",
                KEY_RECIPIENT to "Sam Whitfield",
                KEY_PROGRESS to progress.toString()
            ),
            null
        )
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, handler.buildNotification(context, payload))
    }
}
