//! Embute o instalador NSIS do launcher dentro do Kairo Setup.
//! Na compilação de release: KAIRO_NSIS_PATH=caminho\Kairo Launcher_x_x64-setup.exe
//! Sem a variável, o Setup compila mesmo assim (para testar as telas) e avisa que não tem o instalador.

use std::{env, fs, path::PathBuf};

fn main() {
    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("payload.bin");
    println!("cargo:rerun-if-env-changed=KAIRO_NSIS_PATH");
    match env::var("KAIRO_NSIS_PATH") {
        Ok(path) if !path.trim().is_empty() => {
            println!("cargo:rerun-if-changed={path}");
            fs::copy(&path, &out).unwrap_or_else(|e| panic!("não consegui ler KAIRO_NSIS_PATH={path}: {e}"));
        }
        _ => {
            println!("cargo:warning=KAIRO_NSIS_PATH não definido: o Kairo Setup vai compilar sem o instalador embutido");
            fs::write(&out, b"").expect("payload vazio");
        }
    }
    tauri_build::build()
}
