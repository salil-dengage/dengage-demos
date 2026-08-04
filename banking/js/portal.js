/* ============================================================================
   Meridian online banking portal

   One controller for all six signed-in pages, dispatched on
   body[data-portal-page]. Keeping it in one file means the event wiring for
   four tables lives in one place instead of being spread across six.

   WHICH EVENTS FIRE, AND WHY THAT SPLIT

   Two kinds of thing happen in online banking, and they deserve different
   treatment:

   1. Things the CUSTOMER does. Freezing a card, cancelling a direct debit,
      setting a travel notice, making a payment, changing marketing
      preferences. These fire on the click, because the click is the event.

   2. Things the BANK detects. A salary landing, a balance crossing a
      threshold, a foreign transaction, a savings goal being met. In a real
      deployment a stream processor emits these; there is no click. Here they
      fire once per session on the page that would surface them, guarded by
      sessionStorage so a reload does not manufacture a second salary payment.

   Getting that wrong in either direction produces a table that lies: firing
   detections on every render inflates them, and not firing them at all leaves
   the most interesting banking triggers with nothing behind them.

   NO ec:* CALLS. A current account is not a basket. Everything here goes to
   banking_account_events, banking_transaction_events, banking_card_events,
   banking_wealth_events and banking_engagement_events.
   ========================================================================== */
