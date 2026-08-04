/* ============================================================================
   Meridian product catalogue loader

   Banking products are not retail SKUs. There is no price, no was-price, no
   colour and no stock, because a mortgage has none of those things. The feed
   carries what a bank product actually has: a headline rate and its type, a
   term, a fee and how often it is charged, deposit and loan-to-value limits,
   and the regulated text that has to appear with it.

   The shape of this object deliberately mirrors the columns in
   docs/EVENT-CATALOGUE.md, so wiring an event is a field copy rather than a
   translation. If you add a column there, add the field here under the same
   name.

   NOTHING here produces stock_count, under any name. See CLAUDE.md §3.11.
   ========================================================================== */
(function () {
    const SOURCE_URL = 'meridian_products.json';

    let productsPromise = null;
    let productsById = new Map();

    /* Absent, null and '' all have to survive as null. Number(null) is 0, and a
       0 rate or a 0 fee is a factual claim about a product, not "unknown". This
       function is applied twice on some paths, so it must be idempotent. */
    function numOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function listOf(value) {
        return Array.isArray(value) ? value.filter(Boolean) : [];
    }

    function normalizeProduct(raw) {
        if (!raw || !raw.id) return null;

        return {
            id: String(raw.id),
            name: raw.name || 'Meridian product',
            category: raw.category || '',
            categoryLabel: raw.categoryLabel || '',
            /* "Products > Mortgages > First home". page_view_events wants the
               path shape, so it is stored rather than derived. */
            categoryPath: raw.categoryPath || '',
            subtype: raw.subtype || '',
            tier: raw.tier || 'classic',
            image: raw.image || '',
            summary: raw.summary || '',
            detail: raw.detail || '',

            headlineRate: numOrNull(raw.headlineRate),
            rateType: raw.rateType || '',
            rateDisplay: raw.rateDisplay || '',
            rateCaption: raw.rateCaption || '',

            termMonths: numOrNull(raw.termMonths),
            feeAmount: numOrNull(raw.feeAmount),
            feeFrequency: raw.feeFrequency || '',
            feeDisplay: raw.feeDisplay || '',

            minDepositPct: numOrNull(raw.minDepositPct),
            maxLtv: numOrNull(raw.maxLtv),
            minAmount: numOrNull(raw.minAmount),
            maxAmount: numOrNull(raw.maxAmount),

            highlights: listOf(raw.highlights),
            keyFacts: listOf(raw.keyFacts),
            eligibility: listOf(raw.eligibility),

            badge: raw.badge || '',
            /* Regulated text. Rendered verbatim wherever the product appears
               with a rate, never paraphrased and never truncated. */
            representativeExample: raw.representativeExample || '',
            riskWarning: raw.riskWarning || '',
            ctaLabel: raw.ctaLabel || 'Find out more',

            url: 'product.html?id=' + encodeURIComponent(String(raw.id))
        };
    }

    function loadProducts() {
        if (!productsPromise) {
            productsPromise = fetch(SOURCE_URL, { cache: 'no-store' })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('Failed to load products (' + response.status + ')');
                    }
                    return response.json();
                })
                .then(function (data) {
                    const list = Array.isArray(data) ? data : [];
                    const normalized = list.map(normalizeProduct).filter(Boolean);

                    productsById = new Map();
                    normalized.forEach(function (product) {
                        productsById.set(product.id, product);
                    });

                    return normalized;
                })
                .catch(function (error) {
                    productsPromise = null;
                    throw error;
                });
        }

        return productsPromise;
    }

    function getProductById(id) {
        return loadProducts().then(function () {
            return productsById.get(String(id)) || null;
        });
    }

    function getByCategory(category) {
        return loadProducts().then(function (all) {
            return all.filter(function (p) { return p.category === category; });
        });
    }

    function categories() {
        return loadProducts().then(function (all) {
            const seen = new Map();
            all.forEach(function (p) {
                if (!seen.has(p.category)) {
                    seen.set(p.category, { key: p.category, label: p.categoryLabel, count: 0 });
                }
                seen.get(p.category).count += 1;
            });
            return Array.from(seen.values());
        });
    }

    /* Money, for fees and amounts. Rates are already formatted in the feed,
       because "4.10% AER" and "6.9% APR" are not the same unit and must not be
       rendered by a shared number formatter. */
    function formatMoney(value, currency) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency || 'GBP',
            minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2
        }).format(Number(value) || 0);
    }

    function buildProductUrl(id) {
        return 'product.html?id=' + encodeURIComponent(String(id));
    }

    window.MeridianCatalogData = {
        loadProducts,
        getProductById,
        getByCategory,
        categories,
        formatMoney,
        /* Kept as an alias, not as a second implementation. The widget files and
           the shared modules still call formatPrice, and "price" is the wrong
           word for a bank product, so the name goes when the last caller does.
           Dropping it early takes 25 scenario widgets down at once. */
        formatPrice: formatMoney,
        buildProductUrl
    };
})();
