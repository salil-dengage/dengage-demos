package com.dengagefintech.demo.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengage.sdk.Dengage
import com.dengage.sdk.callback.DengageCallback
import com.dengage.sdk.callback.DengageError
import com.dengage.sdk.domain.inboxmessage.model.InboxMessage
import com.dengage.sdk.domain.tag.model.TagItem
import com.dengage.sdk.ui.inappmessage.InAppInlineElement
import com.dengage.sdk.ui.story.StoriesListView
import androidx.compose.ui.viewinterop.AndroidView
import com.dengagefintech.demo.*
import com.dengagefintech.demo.push.NovaPayFcmService

/**
 * In-App INLINE placements.
 *
 * THE APP NAMES THESE, NOT THE PANEL. `showInlineInApp` takes a propertyId as a
 * plain String that this app chooses; the panel then targets that string when
 * you build a Real Time In-App inline campaign. So these ids are a CONTRACT the
 * app publishes, exactly like the `dn_inline_target_*` slot ids on the website,
 * and they are deliberately named to mirror the web vocabulary so a marketer
 * sees the same words on both surfaces.
 *
 * An earlier version of this file left them blank waiting for the panel to
 * issue them. That was backwards and it meant no inline campaign could be built
 * at all.
 *
 * A placement is identified by the pair (screen name, property id), so the same
 * id on a different screen is a different placement.
 *
 * WHAT A PLACEMENT CAN DO. Three relationships, and the five below are chosen
 * to show all three rather than five variations of one. INSERT ABOVE a piece of
 * the app, INSERT BELOW it, or REPLACE it outright. Nothing in the SDK call
 * distinguishes them: the app decides by where it mounts the element and, for a
 * replacement, by rendering its own card only while the element is empty.
 *
 * | Property id                   | Screen   | Does                            |
 * |-------------------------------|----------|---------------------------------|
 * | novapay_home_below_balance    | home     | inserts BELOW the balance card  |
 * | novapay_money_top             | money    | inserts ABOVE the transactions  |
 * | novapay_money_subscriptions   | money    | inserts BELOW the transactions  |
 * | novapay_grow_goals            | grow     | REPLACES the investing card     |
 * | novapay_products_end          | products | inserts AFTER the product list  |
 */
object InlinePlacements {
    const val HOME_BELOW_BALANCE  = "novapay_home_below_balance"
    const val MONEY_TOP           = "novapay_money_top"
    const val MONEY_SUBSCRIPTIONS = "novapay_money_subscriptions"
    const val GROW_GOALS          = "novapay_grow_goals"
    const val PRODUCTS_END        = "novapay_products_end"

    /** Screen name each placement lives on, for the Test Area listing. */
    val ALL = listOf(
        Triple(HOME_BELOW_BALANCE, Screen.HOME, "inserts BELOW the balance card"),
        Triple(MONEY_TOP, Screen.MONEY, "inserts ABOVE the transaction list"),
        Triple(MONEY_SUBSCRIPTIONS, Screen.MONEY, "inserts BELOW the transaction list"),
        Triple(GROW_GOALS, Screen.GROW, "REPLACES the investing card"),
        Triple(PRODUCTS_END, Screen.PRODUCTS, "inserts AFTER the product list")
    )
}

/**
 * App STORIES placements.
 *
 * THE APP NAMES THESE TOO. An earlier version of this file kept a single blank
 * STORIES_PROPERTY_ID and described Stories as waiting on an id the panel had
 * to issue. That was the same mistake the inline placements above were
 * corrected for, and it had the same cost: no Story campaign could be built at
 * all, because there was no id to target.
 *
 * `showStoriesList` takes `storyPropertyId` as a plain String argument, exactly
 * as `showInlineInApp` takes `propertyId`. Nothing in the call reads an id back
 * from the platform. So the vocabulary is a CONTRACT the app publishes and the
 * campaign matches, and it is declared here for the same reason the inline one
 * is: a marketer can build the campaign before the app ships.
 *
 * A placement is the pair (screen name, story property id), so the same id on
 * a different screen is a different rail.
 *
 * | Property id               | Screen   | Sits                        |
 * |---------------------------|----------|-----------------------------|
 * | novapay_stories_home      | home     | under the balance card      |
 * | novapay_stories_grow      | grow     | above the savings goals     |
 * | novapay_stories_products  | products | at the head of the products |
 */
