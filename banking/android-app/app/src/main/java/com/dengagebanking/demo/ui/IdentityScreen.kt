package com.dengagebanking.demo.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.appcompat.app.AppCompatActivity
import com.dengagebanking.demo.MainActivity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengage.sdk.Dengage
import com.dengagebanking.demo.BuildConfig
import com.dengagebanking.demo.DengageKeys

/* Every identifier this device is known by, in one place, each one copyable.

   This screen exists because the questions that stall a mobile integration are
   all the same shape: which device is this, which contact is it attached to,
   did a push token ever get issued, is the advertising id present, which app
   key is it reporting against. Answering those from logcat means reading a
   phone screen out loud over a call. Here they are text you can copy and paste
   into the panel, a segment or a support ticket.

   Everything below comes from Dengage.getSubscription(), which is the SDK's
   own view of this device's identity, so it is what the platform believes
   rather than what the app hoped. */
@Composable
fun IdentityScreen() {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var refresh by remember { mutableIntStateOf(0) }
    var copied by remember { mutableStateOf<String?>(null) }

    val activity = context as? MainActivity
    val rows = remember(refresh) {
        identifierRows(context) + listOf("Last deep link" to (activity?.lastLink ?: "(none)"))
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {

        Text(
            "IDENTIFIERS",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp,
            color = MeridianColours.soft
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "What Dengage believes about this device. Tap any value to copy it.",
            fontSize = 13.sp
        )
        Spacer(Modifier.height(12.dp))

        Row {
            Button(
                onClick = {
                    clipboard.setText(AnnotatedString(rows.joinToString("\n") { "${it.first}: ${it.second}" }))
                    copied = "everything"
                },
                modifier = Modifier.weight(1f)
            ) { Text("Copy all") }
            Spacer(Modifier.width(8.dp))
            OutlinedButton(onClick = { refresh++ }, modifier = Modifier.weight(1f)) { Text("Refresh") }
        }

        copied?.let {
            Spacer(Modifier.height(6.dp))
            Text("Copied $it to the clipboard.", fontSize = 11.sp, color = MeridianColours.soft)
        }

        Spacer(Modifier.height(8.dp))

        rows.forEach { (label, value) ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            label, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp, color = MeridianColours.soft
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            value,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier
                                .background(
                                    MaterialTheme.colorScheme.surfaceVariant,
                                    RoundedCornerShape(6.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                        )
                    }
                    IconButton(onClick = {
                        clipboard.setText(AnnotatedString(value)); copied = label
                    }) {
                        Icon(Icons.Filled.ContentCopy, contentDescription = "Copy $label")
                    }
                }
            }
        }

        Spacer(Modifier.height(14.dp))
        Text(
            "A blank push token means the device never registered with Firebase, " +
                "which is the first thing to check when a push does not arrive. " +
                "A blank contact key means the device is anonymous, which is correct " +
                "until someone signs in.",
            fontSize = 11.sp, color = MeridianColours.soft
        )
    }
}

/** Read straight from the SDK, so this reports what the platform holds rather
 *  than what the app believes it sent. */
private fun identifierRows(context: Context): List<Pair<String, String>> {
    fun blank(v: String?) = if (v.isNullOrBlank()) "(not set)" else v

    val sub = runCatching { Dengage.getSubscription() }.getOrNull()

    return listOf(
        "Contact key" to blank(sub?.contactKey),
        "Device ID" to blank(sub?.deviceId),
        "Push token" to blank(sub?.token),
        "Token type" to blank(sub?.tokenType),
        "Advertising ID" to blank(sub?.advertisingId),
        "Partner device ID" to blank(sub?.partnerDeviceId),
        "Integration key" to blank(sub?.integrationKey ?: DengageKeys.FIREBASE_INTEGRATION_KEY),
        "Push permission" to (sub?.permission?.toString() ?: "(not set)"),
        "Tracking permission" to (sub?.trackingPermission?.toString() ?: "(not set)"),
        "Location permission" to blank(sub?.locationPermission),
        "Country" to blank(sub?.country),
        "Language" to blank(sub?.language),
        "Timezone" to blank(sub?.timezone),
        "Carrier" to blank(sub?.carrierId),
        "Test group" to blank(sub?.testGroup),
        "SDK version" to blank(sub?.sdkVersion ?: runCatching { Dengage.getSdkVersion() }.getOrNull()),
        "App version" to blank(sub?.appVersion ?: BuildConfig.VERSION_NAME),
        "Package name" to context.packageName,
        "Event source" to DengageKeys.EVENT_SOURCE
    )
}
