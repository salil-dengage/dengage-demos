package com.dengagebanking.demo.push

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.dengage.sdk.Dengage
import com.dengage.sdk.domain.push.model.Message
import com.dengage.sdk.util.DengageLogger
import com.dengagebanking.demo.R
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/* ============================================================================
   CAROUSEL PUSH RENDERER

   This app draws the carousel format itself, routed through the SDK's own
   payload parsing and click reporting (Dengage.sendOpenEvent), so opens land
   on the campaign.

   WHY DRAWING IT HERE IS LEGITIMATE, NOT A MOCK. The payload is Dengage's,
   delivered over FCM by Dengage and parsed by the SDK's own payload parsing,
   and every interaction reports back through Dengage.sendOpenEvent, so opens
   and item clicks land in the panel exactly as they would otherwise. The only
   part that moves is which class inflates the RemoteViews. The SDK exposes a
   protected override point for carousel rendering, so a host app taking over
   carousel rendering is a supported shape.

   THE SAFETY RULE THIS FILE OBEYS: never swallow a message. handles() is
   deliberately narrow, render() reports whether it took responsibility, and
   MeridianFcmService falls back to the SDK whenever it returns false. A
   carousel with no parseable items, a live update, a geofence push and every
   other format go to the SDK untouched.

   Do not remove this file, or the routing in MeridianFcmService that feeds
   it: required for correct behaviour with this SDK version. Background:
   ask Salil.
   ========================================================================== */
object MeridianCarousel {

    /** One card. Mirrors com.dengage.sdk.domain.push.model.CarouselItem. */
    private data class Card(
        val id: String,
        val title: String,
        val description: String,
        val mediaUrl: String,
        val targetUrl: String,
    )

    /**
     * True only for a payload this file can render completely. Anything else,
     * including a carousel whose items will not parse, is left to the SDK.
     *
     * The two guards below matter more than they look. A Live Update and a
     * geofence push are dispatched by notificationType-independent keys, and
     * swallowing either was a real bug on this app once already.
     */
    fun handles(data: Map<String, String>): Boolean {
        if (data.containsKey("live_notification")) return false
        if (data["sourceType"] == "geofence") return false
        if (!data["notificationType"].equals("CAROUSEL", ignoreCase = true)) return false
        return parse(data).isNotEmpty()
    }

    /**
     * Draws the carousel at [index], wrapping around at both ends.
     *
     * @return true when a notification was posted, false when the caller should
     *         fall back to the SDK. Any failure returns false rather than
     *         throwing, because a push that renders imperfectly is worth more
     *         than a push that disappears.
     */
    fun render(context: Context, data: Map<String, String>, index: Int = 0): Boolean =
        runCatching { post(context.applicationContext, data, index) }
            .onFailure { DengageLogger.error("Meridian carousel: " + it.message) }
            .getOrDefault(false)

    // ------------------------------------------------------------- rendering

