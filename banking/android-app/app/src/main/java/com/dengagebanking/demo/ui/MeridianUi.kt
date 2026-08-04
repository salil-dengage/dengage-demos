package com.dengagebanking.demo.ui

import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengage.sdk.Dengage
import com.dengagebanking.demo.DengageKeys
import com.dengagebanking.demo.data.DemoData
import com.dengagebanking.demo.events.MeridianEvents

/* The signed-in banking UI. Deliberately plain: this exists to carry the
   Dengage integration, not to win a design award, and every screen maps
   one-to-one onto a screen of the web portal so the two demo the same story.

   Events fire on the same split as the website:
     - things the CUSTOMER does fire on the tap
     - things the BANK detects fire once per session, guarded, so reopening a
       screen does not credit a second salary payment
*/

private val detected = mutableSetOf<String>()

private fun onceThisSession(name: String, block: () -> Unit) {
    if (detected.add(name)) block()
}

@Composable
fun MeridianApplicationUi(
    activity: AppCompatActivity,
    screen: String,
    onNavigate: (String) -> Unit
) {
    MeridianTheme {
        if (screen == DengageKeys.Screen.SIGN_IN) {
            SignInScreen(onSignedIn = { onNavigate(DengageKeys.Screen.OVERVIEW) })
            return@MeridianTheme
        }
        Scaffold(
            topBar = { MeridianTopBar(screen, onNavigate) },
            bottomBar = { MeridianNav(screen, onNavigate) }
        ) { padding ->
            Box(Modifier.padding(padding)) {
                when (screen) {
                    DengageKeys.Screen.OVERVIEW -> OverviewScreen()
                    DengageKeys.Screen.ACCOUNTS -> AccountsScreen()
                    DengageKeys.Screen.CARDS -> CardsScreen()
                    DengageKeys.Screen.PAYMENTS -> PaymentsScreen(onNavigate)
                    DengageKeys.Screen.WEALTH -> WealthScreen()
                    DengageKeys.Screen.PROFILE -> ProfileScreen(onNavigate)
                    DengageKeys.Screen.PRODUCTS -> ProductsScreen(onNavigate)
                    DengageKeys.Screen.INBOX -> InboxScreen()
                    DengageKeys.Screen.EVENTS -> EventsPanelScreen()
                    DengageKeys.Screen.IDENTITY -> IdentityScreen()
                    DengageKeys.Screen.TEST -> TestAreaScreen()
                    DengageKeys.Screen.SEND_MONEY -> SendMoneyScreen(onNavigate)
                    DengageKeys.Screen.APPLY -> ApplyScreen(onNavigate)
                    DengageKeys.Screen.COMPLAINT -> ComplaintScreen(onNavigate)
                    DengageKeys.Screen.APPOINTMENT -> AppointmentScreen(onNavigate)
                    else -> OverviewScreen()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MeridianTopBar(screen: String, onNavigate: (String) -> Unit) {
    TopAppBar(
        title = {
            Text(
                "MERIDIAN BANK",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                letterSpacing = 1.6.sp
            )
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MeridianColours.navy,
            titleContentColor = Color.White,
            actionIconContentColor = Color.White
        ),
        actions = {
            IconButton(onClick = { onNavigate(DengageKeys.Screen.PRODUCTS) }) {
                Icon(Icons.Filled.Search, contentDescription = "Products")
            }
            /* The badge is the whole point of an App Inbox in a demo: it is
               the visible difference between a push that interrupts once and a
               message the customer can come back to. Without it a campaign
               arrives, files itself, and the screen gives no sign until
               somebody thinks to open the Inbox. */
            IconButton(onClick = { onNavigate(DengageKeys.Screen.INBOX) }) {
                BadgedBox(
                    badge = {
                        if (InboxBridge.unread > 0) {
                            Badge { Text("${InboxBridge.unread}") }
                        }
                    }
                ) {
                    Icon(Icons.Filled.Email, contentDescription = "Inbox")
                }
            }
            IconButton(onClick = { onNavigate(DengageKeys.Screen.PROFILE) }) {
                Icon(Icons.Filled.Person, contentDescription = "Profile")
            }
            IconButton(onClick = { onNavigate(DengageKeys.Screen.EVENTS) }) {
                Icon(Icons.Filled.Bolt, contentDescription = "Events")
            }
            IconButton(onClick = { onNavigate(DengageKeys.Screen.TEST) }) {
                Icon(Icons.Filled.Science, contentDescription = "Test area")
            }
        }
    )
}

@Composable
private fun MeridianNav(screen: String, onNavigate: (String) -> Unit) {
    NavigationBar {
        data class Tab(val key: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)
        listOf(
            Tab(DengageKeys.Screen.OVERVIEW, "Home", Icons.Filled.Home),
            Tab(DengageKeys.Screen.ACCOUNTS, "Accounts", Icons.Filled.AccountBalance),
            Tab(DengageKeys.Screen.CARDS, "Cards", Icons.Filled.CreditCard),
            Tab(DengageKeys.Screen.PAYMENTS, "Pay", Icons.Filled.SwapHoriz),
            Tab(DengageKeys.Screen.WEALTH, "Wealth", Icons.Filled.ShowChart)
        ).forEach { tab ->
            NavigationBarItem(
                selected = screen == tab.key,
                onClick = { onNavigate(tab.key) },
                icon = { Icon(tab.icon, contentDescription = tab.label) },
                label = {
                    Text(
                        tab.label,
                        fontSize = 11.sp,
                        maxLines = 1,
                        softWrap = false,
                        overflow = TextOverflow.Visible
                    )
                }
            )
        }
    }
}

// ------------------------------------------------------------------ sign in

@Composable
private fun SignInScreen(onSignedIn: () -> Unit) {
    var email by remember { mutableStateOf("salil@dengage.com") }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Meridian Bank", fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text("Online banking demo. Nothing here is a real account.")
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("E-mail") }, singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                val key = MeridianEvents.normaliseContactKey(email)
                /* Binds this device to the contact. The same key on the
                   website produces one journey across both channels, which is
                   the reason the app sits in the same Dengage account. */
                Dengage.setContactKey(contactKey = key)
                MeridianEvents.isAuthenticated = true
                MeridianEvents.customerTier = "premier"
                /* No event fired here on purpose. "sign_in" is not one of the
                   86 types the nine tables carry, and inventing a type to
                   mark a moment is how a catalogue rots. Binding the contact
                   key IS the event: every row after this attaches to it. */
                onSignedIn()
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Sign in") }
        Spacer(Modifier.height(12.dp))
        Text(
            "Meridian Bank is a fictional company and this is a Dengage demo app. " +
                "No account is opened and no money moves.",
            fontSize = 11.sp
        )
    }
}

// ----------------------------------------------------------------- overview

@Composable
private fun OverviewScreen() {
    LaunchedEffect(Unit) {
        MeridianEvents.pageView("dashboard")

        DemoData.ACCOUNTS.forEach { a ->
            MeridianEvents.Account.balanceViewed(
                MeridianEvents.AccountInput(
                    accountIdMasked = a.masked, accountType = a.type,
                    balanceAmount = a.balance, balanceBand = DemoData.balanceBand(a.balance),
                    availableBalance = a.available,
                    overdraftLimit = a.overdraftLimit, overdraftUsed = a.overdraftUsed
                )
            )
        }

        onceThisSession("low_balance") {
            val c = DemoData.currentAccount
            if (c.balance < 500) {
                MeridianEvents.Account.lowBalance(
                    MeridianEvents.AccountInput(
                        accountIdMasked = c.masked, accountType = c.type,
                        balanceAmount = c.balance, balanceBand = DemoData.balanceBand(c.balance),
                        availableBalance = c.available,
                        overdraftLimit = c.overdraftLimit, overdraftUsed = c.overdraftUsed
                    )
                )
            }
        }
        onceThisSession("goal_reached") {
            DemoData.metGoal?.let { g ->
                MeridianEvents.Account.goalReached(
                    MeridianEvents.AccountInput(
                        accountIdMasked = "****9920", accountType = "savings",
                        goalName = g.name, goalTargetAmount = g.target, goalProgressPct = 100.0
                    )
                )
            }
        }
        onceThisSession("txn_detections") {
            DemoData.salaryTxn?.let { s ->
                val acct = DemoData.accountByMask(s.account)
                MeridianEvents.Account.salaryCredited(
                    MeridianEvents.AccountInput(
                        accountIdMasked = s.account,
                        accountType = acct?.type ?: "current_account",
                        balanceAmount = acct?.balance,
                        balanceBand = acct?.let { DemoData.balanceBand(it.balance) }
                    )
                )
                MeridianEvents.Transaction.posted(
                    MeridianEvents.TransactionInput(
                        transactionId = s.id, accountIdMasked = s.account, amount = s.amount,
                        direction = s.direction, merchantName = s.payee, payeeName = s.payee,
                        merchantCategory = s.category, isRecurring = s.recurring,
                        paymentChannel = "bank_transfer"
                    )
                )
            }
            DemoData.foreignTxn?.let { f ->
                MeridianEvents.Transaction.foreign(
                    MeridianEvents.TransactionInput(
                        transactionId = f.id, accountIdMasked = f.account, amount = f.amount,
                        direction = "debit", countryCode = f.country ?: "FR",
                        merchantName = f.payee, merchantCategory = f.category,
                        paymentChannel = "card"
                    )
                )
            }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        StoriesRail(DengageKeys.Screen.OVERVIEW)
        Spacer(Modifier.height(8.dp))
        Text("GOOD TO SEE YOU", fontSize = 11.sp, letterSpacing = 1.3.sp,
            fontWeight = FontWeight.Bold, color = MeridianColours.soft)
        Spacer(Modifier.height(4.dp))
        Text("Across all accounts", fontSize = 15.sp, color = MeridianColours.soft)
        Text(
            money(DemoData.ACCOUNTS.sumOf { it.balance }),
            fontSize = 34.sp, fontWeight = FontWeight.Bold
        )
        DemoData.ACCOUNTS.forEach { a ->
            MeridianCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(a.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(a.masked, fontSize = 12.sp, color = MeridianColours.soft)
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    money(a.balance),
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (a.balance < 0) MeridianColours.negative else MaterialTheme.colorScheme.onSurface
                )
                Text(
                    money(a.available) + " available",
                    fontSize = 12.sp,
                    color = MeridianColours.soft
                )
            }
        }
        InlineInApp(DengageKeys.Screen.OVERVIEW)
        Spacer(Modifier.height(8.dp))
        SectionTitle("Goals")
        DemoData.GOALS.forEach { g ->
            MeridianCard {
                Text(g.name, fontWeight = FontWeight.SemiBold)
                LinearProgressIndicator(
                    progress = { (g.saved / g.target).toFloat().coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                )
                Text(money(g.saved) + " of " + money(g.target), fontSize = 12.sp)
            }
        }
    }
}

// ----------------------------------------------------------------- accounts

@Composable
private fun AccountsScreen() {
    LaunchedEffect(Unit) {
        MeridianEvents.pageView("account")
        onceThisSession("subscriptions") {
            DemoData.subscriptions.forEach { s ->
                MeridianEvents.Transaction.posted(
                    MeridianEvents.TransactionInput(
                        transactionId = s.id, accountIdMasked = s.account, amount = s.amount,
                        direction = s.direction, merchantName = s.payee, payeeName = s.payee,
                        merchantCategory = s.category, isRecurring = true,
                        frequency = "monthly", paymentChannel = "direct_debit"
                    )
                )
            }
        }
    }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp)) {
        item { SectionTitle("Recent activity") }
        items(DemoData.TRANSACTIONS) { t ->
            MeridianCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(t.payee, fontWeight = FontWeight.SemiBold)
                        Text(t.category + if (t.recurring) " · recurring" else "", fontSize = 11.sp)
                    }
                    Text(
                        (if (t.direction == "credit") "+" else "-") + money(t.amount),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------------- cards

@Composable
private fun CardsScreen() {
    var frozen by remember { mutableStateOf(setOf<String>()) }
    var notice by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        MeridianEvents.pageView("cards")
        DemoData.CARDS.forEach {
            MeridianEvents.Card.viewed(
                MeridianEvents.CardInput(
                    cardIdMasked = "****" + it.lastFour, cardType = it.type,
                    cardProduct = if (it.type == "credit") "Meridian Platinum" else "Meridian Everyday"
                )
            )
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        SectionTitle("Your cards")
        DemoData.CARDS.forEach { c ->
            val isFrozen = frozen.contains(c.id)
            MeridianCard {
                Text(c.type.replaceFirstChar { it.uppercase() } + " card", fontWeight = FontWeight.SemiBold)
                Text("**** " + c.lastFour, fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                Button(onClick = {
                    if (isFrozen) {
                        frozen = frozen - c.id
                        MeridianEvents.Card.unfrozen(
                            MeridianEvents.CardInput(
                                cardIdMasked = "****" + c.lastFour, cardType = c.type
                            )
                        )
                    } else {
                        frozen = frozen + c.id
                        MeridianEvents.Card.frozen(
                            MeridianEvents.CardInput(
                                cardIdMasked = "****" + c.lastFour, cardType = c.type,
                                freezeReason = "customer_request"
                            )
                        )
                    }
                }) { Text(if (isFrozen) "Unfreeze" else "Freeze card") }
            }
        }
        Spacer(Modifier.height(8.dp))
        SectionTitle("Travel notice")
        MeridianCard {
            Text("Tell us where you are going so we do not block your card.", fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Button(
                enabled = !notice,
                onClick = {
                    notice = true
                    val c = DemoData.CARDS.last()
                    MeridianEvents.Card.travelNoticeSet(
                        MeridianEvents.CardInput(
                            cardIdMasked = "****" + c.lastFour, cardType = c.type,
                            travelCountry = "FR",
                            travelStartDate = DemoData.daysFromNow(14),
                            travelEndDate = DemoData.daysFromNow(24)
                        )
                    )
                }
            ) { Text(if (notice) "Notice set" else "Set travel notice") }
        }
    }
}

// ----------------------------------------------------------------- payments

@Composable
private fun PaymentsScreen(onNavigate: (String) -> Unit) {
    var cancelled by remember { mutableStateOf(setOf<String>()) }
    LaunchedEffect(Unit) { MeridianEvents.pageView("payments") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        SectionTitle("Move money")
        MeridianCard {
            Text("Send money to someone you have paid before.", fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Button(onClick = { onNavigate(DengageKeys.Screen.SEND_MONEY) }) { Text("Send money") }
        }
        Spacer(Modifier.height(8.dp))
        SectionTitle("Direct debits and standing orders")
        DemoData.MANDATES.forEach { m ->
            if (cancelled.contains(m.id)) return@forEach
            MeridianCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(m.payee, fontWeight = FontWeight.SemiBold)
                        Text(money(m.amount) + " monthly", fontSize = 12.sp)
                    }
                    TextButton(onClick = {
                        cancelled = cancelled + m.id
                        MeridianEvents.Transaction.directDebitCancelled(
                            MeridianEvents.TransactionInput(
                                transactionId = m.id, accountIdMasked = "****4471",
                                amount = m.amount, direction = "debit", payeeName = m.payee,
                                merchantName = m.payee,
                                merchantCategory = if (m.payee.contains("Mortgage", true)) "mortgage" else "utilities",
                                frequency = "monthly", isRecurring = true,
                                paymentChannel = "direct_debit"
                            )
                        )
                    }) { Text("Cancel") }
                }
            }
        }
    }
}

// ------------------------------------------------------------------- wealth

@Composable
private fun WealthScreen() {
    LaunchedEffect(Unit) {
        MeridianEvents.pageView("wealth")
        MeridianEvents.Wealth.portfolioViewed(
            MeridianEvents.WealthInput(
                portfolioId = DemoData.PORTFOLIO_ID,
                portfolioValueBand = DemoData.PORTFOLIO_VALUE_BAND,
                riskProfile = DemoData.RISK_PROFILE, adviserName = DemoData.ADVISER,
                performanceBand = DemoData.PERFORMANCE_BAND
            )
        )
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        SectionTitle("Managed Portfolio")
        MeridianCard {
            Text("Portfolio value", fontSize = 12.sp)
            Text("250,000 to 500,000", fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Risk profile: " + DemoData.RISK_PROFILE, fontSize = 12.sp)
            Text("Reviewed quarterly with " + DemoData.ADVISER, fontSize = 12.sp)
        }
        SectionTitle("Holdings")
        DemoData.HOLDINGS.forEach { h ->
            MeridianCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = {
                        MeridianEvents.Wealth.holdingViewed(
                            MeridianEvents.WealthInput(
                                portfolioId = DemoData.PORTFOLIO_ID,
                                holdingName = h.name, assetClass = h.assetClass
                            )
                        )
                    }) { Text(h.name) }
                    Text(h.weight.toString() + "%")
                }
            }
        }
        Button(
            onClick = {
                MeridianEvents.Wealth.adviserContacted(
                    MeridianEvents.WealthInput(
                        portfolioId = DemoData.PORTFOLIO_ID, adviserName = DemoData.ADVISER
                    )
                )
            },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
        ) { Text("Book the review") }
        Spacer(Modifier.height(8.dp))
        Text(
            "The value of investments can fall as well as rise and you may get back " +
                "less than you invested.",
            fontSize = 11.sp
        )
    }
}

// ------------------------------------------------------------------ profile

@Composable
private fun ProfileScreen(onNavigate: (String) -> Unit) {
    var emailConsent by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { MeridianEvents.pageView("profile") }
    /* Scrolls: the complaint card took this screen past a small handset. */
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        SectionTitle("You and your preferences")
        MeridianCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text("E-mail about products")
                Switch(checked = emailConsent, onCheckedChange = {
                    emailConsent = it
                    if (it) {
                        MeridianEvents.Engagement.consentGranted(
                            MeridianEvents.EngagementInput(consentEmail = true, placement = "app_profile")
                        )
                    } else {
                        MeridianEvents.Engagement.consentWithdrawn(
                            MeridianEvents.EngagementInput(consentEmail = false, placement = "app_profile")
                        )
                    }
                })
            }
        }
        MeridianCard {
            Text("Identifiers", fontWeight = FontWeight.SemiBold)
            Text(
                "Contact key, device id, push token, advertising id and the rest, " +
                    "each one copyable.",
                fontSize = 12.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(8.dp))
            Button(onClick = { onNavigate(DengageKeys.Screen.IDENTITY) }) { Text("Open identifiers") }
        }
        MeridianCard {
            Text("Something gone wrong?", fontWeight = FontWeight.SemiBold)
            Text(
                "A complaint writes complaint_raised, and the right campaign " +
                    "response is to stop selling to you rather than to sell harder.",
                fontSize = 12.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { onNavigate(DengageKeys.Screen.COMPLAINT) }) {
                Text("Raise a complaint")
            }
        }
        TagsCard()
        GeofenceCard()
    }
}

