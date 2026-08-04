/* ============================================================================
   Meridian Bank event layer

   Every custom event on this site goes through here. One module, so the
   column names in docs/EVENT-CATALOGUE.md exist in exactly one place and a
   page cannot invent its own spelling of customer_tier.

   WHY THERE ARE NO ec:* CALLS ON THIS SITE

   A mortgage is not a basket item. The ecommerce tables model quantity, unit
   price and a cart, none of which describe a bank product, and a credit card
   sitting in shopping_cart_events with a quantity of 1 is exactly the detail
   a banking prospect notices. So the application funnel writes to
   banking_application_events with step-level columns instead, which is also
   the shape the interesting campaigns need: abandonment at identity
   verification is a different message from abandonment at income.

   pageView is the deliberate exception and still fires from js/pageView.js.
   It fills page_view_events, and it is the trigger the On-Site scenarios
   listen for. Removing it would take every scenario dark.

   WHAT THE SDK FILLS IN
   key (contact key), event_date and session_id are added by the SDK. Do not
   send them here; a column sent twice is not a merge.

   NOTHING HERE SENDS stock_count, under any name. A card, a loan and a
   mortgage have no unit count, and a fabricated figure poisons every segment
   built on it. See CLAUDE.md §3.11.

   A 200 FROM THE EVENT API MEANS ACCEPTED. PROVING AN EVENT LANDED means
   finding the row in Data Space, not watching the network tab.
   ========================================================================== */
