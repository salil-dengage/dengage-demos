package com.dengagefintech.demo.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengage.sdk.Dengage
import com.dengage.sdk.domain.tag.model.TagItem
import com.dengage.geofence.DengageGeofence
import com.dengage.sdk.liveupdate.LiveUpdateEvent
import com.dengagefintech.demo.push.NovaPayLiveUpdate
import com.dengagefintech.demo.*
import com.dengagefintech.demo.push.NovaPayFcmService
import com.dengagefintech.demo.push.NovaPayPushGallery
import com.dengagefintech.demo.inapp.NovaPayInApp

/**
 * One button per capability, so anyone handed the APK can press and see the
 * real thing.
 *
 * THE SHAPE IS FORCED BY ONE FACT: an app cannot send itself a push. A push
 * originates on Dengage's servers, and the only way a button could produce one
 * directly is by calling the REST API with an account secret, which would mean
 * publishing that secret inside an APK. So the buttons split in two:
 *
 *   SERVER ROUND TRIP  the button fires a distinctly named event and
 *                      SOMETHING SERVER SIDE reacts to it. What that something
 *                      is differs by surface, see the warning below.
 *   ON DEVICE          In-App, inbox, tags and deep links are SDK calls, so the
 *                      button does the thing immediately.
 *
 * The test_* event types are INSTRUMENTATION and are deliberately kept out of
 * the real catalogue in Events.Tables. ParityTest fails if one appears there.
 */
/* Four tags a campaign would actually segment on, rather than one that only
   proves the call compiled. plan_tier and balance_band use the same vocabulary
   as the event model, so a tag segment and a table segment say the same words. */
private val DEMO_TAGS = listOf(
    "plan_tier" to "plus",
    "balance_band" to "2000-9999",
    "goal_interest" to "travel",
    "travels_abroad" to "true",
)

/** What an In-App display rule can currently read off this device. Empty until
 *  the button above is pressed, which is the honest starting state. */
private fun inAppDeviceInfo(): String =
    runCatching {
        val info = Dengage.getInAppDeviceInfo()
        if (info.isEmpty()) "(none set)"
        else info.entries.joinToString(", ") { "${it.key}=${it.value}" }
    }.getOrElse { "unreadable" }

/** Whether the customer has granted notification permission, as the SDK sees
 *  it. A campaign can be delivered and still show nothing without this. */
private fun userPermission(): String =
    runCatching { Dengage.getUserPermission()?.toString() ?: "not set" }
        .getOrElse { "unknown" }

private fun copyText(ctx: android.content.Context, label: String, value: String) {
    val cm = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
        as android.content.ClipboardManager
    cm.setPrimaryClip(android.content.ClipData.newPlainText(label, value))
}

