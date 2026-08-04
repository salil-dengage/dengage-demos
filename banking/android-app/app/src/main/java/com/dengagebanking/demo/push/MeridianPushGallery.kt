package com.dengagebanking.demo.push

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.dengage.sdk.push.NRTrampoline
import com.dengagebanking.demo.DengageKeys
import org.json.JSONArray
import org.json.JSONObject

/* ============================================================================
   THE MERIDIAN PUSH GALLERY

   Every push capability Dengage offers, rendered on this device with
   Meridian's own copy and artwork, and no network involved.

   WHY THIS EXISTS. A gallery of every push format, rendered with Meridian's
   own copy and artwork, self-contained and on brand for a bank demo.

   HOW IT WORKS, AND WHY IT IS NOT A MOCK. This hands the SDK's own receiving
   path the same intent a real payload produces, carrying the keys a real
   payload carries. What appears on screen is drawn by the Dengage SDK, from a
   Dengage payload, in every respect except that the bytes were assembled here
   rather than arriving over FCM. Calling the receiver directly is deliberate.
   Do not route this through Dengage.onMessageReceived: required for correct
   behaviour with this SDK version. Background: ask Salil.

   WHAT IT PROVES, AND WHAT IT DOES NOT. It proves how every format renders and
   how this app handles it: tap routing, deep links, custom parameters, inbox
   copies, action buttons. It does not prove DELIVERY, because nothing was
   delivered, and it does not prove SERVER-SIDE PERSONALISATION, because there
   is no server here to resolve a tag. Both need a real send. The personalised
   rows carry the resolved OUTPUT plus the exact tag to paste into the panel,
   so the same thing can be proven properly in one send.

   Payload keys and JSON shapes match what this SDK version reads. Keep them
   exactly as written.

   Capability list from dev.dengage.com/docs/create-a-push-content and
   /docs/advanced-personalization-in-push-notifications.
   ========================================================================== */
object MeridianPushGallery {

    /* CAROUSEL ARTWORK IS 200x200 AND MUST STAY SMALL. A notification's
       RemoteViews crosses a Binder transaction capped at roughly 1MB, and the
       carousel puts THREE decoded bitmaps in one, so all three have to fit
       inside that budget. At 600x600 each is 1.44MB decoded, 4.3MB together,
       well past the cap. The rich format tolerates larger artwork because
       BigPictureStyle carries one image and Android downsamples it. 200x200
       is 160KB decoded, 480KB for three. */
    private const val IMG = "https://salil-dengage.github.io/dengage-demos/banking/images/push"

    /**
     * @param panelTag when set, the Advanced Personalization to paste into the
     *        panel's Title or Message to reproduce this row on a real send.
     *        Shown on screen, because a local render cannot resolve a tag.
     */
    data class Format(
        val key: String,
        val label: String,
        val note: String,
        val panelTag: String? = null,
    )

    val FORMATS: List<Format> = listOf(
        // ----------------------------------------------------------- formats
        Format("text", "Text only",
            "Title and message. The everyday one."),
        Format("subtext", "Subtext, emoji, badge and sound",
            "Every Android option on one notification: subtext, an emoji, a badge count, a sound."),
        Format("rich", "Rich, with an image",
            "Expands to a full width image. Pull it down."),
        Format("buttons", "Rich with action buttons",
            "Two buttons that settle a fraud query without opening the app."),
        Format("carousel", "Carousel, three cards",
            "Swipe through three products inside the notification."),

        // -------------------------------------------------------- behaviours
        Format("deeplink", "Deep link to Wealth",
            "Opens the Wealth screen, not the app's front door."),
        Format("params", "Custom parameters",
            "Carries data the customer never sees. screen=wealth even overrides the target URL."),
        Format("inbox", "Also saved to App Inbox",
            "Carries addToInbox. The copy needs a real send: the inbox is read from the server."),
        Format("silent", "Silent, draws nothing",
            "No banner, by design. Writes an engagement row instead."),
        Format("expiring", "With an expiry",
            "A rate offer that has closed should not resurface."),

        // ------------------------------------------------------ personalised
        Format("perso_name", "Personalised by name",
            "Resolved output shown here; Dengage fills the tag at send time.",
            panelTag = "Good morning, {%= \$Contact.first_name %}"),
        Format("perso_fallback", "Personalised, with a fallback",
            "The same message for a contact with no name, which is the case that embarrasses a demo.",
            panelTag = "{% if (\$Contact.first_name) { %}Good morning, " +
                "{%= \$Contact.first_name %}{% } else { %}Good morning{% } %}"),
        Format("perso_data", "Personalised from your data",
            "A balance and a date from the contact, formatted server side.",
            panelTag = "Your balance is {%= \$Contact.balance %} as of " +
                "{%= FormatDate(\$Contact.statement_date, 'dd MMM') %}"),
        Format("perso_carousel", "Carousel of two, not three",
            "Personalisation can vary the NUMBER of carousel items per recipient.",
            panelTag = "JSON dynamic content on the carousel"),
    )

