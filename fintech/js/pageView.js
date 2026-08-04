/* ============================================================================
   Dengage pageView

   This is the SDK's first-class page view action, not a custom table write.
   It matters twice over:

     1. It populates page_view_events with the columns Dengage expects.
     2. It is the documented trigger for On-Site messages. The eight Default
        Scenarios have no local code and appear only when a pageView fires and
        the scenario's page targeting matches.

   Because the site calls pageView itself, "Trigger Page View on Initialize"
   must be turned OFF in the web application's advanced settings, otherwise
   every page reports twice.

   The product page waits for the product to load so the call can carry
   product_id, category_path and price rather than an empty shell.
   ========================================================================== */
(function () {
    'use strict';

    function detectPageType() {
        if (document.body && document.body.dataset && document.body.dataset.pageType) {
            return document.body.dataset.pageType;
        }
        var path = (window.location.pathname || '').toLowerCase();
        if (!path || path === '/' || path.indexOf('index.html') !== -1) return 'home';
        if (path.indexOf('product.html') !== -1) return 'product';
        var match = path.match(/([^\/]+)\.html?$/);
        return match ? match[1] : 'other';
    }

    function send(payload) {
        try {
            if (typeof window.dengage === 'function') {
                window.dengage('pageView', payload);
            } else {
                console.log('Dengage pageView (mock):', payload);
            }
        } catch (err) {
            console.error('pageView failed', err);
        }
    }

    function num(value) {
        var n = Number(value);
        return isFinite(n) ? n : undefined;
    }

    /* Feed category paths already use the "A > B > C" shape Dengage wants. */
    function productPayload(product) {
        var payload = {
            page_type: 'product',
            product_id: String(product.id || ''),
            category_path: product.category || '',
            /* NO price and NO discounted_price on this site.

               A NovaPay product is a card, a plan or a portfolio. It has a
               monthly fee or a rate, not a shelf price, and the feed carries no
               oldPrice at all. num(null) is 0 because Number(null) is 0, so
               these two columns were shipping a FABRICATED 0 on every product
               page view: exactly the "never invent a value to fill a column"
               rule, and the same Number(null) trap that produced the
               stock_count bug twice in this repository.

               sdkfull.js has asserted this since 30 July for any site with
               usesEcommerceFunnel: false. It has been failing on FinTech ever
               since and nobody saw it, because the suite printed its failure
               count and then exited 0. Found by the Banking session, confirmed
               here by running it: the payload really was
               {"price":0,"discounted_price":0}.

               If a fee ever needs to travel, it belongs in
               fintech_product_events as monthly_fee, which is what
               js/novapayLanding.js already sends. */

            /* NO stock_count on this site, at all.

               The docs do allow 1 or 0 as a stand-in for plain availability
               ("If stock count is not available you can give 1 or 0 as stock
               availability info, or you can omit"), and this file used to take
               that option. It is the wrong call for a money app: a card has no
               unit count, so a 1 here is a fabricated figure sitting in a
               column that a back-in-stock segment would read as real. The docs
               permit omitting it, so omit it. The CantuPneus catalogues carry a
               genuine stock figure and keep theirs.

               If you are tempted to reintroduce this, note the trap it used to
               hide: Number(null) is 0, and a 0 here announces every card as out
               of stock. That has bitten twice in this repository. */
        };
        Object.keys(payload).forEach(function (k) {
            if (payload[k] === undefined) delete payload[k];
        });
        return payload;
    }

    function start() {
        var pageType = detectPageType();

        if (pageType === 'product') {
            var fired = false;
            window.addEventListener('novapay:product:loaded', function (e) {
                if (fired) return;
                fired = true;
                var product = e && e.detail && e.detail.product;
                send(product ? productPayload(product) : { page_type: 'product' });
            });
            /* If the product never resolves, still report the page rather than
               leaving the visit and any page-load scenario unrecorded. */
            setTimeout(function () {
                if (!fired) { fired = true; send({ page_type: 'product' }); }
            }, 4000);
            return;
        }

        send({ page_type: pageType });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
