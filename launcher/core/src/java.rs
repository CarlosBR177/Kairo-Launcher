//! Java automático usando os mesmos runtimes que o launcher oficial da Mojang.
//! O usuário não precisa ter Java instalado.

use crate::http::{self, get_json, Job};
use crate::paths::Paths;
use crate::progress::{report, ProgressFn};
use crate::{Error, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;

const ALL_URL: &str =
    "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";

#[derive(Deserialize)]
struct RuntimeEntry {
    manifest: ManifestRef,
    version: RuntimeVersion,
}
#[derive(Deserialize)]
struct ManifestRef {
    url: String,
}
#[derive(Deserialize)]
struct RuntimeVersion {
    name: String,
}
#[derive(Deserialize)]
struct RuntimeManifest {
    files: HashMap<String, RuntimeFile>,
}
#[derive(Deserialize)]
struct RuntimeFile {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    executable: bool,
    downloads: Option<RuntimeDownloads>,
}
#[derive(Deserialize)]
struct RuntimeDownloads {
    raw: RawDownload,
}
#[derive(Deserialize)]
struct RawDownload {
    url: String,
    sha1: String,
    size: u64,
}

fn platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "aarch64") => "windows-arm64",
        ("windows", "x86") => "windows-x86",
        ("windows", _) => "windows-x64",
        ("macos", "aarch64") => "mac-os-arm64",
        ("macos", _) => "mac-os",
        ("linux", "x86") => "linux-i386",
        _ => "linux",
    }
}

/// Marca de runtime completo. O "-v2" força a reinstalação dos runtimes baixados
/// antes da correção dos arquivos temporários (ver `http::temp_path`).
const MARKER: &str = ".kairo-installed-v2";

/// Caminho do executável Java dentro de uma pasta de runtime.
/// No Windows usamos `java.exe` (e não `javaw.exe`): com CREATE_NO_WINDOW não aparece console,
/// e os erros da JVM vão para o stderr (aba Console) em vez de virar uma caixa de diálogo.
pub fn java_executable(dir: &std::path::Path) -> PathBuf {
    match std::env::consts::OS {
        "windows" => dir.join("bin").join("java.exe"),
        "macos" => dir.join("jre.bundle/Contents/Home/bin/java"),
        _ => dir.join("bin").join("java"),
    }
}

/// Garante que o runtime `component` (ex.: "java-runtime-epsilon") está instalado.
pub async fn ensure_runtime(paths: &Paths, component: &str, progress: &ProgressFn) -> Result<PathBuf> {
    let dir = paths.runtime().join(component);
    let marker = dir.join(MARKER);
    let exe = java_executable(&dir);
    if marker.exists() && exe.exists() {
        return Ok(exe);
    }
    // Runtime baixado por versões antigas do launcher (antes da correção do `.part`):
    // pode ter arquivos misturados (ex.: jvm.cfg corrompido). Apaga e baixa limpo.
    if dir.join(".kairo-installed").exists() && !marker.exists() {
        report(progress, "java", format!("Reparando o Java ({component})"), 0, 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    report(progress, "java", format!("Preparando Java ({component})"), 0, 1);
    let all: HashMap<String, HashMap<String, Vec<RuntimeEntry>>> = get_json(ALL_URL).await?;
    let entry = all
        .get(platform())
        .and_then(|p| p.get(component))
        .and_then(|v| v.first())
        .ok_or_else(|| Error::msg(format!("A Mojang não oferece o Java '{component}' para {}", platform())))?;

    let manifest: RuntimeManifest = get_json(&entry.manifest.url).await?;
    let mut jobs = Vec::new();
    let mut executables = Vec::new();
    for (rel, file) in &manifest.files {
        let path = dir.join(rel);
        match file.kind.as_str() {
            "directory" => std::fs::create_dir_all(&path)?,
            "file" => {
                if let Some(d) = &file.downloads {
                    jobs.push(Job {
                        url: d.raw.url.clone(),
                        path: path.clone(),
                        sha1: Some(d.raw.sha1.clone()),
                        size: Some(d.raw.size),
                    });
                    if file.executable {
                        executables.push(path);
                    }
                }
            }
            _ => {} // links simbólicos (macOS) não são necessários para rodar
        }
    }

    let cb = progress.clone();
    let name = entry.version.name.clone();
    http::download_all(jobs, 16, move |d, t| report(&cb, "java", format!("Baixando Java {name}"), d, t)).await?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for p in executables {
            if let Ok(meta) = std::fs::metadata(&p) {
                let mut perm = meta.permissions();
                perm.set_mode(0o755);
                std::fs::set_permissions(&p, perm)?;
            }
        }
    }
    #[cfg(not(unix))]
    drop(executables);

    std::fs::write(&marker, &entry.version.name)?;
    if !exe.exists() {
        return Err(Error::msg("Java baixado, mas o executável não foi encontrado"));
    }
    Ok(exe)
}