object StoryPlacements {
    const val HOME     = "novapay_stories_home"
    const val GROW     = "novapay_stories_grow"
    const val PRODUCTS = "novapay_stories_products"

    /** Screen name each rail lives on, for the Test Area listing. */
    val ALL = listOf(
        Triple(HOME, Screen.HOME, "under the balance card"),
        Triple(GROW, Screen.GROW, "above the savings goals"),
        Triple(PRODUCTS, Screen.PRODUCTS, "at the head of the products")
    )
}

/* ============================================================================
   MAKING A PLACEMENT VISIBLE WHEN NOTHING IS IN IT

   An inline placement is not a blank area waiting to be filled. The point of
   the surface is that Dengage can INSERT ABOVE a piece of the app, INSERT
   BELOW it, or REPLACE it outright, and none of that is demonstrable if an
   unfilled slot renders nothing at all.

   That was the state of this file: five slots, all of them insertions, every
   one invisible until a campaign existed. A prospect could be told there was a
   slot under the balance card and had to take it on faith.

   So an empty slot draws a MARKER instead: a dashed outline naming the
   property id and what a campaign there would do. It is deliberately not
   subtle and it is deliberately not a hole. Markers are on by default and the
   Test Area turns them off, which is what a live demo does once real campaigns
   are running.

   REPLACE needs to know whether the slot filled, and the SDK offers no
   callback for it. The element is a WebView, so the app reads the only honest
   signal there is: whether it laid out with a height. That is observation, not
   inference. When it has height the campaign content stands in place of the
   app's own card; when it does not, the card shows.
   ========================================================================== */

/** Markers are a demo affordance, so they are ON until somebody turns them
 *  off. Process-wide rather than per screen: a demo either shows placements or
 *  it does not, and hunting a toggle per screen mid-call is worse than either. */
object SlotMarkers {
    var enabled by mutableStateOf(true)
}

/** The dashed placeholder an empty slot draws. Names the id a campaign has to
 *  target and the relationship it would have to the app's own content. */
@Composable
private fun SlotMarker(propertyId: String, does: String, kind: String = "INLINE PLACEMENT") {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .drawBehind {
                drawRoundRect(
                    color = Color(0xFF9AB0D4),
                    style = Stroke(
                        width = 3f,
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f))
                    ),
                    cornerRadius = CornerRadius(28f, 28f)
                )
            }
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Column {
            Text(kind, fontSize = 9.sp, letterSpacing = 1.5.sp,
                 fontWeight = FontWeight.Bold, color = Color(0xFF7C93BC))
            Spacer(Modifier.height(3.dp))
            Text(propertyId, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                 color = Color(0xFF2C4870))
            Text(does, fontSize = 11.sp, color = Color(0xFF7C93BC), lineHeight = 15.sp)
        }
    }
}

/**
 * The Stories rail.
 *
 * Wraps its content rather than pinning a height. This read .height(104.dp),
 * and that one line undid everything hideIfNotFound buys: the flag hides the
 * INNER view when no Story set targets the pair, but a fixed height on the
 * Compose wrapper reserves the space anyway, so all three rails sat as a
 * permanent empty band on Home, Grow and Products.
 *
 * StoriesListView is a View rather than a composable, so it is hosted through
 * AndroidView, and the SDK requires the hosting activity, which is why this
 * returns early when the context is not one.
 */
@Composable
fun StoriesRail(screenName: String, propertyId: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val activity = context as? androidx.appcompat.app.AppCompatActivity ?: return
    var filled by remember(propertyId) { mutableStateOf(false) }

    if (!filled && SlotMarkers.enabled) {
        SlotMarker(
            propertyId,
            "A Story set targeting this id appears here, pushing the content " +
            "below it down. Nothing else on the screen has to change.",
            kind = "STORIES PLACEMENT"
        )
    }

    AndroidView(
        modifier = modifier.fillMaxWidth().wrapContentHeight(),
        factory = { ctx ->
            StoriesListView(ctx).apply {
                layoutParams = android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
                )
                addOnLayoutChangeListener { v, _, t, _, b, _, _, _, _ ->
                    filled = (b - t) > 0 && v.visibility == android.view.View.VISIBLE
                }
            }
        },
        update = { view ->
            runCatching {
                Dengage.showStoriesList(
                    screenName = screenName,
                    storiesListView = view,
                    activity = activity,
                    customParams = null,
                    storyPropertyId = propertyId,
                    hideIfNotFound = true
                )
            }.onFailure { Log.e("NovaPayStories", "showStoriesList failed", it) }
        }
    )
}

