package com.dengagefintech.demo

import android.content.Context
import org.json.JSONObject

/**
 * The demo's own state: who is signed in and what their money looks like.
 *
 * Deliberately small and local. The point of this app is the Dengage
 * integration, not a banking engine, so the figures are seeded and only move
 * when the demo moves them.
 */
object DemoState {

    private const val PREFS = "novapay_demo"
    private const val K_EMAIL = "email"
    private const val K_NAME = "name"
    private const val K_TIER = "tier"

    /** Plan tier on the website maps onto the four SHARED finance tiers, so a
     *  segment built on customer_tier covers NovaPay and the banking demo
     *  alike. Mirrors customerTier() in novapayEvents.js. */
    fun tierFor(plan: String?): String = when (plan) {
        null, "" -> "prospect"
        "metal" -> "private"
        "premium" -> "premier"
        else -> "classic"
    }

    var email: String? = null; private set
    var displayName: String? = null; private set
    var plan: String = "standard"; private set

    val signedIn: Boolean get() = !email.isNullOrBlank()

    fun load(context: Context) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        email = p.getString(K_EMAIL, null)
        displayName = p.getString(K_NAME, null)
        plan = p.getString(K_TIER, "standard") ?: "standard"
        publish()
    }

    fun signIn(context: Context, name: String, mail: String, tier: String = "standard") {
        email = mail; displayName = name; plan = tier
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(K_EMAIL, mail).putString(K_NAME, name).putString(K_TIER, tier).apply()
        publish()
    }

    fun signOut(context: Context) {
        email = null; displayName = null; plan = "standard"
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        publish()
    }

    /** Keeps the two spine columns the event layer reads in step with reality. */
    private fun publish() {
        Events.isAuthenticated = signedIn
        Events.customerTier = if (signedIn) tierFor(plan) else "prospect"
    }

    /* ---------------------------------------------------------- seed money
       Figures match the website's seed so the two demos tell the same story. */
    const val BALANCE = 2480.00
    const val CURRENCY = "USD"
    const val CREDIT_SCORE = 712
    const val CREDIT_SCORE_LAST = 700

    data class Txn(val merchant: String, val amount: Double, val category: String,
                   val daysAgo: Int, val recurring: Boolean = false)

    val TRANSACTIONS = listOf(
        Txn("Acme Corp payroll", 3200.00, "salary", 2),
        Txn("Spotify", -9.99, "subscriptions", 3, recurring = true),
        Txn("Iberia", -186.40, "travel", 5),
        Txn("Whole Foods", -74.20, "groceries", 1),
        Txn("TfL", -12.80, "transport", 1)
    )

    data class Pot(val name: String, val saved: Double, val target: Double) {
        val pct: Int get() = if (target <= 0) 0 else ((saved / target) * 100).toInt()
    }

    val POTS = listOf(Pot("Japan 2027", 1520.0, 4000.0), Pot("Rainy day", 450.0, 3000.0))

    /* ------------------------------------------------------------------ cards
       EVERY FIELD HERE IS A COLUMN fintech_card_events DECLARES, and that is the
       reason the card model is the richest thing in this file. The table carries
       card_type, card_tier, reason, limit_type, limit_amount, delivery_status
       and days_since_order, and a screen holding one immutable card could fill
       four of them. The state below is what lets the Cards screen exercise the
       whole table without inventing a single figure.

       TWO CARDS, NOT ONE, and the second one is the point. The model's own talk
       track for this table is a card that was delivered and never activated:
       card_delivered with no card_activated after three days is the dormant-card
       push. One permanently active card cannot show it.

       Snapshot state rather than a plain list, because these move: freezing a
       card, activating it, toggling contactless and changing a limit are the
       controls the screen offers, and a control that fires an event without
       changing what is on screen reads as broken. */
    data class Card(
        val id: String,
        val name: String,
        /** card_tier: plus, travel, metal, business. */
        val tier: String,
        /** card_type: physical, virtual, disposable. */
        val type: String,
        val last4: String,
        val activated: Boolean,
        val frozen: Boolean = false,
        val contactless: Boolean = true,
        /** limit_amount, for limit_type daily_spend. */
        val dailyLimit: Double = 500.0,
        /** delivery_status: ordered, printed, dispatched, delivered. */
        val deliveryStatus: String = "delivered",
        /** days_since_order, which is what a dormant-card segment reads. */
        val daysSinceOrder: Int = 0,
        val inWallet: Boolean = false,
        val cancelled: Boolean = false,
    ) {
        /** The state a customer would recognise, in the order that matters. */
        val statusLabel: String get() = when {
            cancelled -> "Cancelled"
            !activated -> "Not activated"
            frozen -> "Frozen"
            else -> "Active"
        }
    }

    val cards = androidx.compose.runtime.mutableStateListOf(
        Card("CRD-8890", "NovaPay Plus", "plus", "physical", "8890",
             activated = true, dailyLimit = 500.0,
             deliveryStatus = "delivered", daysSinceOrder = 92, inWallet = true),
        Card("CRD-2210", "Travel card", "travel", "physical", "2210",
             activated = false, dailyLimit = 1000.0,
             deliveryStatus = "delivered", daysSinceOrder = 4),
    )

    /** Replaces one card in place. Card is immutable, so a change is a copy. */
    fun updateCard(id: String, change: (Card) -> Card) {
        val i = cards.indexOfFirst { it.id == id }
        if (i >= 0) cards[i] = change(cards[i])
    }

    /** The next card id and last four, so an ordered card is distinguishable
     *  from the seeded ones without inventing a number that looks issued. */
    fun nextCard(name: String, tier: String, type: String): Card {
        val n = cards.size + 1
        val last4 = (7000 + n * 13).toString()
        return Card("CRD-$last4", name, tier, type, last4,
                    activated = type == "virtual",
                    deliveryStatus = if (type == "virtual") "delivered" else "ordered",
                    daysSinceOrder = 0)
    }

    fun toJson(): String = JSONObject(
        mapOf("email" to (email ?: ""), "tier" to plan, "signedIn" to signedIn)
    ).toString()
}
