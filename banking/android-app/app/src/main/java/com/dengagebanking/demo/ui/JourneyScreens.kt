package com.dengagebanking.demo.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengagebanking.demo.DengageKeys
import com.dengagebanking.demo.data.DemoData
import com.dengagebanking.demo.events.MeridianEvents

/* ============================================================================
   THE FOUR THINGS A CUSTOMER ACTUALLY DOES

   Until now the app could be browsed and the Events screen could fire all 86
   types on demand, which proves the pipe but demos badly: a prospect watching
   a button labelled "send event" is watching instrumentation, not a customer.
   These four screens are the customer doing the thing, and the row appears
   because they did it.

   Send money        -> banking_transaction_events
   Apply for a card  -> banking_application_events   (five steps, abandonable)
   Raise a complaint -> banking_account_events
   Book an adviser   -> banking_appointment_events

   NOT ONE NEW TABLE, AND NOT ONE NEW EVENT TYPE. Every row below is an
   existing member of the 86 that the website also sends, so a segment built
   on transfer_made catches the web customer and the app customer together,
   separated only by event_source. Inventing an app-only type would have
   split every segment in the account in two, and EventContractTest would
   have failed, which is what that test is for.

   WHY THESE FOUR. Each one is the trigger for a different kind of campaign,
   so together they demo the whole platform rather than four variations of a
   push:

     transfer_made        real-time transactional messaging, and the failed
                          branch below is the service message a bank must send
     application_started  the abandonment journey, which is the single
                          highest-value automation a retail bank runs
     complaint_raised     suppression. A complaint should STOP marketing to
                          that contact, and showing that is more convincing
                          than another offer
     appointment_booked   a reminder journey with a real deadline, plus the
                          no-show follow-up

   THE FAILURE PATHS ARE THE POINT. A transfer over the available balance
   writes payment_failed rather than silently refusing, and leaving the card
   application mid-way writes step_abandoned naming the step. Demos usually
   only show the happy path, and the happy path is not what marketing
   automation is for.
   ========================================================================== */

// ------------------------------------------------------------- send money --

@Composable
fun SendMoneyScreen(onNavigate: (String) -> Unit) {
    val account = DemoData.currentAccount
    var payee by remember { mutableStateOf(DemoData.MANDATES.first().payee) }
    var amount by remember { mutableStateOf("120") }
    var reference by remember { mutableStateOf("Rent share") }
    var result by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { MeridianEvents.pageView("payments") }

    JourneyColumn {
        JourneyHeading(
            "Send money",
            "Writes to banking_transaction_events. Over " + money(account.available) +
                " and it fails instead, which is the row a service message is built on."
        )

        MeridianCardLocal {
            Text("From", fontSize = 11.sp, color = MeridianColours.soft)
            Text(account.name + "  " + account.masked, fontWeight = FontWeight.SemiBold)
            Text("Available " + money(account.available), fontSize = 12.sp, color = MeridianColours.soft)
        }

        Spacer(Modifier.height(12.dp))
        Text("To", fontSize = 11.sp, color = MeridianColours.soft)
        Spacer(Modifier.height(6.dp))
        DemoData.MANDATES.forEach { m ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(selected = payee == m.payee, onClick = { payee = m.payee })
                Text(m.payee, fontSize = 14.sp)
            }
        }

        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = amount, onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } },
            label = { Text("Amount, GBP") }, singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = reference, onValueChange = { reference = it },
            label = { Text("Reference") }, singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(14.dp))
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val value = amount.toDoubleOrNull() ?: 0.0
                val id = "txn-app-" + (System.currentTimeMillis() % 1_000_000)
                val input = MeridianEvents.TransactionInput(
                    transactionId = id,
                    accountIdMasked = account.masked,
                    amount = value,
                    direction = "debit",
                    payeeName = payee,
                    merchantName = payee,
                    merchantCategory = "transfer",
                    paymentChannel = "faster_payment",
                    isRecurring = false
                )
                when {
                    value <= 0.0 -> result = "Enter an amount above zero."
                    /* The refusal is a ROW, not a toast. A bank that declines a
                       payment has to tell the customer, and that message is
                       triggered off exactly this event. */
                    value > account.available -> {
                        MeridianEvents.Transaction.paymentFailed(input)
                        result = "Declined: " + money(value) + " is more than the " +
                            money(account.available) + " available. Wrote payment_failed."
                    }
                    else -> {
                        MeridianEvents.Transaction.transferMade(input)
                        /* Above a threshold it is also a large_transaction, which
                           is a separate row on purpose: the fraud team segments on
                           one and marketing on the other. */
                        if (value >= 500.0) MeridianEvents.Transaction.large(input)
                        result = "Sent " + money(value) + " to " + payee +
                            ". Wrote transfer_made" +
                            (if (value >= 500.0) " and large_transaction." else ".")
                    }
                }
            }
        ) { Text("Send") }

        ResultNote(result)
        Disclaimer()
    }
}