    private fun post(context: Context, data: Map<String, String>, index: Int): Boolean {
        val cards = parse(data)
        if (cards.isEmpty()) return false

        /* Wrap, so the arrows never dead end. Kotlin's rem keeps the sign of
           the dividend, hence the extra + size before the second rem. */
        val current = ((index % cards.size) + cards.size) % cards.size
        val card = cards[current]

        val manager = NotificationManagerCompat.from(context)
        ensureChannel(context)

        val body = RemoteViews(context.packageName, R.layout.meridian_carousel).apply {
            setTextViewText(
                R.id.meridian_carousel_position,
                "${current + 1} of ${cards.size}"
            )
            setOnClickPendingIntent(
                R.id.meridian_carousel_previous,
                navigationIntent(context, data, current - 1)
            )
            setOnClickPendingIntent(
                R.id.meridian_carousel_next,
                navigationIntent(context, data, current + 1)
            )
            /* Cache only. Downloading here would run on whatever thread posted
               the push, which for the Test Area is the main thread, and the
               first card then arrived with no picture at all:

                   Meridian carousel image: null

               is NetworkOnMainThreadException, whose message is null. The
               notification goes out immediately either way and the picture
               arrives a beat later, which beats blocking the UI thread and
               beats a card with a hole in it. */
            cache[card.mediaUrl]?.let { setImageViewBitmap(R.id.meridian_carousel_image, it) }
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(card.title.ifBlank { data["title"].orEmpty() })
            .setContentText(card.description.ifBlank { data["message"].orEmpty() })
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomBigContentView(body)
            .setContentIntent(openIntent(context, data, current))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)   // paging must not re-buzz the phone
            .setDefaults(Notification.DEFAULT_ALL)
            .build()

        manager.notify(notificationId(data), notification)

        /* The picture for THIS card, if it is not cached yet: fetch, then draw
           the same notification again with it. Bounded, because the second
           pass finds it in the cache and this branch is skipped. */
        if (!cache.containsKey(card.mediaUrl)) {
            io.execute {
                if (fetchInto(card.mediaUrl)) {
                    main.post { runCatching { post(context, data, current) } }
                }
            }
        }

        /* And the neighbours, so an arrow press is instant rather than showing
           a card that fills in a moment later. */
        if (cards.size > 1) {
            io.execute { fetchInto(cards[(current + 1) % cards.size].mediaUrl) }
            io.execute { fetchInto(cards[(current - 1 + cards.size) % cards.size].mediaUrl) }
        }
        return true
    }

    /* A carousel image sits in a RemoteViews, which crosses a Binder
       transaction capped at roughly 1MB, so it is bounded here rather than
       trusted. 512px wide is 512KB decoded at the layout's aspect ratio and
       is more than a notification can show. */
    private const val MAX_WIDTH = 512

    private val cache = ConcurrentHashMap<String, Bitmap>()
    private val io = Executors.newSingleThreadExecutor { r ->
        Thread(r, "meridian-carousel").apply { isDaemon = true }
    }

    private val main = Handler(Looper.getMainLooper())

    /** @return true when the cache gained a picture it did not have. */
    private fun fetchInto(url: String): Boolean {
        if (url.isBlank() || cache.containsKey(url)) return false
        val bitmap = runCatching { download(url) }
            .onFailure { DengageLogger.error("Meridian carousel image: $url: " + it) }
            .getOrNull() ?: return false
        cache[url] = bitmap
        return true
    }

    private fun download(url: String): Bitmap? {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
            instanceFollowRedirects = true
        }
        val bytes = try {
            connection.inputStream.use { input ->
                ByteArrayOutputStream().also { input.copyTo(it) }.toByteArray()
            }
        } finally {
            connection.disconnect()
        }

