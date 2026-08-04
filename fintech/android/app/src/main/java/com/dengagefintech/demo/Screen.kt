package com.dengagefintech.demo

/**
 * Stable screen names. These are the ENTIRE targeting surface for In-App, so
 * they are a contract rather than labels: renaming one silently breaks every
 * campaign aimed at it, and nothing errors.
 *
 * Three groups. Five mirror the website's portal pages one for one, five are
 * the journeys, and five are sign-in plus the scaffolding every demo app needs.
 *
 * Each is also reachable as novapay://<name>, see MOBILE-SURFACES.md. That is
 * why this list is the one place they are written down: fintech/tools/
 * mobiletest.js reads it to check that no creative deep links somewhere the
 * app does not route.
 */
object Screen {
    const val SIGN_IN   = "sign_in"     // included on purpose: a push that deep
                                        // links into a gated screen while the
                                        // user is signed out has to land here
    const val HOME      = "home"        // app.html
    const val MONEY     = "money"       // money.html
    const val CARDS     = "cards"       // cards.html
    const val GROW      = "grow"        // grow.html
    const val PRODUCTS  = "products"    // products.html
    const val INBOX     = "inbox"
    const val EVENTS    = "events"
    const val IDENTITY  = "identity"
    const val TEST      = "test"

    /* The five journeys. They are screens in their own right rather than
       states inside Money and Products, because a screen name is the entire
       In-App targeting surface: a customer halfway through a transfer or stuck
       on a document upload is only reachable if that moment reports itself. */
    const val SEND_MONEY = "send_money"
    const val TOP_UP     = "top_up"
    const val VERIFY     = "verify"
    const val APPLY      = "apply"
    const val DISPUTE    = "dispute"

    val ALL = listOf(SIGN_IN, HOME, MONEY, CARDS, GROW, PRODUCTS,
                     INBOX, EVENTS, IDENTITY, TEST,
                     SEND_MONEY, TOP_UP, VERIFY, APPLY, DISPUTE)

    /** novapay://<screen> -> screen name, or null if the host is unknown. */
    fun fromDeepLink(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val host = url.substringAfter("novapay://", "").substringBefore('?').trim('/')
        return ALL.firstOrNull { it.equals(host, ignoreCase = true) }
    }
}