// ------------------------------------------------------- card application --

/** The five steps a card application actually has. Named, because
 *  step_abandoned carries the name and a journey keyed on "documents" is a
 *  different message from one keyed on "identity". */
private val CARD_STEPS = listOf(
    "eligibility", "identity", "income", "documents", "review"
)

@Composable
fun ApplyScreen(onNavigate: (String) -> Unit) {
    val product = DemoData.PRODUCTS.first { it.id == "crd-platinum" }
    var applicationId by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf(0) }
    var decision by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        MeridianEvents.pageView("products", productId = product.id, categoryPath = product.categoryPath)
    }

    fun input(extra: MeridianEvents.ApplicationInput.() -> MeridianEvents.ApplicationInput = { this }) =
        MeridianEvents.ApplicationInput(
            applicationId = applicationId,
            productId = product.id,
            productCategory = "credit_card",
            totalSteps = CARD_STEPS.size,
            requestedAmount = 3000.0
        ).extra()

    JourneyColumn {
        JourneyHeading(
            "Apply for the Platinum card",
            "Writes to banking_application_events, one row per step. Walk away " +
                "half way and it writes step_abandoned naming the step, which is " +
                "the trigger the abandonment journey listens for."
        )

        MeridianCardLocal {
            Text(product.name, fontWeight = FontWeight.SemiBold)
            Text(product.rateDisplay + " representative", fontSize = 12.sp, color = MeridianColours.soft)
            Text(product.summary, fontSize = 12.5.sp)
        }

        Spacer(Modifier.height(12.dp))

        if (applicationId == null) {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val id = "APP-" + (System.currentTimeMillis() % 1_000_000)
                    applicationId = id
                    step = 0
                    decision = null
                    MeridianEvents.Application.started(
                        MeridianEvents.ApplicationInput(
                            applicationId = id, productId = product.id,
                            productCategory = "credit_card",
                            totalSteps = CARD_STEPS.size, requestedAmount = 3000.0,
                            stepName = CARD_STEPS.first(), stepIndex = 1
                        )
                    )
                    result = "Started $id. Wrote application_started."
                }
            ) { Text("Start the application") }
        } else if (decision == null) {
            Text(
                "Step " + (step + 1) + " of " + CARD_STEPS.size + ": " + CARD_STEPS[step],
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (step + 1).toFloat() / CARD_STEPS.size },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val name = CARD_STEPS[step]
                    MeridianEvents.Application.stepCompleted(
                        input { copy(stepName = name, stepIndex = step + 1) }
                    )
                    /* The documents step gets its own row type, because
                       "waiting on documents" is a different suppression rule
                       from "still filling the form". */
                    if (name == "documents") {
                        MeridianEvents.Application.documentUploaded(
                            input { copy(stepName = name, stepIndex = step + 1, documentsOutstanding = 0) }
                        )
                    }
                    if (step == CARD_STEPS.lastIndex) {
                        MeridianEvents.Application.submitted(input { copy(stepName = "review") })
                        /* Approved because a demo that gets declined has nowhere
                           to go. The decline path is one line away and the
                           column exists: decline_reason_code. */
                        MeridianEvents.Application.decisionReturned(
                            input { copy(decision = "approved") }
                        )
                        decision = "approved"
                        result = "Submitted and approved. Wrote application_submitted " +
                            "and decision_returned."
                    } else {
                        step += 1
                        result = "Completed " + name + ". Wrote step_completed."
                    }
                }
            ) { Text(if (step == CARD_STEPS.lastIndex) "Submit" else "Continue") }

            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val name = CARD_STEPS[step]
                    MeridianEvents.Application.stepAbandoned(
                        input { copy(stepName = name, stepIndex = step + 1) }
                    )
                    result = "Left at " + name + ". Wrote step_abandoned with " +
                        "abandoned_at_step = " + name + ". This is the one to " +
                        "build a journey on."
                    applicationId = null
                    step = 0
                }
            ) { Text("Leave it for now") }
        } else {
            Text("Approved", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Spacer(Modifier.height(4.dp))
            Text(
                "A 3,000 limit, subject to nothing at all because this is a demo.",
                fontSize = 13.sp
            )
            Spacer(Modifier.height(12.dp))
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    MeridianEvents.Application.offerAccepted(input { copy(decision = "approved") })
                    MeridianEvents.Application.activated(input { copy(decision = "approved") })
                    result = "Accepted. Wrote offer_accepted and account_activated."
                    applicationId = null
                    decision = null
                    step = 0
                }
            ) { Text("Accept the offer") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    MeridianEvents.Application.offerDeclined(input { copy(decision = "approved") })
                    result = "Declined the offer. Wrote offer_declined, which is a " +
                        "very different segment from never having applied."
                    applicationId = null
                    decision = null
                    step = 0
                }
            ) { Text("Not right now") }
        }

        ResultNote(result)
        Disclaimer()
    }
}