/**
 * An In-App INLINE placement, used as an INSERTION point.
 *
 * Whether it reads as "above the transaction list" or "below the balance card"
 * is decided by where it is mounted in the screen, not by anything the SDK is
 * told. That is the whole mobile inline model: the app hands the SDK a view and
 * the position is the app's.
 *
 * Empty, it draws a marker naming the id, so the placement can be pointed at
 * before any campaign exists.
 *
 * InAppInlineElement extends WebView, so it is hosted through AndroidView
 * rather than drawn in Compose.
 */
@Composable
fun InlineSlot(screenName: String, propertyId: String, does: String = "") {
    var filled by remember(propertyId) { mutableStateOf(false) }

    if (!filled && SlotMarkers.enabled) {
        SlotMarker(propertyId, if (does.isNotBlank()) does
                   else "A Real Time inline campaign targeting this id appears here.")
    }
    InlineElement(screenName, propertyId) { filled = it }
}

/**
 * The same placement used to REPLACE the app's own content.
 *
 * `fallback` is what the customer sees until a campaign targets the pair. Once
 * one does, the campaign content stands in its place. This is the third thing
 * an inline placement can do and the one the demo could not show at all.
 *
 * The fill signal is the element's own laid-out height, because the SDK exposes
 * no callback. Reading the view is observation; assuming would be guessing.
 */
@Composable
fun InlineSlotOrElse(
    screenName: String,
    propertyId: String,
    does: String = "",
    fallback: @Composable () -> Unit
) {
    var filled by remember(propertyId) { mutableStateOf(false) }

    if (!filled) {
        if (SlotMarkers.enabled) {
            SlotMarker(propertyId, if (does.isNotBlank()) does
                       else "A campaign targeting this id REPLACES the card below.")
        }
        fallback()
    }
    InlineElement(screenName, propertyId) { filled = it }
}

/** The hosted element itself, shared by both shapes above. */
@Composable
private fun InlineElement(
    screenName: String,
    propertyId: String,
    onFilled: (Boolean) -> Unit
) {
    val ctx = LocalContext.current
    val activity = ctx as? android.app.Activity ?: return
    /* No vertical padding: it applies whether or not the element has content,
       so a collapsed slot used to leave 12dp of dead space and a screen with
       two left 24dp. Card2 already puts 6dp above and below every card. */
    AndroidView(
        modifier = Modifier.fillMaxWidth().wrapContentHeight().padding(horizontal = 16.dp),
        factory = { c ->
            InAppInlineElement(c).apply {
                layoutParams = android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
                )
                addOnLayoutChangeListener { v, _, t, _, b, _, _, _, _ ->
                    onFilled((b - t) > 0 && v.visibility == android.view.View.VISIBLE)
                }
            }
        },
        update = { element ->
            runCatching {
                // hideIfNotFound = true: with no campaign targeting this
                // placement the element collapses instead of leaving a gap.
                Dengage.showInlineInApp(
                    screenName, element, activity,
                    HashMap<String, String>(), propertyId, true
                )
            }
        }
    )
}

private fun copy(ctx: Context, label: String, value: String) {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText(label, value))
}

/* --------------------------------------------------------------- identifiers
   Read from the SDK via getSubscription(), NOT from what the app believes it
   sent, so the screen reports what the platform actually holds. This is what
   turns "the push did not arrive" into an answerable question in ten seconds. */
