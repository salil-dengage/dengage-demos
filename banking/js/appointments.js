/* ============================================================================
   Appointment booking

   Writes banking_appointment_events appointment_booked.

   lead_time_hours is computed rather than collected, because it is what a
   reminder sequence keys on: a booking made three weeks out needs a different
   cadence from one made tomorrow morning.
   ========================================================================== */
(function () {
    'use strict';

    var ADVISERS = ['J. Okafor', 'R. Mehta', 'S. Caldwell', 'A. Lindqvist', 'M. Doyle'];

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    /* Default to 10:00 three working days out, which is what the copy on the
       page promises. Prefilling beats an empty datetime field nobody fills. */
    function defaultSlot() {
        var d = new Date();
        var added = 0;
        while (added < 3) {
            d.setDate(d.getDate() + 1);
            var day = d.getDay();
            if (day !== 0 && day !== 6) added += 1;
        }
        d.setHours(10, 0, 0, 0);
        return d;
    }

    function toLocalInputValue(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
             + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    }

    function formatWhen(date) {
        return date.toLocaleString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
            hour: '2-digit', minute: '2-digit'
        });
    }

    var TYPE_LABEL = {
        mortgage_advice: 'Mortgage advice',
        account_opening: 'Opening an account',
        wealth_review: 'Wealth or pension review',
        business_banking: 'Business banking',
        bereavement: 'Bereavement and probate'
    };

    var CHANNEL_LABEL = { branch: 'in branch', video: 'by video', phone: 'over the phone' };

    /* The product family the conversation is about, so an appointment can be
       joined to the products the same person was shortlisting. */
    var TYPE_CATEGORY = {
        mortgage_advice: 'mortgage',
        account_opening: 'current_account',
        wealth_review: 'wealth',
        business_banking: 'current_account',
        bereavement: null
    };

    function init() {
        var form = document.getElementById('appointmentForm');
        var button = document.getElementById('appointmentSubmit');
        var out = document.getElementById('appointmentResult');
        if (!form || !button || !out) return;

        var dateField = form.elements.scheduledAt;
        if (dateField && !dateField.value) dateField.value = toLocalInputValue(defaultSlot());

        button.addEventListener('click', function () {
            var type = form.elements.appointmentType.value;
            var channel = form.elements.appointmentChannel.value;
            var branchPair = String(form.elements.branch.value || '').split('|');
            var branchName = branchPair[0] || '';
            var branchCity = branchPair[1] || '';

            var when = dateField && dateField.value ? new Date(dateField.value) : null;
            if (!when || isNaN(when.getTime())) {
                out.innerHTML = '<p class="calc-note calc-note-warn">Please choose a date and time.</p>';
                return;
            }

            var leadHours = Math.max(0, Math.round((when.getTime() - Date.now()) / 3600000));
            var adviser = ADVISERS[Math.floor(when.getTime() / 3600000) % ADVISERS.length];
            var appointmentId = 'APT-' + String(Date.now()).slice(-6);

            out.innerHTML = ''
                + '<div class="calc-headline"><span class="calc-headline-label">Appointment booked</span>'
                + '<span class="calc-headline-value">' + formatWhen(when) + '</span></div>'
                + '<dl class="calc-breakdown">'
                + '<div><dt>Subject</dt><dd>' + (TYPE_LABEL[type] || type) + '</dd></div>'
                + '<div><dt>How</dt><dd>' + (CHANNEL_LABEL[channel] || channel)
                + (channel === 'branch' ? ', ' + branchName : '') + '</dd></div>'
                + '<div><dt>Your adviser</dt><dd>' + adviser + '</dd></div>'
                + '<div><dt>Reference</dt><dd>' + appointmentId + '</dd></div>'
                + '</dl>'
                + '<p class="calc-note">We will send a confirmation and a reminder the day before. '
                + 'Nothing is actually booked on this demo site.</p>';

            if (!window.MeridianEvents) return;
            window.MeridianEvents.appointment.booked({
                appointmentId: appointmentId,
                appointmentType: type,
                appointmentChannel: channel,
                branchName: branchName,
                branchCity: branchCity,
                adviserName: adviser,
                /* The Date object, not an ISO string: js/bankingEvents.js
                   formats it to the YYYY-MM-DD HH:mm the platform requires. */
                scheduledAt: when,
                leadTimeHours: leadHours,
                productCategory: TYPE_CATEGORY[type] || null
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