        /* Two passes: measure, then decode subsampled. Decoding a large image
           at full size only to scale it down is how an image loader runs a
           notification out of memory. */
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / sample > MAX_WIDTH * 2) sample *= 2

        val decoded = BitmapFactory.decodeByteArray(
            bytes, 0, bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample }
        ) ?: return null

        if (decoded.width <= MAX_WIDTH) return decoded
        val height = (decoded.height.toLong() * MAX_WIDTH / decoded.width).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(decoded, MAX_WIDTH, height, true)
            .also { if (it !== decoded) decoded.recycle() }
    }

    // -------------------------------------------------------------- payload

    private fun parse(data: Map<String, String>): List<Card> {
        val raw = data["carouselContent"] ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { i ->
                val o = array.optJSONObject(i) ?: return@mapNotNull null
                val media = o.optString("mediaUrl")
                if (media.isBlank()) return@mapNotNull null
                Card(
                    id = o.optString("id"),
                    title = o.optString("title"),
                    description = o.optString("description").ifBlank { o.optString("desc") },
                    mediaUrl = media,
                    targetUrl = o.optString("targetUrl"),
                )
            }
        }.getOrDefault(emptyList())
    }

    /* One notification per message, so paging replaces the card in place
       instead of stacking a new notification per press. */
    private fun notificationId(data: Map<String, String>): Int {
        val key = data["transactionId"].orEmpty().ifBlank { data["messageId"].orEmpty() }
        return if (key.isBlank()) CHANNEL_ID.hashCode() else key.hashCode()
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.meridian_carousel_channel),
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )
    }

    private fun smallIcon(context: Context): Int {
        val id = context.resources.getIdentifier(
            "ic_stat_meridian", "drawable", context.packageName
        )
        return if (id != 0) id else context.applicationInfo.icon
    }

    // --------------------------------------------------------- interactions

    private fun flags() =
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    private fun carry(intent: Intent, data: Map<String, String>) {
        data.forEach { (k, v) -> intent.putExtra(k, v) }
    }

    private fun navigationIntent(context: Context, data: Map<String, String>, to: Int) =
        PendingIntent.getBroadcast(
            context,
            (notificationId(data) + to).hashCode(),
            Intent(context, Receiver::class.java).apply {
                action = ACTION_PAGE
                setPackage(context.packageName)
                carry(this, data)
                putExtra(EXTRA_INDEX, to)
            },
            flags()
        )

    private fun openIntent(context: Context, data: Map<String, String>, at: Int) =
        PendingIntent.getBroadcast(
            context,
            (notificationId(data) + OPEN_OFFSET + at).hashCode(),
            Intent(context, Receiver::class.java).apply {
                action = ACTION_OPEN
                setPackage(context.packageName)
                carry(this, data)
                putExtra(EXTRA_INDEX, at)
            },
            flags()
        )

    /**
     * Paging and taps. Declared in the manifest rather than registered at
     * runtime, deliberately: a manifest receiver survives the process being
     * killed between the notification being posted and the customer pressing
     * an arrow.
     */
    class Receiver : BroadcastReceiver() {

        override fun onReceive(context: Context?, intent: Intent?) {
            val ctx = context?.applicationContext ?: return
            val extras = intent?.extras ?: return
            /* get, not getString. The bundle also carries the page index as an
               Int, and getString on it logs a ClassCastException stack trace
               every single time an arrow is pressed. It is only a warning, the
               value comes back null and the map is still right, but a demo
               build should not be printing stack traces on a button press. */
            @Suppress("DEPRECATION")
            val data = extras.keySet()
                .mapNotNull { key -> (extras.get(key) as? String)?.let { key to it } }
                .toMap()
            val index = extras.getInt(EXTRA_INDEX, 0)

            when (intent.action) {
                ACTION_PAGE -> render(ctx, data, index)
                ACTION_OPEN -> open(ctx, data, index)
            }
        }

        private fun open(context: Context, data: Map<String, String>, index: Int) {
            val cards = parse(data)
            val card = cards.getOrNull(index)

            /* Report through the SDK, so the open lands on the campaign in the
               panel exactly as it would if the SDK had drawn the notification.
               This is what keeps the numbers honest. */
            runCatching {
                Dengage.sendOpenEvent("", card?.id.orEmpty(), Message.createFromMap(data))
            }.onFailure { DengageLogger.error("Meridian carousel open: " + it.message) }

            NotificationManagerCompat.from(context).cancel(notificationId(data))

            val target = card?.targetUrl?.takeIf { it.isNotBlank() }
                ?: data["targetUrl"].orEmpty()
            val launch = if (target.isNotBlank()) {
                Intent(Intent.ACTION_VIEW, Uri.parse(target))
                    .setPackage(context.packageName)
            } else {
                context.packageManager.getLaunchIntentForPackage(context.packageName)
            } ?: return

            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(launch) }
                .onFailure { DengageLogger.error("Meridian carousel target: " + it.message) }
        }
    }

    private const val CHANNEL_ID = "meridian_carousel"
    private const val EXTRA_INDEX = "meridianCarouselIndex"
    private const val OPEN_OFFSET = 10_000
    private const val ACTION_PAGE = "com.dengagebanking.demo.carousel.PAGE"
    private const val ACTION_OPEN = "com.dengagebanking.demo.carousel.OPEN"
}
