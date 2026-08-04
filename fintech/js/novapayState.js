/* ============================================================================
   NovaPay demo state
   ----------------------------------------------------------------------------
   The money the demo pretends to hold: accounts, transactions, cards, pots,
   holdings and where the customer has reached in their lifecycle.

   Kept in localStorage under keys prefixed novapay-, which is what lets the
   CantuPneus, NovaPay and Meridian demos run in one browser without treading
   on each other. Same rule as the old cart key; the rule outlived the cart.

   This file holds NO Dengage calls. State changes here, events are sent by the
   screen that caused the change, so a state repair on load cannot fire a
   spurious "transfer sent". Keeping those separate matters: an earlier bug in
   this repository came from normalizing twice and sending the result.
   ========================================================================== */

(function (window) {
  'use strict';

  var KEY = 'novapay-state';
  var VERSION = 2;

  /* ------------------------------------------------------------------ seed
     A demo needs to open on a plausible account rather than an empty one, so
     a presenter can talk before clicking anything. Figures are illustrative
     and the footer says so, which matters because financial promotions are
     regulated. */
  function seed() {
    return {
      version: VERSION,

      /* Lifecycle, mirrored into the contact attribute of the same name.
         visitor -> applicant -> onboarding -> activated -> engaged
         Dormant and churned are set by time, not by the app. */
      lifecycle: 'visitor',
      kycStatus: 'none',
      planTier: 'free',
      signedUp: false,
      name: null,
      email: null,

      accounts: [
        { id: 'ACC-USD-01', type: 'current', currency: 'USD', balance: 2480.55, primary: true },
        { id: 'ACC-EUR-01', type: 'multi_currency', currency: 'EUR', balance: 310.00, primary: false }
      ],

      cards: [
        { id: 'CRD-01', tier: 'plus', type: 'physical', frozen: false,
          activated: true, last4: '4417', orderedDaysAgo: 92 }
      ],

      pots: [
        { id: 'POT-01', name: 'Emergency fund', goal: 3000, current: 1150,
          fundingMethod: 'round_up', rate: 4.85, shared: false },
        { id: 'POT-02', name: 'Japan 2027', goal: 4000, current: 620,
          fundingMethod: 'manual', rate: 4.85, shared: true }
      ],

      holdings: [],

      credit: {
        score: 688,
        lastScore: 676,
        hasLoan: false
      },

      /* Newest first. The app prepends, so index 0 is the latest. */
      transactions: [
        { id: 'TXN-0007', type: 'card_payment', amount: 12.40, currency: 'USD',
          merchant: 'Blue Bottle Coffee', category: 'eating_out', daysAgo: 0, status: 'completed' },
        { id: 'TXN-0006', type: 'card_payment', amount: 64.10, currency: 'USD',
          merchant: 'Whole Foods', category: 'groceries', daysAgo: 1, status: 'completed' },
        { id: 'TXN-0005', type: 'card_payment', amount: 9.99, currency: 'USD',
          merchant: 'Spotify', category: 'subscriptions', daysAgo: 2, status: 'completed',
          recurring: true },
        { id: 'TXN-0004', type: 'transfer_in', amount: 3200.00, currency: 'USD',
          merchant: 'Acme Corp Payroll', category: 'salary', daysAgo: 4, status: 'completed' },
        { id: 'TXN-0003', type: 'card_payment', amount: 41.00, currency: 'USD',
          merchant: 'Uber', category: 'transport', daysAgo: 5, status: 'completed' },
        { id: 'TXN-0002', type: 'transfer_out', amount: 250.00, currency: 'USD',
          merchant: 'Sam Whitfield', category: 'transfer', daysAgo: 6, status: 'completed' },
        { id: 'TXN-0001', type: 'card_payment', amount: 118.75, currency: 'USD',
          merchant: 'British Airways', category: 'travel', daysAgo: 9, status: 'completed' }
      ],

      /* Products the visitor shortlisted or is part way through applying for.
         This is what replaces the cart, in finance vocabulary. */
      shortlist: [],
      applications: [],

      counters: { txn: 7, app: 0, pot: 2, case: 0 }
    };
  }

  /* ------------------------------------------------------------------- load
     A stored shape from an older build is discarded rather than migrated. This
     is a demo: a clean reseed is always better than half-migrated state
     mid-call. */
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return seed();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return seed();
      return parsed;
    } catch (err) {
      return seed();
    }
  }

  var state = load();

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) { /* quota or private mode: the demo still works in memory */ }
    emit();
  }

  /* Per-site custom event, same namespacing rule as everything else here. */
  function emit() {
    try {
      window.dispatchEvent(new CustomEvent('novapay:state:updated', { detail: state }));
    } catch (err) { /* older browsers: the UI re-renders on its own actions */ }
  }

  /* -------------------------------------------------------------- accessors */
  function primaryAccount() {
    return state.accounts.filter(function (a) { return a.primary; })[0] || state.accounts[0];
  }

  function totalBalance() {
    /* Single currency for the headline figure. Converting for real would need
       a rate the demo does not have, and an invented rate on screen next to a
       real balance is worse than showing the primary account alone. */
    return primaryAccount().balance;
  }

  function nextId(kind, prefix) {
    state.counters[kind] = (state.counters[kind] || 0) + 1;
    return prefix + String(state.counters[kind]).padStart(4, '0');
  }

  /* ----------------------------------------------------------------- writers
     Each returns the object it created or changed, so the calling screen has
     exactly what it needs to describe the change in an event. */
  var NovaPayState = {
    get: function () { return state; },
    save: save,
    reset: function () { state = seed(); save(); return state; },

    primaryAccount: primaryAccount,
    totalBalance: totalBalance,

    setIdentity: function (name, email) {
      state.name = name || state.name;
      state.email = email || state.email;
      state.signedUp = true;
      if (state.lifecycle === 'visitor') state.lifecycle = 'applicant';
      save();
      return state;
    },

    setKyc: function (status) {
      state.kycStatus = status;
      if (status === 'approved') state.lifecycle = 'activated';
      else if (status === 'pending') state.lifecycle = 'onboarding';
      save();
      return state;
    },

    addTransaction: function (txn) {
      var acct = primaryAccount();
      var record = {
        id: nextId('txn', 'TXN-'),
        type: txn.type,
        amount: txn.amount,
        currency: txn.currency || acct.currency,
        merchant: txn.merchant || null,
        category: txn.category || null,
        daysAgo: 0,
        status: txn.status || 'completed',
        recurring: !!txn.recurring
      };

      /* Direction lives in the type, not in the sign of the amount. Keeping
         amount always positive is what stops a segment on "spent more than
         100" from having to know about signs. */
      if (record.status === 'completed') {
        var inbound = (record.type === 'transfer_in' || record.type === 'topup' ||
                       record.type === 'refund');
        acct.balance = Math.round(
          (acct.balance + (inbound ? record.amount : -record.amount)) * 100) / 100;
      }

      state.transactions.unshift(record);
      if (state.lifecycle === 'activated') state.lifecycle = 'engaged';
      save();
      return record;
    },

    addPot: function (name, goal, fundingMethod) {
      var pot = {
        id: nextId('pot', 'POT-'),
        name: name,
        goal: goal,
        current: 0,
        fundingMethod: fundingMethod || 'manual',
        rate: 4.85,
        shared: false
      };
      state.pots.push(pot);
      save();
      return pot;
    },

    fundPot: function (potId, amount) {
      var pot = state.pots.filter(function (p) { return p.id === potId; })[0];
      if (!pot) return null;
      var acct = primaryAccount();
      if (acct.balance < amount) return null;
      acct.balance = Math.round((acct.balance - amount) * 100) / 100;
      pot.current = Math.round((pot.current + amount) * 100) / 100;
      save();
      return pot;
    },

    potProgress: function (pot) {
      if (!pot || !pot.goal) return 0;
      return Math.min(100, Math.round((pot.current / pot.goal) * 100));
    },

    setCardFrozen: function (cardId, frozen) {
      var card = state.cards.filter(function (c) { return c.id === cardId; })[0];
      if (!card) return null;
      card.frozen = frozen;
      save();
      return card;
    },

    orderCard: function (tier, type) {
      var card = {
        id: 'CRD-' + String(state.cards.length + 1).padStart(2, '0'),
        tier: tier,
        type: type || 'physical',
        frozen: false,
        activated: type === 'virtual',
        last4: String(Math.floor(1000 + Math.random() * 9000)),
        orderedDaysAgo: 0
      };
      state.cards.push(card);
      save();
      return card;
    },

    addHolding: function (instrument, amount) {
      var existing = state.holdings.filter(function (h) {
        return h.id === instrument.id;
      })[0];
      if (existing) {
        existing.value = Math.round((existing.value + amount) * 100) / 100;
      } else {
        state.holdings.push({
          id: instrument.id,
          name: instrument.name,
          assetClass: instrument.assetClass,
          value: amount
        });
      }
      var acct = primaryAccount();
      acct.balance = Math.round((acct.balance - amount) * 100) / 100;
      save();
      return existing || state.holdings[state.holdings.length - 1];
    },

    shortlist: function (productId) {
      if (state.shortlist.indexOf(productId) === -1) state.shortlist.push(productId);
      save();
      return state.shortlist;
    },

    unshortlist: function (productId) {
      var i = state.shortlist.indexOf(productId);
      if (i > -1) state.shortlist.splice(i, 1);
      save();
      return state.shortlist;
    },

    isShortlisted: function (productId) {
      return state.shortlist.indexOf(productId) > -1;
    },

    startApplication: function (productId) {
      var app = {
        id: nextId('app', 'APP-'),
        productId: productId,
        step: 'application_started',
        stepIndex: 5,
        submitted: false
      };
      state.applications.push(app);
      save();
      return app;
    },

    nextApplicationId: function () {
      return 'APP-' + String((state.counters.app || 0) + 1).padStart(4, '0');
    },

    nextCaseId: function () {
      return nextId('case', 'CASE-');
    }
  };

  window.NovaPayState = NovaPayState;

})(window);