@Composable
fun IdentityScreen() {
    val ctx = LocalContext.current
    var rows by remember { mutableStateOf(listOf<Pair<String, String>>()) }

    fun refresh() {
        val s = runCatching { Dengage.getSubscription() }.getOrNull()
        rows = listOf(
            "Contact key" to (s?.contactKey ?: "(anonymous)"),
            "Device id" to (s?.deviceId ?: ""),
            "Advertising id" to (s?.advertisingId ?: ""),
            "Push token" to (s?.token ?: ""),
            "Token type" to (s?.tokenType ?: ""),
            "Permission" to (s?.permission?.toString() ?: ""),
            "App version" to DengageKeys.APP_VERSION,
            "App public id" to DengageKeys.APP_PUBLIC_ID,
            "Integration key" to DengageKeys.FIREBASE_INTEGRATION_KEY,
            "Tracking permission" to runCatching { Dengage.getTrackingPermission().toString() }.getOrDefault("?"),
            "In-App fetched" to (DengageCompat.isInAppFetched()?.toString() ?: "unknown"),
            "Last deep link" to (MainActivity.lastDeepLink ?: "(none yet)"),
            "Signed in as" to (DemoState.email ?: "(nobody)"),
            "Resolved contact key" to (DemoState.email?.let { Identity.resolve(it) } ?: "(anonymous)")
        )
    }
    LaunchedEffect(Unit) { refresh() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        Card2("Identifiers") {
            Text("Read from the SDK, not from what this app believes it sent.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            rows.forEach { (k, v) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(k, color = Color(0xFF64748B), fontSize = 11.sp)
                        Text(if (v.length > 46) v.take(46) + "…" else v.ifBlank { "(empty)" },
                             fontSize = 12.sp, color = Color(0xFF0F1C33))
                    }
                    TextButton(onClick = { copy(ctx, k, v) }) { Text("Copy", fontSize = 11.sp) }
                }
            }
            Primary("Refresh") { refresh() }
            Primary("Copy all") {
                copy(ctx, "NovaPay identifiers", rows.joinToString("\n") { "${it.first}: ${it.second}" })
            }
        }
    }
}

/* --------------------------------------------------------------------- inbox
   Four things to know before reading this surface:

   1. TWO MAILBOXES. A handset with a contact key set reads the CONTACT inbox;
      a handset without one reads the DEVICE inbox. Address an inbox send to
      the contact key, or it lands in the mailbox this handset is not reading.

   2. ONLY A REAL CAMPAIGN SEND FILLS IT. The inbox is server side: the row is
      written when the platform sends. A panel Test Send does not save to the
      inbox; a real campaign send with save to inbox ticked does. A locally
      built push never reaches the platform, so it is not filed either.

   3. A NEW INSTALL OPENS ON NOTHING, which sells nothing. So three of our own
      service messages are seeded and real rows are appended below them.

   4. THE BADGE. The inbox re-reads on open, so the unread badge is driven from
      addToInbox in the push payload, which is the platform saying it filed the
      message: a real campaign moves it, a Test Send does not, a local push
      does not. All three correct.

   And the diagnostic that settles a count question: print BOTH counts. Once
   seeded rows exist, "0 message(s)" beside three visible rows reads wrong.
   When a screen and its data disagree, put the count on the screen. */

private data class SeedRow(val id: String, val title: String, val body: String)

private val SEEDED = listOf(
    SeedRow("novapay-seed-1", "Your July statement is ready",
            "Twelve months of statements are always available in the app."),
    SeedRow("novapay-seed-2", "New: round-ups on every card",
            "Round every purchase to the nearest dollar and move the change into a goal."),
    SeedRow("novapay-seed-3", "Travel plan, no FX markup",
            "Spending abroad this summer? The Travel plan applies no markup on conversion.")
)

