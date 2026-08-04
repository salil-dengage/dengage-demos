/* ============================================================================
   Calculators, and the banking_tool_events rows behind them

   The richest first-party data on the public site, because the customer
   volunteers their own numbers. "Modelled a mortgage over 400k at above 85%
   LTV in the last 7 days and never started an application" is one filter over
   this table, and it is a real audience a bank would pay for.

   ONE EVENT PER SETTLED CALCULATION, NEVER PER KEYSTROKE.

   Same rule as ec:search on the retail sites, and for the same reason. Typing
   "320000" into a field is six input events. Sending six rows would fill the
   table with 3, 32, 320, 3200, 32000, 320000 and describe typing rather than
   intent. So the result recalculates live for the user, and the event waits
   for a 900ms pause or a blur.

   Absent values stay absent. numOrNull never turns an empty field into 0,
   because a 0 deposit is a claim and an empty one is a question not answered.
   ========================================================================== */
(function () {
    'use strict';

    var SETTLE_MS = 900;

    function numOrNull(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    function money(value) {
        if (value === null || !isFinite(value)) return '';
        return new Intl.NumberFormat('en-GB', {
            style: 'currency', currency: 'GBP', maximumFractionDigits: 0
        }).format(value);
    }

    function money2(value) {
        if (value === null || !isFinite(value)) return '';
        return new Intl.NumberFormat('en-GB', {
            style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(value);
    }

    function readForm(form) {
        var out = {};
        Array.prototype.forEach.call(form.elements, function (el) {
            if (el.name) out[el.name] = numOrNull(el.value);
        });
        return out;
    }

    /* Standard amortising payment. Rate 0 is a real answer, not a divide by
       zero, so it is handled rather than guarded against. */
    function monthlyPayment(principal, annualRatePct, months) {
        if (!principal || !months) return null;
        var r = (annualRatePct || 0) / 100 / 12;
        if (r === 0) return principal / months;
        return principal * r / (1 - Math.pow(1 + r, -months));
    }

    /* ------------------------------------------------------------ affordability */

    function affordability(v) {
        var income = v.incomeAnnual || 0;
        var outgoings = v.outgoingsMonthly || 0;
        var deposit = v.deposit || 0;
        var target = v.amount || 0;

        /* 4.5x income, less the annualised commitments at the same multiple. */
        var maxBorrow = Math.max(0, (income * 4.5) - (outgoings * 12 * 4.5));
        var maxProperty = maxBorrow + deposit;
        var ltv = target > 0 ? ((target - deposit) / target) * 100 : null;
        var shortfall = target > maxProperty ? target - maxProperty : 0;

        return {
            maxBorrow: Math.round(maxBorrow),
            maxProperty: Math.round(maxProperty),
            ltv: ltv === null ? null : Math.round(ltv * 10) / 10,
            shortfall: Math.round(shortfall)
        };
    }

    function renderAffordability(v, r) {
        var html = ''
            + '<div class="calc-headline"><span class="calc-headline-label">We would consider lending you up to</span>'
            + '<span class="calc-headline-value">' + money(r.maxBorrow) + '</span></div>'
            + '<dl class="calc-breakdown">'
            + '<div><dt>Property you could buy</dt><dd>' + money(r.maxProperty) + '</dd></div>'
            + (r.ltv !== null ? '<div><dt>Loan to value on your target</dt><dd>' + r.ltv + '%</dd></div>' : '')
            + '</dl>';

        /* The interesting case, and the one worth a campaign: they want more
           than we would lend. Saying so plainly beats a cheerful number. */
        if (r.shortfall > 0) {
            html += '<p class="calc-note calc-note-warn">'
                 + 'That is ' + money(r.shortfall) + ' short of the property price you entered. '
                 + 'A larger deposit, a longer term or a joint application would each close some of the gap. '
                 + '<a href="appointments.html">Talk it through with an adviser</a>.</p>';
        }
        if (r.ltv !== null && r.ltv > 95) {
            html += '<p class="calc-note">We lend up to 95% of the property value, so you would need a deposit of at least 5%.</p>';
        }
        return html;
    }

    /* ---------------------------------------------------------------- repayment */

    function repayment(v) {
        var months = (v.termYears || 0) * 12;
        var payment = monthlyPayment(v.amount, v.rate, months);
        if (payment === null) return { monthly: null, total: null, interest: null };
        var total = payment * months;
        return {
            monthly: payment,
            total: total,
            interest: total - (v.amount || 0),
            months: months
        };
    }

    function renderRepayment(v, r) {
        if (r.monthly === null) return '<p class="calc-note">Enter an amount and a term.</p>';
        return ''
            + '<div class="calc-headline"><span class="calc-headline-label">Monthly payment</span>'
            + '<span class="calc-headline-value">' + money2(r.monthly) + '</span></div>'
            + '<dl class="calc-breakdown">'
            + '<div><dt>Total repayable</dt><dd>' + money(r.total) + '</dd></div>'
            + '<div><dt>Interest over the term</dt><dd>' + money(r.interest) + '</dd></div>'
            + '</dl>'
            + '<p class="calc-note">Over ' + (v.termYears || 0) + ' years you would repay '
            + money(r.interest) + ' in interest, which is '
            + Math.round((r.interest / (v.amount || 1)) * 100) + '% of the amount borrowed.</p>';
    }

    /* ------------------------------------------------------------------ savings */

    function savings(v) {
        var goal = v.amount || 0;
        var balance = v.deposit || 0;
        var monthly = v.monthly || 0;
        var monthlyRate = (v.rate || 0) / 100 / 12;

        if (goal <= balance) return { months: 0, projected: balance, reached: true };
        if (monthly <= 0 && monthlyRate <= 0) return { months: null, projected: balance, reached: false };

        var months = 0;
        /* 50 years, so a hopeless goal terminates instead of spinning. */
        while (balance < goal && months < 600) {
            balance = balance * (1 + monthlyRate) + monthly;
            months += 1;
        }
        return {
            months: balance >= goal ? months : null,
            projected: balance,
            reached: balance >= goal
        };
    }

    function renderSavings(v, r) {
        if (r.months === null) {
            return '<p class="calc-note calc-note-warn">At that monthly amount you would not reach the goal within 50 years. Increasing the monthly amount is the only thing here that moves it much.</p>';
        }
        if (r.months === 0) {
            return '<p class="calc-note">You already have enough for that goal.</p>';
        }
        var years = Math.floor(r.months / 12);
        var rem = r.months % 12;
        var label = (years ? years + (years === 1 ? ' year' : ' years') : '')
                  + (years && rem ? ' and ' : '')
                  + (rem ? rem + (rem === 1 ? ' month' : ' months') : '');
        return ''
            + '<div class="calc-headline"><span class="calc-headline-label">You would reach your goal in</span>'
            + '<span class="calc-headline-value">' + label + '</span></div>'
            + '<dl class="calc-breakdown">'
            + '<div><dt>Total saved</dt><dd>' + money(r.projected) + '</dd></div>'
            + '<div><dt>Of which interest</dt><dd>'
            + money(r.projected - (v.deposit || 0) - (v.monthly || 0) * r.months) + '</dd></div>'
            + '</dl>';
    }

    /* ------------------------------------------------------------------- wiring */

    var CALCS = {
        affordability: {
            compute: affordability,
            render: renderAffordability,
            send: function (v, r) {
                window.MeridianEvents.tool.mortgageAffordability({
                    amount: v.amount,
                    deposit: v.deposit,
                    incomeAnnual: v.incomeAnnual,
                    outgoingsMonthly: v.outgoingsMonthly,
                    maxBorrow: r.maxBorrow,
                    loanToValuePct: r.ltv,
                    completed: true
                });
            }
        },
        repayment: {
            compute: repayment,
            render: renderRepayment,
            send: function (v, r) {
                window.MeridianEvents.tool.mortgageRepayment({
                    amount: v.amount,
                    termMonths: r.months,
                    rate: v.rate,
                    monthlyPayment: r.monthly === null ? null : Math.round(r.monthly * 100) / 100,
                    totalRepayable: r.total === null ? null : Math.round(r.total),
                    completed: r.monthly !== null
                });
            }
        },
        savings: {
            compute: savings,
            render: renderSavings,
            send: function (v, r) {
                window.MeridianEvents.tool.savingsGoal({
                    amount: v.amount,
                    deposit: v.deposit,
                    rate: v.rate,
                    termMonths: r.months,
                    projectedValue: r.projected === null ? null : Math.round(r.projected),
                    completed: r.reached
                });
            }
        }
    };

    function init() {
        Object.keys(CALCS).forEach(function (name) {
            var form = document.querySelector('[data-calc="' + name + '"]');
            var out = document.querySelector('[data-calc-result="' + name + '"]');
            if (!form || !out) return;

            var spec = CALCS[name];
            var timer = null;

            function recalc(settled) {
                var values = readForm(form);
                var result = spec.compute(values);
                out.innerHTML = spec.render(values, result);

                if (!settled || !window.MeridianEvents) return;
                spec.send(values, result);
            }

            function schedule() {
                recalc(false);
                clearTimeout(timer);
                timer = setTimeout(function () { recalc(true); }, SETTLE_MS);
            }

            form.addEventListener('input', schedule);
            /* Leaving a field settles it immediately: the customer has moved
               on, so waiting out the timer only risks losing the row. */
            form.addEventListener('change', function () {
                clearTimeout(timer);
                recalc(true);
            });

            /* First paint shows a result without recording one. Landing on the
               page is not the same as using the calculator, and counting it
               would make every visitor look like an intent signal. */
            recalc(false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