// --------------------------------------------------------------- complaint --

private val COMPLAINT_TOPICS = listOf(
    "card_declined", "fee_charged", "app_problem", "branch_service", "fraud_concern"
)

@Composable
fun ComplaintScreen(onNavigate: (String) -> Unit) {
    var topic by remember { mutableStateOf(COMPLAINT_TOPICS.first()) }
    var detail by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { MeridianEvents.pageView("profile") }

    JourneyColumn {
        JourneyHeading(
            "Raise a complaint",
            "Writes to banking_account_events. Worth demoing precisely because " +
                "the right campaign response is to STOP sending offers to this " +
                "contact, which is a suppression rule rather than a message."
        )

        Text("What is it about?", fontSize = 11.sp, color = MeridianColours.soft)
        Spacer(Modifier.height(6.dp))
        COMPLAINT_TOPICS.forEach { t ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(selected = topic == t, onClick = { topic = t })
                Text(t.replace('_', ' '), fontSize = 14.sp)
            }
        }

        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = detail, onValueChange = { detail = it },
            label = { Text("Anything you want to add") },
            modifier = Modifier.fillMaxWidth(), minLines = 3
        )

        Spacer(Modifier.height(14.dp))
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val a = MeridianEvents.AccountInput(
                    accountIdMasked = DemoData.currentAccount.masked,
                    accountType = DemoData.currentAccount.type,
                    supportTopic = topic
                )
                /* Two rows, not one. Contacting support and complaining are
                   different things: a bank suppresses marketing on the second
                   and not necessarily on the first, and the free text is
                   deliberately NOT sent, because a complaint body is exactly
                   the kind of unstructured personal data that should not sit
                   in a marketing table. */
                MeridianEvents.Account.supportContacted(a)
                MeridianEvents.Account.complaintRaised(a)
                result = "Logged against " + topic + ". Wrote support_contacted " +
                    "and complaint_raised. The text you typed was not sent, on purpose."
                detail = ""
            }
        ) { Text("Submit the complaint") }

        ResultNote(result)
        Disclaimer()
    }
}

// ------------------------------------------------------------- appointment --

private val APPOINTMENT_TYPES = listOf(
    "mortgage_review" to "Mortgage review",
    "wealth_review" to "Portfolio review",
    "account_opening" to "Opening an account",
    "bereavement" to "Bereavement support"
)

