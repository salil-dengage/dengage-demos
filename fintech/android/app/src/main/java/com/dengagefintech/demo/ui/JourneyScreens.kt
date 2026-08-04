package com.dengagefintech.demo.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengagefintech.demo.*

/* ============================================================================
   THE FIVE NOVAPAY JOURNEYS

   Send money, top up, verify identity, apply for a plan, raise a dispute.

   WHY A JOURNEY AND NOT ANOTHER BUTTON. The Test Area already fires one sample
   row per table, which proves the plumbing and nothing else. What a prospect
   asks about is the shape a real customer leaves behind: several rows, in
   order, sharing one reference, ending either in a completion or in the exact
   failure a campaign is supposed to answer. That is what these screens write.

   EVERY ROW HERE USES A TABLE AND AN EVENT TYPE THAT ALREADY EXISTS in
   fintech/EVENT-MODEL.md. Nothing was added for the sake of a nicer screen. A
   journey that needed a new event type would be a journey that does not fit
   the model, and the model is the thing the customer is buying.

   WHICH MEANS SOME STEPS WRITE NOTHING, AND SAY SO. A transfer has one event,
   transfer_sent, fired when the money moves. There is no transfer_started,
   deliberately: a row in fintech_transaction_events is money that moved, and
   filling the table with intentions would make every total, every fee sum and
   every "has transacted" segment wrong. So the amount and recipient steps show
   "writes nothing" on screen. The honest answer to "how do I retarget someone
   who abandoned a transfer" is a page view or an In-App impression, not a
   fabricated transaction.

   THE FAILURE BRANCH IS THE POINT OF EACH ONE. A demo that only ever shows the
   happy path cannot show a campaign, because there is nothing to recover:

     send money      transaction_failed, failure_reason insufficient_funds
     top up          transaction_failed, failure_reason limit_exceeded
     verify identity kyc_abandoned, naming the step reached
     apply           application_abandoned, with abandon_step
     dispute         case_updated, resolution_status awaiting_customer

   ONE REFERENCE PER RUN. Each journey mints a single id at the start and every
   row of that run carries it: transaction_id, application_id, case_id. That is
   what lets the dispute journey link to the transaction it disputes, which is
   the one fact-to-fact relation the model defines.

   THE SCREEN NAMES ARE In-App TARGETS TOO. Each journey reports its own screen
   name, so a campaign can be aimed at the moment a customer is halfway through
   a transfer or stuck on a document upload, which is where an In-App earns its
   place.
   ========================================================================== */

/**
 * @param key    what an abandonment names as the step reached. Comes from the
 *               model's own vocabulary, so nothing is retyped in the branch.
 * @param writes the event type this step fires, or null when the step
 *               deliberately writes nothing.
 * @param send   fires the row, given the run's shared reference id.
 */
data class JourneyStep(
    val key: String,
    val label: String,
    val detail: String,
    val writes: String?,
    val send: (String) -> Unit = {},
)

data class Journey(
    val screen: String,
    val title: String,
    val blurb: String,
    val table: String,
    val steps: List<JourneyStep>,
    val branchLabel: String,
    val branchNote: String,
    /** Given the run's reference and the step reached, writes the branch row. */
    val branch: (String, JourneyStep) -> Unit,
)

object Journeys {

    /** One id per run, so every row of that run groups together. */
    fun ref(prefix: String): String = prefix + "-" + System.currentTimeMillis()

    /* ------------------------------------------------------------ send money
       An international transfer, because that is where a money app's columns
       earn their keep: currency_from, currency_to, country_to, fx_rate and fee
       are all real and all sent. */
    private const val SEND_AMOUNT = 240.00
    private const val SEND_RATE = 0.92

