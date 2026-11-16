//! Kairo Setup: as telas são do Kairo (React), e o trabalho de verdade é do instalador NSIS
//! do launcher, embutido aqui e executado em modo silencioso. Assim o desinstalador, os atalhos,
//! o registro em "Aplicativos" do Windows e o auto-update continuam funcionando como antes.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

/// Instalador NSIS do launcher (ver build.rs).
static PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/payload.bin"));

/// Nome do app no menu Iniciar/Área de Trabalho (productName do launcher).
const PRODUCT: &str = "Kairo Launcher";
/// Executável principal instalado pelo NSIS (nome do pacote Rust do launcher).
const MAIN_EXE: &str = "kairo-launcher.exe";

#[derive(Serialize)]
struct SetupInfo {
    version: String,
    default_dir: String,
    installed: bool,
    payload_ok: bool,
}

fn default_dir() -> PathBuf {
    // mesmo padrão do NSIS do Tauri em modo "currentUser": %LOCALAPPDATA%\<productName>
    dirs::data_local_dir().unwrap_or_else(std::env::temp_dir).join(PRODUCT)
}

#[tauri::command]
fn info(app: AppHandle) -> SetupInfo {
    let dir = default_dir();
    SetupInfo {
        version: app.package_info().version.to_string(),
        installed: find_exe(&dir).is_some(),
        default_dir: dir.to_string_lossy().to_string(),
        payload_ok: !PAYLOAD.is_empty(),
    }
}

/// Grava o instalador NSIS numa pasta temporária e roda em silêncio: `setup.exe /S /D=<pasta>`.
#[tauri::command]
async fn install(dir: String, desktop_shortcut: bool) -> Result<(), String> {
    if PAYLOAD.is_empty() {
        return Err("Este Kairo Setup foi compilado sem o instalador embutido (KAIRO_NSIS_PATH).".into());
    }
    let dir = dir.trim().trim_end_matches(['\\', '/']).to_string();
    if dir.is_empty() {
        return Err("Escolha uma pasta de instalação.".into());
    }
    tauri::async_runtime::spawn_blocking(move || run_nsis(&dir, desktop_shortcut))
        .await
        .map_err(|e| e.to_string())?
}

fn run_nsis(dir: &str, desktop_shortcut: bool) -> Result<(), String> {
    let tmp = std::env::temp_dir().join(format!("kairo-setup-{}.exe", std::process::id()));
    std::fs::write(&tmp, PAYLOAD).map_err(|e| format!("Não consegui preparar a instalação: {e}"))?;

    let mut cmd = Command::new(&tmp);
    cmd.arg("/S");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
        // O NSIS exige /D= por último e SEM aspas, mesmo com espaços no caminho.
        cmd.raw_arg(format!("/D={dir}"));
    }
    #[cfg(not(windows))]
    cmd.arg(format!("/D={dir}"));

    let status = cmd.status().map_err(|e| format!("Não consegui iniciar o instalador: {e}"));
    let _ = std::fs::remove_file(&tmp);
    let status = status?;
    if !status.success() {
        return Err(match status.code() {
            Some(2) => "A instalação foi cancelada ou o Kairo Launcher está aberto. Feche o launcher e tente de novo.".into(),
            Some(c) => format!("O instalador terminou com código {c}. Feche o Kairo Launcher se ele estiver aberto e tente de novo."),
            None => "O instalador foi interrompido.".into(),
        });
    }
    if !Path::new(dir).join(MAIN_EXE).exists() && find_exe(Path::new(dir)).is_none() {
        return Err(format!("A instalação terminou, mas o Kairo não apareceu em {dir}."));
    }
    // em modo silencioso o NSIS cria os atalhos; se o jogador não quis o da Área de Trabalho, tiramos
    if !desktop_shortcut {
        if let Some(desktop) = dirs::desktop_dir() {
            let _ = std::fs::remove_file(desktop.join(format!("{PRODUCT}.lnk")));
        }
    }
    Ok(())
}

fn find_exe(dir: &Path) -> Option<PathBuf> {
    let main = dir.join(MAIN_EXE);
    if main.exists() {
        return Some(main);
    }
    std::fs::read_dir(dir).ok()?.flatten().map(|e| e.path()).find(|p| {
        let n = p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
        n.ends_with(".exe") && !n.starts_with("uninstall")
    })
}

#[tauri::command]
fn launch(app: AppHandle, dir: String) -> Result<(), String> {
    let exe = find_exe(Path::new(dir.trim())).ok_or("Não encontrei o Kairo Launcher instalado.")?;
    let mut cmd = Command::new(&exe);
    if let Some(parent) = exe.parent() {
        cmd.current_dir(parent);
    }
    cmd.spawn().map_err(|e| format!("Não consegui abrir o Kairo: {e}"))?;
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![info, install, launch])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Kairo Setup");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pasta_padrao_termina_no_produto() {
        assert!(default_dir().ends_with(PRODUCT));
    }

    #[test]
    fn acha_exe_alternativo() {
        let d = std::env::temp_dir().join(format!("kairo-setup-test-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("uninstall.exe"), b"").unwrap();
        assert!(find_exe(&d).is_none());
        std::fs::write(d.join("Kairo Launcher.exe"), b"").unwrap();
        assert!(find_exe(&d).unwrap().ends_with("Kairo Launcher.exe"));
        std::fs::remove_dir_all(&d).unwrap();
    }
}