    /**
     * Renders one row on this device.
     *
     * @return a line fit to show on screen. Silent correctly produces nothing
     *         visible, and the line is where that gets said.
     */
    fun show(context: Context, key: String): String {
        app = context.applicationContext
        return render(key)
    }

    private var app: Context? = null

    private fun render(key: String): String = when (key) {

        "text" -> {
            post(
                title = "Your August statement is ready",
                message = "A summary of what came in, what went out and what changed.",
                targetUrl = screen(DengageKeys.Screen.ACCOUNTS),
            )
            "Drew the text notification."
        }

        "subtext" -> {
            post(
                title = "Rate Week ends Friday 🏡",
                message = "Fixed rates held until Friday for existing customers.",
                subTitle = "Mortgages",
                targetUrl = screen(DengageKeys.Screen.PRODUCTS),
                badgeCount = 3,
            )
            "Drew it with subtext, an emoji, a badge of 3 and the default sound."
        }

        "rich" -> {
            post(
                title = "Rate Week ends Friday",
                message = "Fixed rates held until Friday for existing customers.",
                targetUrl = screen(DengageKeys.Screen.PRODUCTS),
                mediaUrl = "$IMG/rate-week.png",
                type = "RICH",
            )
            "Drew the rich notification. Expand it to see the image."
        }

        "buttons" -> {
            post(
                title = "Card used abroad",
                message = "A payment in Lisbon was authorised on your Platinum card.",
                targetUrl = screen(DengageKeys.Screen.CARDS),
                mediaUrl = "$IMG/travel.png",
                type = "RICH",
                buttons = listOf(
                    "That was me" to screen(DengageKeys.Screen.CARDS),
                    "Freeze card" to screen(DengageKeys.Screen.CARDS),
                ),
            )
            "Drew it with two action buttons."
        }

        "carousel" -> {
            post(
                title = "Three cards, one of them yours",
                message = "Swipe to compare what each is good at.",
                targetUrl = screen(DengageKeys.Screen.CARDS),
                type = "CAROUSEL",
                carousel = CARDS,
            )
            "Drew the carousel. Expand it and swipe."
        }

        "deeplink" -> {
            post(
                title = "Your portfolio moved this week",
                message = "Your balanced portfolio is up. See the breakdown.",
                targetUrl = screen(DengageKeys.Screen.WEALTH),
                mediaUrl = "$IMG/statement.png",
                type = "RICH",
            )
            "Drew it. Tapping it opens Wealth, not the front door."
        }

        "params" -> {
            post(
                title = "Your August statement is ready",
                message = "Tap it, then read the parameters on this screen.",
                targetUrl = screen(DengageKeys.Screen.ACCOUNTS),
                customParams = listOf(
                    "account_id" to "4471",
                    "statement_period" to "2026-08",
                    "screen" to DengageKeys.Screen.WEALTH,
                ),
            )
            "Drew it with three parameters. screen=wealth overrides the target " +
                "URL, so it opens Wealth rather than Accounts."
        }

        "inbox" -> {
            post(
                title = "Your Rate Week summary",
                message = "Kept in your inbox so you can come back to it.",
                targetUrl = screen(DengageKeys.Screen.INBOX),
                mediaUrl = "$IMG/rate-week.png",
                type = "RICH",
                addToInbox = true,
            )
            "Drew it carrying addToInbox. The copy will NOT appear in App " +
                "Inbox from here: the inbox is read from the server, and this " +
                "push never reached the server. Only a real send fills it."
        }

        "silent" -> {
            /* Deliberately not routed through the renderer: a silent push draws
               nothing, so rendering it would demonstrate an absence. The row is
               the observable part, and writing it is what the real silent
               handler does. */
            recordSilentRow()
            "Nothing drawn, which is correct. Wrote an engagement row with " +
                "placement = silent_push instead."
        }

        "expiring" -> {
            post(
                title = "Rate Week closes at midnight",
                message = "After that the offer is gone, and so is this message.",
                targetUrl = screen(DengageKeys.Screen.PRODUCTS),
                /* Already past, so the SDK's expiry check has something real to
                   act on rather than a date that never arrives. */
                expireDate = "2026-08-01 23:59:59",
            )
            "Sent one already past its expiry. A push that no longer applies " +
                "should not resurface."
        }

        "perso_name" -> {
            post(
                title = "Good morning, Eleanor",
                message = "Your balanced portfolio is up 2.1% this week.",
                targetUrl = screen(DengageKeys.Screen.WEALTH),
            )
            "Drew the RESOLVED output. Dengage fills the tag at send time; " +
                "paste the tag shown above into the panel to prove it end to end."
        }

        "perso_fallback" -> {
            post(
                title = "Good morning",
                message = "Your balanced portfolio is up 2.1% this week.",
                targetUrl = screen(DengageKeys.Screen.WEALTH),
            )
            "The same message for a contact with no first name. No dangling " +
                "comma, no \"Hello ,\". This is the case worth showing."
        }

        "perso_data" -> {
            post(
                title = "Your August statement is ready",
                message = "Your balance is £4,182.60 as of 01 Aug.",
                targetUrl = screen(DengageKeys.Screen.ACCOUNTS),
                customParams = listOf("account_id" to "4471"),
            )
            "Balance and date resolved from the contact. FormatDate does the " +
                "formatting server side, so the app never parses a date string."
        }

        "perso_carousel" -> {
            post(
                title = "Two cards picked for you",
                message = "Fewer, because only two suit how you actually spend.",
                targetUrl = screen(DengageKeys.Screen.CARDS),
                type = "CAROUSEL",
                carousel = CARDS.take(2),
            )
            "Two items rather than three, from one campaign."
        }

        else -> "Unknown format."
    }


