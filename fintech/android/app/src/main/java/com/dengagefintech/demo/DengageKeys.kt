package com.dengagefintech.demo

/**
 * Everything that identifies this app to Dengage.
 *
 * The integration key is passed VERBATIM, escaping included. The panel shows it
 * containing `_p_l_` and `_e_q_` and that is exactly what the SDK expects. A
 * whole debugging cycle went into a theory that those were a broken escaping of
 * `+` and `=`; a screenshot of the panel killed it. Do not "fix" them.
 *
 * This is not a secret in the same way the FCM service account key is: it is
 * sent from the device on every call, so it is fine checked in. The service
 * account JSON is the real secret and lives ONLY in the Dengage panel.
 */
object DengageKeys {
    const val FIREBASE_INTEGRATION_KEY =
        "N2A7bUiV0FjaJ6ckw_p_l_K3hEswBsmNm2_s_l_WW_p_l_qr6MX2Ay8sgzrYv6hj97ZQL4FUpbGj2bwMh" +
        "EaCPVB7GBdB4BpHngtoxJ2_p_l_LKV_s_l_Kv1E6c0cvj10q0E3ISsShVZ_s_l_D_s_l_n_s_l_BOJJ8q" +
        "dOQpjdrc_s_l_WUkSzwwos6Q_e_q__e_q_"

    /** Mobile app public id from the panel. Separate from the WEB app guid
     *  c8d2da44-b982-1925-9ad8-e7caddf0894a, which belongs to the website. */
    const val APP_PUBLIC_ID = "2408eae9-7b9c-5b95-e8a7-6809aa97d62c"

    /** Sent on every row as app_version. Deliberately distinguishable from the
     *  website's own 'web-2.0.0' so a row's origin is obvious in Data Space. */
    const val APP_VERSION = "android-1.0.0"

    /** event_source on every row. The website sends 'web'. Same tables, one
     *  segment across both surfaces, told apart by this column. */
    const val EVENT_SOURCE = "android"
}
