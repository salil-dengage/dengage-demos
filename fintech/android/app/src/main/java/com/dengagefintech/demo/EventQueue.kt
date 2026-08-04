package com.dengagefintech.demo

import android.util.Log
import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.mutableStateListOf
import com.dengage.sdk.Dengage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * ONE paced exit point for every event this app sends.
 *
 * WHY THE GAP. Firing a batch of events in a few milliseconds exhausted the
 * DEVICE's DNS resolver during the reference build and produced:
 *
 *     HTTP FAILED: java.net.UnknownHostException:
 *     Unable to resolve host "event.dengage.com"
 *
 * Nothing was wrong with the SDK, the key or the payloads, and the failure
 * looks exactly like a server rejecting you. A small gap between sends fixes
 * it, and also fixes dropped frames and a batch dying when the user navigates
 * away mid-send.
 *
 * WHY A SINGLETON. The queue must outlive any screen. Owned by a composable or
 * a ViewModel, navigation cancels the scope and the rest of the batch is
 * silently lost.
 *
 * WHY THE LOG CARRIES A STATE AND NOT JUST A PAYLOAD. The log used to record a
 * row at the moment it was enqueued and never touch it again, so the Events
 * screen showed a batch of ten as ten finished sends while nine of them were
 * still waiting their turn behind the 120ms gap. That is the one thing this
 * queue does that a viewer needs to see. Each row now moves QUEUED to HANDED
 * OVER, or to FAILED if the call threw, and the screen shows which.
 *
 * HANDED OVER IS NOT STORED, and the wording is deliberate. All this object can
 * observe is that sendDeviceEvent returned without throwing. A 200 means
 * accepted; the row in Data Space is the only proof it stored.
 */
object EventQueue {

    private const val GAP_MS = 120L

    /** Application context. sendDeviceEvent takes one; passing it explicitly
     *  rather than relying on the SDK's default keeps the call unambiguous. */
    @Volatile private var appContext: Context? = null
    fun attach(context: Context) { appContext = context.applicationContext }
    private const val TAG = "NovaPayEvents"

    /** How far a row has got. Nothing here claims storage: see the note above. */
    enum class Delivery { QUEUED, HANDED_OVER, FAILED }

    data class Sent(
        val seq: Int,
        val table: String,
        val eventType: String,
        val payload: Map<String, Any>,
        val at: Long,
        val delivery: Delivery = Delivery.QUEUED,
        /** Why it failed, when it did. Empty otherwise. */
        val detail: String = "",
        /** True for the page view, which the SDK sends itself. The queue only
         *  records it, so it never sits in the QUEUED state. */
        val viaSdk: Boolean = false,
    )

    /* Snapshot state, so the Events screen redraws as rows move rather than
       waiting for somebody to press Refresh. Every mutation is posted to the
       main looper: rows are added from whichever thread fired the event and
       marked from the queue's own IO thread, and posting keeps both orderly
       without a lock. Handler posts are FIFO, so a row is always added before
       it is marked. */
    private val rows = mutableStateListOf<Sent>()
    private val main = Handler(Looper.getMainLooper())
    private var counter = 0

    /** Everything sent this session, oldest first. The Events screen reads it
     *  directly, which is what makes the screen live. */
    val log: List<Sent> get() = rows

    private val queue = Channel<Sent>(Channel.UNLIMITED)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO).also { s ->
        s.launch {
            for (item in queue) {
                try {
                    val ctx = appContext
                    if (ctx == null) {
                        Log.e(TAG, "no context yet, dropped ${item.table}")
                        mark(item.seq, Delivery.FAILED, "no application context yet")
                    } else {
                        Dengage.sendDeviceEvent(item.table, HashMap(item.payload), ctx)
                        Log.d(TAG, "sent ${item.table} <- ${item.eventType}")
                        mark(item.seq, Delivery.HANDED_OVER)
                    }
                } catch (e: Throwable) {
                    // Never rethrow: one bad row must not stop the queue.
                    Log.e(TAG, "send failed ${item.table} <- ${item.eventType}", e)
                    mark(item.seq, Delivery.FAILED, e.message ?: e.javaClass.simpleName)
                }
                delay(GAP_MS)
            }
        }
    }

    fun enqueue(table: String, eventType: String, payload: Map<String, Any>) {
        val item = Sent(++counter, table, eventType, payload, System.currentTimeMillis())
        main.post { rows.add(item) }
        queue.trySend(item)
    }

    /** A pageView that the SDK sends itself, recorded so the Events screen
     *  shows it alongside the custom rows. It is NOT put on the queue: the SDK
     *  owns the send, and enqueueing it would send it a second time. */
    fun notePageView(payload: Map<String, Any>) {
        val item = Sent(++counter, "page_view_events", "page_view", payload,
                        System.currentTimeMillis(), Delivery.HANDED_OVER, viaSdk = true)
        main.post { rows.add(item) }
        Log.d(TAG, "pageView <- ${payload["page_type"]}")
    }

    private fun mark(seq: Int, state: Delivery, detail: String = "") {
        main.post {
            val i = rows.indexOfFirst { it.seq == seq }
            if (i >= 0) rows[i] = rows[i].copy(delivery = state, detail = detail)
        }
    }

    fun sent(): List<Sent> = rows.toList()

    fun clear() = main.post { rows.clear() }
}