// ----------------------------------------------------------------- products

@Composable
private fun ProductsScreen(onNavigate: (String) -> Unit) {
    LaunchedEffect(Unit) { MeridianEvents.pageView("category", categoryPath = "Products") }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp)) {
        item {
            SectionTitle("Take it further")
            MeridianCard {
                Text("Apply for the Platinum card, or talk it through with an adviser.",
                    fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                Row {
                    Button(onClick = { onNavigate(DengageKeys.Screen.APPLY) }) { Text("Apply") }
                    Spacer(Modifier.width(8.dp))
                    OutlinedButton(onClick = { onNavigate(DengageKeys.Screen.APPOINTMENT) }) {
                        Text("Book an adviser")
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            SectionTitle("Products")
        }
        items(DemoData.PRODUCTS) { p ->
            MeridianCard {
                Text(p.name, fontWeight = FontWeight.SemiBold)
                Text(p.rateDisplay, fontSize = 13.sp)
                Text(p.summary, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                Row {
                    TextButton(onClick = {
                        MeridianEvents.pageView("product", p.id, p.categoryPath)
                        MeridianEvents.Product.viewed(
                            MeridianEvents.ProductInput(
                                productId = p.id, productName = p.name,
                                productCategory = p.categoryPath.substringAfterLast('>').trim(),
                                headlineRate = p.headlineRate, rateType = p.rateType,
                                termMonths = p.termMonths
                            ),
                            listName = "app_products", position = DemoData.PRODUCTS.indexOf(p) + 1
                        )
                    }) { Text("View") }
                    TextButton(onClick = {
                        MeridianEvents.Product.shortlisted(
                            MeridianEvents.ProductInput(
                                productId = p.id, productName = p.name,
                                productCategory = p.categoryPath.substringAfterLast('>').trim()
                            )
                        )
                    }) { Text("Shortlist") }
                }
            }
        }
    }
}

// -------------------------------------------------------------------- inbox

@Composable
private fun InboxScreen() {
    val messages = remember { mutableStateListOf<InboxRow>() }
    var status by remember { mutableStateOf("Loading...") }

    /* Named, because the inbox is the one screen where "nothing here" is
       ambiguous: it means either no message was sent or the screen loaded
       before one arrived. A refresh separates the two in the room, without
       leaving and coming back. */
    fun refresh() {
        status = "Loading..."
        InboxBridge.load(
            onLoaded = { rows ->
                messages.clear()
                messages.addAll(rows)
                status = if (rows.isEmpty()) {
                    "No messages. Only a real campaign send with save to " +
                        "inbox ticked adds one; a panel Test Send does not."
                } else {
                    "${rows.size} message${if (rows.size == 1) "" else "s"}."
                }
            },
            onError = { status = it }
        )
    }

    LaunchedEffect(Unit) {
        MeridianEvents.pageView("inbox")
        refresh()
    }

    /* A plain scrolling Column, not a LazyColumn, and that is deliberate.

       On 2 August the SDK returned a message, InboxBridge logged the mapped
       row, and the screen stayed empty. Everything up to the row was proved
       good from the device log, which left the list itself: a LazyColumn does
       not read `messages` in this composition, it reads it inside its own item
       provider, so whether the screen redraws depends on that observation
       rather than on this function. `messages.forEach` reads the state list
       here, in InboxScreen, which is the one place recomposition is certain.

       The inbox is capped at 20 rows by InboxBridge, so laziness buys nothing
       and cost a demo. The status line carries the count for the same reason:
       "1 message." on screen next to an empty list would have named this in
       one look instead of four rebuilds. */
    Column(
        Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())
    ) {
        SectionTitle("Inbox")
        if (status.isNotEmpty()) Text(status, fontSize = 13.sp)
        Row {
            TextButton(onClick = { refresh() }) { Text("Refresh") }
            /* Clearing is a demo convenience, not a feature of the bank: an
               inbox carrying last week's campaign is the wrong first thing a
               prospect sees.

               It clears both halves, and they are not equally reversible. The
               seeded rows come back on the next launch of the app; a real
               campaign message is deleted on the platform and does not. Say so
               on screen rather than in a tooltip nobody reads.

               The list is emptied locally in the same tap, so the screen
               reflects the delete immediately, and the re-read is left to
               Refresh, which is one tap away and shows what the platform
               holds. */
            TextButton(
                onClick = {
                    InboxBridge.deleteAll()
                    messages.clear()
                    status = "Cleared for this session. Restart the app to " +
                        "bring the sample messages back."
                },
                enabled = messages.isNotEmpty()
            ) { Text("Clear all") }
        }
        messages.forEach { m ->
            MeridianCard {
                Text(m.title, fontWeight = FontWeight.SemiBold)
                Text(m.body, fontSize = 12.sp)
                /* Only a real message gets the control, because marking a
                   seeded row as read would report nothing to anyone, and a
                   button that does nothing is worse in a demo than no button.
                   It also makes the distinction visible: the row carrying
                   "Mark as read" is the one that came from a campaign. */
                if (!m.local) {
                    TextButton(onClick = { InboxBridge.markClicked(m) }) { Text("Mark as read") }
                }
            }
        }
    }
}

// ------------------------------------------------------------------- pieces

@Composable
private fun SectionTitle(text: String) {
    Column(Modifier.padding(top = 18.dp)) {
        Text(
            text.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.3.sp,
            color = MeridianColours.soft
        )
        GoldRule()
    }
}

@Composable
private fun MeridianCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
    ) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

/** A gold rule under a section heading. The website uses the same device to
 *  separate sections without drawing a box around everything. */
@Composable
private fun GoldRule() {
    Box(
        Modifier.padding(top = 2.dp, bottom = 10.dp)
            .width(34.dp).height(2.dp)
            .background(MeridianColours.gold)
    )
}

private fun money(v: Double): String {
    val negative = v < 0
    val s = String.format("%,.2f", kotlin.math.abs(v))
    return (if (negative) "-£" else "£") + s
}
