package com.dengagefintech.demo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import com.dengage.sdk.Dengage
import com.dengagefintech.demo.*

/* The five portal screens mirror the website's five pages one for one. Every
   event type and column here is the website's, never invented. */

@Composable
fun SignInScreen(onNavigate: (String) -> Unit) {
    val ctx = LocalContext.current
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        Card2("Sign in to your portal") {
            Text("Same as the website: no credential check, the portal is simply " +
                 "somewhere you arrive rather than another page.",
                 color = Color(0xFF64748B), fontSize = 12.sp)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(name, { name = it }, label = { Text("Full name") },
                singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(email, { email = it }, label = { Text("E-mail") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(password, { password = it }, label = { Text("Password") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))

            Primary("Sign in") {
                if (email.isNotBlank()) {
                    DemoState.signIn(ctx, name.ifBlank { "Demo user" }, email)
                    // The RESOLVED contact key, never the raw email: sending
                    // the email where a mapping exists creates a second contact
                    // for one human and splits every segment.
                    runCatching { Dengage.setContactKey(Identity.resolve(email)) }
                    Events.onboarding("account_opened", mapOf(
                        "step" to "account_opened", "step_index" to 10,
                        "status" to "completed", "method" to "email"
                    ))
                    onNavigate(Screen.HOME)
                }
            }
        }
        Note("NovaPay is a fictional brand built to demonstrate the Dengage platform. " +
             "No account exists and no money moves.")
    }
}

@Composable
fun HomeScreen(onNavigate: (String) -> Unit) {
    val ctx = LocalContext.current
    LaunchedEffect(Unit) {
        Events.account("balance_viewed", mapOf(
            "account_id" to "NPY-CUR-001", "account_type" to "current",
            "currency" to DemoState.CURRENCY,
            "balance" to Events.money(DemoState.BALANCE),
            "balance_band" to Events.balanceBand(DemoState.BALANCE),
            "channel" to "android"
        ))
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        Card2 {
            Text("Available balance", color = Color(0xFF64748B), fontSize = 12.sp)
            Text("$${"%,.2f".format(DemoState.BALANCE)}", fontSize = 30.sp, fontWeight = FontWeight.Bold)
            Text(DemoState.CURRENCY + " current account", color = Color(0xFF64748B), fontSize = 12.sp)
        }
        /* INSERT BELOW. Sits directly under the balance card, so a campaign
           here reads as the bank's own follow-on to the number above it, and
           the credit score card and everything after it move down. */
        InlineSlot(Screen.HOME, InlinePlacements.HOME_BELOW_BALANCE,
                   does = "Content here appears directly BELOW the balance card, " +
                          "pushing the credit score card down.")
        Card2("Your credit score") {
            Row2("Score", DemoState.CREDIT_SCORE.toString(), bold = true)
            Row2("Band", Events.creditScoreBand(DemoState.CREDIT_SCORE) ?: "")
            Primary("View report") {
                Events.credit("credit_score_viewed", mapOf(
                    "credit_score" to DemoState.CREDIT_SCORE,
                    "credit_score_band" to Events.creditScoreBand(DemoState.CREDIT_SCORE)
                ))
            }
        }
        /* The id is the app's, not the panel's: see StoryPlacements. Empty, it
           draws a marker naming the id rather than nothing at all, so the rail
           can be pointed at before a Story set exists. */
        StoriesRail(Screen.HOME, StoryPlacements.HOME)
        Card2("Shortcuts") {
            Primary("Money") { onNavigate(Screen.MONEY) }
            Primary("Cards") { onNavigate(Screen.CARDS) }
            Primary("Grow") { onNavigate(Screen.GROW) }
        }
        Card2("Finish setting up") {
            Text("The KYC funnel, one row per step, and the abandonment that names " +
                 "the step it happened on.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Primary("Verify your identity") { onNavigate(Screen.VERIFY) }
        }
        /* SIGN OUT WRITES NOTHING, AND THAT IS THE POINT WORTH MAKING.
           fintech_account_events lists login_succeeded and login_failed and no
           counterpart, so there is no honest event type for this. Inventing
           account_signed_out would put a value in the table that the model does
           not define and that no segment could be trusted to mean anything.

           WHAT IT DOES NOT DO is try to unset the contact key on the platform.
           The device stays attached to the contact it was last identified as,
           which is the truth: this handset really did belong to that customer.
           The demo state is cleared, so the app stops CLAIMING a contact key on
           what it sends next, and signing in as somebody else re-points it.

           That difference is worth demonstrating rather than hiding. The inbox
           is the place it shows: it keeps reading the contact mailbox until a
           different contact key is set. */
        Card2("Sign out") {
            Text("Clears the demo's own state, so nothing further is sent claiming " +
                 "this customer. It sends no event: the account table has " +
                 "login_succeeded and login_failed and no sign-out, and a made-up " +
                 "event type is worse than a missing one.\n\n" +
                 "The DEVICE stays attached to the contact it was identified as, " +
                 "because it genuinely was. Sign in as somebody else to re-point it.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Primary("Sign out") {
                DemoState.signOut(ctx)
                onNavigate(Screen.SIGN_IN)
            }
        }
    }
}

@Composable
fun MoneyScreen(onNavigate: (String) -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        /* INSERT ABOVE. First thing on the screen, so a campaign here sits
           above the transaction list rather than after it. */
        InlineSlot(Screen.MONEY, InlinePlacements.MONEY_TOP,
                   does = "Content here appears ABOVE the transaction list, at the " +
                          "top of the screen.")
        Card2("Recent activity") {
            DemoState.TRANSACTIONS.forEach { t ->
                Row2("${t.merchant}  ${if (t.recurring) "(repeats)" else ""}",
                     "${if (t.amount < 0) "-" else "+"}$${"%,.2f".format(kotlin.math.abs(t.amount))}")
            }
            /* These used to fire a lone transfer_sent from here. A single row
               with nothing before or after it cannot show a funnel, a failure
               or a recovery campaign, which is the whole question a prospect
               asks. The journey screens write the sequence instead. */
            Primary("Send money") { onNavigate(Screen.SEND_MONEY) }
            Primary("Top up") { onNavigate(Screen.TOP_UP) }
            Primary("Dispute a payment") { onNavigate(Screen.DISPUTE) }
        }
        /* INSERT BELOW, on the same screen as the one above it. Two placements
           on one screen is the point: they are separate campaigns, targeted
           separately, and only the mounting position tells them apart. */
        InlineSlot(Screen.MONEY, InlinePlacements.MONEY_SUBSCRIPTIONS,
                   does = "Content here appears BELOW the transaction list. A second, " +
                          "separately targeted placement on the same screen.")
    }
}

/* ============================================================================
   CARDS

   This screen used to be one white card holding a last four, a status word and
   a single button, over half a screen of nothing. It was also the screen with
   the most to show: fintech_card_events declares FOURTEEN event types and nine
   columns of its own, and two of those event types were reachable.

   So the rebuild is not decoration. Every control below writes a row that the
   model already declares, and between them they now cover the whole table:
   ordering, delivery, activation, freezing, PIN, contactless, limits, wallet,
   replacement, cancellation and virtual cards. Nothing was added to the model
   to make the screen look busier, and no figure is invented: the card face
   shows what the demo state holds and nothing else.

   THE SECOND CARD IS THE DEMO. It was delivered four days ago and never
   activated, which is exactly the row the model's own talk track is written
   around, so the dormant-card push has something on screen to point at.
   ========================================================================== */

/**
 * Every event type this screen can write, which is every event type
 * fintech_card_events declares.
 *
 * Listed rather than counted by hand, so the figure on screen is derived and a
 * control added without its event type appearing here is visible. Duplicating a
 * value that belongs somewhere else has caused real failures in this repository
 * twice, and a hard-coded "14" over a list of controls is exactly that shape.
 */
private val CARD_EVENTS = listOf(
    "card_ordered", "card_dispatched", "card_delivered", "card_activated",
    "card_frozen", "card_unfrozen", "card_replaced", "card_cancelled",
    "pin_changed", "pin_viewed", "contactless_toggled", "card_limit_changed",
    "virtual_card_created", "card_added_to_wallet",
)

/** What the control just pressed actually wrote, said where it was pressed.
 *  A confirmation at the foot of a long scroll is a confirmation nobody sees. */
@Composable
private fun NoteBlock(text: String) {
    Spacer(Modifier.height(12.dp))
    Column(Modifier.fillMaxWidth()
        .background(Color(0xFFF2F6FF), RoundedCornerShape(10.dp))
        .padding(12.dp)) {
        Text(text, fontSize = 12.sp, lineHeight = 17.sp, color = Color(0xFF1F3358))
        Text("Accepted is not stored. The Events screen shows what went out, " +
             "Data Space shows what landed.",
             fontSize = 10.sp, lineHeight = 14.sp, color = Color(0xFF7C93BC),
             modifier = Modifier.padding(top = 6.dp))
    }
}

/** Tier colours for the card face. Metal is graphite, travel is teal, the rest
 *  is NovaPay blue, so the three read apart at a glance across a table. */
private fun tierColours(tier: String): List<Color> = when (tier) {
    "metal"    -> listOf(Color(0xFF3A4658), Color(0xFF1C2431))
    "travel"   -> listOf(Color(0xFF0E7C7B), Color(0xFF0A4B57))
    "business" -> listOf(Color(0xFF4B3E86), Color(0xFF241D46))
    else       -> listOf(Color(0xFF2D6BFF), Color(0xFF0A3A9E))
}

/** The card itself, drawn rather than illustrated, so there is no image asset
 *  to ship and the tier, the number and the frozen state stay in step with the
 *  demo's own data. */
@Composable
private fun CardFace(c: DemoState.Card) {
    val ink = Color.White
    /* The padding belongs to the Column, not the Box. On the Box it would inset
       the frozen scrim below by the same 18dp, leaving a border of live gradient
       around a card that is supposed to read as out of action. */
    Box(
        Modifier.fillMaxWidth().height(172.dp)
            .background(Brush.linearGradient(tierColours(c.tier)), RoundedCornerShape(16.dp))
    ) {
        Column(Modifier.fillMaxSize().padding(18.dp),
               verticalArrangement = Arrangement.SpaceBetween) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("NovaPay", color = ink, fontSize = 15.sp,
                     fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text(c.tier.uppercase(), color = ink.copy(alpha = 0.85f), fontSize = 10.sp,
                     letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
            }
            /* Single spaces between the groups and 17sp, because four groups at
               19sp with double spaces is wider than the 260dp a 360dp handset
               leaves inside this card, and a wrapped card number looks broken. */
            Text("•••• •••• •••• ${c.last4}", color = ink, maxLines = 1,
                 fontSize = 17.sp, letterSpacing = 1.5.sp, fontWeight = FontWeight.Medium)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(1f)) {
                    Text("CARD HOLDER", color = ink.copy(alpha = 0.6f),
                         fontSize = 8.sp, letterSpacing = 1.4.sp)
                    Text((DemoState.displayName ?: "NovaPay customer").uppercase(),
                         color = ink, fontSize = 12.sp, letterSpacing = 0.8.sp,
                         maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Text(c.type.uppercase() + if (c.contactless) "  )))" else "",
                     color = ink.copy(alpha = 0.75f), fontSize = 10.sp, letterSpacing = 1.sp)
            }
        }
        /* Frozen is drawn on the card, not written under it. A customer who has
           frozen a card wants to see that they have. */
        if (c.frozen || c.cancelled) {
            Box(Modifier.matchParentSize()
                .background(Color(0xCC0F1C33), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center) {
                Text(if (c.cancelled) "CANCELLED" else "FROZEN", color = ink,
                     fontSize = 15.sp, letterSpacing = 4.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun CardsScreen() {
    /* The note is owned by the card it belongs to, so the confirmation appears
       under the control that was pressed rather than at the foot of the screen. */
    var note by remember { mutableStateOf<Pair<String, String>?>(null) }
    var replacing by remember { mutableStateOf<String?>(null) }
    var ordering by remember { mutableStateOf(false) }

    val cards = DemoState.cards
    val live = cards.count { !it.cancelled }
    val dormant = cards.count { !it.activated && !it.cancelled }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {

        Card2 {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Stat(live.toString(), "cards on this\naccount", Modifier.weight(1f))
                Stat(dormant.toString(), "delivered, not\nactivated yet", Modifier.weight(1f))
                Stat(CARD_EVENTS.size.toString(), "card event types\nit can write",
                     Modifier.weight(1.1f))
            }
            Writes("Every control on this screen writes one row to " +
                   "fintech_card_events. The columns it fills are card_id, card_type, " +
                   "card_tier, action, reason, limit_type, limit_amount, " +
                   "delivery_status and days_since_order.")
        }

        cards.forEach { c ->
            Card2 {
                CardFace(c)
                Spacer(Modifier.height(12.dp))

                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(c.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        Text("${c.id} · ends ${c.last4}",
                             color = Color(0xFF64748B), fontSize = 11.sp)
                    }
                    Pill(c.statusLabel, when {
                        c.cancelled -> Tone.NEUTRAL
                        !c.activated -> Tone.WARN
                        c.frozen -> Tone.INFO
                        else -> Tone.GOOD
                    })
                }

                SectionHead("Card detail")
                Row2("Type", c.type)
                Row2("Tier", c.tier)
                /* A virtual card has no delivery to report. Printing
                   "delivered, 0 days since order" for one would be a true
                   sentence about a thing that never travelled. */
                Row2("Delivery", if (c.type == "virtual") "issued instantly"
                    else "${c.deliveryStatus}, ${c.daysSinceOrder} " +
                         (if (c.daysSinceOrder == 1) "day" else "days") + " since order")
                Row2("Daily spend limit", "$${"%,.0f".format(c.dailyLimit)}")
                Row2("Contactless", if (c.contactless) "On" else "Off")
                Row2("In wallet", if (c.inWallet) "Added" else "Not added")

                /* THE DORMANT CARD, named on screen rather than left for somebody
                   to notice. It is the one state on this table that a campaign is
                   built around, so the screen says which segment it lands in. */
                if (!c.activated && !c.cancelled && c.deliveryStatus == "delivered") {
                    Spacer(Modifier.height(10.dp))
                    Text("Delivered ${c.daysSinceOrder} days ago and never activated. " +
                         "This is the dormant-card segment: card_delivered with no " +
                         "card_activated after three days.",
                         fontSize = 11.sp, lineHeight = 15.sp,
                         color = Color(0xFF9A5B12))
                }

                if (c.cancelled) {
                    Writes("Cancelled cards keep their row history. The events already " +
                           "written are not removed by cancelling the card.")
                } else {
                    SectionHead("Controls")

                    if (!c.activated) {
                        Primary("Activate this card") {
                            DemoState.updateCard(c.id) { it.copy(activated = true) }
                            Events.card("card_activated", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "activate",
                                "days_since_order" to c.daysSinceOrder
                            ))
                            note = c.id to "${c.name} activated. days_since_order " +
                                   "${c.daysSinceOrder} went with the row, which is what " +
                                   "closes the dormant-card journey."
                        }
                    }

                    ControlGrid(buildList {
                        /* TWO CALLS RATHER THAN ONE WITH THE EVENT TYPE IN A
                           CONDITIONAL, and the payload is spelled out in each.
                           eventtest.js reads these call sites to check the event
                           type and every column against EVENT-MODEL.md, and it
                           can only read a literal. Folding the two into one call
                           would make this the one card control the suite cannot
                           see, which is worse than the repetition.

                           reason goes on the freeze only. Unfreezing has no
                           reason in the column's vocabulary, and user_request
                           would read as a reason to unfreeze rather than the
                           absence of one. */
                        if (c.activated && !c.frozen) add("Freeze" to {
                            DemoState.updateCard(c.id) { it.copy(frozen = true) }
                            Events.card("card_frozen", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "freeze",
                                "reason" to "user_request"
                            ))
                            note = c.id to "Frozen, reason user_request. The same event with " +
                                   "reason fraud_suspected is what opens the support " +
                                   "journey."
                        })
                        if (c.activated && c.frozen) add("Unfreeze" to {
                            DemoState.updateCard(c.id) { it.copy(frozen = false) }
                            Events.card("card_unfrozen", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "unfreeze"
                            ))
                            note = c.id to "Unfrozen. No reason on this one, by design."
                        })
                        /* A card that has not been activated has no PIN to read,
                           no contactless setting to change and no limit to move.
                           Offering those controls anyway would make the screen
                           fuller and less true, and it would bury the one control
                           the dormant card is there to demonstrate. */
                        if (c.activated) add("View PIN" to {
                            Events.card("pin_viewed", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "view_pin"
                            ))
                            note = c.id to "PIN 4 8 1 2, illustrative. Viewing a PIN is an event " +
                                   "because repeated views are a support signal."
                        })
                        if (c.activated) add("Change PIN" to {
                            Events.card("pin_changed", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "change_pin"
                            ))
                            note = c.id to "PIN changed. Row in fintech_card_events."
                        })
                        if (c.activated) add((if (c.contactless) "Contactless off" else "Contactless on") to {
                            val on = !c.contactless
                            DemoState.updateCard(c.id) { it.copy(contactless = on) }
                            Events.card("contactless_toggled", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier,
                                "action" to if (on) "contactless_on" else "contactless_off",
                                "limit_type" to "contactless"
                            ))
                            note = c.id to "Contactless " + (if (on) "on" else "off") +
                                   ", limit_type contactless."
                        })
                        if (c.activated) add("Raise daily limit" to {
                            val next = (c.dailyLimit + 250.0).coerceAtMost(5000.0)
                            DemoState.updateCard(c.id) { it.copy(dailyLimit = next) }
                            Events.card("card_limit_changed", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "limit_changed",
                                "limit_type" to "daily_spend",
                                "limit_amount" to Events.money(next)
                            ))
                            note = c.id to "Daily spend limit now $${"%,.0f".format(next)}, sent as " +
                                   "limit_amount with limit_type daily_spend."
                        })
                        if (c.activated) add("Lower daily limit" to {
                            val next = (c.dailyLimit - 250.0).coerceAtLeast(250.0)
                            DemoState.updateCard(c.id) { it.copy(dailyLimit = next) }
                            Events.card("card_limit_changed", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "limit_changed",
                                "limit_type" to "daily_spend",
                                "limit_amount" to Events.money(next)
                            ))
                            note = c.id to "Daily spend limit now $${"%,.0f".format(next)}."
                        })
                        if (c.activated && !c.inWallet) add("Add to wallet" to {
                            DemoState.updateCard(c.id) { it.copy(inWallet = true) }
                            Events.card("card_added_to_wallet", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "add_to_wallet"
                            ))
                            note = c.id to "Added to the device wallet. A card in a wallet and a " +
                                   "card that is not are different audiences."
                        })
                        add("Replace" to { replacing = if (replacing == c.id) null else c.id })
                        add("Cancel card" to {
                            DemoState.updateCard(c.id) { it.copy(cancelled = true, frozen = false) }
                            Events.card("card_cancelled", mapOf(
                                "card_id" to c.id, "card_type" to c.type,
                                "card_tier" to c.tier, "action" to "cancel",
                                "reason" to "user_request"
                            ))
                            note = c.id to "${c.name} cancelled, reason user_request."
                        })
                    })

                    /* REPLACEMENT ASKS WHY, because the reason is the whole value
                       of the row. lost, stolen and damaged are three different
                       conversations and the column exists to tell them apart. */
                    if (replacing == c.id) {
                        SectionHead("Why is it being replaced")
                        ControlGrid(listOf("lost", "stolen", "damaged").map { why ->
                            why.replaceFirstChar { ch -> ch.uppercase() } to {
                                Events.card("card_replaced", mapOf(
                                    "card_id" to c.id, "card_type" to c.type,
                                    "card_tier" to c.tier, "action" to "replace",
                                    "reason" to why, "delivery_status" to "ordered",
                                    "days_since_order" to 0
                                ))
                                DemoState.updateCard(c.id) {
                                    it.copy(deliveryStatus = "ordered", daysSinceOrder = 0,
                                            activated = false, frozen = false)
                                }
                                replacing = null
                                note = c.id to "Replacement ordered, reason $why. The card goes " +
                                       "back to delivery_status ordered and not activated."
                            }
                        })
                    }

                    /* DELIVERY IS A SEQUENCE, and it is the only part of this
                       table a customer never triggers. It is here because
                       delivery_status is a column a segment reads, and a demo
                       that cannot move it cannot show the tracking journey. */
                    if (c.deliveryStatus != "delivered") {
                        SectionHead("Delivery", c.deliveryStatus)
                        val next = when (c.deliveryStatus) {
                            "ordered" -> "printed"; "printed" -> "dispatched"; else -> "delivered"
                        }
                        ControlGrid(listOf("Advance to $next" to {
                            DemoState.updateCard(c.id) { it.copy(deliveryStatus = next) }
                            when (next) {
                                "dispatched" -> {
                                    Events.card("card_dispatched", mapOf(
                                        "card_id" to c.id, "card_type" to c.type,
                                        "card_tier" to c.tier, "action" to "dispatch",
                                        "delivery_status" to "dispatched",
                                        "days_since_order" to c.daysSinceOrder
                                    ))
                                    note = c.id to "delivery_status dispatched, and the row says so."
                                }
                                "delivered" -> {
                                    Events.card("card_delivered", mapOf(
                                        "card_id" to c.id, "card_type" to c.type,
                                        "card_tier" to c.tier, "action" to "deliver",
                                        "delivery_status" to "delivered",
                                        "days_since_order" to c.daysSinceOrder
                                    ))
                                    note = c.id to "delivery_status delivered. The dormant-card " +
                                           "clock starts here: three days without a " +
                                           "card_activated is the segment."
                                }
                                /* printed has no event type in the model, so it
                                   moves the state and writes nothing. Inventing
                                   card_printed to fill the gap would put a value
                                   in the table no segment could trust. */
                                else -> note = c.id to "delivery_status printed. The model has no " +
                                               "event type for this step, so no row was " +
                                               "written."
                            }
                        }))
                    }
                }

                note?.let { (owner, text) -> if (owner == c.id) NoteBlock(text) }
            }
        }

        Card2("Order a card") {
            Text("Three tiers, exactly as the website offers them. An ordered card " +
                 "arrives not activated, which is where the dormant-card journey starts.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            if (!ordering) {
                Primary("Order a new card") { ordering = true }
            } else {
                SectionHead("Choose a tier")
                ControlGrid(listOf(
                    Triple("Plus\nfree", "plus", "NovaPay Plus"),
                    Triple("Travel\n6.99 a month", "travel", "Travel card"),
                    Triple("Metal\n16.99 a month", "metal", "Metal card")
                ).map { (label, tier, name) ->
                    label to {
                        val card = DemoState.nextCard(name, tier, "physical")
                        DemoState.cards.add(card)
                        Events.card("card_ordered", mapOf(
                            "card_id" to card.id, "card_type" to "physical",
                            "card_tier" to tier, "action" to "order",
                            "delivery_status" to "ordered", "days_since_order" to 0
                        ))
                        ordering = false
                        note = "order" to "$name ordered, ending ${card.last4}. delivery_status " +
                               "ordered and not activated yet."
                    }
                })
            }
            SectionHead("Virtual card")
            Text("A virtual card is issued immediately, so it is active from the " +
                 "moment it exists and has no delivery to track.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            ControlGrid(listOf("Create a virtual card" to {
                val card = DemoState.nextCard("Virtual card", "plus", "virtual")
                DemoState.cards.add(card)
                Events.card("virtual_card_created", mapOf(
                    "card_id" to card.id, "card_type" to "virtual",
                    "card_tier" to "plus", "action" to "create"
                ))
                note = "order" to "Virtual card ${card.last4} created, card_type virtual."
            }))

            note?.let { (owner, text) -> if (owner == "order") NoteBlock(text) }
        }

        Note("No stock_count is ever sent from this screen. A card has no unit " +
             "count, and a fabricated figure poisons every segment built on it.")
    }
}

