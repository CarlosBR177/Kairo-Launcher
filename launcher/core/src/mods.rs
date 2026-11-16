//! Mods: busca e instalação pela API do Modrinth (gratuita, sem chave) e
//! gerenciamento da pasta mods da instância.

use crate::http::{self, client, Job};
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

const API: &str = "https://api.modrinth.com/v2";

/// Pacote de desempenho instalado junto com o Kairo (todos open source, no Modrinth).
pub const PERFORMANCE_PACK: &[&str] = &[
    "fabric-api",     // obrigatório para o mod do Kairo
    "sodium",         // novo motor de renderização
    "lithium",        // otimiza física, IA e ticks
    "ferrite-core",   // menos uso de RAM
    "immediatelyfast", // HUD, texto e entidades mais rápidos
    "entityculling",  // não desenha entidades escondidas
    "modernfix",      // inicialização mais rápida e menos RAM
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub project_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub icon_url: Option<String>,
    pub downloads: u64,
    pub author: String,
    #[serde(default)]
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub hits: Vec<SearchHit>,
    pub total_hits: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct Version {
    id: String,
    project_id: String,
    version_number: String,
    files: Vec<VersionFile>,
    #[serde(default)]
    dependencies: Vec<Dependency>,
}
#[derive(Debug, Clone, Deserialize)]
struct VersionFile {
    url: String,
    filename: String,
    primary: bool,
    size: Option<u64>,
    hashes: HashMap<String, String>,
}
#[derive(Debug, Clone, Deserialize)]
struct Dependency {
    project_id: Option<String>,
    dependency_type: String,
}

/// Registro de qual arquivo pertence a qual projeto (para atualizar/remover sem duplicar).
#[derive(Debug, Default, Serialize, Deserialize)]
struct ModIndex {
    projects: HashMap<String, String>, // project_id -> nome do arquivo
}

fn index_path(mods_dir: &Path) -> PathBuf {
    mods_dir.join(".kairo-index.json")
}
fn load_index(mods_dir: &Path) -> ModIndex {
    std::fs::read_to_string(index_path(mods_dir))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}
fn save_index(mods_dir: &Path, idx: &ModIndex) -> Result<()> {
    std::fs::write(index_path(mods_dir), serde_json::to_string_pretty(idx)?)?;
    Ok(())
}

pub async fn search(query: &str, game_version: &str, loader: &str, offset: u32, sort: &str) -> Result<SearchResult> {
    let facets = format!(
        r#"[["project_type:mod"],["categories:{loader}"],["versions:{game_version}"],["client_side:required","client_side:optional"]]"#
    );
    let url = format!(
        "{API}/search?query={}&facets={}&limit=20&offset={offset}&index={sort}",
        urlencoding::encode(query),
        urlencoding::encode(&facets)
    );
    http::get_json(&url).await
}

async fn compatible_version(project: &str, game_version: &str, loader: &str) -> Result<Option<Version>> {
    let url = format!(
        "{API}/project/{project}/version?loaders={}&game_versions={}",
        urlencoding::encode(&format!(r#"["{loader}"]"#)),
        urlencoding::encode(&format!(r#"["{game_version}"]"#)),
    );
    let resp = client().get(&url).send().await?;
    if resp.status().as_u16() == 404 {
        return Err(Error::msg(format!("Mod '{project}' não encontrado no Modrinth")));
    }
    let versions: Vec<Version> = resp.error_for_status()?.json().await?;
    Ok(versions.into_iter().next())
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallReport {
    pub installed: Vec<String>,
    pub skipped: Vec<String>,
}

/// Instala um projeto e suas dependências obrigatórias.
pub async fn install(project: &str, game_version: &str, loader: &str, mods_dir: &Path) -> Result<InstallReport> {
    std::fs::create_dir_all(mods_dir)?;
    let mut report = InstallReport { installed: vec![], skipped: vec![] };
    let mut queue = vec![project.to_string()];
    let mut seen = std::collections::HashSet::new();
    let mut index = load_index(mods_dir);

    while let Some(p) = queue.pop() {
        if !seen.insert(p.clone()) {
            continue;
        }
        let Some(version) = compatible_version(&p, game_version, loader).await? else {
            if p == project {
                return Err(Error::msg(format!("'{p}' ainda não tem versão para {loader} {game_version}")));
            }
            report.skipped.push(p);
            continue;
        };
        // já instalado nesta versão? (dependência compartilhada)
        let file = version.files.iter().find(|f| f.primary).or_else(|| version.files.first());
        let Some(file) = file else { continue };
        if index.projects.get(&version.project_id) == Some(&file.filename) && mods_dir.join(&file.filename).exists() {
            report.skipped.push(format!("{} (já instalado)", file.filename));
        } else {
            if let Some(old) = index.projects.get(&version.project_id) {
                let _ = std::fs::remove_file(mods_dir.join(old));
                let _ = std::fs::remove_file(mods_dir.join(format!("{old}.disabled")));
            }
            http::download(&Job {
                url: file.url.clone(),
                path: mods_dir.join(&file.filename),
                sha1: file.hashes.get("sha1").cloned(),
                size: file.size,
            })
            .await?;
            index.projects.insert(version.project_id.clone(), file.filename.clone());
            report.installed.push(format!("{} {}", file.filename, version.version_number));
        }
        let _ = &version.id;
        for dep in &version.dependencies {
            if dep.dependency_type == "required" {
                if let Some(id) = &dep.project_id {
                    queue.push(id.clone());
                }
            }
        }
    }
    save_index(mods_dir, &index)?;
    Ok(report)
}

/// Instala o pacote de desempenho; ignora mods que ainda não saíram para a versão.
pub async fn install_performance_pack(game_version: &str, mods_dir: &Path) -> InstallReport {
    let mut total = InstallReport { installed: vec![], skipped: vec![] };
    for slug in PERFORMANCE_PACK {
        match install(slug, game_version, "fabric", mods_dir).await {
            Ok(r) => {
                total.installed.extend(r.installed);
                total.skipped.extend(r.skipped);
            }
            Err(e) => total.skipped.push(format!("{slug}: {e}")),
        }
    }
    total
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalMod {
    pub file: String,
    pub enabled: bool,
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub authors: Vec<String>,
    /// Mods do próprio Kairo não podem ser removidos pela interface.
    pub builtin: bool,
}

fn read_fabric_meta(path: &Path) -> Option<serde_json::Value> {
    let file = std::fs::File::open(path).ok()?;
    let mut zip = zip::ZipArchive::new(file).ok()?;
    let mut entry = zip.by_name("fabric.mod.json").ok()?;
    let mut text = String::new();
    entry.read_to_string(&mut text).ok()?;
    // alguns mods têm quebras de linha cruas dentro de strings
    serde_json::from_str(&text.replace(['\n', '\r', '\t'], " ")).ok()
}

pub fn list(mods_dir: &Path) -> Result<Vec<LocalMod>> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(mods_dir) else { return Ok(out) };
    for e in entries.flatten() {
        let file = e.file_name().to_string_lossy().to_string();
        let enabled = file.ends_with(".jar");
        if !enabled && !file.ends_with(".jar.disabled") {
            continue;
        }
        let meta = read_fabric_meta(&e.path());
        let get = |k: &str| meta.as_ref().and_then(|m| m.get(k)).and_then(|v| v.as_str()).map(String::from);
        let authors = meta
            .as_ref()
            .and_then(|m| m.get("authors"))
            .and_then(|a| a.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_str().map(String::from).or_else(|| x.get("name")?.as_str().map(String::from)))
                    .collect()
            })
            .unwrap_or_default();
        let id = get("id").unwrap_or_else(|| file.clone());
        out.push(LocalMod {
            builtin: id == "kairo",
            name: get("name").unwrap_or_else(|| file.trim_end_matches(".disabled").to_string()),
            version: get("version").unwrap_or_default(),
            description: get("description").unwrap_or_default(),
            id,
            authors,
            file,
            enabled,
        });
    }
    out.sort_by(|a, b| b.builtin.cmp(&a.builtin).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}

fn safe_name(file: &str) -> Result<&str> {
    if file.contains(['/', '\\']) || file.contains("..") {
        return Err(Error::msg("Nome de arquivo inválido"));
    }
    Ok(file)
}

pub fn set_enabled(mods_dir: &Path, file: &str, enabled: bool) -> Result<String> {
    let file = safe_name(file)?;
    let base = file.trim_end_matches(".disabled");
    let (from, to) = if enabled {
        (format!("{base}.disabled"), base.to_string())
    } else {
        (base.to_string(), format!("{base}.disabled"))
    };
    if mods_dir.join(&from).exists() {
        std::fs::rename(mods_dir.join(&from), mods_dir.join(&to))?;
    }
    Ok(to)
}

pub fn remove(mods_dir: &Path, file: &str) -> Result<()> {
    let file = safe_name(file)?;
    std::fs::remove_file(mods_dir.join(file))?;
    let mut idx = load_index(mods_dir);
    let base = file.trim_end_matches(".disabled").to_string();
    idx.projects.retain(|_, f| *f != base);
    save_index(mods_dir, &idx)
}

/// Tira o mod do Kairo de instâncias em versões que ele não suporta.
pub fn remove_builtin(mods_dir: &Path) {
    if let Ok(entries) = std::fs::read_dir(mods_dir) {
        for e in entries.flatten() {
            let n = e.file_name().to_string_lossy().to_string();
            if n.starts_with("kairo-client") && n.ends_with(".jar") {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
}

/// Copia o .jar do mod do Kairo (empacotado no instalador) para a instância.
pub fn sync_builtin(mods_dir: &Path, bundled_jar: &Path) -> Result<()> {
    std::fs::create_dir_all(mods_dir)?;
    remove_builtin(mods_dir); // versões antigas do mod

    let name = bundled_jar.file_name().ok_or_else(|| Error::msg("jar inválido"))?;
    let disabled = mods_dir.join(format!("{}.disabled", name.to_string_lossy()));
    if !disabled.exists() {
        std::fs::copy(bundled_jar, mods_dir.join(name))?;
    }
    Ok(())
}