    private fun sendMoney() = Journey(
        screen = Screen.SEND_MONEY,
        title = "Send money",
        blurb = "An international transfer, so the FX columns are exercised rather " +
                "than left null. Only the confirmation writes a row.",
        table = Events.Tables.TRANSACTION,
        steps = listOf(
            JourneyStep("amount_entered", "Enter the amount",
                "$${"%,.2f".format(SEND_AMOUNT)} to euros", null),
            JourneyStep("recipient_chosen", "Choose the recipient",
                "Marta Ruiz, Spain", null),
            JourneyStep("confirmed", "Confirm and send",
                "the money moves, and the row follows it", "transfer_sent") { id ->
                Events.transaction("transfer_sent", mapOf(
                    "transaction_id" to id,
                    "transaction_type" to "transfer_out",
                    "amount" to Events.money(SEND_AMOUNT),
                    "currency" to DemoState.CURRENCY,
                    "amount_home_currency" to Events.money(SEND_AMOUNT),
                    "fee" to Events.money(0.00),
                    "fx_rate" to SEND_RATE,
                    "currency_from" to "USD",
                    "currency_to" to "EUR",
                    "country_to" to "ES",
                    "status" to "completed"
                ))
            }
        ),
        branchLabel = "Send it with too little in the account",
        branchNote = "The row that a Savings Boost or an overdraft campaign answers. " +
                     "status is failed and failure_reason says which wall it hit.",
        branch = { id, _ ->
            Events.transaction("transaction_failed", mapOf(
                "transaction_id" to id,
                "transaction_type" to "transfer_out",
                "amount" to Events.money(SEND_AMOUNT),
                "currency" to DemoState.CURRENCY,
                "currency_from" to "USD",
                "currency_to" to "EUR",
                "country_to" to "ES",
                "status" to "failed",
                "failure_reason" to "insufficient_funds"
            ))
        }
    )

    /* ---------------------------------------------------------------- top up
       Paired with the account table on purpose: low_balance_detected is what
       makes the top up worth prompting, and the two rows together are the
       whole campaign. */
    private const val TOPUP_AMOUNT = 150.00

    private fun topUp() = Journey(
        screen = Screen.TOP_UP,
        title = "Top up",
        blurb = "Money in, and the account row that explains why it was needed. " +
                "balance_band is precomputed so a segment needs no arithmetic.",
        table = Events.Tables.TRANSACTION,
        steps = listOf(
            JourneyStep("balance_seen", "See the balance",
                "the app notices it is low before the customer does",
                "low_balance_detected") { _ ->
                Events.account("low_balance_detected", mapOf(
                    "account_type" to "current",
                    "currency" to DemoState.CURRENCY,
                    "balance" to Events.money(64.20),
                    "balance_band" to Events.balanceBand(64.20),
                    "action" to "low_balance_detected",
                    "channel" to "android"
                ))
            },
            JourneyStep("amount_entered", "Enter the amount",
                "$${"%,.2f".format(TOPUP_AMOUNT)} from a linked card", null),
            JourneyStep("topped_up", "Top up",
                "money in, and the balance band moves with it",
                "topup_completed") { id ->
                Events.transaction("topup_completed", mapOf(
                    "transaction_id" to id,
                    "transaction_type" to "topup",
                    "amount" to Events.money(TOPUP_AMOUNT),
                    "currency" to DemoState.CURRENCY,
                    "amount_home_currency" to Events.money(TOPUP_AMOUNT),
                    "fee" to Events.money(0.00),
                    "status" to "completed"
                ))
            }
        ),
        branchLabel = "Top up past the daily limit",
        branchNote = "The same table, a different failure_reason. Worth showing " +
                     "beside the one above: two campaigns, one table, no new columns.",
        branch = { id, _ ->
            Events.transaction("transaction_failed", mapOf(
                "transaction_id" to id,
                "transaction_type" to "topup",
                "amount" to Events.money(TOPUP_AMOUNT),
                "currency" to DemoState.CURRENCY,
                "status" to "failed",
                "failure_reason" to "limit_exceeded"
            ))
        }
    )

