/* ============================================================================
   Shortlist drawer

   Renders the shortlist and wires the buttons. Replaces the cart drawer.

   There is no quantity control and no total, because neither means anything
   for a bank product. What the drawer offers instead is the two things a
   customer actually does next: compare the shortlist, or start an application
   for one product.

   BUTTON HOOKS
     data-shortlist-add   preferred, carries data-product-* attributes
     data-cart-add        legacy alias, still emitted by js/allReco.js and
                          js/similarProducts.js
   ========================================================================== */
(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, function (char) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
            });
    }

    function shortlist() {
        return window.MeridianShortlist || null;
    }

    /* Read a product off a button's data-* attributes. Both the banking names
       and the older cart names are accepted, because the widget files still
       emit the old ones. */
    function productFromButton(button) {
        var d = button.dataset;
        return {
            id: d.productId,
            name: d.productName,
            category: d.productCategory,
            subtype: d.productSubtype,
            image: d.productImage,
            rateDisplay: d.productRateDisplay || d.productRate || '',
            feeDisplay: d.productFeeDisplay || d.productFee || '',
            headlineRate: d.productHeadlineRate,
            rateType: d.productRateType,
            termMonths: d.productTermMonths,
            feeAmount: d.productFeeAmount,
            feeFrequency: d.productFeeFrequency,
            minDepositPct: d.productMinDepositPct
        };
    }

    function renderRow(item) {
        return ''
            + '<article class="shortlist-row" data-shortlist-row="' + escapeHtml(item.id) + '">'
            + (item.image
                ? '<div class="shortlist-row-media"><img src="' + escapeHtml(item.image) + '" alt="" loading="lazy"></div>'
                : '')
            + '  <div class="shortlist-row-body">'
            + '    <h3 class="shortlist-row-name">' + escapeHtml(item.name) + '</h3>'
            + (item.rateDisplay ? '<p class="shortlist-row-rate">' + escapeHtml(item.rateDisplay) + '</p>' : '')
            + (item.feeDisplay ? '<p class="shortlist-row-fee">' + escapeHtml(item.feeDisplay) + '</p>' : '')
            + '    <div class="shortlist-row-actions">'
            + '      <a class="btn-text" href="product.html?id=' + encodeURIComponent(item.id) + '">View details</a>'
            + '      <button class="shortlist-row-apply" type="button" data-shortlist-apply="' + escapeHtml(item.id) + '">Start application</button>'
            + '    </div>'
            + '  </div>'
            + '  <button class="shortlist-row-remove" type="button" aria-label="Remove ' + escapeHtml(item.name) + ' from your shortlist" data-shortlist-remove="' + escapeHtml(item.id) + '">&times;</button>'
            + '</article>';
    }

    function render() {
        var list = shortlist();
        if (!list) return;

        var summary = list.getSummary();
        var container = document.querySelector('[data-shortlist-items]');
        var emptyEl = document.querySelector('[data-shortlist-empty]');
        var footerEl = document.querySelector('[data-shortlist-footer]');
        var compareBtn = document.querySelector('[data-shortlist-compare]');

        document.querySelectorAll('[data-shortlist-count]').forEach(function (el) {
            el.textContent = String(summary.count);
        });

        if (container) {
            container.innerHTML = summary.items.map(renderRow).join('');
        }
        if (emptyEl) emptyEl.hidden = summary.count > 0;
        if (footerEl) footerEl.hidden = summary.count === 0;
        /* Comparing one product against nothing is not a comparison. */
        if (compareBtn) compareBtn.disabled = summary.count < 2;

        /* The header has no shortlist control any more, so the entry point
           appears in the product section only when there is something to
           open. A permanent control for a feature most visitors never touch
           is exactly the clutter that was removed. */
        var inline = document.querySelector('[data-shortlist-inline]');
        if (inline) {
            inline.hidden = summary.count === 0;
            inline.innerHTML = summary.count
                ? '<button class="section-shortlist-btn" type="button" data-shortlist-open>'
                  + 'Compare your shortlist (' + summary.count + ')</button>'
                : '';
        }

        /* Any add button whose product is already shortlisted reads as saved,
           so the control tells the truth on a page revisit. */
        document.querySelectorAll('[data-shortlist-add], [data-cart-add]').forEach(function (button) {
            var id = button.dataset.productId;
            if (!id) return;
            var saved = list.has(id);
            button.classList.toggle('is-saved', saved);
            if (button.dataset.labelSaved || button.dataset.labelDefault) {
                button.textContent = saved
                    ? (button.dataset.labelSaved || 'Shortlisted')
                    : (button.dataset.labelDefault || 'Add to shortlist');
            }
        });
    }

    function openDrawer() {
        var drawer = document.getElementById('shortlistDrawer');
        if (!drawer) return;
        drawer.setAttribute('aria-hidden', 'false');
        drawer.classList.add('is-open');
        document.body.classList.add('drawer-open');
    }

    function closeDrawer() {
        var drawer = document.getElementById('shortlistDrawer');
        if (!drawer) return;
        drawer.setAttribute('aria-hidden', 'true');
        drawer.classList.remove('is-open');
        document.body.classList.remove('drawer-open');
    }

    function onClick(event) {
        var list = shortlist();
        if (!list) return;

        var addBtn = event.target.closest('[data-shortlist-add], [data-cart-add]');
        if (addBtn) {
            event.preventDefault();
            list.toggleItem(productFromButton(addBtn));
            return;
        }

        var removeBtn = event.target.closest('[data-shortlist-remove]');
        if (removeBtn) {
            list.removeItem(removeBtn.dataset.shortlistRemove);
            return;
        }

        var applyBtn = event.target.closest('[data-shortlist-apply]');
        if (applyBtn) {
            var started = list.startApplication(applyBtn.dataset.shortlistApply);
            if (started) {
                window.location.href = 'apply.html?product='
                    + encodeURIComponent(started.product.id)
                    + '&application=' + encodeURIComponent(started.applicationId);
            }
            return;
        }

        if (event.target.closest('[data-shortlist-compare]')) {
            var ids = list.compare();
            if (ids) window.location.href = 'compare.html?ids=' + encodeURIComponent(ids.join(','));
            return;
        }

        if (event.target.closest('[data-shortlist-clear]')) {
            list.clear();
            return;
        }

        if (event.target.closest('[data-shortlist-open], [data-cart-open]')) {
            event.preventDefault();
            openDrawer();
            return;
        }

        if (event.target.closest('[data-shortlist-close], [data-cart-close]')) {
            closeDrawer();
        }
    }

    function init() {
        document.addEventListener('click', onClick);
        window.addEventListener('meridian:shortlist:updated', render);
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeDrawer();
        });
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
