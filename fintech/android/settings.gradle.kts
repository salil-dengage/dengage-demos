pluginManagement {
    repositories {
        google { content {
            includeGroupByRegex("com\\.android.*"); includeGroupByRegex("com\\.google.*")
            includeGroupByRegex("androidx.*")
        } }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // The Dengage Android SDK is published on JitPack, not Maven Central.
        maven { url = uri("https://jitpack.io") }
    }
}
rootProject.name = "NovaPay Demo"
include(":app")
