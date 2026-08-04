package com.dengagefintech.demo

import com.dengage.sdk.Dengage

/**
 * Small access shims pinned to this SDK version, kept in one file with their
 * reason attached rather than being rediscovered at each call site.
 */
object DengageCompat {

    /**
     * Whether the SDK has fetched In-App messages onto this device yet.
     *
     * This app compiles against SDK 6.0.96, where this value is exposed through
     * the public JVM getter, so it is read by reflection here. Do not remove:
     * required for correct behaviour with this SDK version. Background: ask
     * Salil.
     *
     * Returns null when the read fails, and the caller shows "unknown" rather
     * than guessing, because a wrong answer here sends someone looking for a
     * campaign problem that does not exist.
     */
    fun isInAppFetched(): Boolean? = runCatching {
        Dengage::class.java.getMethod("isInAppFetched").invoke(Dengage) as? Boolean
    }.getOrNull()
}