    // -------------------------------------------------------------- content --

    /** title, description, image basename */
    private val CARDS = listOf(
        Triple("Everyday", "No monthly fee", "card-1"),
        Triple("Cashback", "1% back on bills", "card-2"),
        Triple("Travel", "No foreign fees", "card-3"),
    )

    private fun screen(name: String) = "meridian://$name"

    private fun recordSilentRow() {
        com.dengagebanking.demo.events.MeridianEvents.Engagement.inappShown(
            com.dengagebanking.demo.events.MeridianEvents.EngagementInput(
                campaignSlug = "gallery_silent",
                placement = "silent_push",
                offerCategory = "service",
            )
        )
    }

    // -------------------------------------------------------------- payload --

    /* The map mirrors what FCM delivers. Keep the key names exactly as
       written. */
    private fun post(
        title: String,
        message: String,
        targetUrl: String,
        subTitle: String? = null,
        mediaUrl: String? = null,
        type: String = "TEXT",
        carousel: List<Triple<String, String, String>> = emptyList(),
        buttons: List<Pair<String, String>> = emptyList(),
        customParams: List<Pair<String, String>> = emptyList(),
        addToInbox: Boolean = false,
        badgeCount: Int? = null,
        expireDate: String? = null,
    ) {
        val data = HashMap<String, String>()
        data["messageSource"] = "DENGAGE"
        /* A distinct id per push, so each is its own notification rather than
           replacing the last. */
        data["messageId"] = (System.currentTimeMillis() % 100_000).toString()
        data["title"] = title
        data["message"] = message
        data["targetUrl"] = targetUrl
        data["notificationType"] = type
        data["sound"] = "default"
        data["dengageCampName"] = "Meridian gallery"
        subTitle?.let { data["subTitle"] = it }
        mediaUrl?.let { data["mediaUrl"] = it }
        expireDate?.let { data["expireDate"] = it }
        if (addToInbox) data["addToInbox"] = "true"
        badgeCount?.let { data["badge"] = "true"; data["badgeCount"] = it.toString() }

        if (carousel.isNotEmpty()) {
            data["carouselContent"] = JSONArray().apply {
                carousel.forEachIndexed { i, (t, d, img) ->
                    put(JSONObject().apply {
                        put("id", "mrd-$i")
                        put("title", t)
                        put("description", d)
                        put("mediaUrl", "$IMG/$img.png")
                        put("targetUrl", screen(DengageKeys.Screen.CARDS))
                    })
                }
            }.toString()
        }

        if (buttons.isNotEmpty()) {
            data["actionButtons"] = JSONArray().apply {
                buttons.forEachIndexed { i, (text, url) ->
                    put(JSONObject().apply {
                        put("id", "mrd-btn-$i")
                        put("text", text)
                        put("targetUrl", url)
                        put("icon", "")
                    })
                }
            }.toString()
        }

        if (customParams.isNotEmpty()) {
            data["customParams"] = JSONArray().apply {
                customParams.forEach { (k, v) ->
                    put(JSONObject().put("key", k).put("value", v))
                }
            }.toString()
        }

        /* A locally drawn push never passes through the FCM service, so without
           this the Last push card stays empty and the custom parameters have
           nowhere to appear. */
        PushInspector.record(data)

        deliver(data)
    }

