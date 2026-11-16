// Script compartilhado por todas as versões (cada uma lê versions/<versão>/gradle.properties).
plugins {
    id("dev.kikugie.loom-back-compat")
}

val mc: String = stonecutter.current.version
val obfuscated = stonecutter.eval(mc, "<26")
val javaVersion = if (obfuscated) 21 else 25

fun prop(name: String): String = property(name).toString()

version = "${prop("mod_version")}+$mc"
group = prop("maven_group")

base {
    archivesName.set(prop("archives_base_name"))
}

dependencies {
    minecraft("com.mojang:minecraft:$mc")
    // mapeamentos da Mojang nas versões ofuscadas (1.21.x); na 26.x não faz nada
    loomx.applyMojangMappings()
    modImplementation("net.fabricmc:fabric-loader:${prop("loader_version")}")
    modImplementation("net.fabricmc.fabric-api:fabric-api:${prop("fabric_api_version")}")
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(javaVersion))
    withSourcesJar()
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(javaVersion)
    options.encoding = "UTF-8"
}

tasks.processResources {
    val props = mapOf(
        "version" to project.version.toString(),
        "mc_range" to prop("mc_range"),
        "java" to javaVersion.toString(),
        "java_level" to "JAVA_$javaVersion",
    )
    inputs.properties(props)
    filesMatching(listOf("fabric.mod.json", "kairo.mixins.json")) {
        expand(props)
    }
}
