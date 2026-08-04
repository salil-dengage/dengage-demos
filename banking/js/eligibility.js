/* ============================================================================
   Eligibility checker

   A soft check. Writes banking_tool_events:

     eligibility_check_started    on first interaction with the form
     eligibility_check_completed  on submit, with the outcome and the band
     eligibility_check_abandoned  on leaving with the form touched but no result

   The abandoned row is the one worth having. Somebody who filled in their
   income and then left is a warmer audience than somebody who never arrived,
   and without this event the two look identical.

   The scoring here is illustrative arithmetic for a demo, not a credit model,
   and the page says so.
   ========================================================================== */
(function () {
    'use strict';

    function numOrNull(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    function money(value) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency', currency: 'GBP', maximumFractionDigits: 0
        }).format(value || 0);
    }

    var HISTORY_SCORE = { excellent: 40, good: 30, fair: 15, poor: 0 };
    var HISTORY_BAND = { excellent: 'excellent', good: 'good', fair: 'fair', poor: 'poor' };

    /* Representative rates by product, nudged by the band. Illustrative. */
    var BASE_RATE = { loan: 6.9, credit_card: 19.9, mortgage: 4.39 };
    var BAND_UPLIFT = { excellent: -0.5, good: 0, fair: 1.8, poor: 4.5 };

    function assess(v) {
        var income = v.incomeAnnual || 0;
        var outgoings = (v.outgoingsMonthly || 0) * 12;
        var amount = v.amount || 0;
        var disposable = Math.max(0, income - outgoings);

        var score = HISTORY_SCORE[v.history] || 0;

        /* Borrowing as a multiple of what is actually left over. */
        var multiple = disposable > 0 ? amount / disposable : Infinity;
        if (multiple <= 0.5) score += 40;
        else if (multiple <= 1) score += 30;
        else if (multiple <= 2) score += 18;
        else if (multiple <= 4) score += 8;

        if (income >= 60000) score += 15;
        else if (income >= 30000) score += 10;
        else if (income >= 18000) score += 5;

        var outcome = score >= 70 ? 'likely' : (score >= 45 ? 'possible' : 'unlikely');
        var rate = (BASE_RATE[v.productCategory] || 6.9) + (BAND_UPLIFT[v.history] || 0);
        if (outcome === 'unlikely') rate += 3;

        return {
            outcome: outcome,
            score: score,
            band: HISTORY_BAND[v.history] || 'good',
            rate: Math.round(rate * 10) / 10,
            disposable: disposable,
            multiple: multiple
        };
    }

    var COPY = {
        likely: {
            head: 'You are likely to be accepted',
            note: 'Based on what you have told us, we would expect to approve this. A full application confirms it.'
        },
        possible: {
            head: 'You may be accepted',
            note: 'This is borderline on affordability. Borrowing less, or over a longer term, would improve it.'
        },
        unlikely: {
            head: 'You are unlikely to be accepted right now',
            note: 'We would rather tell you now than after a hard search. Reducing existing commitments, or applying for a smaller amount, is what moves this most.'
        }
    };

    function render(v, r) {
        var copy = COPY[r.outcome];
        var html = ''
            + '<div class="calc-headline"><span class="calc-headline-label">Indicative result</span>'
            + '<span class="calc-headline-value">' + copy.head + '</span></div>'
            + '<dl class="calc-breakdown">'
            + '<div><dt>Rate you would be offered</dt><dd>' + r.rate + '%</dd></div>'
            + '<div><dt>Income after commitments</dt><dd>' + money(r.disposable) + ' a year</dd></div>'
            + '</dl>'
            + '<p class="calc-note' + (r.outcome === 'unlikely' ? ' calc-note-warn' : '') + '">'
            + copy.note + '</p>';

        if (r.outcome !== 'unlikely') {
            html += '<p class="calc-note"><a class="btn-primary" href="index.html#products">See the products you could apply for</a></p>';
        } else {
            html += '<p class="calc-note"><a href="appointments.html">Talk it through with an adviser</a>, who can look at the whole picture rather than these five fields.</p>';
        }
        return html;
    }

    function readForm(form) {
        return {
            productCategory: form.elements.productCategory.value,
            amount: numOrNull(form.elements.amount.value),
            termYears: numOrNull(form.elements.termYears.value),
            incomeAnnual: numOrNull(form.elements.incomeAnnual.value),
            outgoingsMonthly: numOrNull(form.elements.outgoingsMonthly.value),
            history: form.elements.history.value
        };
    }

    function init() {
        var form = document.getElementById('eligibilityForm');
        var button = document.getElementById('eligibilitySubmit');
        var out = document.getElementById('eligibilityResult');
        if (!form || !button || !out) return;

        var started = false;
        var completed = false;

        function events() { return window.MeridianEvents || null; }

        form.addEventListener('input', function () {
            if (started) return;
            started = true;
            var ev = events();
            if (!ev) return;
            var v = readForm(form);
            ev.tool.eligibilityStarted({
                productCategory: v.productCategory,
                amount: v.amount,
                termMonths: v.termYears === null ? null : v.termYears * 12
            });
        }, { once: false });

        button.addEventListener('click', function () {
            var v = readForm(form);
            var r = assess(v);
            out.innerHTML = render(v, r);
            completed = true;

            var ev = events();
            if (!ev) return;
            ev.tool.eligibilityCompleted({
                productCategory: v.productCategory,
                amount: v.amount,
                termMonths: v.termYears === null ? null : v.termYears * 12,
                incomeAnnual: v.incomeAnnual,
                outgoingsMonthly: v.outgoingsMonthly,
                rate: r.rate,
                eligibilityOutcome: r.outcome,
                eligibilityScoreBand: r.band
            });
        });

        /* Touched the form, never got a result. pagehide rather than unload,
           because unload does not fire reliably on mobile Safari and this is
           the row that describes a warm lead walking away. */
        window.addEventListener('pagehide', function () {
            if (!started || completed) return;
            var ev = events();
            if (!ev) return;
            var v = readForm(form);
            ev.tool.eligibilityAbandoned({
                productCategory: v.productCategory,
                amount: v.amount,
                incomeAnnual: v.incomeAnnual
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