    /* ------------------------------------------------------- verify identity
       The strongest single table in a FinTech demo, because every step is a
       campaign trigger and the abandonment names exactly where it happened. */
    private fun verify() = Journey(
        screen = Screen.VERIFY,
        title = "Verify your identity",
        blurb = "The KYC funnel, one row per step, with step_index so a funnel " +
                "chart sorts without a lookup.",
        table = Events.Tables.ONBOARDING,
        steps = listOf(
            JourneyStep("kyc_started", "Start the check",
                "the funnel opens", "kyc_started") { _ ->
                Events.onboarding("kyc_started", mapOf(
                    "step" to "kyc_started", "step_index" to 4,
                    "status" to "started", "method" to "email"
                ))
            },
            JourneyStep("doc_uploaded", "Photograph the document",
                "passport, and doc_type says so", "kyc_doc_uploaded") { _ ->
                Events.onboarding("kyc_doc_uploaded", mapOf(
                    "step" to "doc_uploaded", "step_index" to 5,
                    "status" to "completed", "doc_type" to "passport",
                    "time_on_step_sec" to 42
                ))
            },
            JourneyStep("selfie_captured", "Take the selfie",
                "the step people give up on", "kyc_selfie_captured") { _ ->
                Events.onboarding("kyc_selfie_captured", mapOf(
                    "step" to "selfie_captured", "step_index" to 6,
                    "status" to "completed", "time_on_step_sec" to 28
                ))
            },
            JourneyStep("kyc_submitted", "Submit",
                "handed to the checks", "kyc_submitted") { _ ->
                Events.onboarding("kyc_submitted", mapOf(
                    "step" to "kyc_submitted", "step_index" to 7,
                    "status" to "completed"
                ))
            },
            JourneyStep("kyc_approved", "Approved",
                "and the account can open", "kyc_approved") { _ ->
                Events.onboarding("kyc_approved", mapOf(
                    "step" to "kyc_approved", "step_index" to 8,
                    "status" to "completed"
                ))
            }
        ),
        branchLabel = "Give up at this step",
        branchNote = "kyc_abandoned carries the step reached and why, which is the " +
                     "single most requested FinTech campaign: a push that says the " +
                     "photo was too blurry and to try again in daylight.",
        branch = { _, reached ->
            Events.onboarding("kyc_abandoned", mapOf(
                "step" to reached.key,
                "status" to "abandoned",
                "doc_type" to "passport",
                "failure_reason" to "blurred_document"
            ))
        }
    )

    /* ------------------------------------------------------ apply for a plan
       What replaces a cart and an order in finance vocabulary. One
       application_id groups every row, and monthly_fee is the pricing model
       rather than a shelf price. */
    private const val PLAN_ID = "NPY-CRD-PLUS"
    private const val PLAN_NAME = "NovaPay Plus"

    private fun applyForPlan() = Journey(
        screen = Screen.APPLY,
        title = "Apply for a plan",
        blurb = "The application funnel. application_id groups the run, and the " +
                "fee is monthly, because a card has no shelf price.",
        table = Events.Tables.PRODUCT,
        steps = listOf(
            JourneyStep("viewed", "Look at the plan",
                "the same row the website writes", "product_viewed") { id ->
                Events.product("product_viewed", mapOf(
                    "product_id" to PLAN_ID, "product_name" to PLAN_NAME,
                    "product_family" to "cards", "plan_tier" to "plus",
                    "monthly_fee" to Events.money(6.99), "rate_type" to "fx_markup",
                    "application_id" to id,
                    "funnel_step" to "viewed", "step_index" to 1
                ))
            },
            JourneyStep("eligibility_checked", "Check eligibility",
                "before any details are typed", "eligibility_checked") { id ->
                Events.product("eligibility_checked", mapOf(
                    "product_id" to PLAN_ID, "product_name" to PLAN_NAME,
                    "product_family" to "cards", "application_id" to id,
                    "funnel_step" to "eligibility_checked", "step_index" to 2
                ))
            },
            JourneyStep("application_started", "Start the application",
                "the point of no return for a funnel report", "application_started") { id ->
                Events.product("application_started", mapOf(
                    "product_id" to PLAN_ID, "product_name" to PLAN_NAME,
                    "product_family" to "cards", "application_id" to id,
                    "products_in_application" to 1,
                    "funnel_step" to "application_started", "step_index" to 3
                ))
            },
            JourneyStep("details_entered", "Enter the details",
                "name, address, income", "application_step_completed") { id ->
                Events.product("application_step_completed", mapOf(
                    "product_id" to PLAN_ID, "application_id" to id,
                    "funnel_step" to "details_entered", "step_index" to 4
                ))
            },
            JourneyStep("submitted", "Submit",
                "handed to underwriting", "application_submitted") { id ->
                Events.product("application_submitted", mapOf(
                    "product_id" to PLAN_ID, "product_name" to PLAN_NAME,
                    "product_family" to "cards", "application_id" to id,
                    "monthly_fee" to Events.money(6.99),
                    "funnel_step" to "submitted", "step_index" to 5
                ))
            },
            JourneyStep("approved", "Approved",
                "and the plan is live", "application_approved") { id ->
                Events.product("application_approved", mapOf(
                    "product_id" to PLAN_ID, "product_name" to PLAN_NAME,
                    "product_family" to "cards", "plan_tier" to "plus",
                    "application_id" to id,
                    "funnel_step" to "approved", "step_index" to 6
                ))
            }
        ),
        branchLabel = "Walk away from here",
        branchNote = "abandon_step is populated only on this event, and it is what " +
                     "lets a campaign say which screen they left on rather than " +
                     "just that they left.",
        branch = { id, reached ->
            Events.product("application_abandoned", mapOf(
                "product_id" to PLAN_ID, "product_name" to PLAN_NAME,
                "product_family" to "cards", "application_id" to id,
                "funnel_step" to "abandoned",
                "abandon_step" to reached.key
            ))
        }
    )