    /* The last step a real push takes before it becomes a notification: the
       payload, the parsing and the rendering are all the SDK's; only the
       transport is skipped. Calling the receiver directly rather than
       broadcasting is deliberate, see the note at the top of this file. */
    private val trampoline = NRTrampoline()

    private fun deliver(data: HashMap<String, String>) {
        val context = app ?: return

        /* Same one exception as MeridianFcmService: this app draws the
           carousel format itself. Routed through the same renderer a real
           send uses, so what the row shows is what a campaign shows rather
           than a second implementation that could drift. */
        if (MeridianCarousel.handles(data) && MeridianCarousel.render(context, data)) return

        ensureClickReceiver(context)
        val intent = Intent(ACTION_RECEIVE).apply {
            setPackage(context.packageName)
            /* A fresh random request code on every push, so two notifications
               cannot share a PendingIntent, which would make the second one
               open the first one's target. */
            putExtra("requestCode", (System.nanoTime() and 0x3FFFFFFF).toInt())
            data.forEach { (k, v) -> putExtra(k, v) }
        }
        trampoline.onReceive(context, intent)
    }

    /* ONE receiver, registered once per process, and the filter carries
       exactly ACTION_CLICK, ITEM_CLICK and CAROUSEL_ITEM_CLICK, nothing more.
       Do not add RECEIVE to this filter: required for correct behaviour with
       this SDK version. Background: ask Salil. */
    @Volatile private var clickReceiverRegistered = false

    private fun ensureClickReceiver(context: Context) {
        if (clickReceiverRegistered) return
        clickReceiverRegistered = true
        val filter = IntentFilter(ACTION_ACTION_CLICK).apply {
            addAction(ACTION_ITEM_CLICK)
            addAction(ACTION_CAROUSEL_ITEM_CLICK)
        }
        runCatching {
            ContextCompat.registerReceiver(
                context, trampoline, filter, ContextCompat.RECEIVER_NOT_EXPORTED
            )
        }
    }

    private const val ACTION_RECEIVE = "com.dengage.push.intent.RECEIVE"
    private const val ACTION_ACTION_CLICK = "com.dengage.push.intent.ACTION_CLICK"
    private const val ACTION_ITEM_CLICK = "com.dengage.push.intent.ITEM_CLICK"
    private const val ACTION_CAROUSEL_ITEM_CLICK = "com.dengage.push.intent.CAROUSEL_ITEM_CLICK"
}