@Composable
fun GrowScreen() {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        StoriesRail(Screen.GROW, StoryPlacements.GROW)
        DemoState.POTS.forEach { p ->
            Card2(p.name) {
                Row2("Saved", "$${"%,.2f".format(p.saved)}")
                Row2("Target", "$${"%,.2f".format(p.target)}")
                Row2("Progress", "${p.pct}%", bold = true)
                Primary("Add money") {
                    /* current_amount, the balance AFTER the top up, exactly as
                       the website sends it. fintech_savings_events has no
                       amount or currency column: what a segment reads is how
                       full the pot is now, not the size of one deposit. */
                    Events.savings("pot_funded", mapOf(
                        "pot_id" to "POT-" + p.name.filter { it.isLetterOrDigit() },
                        "pot_name" to p.name,
                        "goal_amount" to Events.money(p.target),
                        "current_amount" to Events.money(p.saved),
                        "progress_pct" to p.pct, "funding_method" to "manual"
                    ))
                }
            }
        }
        /* REPLACE, and this is the shape the demo could not show at all until
           now. The app's own investing card is the FALLBACK: it is what the
           customer sees while no campaign targets this placement. The moment
           one does, the campaign content stands in its place rather than being
           inserted beside it, so a marketer can swap a generic house card for
           a targeted offer without an app release.

           Nothing about the SDK call differs from an insertion. What makes it
           a replacement is that the app renders its own card only while the
           element is empty, which InlineSlotOrElse decides by reading whether
           the element laid out with a height. */
        InlineSlotOrElse(Screen.GROW, InlinePlacements.GROW_GOALS,
                         does = "Content here REPLACES the investing card below. " +
                                "The app draws its own card only while this is empty.") {
            Card2("Investing") {
                Text("Capital at risk. Investments can fall as well as rise.",
                     color = Color(0xFF64748B), fontSize = 11.sp)
                Primary("Start investing") {
                    Events.investment("investment_made", mapOf(
                        "instrument_id" to "NPY-INV-ROBO",
                        "instrument_name" to "Managed portfolio",
                        "asset_class" to "managed_portfolio",
                        "amount" to Events.money(250.0),
                        "currency" to DemoState.CURRENCY, "risk_profile" to "balanced"
                    ))
                }
            }
        }
    }
}

