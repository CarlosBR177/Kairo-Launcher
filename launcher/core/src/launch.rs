//! Monta a linha de comando do Java e inicia o jogo.

use crate::auth::Account;
use crate::install::Installed;
use crate::mojang::{rules_allow, Argument, Features};
use crate::paths::Paths;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum GcMode {
    /// G1 ajustado para cliente: bom equilíbrio, padrão.
    #[default]
    G1,
    /// ZGC geracional (Java 21+): pausas mínimas, usa um pouco mais de RAM.
    Zgc,
}

#[derive(Debug, Clone)]
pub struct LaunchOptions {
    pub account: Account,
    pub game_dir: PathBuf,
    pub ram_mb: u32,
    pub gc: GcMode,
    pub extra_jvm_args: Vec<String>,
    pub resolution: Option<(u32, u32)>,
    pub fullscreen: bool,
    /// "host:porta" para entrar direto num servidor (Quick Play).
    pub quick_play_server: Option<String>,
    pub java_override: Option<PathBuf>,
}

/// Flags de desempenho para o cliente. Pensadas para FPS estável, não para servidor.
fn performance_flags(gc: GcMode, java_major: u32) -> Vec<String> {
    let mut f: Vec<String> = match gc {
        GcMode::Zgc if java_major >= 21 => vec!["-XX:+UseZGC".into(), "-XX:+ZGenerational".into()],
        _ => vec![
            "-XX:+UseG1GC".into(),
            "-XX:+UnlockExperimentalVMOptions".into(),
            "-XX:G1NewSizePercent=20".into(),
            "-XX:G1ReservePercent=20".into(),
            "-XX:MaxGCPauseMillis=50".into(),
            "-XX:G1HeapRegionSize=32M".into(),
            "-XX:+ParallelRefProcEnabled".into(),
        ],
    };
    // ZGenerational virou padrão (e a flag foi removida) no Java 24+
    if java_major >= 24 {
        f.retain(|x| x != "-XX:+ZGenerational");
    }
    f.push("-XX:+DisableExplicitGC".into());
    if java_major >= 25 {
        // cabeçalhos de objeto compactos: menos memória e menos trabalho do GC
        f.push("-XX:+UseCompactObjectHeaders".into());
    }
    f
}

fn substitute(arg: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = arg.to_string();
    for (k, v) in vars {
        let key = format!("${{{k}}}");
        if out.contains(&key) {
            out = out.replace(&key, v);
        }
    }
    out
}

fn expand(args: &[Argument], features: &Features, vars: &HashMap<&str, String>) -> Vec<String> {
    let mut out = Vec::new();
    for a in args {
        match a {
            Argument::Plain(s) => out.push(substitute(s, vars)),
            Argument::Conditional { rules, value } => {
                if rules_allow(Some(rules), features) {
                    out.extend(value.values().iter().map(|s| substitute(s, vars)));
                }
            }
        }
    }
    out
}

