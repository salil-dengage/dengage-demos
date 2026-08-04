/* ============================================================================
   Comparison table

   Renders the shortlist side by side and writes banking_product_events
   product_compared, one row per product, each naming the others it was
   weighed against. That is the signal worth having: which products were
   genuinely in contention, not just which were viewed.

   Where a product has no equivalent of a row, the cell says so. It does NOT
   show a zero. A 0 fee and "this product has no fee of that kind" are
   different claims, and a comparison table that blurs them is misleading in
   exactly the way a bank must not be.
   ========================================================================== */
(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, function (char) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
            });
    }

    var NOT_APPLICABLE = '<span class="compare-na">Not applicable</span>';

    function money(value) {
        if (value === null || value === undefined) return NOT_APPLICABLE;
        return new Intl.NumberFormat('en-GB', {
            style: 'currency', currency: 'GBP',
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2
        }).format(value);
    }

    function term(months) {
        if (months === null || months === undefined) return NOT_APPLICABLE;
        if (months % 12 === 0) {
            var years = months / 12;
            return years + (years === 1 ? ' year' : ' years');
        }
        return months + ' months';
    }

    function pct(value, suffix) {
        if (value === null || value === undefined) return NOT_APPLICABLE;
        return value + (suffix || '%');
    }

    var ROWS = [
        { label: 'Category',        get: function (p) { return escapeHtml(p.categoryLabel); } },
        { label: 'Headline rate',   get: function (p) { return escapeHtml(p.rateDisplay) || NOT_APPLICABLE; } },
        { label: 'Rate basis',      get: function (p) { return escapeHtml(p.rateCaption) || NOT_APPLICABLE; } },
        { label: 'Fee',             get: function (p) { return escapeHtml(p.feeDisplay) || money(p.feeAmount); } },
        { label: 'Term',            get: function (p) { return term(p.termMonths); } },
        { label: 'Minimum deposit', get: function (p) { return pct(p.minDepositPct); } },
        { label: 'Maximum LTV',     get: function (p) { return pct(p.maxLtv); } },
        { label: 'Minimum amount',  get: function (p) { return money(p.minAmount); } },
        { label: 'Maximum amount',  get: function (p) { return money(p.maxAmount); } }
    ];

    function renderTable(products) {
        var head = '<th scope="col">&nbsp;</th>' + products.map(function (p) {
            return '<th scope="col">'
                 + '<a href="product.html?id=' + encodeURIComponent(p.id) + '">'
                 + escapeHtml(p.name) + '</a></th>';
        }).join('');

        var body = ROWS.map(function (row) {
            return '<tr><th scope="row">' + escapeHtml(row.label) + '</th>'
                 + products.map(function (p) { return '<td>' + row.get(p) + '</td>'; }).join('')
                 + '</tr>';
        }).join('');

        var actions = '<tr><th scope="row">&nbsp;</th>' + products.map(function (p) {
            return '<td><button class="shortlist-row-apply" type="button" data-shortlist-apply="'
                 + escapeHtml(p.id) + '">' + escapeHtml(p.ctaLabel) + '</button></td>';
        }).join('') + '</tr>';

        /* Regulated text sits under the table, in full, per product that has
           one. Not in a tooltip and not truncated. */
        var regulated = products.filter(function (p) {
            return p.representativeExample || p.riskWarning;
        }).map(function (p) {
            return '<div class="compare-regulated">'
                 + '<h3>' + escapeHtml(p.name) + '</h3>'
                 + (p.riskWarning ? '<p><strong>Risk warning.</strong> ' + escapeHtml(p.riskWarning) + '</p>' : '')
                 + (p.representativeExample ? '<p>' + escapeHtml(p.representativeExample) + '</p>' : '')
                 + '</div>';
        }).join('');

        return '<div class="compare-scroll"><table class="compare-table">'
             + '<thead><tr>' + head + '</tr></thead>'
             + '<tbody>' + body + actions + '</tbody>'
             + '</table></div>'
             + (regulated ? '<div class="compare-regulated-set">' + regulated + '</div>' : '');
    }

    function idsFromQuery() {
        var raw = new URLSearchParams(window.location.search).get('ids');
        return raw ? raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    }

    function init() {
        var container = document.querySelector('[data-compare-table]');
        if (!container || !window.MeridianCatalogData) return;

        /* The URL wins when present, so a comparison can be linked or reloaded.
           Otherwise fall back to whatever is on the shortlist now. */
        var ids = idsFromQuery();
        if (!ids.length && window.MeridianShortlist) {
            ids = window.MeridianShortlist.getSummary().items.map(function (i) { return i.id; });
        }

        if (!ids.length) {
            container.innerHTML = '<p class="calc-note">Your shortlist is empty. '
                + '<a href="index.html#products">Browse the range</a> and shortlist anything you want to compare.</p>';
            return;
        }
        if (ids.length === 1) {
            container.innerHTML = '<p class="calc-note">You have shortlisted one product, so there is nothing to compare it against yet. '
                + '<a href="index.html#products">Add another</a>.</p>';
            return;
        }

        window.MeridianCatalogData.loadProducts()
            .then(function (all) {
                var byId = {};
                all.forEach(function (p) { byId[p.id] = p; });
                var products = ids.map(function (id) { return byId[id]; }).filter(Boolean);

                if (products.length < 2) {
                    container.innerHTML = '<p class="calc-note">Those products could not be found.</p>';
                    return;
                }

                container.innerHTML = renderTable(products);

                if (!window.MeridianEvents) return;
                var allIds = products.map(function (p) { return p.id; });
                products.forEach(function (p) {
                    window.MeridianEvents.product.compared(p, allIds.filter(function (id) {
                        return id !== p.id;
                    }));
                });
            })
            .catch(function (error) {
                console.error('Could not load the comparison', error);
                container.innerHTML = '<p class="calc-note">Unable to load the comparison right now.</p>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
