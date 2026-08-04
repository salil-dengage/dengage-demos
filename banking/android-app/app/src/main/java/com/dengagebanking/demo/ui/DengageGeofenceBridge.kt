package com.dengagebanking.demo.ui

import android.app.Activity
import android.content.Context
import com.dengage.geofence.DengageGeofence

/* Everything that touches the geofence artifact lives here.

   It is a SEPARATE artifact from the main SDK, sdk-geofence, in its own
   package com.dengage.geofence. Isolating it means a version bump is one
   file, and means the rest of the app compiles unchanged if geofence is
   ever dropped from the build. */
object DengageGeofenceBridge {

    /** Opens the system location prompts. Android asks for foreground first;
     *  calling again after that is what surfaces the background request. */
    fun requestPermissions(activity: Activity) {
        runCatching { DengageGeofence.requestLocationPermissions(activity) }
    }

    /** Starts monitoring. The geofences themselves are defined in the Dengage
     *  panel, not here: the app subscribes, the platform decides where. */
    fun start(context: Context) {
        runCatching { DengageGeofence.startGeofence() }
    }

    fun stop() {
        runCatching { DengageGeofence.stopGeofence() }
    }
}
