package com.dengagebanking.demo.push

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import com.dengage.sdk.liveupdate.DengageLiveUpdateManager
import com.dengage.sdk.liveupdate.LiveUpdateEvent
import com.dengage.sdk.liveupdate.LiveUpdateHandler
import com.dengage.sdk.liveupdate.LiveUpdatePayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.dengagebanking.demo.R

/* ============================================================================
   LIVE UPDATE  (what the REST API calls Live Activity)

   A notification that stays on the lock screen and is UPDATED IN PLACE as
   something progresses, then ends. Apple calls this a Live Activity and gives
   it a system widget; Android has no such thing, so on this platform the app
   draws an ordinary ongoing notification and the SDK re-delivers new state to
   it. That difference is worth saying in a demo, because the endpoints are
   shared across platforms and the Android rendering is this app's own design.

   HOW IT ARRIVES. The server posts to /liveActivity/start, /update or /end;
   the SDK routes the push to the handler registered for its activityType.
   Register the handler at application start.

   WHAT THE APP OWNS. Everything visible. The payload carries a contentState
   map of strings and the app decides what that looks like, so the notification
   below is Meridian's design rather than Dengage's. contentState keys are
   whatever the campaign sends; the ones read here are declared in KEYS so the
   panel side has a contract to build against.

   Modelled on a mortgage application progressing, because it is the one
   long-running thing a bank does that a customer actually watches: submitted,
   valuation, underwriting, offer. A payment or a card delivery works the same
   way.
   ========================================================================== */
object MeridianLiveUpdate {

    /** The activityType the campaign must send. One handler per type. */
    const val ACTIVITY_TYPE = "mortgage_application"

    /** The contentState keys this handler reads. The panel must send these
     *  names; anything else is ignored rather than guessed at. */
    object Keys {
        const val STAGE = "stage"          // human label, e.g. "Underwriting"
        const val DETAIL = "detail"        // one line under the stage
        const val PERCENT = "percent"      // 0..100, drives the progress bar
        const val REFERENCE = "reference"  // the application reference
    }

    private const val CHANNEL_ID = "meridian_live_update"

    fun register(context: Context) {
        DengageLiveUpdateManager.register(ACTIVITY_TYPE, Handler())
        /* Channel creation is idempotent, and doing it here rather than in the
           handler means the channel exists before the first payload lands. */
        ensureChannel(context)
    }

    fun isActive(): Boolean =
        runCatching { DengageLiveUpdateManager.isActive(ACTIVITY_TYPE) }.getOrDefault(false)

    /* ---------------------------------------------------------- local demo --

       Plays the whole mortgage sequence on this device, with no server.

       WHY THIS IS LEGITIMATE RATHER THAN A MOCK. Everything visible in a Live
       Update on Android is drawn by THIS class: the SDK's only job is to parse
       the FCM payload and hand the resulting LiveUpdatePayload to the
       registered handler. Building the same payload here and calling the same
       handler exercises the identical rendering path. What is skipped is the
       transport, exactly as with the push gallery.

       LiveUpdatePayload and LiveUpdateEvent are public model classes, so this
       needs no reflection and no private API.

       What it does not prove is delivery: that a real /liveActivity/start
       reached the handset. Say so in a demo. */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    @Volatile private var demoRunning = false

    private data class Step(val event: LiveUpdateEvent, val stage: String, val detail: String, val percent: Int)

    private val SEQUENCE = listOf(
        Step(LiveUpdateEvent.START,  "Submitted",        "We have your application",     20),
        Step(LiveUpdateEvent.UPDATE, "Valuation booked", "Surveyor visiting Tuesday",    45),
        Step(LiveUpdateEvent.UPDATE, "Underwriting",     "Checking affordability",       75),
        Step(LiveUpdateEvent.END,    "Offer issued",     "Your mortgage offer is ready", 100),
    )

