// Kairo Client multiversão (Stonecutter): um código só, um jar por versão do Minecraft.
// Versões: 1.21.1 · 1.21.4 · 1.21.8 · 1.21.11 · 26.3 (a 26.3 é a "ativa" no código-fonte).
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
        maven("https://maven.fabricmc.net/") { name = "Fabric" }
        maven("https://maven.kikugie.dev/releases") { name = "KikuGie Releases" }
        maven("https://maven.kikugie.dev/snapshots") { name = "KikuGie Snapshots" }
    }
}

plugins {
    // baixa sozinho o JDK 21 (1.21.x) e o JDK 25 (26.x) quando faltar
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
    id("dev.kikugie.stonecutter") version "0.9.6"
    // escolhe fabric-loom (26.x, sem ofuscação) ou fabric-loom-remap (1.21.x) por versão
    id("dev.kikugie.loom-back-compat") version "0.4"
}

stonecutter {
    create(rootProject) {
        versions("1.21.1", "1.21.4", "1.21.8", "1.21.11", "26.3")
        vcsVersion = "26.3"
    }
}

rootProject.name = "kairo-client"
