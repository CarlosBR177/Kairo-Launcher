//! Persistência simples em JSON: configurações, instâncias e contas.

use crate::auth::Account;
use crate::launch::GcMode;
use crate::paths::Paths;
use crate::Result;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

fn load<T: DeserializeOwned + Default>(paths: &Paths, name: &str) -> T {
    std::fs::read_to_string(paths.file(name))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn save<T: Serialize>(paths: &Paths, name: &str, value: &T) -> Result<()> {
    std::fs::create_dir_all(&paths.root)?;
    let tmp = paths.file(&format!("{name}.tmp"));
    std::fs::write(&tmp, serde_json::to_string_pretty(value)?)?;
    std::fs::rename(tmp, paths.file(name))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AfterLaunch {
    Minimize,
    Keep,
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub ram_mb: u32,
    pub gc: GcMode,
    pub jvm_args: String,
    pub after_launch: AfterLaunch,
    pub width: u32,
    pub height: u32,
    pub fullscreen: bool,
    pub java_path: Option<String>,
    pub accent: String,
    pub auto_performance_pack: bool,
    pub show_snapshots: bool,
    /// Mostra "Jogando Kairo" no perfil do Discord.
    pub discord_rpc: bool,
    /// Procura versões novas do launcher ao abrir.
    pub check_updates: bool,
    /// Servidores fixados na tela inicial (com ping ao vivo).
    pub favorite_servers: Vec<FavoriteServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteServer {
    pub name: String,
    pub address: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            ram_mb: 4096,
            gc: GcMode::G1,
            jvm_args: String::new(),
            after_launch: AfterLaunch::Minimize,
            width: 1280,
            height: 720,
            fullscreen: false,
            java_path: None,
            accent: "#8B5CFF".into(),
            auto_performance_pack: true,
            show_snapshots: false,
            discord_rpc: true,
            check_updates: true,
            favorite_servers: Vec::new(),
        }
    }
}

impl Settings {
    pub fn load(paths: &Paths) -> Self {
        load(paths, "settings.json")
    }
    pub fn save(&self, paths: &Paths) -> Result<()> {
        save(paths, "settings.json", self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub game_version: String,
    /// Versão do Fabric Loader; `None` = vanilla.
    pub loader: Option<String>,
    /// Chave de um dos visuais de capa da interface.
    #[serde(default)]
    pub cover: String,
    pub created_at: i64,
    #[serde(default)]
    pub last_played: Option<i64>,
    #[serde(default)]
    pub play_seconds: u64,
    /// Último servidor (Quick Play).
    #[serde(default)]
    pub last_server: Option<String>,
    #[serde(default)]
    pub ram_mb: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Instances {
    pub selected: Option<String>,
    pub list: Vec<Instance>,
}

impl Instances {
    pub fn load(paths: &Paths) -> Self {
        load(paths, "instances.json")
    }
    pub fn save(&self, paths: &Paths) -> Result<()> {
        save(paths, "instances.json", self)
    }
    pub fn get(&self, id: &str) -> Option<&Instance> {
        self.list.iter().find(|i| i.id == id)
    }
    pub fn get_mut(&mut self, id: &str) -> Option<&mut Instance> {
        self.list.iter_mut().find(|i| i.id == id)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Accounts {
    pub active: Option<String>,
    pub list: Vec<Account>,
}

impl Accounts {
    pub fn load(paths: &Paths) -> Self {
        load(paths, "accounts.json")
    }
    pub fn save(&self, paths: &Paths) -> Result<()> {
        save(paths, "accounts.json", self)
    }
    pub fn active(&self) -> Option<&Account> {
        let id = self.active.as_ref()?;
        self.list.iter().find(|a| &a.uuid == id)
    }
    pub fn upsert(&mut self, account: Account) {
        self.active = Some(account.uuid.clone());
        match self.list.iter_mut().find(|a| a.uuid == account.uuid) {
            Some(existing) => *existing = account,
            None => self.list.push(account),
        }
    }
}
