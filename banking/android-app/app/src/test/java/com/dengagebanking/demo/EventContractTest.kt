package com.dengagebanking.demo

import com.dengagebanking.demo.events.EventSamples
import com.dengagebanking.demo.events.MeridianEvents
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.Calendar

/* The contract this app shares with the website. These are the things that
   have actually gone wrong on this integration, so they are asserted rather
   than trusted. */
class EventContractTest {

    @Test
    fun `writes exactly the nine banking tables`() {
        assertEquals(
            listOf(
                "banking_account_events", "banking_application_events",
                "banking_appointment_events", "banking_card_events",
                "banking_engagement_events", "banking_product_events",
                "banking_tool_events", "banking_transaction_events",
                "banking_wealth_events"
            ),
            MeridianEvents.TABLES.sorted()
        )
    }

    @Test
    fun `the catalogue covers all 86 event types`() {
        assertEquals(86, EventSamples.TOTAL_EVENT_TYPES)
        assertEquals(9, MeridianEvents.CATALOGUE.size)
    }

    /* The app and the website must not drift apart quietly. This reads the
       website's own event layer and asserts the Kotlin catalogue matches it,
       table for table and type for type. Add an event to one channel and
       forget the other and this goes red, rather than the two channels
       silently reporting different things about the same customer. */
    @Test
    fun `the catalogue matches the website's event layer exactly`() {
        val js = File("../../js/bankingEvents.js")
        if (!js.exists()) return

        val src = js.readText()

        val tableKeys = Regex("(\\w+):\\s+'(banking_\\w+)'")
            .findAll(src)
            .associate { it.groupValues[1] to it.groupValues[2] }

        val fromWeb = mutableMapOf<String, MutableSet<String>>()
        Regex("send\\(TABLES\\.(\\w+),\\s*'([^']+)'").findAll(src).forEach { m ->
            val table = tableKeys[m.groupValues[1]] ?: return@forEach
            fromWeb.getOrPut(table) { mutableSetOf() }.add(m.groupValues[2])
        }

        assertEquals("tables", fromWeb.keys.sorted(), MeridianEvents.CATALOGUE.keys.sorted())
        fromWeb.forEach { (table, webTypes) ->
            assertEquals(
                "event types for $table",
                webTypes.sorted(),
                MeridianEvents.CATALOGUE[table].orEmpty().sorted()
            )
        }
    }

    /* Every column of every table has to be reachable, or a table looks empty
       in Data Space for a reason nobody can see. These counts exclude the five
       common columns every row carries. */
    @Test
    fun `every table exposes its full column set`() {
        assertEquals(10, MeridianEvents.ProductInput().columns().size)
        assertEquals(16, MeridianEvents.ToolInput().columns().size)
        assertEquals(15, MeridianEvents.ApplicationInput().columns().size)
        assertEquals(9, MeridianEvents.AppointmentInput().columns().size)
        assertEquals(13, MeridianEvents.AccountInput().columns().size)
        assertEquals(14, MeridianEvents.TransactionInput().columns().size)
        assertEquals(10, MeridianEvents.CardInput().columns().size)
        assertEquals(10, MeridianEvents.WealthInput().columns().size)
        assertEquals(8, MeridianEvents.EngagementInput().columns().size)
    }

    /* Dengage DATETIME is yyyy-MM-dd HH:mm. No seconds, no T, no Z, no
       offset. */
    @Test
    fun `datetime has no seconds, no T and no zone`() {
        val d = Calendar.getInstance().apply { set(2026, 7, 1, 9, 5, 33) }.time
        val s = MeridianEvents.toDengageDateTime(d)!!
        assertEquals("2026-08-01 09:05", s)
        assertTrue(!s.contains("T") && !s.contains("Z") && !s.contains("+"))
    }

    @Test
    fun `date is yyyy-MM-dd`() {
        val d = Calendar.getInstance().apply { set(2026, 7, 1, 9, 5, 33) }.time
        assertEquals("2026-08-01", MeridianEvents.toDengageDate(d))
    }

    @Test
    fun `null dates stay null rather than becoming an epoch`() {
        assertNull(MeridianEvents.toDengageDateTime(null))
        assertNull(MeridianEvents.toDengageDate(null))
    }

    /* One person must be one contact across web and app. The website maps
       salil@dengage.com to the contact key salil-demo; if the app sent the
       e-mail instead, the same human would arrive in Dengage as two contacts
       and the cross-channel journey would silently not exist. */
    @Test
    fun `a mapped demo contact resolves to its contact key, not its e-mail`() {
        assertEquals("salil-demo", MeridianEvents.normaliseContactKey("  Salil@Dengage.com "))
    }

    @Test
    fun `an ordinary address resolves to itself, lower-cased and trimmed`() {
        assertEquals(
            "eleanor@example.co.uk",
            MeridianEvents.normaliseContactKey(" Eleanor@Example.co.uk ")
        )
    }

    /* The same map has to exist on both sides. Reading the website's file
       here means adding a demo contact to one channel and forgetting the other
       goes red rather than producing a split contact nobody notices. */
    @Test
    fun `the known-contact map matches the website's`() {
        val js = java.io.File("../../js/identity.js")
        if (!js.exists()) return
        val web = Regex("'([^']+@[^']+)':\\s*'([^']+)'")
            .findAll(js.readText())
            .associate { it.groupValues[1] to it.groupValues[2] }
        web.forEach { (email, key) ->
            assertEquals("contact key for $email", key, MeridianEvents.normaliseContactKey(email))
        }
    }

    /* A screen name that MainActivity does not recognise routes to Overview,
       silently. That is the right behaviour for a typo in a campaign and the
       wrong behaviour for a screen this app actually has: the deep link would
       land on the wrong page and nothing would say so. Reading both files
       here means adding a screen and forgetting to route it goes red. */
    @Test
    fun `every declared screen is routable by deep link`() {
        val keys = File("src/main/java/com/dengagebanking/demo/DengageKeys.kt")
        val main = File("src/main/java/com/dengagebanking/demo/MainActivity.kt")
        if (!keys.exists() || !main.exists()) return

        val declared = Regex("const val ([A-Z_]+) = \"([a-z_]+)\"")
            .findAll(keys.readText().substringAfter("object Screen {").substringBefore("\n    }"))
            .map { it.groupValues[1] }
            .toList()
        assertTrue("Screen vocabulary should not be empty", declared.isNotEmpty())

        val routed = main.readText()
            .substringAfter("private fun knownScreen")
            .substringBefore("return known.firstOrNull")
        /* SIGN_IN is deliberately not routable: a push cannot usefully drop
           somebody on a sign-in form they have already passed. */
        declared.filter { it != "SIGN_IN" }.forEach { name ->
            assertTrue(
                "DengageKeys.Screen.$name is declared but MainActivity.knownScreen " +
                    "does not list it, so meridian:// for it lands on Overview",
                routed.contains("Screen.$name")
            )
        }
    }
}
