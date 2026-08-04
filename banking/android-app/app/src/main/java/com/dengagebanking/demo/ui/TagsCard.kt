package com.dengagebanking.demo.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dengage.sdk.Dengage
import com.dengage.sdk.domain.tag.model.TagItem

/* Tags.

   Tags are the durable facts a bank segments on between events, where the nine
   tables carry what happened. A demo needs both, because "customers with a
   mortgage who went overdrawn last month" is one of each.

   THEY ATTACH TO THE DEVICE, NOT THE CONTACT. The request is keyed by the
   device id, not the contact key, so a tag set here will never appear on the
   contact's Fields tab, which holds contact attributes and is fed from
   elsewhere. Look at the device record, and segment on the tag rather than
   expecting it beside the contact's email.

   Send tags after the app has settled: the request goes out once the SDK has
   fetched its configuration, a few seconds after a cold start. Then confirm
   the result on the device record in the panel.

   THE EXPIRING TAG IS WORTH THE EXTRA BUTTON. TagItem carries removeTime,
   changeTime and changeValue as well as the plain (tag, value) pair, and
   removeTime is the one that matters for a bank: campaign eligibility that
   clears itself. A "rate week offer" tag with no expiry has to be cleaned up
   by somebody, and nobody does, so six months later a segment is quietly
   wrong. Set removeTime and the platform forgets it on schedule.

   The constructor that takes them is
   TagItem(tag, value, changeTime: Date?, changeValue: String?, removeTime: Date?). */
@Composable
fun TagsCard() {
    var applied by remember { mutableStateOf<String?>(null) }

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("Tags", fontWeight = FontWeight.SemiBold)
            Text(
                "Durable facts on the contact, as opposed to the events in the " +
                    "tables. Segment on both together.",
                fontSize = 12.sp, color = MeridianColours.soft
            )
            Spacer(Modifier.height(10.dp))

            Row {
                Button(onClick = {
                    Dengage.setTags(
                        listOf(
                            TagItem("relationship", "premier"),
                            TagItem("holds_mortgage", "true"),
                            TagItem("channel_preference", "app"),
                            TagItem("risk_profile", "balanced")
                        )
                    )
                    applied = "4 tags set"
                }) { Text("Set demo tags") }

                Spacer(Modifier.width(8.dp))

                OutlinedButton(onClick = {
                    /* Setting a tag to an empty value is how the API clears it:
                       there is no removeTag call, only setTags and removeTime. */
                    Dengage.setTags(
                        listOf(
                            TagItem("relationship", ""),
                            TagItem("holds_mortgage", ""),
                            TagItem("channel_preference", ""),
                            TagItem("risk_profile", "")
                        )
                    )
                    applied = "tags cleared"
                }) { Text("Clear") }
            }

            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = {
                /* Eligibility that cleans itself up. Seven days is Rate Week
                   plus slack; the platform drops the tag on that date whether
                   or not anybody remembers it exists. */
                val expires = java.util.Calendar.getInstance().apply {
                    add(java.util.Calendar.DAY_OF_MONTH, 7)
                }.time
                Dengage.setTags(
                    listOf(TagItem("rate_week_eligible", "true", null, null, expires))
                )
                applied = "rate_week_eligible set with a removeTime seven days out"
            }) { Text("Set a tag that expires") }

            applied?.let {
                Spacer(Modifier.height(8.dp))
                Text(
                    "$it, against this device id, not the contact key. " +
                        "Look at the device record, or segment on the tag.",
                    fontSize = 11.sp, color = MeridianColours.soft
                )
            }
        }
    }
}