(function () {
    'use strict';

    var D = window.MeridianPortal;
    var FIRED_KEY = 'meridian_portal_detected';

    function E() { return window.MeridianEvents || null; }

    function escapeHtml(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
    }

    /* Detections fire once per session. Without this guard a presenter who
       reloads the dashboard three times has credited the salary three times,
       and the table now describes the demo rather than the customer. */
    function onceThisSession(name, fn) {
        var fired;
        try { fired = JSON.parse(sessionStorage.getItem(FIRED_KEY) || '{}'); }
        catch (err) { fired = {}; }
        if (fired[name]) return false;
        fired[name] = true;
        try { sessionStorage.setItem(FIRED_KEY, JSON.stringify(fired)); } catch (err) {}
        fn();
        return true;
    }

    /* Every portal scenario in docs/PORTAL-SCENARIOS.md is triggered by one of
       these. A dataLayer push is what an On-Site campaign with
       triggerBy = DATA_LAYER_EVENT listens for, and it is the same mechanism
       the eight Default Scenarios already use.

       This is deliberately SEPARATE from the banking_* table write next to it.
       The table write is the record; this is the trigger. Conflating them
       would mean a campaign could only fire where a row happened to be
       written, and a row could only be written where a campaign existed. */
    function trigger(name, detail) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({
            event: name,
            actionType: name.replace('banking_portal_', ''),
            category: 'Portal Scenarios'
        }, detail || {}));
    }

    function toast(message) {
        var el = document.getElementById('portalToast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('is-visible');
        setTimeout(function () { el.classList.remove('is-visible'); }, 3200);
    }

    /* ------------------------------------------------------------- the gate */

    function gate() {
        var user = D.readUser();
        if (user && user.email) {
            D.ensureTier();
            return user;
        }
        var main = document.querySelector('[data-portal-main]');
        if (main) {
            main.innerHTML = ''
                + '<div class="portal-gate">'
                + '  <p class="text-label">Online Banking</p>'
                + '  <h1 class="heading-display">Please sign in</h1>'
                + '  <p class="text-body">This is the signed-in area. Register from the home page and you will be brought straight back here.</p>'
                + '  <a class="btn-primary" href="index.html">Go to the home page</a>'
                + '</div>';
        }
        return null;
    }

    /* --------------------------------------------------------- shared parts */

    function accountRow(a) {
        var negative = a.balance < 0;
        return ''
            + '<a class="pa-card" href="account.html?id=' + encodeURIComponent(a.masked.slice(-4)) + '">'
            + '  <div class="pa-card-head">'
            + '    <span class="pa-card-name">' + escapeHtml(a.name) + '</span>'
            + '    <span class="pa-card-mask">' + escapeHtml(a.masked) + '</span>'
            + '  </div>'
            + '  <p class="pa-card-balance' + (negative ? ' is-negative' : '') + '">' + D.money(a.balance) + '</p>'
            + (a.type === 'credit_card'
                ? '<p class="pa-card-sub">' + D.money(a.available) + ' available of ' + D.money(a.creditLimit, { whole: true }) + '</p>'
                : '<p class="pa-card-sub">' + D.money(a.available) + ' available</p>')
            + (a.rate ? '<span class="pa-card-rate">' + a.rate.toFixed(2) + '% AER</span>' : '')
            + '</a>';
    }

    function txnRow(t) {
        var credit = t.amount > 0;
        return ''
            + '<li class="pt-row">'
            + '  <span class="pt-icon pt-' + escapeHtml(t.category) + '" aria-hidden="true"></span>'
            + '  <span class="pt-main">'
            + '    <span class="pt-merchant">' + escapeHtml(t.merchant) + '</span>'
            + '    <span class="pt-meta">' + D.shortDate(t.date) + ' &middot; ' + escapeHtml(t.category.replace(/_/g, ' '))
            + (t.foreign ? ' &middot; <span class="pt-flag">' + escapeHtml(t.country) + '</span>' : '')
            + (t.recurring ? ' &middot; recurring' : '')
            + '    </span>'
            + '  </span>'
            + '  <span class="pt-amount' + (credit ? ' is-credit' : '') + '">'
            + (credit ? '+' : '') + D.money(t.amount) + '</span>'
            + '</li>';
    }

    function offerCard(o) {
        return ''
            + '<article class="po-offer" data-offer="' + escapeHtml(o.id) + '">'
            + '  <p class="po-offer-title">' + escapeHtml(o.title) + '</p>'
            + '  <p class="po-offer-body">' + escapeHtml(o.body) + '</p>'
            + '  <p class="po-offer-why">Triggered by <code>' + escapeHtml(o.because) + '</code></p>'
            + '  <div class="po-offer-actions">'
            + '    <a class="po-offer-cta" href="' + escapeHtml(o.href) + '" data-offer-accept="' + escapeHtml(o.id) + '">' + escapeHtml(o.cta) + '</a>'
            + '    <button class="po-offer-dismiss" type="button" data-offer-dismiss="' + escapeHtml(o.id) + '">Not now</button>'
            + '  </div>'
            + '</article>';
    }

    /* ------------------------------------------------------------ dashboard */

    function renderDashboard(user) {
        var el = document.querySelector('[data-portal-main]');
        var current = D.accountByMask('4471');
        var recent = D.TRANSACTIONS.slice(0, 6);

        el.innerHTML = ''
            + '<header class="portal-head">'
            + '  <p class="text-label">Good to see you</p>'
            + '  <h1 class="heading-display">' + escapeHtml(user.firstName || 'Welcome') + '</h1>'
            + '  <p class="portal-total">Across all accounts <strong>' + D.money(D.totalBalance()) + '</strong></p>'
            + '</header>'
            + '<section class="portal-block"><h2 class="portal-h2">Your accounts</h2>'
            + '<div class="pa-grid">' + D.ACCOUNTS.map(accountRow).join('') + '</div></section>'
            + '<section class="portal-block"><h2 class="portal-h2">For you</h2>'
            /* Dengage inline target slot, inside the offer rail. It has to be
               written here rather than in dashboard.html because this
               innerHTML assignment replaces the whole rail on every render.

               This is the placement worth demonstrating: an inline campaign
               lands as a fourth card among three behaviour-driven ones, in the
               place a customer already looks. Empty and hidden until filled.

               Portal-only, so unlike the five site-wide slots it has no
               counterpart on the other demos: they have no signed-in area to
               put one in. slottest covers home and product, which is where the
               five that must stay in step live. */
            + '<div class="po-rail">' + D.OFFERS.map(offerCard).join('')
            + '<div id="dn_inline_target_dashboard_offer" class="dn-inline-slot"></div>'
            + '</div></section>'
            + '<section class="portal-block">'
            + '  <div class="portal-block-head"><h2 class="portal-h2">Recent activity</h2>'
            + '  <a class="btn-text" href="account.html?id=4471">See all</a></div>'
            + '  <ul class="pt-list">' + recent.map(txnRow).join('') + '</ul>'
            + '</section>'
            + '<section class="portal-block"><h2 class="portal-h2">Savings goals</h2>'
            + '<div class="pg-grid">' + D.GOALS.map(function (g) {
                var pct = Math.min(100, Math.round((g.saved / g.target) * 1000) / 10);
                return '<div class="pg-goal" data-goal="' + escapeHtml(g.name) + '">'
                     + '<p class="pg-name">' + escapeHtml(g.name) + '</p>'
                     + '<p class="pg-figures">' + D.money(g.saved, { whole: true }) + ' of ' + D.money(g.target, { whole: true }) + '</p>'
                     + '<div class="pg-bar"><span style="width:' + pct + '%"></span></div>'
                     + '<p class="pg-pct">' + pct + '%</p></div>';
              }).join('') + '</div></section>';

        var ev = E();
        if (!ev) return;

        /* Viewing the dashboard is a balance view: one row per account, which
           is what a dormancy or a low-balance segment reads. */
        D.ACCOUNTS.forEach(function (a) {
            ev.account.balanceViewed({
                accountIdMasked: a.masked, accountType: a.type,
                balanceAmount: a.balance, balanceBand: D.balanceBand(a.balance),
                availableBalance: a.available, currency: 'GBP',
                overdraftLimit: a.overdraftLimit, overdraftUsed: a.overdraftUsed
            });
        });

        /* Detections. Once per session, see the header. */
        onceThisSession('low_balance', function () {
            if (current && current.balance < 500) {
                trigger('banking_portal_low_balance', {
                    balance_band: D.balanceBand(current.balance),
                    account_type: current.type
                });
                /* Repeated overdraft use is a different message from one dip,
                   so it gets its own trigger rather than reusing the above. */
                trigger('banking_portal_overdraft_habit', {
                    overdraft_limit: current.overdraftLimit
                });
                ev.account.lowBalance({
                    accountIdMasked: current.masked, accountType: current.type,
                    balanceAmount: current.balance, balanceBand: D.balanceBand(current.balance),
                    availableBalance: current.available, currency: 'GBP',
                    overdraftLimit: current.overdraftLimit, overdraftUsed: current.overdraftUsed
                });
            }
        });
        onceThisSession('goal_reached', function () {
            var hit = D.GOALS.filter(function (g) { return g.saved >= g.target; })[0];
            if (hit) {
                trigger('banking_portal_goal_reached', { goal_name: hit.name });
                ev.account.goalReached({
                    accountIdMasked: '****9920', accountType: 'savings',
                    goalName: hit.name, goalTargetAmount: hit.target,
                    goalProgressPct: Math.round((hit.saved / hit.target) * 1000) / 10
                });
            }
        });
        /* Transaction detections. These belong here rather than on an account
           page because the payments stream does not care which page you are
           on, and the foreign transaction is on the credit card while the
           salary lands in the current account. Firing them per account page
           meant whichever one you did not open never fired. */
        onceThisSession('txn_detections', function () {
            var salary = D.TRANSACTIONS.filter(function (t) { return t.salary; })[0];
            if (salary) {
                var acct = D.accountByMask(salary.account);
                trigger('banking_portal_salary_credited', { amount: salary.amount });
                ev.account.salaryCredited({
                    accountIdMasked: salary.account,
                    accountType: acct ? acct.type : 'current_account',
                    balanceAmount: acct ? acct.balance : null,
                    balanceBand: acct ? D.balanceBand(acct.balance) : null,
                    currency: 'GBP'
                });
                ev.transaction.posted(txnPayload(salary));
            }
            var foreign = D.TRANSACTIONS.filter(function (t) { return t.foreign; });
            if (foreign.length) {
                trigger('banking_portal_foreign_spend', {
                    country_code: foreign[0].country,
                    merchant_category: foreign[0].merchantCategory || foreign[0].category
                });
            }
            foreign.forEach(function (t) { ev.transaction.foreign(txnPayload(t)); });
            D.TRANSACTIONS.filter(function (t) { return t.large; })
                .forEach(function (t) { ev.transaction.large(txnPayload(t)); });
        });

        onceThisSession('offers_viewed', function () {
            D.OFFERS.forEach(function (o) {
                ev.engagement.offerViewed({
                    offerId: o.id, offerCategory: o.category, placement: o.placement
                });
            });
        });
    }

    /* -------------------------------------------------------------- account */

    function renderAccount() {
        var el = document.querySelector('[data-portal-main]');
        var mask = new URLSearchParams(window.location.search).get('id') || '4471';
        var a = D.accountByMask(mask) || D.ACCOUNTS[0];
        var txns = D.transactionsFor(a.masked);

        var byCategory = {};
        txns.forEach(function (t) {
            if (t.amount >= 0) return;
            byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
        });
        var cats = Object.keys(byCategory).sort(function (x, y) { return byCategory[y] - byCategory[x]; });
        var spendTotal = cats.reduce(function (s, c) { return s + byCategory[c]; }, 0);

        el.innerHTML = ''
            + '<header class="portal-head">'
            + '  <p class="text-label">' + escapeHtml(a.masked) + (a.sort ? ' &middot; ' + escapeHtml(a.sort) : '') + '</p>'
            + '  <h1 class="heading-display">' + escapeHtml(a.name) + '</h1>'
            + '  <p class="portal-total"><strong class="' + (a.balance < 0 ? 'is-negative' : '') + '">' + D.money(a.balance) + '</strong>'
            + '  <span>' + D.money(a.available) + ' available</span></p>'
            + '</header>'
            + '<section class="portal-block"><h2 class="portal-h2">Where it went</h2>'
            + '<ul class="pc-list">' + cats.map(function (c) {
                var pct = Math.round((byCategory[c] / spendTotal) * 100);
                return '<li class="pc-row"><span class="pc-name">' + escapeHtml(c.replace(/_/g, ' ')) + '</span>'
                     + '<span class="pc-bar"><span style="width:' + pct + '%"></span></span>'
                     + '<span class="pc-amount">' + D.money(byCategory[c]) + '</span></li>';
              }).join('') + '</ul></section>'
            + '<section class="portal-block">'
            + '  <div class="portal-block-head"><h2 class="portal-h2">Transactions</h2>'
            + '  <button class="btn-text" type="button" data-statement>Download statement</button></div>'
            /* Dengage inline target slot, directly above the transaction list.
               A spend insight belongs next to the spending it describes. */
            + '  <div id="dn_inline_target_account_activity" class="dn-inline-slot"></div>'
            + '  <ul class="pt-list">' + txns.map(txnRow).join('') + '</ul>'
            + '</section>';

        var ev = E();
        if (!ev) return;

        ev.account.balanceViewed({
            accountIdMasked: a.masked, accountType: a.type,
            balanceAmount: a.balance, balanceBand: D.balanceBand(a.balance),
            availableBalance: a.available, currency: 'GBP',
            overdraftLimit: a.overdraftLimit, overdraftUsed: a.overdraftUsed
        });

        /* Subscription creep. Only worth saying when there is enough of it to
           be worth saying, so it is gated on the total rather than fired at
           anybody who has a Netflix payment. */
        var subs = txns.filter(function (t) {
            return t.recurring && t.category === 'subscriptions';
        });
        var subsTotal = subs.reduce(function (sum, t) { return sum + Math.abs(t.amount); }, 0);
        if (subs.length >= 3 && subsTotal >= 30) {
            trigger('banking_portal_subscriptions', {
                subscription_count: subs.length,
                subscription_monthly: Math.round(subsTotal * 100) / 100
            });
        }
    }

    function txnPayload(t) {
        return {
            transactionId: t.id,
            accountIdMasked: t.account,
            amount: Math.abs(t.amount),
            currency: 'GBP',
            direction: t.amount < 0 ? 'debit' : 'credit',
            merchantName: t.merchant,
            merchantCategory: t.category,
            countryCode: t.country || 'GB',
            isForeign: !!t.foreign,
            paymentChannel: t.channel,
            frequency: t.frequency || null,
            isRecurring: !!t.recurring
        };
    }

    /* ---------------------------------------------------------------- cards */

    function renderCards() {
        var el = document.querySelector('[data-portal-main]');
        el.innerHTML = ''
            + '<header class="portal-head"><p class="text-label">Cards</p>'
            + '<h1 class="heading-display">Your cards</h1>'
            + '<p class="text-body">Freeze a card the second you misplace it. Nothing is permanent until you say so.</p></header>'
            + '<div class="pcard-grid">' + D.CARDS.map(function (c) {
                return '<article class="pcard" data-card="' + escapeHtml(c.id) + '">'
                     + '  <div class="pcard-face ' + (c.type === 'credit' ? 'is-credit' : '') + '">'
                     + '    <span class="pcard-brand">Meridian</span>'
                     + '    <span class="pcard-mask">' + escapeHtml(c.masked) + '</span>'
                     + '    <span class="pcard-exp">' + escapeHtml(c.expiry) + '</span>'
                     + '  </div>'
                     + '  <p class="pcard-name">' + escapeHtml(c.product) + '</p>'
                     + '  <div class="pcard-actions">'
                     + '    <button type="button" data-card-freeze="' + escapeHtml(c.id) + '">' + (c.frozen ? 'Unfreeze' : 'Freeze card') + '</button>'
                     + '    <button type="button" data-card-pin="' + escapeHtml(c.id) + '">View PIN</button>'
                     + (c.limit ? '<button type="button" data-card-limit="' + escapeHtml(c.id) + '">Request higher limit</button>' : '')
                     + '    <button type="button" data-card-wallet="' + escapeHtml(c.id) + '">Add to Google Wallet</button>'
                     + '    <button type="button" data-card-lost="' + escapeHtml(c.id) + '">Report lost or stolen</button>'
                     + '  </div>'
                     + '</article>';
              }).join('') + '</div>'
            + '<section class="portal-block"><h2 class="portal-h2">Going abroad</h2>'
            + '  <p class="text-body">Tell us where and when, and we will stop the fraud checks getting in your way.</p>'
            + '  <form class="calc-form" id="travelForm">'
            + '    <div class="calc-field"><label for="tvCountry">Country</label><div class="calc-input">'
            + '      <select id="tvCountry"><option value="ES">Spain</option><option value="FR">France</option>'
            + '      <option value="IT">Italy</option><option value="US">United States</option>'
            + '      <option value="JP">Japan</option></select></div></div>'
            + '    <div class="calc-field"><label for="tvStart">From</label>'
            + '      <div class="calc-input"><input type="date" id="tvStart"></div></div>'
            + '    <div class="calc-field"><label for="tvEnd">To</label>'
            + '      <div class="calc-input"><input type="date" id="tvEnd"></div></div>'
            + '  </form>'
            + '  <div class="calc-actions"><button class="btn-primary" type="button" data-travel-set>Set travel notice</button></div>'
            /* Dengage inline target slot, under the travel form. A travel
               notice names a country AND a date range, which is the cleanest
               trigger on the whole site, so the follow-up belongs right here
               rather than in a banner on another page. */
            + '  <div id="dn_inline_target_cards_travel" class="dn-inline-slot"></div>'
            + '</section>';

        var start = new Date(); start.setDate(start.getDate() + 20);
        var end = new Date(); end.setDate(end.getDate() + 34);
        var s = document.getElementById('tvStart'), e = document.getElementById('tvEnd');
        if (s) s.value = start.toISOString().slice(0, 10);
        if (e) e.value = end.toISOString().slice(0, 10);

        var ev = E();
        if (ev) {
            D.CARDS.forEach(function (c) {
                ev.card.viewed({
                    cardIdMasked: c.masked, cardType: c.type, cardProduct: c.product
                });
            });
        }
    }

    /* ------------------------------------------------------------- payments */

    function renderPayments() {
        var el = document.querySelector('[data-portal-main]');
        el.innerHTML = ''
            + '<header class="portal-head"><p class="text-label">Payments</p>'
            + '<h1 class="heading-display">Move money</h1></header>'
            + '<section class="portal-block"><h2 class="portal-h2">Make a payment</h2>'
            + '  <form class="calc-form" id="payForm">'
            + '    <div class="calc-field"><label for="payTo">To</label><div class="calc-input">'
            + '      <input type="text" id="payTo" value="C. Adeyemi"></div></div>'
            + '    <div class="calc-field"><label for="payAmount">Amount</label>'
            + '      <div class="calc-input"><span class="calc-prefix">&pound;</span>'
            + '      <input type="number" id="payAmount" value="150" min="1" step="10"></div></div>'
            + '    <div class="calc-field"><label for="payRef">Reference</label><div class="calc-input">'
            + '      <input type="text" id="payRef" value="Shared bills"></div></div>'
            + '  </form>'
            + '  <div class="calc-actions"><button class="btn-primary" type="button" data-pay-send>Send payment</button></div>'
            + '</section>'
            + '<section class="portal-block"><h2 class="portal-h2">Standing orders</h2>'
            + '  <ul class="pm-list">' + D.STANDING_ORDERS.map(function (o) {
                return '<li class="pm-row"><span class="pm-name">' + escapeHtml(o.payee) + '</span>'
                     + '<span class="pm-meta">' + D.money(o.amount) + ' ' + escapeHtml(o.frequency) + '</span>'
                     + '<button type="button" data-so-cancel="' + escapeHtml(o.id) + '" data-payee="' + escapeHtml(o.payee) + '" data-amount="' + o.amount + '">Cancel</button></li>';
              }).join('') + '</ul></section>'
            + '<section class="portal-block"><h2 class="portal-h2">Direct debits</h2>'
            + '  <ul class="pm-list">' + D.DIRECT_DEBITS.map(function (o) {
                return '<li class="pm-row"><span class="pm-name">' + escapeHtml(o.payee) + '</span>'
                     + '<span class="pm-meta">' + D.money(o.amount) + ' ' + escapeHtml(o.frequency) + '</span>'
                     + '<button type="button" data-dd-cancel="' + escapeHtml(o.id) + '" data-payee="' + escapeHtml(o.payee) + '" data-amount="' + o.amount + '">Cancel</button></li>';
              }).join('') + '</ul>'
            + '  <p class="calc-hint">Cancelling a mortgage direct debit is the one on this page that should reach a person, not a campaign.</p>'
            + '</section>';
    }

    /* --------------------------------------------------------------- wealth */

    function renderWealth() {
        var el = document.querySelector('[data-portal-main]');
        var p = D.PORTFOLIO;
        el.innerHTML = ''
            + '<header class="portal-head"><p class="text-label">Wealth</p>'
            + '<h1 class="heading-display">Managed Portfolio</h1>'
            + '<p class="text-body">Reviewed quarterly with ' + escapeHtml(p.adviser) + '. Value shown as a band, which is what your adviser reports against.</p></header>'
            + '<section class="portal-block"><dl class="calc-breakdown">'
            + '  <div><dt>Portfolio value</dt><dd>' + escapeHtml(p.valueBand.replace(/_/g, ' to ').replace(/k/g, ',000')) + '</dd></div>'
            + '  <div><dt>Risk profile</dt><dd>' + escapeHtml(p.riskProfile) + '</dd></div>'
            + '  <div><dt>Twelve month performance</dt><dd>' + escapeHtml(p.performanceBand.replace('up_', 'up ').replace('_', ' to ')) + '%</dd></div>'
            + '</dl>'
            /* Dengage inline target slot, under the portfolio summary. */
            + '<div id="dn_inline_target_wealth_review" class="dn-inline-slot"></div>'
            + '</section>'
            + '<section class="portal-block"><h2 class="portal-h2">Holdings</h2>'
            + '  <ul class="pc-list">' + p.holdings.map(function (h) {
                return '<li class="pc-row"><span class="pc-name"><button class="pw-holding" type="button" data-holding="'
                     + escapeHtml(h.name) + '" data-asset="' + escapeHtml(h.assetClass) + '">' + escapeHtml(h.name) + '</button></span>'
                     + '<span class="pc-bar"><span style="width:' + h.weight + '%"></span></span>'
                     + '<span class="pc-amount">' + h.weight + '%</span></li>';
              }).join('') + '</ul></section>'
            + '<section class="portal-block"><h2 class="portal-h2">Actions</h2>'
            + '  <div class="calc-actions pw-actions">'
            + '    <button class="btn-primary" type="button" data-wealth-contribute>Make a contribution</button>'
            + '    <button class="btn-text" type="button" data-wealth-rebalance>Request a rebalance</button>'
            + '    <button class="btn-text" type="button" data-wealth-adviser>Contact ' + escapeHtml(p.adviser) + '</button>'
            + '    <button class="btn-text" type="button" data-wealth-report>Download the quarterly report</button>'
            + '  </div></section>'
            + '<p class="page-disclaimer">The value of investments can fall as well as rise and you may get back less than you invested. Past performance is not a guide to future performance.</p>';

        var ev = E();
        if (ev) {
            ev.wealth.portfolioViewed({
                portfolioId: p.id, portfolioValueBand: p.valueBand,
                riskProfile: p.riskProfile, adviserName: p.adviser,
                performanceBand: p.performanceBand
            });
            trigger('banking_portal_wealth_review', {
                risk_profile: p.riskProfile, adviser_name: p.adviser
            });
        }
    }

    /* -------------------------------------------------------------- profile */

    function renderProfile(user) {
        var el = document.querySelector('[data-portal-main]');
        el.innerHTML = ''
            + '<header class="portal-head"><p class="text-label">Profile</p>'
            + '<h1 class="heading-display">You and your preferences</h1></header>'
            + '<section class="portal-block"><dl class="calc-breakdown">'
            + '  <div><dt>Name</dt><dd>' + escapeHtml((user.firstName || '') + ' ' + (user.lastName || '')) + '</dd></div>'
            + '  <div><dt>E-mail</dt><dd>' + escapeHtml(user.email || '') + '</dd></div>'
            + '  <div><dt>Relationship</dt><dd>Premier</dd></div>'
            + '</dl></section>'
            + '<section class="portal-block"><h2 class="portal-h2">How we contact you</h2>'
            + '  <p class="text-body">Changing any of these writes a row you can segment on, so a campaign can respect it rather than ask again.</p>'
            + '  <ul class="pp-list">'
            + ['email', 'sms', 'push'].map(function (ch) {
                return '<li class="pp-row"><span>' + (ch === 'sms' ? 'SMS' : ch.charAt(0).toUpperCase() + ch.slice(1)) + '</span>'
                     + '<label class="pp-switch"><input type="checkbox" data-consent="' + ch + '"'
                     + (ch === 'sms' ? '' : ' checked') + '><span></span></label></li>';
              }).join('')
            + '    <li class="pp-row"><span>Use my data to personalise offers</span>'
            + '      <label class="pp-switch"><input type="checkbox" data-consent="profiling" checked><span></span></label></li>'
            + '  </ul></section>'
            + '<section class="portal-block"><h2 class="portal-h2">Help</h2>'
            + '  <div class="calc-actions pw-actions">'
            + '    <button class="btn-text" type="button" data-support="card_replacement">Replace a card</button>'
            + '    <button class="btn-text" type="button" data-support="payment_dispute">Dispute a payment</button>'
            + '    <button class="btn-text" type="button" data-support="complaint">Make a complaint</button>'
            + '  </div></section>';
    }

    /* --------------------------------------------------------------- clicks */

    function consentPayload() {
        function on(ch) {
            var box = document.querySelector('[data-consent="' + ch + '"]');
            return box ? box.checked : null;
        }
        return {
            consentEmail: on('email'), consentSms: on('sms'),
            consentPush: on('push'), consentProfiling: on('profiling')
        };
    }

    function onClick(event) {
        var ev = E();
        var t = event.target;
        var el;

        /* ---- offers ---- */
        if ((el = t.closest('[data-offer-accept]'))) {
            var oa = D.OFFERS.filter(function (o) { return o.id === el.dataset.offerAccept; })[0];
            if (ev && oa) ev.engagement.offerAccepted({ offerId: oa.id, offerCategory: oa.category, placement: oa.placement });
            return;
        }
        if ((el = t.closest('[data-offer-dismiss]'))) {
            var od = D.OFFERS.filter(function (o) { return o.id === el.dataset.offerDismiss; })[0];
            if (ev && od) ev.engagement.offerDismissed({ offerId: od.id, offerCategory: od.category, placement: od.placement });
            var card = el.closest('[data-offer]');
            if (card) card.remove();
            toast('We will not show that again.');
            return;
        }

        /* ---- statements ---- */
        if (t.closest('[data-statement]')) {
            var mask = new URLSearchParams(window.location.search).get('id') || '4471';
            var acct = D.accountByMask(mask);
            if (ev && acct) {
                ev.account.statementViewed({ accountIdMasked: acct.masked, accountType: acct.type });
                ev.account.documentDownloaded({ accountIdMasked: acct.masked, accountType: acct.type });
            }
            toast('Statement downloaded.');
            return;
        }

        /* ---- cards ---- */
        if ((el = t.closest('[data-card-freeze]'))) {
            var cf = D.CARDS.filter(function (c) { return c.id === el.dataset.cardFreeze; })[0];
            if (!cf) return;
            cf.frozen = !cf.frozen;
            el.textContent = cf.frozen ? 'Unfreeze' : 'Freeze card';
            el.classList.toggle('is-on', cf.frozen);
            if (ev) {
                var payload = { cardIdMasked: cf.masked, cardType: cf.type, cardProduct: cf.product };
                if (cf.frozen) {
                    payload.freezeReason = 'misplaced';
                    ev.card.frozen(payload);
                    trigger('banking_portal_card_frozen', { card_type: cf.type });
                } else {
                    ev.card.unfrozen(payload);
                }
            }
            toast(cf.frozen ? 'Card frozen. Nothing will be taken from it.' : 'Card unfrozen.');
            return;
        }
        if ((el = t.closest('[data-card-pin]'))) {
            var cp = D.CARDS.filter(function (c) { return c.id === el.dataset.cardPin; })[0];
            if (ev && cp) ev.card.pinViewed({ cardIdMasked: cp.masked, cardType: cp.type, cardProduct: cp.product });
            toast('PIN shown for 10 seconds.');
            return;
        }
        if ((el = t.closest('[data-card-limit]'))) {
            var cl = D.CARDS.filter(function (c) { return c.id === el.dataset.cardLimit; })[0];
            if (ev && cl) {
                ev.card.limitRequested({
                    cardIdMasked: cl.masked, cardType: cl.type, cardProduct: cl.product,
                    previousLimit: cl.limit, newLimit: cl.limit + 2000
                });
            }
            toast('Limit increase requested. We will answer within one working day.');
            return;
        }
        if ((el = t.closest('[data-card-wallet]'))) {
            var cw = D.CARDS.filter(function (c) { return c.id === el.dataset.cardWallet; })[0];
            if (ev && cw) ev.card.addedToWallet({ cardIdMasked: cw.masked, cardType: cw.type, cardProduct: cw.product, walletType: 'google' });
            toast('Card added to Google Wallet.');
            return;
        }
        if ((el = t.closest('[data-card-lost]'))) {
            var cx = D.CARDS.filter(function (c) { return c.id === el.dataset.cardLost; })[0];
            if (ev && cx) {
                ev.card.reportedLost({ cardIdMasked: cx.masked, cardType: cx.type, cardProduct: cx.product, freezeReason: 'lost' });
                ev.card.replaced({ cardIdMasked: cx.masked, cardType: cx.type, cardProduct: cx.product });
            }
            toast('Card cancelled and a replacement is on its way.');
            return;
        }
        if (t.closest('[data-travel-set]')) {
            var country = document.getElementById('tvCountry');
            var st = document.getElementById('tvStart');
            var en = document.getElementById('tvEnd');
            var credit = D.CARDS.filter(function (c) { return c.type === 'credit'; })[0];
            if (ev && credit) {
                ev.card.travelNoticeSet({
                    cardIdMasked: credit.masked, cardType: credit.type, cardProduct: credit.product,
                    travelCountry: country ? country.value : null,
                    /* Date objects: bankingEvents formats them to the
                       YYYY-MM-DD HH:mm the platform stores. */
                    travelStartDate: st && st.value ? new Date(st.value + 'T00:00') : null,
                    travelEndDate: en && en.value ? new Date(en.value + 'T00:00') : null
                });
            }
            trigger('banking_portal_travel_notice', {
                travel_country: country ? country.value : null
            });
            toast('Travel notice set. Have a good trip.');
            return;
        }

        /* ---- payments ---- */
        if (t.closest('[data-pay-send]')) {
            var to = document.getElementById('payTo');
            var amt = document.getElementById('payAmount');
            if (ev) {
                ev.transaction.paymentMade({
                    transactionId: 'TXN-' + String(Date.now()).slice(-6),
                    accountIdMasked: '****4471',
                    amount: Number(amt && amt.value) || 0,
                    currency: 'GBP', direction: 'debit',
                    payeeName: to ? to.value : null,
                    merchantCategory: 'transfer', paymentChannel: 'online'
                });
            }
            toast('Payment sent.');
            return;
        }
        if ((el = t.closest('[data-so-cancel]'))) {
            if (ev) {
                ev.transaction.standingOrderCancelled({
                    transactionId: el.dataset.soCancel, accountIdMasked: '****4471',
                    amount: Number(el.dataset.amount), currency: 'GBP', direction: 'debit',
                    payeeName: el.dataset.payee, frequency: 'monthly', isRecurring: true
                });
            }
            el.closest('.pm-row').remove();
            toast('Standing order cancelled.');
            return;
        }
        if ((el = t.closest('[data-dd-cancel]'))) {
            if (ev) {
                ev.transaction.directDebitCancelled({
                    transactionId: el.dataset.ddCancel, accountIdMasked: '****4471',
                    amount: Number(el.dataset.amount), currency: 'GBP', direction: 'debit',
                    payeeName: el.dataset.payee,
                    merchantCategory: /Mortgage/i.test(el.dataset.payee) ? 'mortgage' : 'utilities',
                    frequency: 'monthly', isRecurring: true
                });
            }
            /* A cancelled mortgage mandate is a retention moment, not a
               marketing one, and it is the only direct debit here that gets
               its own scenario. */
            if (/Mortgage/i.test(el.dataset.payee)) {
                trigger('banking_portal_mortgage_dd_cancelled', {
                    payee_name: el.dataset.payee, amount: Number(el.dataset.amount)
                });
            }
            el.closest('.pm-row').remove();
            toast(/Mortgage/i.test(el.dataset.payee)
                ? 'Cancelled. A mortgage direct debit ending is something we would call you about.'
                : 'Direct debit cancelled.');
            return;
        }

        /* ---- wealth ---- */
        if ((el = t.closest('[data-holding]'))) {
            if (ev) {
                ev.wealth.holdingViewed({
                    portfolioId: D.PORTFOLIO.id, portfolioValueBand: D.PORTFOLIO.valueBand,
                    holdingName: el.dataset.holding, assetClass: el.dataset.asset,
                    riskProfile: D.PORTFOLIO.riskProfile
                });
            }
            return;
        }
        if (t.closest('[data-wealth-contribute]')) {
            if (ev) ev.wealth.contributionMade({ portfolioId: D.PORTFOLIO.id, portfolioValueBand: D.PORTFOLIO.valueBand, contributionAmount: 10000, contributionFrequency: 'one_off', riskProfile: D.PORTFOLIO.riskProfile });
            toast('Contribution instruction received.');
            return;
        }
        if (t.closest('[data-wealth-rebalance]')) {
            if (ev) ev.wealth.rebalanceRequested({ portfolioId: D.PORTFOLIO.id, portfolioValueBand: D.PORTFOLIO.valueBand, riskProfile: D.PORTFOLIO.riskProfile, adviserName: D.PORTFOLIO.adviser });
            toast('Rebalance requested.');
            return;
        }
        if (t.closest('[data-wealth-adviser]')) {
            if (ev) ev.wealth.adviserContacted({ portfolioId: D.PORTFOLIO.id, adviserName: D.PORTFOLIO.adviser, portfolioValueBand: D.PORTFOLIO.valueBand });
            toast(D.PORTFOLIO.adviser + ' will call you back today.');
            return;
        }
        if (t.closest('[data-wealth-report]')) {
            if (ev) ev.wealth.reportDownloaded({ portfolioId: D.PORTFOLIO.id, portfolioValueBand: D.PORTFOLIO.valueBand });
            toast('Quarterly report downloaded.');
            return;
        }

        /* ---- support ---- */
        if ((el = t.closest('[data-support]'))) {
            var topic = el.dataset.support;
            if (ev) {
                if (topic === 'complaint') ev.account.complaintRaised({ accountIdMasked: '****4471', accountType: 'current_account', supportTopic: topic });
                else ev.account.supportContacted({ accountIdMasked: '****4471', accountType: 'current_account', supportTopic: topic });
            }
            toast('Thanks. Someone will be in touch.');
        }
    }

    function onConsentChange(event) {
        var box = event.target.closest('[data-consent]');
        if (!box) return;
        var ev = E();
        if (!ev) return;
        var payload = consentPayload();
        ev.engagement.preferenceUpdated(payload);
        if (box.dataset.consent === 'profiling') {
            if (box.checked) ev.engagement.consentGranted(payload);
            else ev.engagement.consentWithdrawn(payload);
        }
        toast('Preferences saved.');
    }

    /* ------------------------------------------------------------------ run */

    function init() {
        if (!D) return;
        var page = document.body.dataset.portalPage;
        if (!page) return;

        var user = gate();
        if (!user) return;

        var name = document.querySelector('[data-portal-user]');
        if (name) name.textContent = (user.firstName || 'Customer');

        if (page === 'dashboard') renderDashboard(user);
        else if (page === 'account') renderAccount();
        else if (page === 'cards') renderCards();
        else if (page === 'payments') renderPayments();
        else if (page === 'wealth') renderWealth();
        else if (page === 'profile') renderProfile(user);

        document.addEventListener('click', onClick);
        document.addEventListener('change', onConsentChange);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
