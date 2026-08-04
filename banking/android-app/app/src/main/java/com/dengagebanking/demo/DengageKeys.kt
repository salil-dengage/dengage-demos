package com.dengagebanking.demo

/* Account-level constants for the Dengage integration.

   WHAT IS SAFE TO KEEP HERE, AND WHAT IS NOT

   The integration key below identifies this app to the Dengage account. It
   travels from every device on every call and cannot be used to send anything,
   so it belongs in source alongside google-services.json.

   The FCM service account key is the opposite: it can send push as Meridian
   Bank. It is uploaded straight into the Dengage panel and must never be
   committed, pasted into a chat, or written to this file. */
object DengageKeys {

    const val FIREBASE_INTEGRATION_KEY =
        "Z53P0mRqtQRTSH3iij0C7t99x47JMOktoKRfqY2yvdliSbXK66nIrKrPCf0aetki1gadmmn_p_l_sgXv6Llvlnklxq1NusyDxNqlQVX84nXdxbbHhKQlmyypwa86XOJLnMgkWi6wurc6Z91xydShxSOUVQ_e_q__e_q_"

    /* ------------------------------------------------- inline and stories

       CORRECTION, 2 August 2026. These were previously described as "issued by
       the panel", and that was backwards. The APP chooses the string and
       passes it to Dengage.showInlineInApp(..., propertyId, ...); the campaign
       then targets that same string from the panel side. So the vocabulary is
       declared here, and the panel matches it, exactly like the screen names
       below.

       That is why there is one per screen rather than one for the app: a page
       with no property id of its own can never carry a different inline
       message from any other page, which defeats the point of an inline
       placement.

       To build a campaign against one of these: In-App campaign, layout
       Inline, and set the inline target to the id below. Nothing needs to
       change in the app. */
    object InlineProperty {
        const val OVERVIEW = "meridian_inline_overview"
        const val ACCOUNTS = "meridian_inline_accounts"
        const val CARDS = "meridian_inline_cards"
        const val PAYMENTS = "meridian_inline_payments"
        const val WEALTH = "meridian_inline_wealth"
        const val PRODUCTS = "meridian_inline_products"
        const val PROFILE = "meridian_inline_profile"

        /** Every id, for the identifiers screen and the setup sheet. */
        val ALL = listOf(OVERVIEW, ACCOUNTS, CARDS, PAYMENTS, WEALTH, PRODUCTS, PROFILE)

        /** The id for a screen, or null where that screen carries no inline
         *  placement. Null draws nothing, which is the correct outcome. */
        fun forScreen(screen: String): String? = when (screen) {
            Screen.OVERVIEW -> OVERVIEW
            Screen.ACCOUNTS -> ACCOUNTS
            Screen.CARDS -> CARDS
            Screen.PAYMENTS -> PAYMENTS
            Screen.WEALTH -> WEALTH
            Screen.PRODUCTS -> PRODUCTS
            Screen.PROFILE -> PROFILE
            else -> null
        }
    }

    /* App Stories, same arrangement: the app declares the id, the campaign
       targets it. One rail per screen that can carry stories. */
    object StoryProperty {
        const val OVERVIEW = "meridian_stories_overview"
        const val PRODUCTS = "meridian_stories_products"
        const val WEALTH = "meridian_stories_wealth"

        val ALL = listOf(OVERVIEW, PRODUCTS, WEALTH)

        fun forScreen(screen: String): String? = when (screen) {
            Screen.OVERVIEW -> OVERVIEW
            Screen.PRODUCTS -> PRODUCTS
            Screen.WEALTH -> WEALTH
            else -> null
        }
    }

    /* The push, In-App and Live Update demos all render on this device
       through the SDK's own code, so this app holds NO account credentials and
       needs no REST access. That was a deliberate removal on 2 August: the
       credentials were account-wide across account 28, contact data included,
       and an APK is a shareable thing. Real delivery is proven from the panel,
       which needs nothing from the app. */

    /* Every row this app writes carries event_source = "android", against the
       same nine banking_* tables the website writes. One contact key therefore
       produces one journey across web and app, which is the whole point of
       putting the app in the same account. */
    const val EVENT_SOURCE = "android"

    /* Screen names passed to Dengage.setNavigation(). They are the targeting
       vocabulary for In-App campaigns, so they are declared in one place
       rather than typed as literals at each call site: a typo here is a
       campaign that never shows and never errors. */
    object Screen {
        const val SIGN_IN = "sign_in"
        const val OVERVIEW = "overview"
        const val ACCOUNTS = "accounts"
        const val CARDS = "cards"
        const val PAYMENTS = "payments"
        const val WEALTH = "wealth"
        const val PROFILE = "profile"
        const val PRODUCTS = "products"
        const val INBOX = "inbox"
        const val EVENTS = "events"
        const val IDENTITY = "identity"
        const val TEST = "test"

        /* The four things a customer actually does, each its own screen so it
           can be deep linked and targeted separately. A push that lands on
           "payments" is a different message from one that lands on the send
           money form with the payee already chosen. */
        const val SEND_MONEY = "send_money"
        const val APPLY = "apply"
        const val COMPLAINT = "complaint"
        const val APPOINTMENT = "appointment"
    }
}
