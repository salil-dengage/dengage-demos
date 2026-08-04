package com.dengagefintech.demo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengagefintech.demo.DemoState
import com.dengagefintech.demo.Events
import com.dengagefintech.demo.Screen

/* NovaPay's palette, taken from the website's stylesheet so the two demos are
   recognisably the same brand. */
private val Blue = Color(0xFF125CFA)
private val BlueDark = Color(0xFF0A3A9E)
private val Ink = Color(0xFF0F1C33)
private val Soft = Color(0xFF64748B)
private val Line = Color(0xFFE3E8F0)
private val Wash = Color(0xFFF7F9FC)

@Composable
fun NovaPayApp(screen: String, onNavigate: (String) -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(primary = Blue, onPrimary = Color.White)) {
        Scaffold(
            containerColor = Wash,
            topBar = { NovaPayBar(screen, onNavigate) },
            bottomBar = { if (screen != Screen.SIGN_IN) NovaPayTabs(screen, onNavigate) }
        ) { pad ->
            Box(Modifier.padding(pad)) {
                when (screen) {
                    Screen.SIGN_IN -> SignInScreen(onNavigate)
                    Screen.HOME -> HomeScreen(onNavigate)
                    Screen.MONEY -> MoneyScreen(onNavigate)
                    Screen.CARDS -> CardsScreen()
                    Screen.GROW -> GrowScreen()
                    Screen.PRODUCTS -> ProductsScreen(onNavigate)
                    Screen.INBOX -> InboxScreen()
                    Screen.EVENTS -> EventsScreen()
                    Screen.IDENTITY -> IdentityScreen()
                    Screen.TEST -> TestAreaScreen()
                    /* One composable for all five: a journey is a table of
                       steps, so a screen each would be five copies of the same
                       renderer differing only in data. */
                    Screen.SEND_MONEY, Screen.TOP_UP, Screen.VERIFY,
                    Screen.APPLY, Screen.DISPUTE -> JourneyScreen(screen)
                    else -> HomeScreen(onNavigate)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NovaPayBar(screen: String, onNavigate: (String) -> Unit) {
    TopAppBar(
        title = { Text("NovaPay", fontWeight = FontWeight.Bold) },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = BlueDark, titleContentColor = Color.White,
            actionIconContentColor = Color.White
        ),
        actions = {
            if (screen != Screen.SIGN_IN) {
                // The badge is the only thing that tells a customer a message
                // arrived: the inbox re-reads on open, so without it a campaign
                // files a message and the app shows no sign of it.
                val unread = com.dengagefintech.demo.push.NovaPayFcmService.unreadInbox
                TextButton(onClick = { onNavigate(Screen.INBOX) }) {
                    Text(if (unread > 0) "Inbox ($unread)" else "Inbox",
                         color = Color.White, fontSize = 13.sp)
                }
                TextButton(onClick = { onNavigate(Screen.EVENTS) }) {
                    Text("Events", color = Color.White, fontSize = 13.sp)
                }
                TextButton(onClick = { onNavigate(Screen.TEST) }) {
                    Text("Test", color = Color.White, fontSize = 13.sp)
                }
                TextButton(onClick = { onNavigate(Screen.IDENTITY) }) {
                    Text("IDs", color = Color.White, fontSize = 13.sp)
                }
            }
        }
    )
}

@Composable
private fun NovaPayTabs(screen: String, onNavigate: (String) -> Unit) {
    val tabs = listOf(
        Screen.HOME to "Home", Screen.MONEY to "Money", Screen.CARDS to "Cards",
        Screen.GROW to "Grow", Screen.PRODUCTS to "Products"
    )
    NavigationBar(containerColor = Color.White) {
        tabs.forEach { (id, label) ->
            NavigationBarItem(
                selected = screen == id,
                onClick = { onNavigate(id) },
                icon = {},
                label = { Text(label, fontSize = 11.sp) }
            )
        }
    }
}

/* ------------------------------------------------------------------ pieces */

@Composable
fun Card2(title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(14.dp), color = Color.White
    ) {
        Column(Modifier.padding(16.dp)) {
            if (title != null) {
                Text(title, fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
            }
            content()
        }
    }
}

/**
 * A label and a value on one line.
 *
 * BOTH SIDES ARE WEIGHTED, and that is not a style preference. Only the label
 * used to carry a weight, so the value was measured against the full width
 * first and the label divided up whatever was left. Beside a 36 character
 * identifier that left the label about one character wide, and `dn_device_id`
 * rendered as a vertical column of single letters. Weighting both sides fixes
 * the class rather than the one row it was noticed on.
 */
@Composable
fun Row2(left: String, right: String, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp),
        horizontalArrangement = Arrangement.SpaceBetween) {
        Text(left, color = Soft, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(right, color = Ink, fontSize = 13.sp, textAlign = TextAlign.End,
            modifier = Modifier.weight(1.4f),
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
    }
}

@Composable
fun Primary(text: String, onClick: () -> Unit) {
    Button(onClick = onClick, modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        shape = RoundedCornerShape(11.dp)) { Text(text) }
}

/* ------------------------------------------------------------------ pieces
   Everything below exists because a screen built only from full-width primary
   buttons reads as a form rather than a product. A money app puts its controls
   in a grid, its state in a badge and its headings above a rule. */

/**
 * A compact control, sized to sit two to a row.
 *
 * TWO LINES, NOT ONE. Half of a 360dp screen leaves about 144dp for a button,
 * and several of these labels are longer than that at 12sp. Held to one line
 * they are silently clipped, which is how a control ends up reading "Create a
 * virtual ca". Wrapping costs a row of height and loses nothing.
 */
@Composable
fun Secondary(text: String, modifier: Modifier = Modifier,
              enabled: Boolean = true, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick, modifier = modifier.heightIn(min = 42.dp), enabled = enabled,
        shape = RoundedCornerShape(10.dp),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Line)
    ) {
        Text(text, fontSize = 12.sp, lineHeight = 14.sp, maxLines = 2,
             textAlign = TextAlign.Center, color = Ink)
    }
}

/** Controls laid out two to a row, filling the width evenly. */
@Composable
fun ControlGrid(controls: List<Pair<String, () -> Unit>>) {
    controls.chunked(2).forEach { pair ->
        Row(Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            pair.forEach { (label, action) ->
                Secondary(label, Modifier.weight(1f)) { action() }
            }
            // An odd number of controls leaves the last row half empty rather
            // than stretching one button to twice the width of every other.
            if (pair.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}

/** Tones a status badge can carry. Named for what they mean, not their colour,
 *  so a screen never has to know which blue it is asking for. */
enum class Tone { NEUTRAL, GOOD, WARN, BAD, INFO }

@Composable
fun Pill(text: String, tone: Tone = Tone.NEUTRAL) {
    val (bg, fg) = when (tone) {
        Tone.GOOD -> Color(0xFFE7F6EC) to Color(0xFF1B7F43)
        Tone.WARN -> Color(0xFFFDF0E3) to Color(0xFF9A5B12)
        Tone.BAD -> Color(0xFFFBE9E9) to Color(0xFF9B2C2C)
        Tone.INFO -> Color(0xFFE8EFFE) to BlueDark
        Tone.NEUTRAL -> Wash to Soft
    }
    Box(Modifier.background(bg, RoundedCornerShape(7.dp))
                .padding(horizontal = 8.dp, vertical = 3.dp)) {
        Text(text, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = fg)
    }
}

/** A heading inside a card, with a rule under it. */
@Composable
fun SectionHead(text: String, trailing: String? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text(text.uppercase(), fontSize = 10.sp, letterSpacing = 1.2.sp,
             fontWeight = FontWeight.Bold, color = Soft, modifier = Modifier.weight(1f))
        if (trailing != null) Text(trailing, fontSize = 11.sp, color = Soft)
    }
    HorizontalDivider(color = Line)
}

/** A progress bar, drawn rather than themed so it matches the website's. */
@Composable
fun Bar(pct: Int, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(6.dp)
        .background(Line, RoundedCornerShape(3.dp))) {
        Box(Modifier.fillMaxWidth(pct.coerceIn(0, 100) / 100f).height(6.dp)
            .background(Blue, RoundedCornerShape(3.dp)))
    }
}

/** One figure with its caption, for the strip at the head of a screen. */
@Composable
fun Stat(value: String, caption: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(value, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text(caption, fontSize = 10.sp, color = Soft, lineHeight = 13.sp)
    }
}

/** What a control writes, said once under the controls that write it. A demo
 *  screen is only worth as much as the table it can be traced back to. */
@Composable
fun Writes(text: String) {
    Text(text, fontSize = 10.sp, color = Soft, lineHeight = 14.sp,
         modifier = Modifier.padding(top = 10.dp))
}

@Composable
fun Note(text: String) {
    Text(text, color = Soft, fontSize = 11.sp, lineHeight = 16.sp,
        modifier = Modifier.padding(16.dp), textAlign = TextAlign.Center)
}
