/* ============================================================================
   NovaPay event layer
   ----------------------------------------------------------------------------
   The single place this site talks to Dengage about data. Every screen calls a
   helper here; nothing calls window.dengage('sendDeviceEvent', ...) directly.

   Implements fintech/EVENT-MODEL.md. If you change a table or a column, change
   it there first, because that document is what Salil creates the tables from.

   WHAT THIS SITE DOES NOT DO
   --------------------------
   No ec:* calls. Not one. A money app has no cart, no basket total and no
   order, and shopping_cart_events / order_events / wishlist_events /
   search_events carry columns (quantity, unit_price, shipping_method,
   stock_count) that could only be faked here. A prospect reading Data Space
   during a demo would see a retail schema wearing a bank's name.

   The one standard table kept is page_view_events, via the first-class
   pageView call in js/pageView.js. A page view is a page view in any industry.

   Reasoning: docs/DECISIONS-AND-GOTCHAS.md, "REVERSED: the application funnel
   is no longer mapped onto the ecommerce API".

   PROVING IT LANDED
   -----------------
   A 200 from /api/web/event means accepted, not stored. The row in Data Space
   is the only evidence. Fire with a marker contact key (?ck=fintech-rebuild),
   never salil-demo, then read the table.
   ========================================================================== */

(function (window, document) {
  'use strict';

  /* ------------------------------------------------------------------ tables
     Renamed a table in the panel? Change it here and in EVENT-MODEL.md. */
  var TABLES = {
    onboarding:  'fintech_onboarding_events',
    account:     'fintech_account_events',
    transaction: 'fintech_transaction_events',
    card:        'fintech_card_events',
    savings:     'fintech_savings_events',
    investment:  'fintech_investment_events',
    credit:      'fintech_credit_events',
    product:     'fintech_product_events',
    support:     'fintech_support_events',
    engagement:  'fintech_engagement_events'
  };

  /* Bumped by hand when the demo changes materially, so a segment can exclude
     rows from an older build. Matches the Android app's versionName. */
  var APP_VERSION = 'web-2.0.0';

  /* The Android app sends the SAME tables with event_source = 'android', so
     one segment covers both surfaces. */
  var EVENT_SOURCE = 'web';

  /* --------------------------------------------------------------- cleaning
     Drops keys whose value is absent, so a column that does not apply is
     absent rather than zero.

     This is not fussiness. Number(null) === 0 has produced a real bug in this
     repository twice: a null stock became 0 and every event claimed the
     catalogue was out of stock, which would have poisoned any segment built on
     it. Absent stays absent here, and clean() is idempotent so applying it
     twice cannot change a value.

     false and 0 are kept. They are answers. null, undefined and '' are not. */
  function clean(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (v === null || v === undefined || v === '') return;
      if (typeof v === 'number' && !isFinite(v)) return;
      out[k] = v;
    });
    return out;
  }

  /* Money always travels as a number with 2 decimals, never a formatted
     string, and never in minor units. 120.5 not "$120.50" and not 12050. */
  function money(n) {
    if (n === null || n === undefined || n === '') return undefined;
    var v = Number(n);
    return isFinite(v) ? Math.round(v * 100) / 100 : undefined;
  }

  /* Bands exist so a marketer can build a segment without writing SQL. Keep
     these in step with EVENT-MODEL.md and with the contact attributes. */
  function balanceBand(n) {
    var v = Number(n);
    if (!isFinite(v)) return undefined;
    if (v < 0) return 'negative';
    if (v < 100) return '0-99';
    if (v < 500) return '100-499';
    if (v < 2000) return '500-1999';
    if (v < 10000) return '2000-9999';
    return '10000+';
  }

  function creditScoreBand(n) {
    var v = Number(n);
    if (!isFinite(v)) return undefined;
    if (v < 560) return 'poor';
    if (v < 620) return 'fair';
    if (v < 720) return 'good';
    if (v < 800) return 'very_good';
    return 'excellent';
  }

  /* ------------------------------------------------- identity is NOT ours
     The site does NOT write dn_device_id, dn_contact_key or session_id.

     The SDK puts all three in the event envelope and resolves identity per
     event. A hand-written copy goes stale the moment somebody signs in or out,
     which is precisely the failure it would look designed to prevent. The
     columns exist on the table to RECEIVE the SDK's values.

     This reverses an earlier implementation here that captured the device id
     through getDeviceId and buffered every event until it resolved. That was
     built on an early guess about what the `key` column holds. Confirmed with
     Salil on 31 July 2026: dn_device_id carries the same value as `key`, and
     the SDK supplies it. The buffering is gone with it.

     appevents.js asserts that no payload from this site contains any of the
     three, because reintroducing one would be invisible: the row would still
     land, just with a value that disagrees with the envelope.

  ------------------------------------------------------------------- send
     The one exit point.

     window.dengage is a queueing stub the moment the snippet runs, so a call
     made before the SDK finishes loading is queued rather than lost. If the
     SDK is genuinely absent (a suite, or a network failure) this logs instead
     of throwing, because an analytics call must never break a page. */

  /* Shared vocabulary with the Meridian banking demo, so one segment can span
     both brands. NovaPay's plan names are mapped onto the four agreed values
     rather than sent raw. */
  function customerTier() {
    try {
      var s = window.NovaPayState && window.NovaPayState.get();
      if (!s || !s.signedUp) return 'prospect';
      if (s.planTier === 'metal') return 'private';
      if (s.planTier === 'premium') return 'premier';
      return 'classic';
    } catch (err) {
      return 'prospect';
    }
  }

  function isAuthenticated() {
    try {
      var s = window.NovaPayState && window.NovaPayState.get();
      return !!(s && s.signedUp);
    } catch (err) {
      return false;
    }
  }

  function send(table, eventType, payload) {
    if (!table || !eventType) return;

    var row = clean(payload);
    row.event_type = eventType;
    row.event_source = EVENT_SOURCE;
    /* The full URL, not just the path, agreed across both finance sites: the
       query string is where ?ck= and campaign parameters live, so a path alone
       loses attribution. The column keeps the shared name. */
    row.page_path = window.location.href;
    row.is_authenticated = isAuthenticated();
    row.customer_tier = customerTier();
    row.app_version = APP_VERSION;

    try {
      if (typeof window.dengage === 'function') {
        window.dengage('sendDeviceEvent', table, row);
      } else {
        console.log('[novapay-events] ' + table + ' (no SDK):', row);
      }
    } catch (err) {
      console.error('[novapay-events] ' + table + ' failed:', err);
    }

    /* Local mirror, so a suite or a presenter can inspect what was sent
       without a network capture. Bounded, because a long demo should not grow
       memory without limit. */
    var log = window.__novapayEventLog = window.__novapayEventLog || [];
    log.push({ table: table, event: row.event_type, payload: row });
    if (log.length > 200) log.shift();

    return row;
  }

  /* ------------------------------------------------------------------- API
     One helper per table. Each takes the event name and the columns specific
     to that domain; the five-column spine is added by send().

     Deliberately thin. The helpers exist to make the table name unmissable at
     the call site, not to validate: a helper that silently rewrites a payload
     makes a wrong column impossible to find later. */
  var NovaPayEvents = {
    TABLES: TABLES,
    APP_VERSION: APP_VERSION,

    onboarding:  function (name, data) { return send(TABLES.onboarding,  name, data); },
    account:     function (name, data) { return send(TABLES.account,     name, data); },
    transaction: function (name, data) { return send(TABLES.transaction, name, data); },
    card:        function (name, data) { return send(TABLES.card,        name, data); },
    savings:     function (name, data) { return send(TABLES.savings,     name, data); },
    investment:  function (name, data) { return send(TABLES.investment,  name, data); },
    credit:      function (name, data) { return send(TABLES.credit,      name, data); },
    product:     function (name, data) { return send(TABLES.product,     name, data); },
    support:     function (name, data) { return send(TABLES.support,     name, data); },
    engagement:  function (name, data) { return send(TABLES.engagement,  name, data); },

    /* Exposed because callers need to band a figure before sending it, and
       two different bandings of the same number would make segments lie. */
    money: money,
    balanceBand: balanceBand,
    creditScoreBand: creditScoreBand,
    clean: clean,

    /* Escape hatch for a table added in the panel before this file knows
       about it. Prefer adding a helper above. */
    raw: send
  };

  window.NovaPayEvents = NovaPayEvents;



})(window, document);