(function () {
    'use strict';

    /* The nine custom tables. banking_onsite_events is not here: it belongs to
       the scenario widgets and is sent by js/meridianCatalog.js. */
    var TABLES = {
        product:     'banking_product_events',
        tool:        'banking_tool_events',
        application: 'banking_application_events',
        appointment: 'banking_appointment_events',
        account:     'banking_account_events',
        transaction: 'banking_transaction_events',
        card:        'banking_card_events',
        wealth:      'banking_wealth_events',
        engagement:  'banking_engagement_events'
    };

    var USER_STORE = 'meridian_user';

    /* ---------------------------------------------------------------- helpers */

    /* Absent, null and '' must all stay null. Number(null) is 0, and a 0 rate
       or a 0 balance is a factual claim rather than "not known". Idempotent on
       purpose: several of these payloads are built from already-normalized
       catalogue objects, so the function runs over its own output. */
    function numOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    /* Dengage DATE is YYYY-MM-DD and DATETIME is YYYY-MM-DD HH:mm (Data
       Space reference, "Data Types"):

           DATE      YYYY-MM-DD              2024-12-18
           DATETIME  YYYY-MM-DD HH:mm        2025-12-31 15:30

       Space separator, no seconds, no T, no Z, no timezone offset.

       Formatting lives here so no page can invent its own shape. Every
       datetime column on this site goes through toDengageDateTime. */
    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function asDate(value) {
        if (value === null || value === undefined || value === '') return null;
        var d = value instanceof Date ? value : new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    function toDengageDateTime(value) {
        var d = asDate(value);
        if (!d) return null;
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
             + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function toDengageDate(value) {
        var d = asDate(value);
        if (!d) return null;
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function readUser() {
        try {
            var raw = window.localStorage.getItem(USER_STORE);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    }

    /* The five columns every banking_* table carries. Declared once so a page
       cannot spell customer_tier three different ways. */
    function common(eventType) {
        var user = readUser();
        return {
            event_type: eventType,
            event_source: 'web',
            page_path: (window.location.pathname || '') + (window.location.search || ''),
            is_authenticated: !!(user && user.email),
            customer_tier: (user && user.tier) || 'prospect'
        };
    }

    /* Drop nulls and undefined before sending. A null column is a stored
       null, and a table full of nulls reads as poor data rather than as
       absent data. */
    function compact(payload) {
        var out = {};
        Object.keys(payload).forEach(function (key) {
            var value = payload[key];
            if (value === null || value === undefined || value === '') return;
            out[key] = value;
        });
        return out;
    }

    function send(table, eventType, extra) {
        var payload = compact(Object.assign(common(eventType), extra || {}));
        try {
            if (typeof window.dengage === 'function') {
                window.dengage('sendDeviceEvent', table, payload);
            } else {
                console.log('Dengage sendDeviceEvent ' + table + ' (mock):', payload);
            }
        } catch (err) {
            console.error('sendDeviceEvent ' + table + ' failed', err);
        }
        return payload;
    }

    /* Catalogue product to the columns banking_product_events declares. The
       field names match the feed, so this is a copy and not a translation. */
    function productColumns(product) {
        if (!product) return {};
        return {
            product_id: product.id,
            product_name: product.name,
            product_category: product.category,
            product_subtype: product.subtype,
            headline_rate: numOrNull(product.headlineRate),
            rate_type: product.rateType,
            term_months: numOrNull(product.termMonths),
            fee_amount: numOrNull(product.feeAmount),
            fee_frequency: product.feeFrequency,
            min_deposit_pct: numOrNull(product.minDepositPct)
        };
    }

    /* ------------------------------------------------------------- 1. product */

    var product = {
        viewed: function (p, context) {
            context = context || {};
            return send(TABLES.product, 'product_viewed', Object.assign(productColumns(p), {
                list_name: context.listName,
                position_in_list: numOrNull(context.position)
            }));
        },
        compared: function (p, others) {
            return send(TABLES.product, 'product_compared', Object.assign(productColumns(p), {
                compared_with: (others || []).join(',')
            }));
        },
        shortlisted: function (p) {
            return send(TABLES.product, 'product_shortlisted', productColumns(p));
        },
        unshortlisted: function (p) {
            return send(TABLES.product, 'product_unshortlisted', productColumns(p));
        },
        /* The rate-drop trigger. A row here plus a later change to
           headline_rate is the whole campaign. */
        rateAlertSet: function (p) {
            return send(TABLES.product, 'rate_alert_set', productColumns(p));
        },
        rateAlertCleared: function (p) {
            return send(TABLES.product, 'rate_alert_cleared', productColumns(p));
        },
        brochureDownloaded: function (p) {
            return send(TABLES.product, 'brochure_downloaded', productColumns(p));
        },
        shared: function (p) {
            return send(TABLES.product, 'product_shared', productColumns(p));
        }
    };

    /* ---------------------------------------------------------------- 2. tool */

    /* Calculators and the eligibility checker. The richest table on the public
       site, because the customer volunteers their own numbers. */
    function toolColumns(input) {
        input = input || {};
        return {
            tool_name: input.toolName,
            product_category: input.productCategory,
            input_amount: numOrNull(input.amount),
            input_deposit: numOrNull(input.deposit),
            input_term_months: numOrNull(input.termMonths),
            input_income_annual: numOrNull(input.incomeAnnual),
            input_outgoings_monthly: numOrNull(input.outgoingsMonthly),
            input_rate: numOrNull(input.rate),
            result_monthly_payment: numOrNull(input.monthlyPayment),
            result_total_repayable: numOrNull(input.totalRepayable),
            result_max_borrow: numOrNull(input.maxBorrow),
            result_projected_value: numOrNull(input.projectedValue),
            loan_to_value_pct: numOrNull(input.loanToValuePct),
            eligibility_outcome: input.eligibilityOutcome,
            eligibility_score_band: input.eligibilityScoreBand,
            completed: input.completed !== false
        };
    }

    var tool = {
        calculated: function (eventType, input) {
            return send(TABLES.tool, eventType, toolColumns(input));
        },
        mortgageAffordability: function (input) {
            return send(TABLES.tool, 'mortgage_affordability_calculated',
                toolColumns(Object.assign({ toolName: 'mortgage_affordability', productCategory: 'mortgage' }, input)));
        },
        mortgageRepayment: function (input) {
            return send(TABLES.tool, 'mortgage_repayment_calculated',
                toolColumns(Object.assign({ toolName: 'mortgage_repayment', productCategory: 'mortgage' }, input)));
        },
        overpayment: function (input) {
            return send(TABLES.tool, 'overpayment_calculated',
                toolColumns(Object.assign({ toolName: 'overpayment', productCategory: 'mortgage' }, input)));
        },
        savingsGoal: function (input) {
            return send(TABLES.tool, 'savings_goal_projected',
                toolColumns(Object.assign({ toolName: 'savings_goal', productCategory: 'savings' }, input)));
        },
        isaProjection: function (input) {
            return send(TABLES.tool, 'isa_projection_run',
                toolColumns(Object.assign({ toolName: 'isa_projection', productCategory: 'isa' }, input)));
        },
        loanQuote: function (input) {
            return send(TABLES.tool, 'loan_quote_generated',
                toolColumns(Object.assign({ toolName: 'loan_quote', productCategory: 'loan' }, input)));
        },
        eligibilityStarted: function (input) {
            return send(TABLES.tool, 'eligibility_check_started',
                toolColumns(Object.assign({ toolName: 'eligibility_check', completed: false }, input)));
        },
        eligibilityCompleted: function (input) {
            return send(TABLES.tool, 'eligibility_check_completed',
                toolColumns(Object.assign({ toolName: 'eligibility_check', completed: true }, input)));
        },
        eligibilityAbandoned: function (input) {
            return send(TABLES.tool, 'eligibility_check_abandoned',
                toolColumns(Object.assign({ toolName: 'eligibility_check', completed: false }, input)));
        }
    };

    /* --------------------------------------------------------- 3. application */

    function applicationColumns(a) {
        a = a || {};
        return {
            application_id: a.applicationId,
            product_id: a.productId,
            product_category: a.productCategory,
            step_name: a.stepName,
            step_index: numOrNull(a.stepIndex),
            total_steps: numOrNull(a.totalSteps),
            time_on_step_seconds: numOrNull(a.timeOnStepSeconds),
            requested_amount: numOrNull(a.requestedAmount),
            requested_term_months: numOrNull(a.requestedTermMonths),
            decision: a.decision,
            decline_reason_code: a.declineReasonCode,
            documents_outstanding: numOrNull(a.documentsOutstanding),
            channel_started: a.channelStarted,
            channel_completed: a.channelCompleted,
            abandoned_at_step: a.abandonedAtStep
        };
    }

    var application = {
        started: function (a) {
            return send(TABLES.application, 'application_started',
                applicationColumns(Object.assign({ channelStarted: 'web' }, a)));
        },
        stepCompleted: function (a) {
            return send(TABLES.application, 'step_completed', applicationColumns(a));
        },
        stepAbandoned: function (a) {
            return send(TABLES.application, 'step_abandoned',
                applicationColumns(Object.assign({ abandonedAtStep: a && a.stepName }, a)));
        },
        documentUploaded: function (a) {
            return send(TABLES.application, 'document_uploaded', applicationColumns(a));
        },
        documentRejected: function (a) {
            return send(TABLES.application, 'document_rejected', applicationColumns(a));
        },
        submitted: function (a) {
            return send(TABLES.application, 'application_submitted',
                applicationColumns(Object.assign({ channelCompleted: 'web' }, a)));
        },
        decisionReturned: function (a) {
            return send(TABLES.application, 'decision_returned', applicationColumns(a));
        },
        offerAccepted: function (a) {
            return send(TABLES.application, 'offer_accepted', applicationColumns(a));
        },
        offerDeclined: function (a) {
            return send(TABLES.application, 'offer_declined', applicationColumns(a));
        },
        activated: function (a) {
            return send(TABLES.application, 'account_activated', applicationColumns(a));
        },
        withdrawn: function (a) {
            return send(TABLES.application, 'application_withdrawn', applicationColumns(a));
        }
    };

    /* --------------------------------------------------------- 4. appointment */

    function appointmentColumns(a) {
        a = a || {};
        return {
            appointment_id: a.appointmentId,
            appointment_type: a.appointmentType,
            appointment_channel: a.appointmentChannel,
            branch_name: a.branchName,
            branch_city: a.branchCity,
            adviser_name: a.adviserName,
            scheduled_at: toDengageDateTime(a.scheduledAt),
            lead_time_hours: numOrNull(a.leadTimeHours),
            product_category: a.productCategory
        };
    }

    var appointment = {
        booked:      function (a) { return send(TABLES.appointment, 'appointment_booked', appointmentColumns(a)); },
        rescheduled: function (a) { return send(TABLES.appointment, 'appointment_rescheduled', appointmentColumns(a)); },
        cancelled:   function (a) { return send(TABLES.appointment, 'appointment_cancelled', appointmentColumns(a)); },
        attended:    function (a) { return send(TABLES.appointment, 'appointment_attended', appointmentColumns(a)); },
        noShow:      function (a) { return send(TABLES.appointment, 'appointment_no_show', appointmentColumns(a)); }
    };

    /* ------------------------------------------------------------- 5. account */

    function accountColumns(a) {
        a = a || {};
        return {
            account_id_masked: a.accountIdMasked,
            account_type: a.accountType,
            balance_amount: numOrNull(a.balanceAmount),
            /* Banded as well as exact on purpose. A segment defined on an exact
               balance is unstable, because the balance moves hourly. */
            balance_band: a.balanceBand,
            available_balance: numOrNull(a.availableBalance),
            currency: a.currency || 'GBP',
            overdraft_limit: numOrNull(a.overdraftLimit),
            overdraft_used: numOrNull(a.overdraftUsed),
            days_since_last_login: numOrNull(a.daysSinceLastLogin),
            goal_name: a.goalName,
            goal_target_amount: numOrNull(a.goalTargetAmount),
            goal_progress_pct: numOrNull(a.goalProgressPct),
            support_topic: a.supportTopic
        };
    }

    var account = {
        event: function (eventType, a) { return send(TABLES.account, eventType, accountColumns(a)); },
        opened:            function (a) { return send(TABLES.account, 'account_opened', accountColumns(a)); },
        balanceViewed:     function (a) { return send(TABLES.account, 'balance_viewed', accountColumns(a)); },
        lowBalance:        function (a) { return send(TABLES.account, 'low_balance_reached', accountColumns(a)); },
        overdraftEntered:  function (a) { return send(TABLES.account, 'overdraft_entered', accountColumns(a)); },
        overdraftExited:   function (a) { return send(TABLES.account, 'overdraft_exited', accountColumns(a)); },
        salaryCredited:    function (a) { return send(TABLES.account, 'salary_credited', accountColumns(a)); },
        goalCreated:       function (a) { return send(TABLES.account, 'savings_goal_created', accountColumns(a)); },
        goalReached:       function (a) { return send(TABLES.account, 'savings_goal_reached', accountColumns(a)); },
        roundUpEnabled:    function (a) { return send(TABLES.account, 'round_up_enabled', accountColumns(a)); },
        roundUpDisabled:   function (a) { return send(TABLES.account, 'round_up_disabled', accountColumns(a)); },
        statementViewed:   function (a) { return send(TABLES.account, 'statement_viewed', accountColumns(a)); },
        documentDownloaded:function (a) { return send(TABLES.account, 'document_downloaded', accountColumns(a)); },
        supportContacted:  function (a) { return send(TABLES.account, 'support_contacted', accountColumns(a)); },
        complaintRaised:   function (a) { return send(TABLES.account, 'complaint_raised', accountColumns(a)); }
    };

    /* --------------------------------------------------------- 6. transaction */

    function transactionColumns(t) {
        t = t || {};
        return {
            transaction_id: t.transactionId,
            account_id_masked: t.accountIdMasked,
            amount: numOrNull(t.amount),
            currency: t.currency || 'GBP',
            direction: t.direction,
            merchant_name: t.merchantName,
            merchant_category: t.merchantCategory,
            mcc: t.mcc,
            country_code: t.countryCode,
            is_foreign: t.isForeign === true,
            payment_channel: t.paymentChannel,
            payee_name: t.payeeName,
            frequency: t.frequency,
            is_recurring: t.isRecurring === true
        };
    }

    var transaction = {
        event: function (eventType, t) { return send(TABLES.transaction, eventType, transactionColumns(t)); },
        posted:              function (t) { return send(TABLES.transaction, 'transaction_posted', transactionColumns(t)); },
        paymentMade:         function (t) { return send(TABLES.transaction, 'payment_made', transactionColumns(t)); },
        transferMade:        function (t) { return send(TABLES.transaction, 'transfer_made', transactionColumns(t)); },
        paymentFailed:       function (t) { return send(TABLES.transaction, 'payment_failed', transactionColumns(t)); },
        standingOrderCreated:function (t) { return send(TABLES.transaction, 'standing_order_created', transactionColumns(t)); },
        standingOrderCancelled:function (t) { return send(TABLES.transaction, 'standing_order_cancelled', transactionColumns(t)); },
        directDebitCreated:  function (t) { return send(TABLES.transaction, 'direct_debit_created', transactionColumns(t)); },
        /* A cancelled mortgage direct debit is a churn alarm, not a campaign. */
        directDebitCancelled:function (t) { return send(TABLES.transaction, 'direct_debit_cancelled', transactionColumns(t)); },
        large:               function (t) { return send(TABLES.transaction, 'large_transaction', transactionColumns(t)); },
        foreign:             function (t) { return send(TABLES.transaction, 'foreign_transaction',
                                    transactionColumns(Object.assign({ isForeign: true }, t))); }
    };

    /* ---------------------------------------------------------------- 7. card */

    function cardColumns(c) {
        c = c || {};
        return {
            card_id_masked: c.cardIdMasked,
            card_type: c.cardType,
            card_product: c.cardProduct,
            previous_limit: numOrNull(c.previousLimit),
            new_limit: numOrNull(c.newLimit),
            freeze_reason: c.freezeReason,
            wallet_type: c.walletType,
            travel_country: c.travelCountry,
            travel_start_date: toDengageDateTime(c.travelStartDate),
            travel_end_date: toDengageDateTime(c.travelEndDate)
        };
    }

    var card = {
        event: function (eventType, c) { return send(TABLES.card, eventType, cardColumns(c)); },
        viewed:          function (c) { return send(TABLES.card, 'card_viewed', cardColumns(c)); },
        frozen:          function (c) { return send(TABLES.card, 'card_frozen', cardColumns(c)); },
        unfrozen:        function (c) { return send(TABLES.card, 'card_unfrozen', cardColumns(c)); },
        pinViewed:       function (c) { return send(TABLES.card, 'pin_viewed', cardColumns(c)); },
        pinChanged:      function (c) { return send(TABLES.card, 'pin_changed', cardColumns(c)); },
        limitRequested:  function (c) { return send(TABLES.card, 'limit_change_requested', cardColumns(c)); },
        replaced:        function (c) { return send(TABLES.card, 'card_replaced', cardColumns(c)); },
        reportedLost:    function (c) { return send(TABLES.card, 'card_reported_lost', cardColumns(c)); },
        addedToWallet:   function (c) { return send(TABLES.card, 'added_to_wallet', cardColumns(c)); },
        contactlessToggled: function (c) { return send(TABLES.card, 'contactless_toggled', cardColumns(c)); },
        /* The cleanest trigger on the site: a known destination and a known
           date range, so travel cover and foreign exchange are both timely. */
        travelNoticeSet: function (c) { return send(TABLES.card, 'travel_notice_set', cardColumns(c)); }
    };

    /* -------------------------------------------------------------- 8. wealth */

    function wealthColumns(w) {
        w = w || {};
        return {
            portfolio_id: w.portfolioId,
            /* Banded, never exact. A demo that shows a named customer's precise
               portfolio value reads badly, and banded is what a real
               deployment would segment on anyway. */
            portfolio_value_band: w.portfolioValueBand,
            asset_class: w.assetClass,
            holding_name: w.holdingName,
            risk_profile: w.riskProfile,
            contribution_amount: numOrNull(w.contributionAmount),
            contribution_frequency: w.contributionFrequency,
            withdrawal_amount: numOrNull(w.withdrawalAmount),
            adviser_name: w.adviserName,
            performance_band: w.performanceBand
        };
    }

    var wealth = {
        event: function (eventType, w) { return send(TABLES.wealth, eventType, wealthColumns(w)); },
        portfolioViewed:    function (w) { return send(TABLES.wealth, 'portfolio_viewed', wealthColumns(w)); },
        holdingViewed:      function (w) { return send(TABLES.wealth, 'holding_viewed', wealthColumns(w)); },
        rebalanceRequested: function (w) { return send(TABLES.wealth, 'rebalance_requested', wealthColumns(w)); },
        contributionMade:   function (w) { return send(TABLES.wealth, 'contribution_made', wealthColumns(w)); },
        withdrawalRequested:function (w) { return send(TABLES.wealth, 'withdrawal_requested', wealthColumns(w)); },
        adviserContacted:   function (w) { return send(TABLES.wealth, 'adviser_contacted', wealthColumns(w)); },
        riskProfileCompleted:function (w) { return send(TABLES.wealth, 'risk_profile_completed', wealthColumns(w)); },
        reportDownloaded:   function (w) { return send(TABLES.wealth, 'report_downloaded', wealthColumns(w)); }
    };

    /* ---------------------------------------------------------- 9. engagement */

    function engagementColumns(e) {
        e = e || {};
        return {
            offer_id: e.offerId,
            offer_category: e.offerCategory,
            placement: e.placement,
            consent_email: e.consentEmail,
            consent_sms: e.consentSms,
            consent_push: e.consentPush,
            consent_profiling: e.consentProfiling,
            campaign_slug: e.campaignSlug
        };
    }

    var engagement = {
        event: function (eventType, e) { return send(TABLES.engagement, eventType, engagementColumns(e)); },
        offerViewed:     function (e) { return send(TABLES.engagement, 'offer_viewed', engagementColumns(e)); },
        offerAccepted:   function (e) { return send(TABLES.engagement, 'offer_accepted', engagementColumns(e)); },
        offerDismissed:  function (e) { return send(TABLES.engagement, 'offer_dismissed', engagementColumns(e)); },
        /* Consent is modelled explicitly because a UK bank cannot demo
           personalisation without being asked about it. Showing a preference
           change land as a row answers the question before it is asked. */
        preferenceUpdated: function (e) { return send(TABLES.engagement, 'preference_updated', engagementColumns(e)); },
        consentGranted:    function (e) { return send(TABLES.engagement, 'consent_granted', engagementColumns(e)); },
        consentWithdrawn:  function (e) { return send(TABLES.engagement, 'consent_withdrawn', engagementColumns(e)); },
        pushGranted:       function (e) { return send(TABLES.engagement, 'push_permission_granted', engagementColumns(e)); },
        pushDenied:        function (e) { return send(TABLES.engagement, 'push_permission_denied', engagementColumns(e)); },
        inappShown:        function (e) { return send(TABLES.engagement, 'inapp_shown', engagementColumns(e)); },
        inappClicked:      function (e) { return send(TABLES.engagement, 'inapp_clicked', engagementColumns(e)); }
    };

    window.MeridianEvents = {
        TABLES: TABLES,
        send: send,
        /* Exposed so a page building its own payload cannot reinvent the
           format. There is exactly one correct shape. */
        toDengageDateTime: toDengageDateTime,
        toDengageDate: toDengageDate,
        product: product,
        tool: tool,
        application: application,
        appointment: appointment,
        account: account,
        transaction: transaction,
        card: card,
        wealth: wealth,
        engagement: engagement
    };
})();