@Composable
fun TestAreaScreen() {
    val ctx = LocalContext.current
    val activity = ctx as? android.app.Activity
    var note by remember { mutableStateOf("") }

    /* channel is the SURFACE the row is about, from the engagement table's own
       vocabulary: onsite, inapp, push, inbox. It used to send "app" for all
       four rows, which is not a member, so the column arrived empty and the one
       question these rows exist to answer, which surface was this, could not be
       asked of them. */
    fun fire(eventType: String, label: String, channel: String) {
        Events.engagement(eventType, mapOf(
            "channel" to channel, "widget_name" to label, "interaction" to "triggered"
        ))
        note = "sent $eventType on channel $channel. What answers it depends on " +
               "the surface: In-App can use a Real Time campaign, push cannot. " +
               "See the note below."
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 12.dp)) {

        /* The fastest way to see what ACTUALLY arrived. Without this, "the push
           did not work" is unanswerable; with it, the payload is on screen. */
        Card2("Last push received") {
            val last = NovaPayFcmService.lastPush
            if (last == null) {
                Text("Nothing yet. A real campaign send, or a local gallery push below, " +
                     "will fill this.", color = Color(0xFF64748B), fontSize = 11.sp)
            } else {
                val camp = last["dengageCampId"] ?: last["campId"]
                Text(
                    if (camp == null || camp == "0")
                        "dengageCampId is ${camp ?: "absent"}, so this was NOT a real " +
                        "campaign send. A local push or a Test Send. It cannot produce " +
                        "an inbox row or an open."
                    else "dengageCampId $camp, a real campaign send.",
                    color = if (camp == null || camp == "0") Color(0xFF8A5A05) else Color(0xFF0F7A4D),
                    fontSize = 11.sp)
                Spacer(Modifier.height(6.dp))
                last.entries.sortedBy { it.key }.forEach { (k, v) ->
                    Row2(k, if (v.length > 40) v.take(40) + "..." else v)
                }
            }
        }

        /* One button per table. This is the NovaPay event model, not a generic
           demo: ten tables, real columns, no invented figures. */
        Card2("Fire the event model") {
            Text("One sample row per table, using NovaPay's own columns from " +
                 "EVENT-MODEL.md. Check them in Data Space under the contact key " +
                 "on the IDs screen. A 200 means accepted; the row in Data Space " +
                 "is the only proof.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            EventSamples.ALL.forEach { sample ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(sample.label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                        Text(sample.table, color = Color(0xFF64748B), fontSize = 10.5.sp)
                    }
                    Button(onClick = {
                        Events.send(sample.table, sample.eventType, sample.payload)
                        note = "sent ${sample.eventType} to ${sample.table}"
                    }) { Text("Send") }
                }
            }
            Primary("Fire all ten") {
                EventSamples.fireAll()
                note = "queued all ten, one every 120ms so the device's DNS resolver is " +
                       "not swamped. Watch the Events screen."
            }
        }

        /* Labelled LOCAL throughout, because a locally built payload that looks
           right has produced wrong conclusions on this project before. */
        Card2("Push gallery, drawn locally") {
            Text("Thirteen formats. Each is assembled on this device and handed to " +
                 "the SDK's OWN receiving path, so what appears is drawn by Dengage " +
                 "from a Dengage payload. What is skipped is the TRANSPORT: nothing " +
                 "reached the platform, so none of these can produce an inbox row, " +
                 "an open, or any campaign statistic. To evaluate delivery or " +
                 "server-side personalisation, reproduce the row with a real send.",
                 color = Color(0xFF8A5A05), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            NovaPayPushGallery.FORMATS.forEach { f ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(f.label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                        Text(f.note, color = Color(0xFF64748B), fontSize = 10.5.sp)
                        /* The tag is the half a local render cannot do. Printing
                           it beside the resolved output is what turns "we can
                           personalise" into something the prospect can paste. */
                        f.panelTag?.let { tag ->
                            Text(tag, color = Color(0xFF125CFA), fontSize = 10.5.sp)
                        }
                    }
                    Column {
                        Button(onClick = { note = NovaPayPushGallery.show(ctx, f.key) }) {
                            Text("Show")
                        }
                        f.panelTag?.let { tag ->
                            TextButton(onClick = { copyText(ctx, "panel tag", tag) }) {
                                Text("Copy tag", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
            Text("The carousel row is drawn by THIS APP, with Back and Next paging " +
                 "on the notification itself, because the SDK does not render that " +
                 "format. A real carousel push takes the same path and reports its " +
                 "open through Dengage.sendOpenEvent, so the campaign still counts it.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
        }

        Card2("Identity") {
            Text("Signed in as: " + (DemoState.email ?: "(anonymous)") +
                 "\nContact key: " + (DemoState.email?.let { Identity.resolve(it) } ?: "(none)"),
                 fontSize = 12.sp)
            Text("Anonymous is a legitimate state. A contact key is only set once " +
                 "somebody signs in. Sending the raw email where a mapping exists " +
                 "creates a SECOND contact for one human and splits every segment.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Primary("Re-send contact key") {
                DemoState.email?.let {
                    runCatching { Dengage.setContactKey(Identity.resolve(it)) }
                    note = "setContactKey(${Identity.resolve(it)})"
                } ?: run { note = "nobody signed in, so there is no contact key to send." }
            }
        }

        Card2("Server round trip") {
            Text("Each fires an event with the name shown. IN-APP can be answered " +
                 "by a Real Time campaign on that event. PUSH CANNOT: there is no " +
                 "real-time push campaign type. A push campaign is one-time or " +
                 "recurring and both take a segment, which refreshes on a schedule " +
                 "of tens of minutes, so no push campaign can answer a button press. " +
                 "The two routes worth evaluating are an Automation flow triggered " +
                 "on the event with a Fire Campaign action, or the Transactional " +
                 "Push API behind a relay on a fixed IP. Neither is wired yet: see " +
                 "MOBILE-SURFACES.md, what is blocked.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            TestRow("Text push", "campaign listens for: test_push_text") { fire("test_push_text", "Text push", "push") }
            TestRow("Rich push", "campaign listens for: test_push_rich") { fire("test_push_rich", "Rich push", "push") }
            TestRow("Inbox message", "campaign listens for: test_inbox_message") { fire("test_inbox_message", "Inbox", "inbox") }
            TestRow("In-App message", "campaign listens for: test_inapp") { fire("test_inapp", "In-App", "inapp") }
        }

        /* One row per layout the panel's template gallery offers, so a demo can
           be given with the gallery open beside the phone and the two agree
           line for line. There is nothing per layout in this app and there does
           not need to be: an In-App is HTML plus a position, so modal, banner,
           NPS, survey and spin to win are one mechanism with different content. */
        Card2("In-App, every layout the panel offers") {
            Text("Each row reports a screen name. The campaign targeted at that " +
                 "screen name decides what appears, so adding a fourteenth layout " +
                 "is a row in NovaPayInApp.kt and a campaign in the panel.\n\n" +
                 "THREE THINGS MUST BE TRUE OR NOTHING SHOWS, and none of them " +
                 "reports an error. A campaign must exist for that exact screen " +
                 "name. The device must already have FETCHED it, so refresh first. " +
                 "And Delivery Control must not have spent it already: the panel's " +
                 "\"once in every N minutes\" window is held against the visitor, " +
                 "so killing the app does not reset it.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))

            Primary("Refresh from the server") {
                runCatching { Dengage.getInAppMessages() }
                note = "asked the SDK to fetch. isInAppFetched = " +
                       (DengageCompat.isInAppFetched()?.toString() ?: "unknown")
            }
            Row2("In-App fetched",
                 DengageCompat.isInAppFetched()?.toString() ?: "unknown")
            Spacer(Modifier.height(4.dp))

            NovaPayInApp.PLACEMENTS.forEach { p ->
                TestRow(p.label, p.layout + "  |  " + p.screen, action = "Report") {
                    if (p.key == "realtime") {
                        /* The one row that does not wait for a fetch. The app
                           asks for a message NOW and sends two parameters the
                           content reads, so the message is resolved at the
                           moment of display rather than at campaign build time. */
                        /* onSuccess rather than a check on the note afterwards.
                           Reading the note back to decide what to write is how
                           a failure from an earlier press ends up suppressing a
                           later success. */
                        activity?.let {
                            runCatching {
                                Dengage.showRealTimeInApp(
                                    it, p.screen,
                                    hashMapOf("tier" to Events.customerTier,
                                              "surface" to "test_area")
                                )
                            }.onSuccess {
                                note = "asked for a real-time In-App on ${p.screen}, with " +
                                       "tier=${Events.customerTier} and surface=test_area."
                            }.onFailure { e -> note = "showRealTimeInApp failed: ${e.message}" }
                        }
                    } else {
                        activity?.let { runCatching { Dengage.setNavigation(it, p.screen) } }
                        note = "reported screen ${p.screen}. Paste ${p.file} into a " +
                               "campaign with layout: ${p.layout}."
                    }
                }
            }

            Primary("Report this screen again") {
                activity?.let { runCatching { Dengage.setNavigation(it, Screen.TEST) } }
                note = "reported screen '${Screen.TEST}' to the SDK."
            }

            /* The one control that makes an In-App demoable twice. Without it
               the only way past a message that is already on screen is to kill
               the app, which is not something to do on a call. */
            Primary("Dismiss whatever is showing") {
                runCatching { Dengage.removeInAppMessageDisplay() }
                note = "dismissed the current In-App, if one was showing."
            }
        }

        /* Four tags rather than one, and all four are things a campaign would
           actually segment on. The old single novapay_demo_tag proved the call
           worked and gave a marketer nothing to build with. */
        Card2("Tags, on the device record") {
            Text("Tags attach to the DEVICE, not the contact, so they will not " +
                 "appear on the contact's Fields tab. Segment on the tag instead, " +
                 "and confirm the result on the device record in the panel.\n\n" +
                 "Send them after the app has settled: the request goes out once " +
                 "the SDK has fetched its configuration, a few seconds after a " +
                 "cold start.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            DEMO_TAGS.forEach { (key, value) ->
                TestRow("$key = $value", "setTags", action = "Set") {
                    runCatching {
                        Dengage.setTags(listOf(TagItem(key, value)), ctx)
                        note = "set $key = $value on this device."
                    }.onFailure { note = "setTags failed: ${it.message}" }
                }
            }
            Primary("Set all four") {
                runCatching {
                    Dengage.setTags(DEMO_TAGS.map { TagItem(it.first, it.second) }, ctx)
                    note = "set all four in one call, which is how a real app would."
                }.onFailure { note = "setTags failed: ${it.message}" }
            }
        }

        /* The two id vocabularies the APP owns, printed with copy controls so a
           campaign can be built while looking at the phone. */
        Card2("App Stories placements") {
            Text("THE APP NAMES THESE, exactly like the inline placements below. " +
                 "showStoriesList takes a storyPropertyId this app chooses, and a " +
                 "Story set in the panel targets that string. Until one does the " +
                 "rail takes no height of its own and draws a marker naming the id, " +
                 "so it can be pointed at without pretending to be full.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            StoryPlacements.ALL.forEach { (id, screen, where) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(id, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text("screen: " + screen + "   " + where,
                             color = Color(0xFF64748B), fontSize = 10.5.sp)
                    }
                    TextButton(onClick = { copyText(ctx, id, id) }) {
                        Text("Copy", fontSize = 11.sp)
                    }
                }
            }
        }

        /* Every destination a campaign author can put in a Target URL. Printed
           rather than described, because a deep link to a host the app does not
           route lands nowhere and looks like a broken push. */
        Card2("Deep links a campaign can target") {
            Text("Every one of these is routed by MainActivity, from intent.data, " +
                 "targetUrl or dn_target_url, on a cold start and on a warm one. " +
                 "A link into a gated screen while signed out lands on sign-in " +
                 "rather than failing.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            Screen.ALL.forEach { s ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text("novapay://$s", fontSize = 12.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { copyText(ctx, s, "novapay://$s") }) {
                        Text("Copy", fontSize = 11.sp)
                    }
                }
            }
            Primary("Copy them all") {
                copyText(ctx, "NovaPay deep links",
                    Screen.ALL.joinToString("\n") { "novapay://$it" })
                note = "all ${Screen.ALL.size} deep links copied."
            }
        }

        /* The inbox has its own screen with the read and delete controls on it.
           What belongs here is the one fact that decides whether it can work at
           all, because the failure returns 200 [] and looks like an empty
           mailbox. */
        Card2("App Inbox") {
            Text("This handset reads " +
                 (if (DemoState.signedIn) "the CONTACT mailbox, type=c"
                  else "the DEVICE mailbox, type=d") +
                 ", because a contact key " +
                 (if (DemoState.signedIn) "is set" else "is not set") + ".\n\n" +
                 "Send inbox messages to the same address. A message sent to the " +
                 "device id while the app reads the contact mailbox returns 200 [], " +
                 "which is identical to an inbox with nothing in it.\n\n" +
                 "Unread, as the PLATFORM reported it: " +
                 NovaPayFcmService.unreadInbox + "\n\n" +
                 "The load, mark read, delete and clear controls are on the Inbox " +
                 "screen, next to the rows they act on.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
        }

        Card2("Live Update") {
            Text("An ongoing notification the APP draws from a map the server " +
                 "sends. Not an OS widget system: everything on screen is ours.\n\n" +
                 "Registered: " + NovaPayLiveUpdate.isRegistered() +
                 "   Active: " + NovaPayLiveUpdate.isActive() + "\n" +
                 "activityType the panel must send: " + NovaPayLiveUpdate.ACTIVITY_TYPE,
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            Text("The three buttons below are LOCAL. They step the handler " +
                 "directly and never reach Dengage, so they prove the drawing and " +
                 "nothing else: no campaign statistics, no server state. A local " +
                 "payload that looks right has fooled this project before.",
                 color = Color(0xFF8A5A05), fontSize = 11.sp)
            Primary("Local: START") {
                NovaPayLiveUpdate.playLocally(ctx, LiveUpdateEvent.START, 10)
                note = "local START drawn. Nothing was sent to Dengage."
            }
            Primary("Local: UPDATE") {
                NovaPayLiveUpdate.playLocally(ctx, LiveUpdateEvent.UPDATE, 65)
                note = "local UPDATE drawn, same notification id so it changes in place."
            }
            Primary("Local: END") {
                NovaPayLiveUpdate.playLocally(ctx, LiveUpdateEvent.END, 100)
                note = "local END drawn. Ongoing cleared, so it can be swiped away."
            }
        }

        Card2("Geofence") {
            Text("Behind a control on purpose. Background location is the most " +
                 "intrusive permission an app can ask for, and asking at first " +
                 "launch reads badly in a demo. Coarse and fine come first; " +
                 "background is a SECOND, separate grant that Android shows as " +
                 "its own dialog.\n\nA fence must also exist in the panel for " +
                 "the service to have anything to monitor.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Primary("Grant location") {
                activity?.let { runCatching { DengageGeofence.requestLocationPermissions(it) } }
                note = "asked for location. Background is a separate grant: expect a second dialog."
            }
            Primary("Start geofence") {
                runCatching { DengageGeofence.startGeofence() }
                    .onSuccess { note = "geofence started. It needs a fence defined in the panel to do anything." }
                    .onFailure { note = "startGeofence failed: ${it.message}" }
            }
            Primary("Stop geofence") {
                runCatching { DengageGeofence.stopGeofence() }
                note = "geofence stopped."
            }
        }

        /* The ids a campaign author needs, readable off the phone so the panel
           can be configured while looking at the device. */
        Card2("In-App inline placements") {
            Text("THE APP NAMES THESE. showInlineInApp takes a propertyId this app " +
                 "chooses, and the panel targets that string when you build a Real " +
                 "Time In-App inline campaign. A placement is the pair (screen, " +
                 "property id), so the same id on another screen is a different " +
                 "placement.\n\nThree relationships, and the five below cover all " +
                 "three: a campaign can be INSERTED ABOVE a piece of the app, " +
                 "INSERTED BELOW it, or REPLACE it outright. Nothing in the SDK " +
                 "call says which. The app decides, by where it mounts the element " +
                 "and, for a replacement, by drawing its own card only while the " +
                 "element is empty.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            InlinePlacements.ALL.forEach { (id, screen, where) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(id, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text("screen: " + screen + "   " + where,
                             color = Color(0xFF64748B), fontSize = 10.5.sp)
                    }
                    TextButton(onClick = { copyText(ctx, id, id) }) {
                        Text("Copy", fontSize = 11.sp)
                    }
                }
            }
            Primary("Copy all placement ids") {
                copyText(ctx, "NovaPay inline placements",
                    InlinePlacements.ALL.joinToString("\n") { it.first + "   (screen: " + it.second + ")" })
                note = "all five placement ids copied. Paste them into the panel."
            }
        }

        /* An empty placement used to draw nothing, which made the surface
           impossible to point at: a prospect had to take on faith that there
           was a slot under the balance card. Empty slots now draw a dashed
           marker naming the id and the relationship a campaign there would
           have. That is a demo affordance, not product behaviour, so it comes
           off here once real campaigns are running. */
        Card2("Placement markers") {
            Text("An empty inline placement or Stories rail draws a dashed outline " +
                 "naming its property id and what a campaign there would do, so the " +
                 "surface can be shown before any campaign exists. A filled one " +
                 "never draws it: the marker is what an EMPTY slot looks like.\n\n" +
                 "Turn them off to see the app exactly as a customer would.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text(if (SlotMarkers.enabled) "Markers are ON" else "Markers are OFF",
                     fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                     modifier = Modifier.weight(1f))
                Switch(checked = SlotMarkers.enabled,
                       onCheckedChange = { SlotMarkers.enabled = it })
            }
        }

        /* Four SDK setters that are neither events nor tags, and are the
           difference between a targeting rule that can be written and one that
           cannot.

           Country, state and city land on the DEVICE record, so a geographic
           segment costs no location permission at all: they answer "where does
           this handset live", not "is it inside that circle right now", which
           is what geofence is for.

           setInAppDeviceInfo is the one worth dwelling on. It puts arbitrary
           key/value pairs where an In-App display rule can read them, so a
           real-time message can be gated on something the app knows and the
           server has not been told yet: a balance band that changed a second
           ago, a plan tier, a feature flag. Without it every rule has to wait
           for an event to round trip and come back as a segment. */
        Card2("Device context, for rules events cannot express") {
            Text("Attributes on the device record rather than rows in a table. " +
                 "Geography gives segments with no location permission at all. " +
                 "In-App device info gives a real-time rule something the server " +
                 "has not been told yet.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            Primary("Set the geography") {
                runCatching {
                    Dengage.setCountry("US")
                    Dengage.setState("New York")
                    Dengage.setCity("New York")
                }.onSuccess {
                    note = "device set to New York, New York, US. Segment on it " +
                           "without ever asking for a location permission."
                }.onFailure { note = "geography failed: ${it.message}" }
            }
            Primary("Set In-App device info") {
                runCatching {
                    Dengage.setInAppDeviceInfo("plan_tier", "premium")
                    Dengage.setInAppDeviceInfo("balance_band", "500-1999")
                    Dengage.setInAppDeviceInfo("has_card", "true")
                }.onSuccess {
                    note = "set plan_tier, balance_band and has_card. An In-App " +
                           "display rule can read all three right now."
                }.onFailure { note = "device info failed: ${it.message}" }
            }
            Row2("In-App device info", inAppDeviceInfo())
            Primary("Clear In-App device info") {
                runCatching { Dengage.clearInAppDeviceInfo() }
                note = "cleared the In-App device info."
            }
            Primary("Report a category path") {
                runCatching { Dengage.setCategoryPath("Products > Cards > Travel") }
                note = "reported Products > Cards > Travel, which an In-App rule can " +
                       "match without waiting for a page view to land."
            }
            Row2("Notification permission", userPermission())
            Row2("SDK version", runCatching { Dengage.getSdkVersion() }.getOrNull() ?: "unknown")
        }

        Card2("Not in this app") {
            Text("Recommendation surfaces are not part of this app version, " +
                 "so there is no button for them here.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
        }

        Card2("Blocked on the panel") {
            Text("INLINE PLACEMENTS are not blocked. They are named by this app, " +
                 "listed above, and ready to target today.\n\n" +
                 "APP STORIES is not blocked either, and this card used to say it " +
                 "was. showStoriesList takes storyPropertyId as a plain argument, " +
                 "exactly as showInlineInApp takes propertyId, so the three ids in " +
                 "StoryPlacements are named by this app and their rails are already " +
                 "mounted on Home, Grow and Products. What is missing is a Story " +
                 "set in the panel targeting one of them.\n\n" +
                 "PUSH still needs the FCM service account JSON uploaded to the " +
                 "panel. Until it is, a Test Send reaches the device but a campaign " +
                 "send has nothing to authenticate with.\n\n" +
                 "GEOFENCE needs a fence defined in the panel. The service starts " +
                 "either way, so nothing errors: there is simply nothing to match.",
                 color = Color(0xFF64748B), fontSize = 11.sp)
        }

        if (note.isNotBlank()) Card2("Result") { Text(note, fontSize = 12.sp) }

        Note("A 200 from the event API means accepted. The proof an event landed " +
             "is the row visible in Data Space under a marker contact key.")
    }
}

/**
 * One labelled control.
 *
 * `detail` is printed verbatim rather than wrapped in a fixed phrase. It used
 * to read "campaign listens for: <name>", which was right for the four event
 * rows and wrong for every row added since: an In-App placement row names a
 * layout and a screen, and a tag row names a key and a value.
 */
@Composable
private fun TestRow(label: String, detail: String, action: String = "Send",
                    onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(detail, color = Color(0xFF64748B), fontSize = 11.sp)
        }
        Button(onClick = onClick) { Text(action) }
    }
}
