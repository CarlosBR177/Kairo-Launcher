//! Fabric Loader via meta.fabricmc.net (API pública e gratuita).

use crate::http::get_json;
use crate::mojang::{library_key, Arguments, VersionJson};
use crate::Result;
use serde::Deserialize;
use std::collections::HashSet;

const META: &str = "https://meta.fabricmc.net/v2";

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct GameVersion {
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
}

pub async fn game_versions() -> Result<Vec<GameVersion>> {
    get_json(&format!("{META}/versions/game")).await
}

/// Versão estável mais recente do Fabric Loader.
pub async fn latest_loader() -> Result<String> {
    let loaders: Vec<LoaderVersion> = get_json(&format!("{META}/versions/loader")).await?;
    loaders
        .iter()
        .find(|l| l.stable)
        .or_else(|| loaders.first())
        .map(|l| l.version.clone())
        .ok_or_else(|| crate::Error::msg("Nenhuma versão do Fabric Loader encontrada"))
}

pub async fn profile(game: &str, loader: &str) -> Result<VersionJson> {
    get_json(&format!("{META}/versions/loader/{game}/{loader}/profile/json")).await
}

/// Junta o perfil do Fabric (filho) com a versão vanilla (pai).
pub fn merge(parent: VersionJson, child: VersionJson) -> VersionJson {
    let mut seen = HashSet::new();
    let mut libraries = Vec::new();
    for lib in child.libraries.into_iter().chain(parent.libraries) {
        if seen.insert(library_key(&lib.name)) {
            libraries.push(lib);
        }
    }
    let arguments = match (parent.arguments, child.arguments) {
        (Some(mut p), Some(c)) => {
            p.game.extend(c.game);
            p.jvm.extend(c.jvm);
            Some(p)
        }
        (p, c) => p.or(c).or_else(|| Some(Arguments::default())),
    };
    VersionJson {
        id: child.id,
        inherits_from: None,
        main_class: if child.main_class.is_empty() { parent.main_class } else { child.main_class },
        arguments,
        minecraft_arguments: child.minecraft_arguments.or(parent.minecraft_arguments),
        asset_index: parent.asset_index,
        assets: parent.assets,
        downloads: parent.downloads,
        libraries,
        java_version: child.java_version.or(parent.java_version),
        logging: parent.logging,
        kind: parent.kind,
    }
}
