package com.dengagebanking.demo.inapp

/* ============================================================================
   THE MERIDIAN IN-APP CATALOGUE

   One entry per In-App layout the Dengage panel offers, each with the screen
   name that triggers it and the HTML file that fills it.

   WHY A LIST OF SCREEN NAMES IS THE WHOLE INTEGRATION. An In-App campaign is
   HTML plus a handful of positioning parameters: position (TOP, MIDDLE,
   BOTTOM, FULL), maxWidth, radius, four margins, dismissOnTouchOutside, a
   background colour. Every template in the panel's gallery, modal, banner,
   NPS, survey, spin to win and the rest, is preset HTML in that same
   envelope.

   WHICH ANSWERS THE QUESTION DIRECTLY: yes, HTML content covers everything.
   There is no capability behind a template that HTML cannot reach, because
   the template IS HTML. What the templates give you is a starting point and,
   for the three Gamification ones, a coupon pool wired to the {{couponCode}}
   Mustache pass. Nothing else is gated.

   So there is nothing to build in the app per layout. The app reports a screen
   name with Dengage.setNavigation and the campaign decides what appears there.
   That is why this file is a table and not a set of renderers: adding a
   fourteenth layout means adding a row here and a campaign in the panel.

   TIMING WORTH KNOWING. An In-App shows only when the device has already
   FETCHED it. The SDK fetches on its own schedule, so a campaign saved
   thirty seconds ago is not on the handset yet. Press Refresh from the server
   in the Test Area first. A row with no campaign behind it draws nothing,
   exactly like a campaign that has not arrived.
   ========================================================================== */
object MeridianInApp {

    /**
     * @param screen   reported with setNavigation; the campaign targets this
     *                 exact string under Trigger > Where to Show >
     *                 Specific Screens.
     * @param layout   what to choose in the panel's template gallery.
     * @param file     the content to paste, in banking/panel-content/mobile/.
     */
    data class Placement(
        val key: String,
        val label: String,
        val screen: String,
        val layout: String,
        val file: String,
        val note: String,
    )

    const val REALTIME_SCREEN = "test_inapp_realtime"

    /* THE LIST IS THE PANEL'S TEMPLATE GALLERY, IN ITS ORDER AND ITS WORDS.
       Blank Layout, then Feedback, then Gamification. Every template the
       gallery offers has a row, and no row invents a template that is not
       there, so a demo can be given with the gallery open beside the phone
       and the two agree line for line. */
    val PLACEMENTS: List<Placement> = listOf(

        // ---------------------------------------------------- Blank Layout
        Placement(
            "banner", "Banner", "test_inapp_banner",
            "Banner", "inapp-banner.html",
            "A strip above the content. Draws its own close: Banner is not offered the outside one."
        ),
        Placement(
            "bar", "Banner, at the bottom", "test_inapp_bar",
            "Banner, position BOTTOM", "inapp-bar.html",
            "The same template moved to where the thumb is. Not a different layout, a different position."
        ),
        Placement(
            "modal", "Modal", "test_inapp_modal",
            "Modal, image and text", "inapp-modal.html",
            "The everyday one. Card in the middle, dimmed behind."
        ),
        Placement(
            "image_modal", "Image Modal", "test_inapp_image_modal",
            "Image Modal, image only", "inapp-image-modal.html",
            "Artwork only, the whole card tappable. Everything it says is in the picture."
        ),
        Placement(
            "full", "Full Screen", "test_inapp_full",
            "Full Screen, image and text", "inapp-full.html",
            "The whole screen. For something the customer has to decide, not glance at."
        ),
        Placement(
            "full_image", "Full Image", "test_inapp_full_image",
            "Full Image, image only", "inapp-full-image.html",
            "Full screen with no HTML copy at all. Check the panel supplies a close, or there is no way out."
        ),
        Placement(
            "permission", "Modal, as a notification soft ask", "test_inapp_permission",
            "Modal", "inapp-permission.html",
            "Same template, earning its keep: Dn.promptPushPermission() from the CTA, so a No costs nothing."
        ),

        // -------------------------------------------------------- Feedback
        Placement(
            "survey", "Survey", "test_inapp_survey",
            "Survey", "inapp-survey.html",
            "One question, four answers. Capture is Dn.setTags, not the website's form mechanism."
        ),
        Placement(
            "nps", "NPS", "test_inapp_nps",
            "NPS (Net Promoter Score)", "inapp-nps.html",
            "Nought to ten, one tap. The score lands as a tag on the device."
        ),

        // ---------------------------------------------------- Gamification
        Placement(
            "countdown", "Countdown to Win", "test_inapp_countdown",
            "Countdown to Win", "inapp-countdown.html",
            "A live countdown to a deadline. Expiry is enforced by the SDK."
        ),
        Placement(
            "scratch", "Scratch to Win", "test_inapp_scratch",
            "Scratch to Win", "inapp-scratch.html",
            "A fee waiver rather than a prize draw, which is the version that survives compliance."
        ),
        Placement(
            "spin", "Spin to Win", "test_inapp_spin",
            "Spin to Win", "inapp-spin.html",
            "A wheel, in a bank's register. CSS only: the panel strips script tags."
        ),

        // ------------------------------------------- not a template, a trigger
        Placement(
            "realtime", "Real time, with parameters", REALTIME_SCREEN,
            "Modal, Real Time trigger", "inapp-realtime.html",
            "Any layout above, requested by the app and resolved at that moment. tier and surface are sent in."
        ),
    )
}
