/* ============================================================================
   NovaPay app
   ----------------------------------------------------------------------------
   The logged-in money app: balance, transfers, cards, pots, investing, credit,
   support and the product application funnel.

   Every action here does two things, in this order:
     1. changes state, through js/novapayState.js
     2. describes what changed, through js/novapayEvents.js

   Never the reverse, and never both in one function. A screen that sends the
   event before the state change has to guess at the resulting balance, and a
   state module that sends its own events fires spurious ones when it repairs
   state on load.

   NO ec:* CALLS. See js/novapayEvents.js for why. If you find yourself
   reaching for addToCart here, the thing you want is
   NovaPayEvents.product('application_started', ...).
   ========================================================================== */

(function (window, document) {
  'use strict';

  var State = window.NovaPayState;
  var Events = window.NovaPayEvents;

  if (!State || !Events) {
    console.error('[novapay-app] state or events layer missing');
    return;
  }

  /* ------------------------------------------------------------------ utils */

  /* Pot names are typed by the presenter, so they are untrusted input in the
     only place this demo has any. Escaped on the way into innerHTML. */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmt(amount, currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currency || 'USD'
      }).format(amount);
    } catch (err) {
      return (currency || 'USD') + ' ' + Number(amount).toFixed(2);
    }
  }

  function el(id) { return document.getElementById(id); }

  /* Which portal page this is. The portal was one page until 2 Aug 2026, with
     five views toggled by a hidden attribute, which meant all ten portal
     signals fired on a single load: every inline campaign appeared at once and
     the only way to demo them one at a time was to reset between each.

     Now each view is a real page carrying only its own slots and pushing only
     its own signals. That needs NO panel change, because the campaigns trigger
     on the EVENT NAME: an event that only fires on cards.html can only ever
     show there. */
  var VIEW = (document.body && document.body.dataset && document.body.dataset.portalView)
    || 'home';

  function dayLabel(daysAgo) {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return daysAgo + ' days ago';
  }

  var CATEGORY_ICON = {
    groceries: '🛒', transport: '🚇', eating_out: '☕',
    subscriptions: '🔁', travel: '✈️', bills: '📄',
    shopping: '🛍️', salary: '💰', transfer: '⇄',
    cash: '🏧'
  };

  /* ------------------------------------------------------------------ modal
     One host element, so only one dialog can be open and the focus and escape
     handling live in one place rather than per flow. */
  var modalHost = el('novapay-modal-host');
  var lastFocused = null;

  function openModal(title, bodyHtml, onMount) {
    lastFocused = document.activeElement;
    modalHost.innerHTML =
      '<div class="npy-modal-backdrop" data-modal-close></div>' +
      '<div class="npy-modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="npy-modal-head">' +
          '<h2>' + esc(title) + '</h2>' +
          '<button class="npy-modal-x" type="button" aria-label="Close" data-modal-close>&times;</button>' +
        '</div>' +
        '<div class="npy-modal-body">' + bodyHtml + '</div>' +
      '</div>';
    modalHost.hidden = false;
    document.body.classList.add('npy-modal-open');

    var focusable = modalHost.querySelector('input, select, textarea, button:not([data-modal-close])');
    if (focusable) focusable.focus();
    if (typeof onMount === 'function') onMount(modalHost);
  }

  function closeModal() {
    modalHost.hidden = true;
    modalHost.innerHTML = '';
    document.body.classList.remove('npy-modal-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalHost.hidden) closeModal();
  });

  /* Confirmation panel shown inside the modal after an action succeeds. The
     demo needs a visible result, otherwise a presenter clicks Send and has
     nothing to point at. */
  function modalResult(title, lines) {
    var body = '<div class="npy-result">' +
      '<div class="npy-result-tick" aria-hidden="true">&#10003;</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<ul>' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
      '<button class="npy-btn npy-btn-primary" type="button" data-modal-close>Done</button>' +
      '</div>';
    var box = modalHost.querySelector('.npy-modal-body');
    if (box) box.innerHTML = body;
  }

  /* ============================================================== HOME view */

  function renderHome() {
    var s = State.get();
    var acct = State.primaryAccount();
    var recent = s.transactions.slice(0, 5);

    var setupCard = '';
    if (s.kycStatus !== 'approved') {
      setupCard =
        '<section class="npy-card npy-setup">' +
          '<div>' +
            '<h3>Finish opening your account</h3>' +
            '<p>Verify your identity to unlock transfers, cards and savings. It takes about two minutes.</p>' +
          '</div>' +
          '<button class="npy-btn npy-btn-primary" type="button" data-action="start-kyc">Verify identity</button>' +
        '</section>';
    }

    var potsHtml = s.pots.map(function (p) {
      var pct = State.potProgress(p);
      return '<div class="npy-pot-mini">' +
        '<div class="npy-pot-mini-top"><span>' + esc(p.name) + '</span>' +
        '<strong>' + fmt(p.current, acct.currency) + '</strong></div>' +
        '<div class="npy-bar"><span style="width:' + pct + '%"></span></div>' +
        '<small>' + pct + '% of ' + fmt(p.goal, acct.currency) + '</small>' +
        '</div>';
    }).join('');

    var scoreDelta = s.credit.score - s.credit.lastScore;

    el('novapay-view-home').innerHTML =
      '<section class="npy-balance-card">' +
        '<p class="npy-balance-label">Total balance</p>' +
        '<p class="npy-balance">' + fmt(acct.balance, acct.currency) + '</p>' +
        '<p class="npy-balance-sub">' + esc(acct.id) + ' &middot; ' + esc(acct.currency) + ' current account</p>' +
        '<div class="npy-quick">' +
          '<button class="npy-quick-btn" type="button" data-action="add-money">' +
            '<span aria-hidden="true">+</span>Add money</button>' +
          '<button class="npy-quick-btn" type="button" data-action="send-money">' +
            '<span aria-hidden="true">&#8599;</span>Send</button>' +
          '<button class="npy-quick-btn" type="button" data-action="convert">' +
            '<span aria-hidden="true">&#8644;</span>Convert</button>' +
          '<button class="npy-quick-btn" type="button" data-action="goto-cards">' +
            '<span aria-hidden="true">&#9635;</span>Cards</button>' +
        '</div>' +
      '</section>' +

      setupCard +

      '<div class="npy-grid-2">' +
        '<section class="npy-card">' +
          '<h3>Recent activity</h3>' +
          '<ul class="npy-txn-list">' + recent.map(txnRow).join('') + '</ul>' +
          '<button class="npy-link" type="button" data-action="goto-money">See all activity</button>' +
        '</section>' +

        '<section class="npy-card">' +
          '<h3>Savings goals</h3>' +
          (potsHtml || '<p class="npy-empty">No goals yet.</p>') +
          '<button class="npy-link" type="button" data-action="goto-grow">Manage goals</button>' +
        '</section>' +
      '</div>' +

      '<section class="npy-card npy-score">' +
        '<div>' +
          '<h3>Credit score</h3>' +
          '<p class="npy-score-value">' + s.credit.score +
            '<span class="' + (scoreDelta >= 0 ? 'npy-up' : 'npy-down') + '">' +
            (scoreDelta >= 0 ? '+' : '') + scoreDelta + ' this month</span></p>' +
        '</div>' +
        '<button class="npy-btn" type="button" data-action="view-score">View report</button>' +
      '</section>';
  }

  function txnRow(t) {
    var inbound = (t.type === 'transfer_in' || t.type === 'topup' || t.type === 'refund');
    return '<li class="npy-txn" data-txn="' + esc(t.id) + '">' +
      '<span class="npy-txn-icon" aria-hidden="true">' +
        (CATEGORY_ICON[t.category] || '💳') + '</span>' +
      '<span class="npy-txn-main">' +
        '<span class="npy-txn-name">' + esc(t.merchant || t.type) + '</span>' +
        '<span class="npy-txn-meta">' + dayLabel(t.daysAgo) +
          (t.recurring ? ' &middot; recurring' : '') + '</span>' +
      '</span>' +
      '<span class="npy-txn-amt ' + (inbound ? 'npy-up' : '') + '">' +
        (inbound ? '+' : '-') + fmt(t.amount, t.currency).replace('-', '') + '</span>' +
      '<button class="npy-txn-flag" type="button" data-action="dispute" data-txn="' +
        esc(t.id) + '" aria-label="Report a problem with this transaction">!</button>' +
      '</li>';
  }

  /* ============================================================= MONEY view */

  function renderMoney() {
    var s = State.get();
    var acct = State.primaryAccount();

    el('novapay-view-money').innerHTML =
      '<section class="npy-card">' +
        '<div class="npy-card-head">' +
          '<h3>All activity</h3>' +
          '<div class="npy-actions">' +
            '<button class="npy-btn" type="button" data-action="add-money">Add money</button>' +
            '<button class="npy-btn npy-btn-primary" type="button" data-action="send-money">Send money</button>' +
          '</div>' +
        '</div>' +
        '<ul class="npy-txn-list">' + s.transactions.map(txnRow).join('') + '</ul>' +
      '</section>' +

      '<section class="npy-card">' +
        '<h3>Accounts</h3>' +
        '<ul class="npy-acct-list">' + s.accounts.map(function (a) {
          return '<li><span>' + esc(a.currency) + ' ' +
            esc(a.type.replace(/_/g, ' ')) + '</span><strong>' +
            fmt(a.balance, a.currency) + '</strong></li>';
        }).join('') + '</ul>' +
        '<button class="npy-link" type="button" data-action="statement">Download statement</button>' +
      '</section>';

    /* Viewing the money screen is a balance view, and balance_band is what a
       low-balance campaign segments on. */
    Events.account('balance_viewed', {
      account_id: acct.id,
      account_type: acct.type,
      currency: acct.currency,
      balance: Events.money(acct.balance),
      balance_band: Events.balanceBand(acct.balance),
      channel: 'web'
    });
  }

  /* ============================================================= CARDS view */

  function renderCards() {
    var s = State.get();

    el('novapay-view-cards').innerHTML =
      '<section class="npy-card">' +
        '<div class="npy-card-head">' +
          '<h3>Your cards</h3>' +
          '<button class="npy-btn npy-btn-primary" type="button" data-action="order-card">Order a card</button>' +
        '</div>' +
        '<div class="npy-cards">' + s.cards.map(function (c) {
          return '<div class="npy-cardface npy-tier-' + esc(c.tier) + (c.frozen ? ' is-frozen' : '') + '">' +
            '<span class="npy-cardface-tier">' + esc(c.tier) + '</span>' +
            '<span class="npy-cardface-num">&bull;&bull;&bull;&bull; ' + esc(c.last4) + '</span>' +
            '<span class="npy-cardface-type">' + esc(c.type) +
              (c.frozen ? ' &middot; frozen' : '') + '</span>' +
            '<div class="npy-cardface-actions">' +
              (c.activated
                ? '<button class="npy-btn npy-btn-sm" type="button" data-action="toggle-freeze" data-card="' +
                    esc(c.id) + '">' + (c.frozen ? 'Unfreeze' : 'Freeze') + '</button>'
                : '<button class="npy-btn npy-btn-sm npy-btn-primary" type="button" data-action="activate-card" data-card="' +
                    esc(c.id) + '">Activate</button>') +
              '<button class="npy-btn npy-btn-sm" type="button" data-action="view-pin" data-card="' +
                esc(c.id) + '">View PIN</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>' +
      '</section>';
  }

  /* ============================================================== GROW view */

  var INSTRUMENTS = [
    { id: 'NPY-INV-STOCKS', name: 'Stocks Pro', assetClass: 'stocks' },
    { id: 'NPY-INV-ROBO', name: 'Managed Portfolio', assetClass: 'managed_portfolio' },
    { id: 'NPY-INV-CRYPTO', name: 'Crypto Vault', assetClass: 'crypto' }
  ];

  function renderGrow() {
    var s = State.get();
    var acct = State.primaryAccount();

    var pots = s.pots.map(function (p) {
      var pct = State.potProgress(p);
      return '<div class="npy-pot">' +
        '<div class="npy-pot-top">' +
          '<div><h4>' + esc(p.name) + '</h4>' +
          '<small>' + esc(p.fundingMethod.replace(/_/g, ' ')) + ' &middot; ' + p.rate + '% AER</small></div>' +
          '<strong>' + fmt(p.current, acct.currency) + '</strong>' +
        '</div>' +
        '<div class="npy-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="npy-pot-foot"><small>' + pct + '% of ' + fmt(p.goal, acct.currency) + '</small>' +
        '<button class="npy-btn npy-btn-sm" type="button" data-action="fund-pot" data-pot="' +
          esc(p.id) + '">Add money</button></div>' +
        '</div>';
    }).join('');

    var holdings = s.holdings.length
      ? '<ul class="npy-acct-list">' + s.holdings.map(function (h) {
          return '<li><span>' + esc(h.name) + '</span><strong>' +
            fmt(h.value, acct.currency) + '</strong></li>';
        }).join('') + '</ul>'
      : '<p class="npy-empty">You have not invested yet.</p>';

    el('novapay-view-grow').innerHTML =
      '<section class="npy-card">' +
        '<div class="npy-card-head">' +
          '<h3>Savings goals</h3>' +
          '<button class="npy-btn npy-btn-primary" type="button" data-action="new-pot">New goal</button>' +
        '</div>' +
        (pots || '<p class="npy-empty">No goals yet.</p>') +
      '</section>' +

      '<section class="npy-card">' +
        '<div class="npy-card-head">' +
          '<h3>Investing</h3>' +
          '<button class="npy-btn npy-btn-primary" type="button" data-action="invest">Invest</button>' +
        '</div>' +
        holdings +
      '</section>' +

      '<section class="npy-card">' +
        '<div class="npy-card-head">' +
          '<h3>Borrowing</h3>' +
          '<button class="npy-btn" type="button" data-action="loan-calc">Loan calculator</button>' +
        '</div>' +
        '<p class="npy-empty">Representative 6.9% APR on loans from 1,000 to 25,000 over 12 to 60 months. Illustrative only.</p>' +
      '</section>';
  }

  /* ========================================================== PRODUCTS view
     The catalogue, in money-app terms: a monthly plan fee and a headline rate,
     not a price with a discount. That single change is most of what makes the
     data model read as FinTech rather than retail. */

  var PRODUCTS = [
    { id: 'NPY-CRD-PLUS', name: 'Plus Card', family: 'cards', tier: 'plus',
      fee: 0, rate: 1, rateType: 'cashback',
      blurb: 'Everyday spending, instant notifications, round-up saving and fee-free ATM withdrawals up to 1,000 a month.' },
    { id: 'NPY-CRD-METAL', name: 'Metal Card', family: 'cards', tier: 'metal',
      fee: 16.99, rate: 2, rateType: 'cashback',
      blurb: 'Brushed metal, 2% cashback, unlimited fee-free spending abroad and lounge access for two.' },
    { id: 'NPY-CRD-TRAVEL', name: 'Travel Card', family: 'cards', tier: 'premium',
      fee: 6.99, rate: 0, rateType: 'fx_markup',
      blurb: 'Interbank rates in 30 currencies, no foreign transaction fee, travel disruption cover included.' },
    { id: 'NPY-SAV-BOOST', name: 'Savings Boost', family: 'savings', tier: 'plus',
      fee: 0, rate: 4.85, rateType: 'aer',
      blurb: 'Lifts your main balance to 4.85% AER, paid daily, instant access, no withdrawal limits.' },
    { id: 'NPY-SAV-POTS', name: 'Goal Pots Pro', family: 'savings', tier: 'plus',
      fee: 1.99, rate: 4.85, rateType: 'aer',
      blurb: 'Unlimited pots with target dates, automatic round-ups, payday splitting and shared pots.' },
    { id: 'NPY-INV-ROBO', name: 'Managed Portfolio', family: 'investing', tier: 'premium',
      fee: 0.45, rate: 0, rateType: 'none',
      blurb: 'A diversified portfolio matched to your risk profile, rebalanced every quarter.' },
    { id: 'NPY-CRE-LOAN', name: 'Personal Loan', family: 'credit', tier: 'free',
      fee: 0, rate: 6.9, rateType: 'apr',
      blurb: 'Borrow 1,000 to 25,000 over 12 to 60 months, rate quoted before you apply, no early-repayment fee.' },
    { id: 'NPY-CRE-BUILD', name: 'Credit Builder', family: 'credit', tier: 'free',
      fee: 4.99, rate: 0, rateType: 'none',
      blurb: 'Build a credit history with a small secured limit reported monthly to the bureaus.' },
    { id: 'NPY-GLB-ACCOUNT', name: 'Multi-Currency Account', family: 'global', tier: 'plus',
      fee: 0, rate: 0, rateType: 'fx_markup',
      blurb: 'Hold and convert 30 currencies with local account details in the US, UK and eurozone.' }
  ];

  function productById(id) {
    return PRODUCTS.filter(function (p) { return p.id === id; })[0];
  }

  function rateLabel(p) {
    if (p.rateType === 'aer') return p.rate + '% AER';
    if (p.rateType === 'apr') return 'From ' + p.rate + '% APR';
    if (p.rateType === 'cashback') return p.rate + '% cashback';
    if (p.rateType === 'fx_markup') return '0% FX markup';
    return '';
  }

  function feeLabel(p) {
    return p.fee === 0 ? 'Free' : fmt(p.fee, 'USD') + ' a month';
  }

  function renderProducts() {
    var cards = PRODUCTS.map(function (p) {
      var saved = State.isShortlisted(p.id);
      return '<article class="npy-prod" data-product="' + esc(p.id) + '">' +
        '<div class="npy-prod-top">' +
          '<span class="npy-prod-family">' + esc(p.family) + '</span>' +
          '<button class="npy-prod-save' + (saved ? ' is-saved' : '') + '" type="button" ' +
            'data-action="shortlist" data-product="' + esc(p.id) + '" ' +
            'aria-pressed="' + (saved ? 'true' : 'false') + '" ' +
            'aria-label="Shortlist ' + esc(p.name) + '">&#9733;</button>' +
        '</div>' +
        '<h4>' + esc(p.name) + '</h4>' +
        '<p class="npy-prod-blurb">' + esc(p.blurb) + '</p>' +
        '<div class="npy-prod-figures">' +
          '<span><strong>' + feeLabel(p) + '</strong><small>plan fee</small></span>' +
          (rateLabel(p) ? '<span><strong>' + rateLabel(p) + '</strong><small>headline rate</small></span>' : '') +
        '</div>' +
        '<div class="npy-prod-actions">' +
          '<button class="npy-btn npy-btn-sm" type="button" data-action="compare" data-product="' +
            esc(p.id) + '">Compare</button>' +
          '<button class="npy-btn npy-btn-sm npy-btn-primary" type="button" data-action="apply" data-product="' +
            esc(p.id) + '">Apply</button>' +
        '</div>' +
      '</article>';
    }).join('');

    el('novapay-view-products').innerHTML =
      '<section class="npy-card">' +
        '<h3>Everything NovaPay offers</h3>' +
        '<p class="npy-empty">Shortlist what interests you, or apply in the app. No paperwork and no branch visit.</p>' +
        '<div class="npy-prod-grid">' + cards + '</div>' +
      '</section>';
  }

  /* ================================================================ actions */

  var handlers = {

    /* ------------------------------------------------------- onboarding */
    'start-kyc': function () {
      Events.onboarding('kyc_started', {
        step: 'kyc_started', step_index: 4, status: 'started', method: 'email'
      });

      openModal('Verify your identity',
        '<p class="npy-modal-intro">Pick a document. Nothing is uploaded: this is a demo.</p>' +
        '<div class="npy-choice-row">' +
          '<button class="npy-choice" type="button" data-doc="passport">Passport</button>' +
          '<button class="npy-choice" type="button" data-doc="national_id">National ID</button>' +
          '<button class="npy-choice" type="button" data-doc="driving_licence">Driving licence</button>' +
        '</div>',
        function (host) {
          host.querySelectorAll('[data-doc]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var doc = btn.getAttribute('data-doc');

              Events.onboarding('kyc_doc_uploaded', {
                step: 'doc_uploaded', step_index: 5, status: 'completed',
                doc_type: doc, time_on_step_sec: 12
              });
              Events.onboarding('kyc_submitted', {
                step: 'kyc_submitted', step_index: 7, status: 'completed', doc_type: doc
              });

              State.setKyc('approved');

              Events.onboarding('kyc_approved', {
                step: 'kyc_approved', step_index: 8, status: 'completed', doc_type: doc
              });
              Events.onboarding('account_opened', {
                step: 'account_opened', step_index: 10, status: 'completed'
              });

              modalResult('Identity verified', [
                'Document: ' + esc(doc.replace(/_/g, ' ')),
                'Four rows written to <code>fintech_onboarding_events</code>',
                'Contact attribute <code>kyc_status</code> is now <code>approved</code>'
              ]);
              renderAll();
            });
          });
        });
    },

    /* ------------------------------------------------------ transactions */
    'add-money': function () {
      openModal('Add money',
        amountForm('Add', ['25', '100', '500']),
        function (host) { wireAmount(host, function (amount) {
          var txn = State.addTransaction({
            type: 'topup', amount: amount, merchant: 'Bank transfer', category: 'transfer'
          });
          var acct = State.primaryAccount();

          Events.transaction('topup_completed', {
            transaction_id: txn.id, transaction_type: 'topup',
            amount: Events.money(amount), currency: txn.currency,
            amount_home_currency: Events.money(amount),
            status: 'completed'
          });
          Events.account('balance_viewed', {
            account_id: acct.id, balance: Events.money(acct.balance),
            balance_band: Events.balanceBand(acct.balance), channel: 'web'
          });

          modalResult('Money added', [
            fmt(amount, txn.currency) + ' added',
            'New balance ' + fmt(acct.balance, acct.currency),
            'Row in <code>fintech_transaction_events</code>'
          ]);
          renderAll();
        }); });
    },

    'send-money': function () {
      openModal('Send money',
        '<label class="npy-field"><span>To</span>' +
          '<input type="text" id="npy-recipient" value="Sam Whitfield" autocomplete="off"></label>' +
        '<label class="npy-field"><span>Country</span>' +
          '<select id="npy-country">' +
            '<option value="US">United States</option>' +
            '<option value="GB">United Kingdom</option>' +
            '<option value="IN">India</option>' +
            '<option value="BR">Brazil</option>' +
          '</select></label>' +
        amountForm('Send', ['50', '250', '1000']),
        function (host) { wireAmount(host, function (amount) {
          var acct = State.primaryAccount();
          var recipient = (host.querySelector('#npy-recipient') || {}).value || 'Recipient';
          var country = (host.querySelector('#npy-country') || {}).value || 'US';
          var isFirst = State.get().transactions.filter(function (t) {
            return t.type === 'transfer_out';
          }).length === 0;

          if (amount > acct.balance) {
            /* A failed transfer is a genuinely useful demo row: it is what a
               "topped up too late" campaign triggers on. */
            Events.transaction('transaction_failed', {
              transaction_type: 'transfer_out', amount: Events.money(amount),
              currency: acct.currency, country_to: country,
              status: 'failed', failure_reason: 'insufficient_funds'
            });
            modalResult('Transfer declined', [
              'Not enough money in the account',
              'Row in <code>fintech_transaction_events</code> with ' +
                '<code>failure_reason = insufficient_funds</code>'
            ]);
            return;
          }

          var txn = State.addTransaction({
            type: 'transfer_out', amount: amount,
            merchant: recipient, category: 'transfer'
          });

          /* NO merchant_category. It is a CARD PAYMENTS column with a fixed
             list (groceries, transport, eating_out, subscriptions, travel,
             bills, shopping, cash) and no member for a transfer, so 'transfer'
             was dropped on the way in and the column arrived empty. The
             direction is already in transaction_type, which is where it
             belongs. merchant_name stays: a transfer does have a recipient. */
          Events.transaction('transfer_sent', {
            transaction_id: txn.id, transaction_type: 'transfer_out',
            amount: Events.money(amount), currency: txn.currency,
            amount_home_currency: Events.money(amount),
            country_to: country, merchant_name: recipient,
            fee: 0, status: 'completed'
          });
          if (isFirst) {
            Events.transaction('first_transaction_completed', {
              transaction_id: txn.id, transaction_type: 'transfer_out',
              amount: Events.money(amount), currency: txn.currency, status: 'completed'
            });
          }

          modalResult('Money sent', [
            fmt(amount, txn.currency) + ' to ' + esc(recipient),
            'New balance ' + fmt(State.primaryAccount().balance, txn.currency),
            isFirst
              ? 'Also fired <code>first_transaction_completed</code>, the activation event'
              : 'Row in <code>fintech_transaction_events</code>'
          ]);
          renderAll();
        }); });
    },

    'convert': function () {
      openModal('Convert currency',
        '<label class="npy-field"><span>From</span>' +
          '<select id="npy-from"><option>USD</option><option>EUR</option></select></label>' +
        '<label class="npy-field"><span>To</span>' +
          '<select id="npy-to"><option>EUR</option><option>GBP</option><option>USD</option></select></label>' +
        amountForm('Convert', ['100', '500']),
        function (host) { wireAmount(host, function (amount) {
          var from = (host.querySelector('#npy-from') || {}).value || 'USD';
          var to = (host.querySelector('#npy-to') || {}).value || 'EUR';
          /* Fixed illustrative rate. An invented "live" rate next to a real
             balance would be a fabricated metric, which house style forbids. */
          var rate = 0.92;
          var txn = State.addTransaction({
            type: 'fx_conversion', amount: amount, merchant: from + ' to ' + to,
            category: 'transfer'
          });

          Events.transaction('fx_conversion_completed', {
            transaction_id: txn.id, transaction_type: 'fx_conversion',
            amount: Events.money(amount), currency: from,
            amount_home_currency: Events.money(amount),
            currency_from: from, currency_to: to, fx_rate: rate,
            fee: 0, status: 'completed'
          });

          modalResult('Converted', [
            fmt(amount, from) + ' to ' + fmt(amount * rate, to),
            'Rate ' + rate + ', illustrative',
            'Row in <code>fintech_transaction_events</code> with <code>currency_from</code> and <code>currency_to</code>'
          ]);
          renderAll();
        }); });
    },

    'statement': function () {
      var acct = State.primaryAccount();
      Events.account('statement_downloaded', {
        account_id: acct.id, account_type: acct.type,
        currency: acct.currency, channel: 'web'
      });
      openModal('Statement', '<p class="npy-modal-intro">A statement would download here. ' +
        'The row is already in <code>fintech_account_events</code>.</p>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-modal-close>Done</button>');
    },

    /* ------------------------------------------------------------- cards */
    'toggle-freeze': function (btn) {
      var id = btn.getAttribute('data-card');
      var card = State.get().cards.filter(function (c) { return c.id === id; })[0];
      if (!card) return;
      var frozen = !card.frozen;
      State.setCardFrozen(id, frozen);

      Events.card(frozen ? 'card_frozen' : 'card_unfrozen', {
        card_id: card.id, card_type: card.type, card_tier: card.tier,
        action: frozen ? 'freeze' : 'unfreeze',
        reason: frozen ? 'user_request' : undefined
      });
      renderAll();
    },

    'activate-card': function (btn) {
      var id = btn.getAttribute('data-card');
      var s = State.get();
      var card = s.cards.filter(function (c) { return c.id === id; })[0];
      if (!card) return;
      card.activated = true;
      State.save();

      Events.card('card_activated', {
        card_id: card.id, card_type: card.type, card_tier: card.tier,
        action: 'activate', days_since_order: card.orderedDaysAgo
      });
      renderAll();
    },

    'view-pin': function (btn) {
      var id = btn.getAttribute('data-card');
      var card = State.get().cards.filter(function (c) { return c.id === id; })[0];
      if (!card) return;
      Events.card('pin_viewed', {
        card_id: card.id, card_type: card.type, card_tier: card.tier, action: 'view_pin'
      });
      openModal('Card PIN',
        '<p class="npy-pin">4 8 1 2</p>' +
        '<p class="npy-modal-intro">Illustrative only. Viewing a PIN is itself an event, ' +
        'because repeated views are a support signal.</p>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-modal-close>Done</button>');
    },

    'order-card': function () {
      openModal('Order a card',
        '<div class="npy-choice-row">' +
          '<button class="npy-choice" type="button" data-tier="plus">Plus, free</button>' +
          '<button class="npy-choice" type="button" data-tier="travel">Travel, 6.99 a month</button>' +
          '<button class="npy-choice" type="button" data-tier="metal">Metal, 16.99 a month</button>' +
        '</div>',
        function (host) {
          host.querySelectorAll('[data-tier]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var tier = btn.getAttribute('data-tier');
              var card = State.orderCard(tier, 'physical');

              Events.card('card_ordered', {
                card_id: card.id, card_type: 'physical', card_tier: tier,
                action: 'order', delivery_status: 'ordered', days_since_order: 0
              });

              modalResult('Card ordered', [
                esc(tier) + ' card ending ' + esc(card.last4),
                'Row in <code>fintech_card_events</code>',
                'Not activated yet, which is the dormant-card push trigger'
              ]);
              renderAll();
            });
          });
        });
    },

    /* ------------------------------------------------------------- pots */
    'new-pot': function () {
      openModal('New savings goal',
        '<label class="npy-field"><span>Goal name</span>' +
          '<input type="text" id="npy-pot-name" placeholder="Japan 2027" autocomplete="off"></label>' +
        '<label class="npy-field"><span>Target amount</span>' +
          '<input type="number" id="npy-pot-goal" value="2000" min="1"></label>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-confirm>Create goal</button>',
        function (host) {
          host.querySelector('[data-confirm]').addEventListener('click', function () {
            var name = (host.querySelector('#npy-pot-name').value || '').trim() || 'New goal';
            var goal = Number(host.querySelector('#npy-pot-goal').value) || 1000;
            var pot = State.addPot(name, goal, 'manual');

            Events.savings('pot_created', {
              pot_id: pot.id, pot_name: name, goal_amount: Events.money(goal),
              current_amount: 0, progress_pct: 0,
              funding_method: 'manual', interest_rate: pot.rate, is_shared: false
            });

            modalResult('Goal created', [
              esc(name) + ', target ' + fmt(goal, 'USD'),
              'Row in <code>fintech_savings_events</code>'
            ]);
            renderAll();
          });
        });
    },

    'fund-pot': function (btn) {
      var potId = btn.getAttribute('data-pot');
      openModal('Add to goal', amountForm('Add', ['25', '100', '250']),
        function (host) { wireAmount(host, function (amount) {
          var before = State.get().pots.filter(function (p) { return p.id === potId; })[0];
          var wasPct = State.potProgress(before);
          var pot = State.fundPot(potId, amount);

          if (!pot) {
            modalResult('Not enough money', ['The account balance is lower than that.']);
            return;
          }

          var pct = State.potProgress(pot);
          Events.savings('pot_funded', {
            pot_id: pot.id, pot_name: pot.name,
            goal_amount: Events.money(pot.goal),
            current_amount: Events.money(pot.current),
            progress_pct: pct, funding_method: 'manual',
            interest_rate: pot.rate, is_shared: pot.is_shared
          });

          /* Only on the crossing, not on every deposit above the line.
             Otherwise a congratulation campaign fires on every top-up. */
          if (wasPct < 100 && pct >= 100) {
            Events.savings('goal_reached', {
              pot_id: pot.id, pot_name: pot.name,
              goal_amount: Events.money(pot.goal),
              current_amount: Events.money(pot.current), progress_pct: 100
            });
          }

          modalResult('Added to goal', [
            fmt(amount, 'USD') + ' into ' + esc(pot.name),
            'Now ' + pct + '% of target',
            pct >= 100 && wasPct < 100
              ? 'Also fired <code>goal_reached</code>'
              : 'Row in <code>fintech_savings_events</code>'
          ]);
          renderAll();
        }); });
    },

    /* -------------------------------------------------------- investing */
    'invest': function () {
      openModal('Invest',
        '<label class="npy-field"><span>Risk profile</span>' +
          '<select id="npy-risk">' +
            '<option value="cautious">Cautious</option>' +
            '<option value="balanced" selected>Balanced</option>' +
            '<option value="adventurous">Adventurous</option>' +
          '</select></label>' +
        '<label class="npy-field"><span>What to buy</span>' +
          '<select id="npy-instrument">' +
            INSTRUMENTS.map(function (i) {
              return '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>';
            }).join('') +
          '</select></label>' +
        amountForm('Invest', ['100', '500', '1000']),
        function (host) { wireAmount(host, function (amount) {
          var risk = (host.querySelector('#npy-risk') || {}).value || 'balanced';
          var instId = (host.querySelector('#npy-instrument') || {}).value;
          var inst = INSTRUMENTS.filter(function (i) { return i.id === instId; })[0];
          var acct = State.primaryAccount();

          if (amount > acct.balance) {
            modalResult('Not enough money', ['The account balance is lower than that.']);
            return;
          }

          var isFirst = State.get().holdings.length === 0;
          Events.investment('risk_profile_set', { risk_profile: risk });

          var holding = State.addHolding(inst, amount);

          Events.investment('investment_made', {
            instrument_id: inst.id, instrument_name: inst.name,
            asset_class: inst.assetClass, risk_profile: risk,
            amount: Events.money(amount), currency: acct.currency,
            order_type: 'market', is_recurring: false,
            holding_value: Events.money(holding.value)
          });
          if (isFirst) {
            Events.investment('first_investment_made', {
              instrument_id: inst.id, instrument_name: inst.name,
              asset_class: inst.assetClass, risk_profile: risk,
              amount: Events.money(amount), currency: acct.currency
            });
          }

          modalResult('Investment placed', [
            fmt(amount, acct.currency) + ' into ' + esc(inst.name),
            'Risk profile ' + esc(risk),
            isFirst ? 'Also fired <code>first_investment_made</code>'
                    : 'Row in <code>fintech_investment_events</code>'
          ]);
          renderAll();
        }); });
    },

    /* ----------------------------------------------------------- credit */
    'view-score': function () {
      var s = State.get();
      Events.credit('credit_score_viewed', {
        credit_score: s.credit.score,
        credit_score_band: Events.creditScoreBand(s.credit.score),
        score_change: s.credit.score - s.credit.lastScore
      });
      openModal('Credit report',
        '<p class="npy-score-big">' + s.credit.score + '</p>' +
        '<p class="npy-modal-intro">Band: <strong>' +
          esc(Events.creditScoreBand(s.credit.score)) + '</strong>. ' +
          'Up ' + (s.credit.score - s.credit.lastScore) + ' points this month. ' +
          'A rising score is one of the few notifications customers actually welcome.</p>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-modal-close>Done</button>');
    },

    'loan-calc': function () {
      openModal('Loan calculator',
        '<label class="npy-field"><span>Amount</span>' +
          '<input type="number" id="npy-loan-amt" value="8000" min="1000" max="25000"></label>' +
        '<label class="npy-field"><span>Term, months</span>' +
          '<select id="npy-loan-term">' +
            '<option>12</option><option selected>36</option><option>60</option>' +
          '</select></label>' +
        '<p class="npy-modal-intro" id="npy-loan-out"></p>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-confirm>Get my rate</button>',
        function (host) {
          var amtEl = host.querySelector('#npy-loan-amt');
          var termEl = host.querySelector('#npy-loan-term');
          var out = host.querySelector('#npy-loan-out');
          var apr = 6.9;

          function recalc() {
            var amt = Number(amtEl.value) || 0;
            var term = Number(termEl.value) || 12;
            var monthly = (amt * (1 + apr / 100)) / term;
            out.innerHTML = 'About <strong>' + fmt(monthly, 'USD') +
              '</strong> a month at ' + apr + '% APR. Illustrative.';
            return { amt: amt, term: term, monthly: monthly };
          }
          recalc();
          amtEl.addEventListener('input', recalc);
          termEl.addEventListener('change', recalc);

          /* Fires once, on leaving the inputs, not on every keystroke. Same
             principle the search event follows: record intent, not typing. */
          var calcSent = false;
          function sendCalcOnce() {
            if (calcSent) return;
            calcSent = true;
            var r = recalc();
            Events.credit('loan_calculator_used', {
              credit_type: 'personal_loan', requested_amount: Events.money(r.amt),
              term_months: r.term, apr: apr,
              monthly_repayment: Events.money(r.monthly)
            });
          }
          amtEl.addEventListener('change', sendCalcOnce);
          termEl.addEventListener('change', sendCalcOnce);

          host.querySelector('[data-confirm]').addEventListener('click', function () {
            sendCalcOnce();
            var r = recalc();
            var s = State.get();

            Events.credit('loan_quote_requested', {
              product_id: 'NPY-CRE-LOAN', product_name: 'Personal Loan',
              credit_type: 'personal_loan',
              requested_amount: Events.money(r.amt), term_months: r.term,
              apr: apr, monthly_repayment: Events.money(r.monthly),
              decision: 'quoted', credit_score: s.credit.score,
              credit_score_band: Events.creditScoreBand(s.credit.score)
            });

            modalResult('Your rate', [
              fmt(r.amt, 'USD') + ' over ' + r.term + ' months',
              'About ' + fmt(r.monthly, 'USD') + ' a month at ' + apr + '% APR',
              'A calculator use with no quote request inside an hour is the ' +
                'highest-intent abandonment on the site'
            ]);
          });
        });
    },

    /* ---------------------------------------------------------- support */
    'dispute': function (btn) {
      var txnId = btn.getAttribute('data-txn');
      var txn = State.get().transactions.filter(function (t) { return t.id === txnId; })[0];
      if (!txn) return;

      openModal('Report a problem',
        '<p class="npy-modal-intro">' + esc(txn.merchant || txn.type) + ', ' +
          fmt(txn.amount, txn.currency) + '</p>' +
        '<div class="npy-choice-row">' +
          '<button class="npy-choice" type="button" data-case="dispute">I did not recognise it</button>' +
          '<button class="npy-choice" type="button" data-case="fraud_report">It was fraud</button>' +
          '<button class="npy-choice" type="button" data-case="query">Something else</button>' +
        '</div>',
        function (host) {
          host.querySelectorAll('[data-case]').forEach(function (b) {
            b.addEventListener('click', function () {
              var type = b.getAttribute('data-case');
              var caseId = State.nextCaseId();

              Events.support(type === 'fraud_report' ? 'fraud_reported' : 'dispute_raised', {
                case_id: caseId, case_type: type, category: 'card',
                channel: 'in_app', transaction_id: txn.id,
                disputed_amount: Events.money(txn.amount),
                resolution_status: 'open'
              });

              if (type === 'fraud_report') {
                var card = State.get().cards[0];
                if (card) {
                  State.setCardFrozen(card.id, true);
                  Events.card('card_frozen', {
                    card_id: card.id, card_type: card.type, card_tier: card.tier,
                    action: 'freeze', reason: 'fraud_suspected'
                  });
                }
              }

              modalResult('Case opened', [
                'Case ' + esc(caseId),
                'Row in <code>fintech_support_events</code>',
                type === 'fraud_report'
                  ? 'Card frozen automatically, with <code>reason = fraud_suspected</code>'
                  : 'Linked to the transaction by <code>transaction_id</code>'
              ]);
              renderAll();
            });
          });
        });
    },

    /* --------------------------------------------------------- products */
    'shortlist': function (btn) {
      var id = btn.getAttribute('data-product');
      var p = productById(id);
      if (!p) return;
      var saved = State.isShortlisted(id);

      if (saved) {
        State.unshortlist(id);
        Events.product('product_unshortlisted', productPayload(p, { funnel_step: 'shortlisted' }));
      } else {
        State.shortlist(id);
        Events.product('product_shortlisted', productPayload(p, {
          funnel_step: 'shortlisted', step_index: 3
        }));
      }
      renderProducts();
    },

    'compare': function (btn) {
      var id = btn.getAttribute('data-product');
      var p = productById(id);
      if (!p) return;
      var others = PRODUCTS.filter(function (o) {
        return o.family === p.family && o.id !== p.id;
      }).slice(0, 2);
      var set = [p.id].concat(others.map(function (o) { return o.id; }));

      Events.product('product_compared', productPayload(p, {
        funnel_step: 'compared', step_index: 2,
        comparison_set: set.join(','),
        products_in_application: set.length
      }));

      openModal('Compare ' + p.family,
        '<table class="npy-compare"><thead><tr><th>Product</th><th>Plan fee</th><th>Rate</th></tr></thead><tbody>' +
        [p].concat(others).map(function (o) {
          return '<tr><td>' + esc(o.name) + '</td><td>' + feeLabel(o) + '</td><td>' +
            (rateLabel(o) || 'None') + '</td></tr>';
        }).join('') +
        '</tbody></table>' +
        '<p class="npy-modal-intro">A comparison with no application started is the ' +
        'on-site scenario trigger: show them what they were weighing up.</p>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-modal-close>Done</button>');
    },

    'apply': function (btn) {
      var id = btn.getAttribute('data-product');
      var p = productById(id);
      if (!p) return;
      var app = State.startApplication(id);

      Events.product('application_started', productPayload(p, {
        application_id: app.id, funnel_step: 'application_started', step_index: 5,
        products_in_application: 1
      }));

      openModal('Apply for ' + p.name,
        '<p class="npy-modal-intro">' + esc(p.blurb) + '</p>' +
        '<label class="npy-field"><span>Employment</span>' +
          '<select id="npy-employment">' +
            '<option>Employed</option><option>Self-employed</option><option>Student</option>' +
          '</select></label>' +
        '<label class="npy-field"><span>Annual income</span>' +
          '<input type="number" id="npy-income" value="52000" min="0"></label>' +
        '<button class="npy-btn npy-btn-primary" type="button" data-confirm>Submit application</button>' +
        '<p class="npy-modal-note">Close this without submitting and the demo records ' +
        '<code>application_abandoned</code>, which is the abandonment trigger.</p>',
        function (host) {
          var submitted = false;

          host.querySelector('[data-confirm]').addEventListener('click', function () {
            submitted = true;
            Events.product('application_submitted', productPayload(p, {
              application_id: app.id, funnel_step: 'submitted', step_index: 7,
              products_in_application: 1
            }));
            Events.product('application_approved', productPayload(p, {
              application_id: app.id, funnel_step: 'approved', step_index: 8
            }));

            modalResult('Application approved', [
              esc(p.name) + ', ' + feeLabel(p),
              'Three rows in <code>fintech_product_events</code>: started, submitted, approved',
              'No cart, no order, no shipping method anywhere'
            ]);
          });

          /* Abandonment is the whole point of an application funnel, so it has
             to be recorded when the visitor leaves without submitting. */
          var observer = new MutationObserver(function () {
            if (modalHost.hidden && !submitted) {
              observer.disconnect();
              Events.product('application_abandoned', productPayload(p, {
                application_id: app.id, funnel_step: 'abandoned',
                abandon_step: 'details_entered', step_index: 6
              }));
            } else if (modalHost.hidden) {
              observer.disconnect();
            }
          });
          observer.observe(modalHost, { attributes: true, attributeFilter: ['hidden'] });
        });
    },

    /* ------------------------------------------------------- navigation */
    /* Real navigation since the portal became five pages. switchView() only
       ever toggled containers on one page, so leaving these as-is would have
       left three dead buttons on the home screen. */
    'goto-money': function () { window.location.href = 'money.html'; },
    'goto-cards': function () { window.location.href = 'cards.html'; },
    'goto-grow': function () { window.location.href = 'grow.html'; }
  };

  function productPayload(p, extra) {
    var base = {
      product_id: p.id, product_name: p.name, product_family: p.family,
      plan_tier: p.tier, monthly_fee: Events.money(p.fee),
      headline_rate: p.rate || undefined,
      rate_type: p.rateType === 'none' ? undefined : p.rateType
    };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  /* Shared amount picker, so every money flow behaves identically. */
  function amountForm(verb, presets) {
    return '<label class="npy-field"><span>Amount</span>' +
      '<input type="number" id="npy-amount" value="' + presets[0] + '" min="1" step="0.01"></label>' +
      '<div class="npy-presets">' + presets.map(function (v) {
        return '<button class="npy-preset" type="button" data-preset="' + v + '">' +
          fmt(Number(v), 'USD') + '</button>';
      }).join('') + '</div>' +
      '<button class="npy-btn npy-btn-primary" type="button" data-confirm>' + esc(verb) + '</button>';
  }

  function wireAmount(host, onConfirm) {
    var input = host.querySelector('#npy-amount');
    host.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.getAttribute('data-preset'); });
    });
    host.querySelector('[data-confirm]').addEventListener('click', function () {
      var amount = Number(input.value);
      if (!isFinite(amount) || amount <= 0) { input.focus(); return; }
      onConfirm(Math.round(amount * 100) / 100);
    });
  }

  /* One delegated listener for the whole app, so re-rendering a view never
     leaves a dead button behind. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (!handlers[action]) return;
    e.preventDefault();
    handlers[action](btn);
  });

  /* ------------------------------------------------------------ view switch */

  /* Retained for window.NovaPayApp.switchView, which the suites use, and
     harmless on a single-view page: the containers it looks for either exist
     on this page or do not. Navigation no longer goes through it. */
  function switchView(name) {
    document.querySelectorAll('.npy-view').forEach(function (v) {
      v.hidden = v.getAttribute('data-view') !== name;
    });
    document.querySelectorAll('.npy-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-view') === name);
    });

    if (name === 'money') renderMoney();
    if (name === 'products') {
      renderProducts();
      /* A products screen view is consideration, and it is the row an
         abandoned-browse campaign triggers on.

         NO product_family. This is the LIST, not one family, and the column's
         vocabulary is cards, savings, investing, credit, global and
         protection, with no member meaning "all of them". It used to send
         'all', which the table drops on the way in, so the column arrived
         empty anyway and any segment written on it silently excluded this
         row. Absent is the honest version of the same thing. */
      Events.product('product_viewed', {
        funnel_step: 'viewed', step_index: 1
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* No click handler on .npy-tab any more. The tabs are real links to real
     pages, and preventDefault() here would silently block navigation. */

  /* ------------------------------------------------------------------ boot */

  /* Each renderer writes into a container that now exists on ONE page, so
     every call is guarded. Calling renderCards() on money.html would throw on
     a null element and take the rest of boot() with it, including the portal
     signals, which would look like the campaigns not firing. */
  function renderAll() {
    if (el('novapay-view-home')) renderHome();
    if (el('novapay-view-money')) renderMoney();
    if (el('novapay-view-cards')) renderCards();
    if (el('novapay-view-grow')) renderGrow();
    if (el('novapay-view-products')) renderProducts();
  }

  function boot() {
    renderAll();

    var s = State.get();
    var acct = State.primaryAccount();

    /* Opening the app is a balance view. Sent once per load, not per render,
       or a segment on "checked balance 5 times" would count re-renders. */
    Events.account('balance_viewed', {
      account_id: acct.id, account_type: acct.type, currency: acct.currency,
      balance: Events.money(acct.balance),
      balance_band: Events.balanceBand(acct.balance),
      channel: 'web'
    });

    /* Two derived signals a real bank computes server-side. They are the
       triggers behind the two best-known retail banking campaigns, so the demo
       needs them to exist as rows. */
    if (acct.balance < 100) {
      Events.account('low_balance_detected', {
        account_id: acct.id, currency: acct.currency,
        balance: Events.money(acct.balance),
        balance_band: Events.balanceBand(acct.balance)
      });
    }
    var salary = s.transactions.filter(function (t) { return t.category === 'salary'; })[0];
    if (salary) {
      Events.account('salary_detected', {
        account_id: acct.id, currency: acct.currency,
        balance: Events.money(acct.balance),
        balance_band: Events.balanceBand(acct.balance)
      });
    }

    portalSignals();
  }

  /* ====================================================== portal signals

     The ten scenarios the account portal can trigger, pushed to the dataLayer
     so a Dengage On-Site campaign can fire on them directly, with
     triggerBy = DATA_LAYER_EVENT.

     Every one is derived from state the demo genuinely holds and from a table
     that genuinely receives rows, so the targeting a prospect sees in the panel
     is the same condition that fired the widget. Nothing here is staged.

     They are NOT the same thing as the scenario launcher. The launcher is a
     presenter firing a scenario on demand; these fire because the customer's
     situation actually matches. That difference is the whole demo: a prospect
     wants to see the platform react to behaviour, not to a button.

     Full list, what each is for and which table backs it:
     fintech/PORTAL-SCENARIOS.md

     Fired once per page load. A scenario that re-fires on every render would
     make maxShowCount meaningless and the five-minute popup cooldown would
     swallow the rest anyway. */
  function push(event, detail) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: event };
    Object.keys(detail || {}).forEach(function (k) { payload[k] = detail[k]; });
    window.dataLayer.push(payload);
  }

  /* Which page each signal belongs to. This map is the whole mechanism behind
     the split: a signal only fires on its own page, so a campaign only appears
     there, and nothing in the panel has to change to make that true.

     Grouped by what the customer is looking at when the message would help.
     Money carries five because they are all transaction or balance driven. */
  var SIGNAL_PAGE = {
    kyc_incomplete: 'home',
    credit_score_up: 'home',
    low_balance: 'money',
    salary_landed: 'money',
    travel_spender: 'money',
    subscription_detected: 'money',
    fx_unused: 'money',
    card_dormant: 'cards',
    goal_in_reach: 'grow',
    idle_cash: 'grow'
  };

  function here(name) { return SIGNAL_PAGE[name] === VIEW; }

  function portalSignals() {
    var s = State.get();
    var acct = State.primaryAccount();
    var P = 'fintech_';

    /* 1. Onboarding incomplete. The single highest-value trigger on the whole
          site: an account opened but not usable. */
    if (here('kyc_incomplete') && s.kycStatus !== 'approved') {
      push(P + 'kyc_incomplete', { kyc_status: s.kycStatus, step: 'kyc_started' });
    }

    /* 2. Balance running low, before payday rather than after. */
    if (here('low_balance') && acct.balance < 100) {
      push(P + 'low_balance', {
        balance_band: Events.balanceBand(acct.balance), currency: acct.currency
      });
    }

    /* 3. Salary just landed. The moment to ask for a savings transfer, and the
          one time a customer has money to move. */
    var salary = s.transactions.filter(function (t) {
      return t.category === 'salary' && t.daysAgo <= 7;
    })[0];
    if (here('salary_landed') && salary) {
      push(P + 'salary_landed', {
        amount_band: salary.amount >= 2000 ? '2000+' : 'under_2000',
        balance_band: Events.balanceBand(acct.balance)
      });
    }

    /* 4. A card delivered and never activated. Dormant plastic is money the
          bank has already spent. */
    var dormant = s.cards.filter(function (c) {
      return !c.activated && c.orderedDaysAgo >= 0;
    })[0];
    if (here('card_dormant') && dormant) {
      push(P + 'card_dormant', {
        card_tier: dormant.tier, days_since_order: dormant.orderedDaysAgo
      });
    }

    /* 5. A savings goal in sight. Encouragement works here and nowhere else. */
    var nearly = s.pots.filter(function (p) {
      var pct = State.potProgress(p);
      return pct >= 70 && pct < 100;
    })[0];
    if (here('goal_in_reach') && nearly) {
      push(P + 'goal_in_reach', {
        pot_name: nearly.name, progress_pct: State.potProgress(nearly)
      });
    }

    /* 6. Spends abroad. Two or more travel transactions is a Travel plan
          conversation, and the FX saving is calculable rather than invented. */
    var travel = s.transactions.filter(function (t) {
      return t.category === 'travel';
    });
    if (here('travel_spender') && travel.length >= 1) {
      push(P + 'travel_spender', {
        travel_txn_count: travel.length, product_id: 'NPY-CRD-TRAVEL'
      });
    }

    /* 7. Holding cash and not investing it. */
    if (here('idle_cash') && !s.holdings.length && acct.balance >= 500) {
      push(P + 'idle_cash', {
        balance_band: Events.balanceBand(acct.balance), product_id: 'NPY-INV-ROBO'
      });
    }

    /* 8. Credit score moved up. One of the few notifications a customer is
          pleased to get, which is worth showing a prospect worried about
          notification fatigue. */
    var delta = s.credit.score - s.credit.lastScore;
    if (here('credit_score_up') && delta > 0) {
      push(P + 'credit_score_up', {
        score_change: delta,
        credit_score_band: Events.creditScoreBand(s.credit.score)
      });
    }

    /* 9. A subscription the customer may have forgotten. Detected from the
          transaction feed, not declared. */
    var recurring = s.transactions.filter(function (t) { return t.recurring; });
    if (here('subscription_detected') && recurring.length) {
      push(P + 'subscription_detected', {
        merchant_name: recurring[0].merchant,
        merchant_category: recurring[0].category
      });
    }

    /* 10. Multi-currency held but no FX done. The Global product conversation. */
    var fx = s.accounts.filter(function (a) {
      return a.currency !== acct.currency && a.balance > 0;
    })[0];
    var converted = s.transactions.some(function (t) { return t.type === 'fx_conversion'; });
    if (here('fx_unused') && fx && !converted) {
      push(P + 'fx_unused', { currency_to: fx.currency, product_id: 'NPY-GLB-ACCOUNT' });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Exposed for the verification suites, which drive the app rather than
     reimplementing its logic. */
  window.NovaPayApp = {
    switchView: switchView,
    render: renderAll,
    products: PRODUCTS
  };

})(window, document);