private data class Product(
    val id: String,
    val name: String,
    val family: String,
    val categoryPath: String
)

@Composable
fun ProductsScreen(onNavigate: (String) -> Unit) {
    /* Category path uses the "A > B" shape Dengage expects, and matches the
       website's own feed so one segment covers both surfaces. */
    val products = listOf(
        Product("NPY-CRD-TRAVEL", "Travel card", "cards", "Products > Cards"),
        Product("NPY-CRD-METAL", "Metal card", "cards", "Products > Cards"),
        Product("NPY-INV-ROBO", "Managed portfolio", "investing", "Products > Investing")
    )
    LaunchedEffect(Unit) {
        /* No product_family: this is the LIST, not one family, and the
           column's vocabulary has no member for "all of them". An invented
           value here would land in every segment built on the column. */
        Events.product("product_viewed", mapOf(
            "funnel_step" to "viewed", "step_index" to 1
        ))
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        StoriesRail(Screen.PRODUCTS, StoryPlacements.PRODUCTS)
        products.forEach { p ->
            Card2(p.name) {
                Row2("Product id", p.id)
                Row2("Category", p.categoryPath)
                /* A product-level page view, the same row the website writes
                   when somebody opens a product page. It carries product_id
                   and category_path and NO price: a card has a monthly fee or
                   a rate, never a shelf price. This is what a browse-abandon
                   journey reads, and it needs no custom table. */
                Primary("View this product") {
                    Events.pageView("product", productId = p.id, categoryPath = p.categoryPath)
                    Events.product("product_viewed", mapOf(
                        "product_id" to p.id, "product_name" to p.name,
                        "product_family" to p.family, "funnel_step" to "viewed",
                        "step_index" to 1
                    ))
                }
                Primary("Shortlist") {
                    Events.product("product_shortlisted", mapOf(
                        "product_id" to p.id, "product_name" to p.name,
                        "product_family" to p.family, "funnel_step" to "shortlisted",
                        "step_index" to 2
                    ))
                }
            }
        }
        Card2("Apply") {
            Text("The application funnel, from a look at the plan to an approval, " +
                 "with the abandonment that a recovery campaign answers.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Primary("Apply for a plan") { onNavigate(Screen.APPLY) }
        }
        /* INSERT AFTER. The end of a browse screen is where a recommendation
           belongs: everything the customer came to read is behind them. */
        InlineSlot(Screen.PRODUCTS, InlinePlacements.PRODUCTS_END,
                   does = "Content here appears AFTER the product list and the apply " +
                          "card, at the end of the screen.")
        Note("No stock_count is ever sent from this app. A card has no unit count, " +
             "and a fabricated figure poisons every segment built on it.")
    }
}