@Composable
fun AppointmentScreen(onNavigate: (String) -> Unit) {
    var type by remember { mutableStateOf(APPOINTMENT_TYPES.first().first) }
    var channel by remember { mutableStateOf("video") }
    var days by remember { mutableStateOf(3) }
    var booked by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { MeridianEvents.pageView("products") }

    JourneyColumn {
        JourneyHeading(
            "Book an adviser",
            "Writes to banking_appointment_events. The one journey with a real " +
                "deadline in it: remind before, follow up after, and chase a no-show."
        )

        Text("What for?", fontSize = 11.sp, color = MeridianColours.soft)
        Spacer(Modifier.height(6.dp))
        APPOINTMENT_TYPES.forEach { (key, label) ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(selected = type == key, onClick = { type = key })
                Text(label, fontSize = 14.sp)
            }
        }

        Spacer(Modifier.height(10.dp))
        Text("How?", fontSize = 11.sp, color = MeridianColours.soft)
        Spacer(Modifier.height(6.dp))
        Row {
            listOf("video", "phone", "branch").forEach { c ->
                Row(
                    Modifier.padding(end = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(selected = channel == c, onClick = { channel = c })
                    Text(c, fontSize = 13.sp)
                }
            }
        }

        Spacer(Modifier.height(10.dp))
        Text("In " + days + " day" + (if (days == 1) "" else "s"), fontSize = 13.sp)
        Slider(
            value = days.toFloat(), onValueChange = { days = it.toInt().coerceIn(1, 14) },
            valueRange = 1f..14f, modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(6.dp))
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val id = "APT-" + (System.currentTimeMillis() % 1_000_000)
                booked = id
                MeridianEvents.Appointment.booked(
                    MeridianEvents.AppointmentInput(
                        appointmentId = id, appointmentType = type,
                        appointmentChannel = channel,
                        branchName = if (channel == "branch") "Meridian Holborn" else null,
                        branchCity = if (channel == "branch") "London" else null,
                        adviserName = DemoData.ADVISER,
                        scheduledAt = DemoData.daysFromNow(days),
                        /* The column a reminder journey actually keys on: how
                           long until it happens, so the message can go out at
                           the right moment rather than immediately. */
                        leadTimeHours = days * 24,
                        productCategory = if (type == "wealth_review") "wealth" else "banking"
                    )
                )
                result = "Booked $id with " + DemoData.ADVISER + " in " + days +
                    " days. Wrote appointment_booked with lead_time_hours = " + (days * 24) + "."
            }
        ) { Text("Book it") }

        if (booked != null) {
            Spacer(Modifier.height(10.dp))
            Text(
                "The two rows worth showing next. A reminder journey ends at one " +
                    "of them, and they are opposite outcomes.",
                fontSize = 11.5.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(6.dp))
            Row {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = {
                        MeridianEvents.Appointment.attended(
                            MeridianEvents.AppointmentInput(
                                appointmentId = booked, appointmentType = type,
                                appointmentChannel = channel, adviserName = DemoData.ADVISER
                            )
                        )
                        result = "Wrote appointment_attended."
                        booked = null
                    }
                ) { Text("Attended") }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = {
                        MeridianEvents.Appointment.noShow(
                            MeridianEvents.AppointmentInput(
                                appointmentId = booked, appointmentType = type,
                                appointmentChannel = channel, adviserName = DemoData.ADVISER
                            )
                        )
                        result = "Wrote appointment_no_show, which is the one that " +
                            "earns a follow-up rather than another offer."
                        booked = null
                    }
                ) { Text("No show") }
            }
        }

        ResultNote(result)
        Disclaimer()
    }
}

// ------------------------------------------------------------------ pieces --

@Composable
private fun JourneyColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        content = content
    )
}

@Composable
private fun JourneyHeading(title: String, blurb: String) {
    Text(title, fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
    Spacer(Modifier.height(4.dp))
    Text(blurb, fontSize = 12.sp, color = MeridianColours.soft)
    Spacer(Modifier.height(14.dp))
}

@Composable
private fun MeridianCardLocal(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(Modifier.padding(14.dp), content = content)
    }
}

/** What was written, in the words of the table, so the panel can be opened
 *  next to the phone and the row found without guessing. */
@Composable
private fun ResultNote(result: String?) {
    if (result == null) return
    Spacer(Modifier.height(12.dp))
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Text(result, fontSize = 12.sp, modifier = Modifier.padding(12.dp))
    }
}

@Composable
private fun Disclaimer() {
    Spacer(Modifier.height(18.dp))
    Text(
        "Meridian Bank is a fictional brand used to demonstrate Dengage. No " +
            "account is opened, no money moves and no complaint reaches anybody.",
        fontSize = 10.5.sp, color = MeridianColours.soft
    )
    Spacer(Modifier.height(24.dp))
}

private fun money(v: Double): String =
    "GBP " + String.format("%,.2f", v)
