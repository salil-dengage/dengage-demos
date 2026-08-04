package com.dengagebanking.demo.ui

import android.content.Intent
import android.net.Uri
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengage.sdk.Dengage
import com.dengagebanking.demo.DengageKeys
import com.dengagebanking.demo.MainActivity
import com.dengagebanking.demo.events.MeridianEvents
import com.dengagebanking.demo.inapp.MeridianInApp
import com.dengagebanking.demo.push.MeridianLiveUpdate
import com.dengagebanking.demo.push.MeridianPushGallery

/* ============================================================================
   TEST AREA

   One screen that exercises every Dengage capability the Android SDK offers,
   so anyone handed this APK can press a button and see the real thing happen
   on their own device rather than being told it works.

   THE THING THAT SHAPES THIS SCREEN: everything here renders on the device,
   through the SDK's own code, with no account credentials and no REST access.
   The credentials were removed on 2 August: an APK is a shareable thing, and
   secrets do not belong inside one. What is skipped is the transport, never
   the rendering.

   So each row proves how something LOOKS and how this app HANDLES it. None of
   it proves delivery. Delivery is proven from the panel, which needs nothing
   from the app, and that split is worth saying out loud in a demo rather than
   letting a prospect assume.

   The test event types are deliberately NOT in MeridianEvents.CATALOGUE: they
   are instrumentation, not part of the bank's 86, and a unit test asserts that
   catalogue still matches the website's exactly.
   ========================================================================== */

private const val TEST_TABLE = MeridianEvents.ENGAGEMENT

/* isInAppFetched() tells you whether the device holds a fetched set of In-App
   messages at all. It is the difference between "the campaign is wrong" and
   "the campaign has simply not reached this handset yet", which is the single
   most common reason an In-App test shows nothing. */
/* Which mailbox the inbox reads follows the subscription: with a contact key
   set it is the contact's inbox, without one it is the device's. A message
   addressed to the other one will not come back, and the read returns an
   empty list. Worth showing on screen, so a test is sent to the address this
   handset actually reads. */
private fun inboxQueryMode(): String {
    val ck = runCatching { Dengage.getSubscription()?.contactKey }.getOrNull()
    return if (ck.isNullOrBlank()) "device inbox, send tests to the device id"
    else "contact inbox, send tests to contact key $ck"
}

private fun inAppFetchedFlag(): String =
    runCatching { if (Dengage.isInAppFetched()) "yes" else "no" }.getOrElse { "unknown" }

/** What an In-App display rule can currently read off this device. Empty until
 *  the button below is pressed, which is the honest starting state. */
private fun inAppDeviceInfo(): String =
    runCatching {
        val m = Dengage.getInAppDeviceInfo()
        if (m.isEmpty()) "empty" else m.entries.joinToString(", ") { it.key + "=" + it.value }
    }.getOrElse { "unknown" }

/** getUserPermission is nullable on purpose: null means the SDK has not been
 *  told either way, which is a different state from a refusal. */
private fun userPermission(): String =
    runCatching {
        when (Dengage.getUserPermission()) {
            true -> "granted"
            false -> "refused"
            null -> "not set, which is not the same as refused"
        }
    }.getOrElse { "unknown" }

