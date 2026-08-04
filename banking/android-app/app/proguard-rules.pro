# The SDK reads model classes reflectively when it deserialises push and
# in-app payloads, so its package must survive shrinking.
-keep class com.dengage.sdk.** { *; }