pub fn build_command(paths: &Paths, installed: &Installed, opts: &LaunchOptions) -> Command {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let classpath = installed
        .classpath
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(sep);

    let (width, height) = opts.resolution.unwrap_or((1280, 720));
    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("auth_player_name", opts.account.name.clone());
    vars.insert("version_name", installed.version.id.clone());
    vars.insert("game_directory", opts.game_dir.to_string_lossy().to_string());
    vars.insert("assets_root", paths.assets().to_string_lossy().to_string());
    vars.insert("game_assets", paths.assets().to_string_lossy().to_string());
    vars.insert("assets_index_name", installed.assets_index.clone());
    vars.insert("auth_uuid", opts.account.uuid.clone());
    vars.insert("auth_access_token", opts.account.access_token.clone());
    vars.insert("auth_session", opts.account.access_token.clone());
    vars.insert("clientid", String::new());
    vars.insert("auth_xuid", opts.account.xuid.clone().unwrap_or_default());
    vars.insert("user_type", opts.account.user_type().to_string());
    vars.insert("user_properties", "{}".to_string());
    vars.insert("version_type", "Kairo".to_string());
    vars.insert("resolution_width", width.to_string());
    vars.insert("resolution_height", height.to_string());
    vars.insert("quickPlayMultiplayer", opts.quick_play_server.clone().unwrap_or_default());
    vars.insert("natives_directory", installed.natives_dir.to_string_lossy().to_string());
    vars.insert("launcher_name", "Kairo".to_string());
    vars.insert("launcher_version", env!("CARGO_PKG_VERSION").to_string());
    vars.insert("classpath", classpath.clone());
    vars.insert("classpath_separator", sep.to_string());
    vars.insert("library_directory", paths.libraries().to_string_lossy().to_string());

    let features = Features {
        custom_resolution: opts.resolution.is_some(),
        quick_play_multiplayer: opts.quick_play_server.is_some(),
    };

    let mut jvm: Vec<String> = vec![
        format!("-Xms{}M", (opts.ram_mb / 2).max(512)),
        format!("-Xmx{}M", opts.ram_mb),
    ];
    jvm.extend(performance_flags(opts.gc, installed.java_major));
    if let Some(log) = &installed.logging_arg {
        jvm.push(log.clone());
    }

    let mut game: Vec<String>;
    match &installed.version.arguments {
        Some(a) if !a.jvm.is_empty() => {
            jvm.extend(expand(&a.jvm, &features, &vars));
            game = expand(&a.game, &features, &vars);
        }
        other => {
            // versões antigas: argumentos padrão de JVM + string única do jogo
            jvm.push(format!("-Djava.library.path={}", installed.natives_dir.to_string_lossy()));
            jvm.push("-cp".into());
            jvm.push(classpath);
            game = other.as_ref().map(|a| expand(&a.game, &features, &vars)).unwrap_or_default();
            if let Some(s) = &installed.version.minecraft_arguments {
                game.extend(s.split_whitespace().map(|x| substitute(x, &vars)));
            }
        }
    }
    jvm.extend(opts.extra_jvm_args.iter().filter(|s| !s.trim().is_empty()).cloned());
    if opts.fullscreen {
        game.push("--fullscreen".into());
    }
    if let (Some(server), true) = (&opts.quick_play_server, installed.version.minecraft_arguments.is_some()) {
        // versões antigas não têm quick play: usam --server/--port
        let (host, port) = server.split_once(':').unwrap_or((server.as_str(), "25565"));
        game.extend(["--server".into(), host.into(), "--port".into(), port.into()]);
    }

    let java = console_java(opts.java_override.clone().unwrap_or_else(|| installed.java.clone()));
    let mut cmd = Command::new(java);
    cmd.args(&jvm)
        .arg(&installed.version.main_class)
        .args(&game)
        .current_dir(&opts.game_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        // sem janela de console extra
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

/// `javaw.exe` não escreve no stderr (mostra erros numa caixa de diálogo).
/// Se existir um `java.exe` ao lado, usa ele para os logs chegarem à aba Console.
fn console_java(java: std::path::PathBuf) -> std::path::PathBuf {
    let is_javaw = java.file_name().map(|n| n.to_string_lossy().eq_ignore_ascii_case("javaw.exe")).unwrap_or(false);
    if is_javaw {
        let alt = java.with_file_name("java.exe");
        if alt.exists() {
            return alt;
        }
    }
    java
}

/// Comando completo em uma linha (para mostrar na aba Console), sem o token da conta.
pub fn describe_command(cmd: &Command) -> String {
    let std = cmd.as_std();
    let mut hide_next = false;
    let mut out = vec![std.get_program().to_string_lossy().into_owned()];
    for a in std.get_args() {
        let a = a.to_string_lossy();
        if hide_next {
            out.push("********".into());
            hide_next = false;
            continue;
        }
        hide_next = a == "--accessToken";
        if a.len() > 300 {
            out.push(format!("{}… ({} caracteres)", &a[..a.char_indices().nth(120).map(|(i, _)| i).unwrap_or(a.len())], a.len()));
        } else {
            out.push(a.into_owned());
        }
    }
    out.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mojang::VersionJson;

    /// Versão sintética no formato moderno (1.13+), com regras de recursos.
    fn sample() -> Installed {
        let json = r#"{
          "id": "fabric-loader-0.20.1-26.3",
          "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient",
          "arguments": {
            "game": ["--username", "${auth_player_name}", "--uuid", "${auth_uuid}", "--accessToken", "${auth_access_token}",
                     "--userType", "${user_type}", "--gameDir", "${game_directory}",
                     {"rules": [{"action": "allow", "features": {"is_demo_user": true}}], "value": "--demo"},
                     {"rules": [{"action": "allow", "features": {"has_custom_resolution": true}}], "value": ["--width", "${resolution_width}", "--height", "${resolution_height}"]},
                     {"rules": [{"action": "allow", "features": {"is_quick_play_multiplayer": true}}], "value": ["--quickPlayMultiplayer", "${quickPlayMultiplayer}"]}],
            "jvm": ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}",
                    {"rules": [{"action": "allow", "os": {"name": "osx"}}], "value": "-XstartOnFirstThread"}]
          }
        }"#;
        Installed {
            version: serde_json::from_str::<VersionJson>(json).unwrap(),
            vanilla_id: "26.3".into(),
            java: "java".into(),
            java_major: 25,
            classpath: vec!["a.jar".into(), "b.jar".into()],
            natives_dir: "natives".into(),
            assets_index: "30".into(),
            logging_arg: None,
        }
    }

    fn args(cmd: &Command) -> Vec<String> {
        cmd.as_std().get_args().map(|a| a.to_string_lossy().to_string()).collect()
    }

    #[test]
    fn monta_argumentos() {
        let opts = LaunchOptions {
            account: crate::auth::offline("Carlos").unwrap(),
            game_dir: "inst".into(),
            ram_mb: 4096,
            gc: GcMode::G1,
            extra_jvm_args: vec![],
            resolution: Some((1600, 900)),
            fullscreen: false,
            quick_play_server: Some("mc.exemplo.com:25565".into()),
            java_override: None,
        };
        let a = args(&build_command(&Paths::new("root".into()), &sample(), &opts));
        let joined = a.join(" ");
        assert!(joined.contains("-Xmx4096M"));
        assert!(joined.contains("-XX:+UseCompactObjectHeaders"));
        assert!(joined.contains("--username Carlos"));
        assert!(joined.contains("--userType legacy"));
        assert!(joined.contains("--width 1600 --height 900"));
        assert!(joined.contains("--quickPlayMultiplayer mc.exemplo.com:25565"));
        assert!(!joined.contains("--demo"));
        assert!(!joined.contains("${"), "placeholder sem substituir: {joined}");
        let main = a.iter().position(|x| x == "net.fabricmc.loader.impl.launch.knot.KnotClient").unwrap();
        assert!(a.iter().position(|x| x == "-cp").unwrap() < main, "JVM args antes da main class");

        let mut no_server = opts.clone();
        no_server.quick_play_server = None;
        let joined = args(&build_command(&Paths::new("root".into()), &sample(), &no_server)).join(" ");
        assert!(!joined.contains("quickPlay"));
    }
}
