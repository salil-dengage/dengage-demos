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
   product_id and category_path rather than an empty shell.
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

    /* Feed category paths already use the "A > B > C" shape Dengage wants.

       Deliberately NO price, discounted_price or stock_count.

       A mortgage has no price and no unit count. The old version sent
       price/discounted_price from the retail schema and a hardcoded
       stock_count of 1 as a stand-in for availability. Both were fictions:
       "1 in stock" for a credit card is a fabricated figure, and any segment
       built on it is poisoned. The catalogue no longer carries those fields at
       all, so there is nothing to send and nothing to invent.

       Rate and fee are not sent here either. page_view_events has no column
       that means "4.09% fixed", and the rate belongs on
       banking_product_events where it has properly typed columns. */
    function productPayload(product) {
        var payload = {
            page_type: 'product',
            product_id: String(product.id || ''),
            category_path: product.categoryPath || ''
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
            window.addEventListener('meridian:product:loaded', function (e) {
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
