package com.dengagebanking.demo.ui

import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.dengage.sdk.Dengage
import com.dengage.sdk.callback.DengageCallback
import com.dengage.sdk.callback.DengageError
import com.dengage.sdk.domain.inboxmessage.model.InboxMessage
import com.dengage.sdk.util.DengageLogger

/** A row of the App Inbox, flattened for the UI.
 *
 *  [local] marks a seeded row that never came from Dengage. It exists because
 *  every write path (mark as read, delete) has to skip those rows: their ids
 *  are ours, the platform has never heard of them, and sending one to
 *  setInboxMessageAsClicked would be a request about a message that does not
 *  exist. */
data class InboxRow(
    val id: String,
    val title: String,
    val body: String,
    val clicked: Boolean,
    val local: Boolean = false
)

/* Three messages that ship with the app, so the Inbox screen has something in
   it before anyone has sent a campaign.

   They are needed because the App Inbox is server-side. A row appears when a
   real campaign send with save to inbox ticked goes out; a panel Test Send
   does not save to the inbox, and the app's own Test Area pushes are drawn
   locally. That leaves an empty screen in the demo until a real campaign has
   gone out, and an empty screen sells nothing.

   They are deliberately Meridian's own service messages rather than marketing,
   because that is what a bank's inbox actually carries, and none of them
   invent a figure that would contradict the account data on the other screens.
   Real campaign messages are appended below these, so a live send is still
   visibly a live send. */
internal val SEEDED_INBOX = listOf(
    InboxRow(
        id = "meridian-seed-1",
        title = "Your July statement is ready",
        body = "Current account ****4471. View it in Accounts, or download a PDF copy.",
        clicked = false,
        local = true
    ),
    InboxRow(
        id = "meridian-seed-2",
        title = "Travel notice confirmed",
        body = "Your cards will work in France until 22 August. No action needed.",
        clicked = true,
        local = true
    ),
    InboxRow(
        id = "meridian-seed-3",
        title = "Rate Week starts Monday",
        body = "Fixed rates on the two year ISA are held for existing customers.",
        clicked = false,
        local = true
    )
)

/* Everything that touches the App Inbox API lives here. Keeping the surface
   in one file means a version bump is one place to fix, not nine call sites. */
object InboxBridge {

    /* The callback arrives on whatever thread the SDK finished its request on,
       and the screen writes straight into Compose state, so both halves are
       hopped onto the main thread here rather than at each call site.

       Everything is logged. */
    private val main = Handler(Looper.getMainLooper())

    /* Whether the seeded rows have been cleared in this run of the app.
       Deliberately in memory and nowhere else: Clear all is a stage control,
       so it has to survive walking to another screen and back, and it has to
       NOT survive a restart, or the demo is permanently emptier for the next
       person who picks up the phone. */
    private var seedCleared = false

    /* Unread count for the badge on the Inbox icon.

       Compose state, deliberately, so a push arriving while the customer is on
       any other screen moves the badge without that screen knowing the inbox
       exists. It is set from MeridianFcmService, which is not a composable, and
       that is fine: a snapshot state write from any thread is safe and the top
       bar observes it.

       Counted from the PUSH, not from a fetch, because the inbox is server
       side and the row is not readable the instant the push lands. Counting
       arrivals is also the honest thing to show: it is the campaign reaching
       the customer, which is the moment worth pointing at in a demo. */
    var unread by mutableStateOf(0)
        private set

    /** Called for a push that the platform says it also filed in the inbox. */
    fun noteInboxPush() {
        unread += 1
        DengageLogger.debug("Meridian inbox: push filed to inbox, unread=$unread")
    }

    fun clearSeeded() { seedCleared = true }

    private fun seeded(): List<InboxRow> = if (seedCleared) emptyList() else SEEDED_INBOX

    fun load(onLoaded: (List<InboxRow>) -> Unit, onError: (String) -> Unit) {
        DengageLogger.debug("Meridian inbox: requesting")
        Dengage.getInboxMessages(
            limit = 20,
            offset = 0,
            dengageCallback = object : DengageCallback<MutableList<InboxMessage>> {
                override fun onResult(result: MutableList<InboxMessage>) {

                    /* Mapping is wrapped so one surprising row cannot take
                       down the whole load: a row that fails to map is logged
                       and skipped, and the screen still renders. */
                    val rows = result.mapNotNull { m ->
                        runCatching {
                            InboxRow(
                                id = m.id,
                                title = m.data?.title?.takeIf { it.isNotBlank() } ?: "Message",
                                body = m.data?.message.orEmpty(),
                                clicked = m.isClicked
                            )
                        }.onFailure {
                            DengageLogger.error("Meridian inbox: row failed: $it")
                        }.getOrNull()
                    }

                    /* Both numbers, because they are different questions:
                       what the platform returned, and what the screen shows
                       once the seeded rows are counted in. */
                    val shown = seeded() + rows
                    DengageLogger.debug(
                        "Meridian inbox: ${rows.size} from Dengage, " +
                            "${shown.size} shown"
                    )
                    shown.forEach {
                        val origin = if (it.local) "seeded" else "campaign"
                        DengageLogger.debug("Meridian inbox: $origin ${it.id} ${it.title}")
                    }
                    /* Reading the inbox is what marks it read, so the badge
                       clears here rather than on navigation: opening the
                       screen and seeing the list is the moment the customer
                       has actually caught up. */
                    unread = 0
                    main.post { onLoaded(shown) }
                }

                /* An inbox that cannot be reached still shows the seeded
                   rows. On a stage with bad wifi an empty screen tells the
                   audience nothing, and the seeded rows are local, so there
                   is no reason to hide them. */
                override fun onError(error: DengageError) {
                    DengageLogger.error("Meridian inbox: error: ${error.errorMessage}")
                    main.post {
                        onLoaded(seeded())
                        onError(error.errorMessage ?: "Inbox unavailable")
                    }
                }
            }
        )
    }

    /* Every write takes the row, not the id, so the local rows can be skipped
       here rather than at each call site. Passing a seeded id to the SDK would
       be a request about a message the platform has never seen. */
    fun markClicked(row: InboxRow) {
        if (row.local) return
        Dengage.setInboxMessageAsClicked(row.id)
    }

    fun delete(row: InboxRow) {
        if (row.local) return
        Dengage.deleteInboxMessage(row.id)
    }

    fun markAllClicked() = Dengage.setAllInboxMessagesAsClicked()

    /** Clears both halves: the seeded rows for this run of the app, and the
     *  real ones on the platform, which do not come back. */
    fun deleteAll() {
        clearSeeded()
        Dengage.deleteAllInboxMessages()
    }
}