    /* -------------------------------------------------------- raise a dispute
       The one fact-to-fact relation the model defines:
       fintech_transaction_events.transaction_id to
       fintech_support_events.transaction_id.

       SO THIS JOURNEY WRITES BOTH SIDES OF IT. The first step puts the card
       payment in the transaction table, and the dispute then names that exact
       id. Pointing a case at an id no transaction row carries would look
       identical on screen and would leave the relation empty in the Toolbox,
       which is the thing worth proving. */
    private const val DISPUTED_MERCHANT = "Iberia"
    private const val DISPUTED_AMOUNT = 186.40

    /** TXN-<n> for the payment and CASE-<n> for the case it produced, from one
     *  run id, so the two rows are joinable without a lookup table. */
    private fun txnIdFrom(caseId: String) = "TXN-" + caseId.substringAfterLast('-')

    private fun dispute() = Journey(
        screen = Screen.DISPUTE,
        title = "Raise a dispute",
        blurb = "Raised from a transaction, so the case carries its transaction_id. " +
                "That relation is defined in the model and this is what fills it.",
        table = Events.Tables.SUPPORT,
        steps = listOf(
            JourneyStep("payment_made", "The payment being disputed",
                "$${"%,.2f".format(DISPUTED_AMOUNT)} to $DISPUTED_MERCHANT",
                "card_payment_made") { id ->
                Events.transaction("card_payment_made", mapOf(
                    "transaction_id" to txnIdFrom(id),
                    "transaction_type" to "card_payment",
                    "amount" to Events.money(DISPUTED_AMOUNT),
                    "currency" to DemoState.CURRENCY,
                    "amount_home_currency" to Events.money(DISPUTED_AMOUNT),
                    "merchant_name" to DISPUTED_MERCHANT,
                    "merchant_category" to "travel",
                    "is_recurring" to false,
                    "status" to "completed"
                ))
            },
            JourneyStep("dispute_raised", "Raise it",
                "the case names the transaction above", "dispute_raised") { id ->
                Events.support("dispute_raised", mapOf(
                    "case_id" to id, "case_type" to "dispute",
                    "category" to "card", "channel" to "in_app",
                    "transaction_id" to txnIdFrom(id),
                    "disputed_amount" to Events.money(DISPUTED_AMOUNT),
                    "resolution_status" to "open"
                ))
            },
            JourneyStep("case_updated", "The case moves",
                "an update the customer should be told about", "case_updated") { id ->
                Events.support("case_updated", mapOf(
                    "case_id" to id, "case_type" to "dispute",
                    "category" to "card", "resolution_status" to "open"
                ))
            },
            JourneyStep("case_resolved", "Resolved",
                "in the customer's favour, and timed", "case_resolved") { id ->
                Events.support("case_resolved", mapOf(
                    "case_id" to id, "case_type" to "dispute",
                    "category" to "card", "resolution_status" to "resolved",
                    "time_to_resolution_hours" to 26
                ))
            },
            JourneyStep("satisfaction_submitted", "Rate it",
                "1 to 5, captured after resolution", "satisfaction_submitted") { id ->
                Events.support("satisfaction_submitted", mapOf(
                    "case_id" to id, "case_type" to "dispute",
                    "resolution_status" to "resolved",
                    "satisfaction_score" to 4
                ))
            }
        ),
        branchLabel = "Stop replying",
        branchNote = "There is no case_abandoned event, and there should not be: a " +
                     "case nobody replied to is still open. awaiting_customer is the " +
                     "real state, and the segment that chases it is built on that.",
        branch = { id, _ ->
            Events.support("case_updated", mapOf(
                "case_id" to id, "case_type" to "dispute",
                "category" to "card",
                "resolution_status" to "awaiting_customer"
            ))
        }
    )

