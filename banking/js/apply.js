/* ============================================================================
   The application journey

   Six steps, and the reason this site has step-level events at all: dropping
   out at identity verification needs a completely different message from
   dropping out at income and employment. A single "abandoned cart" row cannot
   tell you which happened, which is most of why the ecommerce tables were
   wrong for this site.

   Writes banking_application_events:

     application_started    fired by js/shortlist.js when the journey begins
     step_completed         per step, with time_on_step_seconds
     step_abandoned         on leaving mid-journey, naming the step
     document_uploaded      per document
     application_submitted  on the final step
     decision_returned      with a decision and, when declined, a reason code

   State survives a reload in localStorage, because the copy on the page
   promises we save where you got to and a demo that loses it on refresh
   makes a liar of the page.
   ========================================================================== */
(function () {
    'use strict';

    var STORE = 'meridian_application';

    var STEPS = [
        { name: 'about_you',             label: 'About you' },
        { name: 'income_and_employment', label: 'Income and employment' },
        { name: 'your_borrowing',        label: 'What you want to borrow' },
        { name: 'identity_verification', label: 'Confirming your identity' },
        { name: 'documents',             label: 'Documents' },
        { name: 'review',                label: 'Review and submit' }
    ];

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, function (char) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
            });
    }

    function numOrNull(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    function query(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function loadState() {
        try { return JSON.parse(localStorage.getItem(STORE) || 'null'); }
        catch (err) { return null; }
    }

    function saveState(state) {
        try { localStorage.setItem(STORE, JSON.stringify(state)); }
        catch (err) { /* private browsing: the journey still works in memory */ }
    }

    function clearState() {
        try { localStorage.removeItem(STORE); } catch (err) {}
    }

    var state = null;
    var product = null;
    var stepEnteredAt = Date.now();
    var finished = false;

    function events() { return window.MeridianEvents || null; }

    function base() {
        return {
            applicationId: state.applicationId,
            productId: state.productId,
            productCategory: product ? product.category : null,
            totalSteps: STEPS.length
        };
    }

    /* ------------------------------------------------------------- rendering */

    function renderSteps() {
        var el = document.querySelector('[data-apply-steps]');
        if (!el) return;
        el.innerHTML = STEPS.map(function (step, i) {
            var cls = i < state.stepIndex ? 'is-done' : (i === state.stepIndex ? 'is-current' : '');
            return '<li class="apply-step ' + cls + '">'
                 + '<span class="apply-step-index">' + (i + 1) + '</span>'
                 + '<span class="apply-step-label">' + escapeHtml(step.label) + '</span>'
                 + '</li>';
        }).join('');
    }

    function field(id, label, type, value, hint) {
        return '<div class="calc-field">'
             + '<label for="' + id + '">' + escapeHtml(label) + '</label>'
             + '<div class="calc-input"><input type="' + type + '" id="' + id + '" name="' + id + '" value="' + escapeHtml(value || '') + '"></div>'
             + (hint ? '<p class="calc-hint">' + escapeHtml(hint) + '</p>' : '')
             + '</div>';
    }

    function stepBody(index) {
        var d = state.data;
        switch (STEPS[index].name) {
            case 'about_you':
                return '<div class="calc-form">'
                     + field('fullName', 'Full name', 'text', d.fullName)
                     + field('dateOfBirth', 'Date of birth', 'date', d.dateOfBirth)
                     + field('address', 'Current address', 'text', d.address)
                     + field('yearsAtAddress', 'Years at this address', 'number', d.yearsAtAddress)
                     + '</div>';
            case 'income_and_employment':
                return '<div class="calc-form">'
                     + field('employer', 'Employer', 'text', d.employer)
                     + field('incomeAnnual', 'Annual income before tax', 'number', d.incomeAnnual)
                     + field('outgoingsMonthly', 'Regular monthly commitments', 'number', d.outgoingsMonthly,
                             'Loans, cards and childcare. Not rent or bills.')
                     + '</div>';
            case 'your_borrowing':
                return '<div class="calc-form">'
                     + field('requestedAmount', 'Amount you want', 'number', d.requestedAmount)
                     + field('requestedTermYears', 'Over how many years', 'number', d.requestedTermYears)
                     + '</div>';
            case 'identity_verification':
                return '<p class="text-body">We check your identity against the electoral roll and your banking history. This is a soft check and leaves no mark.</p>'
                     + '<div class="calc-form">'
                     + field('idNumber', 'National Insurance number', 'text', d.idNumber, 'Format QQ 12 34 56 C. Nothing is stored on this demo.')
                     + '</div>';
            case 'documents':
                return '<p class="text-body">Two documents, or one if we can verify you electronically.</p>'
                     + '<div class="apply-docs">'
                     + ['Proof of income', 'Proof of address'].map(function (doc, i) {
                         var done = (state.documents || []).indexOf(doc) !== -1;
                         return '<button class="apply-doc' + (done ? ' is-done' : '') + '" type="button" data-apply-doc="' + escapeHtml(doc) + '">'
                              + (done ? 'Uploaded: ' : 'Upload ') + escapeHtml(doc) + '</button>';
                       }).join('')
                     + '</div>'
                     + '<p class="calc-hint">No file is actually uploaded on this demo site.</p>';
            case 'review':
                return '<dl class="calc-breakdown">'
                     + '<div><dt>Product</dt><dd>' + escapeHtml(product ? product.name : state.productId) + '</dd></div>'
                     + '<div><dt>Amount</dt><dd>' + escapeHtml(d.requestedAmount || 'Not given') + '</dd></div>'
                     + '<div><dt>Term</dt><dd>' + escapeHtml(d.requestedTermYears || 'Not given') + ' years</dd></div>'
                     + '<div><dt>Documents outstanding</dt><dd>' + (2 - (state.documents || []).length) + '</dd></div>'
                     + '</dl>'
                     + '<p class="calc-note">Submitting runs a full assessment. On this demo site no real application is made and no credit check is performed.</p>';
        }
        return '';
    }

    function render() {
        var panel = document.querySelector('[data-apply-panel]');
        if (!panel) return;

        if (finished) return;   // the decision screen owns the panel

        var step = STEPS[state.stepIndex];
        panel.innerHTML = ''
            + '<h2 class="heading-display apply-panel-title">' + escapeHtml(step.label) + '</h2>'
            + '<p class="apply-panel-progress">Step ' + (state.stepIndex + 1) + ' of ' + STEPS.length + '</p>'
            + stepBody(state.stepIndex)
            + '<div class="apply-actions">'
            + (state.stepIndex > 0 ? '<button class="btn-text" type="button" data-apply-back>Back</button>' : '')
            + '<button class="btn-primary" type="button" data-apply-next>'
            + (state.stepIndex === STEPS.length - 1 ? 'Submit application' : 'Continue')
            + '</button>'
            + '</div>';

        renderSteps();
        stepEnteredAt = Date.now();
    }

    function collect() {
        var panel = document.querySelector('[data-apply-panel]');
        if (!panel) return;
        panel.querySelectorAll('input').forEach(function (input) {
            state.data[input.name] = input.value;
        });
        saveState(state);
    }

    /* --------------------------------------------------------------- decision */

    function decide() {
        var income = numOrNull(state.data.incomeAnnual) || 0;
        var outgoings = (numOrNull(state.data.outgoingsMonthly) || 0) * 12;
        var amount = numOrNull(state.data.requestedAmount) || 0;
        var disposable = Math.max(0, income - outgoings);
        var outstanding = 2 - (state.documents || []).length;

        if (outstanding > 0) return { decision: 'referred', reason: 'DOCUMENTS_OUTSTANDING' };
        if (disposable <= 0) return { decision: 'declined', reason: 'AFFORDABILITY' };
        if (amount > disposable * 4) return { decision: 'referred', reason: 'AFFORDABILITY' };
        return { decision: 'approved', reason: null };
    }

    var DECISION_COPY = {
        approved: {
            head: 'Approved in principle',
            note: 'We would lend on these figures. A full offer follows once we have verified your documents.'
        },
        referred: {
            head: 'Referred to an underwriter',
            note: 'This needs a person to look at it, usually within one working day. That is not a decline.'
        },
        declined: {
            head: 'We cannot lend on these figures',
            note: 'Your commitments leave nothing spare against this amount. Borrowing less, or over a longer term, changes that.'
        }
    };

    function showDecision(result) {
        var panel = document.querySelector('[data-apply-panel]');
        if (!panel) return;
        finished = true;
        var copy = DECISION_COPY[result.decision];
        panel.innerHTML = ''
            + '<div class="calc-headline"><span class="calc-headline-label">Application ' + escapeHtml(state.applicationId) + '</span>'
            + '<span class="calc-headline-value">' + copy.head + '</span></div>'
            + '<p class="calc-note' + (result.decision === 'declined' ? ' calc-note-warn' : '') + '">' + copy.note + '</p>'
            + '<p class="calc-note"><a href="appointments.html">Speak to an adviser</a> or '
            + '<a href="index.html#products">look at the rest of the range</a>.</p>';
        renderSteps();
    }

    /* ---------------------------------------------------------------- wiring */

    function next() {
        collect();
        var ev = events();
        var seconds = Math.round((Date.now() - stepEnteredAt) / 1000);
        var step = STEPS[state.stepIndex];

        if (ev) {
            ev.application.stepCompleted(Object.assign(base(), {
                stepName: step.name,
                stepIndex: state.stepIndex + 1,
                timeOnStepSeconds: seconds,
                requestedAmount: numOrNull(state.data.requestedAmount),
                requestedTermMonths: state.data.requestedTermYears
                    ? Number(state.data.requestedTermYears) * 12 : null,
                documentsOutstanding: 2 - (state.documents || []).length
            }));
        }

        if (state.stepIndex === STEPS.length - 1) {
            var result = decide();
            if (ev) {
                ev.application.submitted(Object.assign(base(), {
                    requestedAmount: numOrNull(state.data.requestedAmount),
                    requestedTermMonths: state.data.requestedTermYears
                        ? Number(state.data.requestedTermYears) * 12 : null,
                    documentsOutstanding: 2 - (state.documents || []).length
                }));
                ev.application.decisionReturned(Object.assign(base(), {
                    decision: result.decision,
                    declineReasonCode: result.reason
                }));
            }
            clearState();
            showDecision(result);
            return;
        }

        state.stepIndex += 1;
        saveState(state);
        render();
    }

    function back() {
        collect();
        if (state.stepIndex === 0) return;
        state.stepIndex -= 1;
        saveState(state);
        render();
    }

    function uploadDoc(name) {
        state.documents = state.documents || [];
        if (state.documents.indexOf(name) === -1) state.documents.push(name);
        saveState(state);

        var ev = events();
        if (ev) {
            ev.application.documentUploaded(Object.assign(base(), {
                stepName: 'documents',
                documentsOutstanding: 2 - state.documents.length
            }));
        }
        render();
    }

    function init() {
        var panel = document.querySelector('[data-apply-panel]');
        if (!panel) return;

        var productId = query('product');
        var applicationId = query('application');
        var saved = loadState();

        /* Resume the saved journey only when it is the same application. */
        if (saved && (!applicationId || saved.applicationId === applicationId)) {
            state = saved;
        } else {
            state = {
                applicationId: applicationId || ('APP-' + String(Date.now()).slice(-7)),
                productId: productId || (saved && saved.productId) || null,
                stepIndex: 0,
                data: {},
                documents: []
            };
        }
        if (productId) state.productId = productId;
        saveState(state);

        panel.addEventListener('click', function (event) {
            if (event.target.closest('[data-apply-next]')) return next();
            if (event.target.closest('[data-apply-back]')) return back();
            var doc = event.target.closest('[data-apply-doc]');
            if (doc) return uploadDoc(doc.dataset.applyDoc);
        });

        /* Left mid-journey. The row names the step, which is the entire point. */
        window.addEventListener('pagehide', function () {
            if (finished || !events()) return;
            collect();
            events().application.stepAbandoned(Object.assign(base(), {
                stepName: STEPS[state.stepIndex].name,
                stepIndex: state.stepIndex + 1,
                timeOnStepSeconds: Math.round((Date.now() - stepEnteredAt) / 1000),
                documentsOutstanding: 2 - (state.documents || []).length
            }));
        });

        if (!state.productId || !window.MeridianCatalogData) {
            render();
            return;
        }

        window.MeridianCatalogData.getProductById(state.productId)
            .then(function (p) {
                product = p;
                var title = document.querySelector('[data-apply-title]');
                var intro = document.querySelector('[data-apply-intro]');
                if (p && title) title.textContent = 'Apply for the ' + p.name;
                if (p && intro) {
                    intro.textContent = 'Six steps, about ten minutes. You can stop at any point and we will save where you got to.';
                }
                render();
            })
            .catch(function () { render(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