@Composable
fun TestAreaScreen() {
    val context = LocalContext.current
    val activity = context as? MainActivity
    var status by remember { mutableStateOf("Nothing fired yet.") }

    fun fire(eventType: String, note: String) {
        MeridianEvents.send(
            TEST_TABLE, eventType,
            mapOf("campaign_slug" to eventType, "placement" to "test_area", "offer_category" to "test")
        )
        status = note
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {

        Text(
            "TEST AREA", fontSize = 11.sp, fontWeight = FontWeight.Bold,
            letterSpacing = 1.3.sp, color = MeridianColours.soft
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Every Dengage capability, one button each. Push, Live Update and " +
                "the deep links run entirely on this handset. In-App, inline, " +
                "Stories and the inbox need a campaign in the panel, because " +
                "their content comes from the server.",
            fontSize = 12.sp
        )

        Spacer(Modifier.height(10.dp))
        StatusBar(status)

        /* ABOVE the fourteen format rows, not below them. It used to sit
           underneath, which meant the one card that proves custom parameters
           arrived was fourteen rows down a scrolling screen and was reported
           as "not updating" when it had updated perfectly. A demo aid nobody
           scrolls to is not a demo aid. */
        LastPushCard()

        // ------------------------------------------------- push formats --

        TestSection(
            "Every push format, in Meridian's own words",
            "Drawn on this device by the Dengage SDK, through the same entry " +
                "point a real push uses. Works for anyone, anywhere, with " +
                "nothing set up.\n\n" +
                "Rows showing a {%= %} tag print the RESOLVED output: a local " +
                "render has no server to resolve a tag. Paste the tag into the " +
                "panel to prove that half properly."
        ) {
            MeridianPushGallery.FORMATS.forEach { f ->
                TestRow(f.label, f.panelTag ?: f.note) {
                    status = MeridianPushGallery.show(context, f.key)
                }
            }
        }

        // -------------------------------------------------- live update --

        TestSection(
            "Live Update, the Android Live Activity",
            "One notification that changes in place as a mortgage application " +
                "progresses: submitted, valuation, underwriting, offer.\n\n" +
                "Android has no ActivityKit, so the app draws it and the SDK " +
                "hands it new state. This plays the four states locally, about " +
                "thirty seconds. Lock the phone and watch it move."
        ) {
            TestRow("Play the mortgage sequence", "4 states, ~30 seconds") {
                MeridianLiveUpdate.playLocally(context) { line -> status = line }
            }
            InfoRow("Handler registered", if (MeridianLiveUpdate.isRegistered()) "yes" else "no")
            InfoRow("Activity type", MeridianLiveUpdate.ACTIVITY_TYPE)
        }

        // -------------------------------------------------------- in-app --

        TestSection(
            "In-App messages, every layout the panel offers",
            "One row per layout in the panel's template gallery. Each reports a " +
                "screen name; the campaign targeted at that screen name decides " +
                "what appears.\n\n" +
                "There is nothing per layout in this app, and there does not need " +
                "to be: an In-App is HTML plus a position, so modal, banner, NPS, " +
                "survey and spin to win are all the same mechanism with different " +
                "content. The HTML for each is in banking/panel-content/mobile/.\n\n" +
                "TWO THINGS MUST BE TRUE OR NOTHING SHOWS. A campaign must exist " +
                "for that screen name, and the device must already have FETCHED " +
                "it. Refresh first."
        ) {
            TestRow("Refresh from the server", "getInAppMessages") {
                runCatching { Dengage.getInAppMessages() }
                    .onFailure { e -> status = "Refresh failed: " + e.message }
                if (!status.startsWith("Refresh failed")) {
                    status = "Asked the SDK to refetch In-App messages. " +
                        "Fetched flag is now " + inAppFetchedFlag() + ". " +
                        "Give it a second, then report the target screen below."
                }
            }
            InfoRow("In-App fetched", inAppFetchedFlag())

            MeridianInApp.PLACEMENTS.forEach { p ->
                TestRow(p.label, p.layout + "  |  " + p.screen) {
                    if (p.key == "realtime") {
                        activity?.let {
                            runCatching {
                                Dengage.showRealTimeInApp(
                                    it, p.screen,
                                    hashMapOf("tier" to "premier", "surface" to "test_area")
                                )
                            }.onFailure { e -> status = "Real time In-App failed: " + e.message }
                        }
                        if (!status.startsWith("Real time In-App failed")) {
                            status = "Asked for a real-time In-App on " + p.screen +
                                ", with tier=premier and surface=test_area."
                        }
                    } else {
                        activity?.let { Dengage.setNavigation(it, p.screen) }
                        status = "Reported screen " + p.screen + ". Paste " +
                            p.file + " into a campaign with layout: " + p.layout + "."
                    }
                }
            }

            TestRow("Dismiss whatever is showing", "removeInAppMessageDisplay") {
                runCatching { Dengage.removeInAppMessageDisplay() }
                status = "Dismissed the current In-App, if any."
            }
        }

        // -------------------------------------------------- device context --

        /* Four SDK setters that are not events and not tags, and are the
           difference between a rule that can be written and one that cannot.

           Country, state and city go on the DEVICE record, so a segment can
           say "premier customers in London" without the app ever asking for a
           location permission. They are not the geofence: geofence answers
           "is this handset inside that circle right now", these answer "where
           does this handset live".

           setInAppDeviceInfo is the one worth dwelling on. It puts arbitrary
           key/value pairs where an In-App display rule can read them, so a
           real-time message can be gated on something the app knows and the
           server does not yet: a balance band that changed a second ago, a
           tier, a feature flag. Without it every rule has to wait for an event
           to round-trip. */
        TestSection(
            "Device context, for rules that events cannot express",
            "Attributes on the device record rather than rows in a table. " +
                "Country, state and city give geographic segments with no " +
                "location permission at all. In-App device info gives a " +
                "real-time rule something the server has not been told yet."
        ) {
            TestRow("Set the geography", "setCountry, setState, setCity") {
                runCatching {
                    Dengage.setCountry("GB")
                    Dengage.setState("Greater London")
                    Dengage.setCity("London")
                }.onFailure { e -> status = "Geography failed: " + e.message }
                if (!status.startsWith("Geography failed")) {
                    status = "Device set to London, Greater London, GB. Segment on " +
                        "it without ever asking for a location permission."
                }
            }
            TestRow("Set In-App device info", "setInAppDeviceInfo x3") {
                runCatching {
                    Dengage.setInAppDeviceInfo("tier", "premier")
                    Dengage.setInAppDeviceInfo("holds_mortgage", "true")
                    Dengage.setInAppDeviceInfo("balance_band", "under_500")
                }.onFailure { e -> status = "Device info failed: " + e.message }
                if (!status.startsWith("Device info failed")) {
                    status = "Set tier, holds_mortgage and balance_band. An In-App " +
                        "display rule can now read all three."
                }
            }
            InfoRow("In-App device info", inAppDeviceInfo())
            TestRow("Clear it", "clearInAppDeviceInfo") {
                runCatching { Dengage.clearInAppDeviceInfo() }
                status = "Cleared the In-App device info."
            }
            TestRow("Report a category path", "setCategoryPath") {
                runCatching { Dengage.setCategoryPath("Products > Cards > Credit") }
                status = "Reported Products > Cards > Credit, which an In-App rule " +
                    "can match on without waiting for a page view to land."
            }
            InfoRow("Notification permission", userPermission())
        }

        // ---------------------------------------- inline in-app, stories --

        /* The app declares these ids and the campaign targets them, not the
           other way round: showInlineInApp takes the propertyId as an
           argument. So there is nothing to wait for from the panel, and the
           full list is printed here so a campaign can be built while looking
           at the phone. */
        TestSection(
            "Inline placements and Stories",
            "The app owns these ids and passes them to showInlineInApp. Build " +
                "an In-App campaign with layout Inline and target the id for " +
                "the screen you want, and it appears there.\n\n" +
                "One id per screen on purpose: a shared id could never carry a " +
                "different message per page."
        ) {
            DengageKeys.InlineProperty.ALL.forEach { InfoRow("Inline", it) }
            DengageKeys.StoryProperty.ALL.forEach { InfoRow("Stories", it) }
        }

        // --------------------------------------------------------- inbox --

        TestSection(
            "App Inbox",
            "AN EMPTY INBOX HERE IS CORRECT, AND IT IS THE ONE THING ON THIS " +
                "SCREEN THAT CANNOT BE FAKED. The inbox is read from the server, " +
                "so it holds what has actually been delivered to this contact. " +
                "Nothing has been, so it returns nothing. The push gallery cannot " +
                "fill it either: those notifications are drawn on the handset and " +
                "never reach the server, so addToInbox has nothing to write to.\n\n" +
                "To put something in it, send a real campaign with Add to Inbox " +
                "ticked, then press Load.\n\n" +
                "SEND IT TO THE CONTACT KEY, NOT THE DEVICE ID. Which mailbox the " +
                "inbox reads follows the subscription: once setContactKey has run " +
                "it is the contact's inbox, so a message addressed to the device " +
                "id will not come back, and the read returns an empty list."
        ) {
            InfoRow("This device asks for", inboxQueryMode())
            TestRow("Ask for an inbox message", "test_inbox_message") { fire("test_inbox_message", "Fired test_inbox_message.") }
            TestRow("Load the inbox", "getInboxMessages") {
                InboxBridge.load(
                    onLoaded = {
                        status = if (it.isEmpty())
                            "Inbox returned 0 messages, and the call succeeded. " +
                                "Nothing has been delivered to this " + inboxQueryMode()
                                    .substringBefore(",") + " yet."
                        else "Inbox returned " + it.size + " message(s)."
                    },
                    onError = { status = "Inbox error: " + it }
                )
            }
            TestRow("Mark all as read", "setAllInboxMessagesAsClicked") {
                runCatching { InboxBridge.markAllClicked() }; status = "Marked all inbox messages read."
            }
            TestRow("Delete all", "deleteAllInboxMessages") {
                runCatching { InboxBridge.deleteAll() }; status = "Deleted all inbox messages."
            }
        }

        // ---------------------------------------------------- deep links --

        TestSection(
            "Deep links",
            "Same routes a push uses. Firing one here proves the routing without " +
                "waiting for a campaign."
        ) {
            listOf(
                DengageKeys.Screen.OVERVIEW, DengageKeys.Screen.ACCOUNTS,
                DengageKeys.Screen.CARDS, DengageKeys.Screen.PAYMENTS,
                DengageKeys.Screen.WEALTH, DengageKeys.Screen.INBOX
            ).forEach { target ->
                TestRow("Open $target", "meridian://$target") {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse("meridian://$target"))
                            .setPackage(context.packageName)
                    )
                    status = "Opened meridian://$target."
                }
            }
        }

        // ------------------------------------------------- tags, geofence --

        TestSection(
            "Tags",
            "Durable facts, as opposed to events. They attach to the DEVICE: the " +
                "request sends the device id and no contact key, so they do not " +
                "appear on the contact's Fields tab. Look at the device record, or " +
                "segment on the tag."
        ) {
            TestRow("Set four demo tags", "setTags") {
                runCatching {
                    Dengage.setTags(
                        listOf(
                            com.dengage.sdk.domain.tag.model.TagItem("relationship", "premier"),
                            com.dengage.sdk.domain.tag.model.TagItem("holds_mortgage", "true"),
                            com.dengage.sdk.domain.tag.model.TagItem("channel_preference", "app"),
                            com.dengage.sdk.domain.tag.model.TagItem("risk_profile", "balanced")
                        )
                    )
                }
                status = "Sent 4 tags against this device id. Allow a few " +
                    "seconds after a cold start, then check the device " +
                    "record in the panel."
            }
        }

        TestSection(
            "Geofence",
            "The fences are defined in the panel, not here. This starts and stops " +
                "the device reporting its position against them."
        ) {
            TestRow("Request location permission", "requestLocationPermissions") {
                activity?.let { DengageGeofenceBridge.requestPermissions(it) }
                status = "Asked for location. Tap again for the background grant."
            }
            TestRow("Start geofence", "startGeofence") {
                DengageGeofenceBridge.start(context); status = "Geofence started."
            }
            TestRow("Stop geofence", "stopGeofence") {
                DengageGeofenceBridge.stop(); status = "Geofence stopped."
            }
        }

        // ----------------------------------------------------------- data --

        TestSection(
            "Data",
            "The nine banking tables. Full detail is on the Events screen."
        ) {
            TestRow("Send all 86 event types", "sendDeviceEvent x86") {
                val n = com.dengagebanking.demo.events.EventSamples.fireEverything()
                status = "Queued $n events. They drain over about ten seconds."
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            "Recommendation surfaces are not part of this app version. " +
                "See MOBILE-SURFACES.md.",
            fontSize = 11.sp, color = MeridianColours.soft
        )
        Spacer(Modifier.height(24.dp))
    }
}

// --------------------------------------------------------------- pieces --

@Composable
private fun StatusBar(status: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Text(status, fontSize = 12.sp, modifier = Modifier.padding(12.dp))
    }
}

@Composable
private fun TestSection(title: String, blurb: String, content: @Composable ColumnScope.() -> Unit) {
    Spacer(Modifier.height(18.dp))
    Text(
        title.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold,
        letterSpacing = 1.2.sp, color = MeridianColours.soft
    )
    Box(
        Modifier.padding(top = 2.dp, bottom = 6.dp).width(34.dp).height(2.dp)
            .then(Modifier)
    ) {}
    Text(blurb, fontSize = 11.5.sp, color = MeridianColours.soft)
    Spacer(Modifier.height(8.dp))
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(vertical = 4.dp), content = content)
    }
}

@Composable
private fun TestRow(label: String, hint: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 13.5.sp)
            Text(hint, fontSize = 10.sp, color = MeridianColours.soft)
        }
        TextButton(onClick = onClick) { Text("Run", fontSize = 13.sp) }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 13.sp)
        Text(value, fontSize = 11.sp, color = MeridianColours.soft)
    }
}