    val ALL: List<Journey> = listOf(sendMoney(), topUp(), verify(), applyForPlan(), dispute())

    fun forScreen(screen: String): Journey? = ALL.firstOrNull { it.screen == screen }

    /** Reference prefix per journey, so an id reads as what it is in Data Space. */
    fun prefixFor(screen: String): String = when (screen) {
        Screen.APPLY -> "APP"
        Screen.DISPUTE -> "CASE"
        Screen.VERIFY -> "KYC"
        else -> "TXN"
    }
}

/* ---------------------------------------------------------------- the screen */

@Composable
fun JourneyScreen(screen: String) {
    val journey = Journeys.forScreen(screen)
    if (journey == null) {
        Note("No journey is wired to '$screen'.")
        return
    }

    /* The reference is remembered against the journey, so navigating away and
       back starts a new run rather than adding rows to a finished one. */
    var reference by remember(screen) { mutableStateOf(Journeys.ref(Journeys.prefixFor(screen))) }
    var done by remember(screen) { mutableStateOf(0) }
    var note by remember(screen) { mutableStateOf("") }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {

        Card2(journey.title) {
            Text(journey.blurb, color = Color(0xFF64748B), fontSize = 11.5.sp)
            Spacer(Modifier.height(8.dp))
            Row2("Table", journey.table)
            Row2("Reference", reference)
            Row2("Screen name", journey.screen)
            Text("The screen name is reported with setNavigation, so an In-App " +
                 "campaign can be aimed at a customer standing in the middle of " +
                 "this journey.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
        }

        journey.steps.forEachIndexed { i, step ->
            val state = when {
                i < done -> "done"
                i == done -> "next"
                else -> "later"
            }
            Card2 {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("${i + 1}. ${step.label}",
                             fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold,
                             color = if (state == "later") Color(0xFF64748B) else Color(0xFF0F1C33))
                        Text(step.detail, color = Color(0xFF64748B), fontSize = 11.5.sp)
                        Text(
                            step.writes?.let { "writes $it" }
                                ?: "writes nothing, on purpose",
                            color = if (step.writes == null) Color(0xFF8A5A05) else Color(0xFF125CFA),
                            fontSize = 11.sp
                        )
                    }
                    if (state == "done") {
                        Text("done", color = Color(0xFF0F7A4D), fontSize = 11.5.sp,
                             fontWeight = FontWeight.SemiBold)
                    }
                }
                if (state == "next") {
                    Primary(step.label) {
                        step.send(reference)
                        done = i + 1
                        note = step.writes?.let { "sent $it to ${journey.table}" }
                            ?: "no row written: ${step.label.lowercase()} is an " +
                               "intention, and this table holds facts."
                    }
                }
            }
        }

        /* The branch stays available at every step, because "where did they give
           up" is the whole question and the answer differs by step. */
        Card2("The branch that makes it a campaign") {
            Text(journey.branchNote, color = Color(0xFF64748B), fontSize = 11.5.sp)
            val reached = journey.steps[minOf(done, journey.steps.size - 1)]
            Spacer(Modifier.height(6.dp))
            Row2("Step reached", reached.key)
            Primary(journey.branchLabel) {
                journey.branch(reference, reached)
                note = "branch written against step '${reached.key}'. Check the row " +
                       "in Data Space: a 200 means accepted, not stored."
            }
        }

        Card2("Run it again") {
            Text("A new reference, so the second run is a second customer rather " +
                 "than more rows on the first.", color = Color(0xFF64748B), fontSize = 11.5.sp)
            Primary("Start a fresh run") {
                reference = Journeys.ref(Journeys.prefixFor(screen))
                done = 0
                note = "new reference: $reference"
            }
        }

        if (note.isNotBlank()) Card2("Result") { Text(note, fontSize = 12.sp) }

        Note("Every event type and every column here is already in " +
             "fintech/EVENT-MODEL.md. Nothing was invented to make the screen " +
             "read better.")
    }
}
