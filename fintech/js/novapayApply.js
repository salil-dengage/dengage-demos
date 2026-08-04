/* ============================================================================
   NovaPay: the shortlist behind the recommendation widgets
   ----------------------------------------------------------------------------
   WHY THIS FILE IS CALLED WHAT window.NovaPayCart IS CALLED

   The five recommendation widgets, the similar-products slider and the product
   page all render an "Add to application" button and then call
   `window.NovaPayCart.addItem(...)`. That name is the contract between roughly
   2,500 lines of widget code and the page, and those widgets are Dengage demo
   surface: they are the thing being shown, so they are not being rewritten to
   suit a rename.

   What changed is what the contract DOES. There is no cart on this site.
   js/cartManager.js has been retired because it wrote shopping_cart_events and
   order_events through the ec:* actions, and a card has no quantity, a loan has
   no shipping method, and an application is approved or declined rather than
   ordered.

   So this file keeps the interface and replaces the meaning:

     addItem       -> shortlist the product, write product_shortlisted
     removeItem    -> unshortlist it, write product_unshortlisted
     decrementItem -> same as removeItem; there are no quantities here
     getSummary    -> what is shortlisted, with a monthly total, not a basket total
     checkout      -> start an application and open the app

   Without it those buttons are silently dead: every call site is guarded with
   `if (!window.NovaPayCart) return`, so nothing errors and nothing happens,
   which in a live demo is worse than an error.
   ========================================================================== */

(function (window, document) {
  'use strict';

  var Events = window.NovaPayEvents;
  var State = window.NovaPayState;

  if (!Events || !State) {
    console.error('[novapay-apply] events or state layer missing');
    return;
  }

  /* The landing page's own product facts. The widgets pass a price from the
     feed, which is the legacy yearly figure; the monthly plan fee is what this
     site quotes, so it is looked up here rather than trusted from the button. */
  var MONTHLY_FEE = {
    'NPY-CRD-PLUS': 0, 'NPY-CRD-METAL': 16.99, 'NPY-CRD-TRAVEL': 6.99,
    'NPY-CRD-BIZ': 9.99, 'NPY-SAV-BOOST': 0, 'NPY-SAV-POTS': 1.99,
    'NPY-INV-ROBO': 0.45, 'NPY-INV-STOCKS': 0, 'NPY-INV-CRYPTO': 0,
    'NPY-CRE-LOAN': 0, 'NPY-CRE-BUILD': 4.99, 'NPY-GLB-ACCOUNT': 0,
    'NPY-GLB-TRANSFER': 0, 'NPY-PRO-TRAVEL': 9.99, 'NPY-PRO-DEVICE': 6.99,
    'NPY-PRO-PURCHASE': 4.99
  };

  function familyOf(id) {
    if (!id) return undefined;
    if (id.indexOf('-CRD-') > -1) return 'cards';
    if (id.indexOf('-SAV-') > -1) return 'savings';
    if (id.indexOf('-INV-') > -1) return 'investing';
    if (id.indexOf('-CRE-') > -1) return 'credit';
    if (id.indexOf('-GLB-') > -1) return 'global';
    if (id.indexOf('-PRO-') > -1) return 'protection';
    return undefined;
  }

  function payload(item, extra) {
    var id = item && item.id;
    var fee = MONTHLY_FEE[id];
    var base = {
      product_id: id,
      product_name: item && item.name,
      product_family: familyOf(id),
      /* undefined rather than 0 when the product is not in the table: an
         unknown fee is not a free product, and 0 would say it was. */
      monthly_fee: fee === undefined ? undefined : Events.money(fee)
    };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  function toast(message) {
    var node = document.getElementById('loginSuccessMessage');
    if (!node) return;
    node.textContent = message;
    node.classList.add('active');
    clearTimeout(window.novapayToastTimer);
    window.novapayToastTimer = setTimeout(function () {
      node.classList.remove('active');
    }, 2200);
  }

  var NovaPayCart = {

    addItem: function (item) {
      if (!item || !item.id) return;
      State.shortlist(item.id);
      Events.product('product_shortlisted', payload(item, {
        funnel_step: 'shortlisted', step_index: 3
      }));
      toast('Added to your application.');
      return State.get().shortlist;
    },

    removeItem: function (item) {
      var id = (item && item.id) || item;
      if (!id) return;
      State.unshortlist(id);
      Events.product('product_unshortlisted', payload({ id: id }, {
        funnel_step: 'shortlisted'
      }));
      return State.get().shortlist;
    },

    /* No quantities on this site: you do not hold two of the same current
       account. Decrementing is removal. */
    decrementItem: function (item) {
      return NovaPayCart.removeItem(item);
    },

    getSummary: function () {
      var ids = State.get().shortlist || [];
      var monthly = ids.reduce(function (sum, id) {
        var fee = MONTHLY_FEE[id];
        return sum + (fee === undefined ? 0 : fee);
      }, 0);
      return {
        items: ids.slice(),
        count: ids.length,
        /* A monthly plan total, not a basket total. Named `total` because that
           is what the widget code reads. */
        total: Math.round(monthly * 100) / 100,
        currency: 'USD'
      };
    },

    checkout: function () {
      var ids = State.get().shortlist || [];
      if (!ids.length) {
        window.location.href = 'app.html';
        return;
      }
      var applicationId = State.nextApplicationId();

      /* One row per product, sharing an application_id. That is what makes
         "applied for a card and a savings product together" answerable, and it
         is the honest replacement for an order with line items. */
      ids.forEach(function (id, i) {
        Events.product('application_started', payload({ id: id }, {
          application_id: applicationId,
          funnel_step: 'application_started',
          step_index: 5,
          products_in_application: ids.length,
          comparison_set: ids.join(','),
          step_order: i + 1
        }));
      });

      window.location.href = 'app.html';
    }
  };

  window.NovaPayCart = NovaPayCart;

  /* --------------------------------------------------- the delegated listener
     Three renderers produce an "Add to application" button and they do NOT
     agree on who binds it:

       allReco.js         renders [data-cart-add] AND binds each button itself,
                          marking it data-reco-bound
       similarProducts.js renders [data-cart-add] and binds NOTHING
       productDetail.js   renders [data-product-add-to-cart] and binds it itself

     The similar-products slider used to work only because js/cartUi.js carried
     a document-level listener for [data-cart-add]. Retiring the cart retired
     that listener too, which left the slider's buttons silently dead: no error,
     no event, nothing on screen. Found by clicking one, not by reading a diff.

     So the listener comes back here, minus the cart. It skips buttons that
     allReco has already bound, because both firing would write the shortlist
     event twice and double every count in the table. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-cart-add]');
    if (!btn) return;
    if (btn.hasAttribute('data-reco-bound')) return;   // allReco binds its own
    if (btn.disabled) return;

    e.preventDefault();
    NovaPayCart.addItem({
      id: btn.getAttribute('data-product-id'),
      name: btn.getAttribute('data-product-name'),
      currency: btn.getAttribute('data-product-currency') || 'USD',
      image: btn.getAttribute('data-product-image'),
      category: btn.getAttribute('data-product-category')
    });
  });

})(window, document);
