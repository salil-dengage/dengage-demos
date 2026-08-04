/* ============================================================================
   Open an account: the lead capture trigger

   The header CTA does not open a page. It pushes a dataLayer event, and an
   On-Site campaign with triggerBy = DATA_LAYER_EVENT answers it with the lead
   form in banking/panel-content/portal/lead-form.html.

   That is the whole point of doing it this way rather than linking to a form
   page: the form is content in the panel, so it can be changed, A/B tested,
   targeted at a segment or turned off without touching the site.

   Two events fire, and they are not the same thing:

     dataLayer  banking_open_account   the TRIGGER the campaign listens for
     table      banking_engagement_events  the RECORD that intent happened

   Keeping them separate means the intent is still recorded when no campaign
   exists, which matters: right now the campaign does not exist yet, and a
   demo where the button silently does nothing AND records nothing would be
   indistinguishable from a broken button.

   If no campaign is bound to the trigger, the button is silently dark, like
   every other On-Site scenario. That is the platform's behaviour, not a fault
   here, and it is why the console line below exists.
   ========================================================================== */
(function () {
    'use strict';

    var TRIGGER = 'banking_open_account';

    function onClick(event) {
        var btn = event.target.closest('[data-open-account]');
        if (!btn) return;
        event.preventDefault();

        var context = btn.getAttribute('data-open-account-context') || 'header';

        /* 1. The campaign trigger. */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: TRIGGER,
            actionType: 'open_account',
            category: 'Lead Capture',
            placement: context
        });

        /* 2. The record, so intent survives whether or not a campaign runs. */
        if (window.MeridianEvents) {
            window.MeridianEvents.engagement.event('lead_form_opened', {
                offerCategory: 'account_opening',
                placement: context
            });
        }

        /* The scenario is invisible until a campaign exists with this exact
           eventName. Saying so in the console turns "the button is broken"
           into "the campaign is not built yet", which is a five second
           diagnosis instead of a five minute one. */
        console.log('[Meridian] pushed ' + TRIGGER
            + ' to dataLayer. An On-Site campaign with triggerBy=DATA_LAYER_EVENT '
            + 'and eventName=' + TRIGGER + ' will answer it with the lead form.');
    }

    document.addEventListener('click', onClick);
})();
