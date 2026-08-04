package com.dengagefintech.demo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * These read the WEBSITE'S OWN FILES and fail if the app has drifted from them.
 *
 * They exist because column names are a contract: the row in Data Space is the
 * only proof a column stored, and retyping a name is how drift starts. So
 * nothing here is retyped, it is compared.
 */
class ParityTest {

    /**
     * Walks up from the test's working directory to find the website's js
     * folder. Gradle runs unit tests with the working directory set to the
     * MODULE (app/), not the project root, so a fixed "../js" pointed at
     * fintech/android/js and every website-reading test failed on a missing
     * file rather than on a real mismatch. Searching makes the tests immune to
     * where they are run from.
     */
    private val siteJs: File by lazy {
        var dir: File? = File("").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "fintech/js")
            if (File(candidate, "novapayEvents.js").exists()) return@lazy candidate
            // also handle being run from inside fintech/ itself
            val sibling = File(dir, "js")
            if (File(sibling, "novapayEvents.js").exists()) return@lazy sibling
            dir = dir.parentFile
        }
        throw AssertionError("could not locate the website's js folder from ${File("").absolutePath}")
    }

    private fun read(name: String): String {
        val f = File(siteJs, name)
        assertTrue("cannot find the website file $name at ${f.absolutePath}", f.exists())
        return f.readText()
    }

    /** Every table the app writes must exist in the website's event layer. */
    @Test
    fun `table names match the website`() {
        val js = read("novapayEvents.js")
        val siteTables = Regex("'(fintech_[a-z_]+_events)'").findAll(js)
            .map { it.groupValues[1] }.toSortedSet()
        assertTrue("website declares no tables, the regex or the file moved",
                   siteTables.isNotEmpty())
        assertEquals("app and website disagree about the table list",
                     siteTables, Events.Tables.ALL.toSortedSet())
    }

    /** The six spine columns the app writes, exactly as the website writes them. */
    @Test
    fun `spine columns match the website`() {
        val js = read("novapayEvents.js")
        Events.SPINE_WRITTEN.forEach {
            assertTrue("website never writes spine column $it", js.contains("row.$it"))
        }
        // And the three the SDK owns must NOT be written by hand on either side.
        Events.SPINE_SDK_OWNED.forEach {
            assertTrue("$it is the SDK's to write, the website must not set it",
                       !js.contains("row.$it ="))
        }
    }

    /** The contact-key map, or one human becomes two contacts. */
    @Test
    fun `contact key map matches identity_js`() {
        val js = read("identity.js")
        Identity.KNOWN_CONTACTS.forEach { (email, key) ->
            assertTrue("identity.js has no mapping for $email",
                       js.contains("'$email': '$key'"))
        }
        val siteCount = Regex("'[^']+@[^']+':\\s*'[^']+'").findAll(
            js.substringAfter("KNOWN_CONTACTS").substringBefore("}")
        ).count()
        assertEquals("identity.js and the app map a different number of contacts",
                     siteCount, Identity.KNOWN_CONTACTS.size)
    }

    /** Bands drive segments, so a drift here silently re-buckets every contact. */
    @Test
    fun `bands match the website`() {
        assertEquals("negative", Events.balanceBand(-1.0))
        assertEquals("0-99", Events.balanceBand(99.0))
        assertEquals("100-499", Events.balanceBand(100.0))
        assertEquals("500-1999", Events.balanceBand(500.0))
        assertEquals("2000-9999", Events.balanceBand(2000.0))
        assertEquals("10000+", Events.balanceBand(10000.0))

        assertEquals("poor", Events.creditScoreBand(559))
        assertEquals("fair", Events.creditScoreBand(560))
        assertEquals("good", Events.creditScoreBand(620))
        assertEquals("very_good", Events.creditScoreBand(720))
        assertEquals("excellent", Events.creditScoreBand(800))
    }

    /**
     * DATE yyyy-MM-dd and DATETIME yyyy-MM-dd HH:mm. No seconds, no T, no Z, no
     * offset. These exact formats are the storage contract, not ISO 8601, and
     * the row in Data Space is the only proof a value stored as intended.
     */
    @Test
    fun `date formats are exactly what the platform stores`() {
        assertTrue(Events.date().matches(Regex("\\d{4}-\\d{2}-\\d{2}")))
        assertTrue(Events.dateTime().matches(Regex("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}")))
        assertTrue("datetime must not carry seconds", !Events.dateTime().matches(Regex(".*:\\d{2}:\\d{2}")))
        assertTrue("datetime must not be ISO 8601", !Events.dateTime().contains("T"))
    }

    /** Instrumentation must never leak into the real catalogue. */
    @Test
    fun `test_ events are not in the catalogue`() {
        Events.Tables.ALL.forEach {
            assertTrue("a test_ table leaked into the catalogue: $it", !it.startsWith("test_"))
        }
    }

    /** A card has no unit count. A fabricated one poisons every segment. */
    @Test
    fun `stock_count is never sent`() {
        val sources = File("src/main/java/com/dengagefintech/demo").walkTopDown()
            .filter { it.extension == "kt" }
        val offenders = sources.filter { f ->
            f.readText().lines().any { l ->
                l.contains("\"stock_count\"") && !l.trimStart().startsWith("//")
            }
        }.map { it.name }.toList()
        assertEquals("stock_count must never be sent from a finance app",
                     emptyList<String>(), offenders)
    }

    /** Deep links must resolve to real screens, and unknown hosts to nothing. */
    @Test
    fun `deep links map onto screen names`() {
        assertEquals(Screen.CARDS, Screen.fromDeepLink("novapay://cards"))
        assertEquals(Screen.GROW, Screen.fromDeepLink("novapay://grow?utm=x"))
        assertEquals(null, Screen.fromDeepLink("novapay://nope"))
        assertEquals(null, Screen.fromDeepLink(null))
    }
}
