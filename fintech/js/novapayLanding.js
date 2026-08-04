/* ============================================================================
   NovaPay landing page events
   ----------------------------------------------------------------------------
   The acquisition half of the journey: an anonymous visitor reading the public
   site, showing interest in a product, and starting to open an account.

   The engagement half lives in js/novapayApp.js. The split matters because
   these are the rows a prospect cares about most: everything here happens
   BEFORE the customer exists, which is exactly the window an on-site scenario
   or a web push is trying to influence.

   As everywhere on this site: no ec:* calls. A visitor reading about a card is
   not adding it to a basket.
   ========================================================================== */

(function (window, document) {
  'use strict';

  var Events = window.NovaPayEvents;
  if (!Events) {
    console.error('[novapay-landing] event layer missing');
    return;
  }

  /* -------------------------------------------------------- product interest
     The featured card and any other element carrying data-apply-product. The
     link still navigates; the event goes out first, synchronously, so a fast
     click cannot outrun it. */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-apply-product]');
    if (!trigger) return;

    var fee = Number(trigger.getAttribute('data-monthly-fee'));

    Events.product('product_viewed', {
      product_id: trigger.getAttribute('data-apply-product'),
      product_name: trigger.getAttribute('data-product-name'),
      product_family: trigger.getAttribute('data-product-family'),
      plan_tier: trigger.getAttribute('data-plan-tier'),
      monthly_fee: Events.money(isFinite(fee) ? fee : undefined),
      funnel_step: 'viewed',
      step_index: 1
    });
  });

  /* ------------------------------------------------------------ open account
     Where the onboarding funnel starts. Every subsequent step is recorded in
     the app, so this row is the denominator for the whole funnel: signups
     started against accounts opened.

     This CTA used to be a link straight into the portal, which skipped the
     single most valuable moment on a finance site: capturing the lead. It now
     opens a Dengage-rendered lead form instead, triggered by the dataLayer
     event below, so the form itself is panel content a marketer can rewrite
     without a deploy. That is the whole argument, and it only lands if the
     form is genuinely Dengage's rather than the site's.

     FALLBACK, and why it is not cheating. A scenario with no campaign behind
     it is SILENTLY DARK: nothing errors, nothing shows. On a hero CTA that
     means a dead button in front of a prospect. So if the engine has not put
     a popup on the page shortly after the click, the site's own account form
     opens instead. When the campaign exists the engine wins and the fallback
     never runs. */

  /* Anything the on-site engine mounts. The banner selectors are the same
     three shapes js/bannerOffset.js has to look for, because the engine has
     used an id and a class for the same element depending on the format. */
  var ENGINE = '[id^="_dn_onsite_popup-"], #_dn_onsite-banner, ' +
               '._dn_onsite-banner, ._dn_onsite-overlay';

  /* How long the visitor waits before the site's own form opens, and how long
     after that the campaign can still turn up and take over. The first number
     is a responsiveness choice; the second is the observed worst case for a
     first call on a cold page, which has been several seconds on this account. */
  var FALLBACK_AFTER_MS = 1400;
  var WATCH_TOTAL_MS = 8000;

  function engineNodes() {
    return Array.prototype.slice.call(document.querySelectorAll(ENGINE));
  }

  /* Has the visitor started filling the site's own form? Fields from
     novapay-main.js. Used to decide whether withdrawing it is safe. */
  function siteFormTouched() {
    var ids = ['loginFirstName', 'loginLastName', 'loginEmail', 'loginPassword'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.value) return true;
    }
    return false;
  }

  /* ==========================================================================
     THE FALLBACK IS A RACE, AND IT USED TO LOSE.

     This was one check 1400ms after the click: if the engine had not rendered
     by then, the site's own form opened and that was that. A campaign that
     answers slower than 1400ms, which a cold page on a conference network
     regularly does, therefore opened the site's form AND then had its own
     popup land on top of it. Two account forms in front of a prospect, one of
     them the one we are there to demonstrate.

     So it WATCHES instead of guessing an interval. A MutationObserver sees the
     engine the moment it mounts, and the timer only decides when to give up.
     If the campaign arrives after the fallback has opened, the site's form is
     withdrawn again, unless the visitor has already typed into it: taking a
     half-filled form away is worse than the duplicate it prevents.

     It also counts only nodes that appear AFTER the click. The selector above
     matches a sticky bar from an unrelated campaign too, and a bar already on
     the page read as "the lead form is live", which suppressed the fallback
     and left the hero CTA doing nothing at all. That is the same defect from
     the other side, and one snapshot fixes both. */
  function offerAccountForm() {
    var before = engineNodes();
    var opened = false;
    var done = false;

    function campaignArrived() {
      var now = engineNodes();
      for (var i = 0; i < now.length; i++) {
        if (before.indexOf(now[i]) === -1) return true;
      }
      return false;
    }

    function stop() {
      done = true;
      if (observer) observer.disconnect();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(giveUpTimer);
    }

    function check() {
      if (done || !campaignArrived()) return;
      // The campaign won. Withdraw the site's form if we already showed it and
      // the visitor has not started using it.
      if (opened && !siteFormTouched() &&
          typeof window.closeLoginModal === 'function') {
        window.closeLoginModal();
      }
      stop();
    }

    var observer = window.MutationObserver
      ? new window.MutationObserver(check)
      : null;
    if (observer) {
      /* documentElement, not body: the engine has mounted outside body before,
         and the whole point of this watch is not to miss it. */
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    var fallbackTimer = window.setTimeout(function () {
      if (done) return;
      check();
      if (done) return;
      if (typeof window.openLoginModal === 'function') {
        window.openLoginModal();
        opened = true;
      }
      /* No MutationObserver, so nothing will call check() again. Nothing to
         wait for; the site's form is the answer. */
      if (!observer) stop();
    }, FALLBACK_AFTER_MS);

    var giveUpTimer = window.setTimeout(stop, WATCH_TOTAL_MS);
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-open-account]');
    if (!trigger) return;

    /* The anchor still points at app.html so the markup degrades sensibly and
       the gate still guards the destination. The click no longer follows it. */
    e.preventDefault();

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'fintech_open_account_intent',
      product_intent: trigger.getAttribute('data-product-intent') || 'general',
      /* Where on the page they asked, so one campaign can dress itself
         differently for a hero click and a footer click. */
      cta_location: trigger.getAttribute('data-cta-location') || 'unspecified'
    });

    offerAccountForm();

    Events.onboarding('signup_started', {
      step: 'signup_started',
      step_index: 1,
      status: 'started',
      method: 'email',
      /* Which page section sent them, so a campaign can tell a hero click
         from a footer click without a separate event. */
      product_intent: trigger.getAttribute('data-product-intent') || undefined
    });
  });

  /* -------------------------------------------------------------- scroll depth
     Reading the security section is a genuine buying signal on a finance site:
     it is the objection a prospect has before they trust you with money. Fired
     once per session per section, never repeatedly, or a segment on "read the
     security page" would count scrolling up and down. */
  var seen = {};
  var SECTIONS = {
    products: 'features',
    collections: 'product_range',
    craftsmanship: 'security',
    story: 'company'
  };

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        var label = SECTIONS[id];
        if (!label || seen[label]) return;
        seen[label] = true;

        /* NO scenario_group. Its vocabulary is the panel's own scenario
           groups, and a landing section scrolling into view is not a Dengage
           scenario at all, so 'Landing' was dropped on the way in. The slug,
           the widget name and page_type already say what this row is. */
        Events.engagement('section_read', {
          scenario_slug: 'landing-' + label,
          widget_name: label,
          channel: 'onsite',
          page_type: 'landing',
          interaction: 'displayed'
        });
      });
    }, { threshold: 0.4 });

    Object.keys(SECTIONS).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) observer.observe(node);
    });
  }

})(window, document);
