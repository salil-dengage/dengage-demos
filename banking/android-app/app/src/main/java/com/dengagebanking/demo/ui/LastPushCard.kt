package com.dengagebanking.demo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengagebanking.demo.push.PushInspector

/* Shows what the last push actually carried, custom parameters included.

   THIS IS HOW YOU DEMO CUSTOM PARAMETERS AT ALL. They are invisible by
   definition: a push shows its title and message, and the parameters ride
   along in the same payload where the customer never sees them. Their whole
   purpose is to carry structured data the app acts on, an account id, an offer
   id, a screen to open. Without a screen like this you can only assert that
   they arrived. With it, you tap the notification and read them.

   Everything comes from PushInspector, which the FCM service fills from the
   SDK's own Message.createFromMap, so this reflects what the SDK parsed rather
   than a second hand parse of the payload. */
@Composable
fun LastPushCard() {
    val clipboard = LocalClipboardManager.current
    val received = PushInspector.last
    var copied by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Last push received", fontWeight = FontWeight.SemiBold)
                    Text(
                        "Including the custom parameters, which the notification " +
                            "itself never shows.",
                        fontSize = 12.sp, color = MeridianColours.soft
                    )
                }
                if (received != null) {
                    IconButton(onClick = {
                        clipboard.setText(AnnotatedString(PushInspector.asText())); copied = true
                    }) {
                        Icon(Icons.Filled.ContentCopy, contentDescription = "Copy the whole payload")
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            if (received == null) {
                Text(
                    "Nothing yet. Send one from the Test Area or the panel, tap " +
                        "it, and it appears here.",
                    fontSize = 12.5.sp, color = MeridianColours.soft
                )
                return@Column
            }

            Field("Title", received.title)
            Field("Message", received.message)
            if (received.targetUrl.isNotBlank()) Field("Target URL", received.targetUrl)
            if (received.campaignId.isNotBlank()) Field("Campaign", received.campaignId)

            Spacer(Modifier.height(12.dp))
            Text(
                "CUSTOM PARAMETERS", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                letterSpacing = 1.1.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(6.dp))

            if (received.customParams.isEmpty()) {
                Text(
                    "None on this one. Add key/value pairs to the push content " +
                        "in the panel and send it again.",
                    fontSize = 12.sp, color = MeridianColours.soft
                )
            } else {
                received.customParams.forEach { (k, v) -> Field(k, v, mono = true) }
            }

            if (copied) {
                Spacer(Modifier.height(8.dp))
                Text("Copied.", fontSize = 11.sp, color = MeridianColours.soft)
            }
        }
    }
}

@Composable
private fun Field(label: String, value: String, mono: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(
            label, fontSize = 12.sp, color = MeridianColours.soft,
            modifier = Modifier.width(96.dp)
        )
        Text(
            value.ifBlank { "(empty)" },
            fontSize = 12.sp,
            fontFamily = if (mono) FontFamily.Monospace else FontFamily.Default,
            modifier = Modifier
                .weight(1f)
                .then(
                    if (mono) Modifier.background(
                        MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(4.dp)
                    ).padding(horizontal = 5.dp, vertical = 2.dp) else Modifier
                )
        )
    }
}
