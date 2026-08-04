package com.dengagefintech.demo

/**
 * Resolves an email to the SAME contact key the website uses.
 *
 * Sending the raw email where a mapping exists creates a SECOND contact for one
 * human and quietly splits every segment and every journey. The map is mirrored
 * from fintech/js/identity.js and IdentityParityTest fails if the two drift.
 */
object Identity {
    /** Mirrors KNOWN_CONTACTS in fintech/js/identity.js. */
    val KNOWN_CONTACTS = mapOf(
        "salil@dengage.com" to "salil-demo"
    )

    fun resolve(email: String): String {
        val e = email.trim().lowercase()
        return KNOWN_CONTACTS[e] ?: e
    }
}
