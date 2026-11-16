//! Instala uma versão (vanilla ou Fabric): client.jar, bibliotecas, nativas, assets, log4j e Java.

use crate::fabric;
use crate::http::{self, get_json, Job};
use crate::java;
use crate::mojang::*;
use crate::paths::Paths;
use crate::progress::{report, ProgressFn};
use crate::{Error, Result};
use std::path::{Path, PathBuf};

/// Tudo que o `launch` precisa depois da instalação.
#[derive(Debug, Clone)]
pub struct Installed {
    pub version: VersionJson,
    pub vanilla_id: String,
    pub java: PathBuf,
    pub java_major: u32,
    pub classpath: Vec<PathBuf>,
    pub natives_dir: PathBuf,
    pub assets_index: String,
    pub logging_arg: Option<String>,
}

pub async fn manifest() -> Result<VersionManifest> {
    get_json(MANIFEST_URL).await
}

async fn vanilla_json(paths: &Paths, id: &str) -> Result<VersionJson> {
    let file = paths.version_dir(id).join(format!("{id}.json"));
    if let Ok(text) = std::fs::read_to_string(&file) {
        if let Ok(v) = serde_json::from_str::<VersionJson>(&text) {
            return Ok(v);
        }
    }
    let manifest = manifest().await?;
    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == id)
        .ok_or_else(|| Error::msg(format!("Versão {id} não existe no manifesto da Mojang")))?;
    let text = http::client().get(&entry.url).send().await?.error_for_status()?.text().await?;
    std::fs::create_dir_all(paths.version_dir(id))?;
    std::fs::write(&file, &text)?;
    Ok(serde_json::from_str(&text)?)
}

fn library_job(paths: &Paths, lib: &Library) -> Option<Job> {
    if let Some(artifact) = lib.downloads.as_ref().and_then(|d| d.artifact.as_ref()) {
        let rel = artifact.path.clone().or_else(|| maven_path(&lib.name))?;
        return Some(Job {
            url: artifact.url.clone(),
            path: paths.libraries().join(rel),
            sha1: artifact.sha1.clone(),
            size: artifact.size,
        });
    }
    // Formato Fabric: "name" + "url" base do Maven
    if lib.downloads.is_none() {
        let rel = maven_path(&lib.name)?;
        let base = lib.url.clone().unwrap_or_else(|| LIBRARIES_URL.to_string());
        let base = if base.ends_with('/') { base } else { format!("{base}/") };
        return Some(Job {
            url: format!("{base}{rel}"),
            path: paths.libraries().join(rel),
            sha1: lib.sha1.clone(),
            size: lib.size,
        });
    }
    None
}

/// Nativas no formato antigo (pré-1.19), extraídas para uma pasta.
fn legacy_native(paths: &Paths, lib: &Library) -> Option<Job> {
    let classifier = lib.natives.as_ref()?.get(os_name())?;
    let classifier = classifier.replace("${arch}", if cfg!(target_pointer_width = "64") { "64" } else { "32" });
    let artifact = lib.downloads.as_ref()?.classifiers.as_ref()?.get(&classifier)?;
    let rel = artifact.path.clone().or_else(|| maven_path(&format!("{}:{classifier}", lib.name)))?;
    Some(Job {
        url: artifact.url.clone(),
        path: paths.libraries().join(rel),
        sha1: artifact.sha1.clone(),
        size: artifact.size,
    })
}

fn extract_natives(jar: &Path, dest: &Path) -> Result<()> {
    let file = std::fs::File::open(jar)?;
    let mut zip = zip::ZipArchive::new(file)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name()?.to_string();
        if entry.is_dir() || name.starts_with("META-INF") {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let out = dest.join(rel);
        if let Some(p) = out.parent() {
            std::fs::create_dir_all(p)?;
        }
        let mut f = std::fs::File::create(&out)?;
        std::io::copy(&mut entry, &mut f)?;
    }
    Ok(())
}

