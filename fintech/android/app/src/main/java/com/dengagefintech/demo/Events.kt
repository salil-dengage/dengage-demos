package com.dengagefintech.demo

import com.dengage.sdk.Dengage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The NovaPay event layer, mirroring fintech/js/novapayEvents.js.
 *
 * SAME TABLES AS THE WEBSITE, told apart by event_source. That is what lets one
 * segment cover both surfaces, and it is what fintech/EVENT-MODEL.md assumes.
 *
 * THE NINE COLUMN SPINE. Six are written here; three are written by the SDK
 * (session_id, dn_contact_key, dn_device_id) and must NOT be set by hand.
 *
 * COLUMN NAMES ARE A CONTRACT. Every name here is mirrored from the website's
 * own event layer and asserted by ParityTest, never retyped. The row in Data
 * Space is the only proof a column stored, so verify a new column there.
 *
 * NEVER INVENT A VALUE. If the site does not track a figure, this does not send
 * one. There is no stock_count here: a card has no unit count and a fabricated
 * number poisons every segment built on it.
 */
object Events {

    /** Table names, mirrored from TABLES in novapayEvents.js. */
    object Tables {
        const val ONBOARDING  = "fintech_onboarding_events"
        const val ACCOUNT     = "fintech_account_events"
        const val TRANSACTION = "fintech_transaction_events"
        const val CARD        = "fintech_card_events"
        const val SAVINGS     = "fintech_savings_events"
        const val INVESTMENT  = "fintech_investment_events"
        const val CREDIT      = "fintech_credit_events"
        const val PRODUCT     = "fintech_product_events"
        const val SUPPORT     = "fintech_support_events"
        const val ENGAGEMENT  = "fintech_engagement_events"

        val ALL = listOf(ONBOARDING, ACCOUNT, TRANSACTION, CARD, SAVINGS,
                         INVESTMENT, CREDIT, PRODUCT, SUPPORT, ENGAGEMENT)
    }

    /** The six spine columns this app writes. The other three are the SDK's. */
    val SPINE_WRITTEN = listOf(
        "event_type", "event_source", "page_path",
        "is_authenticated", "customer_tier", "app_version"
    )
    val SPINE_SDK_OWNED = listOf("session_id", "dn_contact_key", "dn_device_id")

