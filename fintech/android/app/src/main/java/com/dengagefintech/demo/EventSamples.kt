package com.dengagefintech.demo

/**
 * One realistic sample row per table, so the Test Area can fire the whole
 * NovaPay event model from a phone and every table fills.
 *
 * EVERY COLUMN AND EVERY CONTROLLED VALUE HERE IS THE WEBSITE'S OR THE MODEL'S,
 * and fintech/tools/eventtest.js fails the build if one drifts.
 *
 * That check exists because of what this file used to send. On 3 August a
 * handset log showed these rows going out with card_id_masked, card_product,
 * card_status, kyc_status and topic: five columns no schema defines. Every one
 * returned HTTP 200, because the event API accepts what it is given. A column
 * the table does not have is simply DROPPED, so those rows landed in Data Space
 * with the interesting half of each row empty, and nothing anywhere said so.
 *
 * A 200 is not proof. The row in Data Space is.
 */
object EventSamples {

    data class Sample(
        val label: String,
        val table: String,
        val eventType: String,
        val payload: Map<String, Any?>
    )

    val ALL: List<Sample> = listOf(
        /* step_index follows the model's 1 to 10 funnel, so a funnel chart
           sorts without a lookup. kyc_submitted is 7. The document type is
           doc_type; method is how the customer signed up, and the two are not
           interchangeable. */
        Sample("Onboarding: KYC submitted", Events.Tables.ONBOARDING, "kyc_submitted", mapOf(
            "step" to "kyc_submitted", "step_index" to 7,
            "status" to "completed", "method" to "email",
            "doc_type" to "passport", "time_on_step_sec" to 34
        )),
        /* channel on an account row is the platform: web, android, ios, branch
           or call_centre. "app" is not one of them. */
        Sample("Account: balance viewed", Events.Tables.ACCOUNT, "balance_viewed", mapOf(
            "account_id" to "NPY-CUR-001", "account_type" to "current",
            "currency" to DemoState.CURRENCY,
            "balance" to Events.money(DemoState.BALANCE),
            "balance_band" to Events.balanceBand(DemoState.BALANCE),
            "channel" to "android"
        )),
        /* transaction_type carries the direction, which is why amount is always
           positive. merchant_category is CARD PAYMENTS ONLY and has a fixed
           list that has no member for a transfer, so it is absent rather than
           filled with the word "transfer". */
        Sample("Transaction: transfer sent", Events.Tables.TRANSACTION, "transfer_sent", mapOf(
            "transaction_id" to "TXN-SAMPLE-1",
            "transaction_type" to "transfer_out",
            "amount" to Events.money(120.0),
            "currency" to DemoState.CURRENCY,
            "amount_home_currency" to Events.money(120.0),
            "fee" to Events.money(0.00),
            "status" to "completed"
        )),
        /* card_id, card_type and card_tier, exactly as the website sends them.
           The state of the card after the event is the action column. */
        Sample("Card: activated", Events.Tables.CARD, "card_activated", mapOf(
            "card_id" to "CRD-8890", "card_type" to "physical",
            "card_tier" to "plus", "action" to "card_activated"
        )),
        Sample("Savings: pot funded", Events.Tables.SAVINGS, "pot_funded", mapOf(
            "pot_id" to "POT-JP27", "pot_name" to "Japan 2027",
            "goal_amount" to Events.money(4000.0),
            "current_amount" to Events.money(1570.0),
            "progress_pct" to 39, "funding_method" to "manual"
        )),
        /* An instrument, not a product. fintech_investment_events keys on
           instrument_id and the website sends instrument_name and asset_class
           beside it. */
        Sample("Investment: investment made", Events.Tables.INVESTMENT, "investment_made", mapOf(
            "instrument_id" to "NPY-INV-ROBO", "instrument_name" to "Managed portfolio",
            "asset_class" to "managed_portfolio", "risk_profile" to "balanced",
            "amount" to Events.money(250.0), "currency" to DemoState.CURRENCY,
            "order_type" to "market", "is_recurring" to false
        )),
        Sample("Credit: score viewed", Events.Tables.CREDIT, "credit_score_viewed", mapOf(
            "credit_score" to DemoState.CREDIT_SCORE,
            "credit_score_band" to Events.creditScoreBand(DemoState.CREDIT_SCORE),
            "score_change" to (DemoState.CREDIT_SCORE - DemoState.CREDIT_SCORE_LAST)
        )),
        /* product_family is plural in the model: cards, savings, investing,
           credit, global, protection. */
        Sample("Product: shortlisted", Events.Tables.PRODUCT, "product_shortlisted", mapOf(
            "product_id" to "NPY-CRD-TRAVEL", "product_name" to "Travel card",
            "product_family" to "cards", "funnel_step" to "shortlisted", "step_index" to 2
        )),
        /* complaint_logged is the model's event type. A support row is a CASE:
           case_id, case_type and category, with resolution_status for its
           state. channel is chat, phone, email or in_app. */
        Sample("Support: complaint logged", Events.Tables.SUPPORT, "complaint_logged", mapOf(
            "case_id" to "CASE-SAMPLE-1", "case_type" to "complaint",
            "category" to "card", "channel" to "in_app",
            "resolution_status" to "open"
        )),
        /* scenario_group and page_type both have fixed vocabularies built for
           the website's scenarios, and the Test Area is in neither. They are
           omitted rather than filled with a word that would break any segment
           written on them. What identifies this row is the slug, the widget
           name and the channel. */
        Sample("Engagement: scenario triggered", Events.Tables.ENGAGEMENT, "scenario_triggered", mapOf(
            "scenario_slug" to "app_test_area",
            "widget_name" to "Fire every table", "channel" to "inapp",
            "interaction" to "triggered"
        ))
    )

    fun fireAll() = ALL.forEach { Events.send(it.table, it.eventType, it.payload) }
}
