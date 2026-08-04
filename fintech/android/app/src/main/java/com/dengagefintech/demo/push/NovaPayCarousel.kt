package com.dengagefintech.demo.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.dengage.sdk.Dengage
import com.dengage.sdk.domain.push.model.Message
import com.dengagefintech.demo.R

/**
 * CAROUSEL PUSH RENDERER: a carousel notification the app draws itself.
 *
 * Do not remove: required for correct behaviour with this SDK version.
 * Background: ask Salil.
 *
 * A HOST-RENDERED NOTIFICATION MUST STILL REPORT THE OPEN. Opens are reported
 * through Dengage.sendOpenEvent so they land on the campaign. Skip it and the
 * campaign reads zero opens and an A/B test can never pick a winner.
 *
 * Everything below is NovaPay's own content. The shape is generic; the cards,
 * copy and deep links are this app's.
 */
object NovaPayCarousel {

    private const val CHANNEL_ID = "novapay_carousel"
    private const val NOTIFICATION_ID = 7311
    const val ACTION_PAGE = "com.dengagefintech.demo.CAROUSEL_PAGE"
    private const val EXTRA_INDEX = "index"

    private data class Item(val title: String, val body: String, val image: Int, val screen: String)

    private val ITEMS = listOf(
        Item("Travel card", "No FX markup, anywhere you spend",
             R.drawable.npy_carousel_travel, "products"),
        Item("Savings goals", "Round up every purchase into a goal",
             R.drawable.npy_carousel_savings, "grow"),
        Item("Metal card", "Cashback on everything, metal in the hand",
             R.drawable.npy_carousel_card, "cards")
    )

    /** Set when a real carousel push arrives, so the open reports against it. */
    @Volatile private var sourceMessage: Map<String, String>? = null

    fun channel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Offers",
                NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Carousel offers drawn by the app"
            }
        )
    }

    /** True only for a push this object can draw COMPLETELY. Anything else must
     *  fall through to the SDK untouched: an intercept that half works is worse
     *  than no intercept. */
    fun handles(data: Map<String, String>): Boolean =
        data["notificationType"].equals("CAROUSEL", ignoreCase = true) ||
        data["messageDetails"]?.contains("CAROUSEL") == true

    fun show(context: Context, index: Int = 0, fromPush: Map<String, String>? = null): String {
        return runCatching {
            channel(context)
            if (fromPush != null) sourceMessage = fromPush
            val i = ((index % ITEMS.size) + ITEMS.size) % ITEMS.size
            val item = ITEMS[i]

            val views = RemoteViews(context.packageName, R.layout.push_carousel).apply {
                setTextViewText(R.id.npy_title, item.title)
                setTextViewText(R.id.npy_body, item.body)
                setImageViewResource(R.id.npy_image, item.image)
                setTextViewText(R.id.npy_position, "${i + 1} of ${ITEMS.size}")
                setOnClickPendingIntent(R.id.npy_prev, page(context, i - 1))
                setOnClickPendingIntent(R.id.npy_next, page(context, i + 1))
            }

            val open = Intent(Intent.ACTION_VIEW, Uri.parse("novapay://${item.screen}")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }

            val n = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_novapay)
                .setContentTitle(item.title)
                .setContentText(item.body)
                .setCustomBigContentView(views)
                .setStyle(NotificationCompat.DecoratedCustomViewStyle())
                .setOnlyAlertOnce(true)
                .setAutoCancel(true)
                .setContentIntent(
                    PendingIntent.getActivity(context, 900 + i, open,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                .build()

            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .notify(NOTIFICATION_ID, n)

            reportOpenIfReal()
            "carousel drawn, card ${i + 1} of ${ITEMS.size}. Back and Next page in place."
        }.getOrElse { "carousel failed: ${it.message}" }
    }

    /** Only meaningful for a real campaign push. A locally drawn card has no
     *  campaign to report against, so nothing is sent and nothing is faked. */
    private fun reportOpenIfReal() {
        val src = sourceMessage ?: return
        runCatching {
            Dengage.sendOpenEvent("", "", Message.createFromMap(src))
        }
    }

    private fun page(context: Context, index: Int): PendingIntent {
        val i = Intent(context, PageReceiver::class.java).apply {
            action = ACTION_PAGE
            putExtra(EXTRA_INDEX, index)
            setPackage(context.packageName)
        }
        return PendingIntent.getBroadcast(context, 800 + index, i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    class PageReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != ACTION_PAGE) return
            show(context, intent.getIntExtra(EXTRA_INDEX, 0))
        }
    }
}
