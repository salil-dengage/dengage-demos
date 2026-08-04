package com.dengagebanking.demo.events

import com.dengage.sdk.Dengage
import com.dengagebanking.demo.DengageKeys
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Date
import java.util.Locale

/* ============================================================================
   The app's event layer: a faithful port of banking/js/bankingEvents.js.

   NINE TABLES, 86 EVENT TYPES, EVERY COLUMN. The website and the app write the
   identical schema, and the only difference in any row is event_source, which
   is "android" here and "web" there. A segment built on web data therefore
   keeps working the moment the app starts feeding it, which is the entire
   reason the app sits in the same Dengage account.

   THE COLUMN NAMES ARE THE CONTRACT: only declared columns are stored, so
   every field here must match the table exactly. The first cut of this file
   sent card_id, card_last_four and category_path, none of which exist in the
   tables. They are card_id_masked, card_product and product_category. Do not
   rename a field here without changing the table.

   NO ec:* CALLS. A current account is not a basket. pageView is the one
   first-class call a bank can honestly use, and it is used.

   THREE RULES CARRIED OVER FROM THE WEB LAYER:

   1. Dates are yyyy-MM-dd (DATE) and yyyy-MM-dd HH:mm (DATETIME).
      No seconds, no T, no Z, no offset.
   2. Nulls are dropped, never coerced. A zero balance or a zero rate is a
      factual claim about an account, not "unknown".
   3. stock_count is never sent, under any name. A mortgage has no unit count.
   ========================================================================== */
object MeridianEvents {

    const val PRODUCT = "banking_product_events"
    const val TOOL = "banking_tool_events"
    const val APPLICATION = "banking_application_events"
    const val APPOINTMENT = "banking_appointment_events"
    const val ACCOUNT = "banking_account_events"
    const val TRANSACTION = "banking_transaction_events"
    const val CARD = "banking_card_events"
    const val WEALTH = "banking_wealth_events"
    const val ENGAGEMENT = "banking_engagement_events"

    val TABLES = listOf(
        ACCOUNT, APPLICATION, APPOINTMENT, CARD, ENGAGEMENT,
        PRODUCT, TOOL, TRANSACTION, WEALTH
    )

    @Volatile var isAuthenticated: Boolean = false
    @Volatile var customerTier: String = "prospect"
    @Volatile var currentScreen: String = DengageKeys.Screen.SIGN_IN

    /** Every row the layer sends, newest first. The in-app Events panel reads
     *  this so a demo can show the payload rather than describe it. */
    val log = ArrayDeque<String>()

    /** How many rows are still waiting to go out. The panel shows this so a
     *  batch that is still draining does not look like a batch that failed. */
    @Volatile var pending: Int = 0
        private set

    /* ONE QUEUE, OFF THE MAIN THREAD, PACED. Three separate problems on a real
       device all had the same root, so they have one fix.

       1. Screens fire up to nine events inside a LaunchedEffect; sending
          them on the main thread makes the first frame pay for it.
       2. Sending the whole catalogue in one burst floods the device's DNS
          resolver; paced batches keep every request healthy.
       3. Pacing the batch inside the UI's own coroutine scope meant anything
          that took the panel out of composition cancelled the rest of the run,
          silently and part-way through.

       So every send goes onto this channel and one consumer drains it with a
       gap between rows. Callers never block, the UI never stutters, the
       resolver is never flooded, and a batch survives navigation because the
       scope belongs to the layer rather than to a screen. */
    private const val GAP_MS = 120L