/// Instala tudo. `fabric_loader = Some("0.20.1")` para Fabric, `None` para vanilla.
pub async fn install(
    paths: &Paths,
    game_version: &str,
    fabric_loader: Option<&str>,
    progress: &ProgressFn,
) -> Result<Installed> {
    report(progress, "meta", format!("Lendo informações da versão {game_version}"), 0, 1);
    let vanilla = vanilla_json(paths, game_version).await?;
    let version = match fabric_loader {
        Some(loader) => {
            report(progress, "meta", format!("Preparando Fabric {loader}"), 0, 1);
            let profile = fabric::profile(game_version, loader).await?;
            let merged = fabric::merge(vanilla.clone(), profile);
            let dir = paths.version_dir(&merged.id);
            std::fs::create_dir_all(&dir)?;
            std::fs::write(dir.join(format!("{}.json", merged.id)), serde_json::to_string_pretty(&merged)?)?;
            merged
        }
        None => vanilla.clone(),
    };

    let features = Features::default();
    let mut jobs = Vec::new();
    let mut classpath = Vec::new();
    let mut natives = Vec::new();

    for lib in &version.libraries {
        if !rules_allow(lib.rules.as_ref(), &features) {
            continue;
        }
        if let Some(job) = library_job(paths, lib) {
            classpath.push(job.path.clone());
            jobs.push(job);
        }
        if let Some(job) = legacy_native(paths, lib) {
            natives.push(job.path.clone());
            jobs.push(job);
        }
    }

    let client = vanilla
        .downloads
        .as_ref()
        .and_then(|d| d.client.clone())
        .ok_or_else(|| Error::msg("Versão sem client.jar"))?;
    let client_path = paths.version_dir(&vanilla.id).join(format!("{}.jar", vanilla.id));
    jobs.push(Job { url: client.url, path: client_path.clone(), sha1: client.sha1, size: client.size });
    classpath.push(client_path);

    let mut logging_arg = None;
    if let Some(log) = vanilla.logging.as_ref().and_then(|l| l.client.clone()) {
        let path = paths.assets().join("log_configs").join(&log.file.id);
        logging_arg = Some(log.argument.replace("${path}", &path.to_string_lossy()));
        jobs.push(Job { url: log.file.url, path, sha1: log.file.sha1, size: log.file.size });
    }

    let cb = progress.clone();
    http::download_all(jobs, 24, move |d, t| report(&cb, "libraries", "Baixando bibliotecas", d, t)).await?;

    let natives_dir = paths.natives(&version.id);
    if !natives.is_empty() {
        std::fs::create_dir_all(&natives_dir)?;
        for jar in &natives {
            extract_natives(jar, &natives_dir)?;
        }
    }

    // Assets (sons, texturas, idiomas)
    let index_ref = vanilla.asset_index.clone().ok_or_else(|| Error::msg("Versão sem assetIndex"))?;
    let index_path = paths.assets().join("indexes").join(format!("{}.json", index_ref.id));
    http::download(&Job { url: index_ref.url.clone(), path: index_path.clone(), sha1: index_ref.sha1.clone(), size: index_ref.size }).await?;
    let index: AssetIndex = serde_json::from_str(&std::fs::read_to_string(&index_path)?)?;
    let objects = paths.assets().join("objects");
    let mut asset_jobs: Vec<Job> = index
        .objects
        .values()
        .map(|o| {
            let prefix = &o.hash[..2];
            Job {
                url: format!("{RESOURCES_URL}/{prefix}/{}", o.hash),
                path: objects.join(prefix).join(&o.hash),
                sha1: Some(o.hash.clone()),
                size: Some(o.size),
            }
        })
        .collect();
    asset_jobs.sort_by(|a, b| a.path.cmp(&b.path));
    asset_jobs.dedup_by(|a, b| a.path == b.path);
    let cb = progress.clone();
    http::download_all(asset_jobs, 48, move |d, t| report(&cb, "assets", "Baixando recursos do jogo", d, t)).await?;

    // Java
    let jv = version.java_version.clone().unwrap_or(JavaVersion { component: "jre-legacy".into(), major_version: 8 });
    let java = java::ensure_runtime(paths, &jv.component, progress).await?;

    report(progress, "done", "Pronto", 1, 1);
    Ok(Installed {
        vanilla_id: vanilla.id.clone(),
        version,
        java,
        java_major: jv.major_version,
        classpath,
        natives_dir,
        assets_index: index_ref.id,
        logging_arg,
    })
}
