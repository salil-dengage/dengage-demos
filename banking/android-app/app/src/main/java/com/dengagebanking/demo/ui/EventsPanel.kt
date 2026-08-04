package com.dengagebanking.demo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.LinearProgressIndicator
import com.dengagebanking.demo.events.EventSamples
import kotlinx.coroutines.delay
import com.dengagebanking.demo.events.MeridianEvents

/* The app's counterpart to the website's Events launcher.

   Ordinary use of the app writes whichever columns a screen happens to know
   about, which is honest but leaves most of a table's columns empty. This
   panel exists so the integration can be shown and checked in full: every one
   of the 86 event types across the nine tables, each with every column of its
   table populated.

   "Send all 86" is the button worth knowing about. It writes the entire
   schema in one press, from one device, under one contact key, which turns
   "the app feeds everything the website does" from a claim into something
   visible in Data Space a few seconds later. */
@Composable
fun EventsPanelScreen() {
    var expanded by remember { mutableStateOf<String?>(null) }
    var sent by remember { mutableIntStateOf(0) }
    var pending by remember { mutableIntStateOf(0) }
    val logLines = remember { mutableStateListOf<String>() }

    /* Polls the queue rather than tracking the batch itself, so the reading
       stays correct even if the screen is left and reopened mid-run. */
    LaunchedEffect(Unit) {
        while (true) {
            pending = MeridianEvents.pending
            refreshLogInto(logLines)
            delay(400)
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {

        Text(
            "EVENT CONTROL PANEL",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp,
            color = MeridianColours.soft
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "${EventSamples.TOTAL_EVENT_TYPES} event types across " +
                "${MeridianEvents.CATALOGUE.size} tables. Every column populated.",
            fontSize = 13.sp
        )
        Spacer(Modifier.height(12.dp))

        Button(
            onClick = { sent += EventSamples.fireEverything() },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Send all ${EventSamples.TOTAL_EVENT_TYPES}") }

        if (pending > 0) {
            Spacer(Modifier.height(6.dp))
            Text("$pending still going out...", fontSize = 11.sp, color = MeridianColours.soft)
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        }

        if (sent > 0) {
            Spacer(Modifier.height(6.dp))
            Text(
                "$sent rows sent this session. Confirm them in Data Space.",
                fontSize = 11.sp, color = MeridianColours.soft
            )
        }

        Spacer(Modifier.height(8.dp))

        LazyColumn(Modifier.weight(1f)) {
            items(MeridianEvents.CATALOGUE.keys.toList()) { table ->
                val types = MeridianEvents.CATALOGUE[table].orEmpty()
                val isOpen = expanded == table
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    table.removePrefix("banking_").removeSuffix("_events")
                                        .replace('_', ' ').replaceFirstChar { it.uppercase() },
                                    fontWeight = FontWeight.SemiBold, fontSize = 14.sp
                                )
                                Text("${types.size} event types", fontSize = 11.sp, color = MeridianColours.soft)
                            }
                            TextButton(onClick = { sent += EventSamples.fireTable(table) }) {
                                Text("Send all")
                            }
                            TextButton(onClick = { expanded = if (isOpen) null else table }) {
                                Text(if (isOpen) "Hide" else "Show")
                            }
                        }
                        if (isOpen) {
                            Spacer(Modifier.height(6.dp))
                            types.forEach { type ->
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(type, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                    TextButton(onClick = {
                                        EventSamples.fire(table, type); sent += 1
                                    }) { Text("Send", fontSize = 12.sp) }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (logLines.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text("LAST SENT", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp, color = MeridianColours.soft)
            Column(
                Modifier.fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                    .padding(10.dp)
            ) {
                logLines.take(6).forEach {
                    Text(it, fontSize = 10.sp, color = MeridianColours.soft)
                }
            }
        }
    }
}

private fun refreshLogInto(target: MutableList<String>) {
    val snapshot = synchronized(MeridianEvents.log) { MeridianEvents.log.take(12) }
    target.clear()
    target.addAll(snapshot)
}
