/* ============================================================================
   Portal gate: app.html is for signed-in customers only.

   WHY THIS IS A SEPARATE FILE LOADED IN THE HEAD

   It has to run before three things, and only a head script beats all three:

     1. the page paints, or the portal flashes on screen before it vanishes,
        which looks like a bug to a prospect watching over your shoulder;
     2. dengage('initialize'), so a visitor who is bounced never opens an
        SDK session on a page they were not allowed to see;
     3. js/pageView.js, which would otherwise write a portal page view for
        somebody who never got in and quietly poison every "reached the
        portal" segment.

   WHAT COUNTS AS SIGNED IN

   The presence of novapay_user in localStorage, written by the sign-in form
   in novapay-main.js. There is deliberately no credential check: this is a
   demo, and a login that can refuse you is worse on a call than one that
   cannot. The point of the gate is not security, it is that the portal is
   somewhere you ARRIVE, so the funnel has a real boundary in it.

   WHAT SURVIVES THE BOUNCE

   ?ck=<key>, because that is how any contact is demoed without touching
   code, and losing it on the redirect would break the habit. The landing
   page reopens the form and sends the visitor back here on submit.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var USER_STORE = 'novapay_user';

    function signedIn() {
        try {
            var raw = window.localStorage.getItem(USER_STORE);
            if (!raw) return false;
            var user = JSON.parse(raw);
            /* An email is what identity.js resolves the contact key from, so a
               record without one is not a session, it is debris from an older
               build. Treat it as signed out rather than letting a contactless
               visitor into the portal. */
            return !!(user && user.email);
        } catch (err) {
            /* Private mode, or a corrupted record. Bounce: failing closed on a
               gate is the only safe direction. */
            return false;
        }
    }

    if (signedIn()) return;

    var ck = /[?&]ck=([^&#]+)/.exec(window.location.search);
    var target = 'index.html?signin=1' + (ck ? '&ck=' + ck[1] : '');

    /* replace, not assign: the visitor never got to see this page, so it does
       not belong in their history. Otherwise Back from the landing page
       bounces them straight here again and they are stuck in a loop. */
    window.location.replace(target);

})(window, document);
