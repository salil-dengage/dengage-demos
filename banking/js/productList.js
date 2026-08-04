/* ============================================================================
   Product grid

   Renders banking product cards. A card leads with the rate, because that is
   what a customer compares, and states the fee next to it, because a rate
   without its fee is the oldest misleading trick in retail banking and this
   site does not play it.

   No price and no was-price. A mortgage does not go on sale.

   The grid can be filtered by category from a data attribute on the grid
   element, so the same renderer serves the homepage and each category page.
   ========================================================================== */
(function () {
    'use strict';

    var DEFAULT_LIMIT = 12;

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, function (char) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
            });
    }

    /* Only emit a data attribute when there is a value. An empty string here
       becomes the string "null" or "0" downstream, and a 0 rate is a claim. */
    function attr(name, value) {
        if (value === null || value === undefined || value === '') return '';
        return ' ' + name + '="' + escapeHtml(value) + '"';
    }

    function renderCard(product, index) {
        var detailUrl = window.MeridianCatalogData.buildProductUrl(product.id);
        var facts = (product.keyFacts || []).slice(0, 2).map(function (fact) {
            return '<div class="product-card-fact">'
                 + '<dt>' + escapeHtml(fact.label) + '</dt>'
                 + '<dd>' + escapeHtml(fact.value) + '</dd>'
                 + '</div>';
        }).join('');

        return ''
            + '<article class="product-card" data-product-card="' + escapeHtml(product.id) + '">'
            + '  <a class="product-card-media" href="' + escapeHtml(detailUrl) + '" aria-label="View ' + escapeHtml(product.name) + '">'
            + '    <img src="' + escapeHtml(product.image) + '" alt="" loading="lazy">'
            + (product.badge ? '<span class="product-card-badge">' + escapeHtml(product.badge) + '</span>' : '')
            + '  </a>'
            + '  <div class="product-card-body">'
            + '    <p class="product-card-category">' + escapeHtml(product.categoryLabel) + '</p>'
            + '    <h3 class="product-card-name"><a href="' + escapeHtml(detailUrl) + '">' + escapeHtml(product.name) + '</a></h3>'
            + '    <div class="product-card-rate">'
            + '      <span class="product-card-rate-value">' + escapeHtml(product.rateDisplay) + '</span>'
            + (product.rateCaption ? '<span class="product-card-rate-caption">' + escapeHtml(product.rateCaption) + '</span>' : '')
            + '    </div>'
            + (facts ? '<dl class="product-card-facts">' + facts + '</dl>' : '')
            + '    <div class="product-card-actions">'
            + '      <a class="btn-primary product-card-view" href="' + escapeHtml(detailUrl) + '">' + escapeHtml(product.ctaLabel) + '</a>'
            + '      <button class="product-card-save" type="button"'
            + '        data-shortlist-add'
            + '        data-label-default="Shortlist" data-label-saved="Shortlisted"'
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
            + attr('data-product-min-deposit-pct', product.minDepositPct)
            + attr('data-position', index + 1)
            + '>Shortlist</button>'
            + '    </div>'
            + '  </div>'
            + '</article>';
    }

    function setStatus(statusEl, message) {
        if (statusEl) statusEl.textContent = message;
    }

    function init() {
        var grid = document.getElementById('productGrid');
        if (!grid || !window.MeridianCatalogData) return;

        var statusEl = grid.querySelector('[data-product-grid-status]');
        var category = grid.dataset.category || '';
        var limit = Number(grid.dataset.limit) || DEFAULT_LIMIT;

        window.MeridianCatalogData.loadProducts()
            .then(function (products) {
                var filtered = category
                    ? products.filter(function (p) { return p.category === category; })
                    : products;
                var visible = filtered.slice(0, limit);

                if (!visible.length) {
                    setStatus(statusEl, 'No products to show.');
                    return;
                }

                /* Dengage inline target slot, appended as the last grid cell.
                   It cannot live in the HTML because this assignment replaces
                   everything inside the grid. Empty and hidden until an inline
                   On-Site campaign fills it. Do not style it. */
                grid.innerHTML = visible.map(renderCard).join('')
                    + '<div id="dn_inline_target_in_grid" class="dn-inline-slot"></div>';

                /* Repaint the saved state now the buttons exist. */
                window.dispatchEvent(new CustomEvent('meridian:shortlist:updated', {
                    detail: { action: 'render' }
                }));
            })
            .catch(function (error) {
                console.error('MeridianCatalogData load failed', error);
                setStatus(statusEl, 'Unable to load products right now.');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