    private val queue = Channel<Triple<String, String, HashMap<String, Any>>>(Channel.UNLIMITED)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO).also { s ->
        s.launch {
            for ((table, eventType, payload) in queue) {
                try {
                    Dengage.sendDeviceEvent(table, payload)
                    synchronized(log) {
                        log.addFirst("$table · $eventType · ${payload.size} columns")
                        while (log.size > 60) log.removeLast()
                    }
                } catch (e: Throwable) {
                    synchronized(log) { log.addFirst("FAILED $table · $eventType · ${e.message}") }
                }
                pending = (pending - 1).coerceAtLeast(0)
                delay(GAP_MS)
            }
        }
    }

    // ------------------------------------------------------------ formatting

    private fun pad(n: Int) = if (n < 10) "0$n" else "$n"

    /** yyyy-MM-dd HH:mm. What a Dengage DATETIME column accepts, and nothing else. */
    fun toDengageDateTime(date: Date?): String? {
        if (date == null) return null
        val c = Calendar.getInstance().apply { time = date }
        return "${c.get(Calendar.YEAR)}-${pad(c.get(Calendar.MONTH) + 1)}-${pad(c.get(Calendar.DAY_OF_MONTH))}" +
            " ${pad(c.get(Calendar.HOUR_OF_DAY))}:${pad(c.get(Calendar.MINUTE))}"
    }

    /** yyyy-MM-dd. What a Dengage DATE column accepts. */
    fun toDengageDate(date: Date?): String? {
        if (date == null) return null
        val c = Calendar.getInstance().apply { time = date }
        return "${c.get(Calendar.YEAR)}-${pad(c.get(Calendar.MONTH) + 1)}-${pad(c.get(Calendar.DAY_OF_MONTH))}"
    }

    // ---------------------------------------------------------------- sender

    private fun common(eventType: String): MutableMap<String, Any?> = mutableMapOf(
        "event_type" to eventType,
        "event_source" to DengageKeys.EVENT_SOURCE,
        "page_path" to currentScreen,
        "is_authenticated" to isAuthenticated,
        "customer_tier" to customerTier
    )

    /** Drops nulls rather than sending them. An absent column is "unknown";
     *  a column sent as 0 or "" is a claim. */
    fun send(table: String, eventType: String, extra: Map<String, Any?> = emptyMap()) {
        val merged = common(eventType).apply { putAll(extra) }
        val payload = HashMap<String, Any>()
        merged.forEach { (k, v) -> if (v != null) payload[k] = v }
        pending += 1
        /* The payload is built on the caller's thread, on purpose: it reads
           screen state that only the main thread owns. Only the network hop
           is deferred. */
        queue.trySend(Triple(table, eventType, payload))
    }

    fun pageView(pageType: String, productId: String? = null, categoryPath: String? = null) {
        val data = HashMap<String, Any>()
        data["page_type"] = pageType
        productId?.let { data["product_id"] = it }
        categoryPath?.let { data["category_path"] = it }
        Dengage.pageView(data)
        synchronized(log) { log.addFirst("pageView · $pageType") }
    }

    /* Demo contacts whose Dengage contact_key is NOT their e-mail address.
       Ported from js/identity.js, which carries the same map, because a
       contact key can be anything and this account's is "salil-demo" while the
       e-mail is salil@dengage.com.

       Without this the app sets the contact key to the e-mail, the website
       sets it to salil-demo, and one person becomes two contacts. Everything
       the app and the site are meant to prove together, one journey across two
       channels, quietly stops being true. Add a line here and to
       js/identity.js together, never to one alone. */
    private val KNOWN_CONTACTS = mapOf(
        "salil@dengage.com" to "salil-demo"
    )

    /** Resolution order, first hit wins: a known demo contact, then the
     *  e-mail itself, which is the right default for a real signup. */
    fun normaliseContactKey(raw: String): String {
        val email = raw.trim().lowercase(Locale.UK)
        return KNOWN_CONTACTS[email] ?: email
    }

    // ========================================================== 1. product ==

    data class ProductInput(
        val productId: String? = null, val productName: String? = null,
        val productCategory: String? = null, val productSubtype: String? = null,
        val headlineRate: Double? = null, val rateType: String? = null,
        val termMonths: Int? = null, val feeAmount: Double? = null,
        val feeFrequency: String? = null, val minDepositPct: Double? = null
    ) {
        fun columns() = mapOf(
            "product_id" to productId, "product_name" to productName,
            "product_category" to productCategory, "product_subtype" to productSubtype,
            "headline_rate" to headlineRate, "rate_type" to rateType,
            "term_months" to termMonths, "fee_amount" to feeAmount,
            "fee_frequency" to feeFrequency, "min_deposit_pct" to minDepositPct
        )
    }

    object Product {
        fun event(type: String, p: ProductInput) = send(PRODUCT, type, p.columns())
        fun viewed(p: ProductInput, listName: String? = null, position: Int? = null) =
            send(PRODUCT, "product_viewed", p.columns() +
                mapOf("list_name" to listName, "position_in_list" to position))
        fun compared(p: ProductInput, others: List<String>) =
            send(PRODUCT, "product_compared", p.columns() + mapOf("compared_with" to others.joinToString(",")))
        fun shortlisted(p: ProductInput) = send(PRODUCT, "product_shortlisted", p.columns())
        fun unshortlisted(p: ProductInput) = send(PRODUCT, "product_unshortlisted", p.columns())
        /** The rate-drop trigger. A row here plus a later change to
         *  headline_rate is the whole campaign. */
        fun rateAlertSet(p: ProductInput) = send(PRODUCT, "rate_alert_set", p.columns())
        fun rateAlertCleared(p: ProductInput) = send(PRODUCT, "rate_alert_cleared", p.columns())
        fun brochureDownloaded(p: ProductInput) = send(PRODUCT, "brochure_downloaded", p.columns())
        fun shared(p: ProductInput) = send(PRODUCT, "product_shared", p.columns())
    }

    // ============================================================= 2. tool ==

    data class ToolInput(
        val toolName: String? = null, val productCategory: String? = null,
        val amount: Double? = null, val deposit: Double? = null,
        val termMonths: Int? = null, val incomeAnnual: Double? = null,
        val outgoingsMonthly: Double? = null, val rate: Double? = null,
        val monthlyPayment: Double? = null, val totalRepayable: Double? = null,
        val maxBorrow: Double? = null, val projectedValue: Double? = null,
        val loanToValuePct: Double? = null, val eligibilityOutcome: String? = null,
        val eligibilityScoreBand: String? = null, val completed: Boolean = true
    ) {
        fun columns() = mapOf(
            "tool_name" to toolName, "product_category" to productCategory,
            "input_amount" to amount, "input_deposit" to deposit,
            "input_term_months" to termMonths, "input_income_annual" to incomeAnnual,
            "input_outgoings_monthly" to outgoingsMonthly, "input_rate" to rate,
            "result_monthly_payment" to monthlyPayment, "result_total_repayable" to totalRepayable,
            "result_max_borrow" to maxBorrow, "result_projected_value" to projectedValue,
            "loan_to_value_pct" to loanToValuePct, "eligibility_outcome" to eligibilityOutcome,
            "eligibility_score_band" to eligibilityScoreBand, "completed" to completed
        )
    }

    /** Calculators and the eligibility checker. The richest table on the
     *  public site, because the customer volunteers their own numbers. */
    object Tool {
        fun event(type: String, t: ToolInput) = send(TOOL, type, t.columns())
        fun mortgageAffordability(t: ToolInput) = send(TOOL, "mortgage_affordability_calculated",
            t.copy(toolName = "mortgage_affordability", productCategory = "mortgage").columns())
        fun mortgageRepayment(t: ToolInput) = send(TOOL, "mortgage_repayment_calculated",
            t.copy(toolName = "mortgage_repayment", productCategory = "mortgage").columns())
        fun overpayment(t: ToolInput) = send(TOOL, "overpayment_calculated",
            t.copy(toolName = "overpayment", productCategory = "mortgage").columns())
        fun savingsGoal(t: ToolInput) = send(TOOL, "savings_goal_projected",
            t.copy(toolName = "savings_goal", productCategory = "savings").columns())
        fun isaProjection(t: ToolInput) = send(TOOL, "isa_projection_run",
            t.copy(toolName = "isa_projection", productCategory = "isa").columns())
        fun loanQuote(t: ToolInput) = send(TOOL, "loan_quote_generated",
            t.copy(toolName = "loan_quote", productCategory = "loan").columns())
        fun eligibilityStarted(t: ToolInput) = send(TOOL, "eligibility_check_started",
            t.copy(toolName = "eligibility_check", completed = false).columns())
        fun eligibilityCompleted(t: ToolInput) = send(TOOL, "eligibility_check_completed",
            t.copy(toolName = "eligibility_check", completed = true).columns())
        fun eligibilityAbandoned(t: ToolInput) = send(TOOL, "eligibility_check_abandoned",
            t.copy(toolName = "eligibility_check", completed = false).columns())
    }

    // ====================================================== 3. application ==

    data class ApplicationInput(
        val applicationId: String? = null, val productId: String? = null,
        val productCategory: String? = null, val stepName: String? = null,
        val stepIndex: Int? = null, val totalSteps: Int? = null,
        val timeOnStepSeconds: Int? = null, val requestedAmount: Double? = null,
        val requestedTermMonths: Int? = null, val decision: String? = null,
        val declineReasonCode: String? = null, val documentsOutstanding: Int? = null,
        val channelStarted: String? = null, val channelCompleted: String? = null,
        val abandonedAtStep: String? = null
    ) {
        fun columns() = mapOf(
            "application_id" to applicationId, "product_id" to productId,
            "product_category" to productCategory, "step_name" to stepName,
            "step_index" to stepIndex, "total_steps" to totalSteps,
            "time_on_step_seconds" to timeOnStepSeconds, "requested_amount" to requestedAmount,
            "requested_term_months" to requestedTermMonths, "decision" to decision,
            "decline_reason_code" to declineReasonCode, "documents_outstanding" to documentsOutstanding,
            "channel_started" to channelStarted, "channel_completed" to channelCompleted,
            "abandoned_at_step" to abandonedAtStep
        )
    }

    object Application {
        fun event(type: String, a: ApplicationInput) = send(APPLICATION, type, a.columns())
        /* channel_started and channel_completed are "android" here where the
           website sends "web". This is the column that answers "did they start
           on the phone and finish on the laptop", which is the whole reason a
           bank wants both channels in one account. */
        fun started(a: ApplicationInput) = send(APPLICATION, "application_started",
            a.copy(channelStarted = a.channelStarted ?: DengageKeys.EVENT_SOURCE).columns())
        fun stepCompleted(a: ApplicationInput) = send(APPLICATION, "step_completed", a.columns())
        fun stepAbandoned(a: ApplicationInput) = send(APPLICATION, "step_abandoned",
            a.copy(abandonedAtStep = a.abandonedAtStep ?: a.stepName).columns())
        fun documentUploaded(a: ApplicationInput) = send(APPLICATION, "document_uploaded", a.columns())
        fun documentRejected(a: ApplicationInput) = send(APPLICATION, "document_rejected", a.columns())
        fun submitted(a: ApplicationInput) = send(APPLICATION, "application_submitted",
            a.copy(channelCompleted = a.channelCompleted ?: DengageKeys.EVENT_SOURCE).columns())
        fun decisionReturned(a: ApplicationInput) = send(APPLICATION, "decision_returned", a.columns())
        fun offerAccepted(a: ApplicationInput) = send(APPLICATION, "offer_accepted", a.columns())
        fun offerDeclined(a: ApplicationInput) = send(APPLICATION, "offer_declined", a.columns())
        fun activated(a: ApplicationInput) = send(APPLICATION, "account_activated", a.columns())
        fun withdrawn(a: ApplicationInput) = send(APPLICATION, "application_withdrawn", a.columns())
    }

    // ====================================================== 4. appointment ==

    data class AppointmentInput(
        val appointmentId: String? = null, val appointmentType: String? = null,
        val appointmentChannel: String? = null, val branchName: String? = null,
        val branchCity: String? = null, val adviserName: String? = null,
        val scheduledAt: Date? = null, val leadTimeHours: Int? = null,
        val productCategory: String? = null
    ) {
        fun columns() = mapOf(
            "appointment_id" to appointmentId, "appointment_type" to appointmentType,
            "appointment_channel" to appointmentChannel, "branch_name" to branchName,
            "branch_city" to branchCity, "adviser_name" to adviserName,
            "scheduled_at" to toDengageDateTime(scheduledAt),
            "lead_time_hours" to leadTimeHours, "product_category" to productCategory
        )
    }

    object Appointment {
        fun event(type: String, a: AppointmentInput) = send(APPOINTMENT, type, a.columns())
        fun booked(a: AppointmentInput) = send(APPOINTMENT, "appointment_booked", a.columns())
        fun rescheduled(a: AppointmentInput) = send(APPOINTMENT, "appointment_rescheduled", a.columns())
        fun cancelled(a: AppointmentInput) = send(APPOINTMENT, "appointment_cancelled", a.columns())
        fun attended(a: AppointmentInput) = send(APPOINTMENT, "appointment_attended", a.columns())
        fun noShow(a: AppointmentInput) = send(APPOINTMENT, "appointment_no_show", a.columns())
    }

    // ========================================================== 5. account ==

    data class AccountInput(
        val accountIdMasked: String? = null, val accountType: String? = null,
        val balanceAmount: Double? = null, val balanceBand: String? = null,
        val availableBalance: Double? = null, val currency: String = "GBP",
        val overdraftLimit: Double? = null, val overdraftUsed: Double? = null,
        val daysSinceLastLogin: Int? = null, val goalName: String? = null,
        val goalTargetAmount: Double? = null, val goalProgressPct: Double? = null,
        val supportTopic: String? = null
    ) {
        fun columns() = mapOf(
            "account_id_masked" to accountIdMasked, "account_type" to accountType,
            "balance_amount" to balanceAmount,
            /* Banded as well as exact on purpose. A segment defined on an exact
               balance is unstable, because the balance moves hourly. */
            "balance_band" to balanceBand, "available_balance" to availableBalance,
            "currency" to currency, "overdraft_limit" to overdraftLimit,
            "overdraft_used" to overdraftUsed, "days_since_last_login" to daysSinceLastLogin,
            "goal_name" to goalName, "goal_target_amount" to goalTargetAmount,
            "goal_progress_pct" to goalProgressPct, "support_topic" to supportTopic
        )
    }

    object Account {
        fun event(type: String, a: AccountInput) = send(ACCOUNT, type, a.columns())
        fun opened(a: AccountInput) = send(ACCOUNT, "account_opened", a.columns())
        fun balanceViewed(a: AccountInput) = send(ACCOUNT, "balance_viewed", a.columns())
        fun lowBalance(a: AccountInput) = send(ACCOUNT, "low_balance_reached", a.columns())
        fun overdraftEntered(a: AccountInput) = send(ACCOUNT, "overdraft_entered", a.columns())
        fun overdraftExited(a: AccountInput) = send(ACCOUNT, "overdraft_exited", a.columns())
        fun salaryCredited(a: AccountInput) = send(ACCOUNT, "salary_credited", a.columns())
        fun goalCreated(a: AccountInput) = send(ACCOUNT, "savings_goal_created", a.columns())
        fun goalReached(a: AccountInput) = send(ACCOUNT, "savings_goal_reached", a.columns())
        fun roundUpEnabled(a: AccountInput) = send(ACCOUNT, "round_up_enabled", a.columns())
        fun roundUpDisabled(a: AccountInput) = send(ACCOUNT, "round_up_disabled", a.columns())
        fun statementViewed(a: AccountInput) = send(ACCOUNT, "statement_viewed", a.columns())
        fun documentDownloaded(a: AccountInput) = send(ACCOUNT, "document_downloaded", a.columns())
        fun supportContacted(a: AccountInput) = send(ACCOUNT, "support_contacted", a.columns())
        fun complaintRaised(a: AccountInput) = send(ACCOUNT, "complaint_raised", a.columns())
    }

    // ====================================================== 6. transaction ==

    data class TransactionInput(
        val transactionId: String? = null, val accountIdMasked: String? = null,
        val amount: Double? = null, val currency: String = "GBP",
        val direction: String? = null, val merchantName: String? = null,
        val merchantCategory: String? = null, val mcc: String? = null,
        val countryCode: String? = null, val isForeign: Boolean = false,
        val paymentChannel: String? = null, val payeeName: String? = null,
        val frequency: String? = null, val isRecurring: Boolean = false
    ) {
        fun columns() = mapOf(
            "transaction_id" to transactionId, "account_id_masked" to accountIdMasked,
            "amount" to amount, "currency" to currency, "direction" to direction,
            "merchant_name" to merchantName, "merchant_category" to merchantCategory,
            "mcc" to mcc, "country_code" to countryCode, "is_foreign" to isForeign,
            "payment_channel" to paymentChannel, "payee_name" to payeeName,
            "frequency" to frequency, "is_recurring" to isRecurring
        )
    }

    object Transaction {
        fun event(type: String, t: TransactionInput) = send(TRANSACTION, type, t.columns())
        fun posted(t: TransactionInput) = send(TRANSACTION, "transaction_posted", t.columns())
        fun paymentMade(t: TransactionInput) = send(TRANSACTION, "payment_made", t.columns())
        fun transferMade(t: TransactionInput) = send(TRANSACTION, "transfer_made", t.columns())
        fun paymentFailed(t: TransactionInput) = send(TRANSACTION, "payment_failed", t.columns())
        fun standingOrderCreated(t: TransactionInput) = send(TRANSACTION, "standing_order_created", t.columns())
        fun standingOrderCancelled(t: TransactionInput) = send(TRANSACTION, "standing_order_cancelled", t.columns())
        fun directDebitCreated(t: TransactionInput) = send(TRANSACTION, "direct_debit_created", t.columns())
        /** A cancelled mortgage direct debit is a churn alarm, not a campaign. */
        fun directDebitCancelled(t: TransactionInput) = send(TRANSACTION, "direct_debit_cancelled", t.columns())
        fun large(t: TransactionInput) = send(TRANSACTION, "large_transaction", t.columns())
        fun foreign(t: TransactionInput) = send(TRANSACTION, "foreign_transaction", t.copy(isForeign = true).columns())
    }

    // ============================================================= 7. card ==

    data class CardInput(
        val cardIdMasked: String? = null, val cardType: String? = null,
        val cardProduct: String? = null, val previousLimit: Double? = null,
        val newLimit: Double? = null, val freezeReason: String? = null,
        val walletType: String? = null, val travelCountry: String? = null,
        val travelStartDate: Date? = null, val travelEndDate: Date? = null
    ) {
        fun columns() = mapOf(
            "card_id_masked" to cardIdMasked, "card_type" to cardType,
            "card_product" to cardProduct, "previous_limit" to previousLimit,
            "new_limit" to newLimit, "freeze_reason" to freezeReason,
            "wallet_type" to walletType, "travel_country" to travelCountry,
            "travel_start_date" to toDengageDateTime(travelStartDate),
            "travel_end_date" to toDengageDateTime(travelEndDate)
        )
    }

    object Card {
        fun event(type: String, c: CardInput) = send(CARD, type, c.columns())
        fun viewed(c: CardInput) = send(CARD, "card_viewed", c.columns())
        fun frozen(c: CardInput) = send(CARD, "card_frozen", c.columns())
        fun unfrozen(c: CardInput) = send(CARD, "card_unfrozen", c.columns())
        fun pinViewed(c: CardInput) = send(CARD, "pin_viewed", c.columns())
        fun pinChanged(c: CardInput) = send(CARD, "pin_changed", c.columns())
        fun limitRequested(c: CardInput) = send(CARD, "limit_change_requested", c.columns())
        fun replaced(c: CardInput) = send(CARD, "card_replaced", c.columns())
        fun reportedLost(c: CardInput) = send(CARD, "card_reported_lost", c.columns())
        fun addedToWallet(c: CardInput) = send(CARD, "added_to_wallet", c.columns())
        fun contactlessToggled(c: CardInput) = send(CARD, "contactless_toggled", c.columns())
        /** The cleanest trigger on the site: a known destination and a known
         *  date range, so travel cover and foreign exchange are both timely. */
        fun travelNoticeSet(c: CardInput) = send(CARD, "travel_notice_set", c.columns())
    }

    // =========================================================== 8. wealth ==

    data class WealthInput(
        val portfolioId: String? = null, val portfolioValueBand: String? = null,
        val assetClass: String? = null, val holdingName: String? = null,
        val riskProfile: String? = null, val contributionAmount: Double? = null,
        val contributionFrequency: String? = null, val withdrawalAmount: Double? = null,
        val adviserName: String? = null, val performanceBand: String? = null
    ) {
        fun columns() = mapOf(
            "portfolio_id" to portfolioId,
            /* Banded, never exact. A demo showing a named customer's precise
               portfolio value reads badly, and banded is what a real
               deployment would segment on anyway. */
            "portfolio_value_band" to portfolioValueBand, "asset_class" to assetClass,
            "holding_name" to holdingName, "risk_profile" to riskProfile,
            "contribution_amount" to contributionAmount,
            "contribution_frequency" to contributionFrequency,
            "withdrawal_amount" to withdrawalAmount, "adviser_name" to adviserName,
            "performance_band" to performanceBand
        )
    }

    object Wealth {
        fun event(type: String, w: WealthInput) = send(WEALTH, type, w.columns())
        fun portfolioViewed(w: WealthInput) = send(WEALTH, "portfolio_viewed", w.columns())
        fun holdingViewed(w: WealthInput) = send(WEALTH, "holding_viewed", w.columns())
        fun rebalanceRequested(w: WealthInput) = send(WEALTH, "rebalance_requested", w.columns())
        fun contributionMade(w: WealthInput) = send(WEALTH, "contribution_made", w.columns())
        fun withdrawalRequested(w: WealthInput) = send(WEALTH, "withdrawal_requested", w.columns())
        fun adviserContacted(w: WealthInput) = send(WEALTH, "adviser_contacted", w.columns())
        fun riskProfileCompleted(w: WealthInput) = send(WEALTH, "risk_profile_completed", w.columns())
        fun reportDownloaded(w: WealthInput) = send(WEALTH, "report_downloaded", w.columns())
    }

    // ======================================================= 9. engagement ==

    data class EngagementInput(
        val offerId: String? = null, val offerCategory: String? = null,
        val placement: String? = null, val consentEmail: Boolean? = null,
        val consentSms: Boolean? = null, val consentPush: Boolean? = null,
        val consentProfiling: Boolean? = null, val campaignSlug: String? = null
    ) {
        fun columns() = mapOf(
            "offer_id" to offerId, "offer_category" to offerCategory,
            "placement" to placement, "consent_email" to consentEmail,
            "consent_sms" to consentSms, "consent_push" to consentPush,
            "consent_profiling" to consentProfiling, "campaign_slug" to campaignSlug
        )
    }

    object Engagement {
        fun event(type: String, e: EngagementInput) = send(ENGAGEMENT, type, e.columns())
        fun offerViewed(e: EngagementInput) = send(ENGAGEMENT, "offer_viewed", e.columns())
        fun offerAccepted(e: EngagementInput) = send(ENGAGEMENT, "offer_accepted", e.columns())
        fun offerDismissed(e: EngagementInput) = send(ENGAGEMENT, "offer_dismissed", e.columns())
        /* Consent is modelled explicitly because a UK bank cannot demo
           personalisation without being asked about it. Showing a preference
           change land as a row answers the question before it is asked. */
        fun preferenceUpdated(e: EngagementInput) = send(ENGAGEMENT, "preference_updated", e.columns())
        fun consentGranted(e: EngagementInput) = send(ENGAGEMENT, "consent_granted", e.columns())
        fun consentWithdrawn(e: EngagementInput) = send(ENGAGEMENT, "consent_withdrawn", e.columns())
        /* These four are the app's own, and have no web counterpart: a browser
           has no notification permission dialog and no In-App SDK. They are
           the reason the engagement table can answer "who has push on". */
        fun pushGranted(e: EngagementInput = EngagementInput()) = send(ENGAGEMENT, "push_permission_granted", e.columns())
        fun pushDenied(e: EngagementInput = EngagementInput()) = send(ENGAGEMENT, "push_permission_denied", e.columns())
        fun inappShown(e: EngagementInput) = send(ENGAGEMENT, "inapp_shown", e.columns())
        fun inappClicked(e: EngagementInput) = send(ENGAGEMENT, "inapp_clicked", e.columns())
    }

    /* Every event type this layer can write, table by table. The in-app Events
       panel is generated from this, and a unit test asserts it matches the
       website's list exactly, so the two channels cannot drift apart quietly. */
    val CATALOGUE: Map<String, List<String>> = mapOf(
        ACCOUNT to listOf(
            "account_opened", "balance_viewed", "low_balance_reached", "overdraft_entered",
            "overdraft_exited", "salary_credited", "savings_goal_created", "savings_goal_reached",
            "round_up_enabled", "round_up_disabled", "statement_viewed", "document_downloaded",
            "support_contacted", "complaint_raised"
        ),
        TRANSACTION to listOf(
            "transaction_posted", "payment_made", "transfer_made", "payment_failed",
            "standing_order_created", "standing_order_cancelled", "direct_debit_created",
            "direct_debit_cancelled", "large_transaction", "foreign_transaction"
        ),
        CARD to listOf(
            "card_viewed", "card_frozen", "card_unfrozen", "pin_viewed", "pin_changed",
            "limit_change_requested", "card_replaced", "card_reported_lost", "added_to_wallet",
            "contactless_toggled", "travel_notice_set"
        ),
        WEALTH to listOf(
            "portfolio_viewed", "holding_viewed", "rebalance_requested", "contribution_made",
            "withdrawal_requested", "adviser_contacted", "risk_profile_completed", "report_downloaded"
        ),
        PRODUCT to listOf(
            "product_viewed", "product_compared", "product_shortlisted", "product_unshortlisted",
            "rate_alert_set", "rate_alert_cleared", "brochure_downloaded", "product_shared"
        ),
        TOOL to listOf(
            "mortgage_affordability_calculated", "mortgage_repayment_calculated",
            "overpayment_calculated", "savings_goal_projected", "isa_projection_run",
            "loan_quote_generated", "eligibility_check_started", "eligibility_check_completed",
            "eligibility_check_abandoned"
        ),
        APPLICATION to listOf(
            "application_started", "step_completed", "step_abandoned", "document_uploaded",
            "document_rejected", "application_submitted", "decision_returned", "offer_accepted",
            "offer_declined", "account_activated", "application_withdrawn"
        ),
        APPOINTMENT to listOf(
            "appointment_booked", "appointment_rescheduled", "appointment_cancelled",
            "appointment_attended", "appointment_no_show"
        ),
        ENGAGEMENT to listOf(
            "offer_viewed", "offer_accepted", "offer_dismissed", "preference_updated",
            "consent_granted", "consent_withdrawn", "push_permission_granted",
            "push_permission_denied", "inapp_shown", "inapp_clicked"
        )
    )
}
