// Sem console no Windows (release)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kairo_setup_lib::run()
}
