/* ============================================================================
   Meridian shortlist, and the start of an application

   Replaces the cart. A bank has no basket: you do not buy two mortgages and
   check out. What a customer actually does is shortlist a few products to
   compare, then start ONE application for ONE product.

   So this module holds a shortlist with no quantities and no prices, and
   starting an application is a separate act against a single product rather
   than a checkout over a basket.

   EVENTS
     shortlist add       -> banking_product_events   product_shortlisted
     shortlist remove    -> banking_product_events   product_unshortlisted
     clear               -> banking_product_events   product_unshortlisted, one per item
     start application   -> banking_application_events application_started

   No ec:addToCart, no ec:beginCheckout, no ec:order. See
   docs/EVENT-CATALOGUE.md §0 for why the ecommerce tables are not used here.

   LEGACY NAMES
   window.MeridianCart and the data-cart-add attribute are kept as aliases.
   js/allReco.js and js/similarProducts.js inject buttons bound to them and
   have not been rewritten yet. The alias goes when the last caller does.
   ========================================================================== */
(function () {
    'use strict';

    var STORAGE_KEY = 'meridian_shortlist';
    /* Read the old key once so a demo mid-session does not lose its state. */
    var LEGACY_KEY = 'meridian_cart_items';

    var items = loadItems();

    function loadItems() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw === null) raw = localStorage.getItem(LEGACY_KEY);
            var saved = JSON.parse(raw || '[]');
            return Array.isArray(saved) ? saved.map(normalizeItem).filter(Boolean) : [];
        } catch (err) {
            return [];
        }
    }

    function saveItems() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (err) {
            /* Private browsing. The shortlist stays in memory for this page. */
        }
    }

    /* Absent, null and '' all stay null. Number(null) is 0, and a 0 rate or a
       0 fee is a claim about the product rather than "not known". Idempotent,
       because normalize runs over its own output when state is reloaded. */
    function numOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    function normalizeItem(raw) {
        if (!raw) return null;
        var id = String(raw.id || raw.productId || '').trim();
        if (!id) return null;

        return {
            id: id,
            name: raw.name || raw.productName || '',
            category: raw.category || raw.productCategory || '',
            subtype: raw.subtype || '',
            image: raw.image || '',
            rateDisplay: raw.rateDisplay || '',
            feeDisplay: raw.feeDisplay || '',
            headlineRate: numOrNull(raw.headlineRate),
            rateType: raw.rateType || '',
            termMonths: numOrNull(raw.termMonths),
            feeAmount: numOrNull(raw.feeAmount),
            feeFrequency: raw.feeFrequency || '',
            minDepositPct: numOrNull(raw.minDepositPct)
        };
    }

    /* The shape js/bankingEvents.js expects. Field names match the catalogue. */
    function asProduct(item) {
        return {
            id: item.id,
            name: item.name,
            category: item.category,
            subtype: item.subtype,
            headlineRate: item.headlineRate,
            rateType: item.rateType,
            termMonths: item.termMonths,
            feeAmount: item.feeAmount,
            feeFrequency: item.feeFrequency,
            minDepositPct: item.minDepositPct
        };
    }

    function events() {
        return window.MeridianEvents || null;
    }

    function pushDataLayer(eventName, detail) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: eventName }, detail || {}));
    }

    function emitChange(action, changedItem) {
        var detail = {
            action: action,
            item: changedItem || null,
            items: items.slice(),
            count: items.length
        };
        window.dispatchEvent(new CustomEvent('meridian:shortlist:updated', { detail: detail }));
        /* Legacy listeners in cartUi's era. Harmless once nothing listens. */
        window.dispatchEvent(new CustomEvent('meridian:cart:updated', { detail: detail }));
    }

    function has(id) {
        return items.some(function (item) { return item.id === String(id); });
    }

    function addItem(rawItem) {
        var item = normalizeItem(rawItem);
        if (!item) return null;
        if (has(item.id)) return item;   // a shortlist has no quantity

        items.push(item);
        saveItems();

        var ev = events();
        if (ev) ev.product.shortlisted(asProduct(item));
        pushDataLayer('banking_product_shortlisted', { product_id: item.id });
        emitChange('add', item);
        return item;
    }

    function removeItem(id) {
        var index = items.findIndex(function (item) { return item.id === String(id); });
        if (index === -1) return null;

        var item = items[index];
        items.splice(index, 1);
        saveItems();

        var ev = events();
        if (ev) ev.product.unshortlisted(asProduct(item));
        pushDataLayer('banking_product_unshortlisted', { product_id: item.id });
        emitChange('remove', item);
        return item;
    }

    function toggleItem(rawItem) {
        var item = normalizeItem(rawItem);
        if (!item) return null;
        return has(item.id) ? removeItem(item.id) : addItem(item);
    }

    function clear(options) {
        if (!items.length) return;
        var silent = !!(options && options.silent);
        var removed = items.slice();
        items = [];
        saveItems();

        if (!silent) {
            var ev = events();
            /* One row per product, not one "cleared" row. A campaign needs to
               know WHICH product stopped being considered. */
            if (ev) {
                removed.forEach(function (item) { ev.product.unshortlisted(asProduct(item)); });
            }
        }
        emitChange('clear', null);
    }

    /* Comparing is a first-class act on a banking site, and a strong signal:
       it says which products were genuinely in contention. */
    function compare() {
        if (items.length < 2) return null;
        var ids = items.map(function (item) { return item.id; });
        var ev = events();
        if (ev) {
            items.forEach(function (item) {
                ev.product.compared(asProduct(item), ids.filter(function (id) { return id !== item.id; }));
            });
        }
        pushDataLayer('banking_products_compared', { product_ids: ids.join(',') });
        return ids;
    }

    /* Starting an application is against ONE product. It is not a checkout,
       and the shortlist is deliberately not emptied: a customer applying for a
       mortgage may still be weighing two savings accounts. */
    function startApplication(productId, meta) {
        var item = items.find(function (entry) { return entry.id === String(productId); })
            || normalizeItem(meta && meta.product);
        if (!item) return null;

        meta = meta || {};
        var applicationId = 'APP-' + Date.now().toString().slice(-7);

        var ev = events();
        if (ev) {
            ev.application.started({
                applicationId: applicationId,
                productId: item.id,
                productCategory: item.category,
                totalSteps: meta.totalSteps || null,
                requestedAmount: numOrNull(meta.requestedAmount),
                requestedTermMonths: numOrNull(meta.requestedTermMonths)
            });
        }
        pushDataLayer('banking_application_started', {
            application_id: applicationId,
            product_id: item.id
        });

        var detail = { applicationId: applicationId, product: item };
        window.dispatchEvent(new CustomEvent('meridian:application:started', { detail: detail }));
        return detail;
    }

    function getSummary() {
        return { items: items.slice(), count: items.length };
    }

    var api = {
        addItem: addItem,
        removeItem: removeItem,
        toggleItem: toggleItem,
        has: has,
        clear: clear,
        compare: compare,
        startApplication: startApplication,
        getSummary: getSummary
    };

    window.MeridianShortlist = api;

    /* Legacy surface. allReco.js and similarProducts.js still call these. */
    window.MeridianCart = Object.assign({
        clearCart: clear,
        decrementItem: removeItem,
        checkout: function () { return null; }   // there is no checkout on this site
    }, api);

    emitChange('init');
})();
