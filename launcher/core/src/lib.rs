//! Núcleo do Kairo Launcher. Não depende do Tauri: dá para testar e reaproveitar
//! (por exemplo num launcher de linha de comando).

pub mod auth;
pub mod client_config;
pub mod error;
pub mod fabric;
pub mod http;
pub mod install;
pub mod java;
pub mod launch;
pub mod mods;
pub mod mojang;
pub mod paths;
pub mod progress;
pub mod server_ping;
pub mod store;

pub use error::{Error, Result};
