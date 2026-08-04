package com.dengagebanking.demo.push

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.dengage.sdk.domain.push.model.Message

/* ============================================================================
   PUSH INSPECTOR

   Holds what the last push actually carried, so a demo can show it rather than
   assert it.

   THE POINT OF THIS IS CUSTOM PARAMETERS. A push shows a title and a message,
   and that is all the customer sees. Custom parameters are the other half:
   arbitrary key/value pairs defined on the content in the panel, delivered in
   the same payload, invisible in the notification, and read by the app to
   decide what to do. They are how a push carries an account id, an offer id or
   a screen to open without putting any of it in the copy.

   Without a screen like this, the whole feature is invisible in a demo: you can
   say the parameters arrived but you cannot show it. With it, you tap the
   notification and read exactly what the campaign sent.

   The SDK already parses them: Message.createFromMap(data) turns the FCM data
   map into a Message with customParams as a List<CustomParam> of key and value.
   Nothing here re-parses the payload by hand.
   ========================================================================== */
object PushInspector {

    data class Received(
        val title: String,
        val message: String,
        val targetUrl: String,
        val campaignId: String,
        val customParams: List<Pair<String, String>>,
        val rawKeys: List<String>,
    )

    /* Compose state so the screen updates the moment a push lands, even if it
       is already open. Kept in a singleton rather than a ViewModel because the
       FCM service has no ViewModel to write into: it is a separate process
       entry point. */
    var last by mutableStateOf<Received?>(null)
        private set

    /** Called from the FCM service for every Dengage message. */
    fun record(data: Map<String, String>) {
        val msg = runCatching { Message.createFromMap(data) }.getOrNull()
        last = Received(
            title = msg?.title ?: data["title"].orEmpty(),
            message = msg?.message ?: data["message"].orEmpty(),
            targetUrl = msg?.targetUrl ?: data["targetUrl"].orEmpty(),
            campaignId = data["dengageCampId"] ?: data["campaignId"].orEmpty(),
            customParams = msg?.customParams
                ?.map { (it.key ?: "") to (it.value ?: "") }
                ?.filter { it.first.isNotBlank() }
                ?: emptyList(),
            rawKeys = data.keys.sorted(),
        )
    }

    /** One block of text for the copy button, so a whole payload can be pasted
     *  into a ticket rather than retyped from a screenshot. */
    fun asText(): String {
        val r = last ?: return "No push received yet."
        val params = if (r.customParams.isEmpty()) "  (none)"
        else r.customParams.joinToString("\n") { "  ${it.first} = ${it.second}" }
        return buildString {
            appendLine("title:      ${r.title}")
            appendLine("message:    ${r.message}")
            appendLine("targetUrl:  ${r.targetUrl}")
            appendLine("campaignId: ${r.campaignId}")
            appendLine("custom parameters:")
            appendLine(params)
            appendLine("payload keys: ${r.rawKeys.joinToString(", ")}")
        }
    }
}
