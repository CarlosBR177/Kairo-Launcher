use std::path::PathBuf;

/// Estrutura de pastas do launcher.
///
/// ```text
/// KairoLauncher/
///   versions/<id>/<id>.json|.jar   libraries/   assets/   runtime/<java>/
///   instances/<id>/ (mods, config, saves...)   settings.json  accounts.json  instances.json
/// ```
#[derive(Debug, Clone)]
pub struct Paths {
    pub root: PathBuf,
}

impl Paths {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// `%APPDATA%\KairoLauncher` no Windows, `~/.local/share/KairoLauncher` no Linux.
    pub fn default_root() -> PathBuf {
        dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("KairoLauncher")
    }

    pub fn versions(&self) -> PathBuf {
        self.root.join("versions")
    }
    pub fn version_dir(&self, id: &str) -> PathBuf {
        self.versions().join(id)
    }
    pub fn libraries(&self) -> PathBuf {
        self.root.join("libraries")
    }
    pub fn assets(&self) -> PathBuf {
        self.root.join("assets")
    }
    pub fn runtime(&self) -> PathBuf {
        self.root.join("runtime")
    }
    pub fn natives(&self, version_id: &str) -> PathBuf {
        self.version_dir(version_id).join("natives")
    }
    pub fn instances(&self) -> PathBuf {
        self.root.join("instances")
    }
    pub fn instance(&self, id: &str) -> PathBuf {
        self.instances().join(id)
    }
    pub fn mods(&self, instance_id: &str) -> PathBuf {
        self.instance(instance_id).join("mods")
    }
    pub fn file(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }
}