@Composable
fun InboxScreen() {
    var messages by remember { mutableStateOf(listOf<InboxMessage>()) }
    var status by remember { mutableStateOf("not loaded yet") }
    var seedsCleared by remember { mutableStateOf(false) }   // in memory only, so seeds return

    fun load() {
        status = "loading..."
        runCatching {
            // Named, never positional. The SDK takes limit before offset, so
            // a positional (0, 20) asks for limit = 0 and the server answers
            // 400 Invalid Value: limit, leaving the inbox permanently empty
            // with nothing on screen to say why. Named arguments cannot be
            // transposed by accident, and match the Meridian call site.
            Dengage.getInboxMessages(limit = 20, offset = 0,
                dengageCallback = object : DengageCallback<MutableList<InboxMessage>> {
                override fun onResult(result: MutableList<InboxMessage>) {
                    // The callback arrives on whatever thread the request
                    // finished on. Hop once, here in the bridge, not at each
                    // call site.
                    Handler(Looper.getMainLooper()).post {
                        messages = result.toList()
                        val shown = result.size + (if (seedsCleared) 0 else SEEDED.size)
                        status = "${result.size} from Dengage, $shown shown"
                        Log.d("NovaPayInbox", status)
                        NovaPayFcmService.unreadInbox = 0   // cleared on READ, not on navigation
                    }
                }
                override fun onError(error: DengageError) {
                    Handler(Looper.getMainLooper()).post {
                        // An error must still leave the seeded rows on screen: on
                        // bad wifi an empty screen and a failed request look the same.
                        status = "error: ${error.errorMessage}. Seeded rows below are unaffected."
                    }
                }
            })
        }.onFailure { status = "call failed: ${it.message}" }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
        Card2("App Inbox") {
            val mode = if (DemoState.signedIn) "the contact inbox" else "the device inbox"
            Text("This handset is reading: $mode", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
            Text("Send inbox messages to the CONTACT KEY, so they land in the mailbox " +
                 "this handset is reading.\n\n" +
                 "Only a real campaign send with save to inbox ticked fills this. A " +
                 "panel Test Send does not save to the inbox, and a locally built push " +
                 "never reaches the platform.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            Text(status, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            if (NovaPayFcmService.unreadInbox > 0) {
                Text("${NovaPayFcmService.unreadInbox} unread, the platform said it filed them",
                     fontSize = 11.sp, color = Color(0xFF125CFA))
            }
            Primary("Load inbox") { load() }
            /* Marks every real row read in one call, which is what a customer
               tapping "mark all as read" would do. It cannot touch the seeded
               rows: the platform has never heard of those ids. */
            Primary("Mark all as read") {
                runCatching { Dengage.setAllInboxMessagesAsClicked() }
                    .onSuccess {
                        NovaPayFcmService.unreadInbox = 0
                        status = "marked every real row read. Reload to see it reflected."
                    }
                    .onFailure { status = "mark all failed: ${it.message}" }
            }
            Primary("Clear all") {
                // Two halves, not equally reversible, so the note is not optional.
                runCatching { Dengage.deleteAllInboxMessages() }
                seedsCleared = true
                messages = emptyList()
                status = "cleared. The seeded rows come back on next launch. Real campaign " +
                         "messages are deleted on the platform and do not."
                // deleteAllInboxMessages returns Unit with no callback, so do NOT
                // re-read here: a re-read races the delete and can redraw the
                // rows that were just cleared.
            }
        }

        messages.forEach { m ->
            Card2(m.data.title ?: "(no title)") {
                Text(m.data.message ?: "", fontSize = 12.sp, color = Color(0xFF64748B))
                Text("from Dengage", fontSize = 10.sp, color = Color(0xFF9AA5B5))
                Primary("Mark as read") {
                    // Only real rows. Passing a seeded id to this is a request
                    // about a message the platform has never seen.
                    runCatching { Dengage.setInboxMessageAsClicked(m.id) }
                }
                /* Per-row delete, which is the control a customer actually has.
                   The row goes on the platform and does not come back, so the
                   list is trimmed locally rather than re-read: a re-read races
                   the delete and can redraw the row just removed. */
                Primary("Delete this message") {
                    runCatching { Dengage.deleteInboxMessage(m.id) }
                        .onSuccess {
                            messages = messages.filterNot { it.id == m.id }
                            status = "deleted on the platform. It does not come back."
                        }
                        .onFailure { status = "delete failed: ${it.message}" }
                }
            }
        }

        if (!seedsCleared) SEEDED.forEach { r ->
            Card2(r.title) {
                Text(r.body, fontSize = 12.sp, color = Color(0xFF64748B))
                Text("seeded locally, not from Dengage. No read control: the platform " +
                     "has never seen this row.", fontSize = 10.sp, color = Color(0xFF9AA5B5))
            }
        }

        Note("The inbox is fetched on open, not pushed, so loading before the " +
             "message exists returns empty and stays empty until loaded again.")
    }
}

/* ============================================================================
   EVENTS

   The proof surface. Everything else in this app claims to send something; this
   is where a prospect reads what actually went out, in order, with the columns
   it carried.

   THREE THINGS IT NOW SHOWS THAT IT DID NOT.

   1. WHERE EACH ROW HAS GOT TO. The log used to be written at the moment a row
      was enqueued and never touched again, so a batch of ten read as ten
      completed sends while nine were still queued behind the 120ms gap. The
      queue's pacing is the single most surprising thing about this app's
      behaviour and the screen could not show it. Each row now carries QUEUED,
      HANDED OVER or FAILED, and it moves on screen as it moves.

   2. THE COLUMNS THE EVENT IS ABOUT, SEPARATELY FROM THE SPINE. Six of the nine
      spine columns are on every row and identical on every row, so listed
      inline they buried the two or three columns that differ. They are still
      shown, under their own heading, in the subdued style of something you read
      once.

   3. A ROW YOU CAN CARRY. Every event copies as JSON, because the only way to
      settle whether a column stored is to compare what went out against the row
      in Data Space, and retyping a payload off a phone screen is how that check
      stops being done.

   AND THE LAYOUT DEFECT IT FIXES. The label and the value used to share a row
   where only the label was weighted, so the value was measured first and the
   label divided up the remainder. Beside a 36 character device id that left the
   label one character wide and dn_device_id rendered as a vertical column of
   single letters. The key and value rows here give the label a column of its
   own, which is what a two-column table needs.
   ========================================================================== */

private val CLOCK = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US)