    fun playLocally(context: Context, onProgress: (String) -> Unit) {
        if (demoRunning) {
            onProgress("Already running. It takes about thirty seconds.")
            return
        }
        demoRunning = true
        val handler = Handler()
        val activityId = "MRD-APP-" + (System.currentTimeMillis() % 1_000_000)

        scope.launch {
            try {
                SEQUENCE.forEachIndexed { index, step ->
                    handler.onUpdate(
                        context,
                        LiveUpdatePayload(
                            ACTIVITY_TYPE,
                            step.event,
                            activityId,
                            mapOf(
                                Keys.STAGE to step.stage,
                                Keys.DETAIL to step.detail,
                                Keys.PERCENT to step.percent.toString(),
                                Keys.REFERENCE to activityId,
                            ),
                            null,
                        )
                    )
                    onProgress("${index + 1} of 4, ${step.stage} at ${step.percent}%")
                    if (step.event != LiveUpdateEvent.END) delay(9_000)
                }
                onProgress("Done. One notification, four states, changed in place.")
            } catch (e: Throwable) {
                onProgress("Live update demo failed: ${e.message}")
            } finally {
                demoRunning = false
            }
        }
    }

    fun isRegistered(): Boolean =
        runCatching { DengageLiveUpdateManager.isRegistered(ACTIVITY_TYPE) }.getOrDefault(false)

    private fun ensureChannel(context: Context) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
        mgr.createNotificationChannel(
            android.app.NotificationChannel(
                CHANNEL_ID, "Application progress",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Live progress of an application or a payment"
                setShowBadge(false)
            }
        )
    }

    class Handler : LiveUpdateHandler {

        /* Kotlin properties, not getters: the interface declares vals, and
           overriding a Java-style accessor compiles to nothing. */
        override val channelId: String = CHANNEL_ID
        override val channelName: String = "Application progress"
        override val channelDescription: String = "Live progress of an application or a payment"

        override fun buildNotification(context: Context, payload: LiveUpdatePayload): Notification {
            val state = payload.contentState.orEmpty()
            val stage = state[Keys.STAGE] ?: "In progress"
            val detail = state[Keys.DETAIL] ?: ""
            val reference = state[Keys.REFERENCE] ?: ""
            val percent = state[Keys.PERCENT]?.toIntOrNull()?.coerceIn(0, 100) ?: 0
            val ended = payload.event == LiveUpdateEvent.END

            /* Tapping it opens the app at the application screen. Same
               meridian:// routing every push here uses, so there is one way in
               rather than two. */
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("meridian://accounts"))
                .setPackage(context.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pending = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val title = if (reference.isBlank()) "Your application"
            else "Your application $reference"

            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_meridian)
                .setContentTitle(title)
                .setContentText(if (detail.isBlank()) stage else "$stage, $detail")
                .setSubText(stage)
                .setProgress(100, percent, ended.not() && percent == 0)
                /* Ongoing while it is in progress, so it holds its place and
                   cannot be swiped away mid-application. On END it becomes an
                   ordinary notification: readable, dismissible, and gone when
                   the customer taps it. */
                .setOngoing(!ended)
                .setAutoCancel(ended)
                /* Insurance against a stranded notification, see onUpdate.
                   Twelve hours is longer than any demo and shorter than for
                   ever. */
                .setTimeoutAfter(12 * 60 * 60 * 1000L)
                .setOnlyAlertOnce(true)
                .setContentIntent(pending)
                .setStyle(NotificationCompat.BigTextStyle().bigText(
                    listOfNotNull(
                        stage.takeIf { it.isNotBlank() },
                        detail.takeIf { it.isNotBlank() },
                    ).joinToString("\n")
                ))
                .build()
        }

        /* Called for START, UPDATE and END alike. Re-notifying with the same
           id is what makes the notification change in place rather than stack,
           which is the entire visual point of the feature.

           END NO LONGER CANCELS. It used to, and that threw away the payoff:
           the 100% bar and "Offer issued" flashed and vanished, so the one
           frame worth showing in a demo was the one nobody saw. It now posts
           the final state as an ordinary dismissible notification instead.

           setTimeoutAfter is the insurance against a stranded notification:
           Android removes it after the window even when no END arrives, for
           example when the app is killed mid-activity. */
        override fun onUpdate(context: Context, payload: LiveUpdatePayload) {
            val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val id = payload.activityId?.hashCode() ?: ACTIVITY_TYPE.hashCode()
            mgr.notify(id, buildNotification(context, payload))
        }
    }
}