    /* ------------------------------------------------------------ formats
       DATE      yyyy-MM-dd
       DATETIME  yyyy-MM-dd HH:mm     no seconds, no T, no Z, no offset

       These exact formats are the storage contract, not ISO 8601. A 200 means
       accepted; the row in Data Space is the only proof, so confirm any format
       change there. */
    private val DATE = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val DATETIME = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)

    fun date(d: Date = Date()): String = DATE.format(d)
    fun dateTime(d: Date = Date()): String = DATETIME.format(d)

    /* -------------------------------------------------------------- helpers
       Mirrors clean() in novapayEvents.js: null, empty and non-finite are
       DROPPED rather than coerced. Number(null) === 0 has produced a real bug
       in this repository twice. false and 0 are kept: they are answers. */
    private fun clean(payload: Map<String, Any?>): Map<String, Any> {
        val out = LinkedHashMap<String, Any>()
        for ((k, v) in payload) {
            when (v) {
                null -> continue
                is String -> if (v.isEmpty()) continue else out[k] = v
                is Double -> if (!v.isFinite()) continue else out[k] = v
                is Float -> if (!v.isFinite()) continue else out[k] = v
                else -> out[k] = v
            }
        }
        return out
    }

    /** Money travels as a number with 2 decimals. Never formatted, never minor units. */
    fun money(n: Double?): Double? {
        if (n == null || !n.isFinite()) return null
        return Math.round(n * 100.0) / 100.0
    }

    /** Kept in step with balanceBand() in novapayEvents.js and EVENT-MODEL.md. */
    fun balanceBand(n: Double?): String? = when {
        n == null || !n.isFinite() -> null
        n < 0 -> "negative"
        n < 100 -> "0-99"
        n < 500 -> "100-499"
        n < 2000 -> "500-1999"
        n < 10000 -> "2000-9999"
        else -> "10000+"
    }

    /** Kept in step with creditScoreBand() in novapayEvents.js. */
    fun creditScoreBand(n: Int?): String? = when {
        n == null -> null
        n < 560 -> "poor"
        n < 620 -> "fair"
        n < 720 -> "good"
        n < 800 -> "very_good"
        else -> "excellent"
    }

    /* ------------------------------------------------------------- sending */

    /** Screen currently in front of the user, used as page_path. */
    @Volatile var currentScreen: String = Screen.SIGN_IN

    /** Whether a customer is signed in, and their plan tier. Set by DemoState. */
    @Volatile var isAuthenticated: Boolean = false
    @Volatile var customerTier: String = "prospect"

    fun send(table: String, eventType: String, payload: Map<String, Any?> = emptyMap()) {
        val row = LinkedHashMap<String, Any?>(payload)
        row["event_type"] = eventType
        row["event_source"] = DengageKeys.EVENT_SOURCE
        // The website sends a full URL. The app has no URL, so it sends the
        // screen name, which is the equivalent "where was the customer".
        row["page_path"] = currentScreen
        row["is_authenticated"] = isAuthenticated
        row["customer_tier"] = customerTier
        row["app_version"] = DengageKeys.APP_VERSION
        EventQueue.enqueue(table, eventType, clean(row))
    }

    /* ------------------------------------------------------------ page view

       THE ONE STANDARD DENGAGE TABLE THIS APP WRITES, and the only place a
       first-class SDK action is used instead of sendDeviceEvent.

       Everything else goes to the purpose-built fintech_* tables, because a
       money app has no cart, no basket total and no order, so the ecommerce
       tables could only be filled with invented figures. pageView is the
       exception worth making: it is industry neutral, the website already
       sends it from js/pageView.js, and it is what a "last seen" or a browse
       abandon journey reads without any custom table at all.

       page_type MIRRORS THE WEBSITE'S VOCABULARY one for one, so a segment
       written on page_type covers the app and the site together. Every value
       here has a page on the site: home = app.html, money = money.html, and
       so on.

       NO price AND NO discounted_price, EVER. A NovaPay product is a card, a
       plan or a portfolio: it has a monthly fee or a rate, not a shelf price,
       and the catalogue carries no such figure. Sending 0 to fill the column
       would be a fabricated value in every segment built on it. */
    private val PAGE_TYPE = mapOf(
        Screen.HOME     to "home",
        Screen.MONEY    to "money",
        Screen.CARDS    to "cards",
        Screen.GROW     to "grow",
        Screen.PRODUCTS to "products",
        Screen.INBOX    to "inbox",

        /* The journeys map onto the website page the same flow lives on, and
           they do NOT introduce page types of their own. page_type is shared
           with the site so one segment covers both surfaces, and a value with
           no page behind it would break that the moment somebody wrote a
           segment on it. Sending and topping up happen on money.html; applying
           happens on products.html.

           Screen.VERIFY is absent for the same reason and not by oversight:
           identity verification is a gate on the website rather than a page,
           exactly like signing in, so it reports its screen name for In-App
           targeting and writes no page view. The KYC funnel is already
           recorded, in fintech_onboarding_events, where it belongs. */
        Screen.SEND_MONEY to "money",
        Screen.TOP_UP     to "money",
        Screen.DISPUTE    to "money",
        Screen.APPLY      to "products"
    )

    /**
     * Fires a page view for a customer-facing screen, and deliberately nothing
     * for the demo scaffolding.
     *
     * sign_in, test, events and identity are the control panel rather than the
     * product. A page view from them would put rows in a customer's history
     * that no customer ever generated, which is exactly the kind of invented
     * data that makes a segment untrustworthy.
     */
    fun pageViewForScreen(screen: String) {
        PAGE_TYPE[screen]?.let { pageView(it) }
    }

    /**
     * The SDK sends this one itself, so it does NOT go through EventQueue.
     * Recorded in the queue's log afterwards so the Events screen shows it
     * beside the custom rows rather than pretending it did not happen.
     */
    fun pageView(pageType: String, productId: String? = null, categoryPath: String? = null) {
        val data = HashMap<String, Any>()
        data["page_type"] = pageType
        productId?.let { if (it.isNotBlank()) data["product_id"] = it }
        categoryPath?.let { if (it.isNotBlank()) data["category_path"] = it }
        runCatching { Dengage.pageView(data) }
        EventQueue.notePageView(data)
    }

    // One helper per table, same shape as the website's event layer.
    fun onboarding(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.ONBOARDING, t, p)
    fun account(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.ACCOUNT, t, p)
    fun transaction(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.TRANSACTION, t, p)
    fun card(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.CARD, t, p)
    fun savings(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.SAVINGS, t, p)
    fun investment(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.INVESTMENT, t, p)
    fun credit(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.CREDIT, t, p)
    fun product(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.PRODUCT, t, p)
    fun support(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.SUPPORT, t, p)
    fun engagement(t: String, p: Map<String, Any?> = emptyMap()) = send(Tables.ENGAGEMENT, t, p)
}
