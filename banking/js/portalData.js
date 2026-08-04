/* ============================================================================
   Meridian online banking: the demo customer

   Deterministic on purpose. A dashboard that shows different numbers on every
   reload is unusable in a demo, because the presenter cannot say "watch this
   balance" and then point at it. Nothing here uses Math.random.

   Dates ARE relative to today, so the transaction list never looks stale on a
   call in three months. Amounts, balances and categories are fixed.

   The persona is deliberately mid-market rather than wealthy: a current
   account that dips into its overdraft, a savings goal nearly met, one foreign
   transaction and a handful of subscriptions. Every interesting banking
   trigger in docs/TABLE-DESIGN.md has something here to fire it.
   ========================================================================== */
(function () {
    'use strict';

    var USER_STORE = 'meridian_user';

    function daysAgo(n) {
        var d = new Date();
        d.setDate(d.getDate() - n);
        d.setHours(9, 30, 0, 0);
        return d;
    }

    /* Bands, not exact figures, wherever a band is what a segment should use.
       A balance moves hourly; a band does not, so a segment built on the band
       is stable and one built on the exact number is not. */
    function balanceBand(amount) {
        if (amount < 0) return 'overdrawn';
        if (amount < 500) return 'under_500';
        if (amount < 1000) return '500_1k';
        if (amount < 5000) return '1k_5k';
        if (amount < 20000) return '5k_20k';
        if (amount < 50000) return '20k_50k';
        return 'over_50k';
    }

    var ACCOUNTS = [
        {
            id: 'MRD-ACC-CURRENT', masked: '****4471',
            name: 'Everyday Current Account', type: 'current_account',
            sort: '20-41-77', balance: 412.86, available: 912.86,
            overdraftLimit: 500, overdraftUsed: 0
        },
        {
            id: 'MRD-SAV-EASY', masked: '****9920',
            name: 'Easy Access Saver', type: 'savings',
            sort: '20-41-77', balance: 18450.00, available: 18450.00,
            rate: 4.10
        },
        {
            id: 'MRD-SAV-ISA', masked: '****3312',
            name: 'Cash ISA', type: 'isa',
            sort: '20-41-77', balance: 12750.00, available: 12750.00,
            rate: 4.35
        },
        {
            id: 'MRD-CRD-PLATINUM', masked: '****8820',
            name: 'Meridian Platinum Card', type: 'credit_card',
            balance: -842.30, available: 2157.70, creditLimit: 3000
        }
    ];

    /* One row per transaction. merchant_category is the column a spend-insight
       campaign segments on, so every row carries one. */
    var TRANSACTIONS = [
        { id: 'TXN-40118', account: '****4471', date: daysAgo(0),  merchant: 'Trainline',            category: 'travel',        amount: -48.40, channel: 'card' },
        { id: 'TXN-40117', account: '****4471', date: daysAgo(1),  merchant: 'Sainsburys',           category: 'groceries',     amount: -72.15, channel: 'card' },
        { id: 'TXN-40116', account: '****8820', date: daysAgo(1),  merchant: 'SNCF Connect',         category: 'travel',        amount: -84.20, channel: 'mobile_wallet', country: 'FR', foreign: true },
        { id: 'TXN-40115', account: '****4471', date: daysAgo(2),  merchant: 'Octopus Energy',       category: 'utilities',     amount: -128.00, channel: 'online', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40114', account: '****4471', date: daysAgo(3),  merchant: 'Netflix',              category: 'subscriptions', amount: -12.99, channel: 'card', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40113', account: '****4471', date: daysAgo(3),  merchant: 'Spotify',              category: 'subscriptions', amount: -11.99, channel: 'card', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40112', account: '****4471', date: daysAgo(4),  merchant: 'Pret A Manger',        category: 'dining',        amount: -8.45,  channel: 'card' },
        { id: 'TXN-40111', account: '****8820', date: daysAgo(5),  merchant: 'John Lewis',           category: 'retail',        amount: -412.00, channel: 'card', large: true },
        { id: 'TXN-40110', account: '****4471', date: daysAgo(6),  merchant: 'Shell',                category: 'fuel',          amount: -61.20, channel: 'card' },
        { id: 'TXN-40109', account: '****4471', date: daysAgo(7),  merchant: 'Thames Water',         category: 'utilities',     amount: -34.50, channel: 'online', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40108', account: '****4471', date: daysAgo(8),  merchant: 'Gym Group',            category: 'subscriptions', amount: -24.99, channel: 'card', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40107', account: '****4471', date: daysAgo(9),  merchant: 'Council Tax',          category: 'utilities',     amount: -186.00, channel: 'online', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40106', account: '****4471', date: daysAgo(10), merchant: 'Northgate Ltd',        category: 'salary',        amount: 3120.00, channel: 'online', salary: true },
        { id: 'TXN-40105', account: '****9920', date: daysAgo(10), merchant: 'Transfer to savings',  category: 'transfer',      amount: 400.00, channel: 'online' },
        { id: 'TXN-40104', account: '****4471', date: daysAgo(11), merchant: 'Meridian Mortgages',   category: 'mortgage',      amount: -1330.19, channel: 'online', recurring: true, frequency: 'monthly' },
        { id: 'TXN-40103', account: '****4471', date: daysAgo(12), merchant: 'Tesco',                category: 'groceries',     amount: -94.30, channel: 'card' },
        { id: 'TXN-40102', account: '****4471', date: daysAgo(14), merchant: 'Boots',                category: 'health',        amount: -18.75, channel: 'card' },
        { id: 'TXN-40101', account: '****4471', date: daysAgo(16), merchant: 'Uber',                 category: 'travel',        amount: -22.60, channel: 'card' }
    ];

    var CARDS = [
        {
            id: 'CARD-4471', masked: '****4471', type: 'debit',
            product: 'Everyday Debit Card', account: '****4471',
            frozen: false, contactless: true, limit: null,
            expiry: '09/29'
        },
        {
            id: 'CARD-8820', masked: '****8820', type: 'credit',
            product: 'Meridian Platinum Card', account: '****8820',
            frozen: false, contactless: true, limit: 3000,
            expiry: '04/30'
        }
    ];

    var STANDING_ORDERS = [
        { id: 'SO-2201', payee: 'Rent, C. Adeyemi', amount: 1150.00, frequency: 'monthly', next: daysAgo(-18) },
        { id: 'SO-2202', payee: 'Savings top-up',   amount: 400.00,  frequency: 'monthly', next: daysAgo(-20) }
    ];

    var DIRECT_DEBITS = [
        { id: 'DD-3301', payee: 'Octopus Energy',    amount: 128.00,  frequency: 'monthly' },
        { id: 'DD-3302', payee: 'Thames Water',      amount: 34.50,   frequency: 'monthly' },
        { id: 'DD-3303', payee: 'Council Tax',       amount: 186.00,  frequency: 'monthly' },
        { id: 'DD-3304', payee: 'Meridian Mortgages',amount: 1330.19, frequency: 'monthly' },
        { id: 'DD-3305', payee: 'Gym Group',         amount: 24.99,   frequency: 'monthly' }
    ];

    var GOALS = [
        { name: 'Deposit', target: 42000, saved: 18450 },
        /* Met on purpose. The goal_reached scenario and its creative both
           claim this goal is fully funded, and a goal stuck at 95% made that
           copy a lie and left banking_portal_goal_reached permanently dark. */
        { name: 'Holiday', target: 2500, saved: 2500 }
    ];

    /* Value banded, never exact. A demo that puts a named customer's precise
       portfolio value on screen reads badly in a room, and banded is what a
       real deployment segments on anyway. */
    var PORTFOLIO = {
        id: 'PF-3391',
        valueBand: '250k_500k',
        riskProfile: 'balanced',
        adviser: 'R. Mehta',
        performanceBand: 'up_5_10',
        holdings: [
            { name: 'Global Sustainable Fund',  assetClass: 'equities',    weight: 42 },
            { name: 'UK Gilts Short Duration',  assetClass: 'bonds',       weight: 28 },
            { name: 'Global Property Trust',    assetClass: 'property',    weight: 14 },
            { name: 'Emerging Markets Equity',  assetClass: 'equities',    weight: 11 },
            { name: 'Cash and equivalents',     assetClass: 'cash',        weight: 5 }
        ]
    };

    /* Offers are the visible half of a campaign. Each one names the behaviour
       that would really trigger it, so a presenter can say why it is there. */
    var OFFERS = [
        {
            id: 'OFR-TRAVEL-01', category: 'insurance', placement: 'dashboard_offer_rail',
            title: 'Travelling to France?',
            body: 'We noticed a payment in euros. Annual travel cover starts at £34 and works out cheaper than three single trips.',
            because: 'foreign_transaction in banking_transaction_events',
            cta: 'See travel cover', href: 'product.html?id=MRD-INS-TRAVEL'
        },
        {
            id: 'OFR-ISA-01', category: 'savings', placement: 'dashboard_offer_rail',
            title: 'You have £7,250 of ISA allowance left',
            body: 'Moving your Easy Access balance into the Cash ISA earns the same rate free of tax, for this tax year only.',
            because: 'balance_band on banking_account_events',
            cta: 'Move money', href: 'product.html?id=MRD-SAV-ISA'
        },
        {
            id: 'OFR-OD-01', category: 'lending', placement: 'dashboard_offer_rail',
            title: 'Your balance is running low',
            body: 'You have £412.86 left and £1,516 of direct debits due this month. Worth a look before the overdraft does it for you.',
            because: 'low_balance_reached in banking_account_events',
            cta: 'See the numbers', href: 'account.html?id=4471'
        }
    ];

    function readUser() {
        try { return JSON.parse(localStorage.getItem(USER_STORE) || 'null'); }
        catch (err) { return null; }
    }

    /* The demo customer is Premier. bankingEvents reads customer_tier straight
       off this record, so writing it here is what makes every event from the
       portal carry a meaningful tier instead of defaulting to prospect. */
    function ensureTier() {
        var user = readUser();
        if (!user || user.tier === 'premier') return user;
        user.tier = 'premier';
        try { localStorage.setItem(USER_STORE, JSON.stringify(user)); } catch (err) {}
        return user;
    }

    function money(value, opts) {
        opts = opts || {};
        var n = Number(value) || 0;
        var out = new Intl.NumberFormat('en-GB', {
            style: 'currency', currency: 'GBP',
            minimumFractionDigits: opts.whole ? 0 : 2,
            maximumFractionDigits: opts.whole ? 0 : 2
        }).format(Math.abs(n));
        return n < 0 ? '-' + out : out;
    }

    function shortDate(d) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    function accountByMask(mask) {
        return ACCOUNTS.filter(function (a) { return a.masked.slice(-4) === String(mask).slice(-4); })[0] || null;
    }

    function transactionsFor(mask) {
        if (!mask) return TRANSACTIONS.slice();
        return TRANSACTIONS.filter(function (t) { return t.account.slice(-4) === String(mask).slice(-4); });
    }

    function totalBalance() {
        return ACCOUNTS.reduce(function (sum, a) { return sum + a.balance; }, 0);
    }

    window.MeridianPortal = {
        ACCOUNTS: ACCOUNTS,
        TRANSACTIONS: TRANSACTIONS,
        CARDS: CARDS,
        STANDING_ORDERS: STANDING_ORDERS,
        DIRECT_DEBITS: DIRECT_DEBITS,
        GOALS: GOALS,
        PORTFOLIO: PORTFOLIO,
        OFFERS: OFFERS,
        readUser: readUser,
        ensureTier: ensureTier,
        balanceBand: balanceBand,
        money: money,
        shortDate: shortDate,
        accountByMask: accountByMask,
        transactionsFor: transactionsFor,
        totalBalance: totalBalance
    };
})();
