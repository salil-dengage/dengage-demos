/* ============================================================================
   Product detail page

   A bank product page has obligations a shop product page does not. Where a
   rate appears the representative example appears with it, in full and
   unparaphrased, and an investment carries its risk warning. Both are rendered
   verbatim from the feed rather than assembled here, so nobody can adjust the
   layout and quietly reword regulated text.

   What this page does NOT have, and why:
     no price or was-price   a mortgage does not go on sale
     no quantity stepper     you do not apply for two credit cards
     no SKU row              a customer has never once wanted this

   Fires banking_product_events product_viewed. The page view itself is
   js/pageView.js, kept separate because pageView is the trigger the On-Site
   scenarios listen for.
   ========================================================================== */
(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, function (char) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
            });
    }

    /* Only emit an attribute that has a value. An empty one arrives downstream
       as the string "null" or "0", and a 0 rate is a claim about a product. */
    function attr(name, value) {
        if (value === null || value === undefined || value === '') return '';
        return ' ' + name + '="' + escapeHtml(value) + '"';
    }

    function getQueryParam(name) {
        try {
            return new URLSearchParams(window.location.search).get(name);
        } catch (error) {
            return null;
        }
    }

    function bulletList(values, className) {
        if (!values || !values.length) return '';
        return '<ul class="' + className + '">'
            + values.map(function (v) { return '<li>' + escapeHtml(v) + '</li>'; }).join('')
            + '</ul>';
    }

    function keyFacts(facts) {
        if (!facts || !facts.length) return '';
        return '<dl class="product-detail-facts">'
            + facts.map(function (fact) {
                return '<div class="product-detail-fact">'
                     + '<dt>' + escapeHtml(fact.label) + '</dt>'
                     + '<dd>' + escapeHtml(fact.value) + '</dd>'
                     + '</div>';
            }).join('')
            + '</dl>';
    }

    function saveButtonAttrs(product) {
        return ''
            + attr('data-product-id', product.id)
            + attr('data-product-name', product.name)
            + attr('data-product-category', product.category)
            + attr('data-product-subtype', product.subtype)
            + attr('data-product-image', product.image)
            + attr('data-product-rate-display', product.rateDisplay)
            + attr('data-product-fee-display', product.feeDisplay)
            + attr('data-product-headline-rate', product.headlineRate)
            + attr('data-product-rate-type', product.rateType)
            + attr('data-product-term-months', product.termMonths)
            + attr('data-product-fee-amount', product.feeAmount)
            + attr('data-product-fee-frequency', product.feeFrequency)
            + attr('data-product-min-deposit-pct', product.minDepositPct);
    }

    function renderDetail(product) {
        return ''
            + '<div class="product-detail-grid">'
            + '  <div class="product-detail-media">'
            + '    <img class="product-detail-image" src="' + escapeHtml(product.image) + '" alt="">'
            + (product.badge ? '<span class="product-detail-badge">' + escapeHtml(product.badge) + '</span>' : '')
            + '  </div>'
            + '  <div class="product-detail-info">'
            + '    <p class="text-label product-detail-category">' + escapeHtml(product.categoryLabel) + '</p>'
            + '    <h1 class="heading-display product-detail-name">' + escapeHtml(product.name) + '</h1>'
            + '    <p class="text-body product-detail-summary">' + escapeHtml(product.summary) + '</p>'

            + '    <div class="product-detail-rate">'
            + '      <span class="product-detail-rate-value">' + escapeHtml(product.rateDisplay) + '</span>'
            + (product.rateCaption
                ? '<span class="product-detail-rate-caption">' + escapeHtml(product.rateCaption) + '</span>'
                : '')
            + '    </div>'
            + (product.feeDisplay
                ? '<p class="product-detail-fee">' + escapeHtml(product.feeDisplay) + '</p>'
                : '')

            /* Dengage inline target slot, directly under the rate. It lives
               here rather than in product.html because this innerHTML
               assignment replaces the whole detail block on every render.
               Empty and hidden until an inline campaign fills it. */
            + '    <div id="dn_inline_target_pdp_below_price" class="dn-inline-slot"></div>'

            + '    <div class="product-detail-actions">'
            + '      <button class="btn-primary product-detail-apply-btn" type="button" data-product-apply>'
            + escapeHtml(product.ctaLabel) + '</button>'
            + '      <button class="product-detail-save-btn" type="button"'
            + '        data-shortlist-add'
            + '        data-label-default="Add to shortlist" data-label-saved="Shortlisted"'
            + saveButtonAttrs(product)
            + '>Add to shortlist</button>'
            + '    </div>'

            + (product.detail
                ? '<p class="text-body product-detail-body">' + escapeHtml(product.detail) + '</p>'
                : '')
            + (product.highlights.length
                ? '<h2 class="product-detail-subhead">What you get</h2>'
                  + bulletList(product.highlights, 'product-detail-highlights')
                : '')
            + keyFacts(product.keyFacts)
            + (product.eligibility.length
                ? '<h2 class="product-detail-subhead">Who can apply</h2>'
                  + bulletList(product.eligibility, 'product-detail-eligibility')
                : '')

            /* Regulated text, verbatim from the feed, never paraphrased. */
            + (product.riskWarning
                ? '<p class="product-detail-risk"><strong>Risk warning.</strong> '
                  + escapeHtml(product.riskWarning) + '</p>'
                : '')
            + (product.representativeExample
                ? '<p class="product-detail-representative">'
                  + escapeHtml(product.representativeExample) + '</p>'
                : '')
            + '  </div>'
            + '</div>';
    }

    function init() {
        var container = document.querySelector('[data-product-detail]');
        if (!container || !window.MeridianCatalogData) return;

        var statusEl = container.querySelector('[data-product-detail-status]');
        var id = getQueryParam('id');

        if (!id) {
            if (statusEl) statusEl.textContent = 'No product selected.';
            return;
        }

        window.MeridianCatalogData.getProductById(id)
            .then(function (product) {
                if (!product) {
                    if (statusEl) statusEl.textContent = 'That product could not be found.';
                    return;
                }

                container.innerHTML = renderDetail(product);

                var breadcrumbEl = document.querySelector('[data-product-breadcrumb]');
                if (breadcrumbEl) breadcrumbEl.textContent = product.name;
                document.title = 'Meridian | ' + product.name;

                /* js/pageView.js waits for this so the page view can carry
                   product_id and category_path rather than an empty shell. */
                window.MeridianProduct = product;
                window.dispatchEvent(new CustomEvent('meridian:product:loaded', {
                    detail: { product: product }
                }));

                if (window.MeridianEvents) {
                    window.MeridianEvents.product.viewed(product, { listName: product.categoryLabel });
                }

                /* Repaint the shortlist state now the buttons exist. */
                window.dispatchEvent(new CustomEvent('meridian:shortlist:updated', {
                    detail: { action: 'render' }
                }));
            })
            .catch(function (error) {
                console.error('Could not load the product', error);
                if (statusEl) statusEl.textContent = 'Unable to load this product right now.';
            });
    }

    document.addEventListener('click', function (event) {
        if (!event.target.closest('[data-product-apply]')) return;

        var product = window.MeridianProduct;
        if (!product || !window.MeridianShortlist) return;

        var started = window.MeridianShortlist.startApplication(product.id, { product: product });
        if (started) {
            window.location.href = 'apply.html?product=' + encodeURIComponent(product.id)
                + '&application=' + encodeURIComponent(started.applicationId);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