/**
 * One column and its value.
 *
 * THE LABEL COLUMN IS FIXED, not proportional, and that is the fix. A weight
 * shares out what is left after the unweighted side has taken what it wants, so
 * a long opaque identifier can starve the label entirely. A fixed column cannot
 * be starved, and 128dp holds the longest name the model declares,
 * amount_home_currency, on one line.
 */
@Composable
private fun EventKv(k: String, v: String, subdued: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(k, fontSize = 11.sp, lineHeight = 15.sp,
             color = if (subdued) Color(0xFF9AA5B5) else Color(0xFF64748B),
             modifier = Modifier.width(128.dp).padding(end = 8.dp))
        Text(v, fontSize = 11.sp, lineHeight = 15.sp,
             fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
             color = if (subdued) Color(0xFF7A879B) else Color(0xFF0F1C33),
             modifier = Modifier.weight(1f))
    }
}

@Composable
fun EventsScreen() {
    val ctx = LocalContext.current
    val rows = EventQueue.log
    var table by remember { mutableStateOf<String?>(null) }

    val counts = rows.groupingBy { it.table }.eachCount()
    val queued = rows.count { it.delivery == EventQueue.Delivery.QUEUED }
    val failed = rows.count { it.delivery == EventQueue.Delivery.FAILED }
    val shown = rows.filter { table == null || it.table == table }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {

        Card2("Events sent this session") {
            Row(Modifier.fillMaxWidth().padding(bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Stat(rows.size.toString(), "rows", Modifier.weight(1f))
                Stat(counts.size.toString(), "tables", Modifier.weight(1f))
                Stat(queued.toString(), "still queued", Modifier.weight(1.1f))
                Stat(failed.toString(), "failed", Modifier.weight(1f))
            }
            Text("Every row goes through one paced queue with a 120ms gap: firing a " +
                 "batch flat out can exhaust the device's own DNS resolver, so the " +
                 "queue paces itself. A batch of ten therefore takes about a second " +
                 "to drain, and this list shows it draining.",
                 color = Color(0xFF64748B), fontSize = 11.sp, lineHeight = 15.sp)
            Spacer(Modifier.height(8.dp))
            Text("HANDED OVER means the SDK call returned without throwing. That is " +
                 "not the same as stored: the row in Data Space is the only proof.",
                 color = Color(0xFF9A5B12), fontSize = 11.sp, lineHeight = 15.sp)
            ControlGrid(listOf(
                "Copy all as JSON" to {
                    copy(ctx, "NovaPay events", rows.joinToString(",\n") { rowJson(it) })
                },
                "Clear the list" to {
                    // The LIST, not the rows. Anything already sent is on the
                    // platform and clearing a screen does not recall it.
                    EventQueue.clear(); table = null
                },
            ))
            Writes("Clearing empties this screen only. Rows already sent are on the " +
                   "platform and stay there.")
        }

        /* One chip per table touched this session. A demo run fires ten tables
           and the answer to "did the card event go" should not be a scroll. */
        if (counts.size > 1) {
            Row(Modifier.fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(selected = table == null, onClick = { table = null },
                    label = { Text("All ${rows.size}", fontSize = 11.sp) })
                counts.entries.sortedBy { it.key }.forEach { (name, n) ->
                    FilterChip(selected = table == name, onClick = { table = name },
                        label = {
                            Text(name.removePrefix("fintech_").removeSuffix("_events") +
                                 "  $n", fontSize = 11.sp)
                        })
                }
            }
        }

        /* Newest first: on a demo the row you want is the one you just fired. */
        shown.asReversed().forEach { s ->
            val own = s.payload.filterKeys { it !in SPINE }
            val spine = s.payload.filterKeys { it in SPINE }

            Card2 {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(s.eventType, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(s.table, fontSize = 11.sp, color = Color(0xFF64748B))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("#${s.seq}  ${CLOCK.format(java.util.Date(s.at))}",
                             fontSize = 10.sp, color = Color(0xFF9AA5B5))
                        Spacer(Modifier.height(4.dp))
                        when (s.delivery) {
                            EventQueue.Delivery.QUEUED -> Pill("QUEUED", Tone.WARN)
                            EventQueue.Delivery.HANDED_OVER ->
                                Pill(if (s.viaSdk) "SENT BY THE SDK" else "HANDED OVER", Tone.GOOD)
                            EventQueue.Delivery.FAILED -> Pill("FAILED", Tone.BAD)
                        }
                    }
                }

                if (s.detail.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(s.detail, fontSize = 11.sp, color = Color(0xFF9A5B12))
                }

                SectionHead("What this row says", "${own.size} columns")
                if (own.isEmpty()) {
                    Text("Nothing beyond the spine.", fontSize = 11.sp, color = Color(0xFF9AA5B5))
                } else {
                    own.forEach { (k, v) -> EventKv(k, v.toString()) }
                }

                /* THE THREE THE SDK OWNS ARE NOT HERE, and their absence is
                   correct rather than a gap. session_id, dn_contact_key and
                   dn_device_id go into the envelope, not the payload, so this
                   app never sees the values it did not write. The Identity
                   screen reads them back off the SDK, which is where they can
                   be read honestly. */
                if (spine.isNotEmpty()) {
                    SectionHead("Common spine")
                    spine.forEach { (k, v) -> EventKv(k, v.toString(), subdued = true) }
                    Text("session_id, dn_contact_key and dn_device_id are filled by the " +
                         "SDK in the envelope. This app never writes them, so it cannot " +
                         "show them here. The IDs screen reads them back.",
                         fontSize = 10.sp, lineHeight = 14.sp, color = Color(0xFF9AA5B5),
                         modifier = Modifier.padding(top = 6.dp))
                }

                ControlGrid(listOf("Copy this row" to {
                    copy(ctx, "${s.table} <- ${s.eventType}", rowJson(s))
                }))
            }
        }

        if (rows.isEmpty()) {
            Note("Nothing sent yet. Use the app, or open the Test Area and fire one " +
                 "sample row into every table.")
        } else if (shown.isEmpty()) {
            Note("No rows in that table this session.")
        }
    }
}

/** The six spine columns this app writes, read from Events so the list is never
 *  retyped here and cannot drift from what is actually sent. */
private val SPINE = Events.SPINE_WRITTEN.toSet()

/** A row as JSON, for pasting beside what Data Space shows. */
private fun rowJson(s: EventQueue.Sent): String {
    val o = org.json.JSONObject()
    o.put("table", s.table)
    o.put("sent_at", java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
        .format(java.util.Date(s.at)))
    o.put("delivery", s.delivery.name.lowercase().replace('_', ' '))
    o.put("payload", org.json.JSONObject(s.payload))
    return o.toString(2)
}
