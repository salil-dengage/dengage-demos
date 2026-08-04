pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // The Dengage SDK is published through JitPack, not Maven Central.
        maven { url = uri("https://jitpack.io") }
    }
}
rootProject.name = "MeridianBank"
include(":app")
