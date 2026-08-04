package com.dengagebanking.demo.events

import com.dengagebanking.demo.data.DemoData

/* ============================================================================
   Fully populated payloads, one per table.

   The point of this file is coverage. Ordinary use of the app writes the
   columns that a given screen happens to know about, which is honest but
   leaves most of a table's columns empty. A demo, and anyone checking the
   integration, needs to see every column of every table arrive at least once.

   So each builder below fills EVERY column its table has. Firing the whole
   catalogue writes all 86 event types across the nine tables with no null
   anywhere, which is what makes a table's structure visible in Data Space
   rather than something you have to take on trust.

   No new tables and no new columns: these are exactly the ones already
   created in the account, taken from banking/js/bankingEvents.js.
   ========================================================================== */
object EventSamples {

    private val product = MeridianEvents.ProductInput(
        productId = "mrt-first-home",
        productName = "First Home Fixed",
        productCategory = "mortgage",
        productSubtype = "first_time_buyer",
        headlineRate = 4.29,
        rateType = "fixed",
        termMonths = 60,
        feeAmount = 999.0,
        feeFrequency = "one_off",
        minDepositPct = 5.0
    )

    private val tool = MeridianEvents.ToolInput(
        toolName = "mortgage_affordability",
        productCategory = "mortgage",
        amount = 240000.0,
        deposit = 30000.0,
        termMonths = 300,
        incomeAnnual = 62000.0,
        outgoingsMonthly = 1450.0,
        rate = 4.29,
        monthlyPayment = 1180.0,
        totalRepayable = 354000.0,
        maxBorrow = 268000.0,
        projectedValue = 41200.0,
        loanToValuePct = 87.5,
        eligibilityOutcome = "likely",
        eligibilityScoreBand = "good",
        completed = true
    )

    private val application = MeridianEvents.ApplicationInput(
        applicationId = "APP-40271",
        productId = "mrt-first-home",
        productCategory = "mortgage",
        stepName = "affordability",
        stepIndex = 3,
        totalSteps = 6,
        timeOnStepSeconds = 94,
        requestedAmount = 210000.0,
        requestedTermMonths = 300,
        decision = "referred",
        declineReasonCode = "NONE",
        documentsOutstanding = 2,
        channelStarted = "android",
        channelCompleted = "android",
        abandonedAtStep = "affordability"
    )

    private val appointment = MeridianEvents.AppointmentInput(
        appointmentId = "APT-8830",
        appointmentType = "mortgage_review",
        appointmentChannel = "video",
        branchName = "Meridian Kensington",
        branchCity = "London",
        adviserName = DemoData.ADVISER,
        scheduledAt = DemoData.daysFromNow(3),
        leadTimeHours = 72,
        productCategory = "mortgage"
    )

    private val account = MeridianEvents.AccountInput(
        accountIdMasked = DemoData.currentAccount.masked,
        accountType = DemoData.currentAccount.type,
        balanceAmount = DemoData.currentAccount.balance,
        balanceBand = DemoData.balanceBand(DemoData.currentAccount.balance),
        availableBalance = DemoData.currentAccount.available,
        currency = "GBP",
        overdraftLimit = 500.0,
        overdraftUsed = 0.0,
        daysSinceLastLogin = 4,
        goalName = "Holiday",
        goalTargetAmount = 2500.0,
        goalProgressPct = 100.0,
        supportTopic = "card_dispute"
    )

    private val transaction = MeridianEvents.TransactionInput(
        transactionId = "txn-sample-1",
        accountIdMasked = DemoData.currentAccount.masked,
        amount = 48.20,
        currency = "GBP",
        direction = "debit",
        merchantName = "Le Petit Marche",
        merchantCategory = "groceries",
        mcc = "5411",
        countryCode = "FR",
        isForeign = true,
        paymentChannel = "card",
        payeeName = "Le Petit Marche",
        frequency = "one_off",
        isRecurring = false
    )

    private val card = MeridianEvents.CardInput(
        cardIdMasked = "****8820",
        cardType = "credit",
        cardProduct = "Meridian Platinum",
        previousLimit = 3000.0,
        newLimit = 4000.0,
        freezeReason = "customer_request",
        walletType = "google_pay",
        travelCountry = "FR",
        travelStartDate = DemoData.daysFromNow(14),
        travelEndDate = DemoData.daysFromNow(24)
    )

    private val wealth = MeridianEvents.WealthInput(
        portfolioId = DemoData.PORTFOLIO_ID,
        portfolioValueBand = DemoData.PORTFOLIO_VALUE_BAND,
        assetClass = "equity",
        holdingName = "Global Sustainable Fund",
        riskProfile = DemoData.RISK_PROFILE,
        contributionAmount = 500.0,
        contributionFrequency = "monthly",
        withdrawalAmount = 1500.0,
        adviserName = DemoData.ADVISER,
        performanceBand = DemoData.PERFORMANCE_BAND
    )

    private val engagement = MeridianEvents.EngagementInput(
        offerId = "OFR-2261",
        offerCategory = "consolidation",
        placement = "app_overview",
        consentEmail = true,
        consentSms = false,
        consentPush = true,
        consentProfiling = true,
        campaignSlug = "banking_portal_overdraft_habit"
    )

    /** Fire one event type with every column of its table populated. */
    fun fire(table: String, eventType: String) {
        when (table) {
            MeridianEvents.ACCOUNT -> MeridianEvents.Account.event(eventType, account)
            MeridianEvents.TRANSACTION -> MeridianEvents.Transaction.event(eventType, transaction)
            MeridianEvents.CARD -> MeridianEvents.Card.event(eventType, card)
            MeridianEvents.WEALTH -> MeridianEvents.Wealth.event(eventType, wealth)
            MeridianEvents.PRODUCT -> MeridianEvents.Product.event(eventType, product)
            MeridianEvents.TOOL -> MeridianEvents.Tool.event(eventType, tool)
            MeridianEvents.APPLICATION -> MeridianEvents.Application.event(eventType, application)
            MeridianEvents.APPOINTMENT -> MeridianEvents.Appointment.event(eventType, appointment)
            MeridianEvents.ENGAGEMENT -> MeridianEvents.Engagement.event(eventType, engagement)
        }
    }

    /* Pacing lives in MeridianEvents now, not here. Every send goes onto one
       background queue that drains with a gap between rows, so these can stay
       plain functions: they enqueue 86 rows in a few milliseconds and return,
       and the queue survives the panel leaving composition. The earlier
       version paced inside the UI's own coroutine scope, which meant anything
       that took the screen out of composition cancelled the rest of the batch
       part-way through, silently. */

    /** Every event type of one table. Returns how many were queued. */
    fun fireTable(table: String): Int {
        val types = MeridianEvents.CATALOGUE[table].orEmpty()
        types.forEach { fire(table, it) }
        return types.size
    }

    /** All 86, across all nine tables. The single most useful thing to press
     *  when someone asks whether the app really feeds everything the website
     *  does: it writes the whole schema from one device under one contact key.
     *  Queued instantly, delivered over about ten seconds. */
    fun fireEverything(): Int =
        MeridianEvents.CATALOGUE.keys.sumOf { fireTable(it) }

    val TOTAL_EVENT_TYPES: Int
        get() = MeridianEvents.CATALOGUE.values.sumOf { it.size }
}
