package com.dengagebanking.demo.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.dengage.sdk.Dengage

/* Geofence, kept behind an explicit control rather than started on launch.

   Location is the one Dengage surface that cannot be switched on quietly. It
   needs foreground location, and to fire while the app is closed, which is the
   only interesting case for a bank, it needs BACKGROUND location as well.
   Android asks for those in two separate prompts and the second one is a
   settings trip on Android 11 and later. Starting that on first launch would
   bury a demo under permission dialogs before the customer has seen a balance.

   So the flow here is: tap once for foreground, tap again for background, then
   start. Which is also roughly what a real bank's onboarding does. */
@Composable
fun GeofenceCard() {
    val context = LocalContext.current
    val activity = context as? AppCompatActivity
    var started by remember { mutableStateOf(false) }
    var tick by remember { mutableIntStateOf(0) }

    fun granted(permission: String) = ContextCompat.checkSelfPermission(context, permission) ==
        PackageManager.PERMISSION_GRANTED

    val fine = remember(tick) { granted(Manifest.permission.ACCESS_FINE_LOCATION) }
    val background = remember(tick) {
        android.os.Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        androidx.compose.foundation.layout.Column(Modifier.padding(16.dp)) {
            Text("Location and geofence", fontWeight = FontWeight.SemiBold)
            Text(
                "Lets Dengage trigger on entering or leaving a branch or a partner " +
                    "location. Needs foreground location, and background location to " +
                    "fire while the app is closed.",
                fontSize = 12.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(8.dp))

            Text(
                "Foreground: " + (if (fine) "granted" else "not granted") +
                    "   ·   Background: " + (if (background) "granted" else "not granted"),
                fontSize = 11.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(8.dp))

            Button(
                onClick = {
                    activity?.let { DengageGeofenceBridge.requestPermissions(it) }
                    tick++
                }
            ) { Text(if (fine) "Request background location" else "Request location") }

            Spacer(Modifier.height(6.dp))

            OutlinedButton(
                enabled = fine && !started,
                onClick = {
                    DengageGeofenceBridge.start(context)
                    started = true
                    /* The permission state is part of this device's identity in
                       Dengage, so a change is worth pushing rather than leaving
                       the platform to guess. */
                    Dengage.setTrackingPermission(true)
                }
            ) { Text(if (started) "Geofence running" else "Start geofence") }

            if (!background && fine) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Foreground only. Geofences will fire while the app is open. " +
                        "For the closed-app case, grant \"Allow all the time\" in " +
                        "Settings > Apps > Demo - Meridian Bank > Permissions > Location.",
                    fontSize = 11.sp, color = MeridianColours.soft
                )
            }
        }
    }
}
