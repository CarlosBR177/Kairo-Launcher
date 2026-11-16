//! Lê/escreve config/kairo.json da instância — o mesmo arquivo que o mod usa.
//! Assim a aba "Client" do launcher liga/desliga módulos, muda opções, perfis e
//! regras por servidor antes de abrir o jogo. Chaves desconhecidas são preservadas.

use crate::{Error, Result};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

fn file(instance_dir: &Path) -> PathBuf {
    instance_dir.join("config").join("kairo.json")
}

pub fn read(instance_dir: &Path) -> Value {
    let mut cfg = std::fs::read_to_string(file(instance_dir))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({ "accent": "#8B5CFF" }));
    for key in ["modules", "profiles"] {
        if !cfg[key].is_object() {
            cfg[key] = json!({});
        }
    }
    if !cfg["serverRules"].is_array() {
        cfg["serverRules"] = json!([]);
    }
    cfg
}

fn module_obj<'a>(cfg: &'a mut Value, id: &str) -> &'a mut Map<String, Value> {
    if !cfg["modules"][id].is_object() {
        cfg["modules"][id] = json!({});
    }
    cfg["modules"][id].as_object_mut().expect("objeto")
}

fn valid_id(id: &str) -> Result<()> {
    let ok = !id.is_empty() && id.len() <= 40 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if ok { Ok(()) } else { Err(Error::msg("Nome de módulo/opção inválido")) }
}

/// Liga/desliga um módulo preservando a posição salva pelo editor de HUD.
pub fn set_module(instance_dir: &Path, id: &str, enabled: bool) -> Result<Value> {
    valid_id(id)?;
    let mut cfg = read(instance_dir);
    module_obj(&mut cfg, id).insert("enabled".into(), json!(enabled));
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

/// Uma opção do módulo (ex.: crosshair.style = "dot"). Só aceita valores simples.
pub fn set_option(instance_dir: &Path, id: &str, key: &str, value: Value) -> Result<Value> {
    valid_id(id)?;
    valid_id(key)?;
    if matches!(key, "enabled" | "x" | "y" | "rx" | "ry" | "scale") || !(value.is_boolean() || value.is_number() || value.is_string()) {
        return Err(Error::msg("Opção inválida"));
    }
    if let Some(s) = value.as_str() {
        if s.len() > 32 {
            return Err(Error::msg("Valor muito longo"));
        }
    }
    let mut cfg = read(instance_dir);
    module_obj(&mut cfg, id).insert(key.into(), value);
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

/// Posição (relativa à tela, 0–1) e tamanho de um elemento da HUD — o mesmo que o editor do jogo grava.
pub fn set_hud(instance_dir: &Path, id: &str, rx: f64, ry: f64, scale: f64) -> Result<Value> {
    valid_id(id)?;
    if !(rx.is_finite() && ry.is_finite() && scale.is_finite()) {
        return Err(Error::msg("Valores inválidos"));
    }
    let round = |v: f64, d: f64| (v * d).round() / d;
    let mut cfg = read(instance_dir);
    let m = module_obj(&mut cfg, id);
    m.remove("x");
    m.remove("y");
    m.insert("rx".into(), json!(round(rx.clamp(0.0, 1.0), 10000.0)));
    m.insert("ry".into(), json!(round(ry.clamp(0.0, 1.0), 10000.0)));
    m.insert("scale".into(), json!(round(scale.clamp(0.5, 3.0), 20.0)));
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

/// Volta a HUD inteira (ou um elemento) para posição e tamanho padrão.
pub fn reset_hud(instance_dir: &Path, id: Option<&str>) -> Result<Value> {
    let mut cfg = read(instance_dir);
    if let Some(mods) = cfg["modules"].as_object_mut() {
        for (mid, m) in mods.iter_mut() {
            if id.is_some_and(|only| only != mid) {
                continue;
            }
            if let Some(o) = m.as_object_mut() {
                for k in ["x", "y", "rx", "ry", "scale"] {
                    o.remove(k);
                }
            }
        }
    }
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

pub fn set_accent(instance_dir: &Path, hex: &str) -> Result<Value> {
    let mut cfg = read(instance_dir);
    cfg["accent"] = json!(hex);
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

// ---------- perfis ----------

fn valid_profile(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 20 {
        return Err(Error::msg("Use um nome de perfil com 1 a 20 caracteres"));
    }
    Ok(name.to_string())
}

/// Salva quais módulos estão ligados com um nome (ex.: "PvP", "Gravação").
pub fn save_profile(instance_dir: &Path, name: &str, states: &BTreeMap<String, bool>) -> Result<Value> {
    let name = valid_profile(name)?;
    let mut cfg = read(instance_dir);
    let mut map = Map::new();
    for (id, on) in states {
        valid_id(id)?;
        map.insert(id.clone(), json!(on));
    }
    cfg["profiles"][&name] = Value::Object(map);
    cfg["activeProfile"] = json!(name);
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

/// Aplica um perfil: liga/desliga os módulos dele. Posições e opções continuam.
pub fn apply_profile(instance_dir: &Path, name: &str) -> Result<Value> {
    let mut cfg = read(instance_dir);
    let profile = cfg["profiles"][name].as_object().cloned().ok_or_else(|| Error::msg("Perfil não encontrado"))?;
    for (id, on) in profile {
        if let Some(on) = on.as_bool() {
            module_obj(&mut cfg, &id).insert("enabled".into(), json!(on));
        }
    }
    cfg["activeProfile"] = json!(name);
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

pub fn delete_profile(instance_dir: &Path, name: &str) -> Result<Value> {
    let mut cfg = read(instance_dir);
    if let Some(p) = cfg["profiles"].as_object_mut() {
        p.remove(name);
    }
    if cfg["activeProfile"].as_str() == Some(name) {
        cfg.as_object_mut().expect("objeto").remove("activeProfile");
    }
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

// ---------- regras por servidor ----------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct ServerRule {
    pub server: String,
    pub modules: Vec<String>,
}

/// Normaliza "Mc.Exemplo.com:25565 " → "mc.exemplo.com".
pub fn normalize_server(s: &str) -> String {
    let s = s.trim().to_lowercase();
    let s = s.trim_start_matches("http://").trim_start_matches("https://");
    let host = match s.rsplit_once(':') {
        Some((h, port)) if !h.contains(':') && port.chars().all(|c| c.is_ascii_digit()) => h,
        _ => s,
    };
    host.trim_matches('.').to_string()
}

/// Módulos que o mod deve desligar ao entrar nesses servidores.
pub fn set_server_rules(instance_dir: &Path, rules: Vec<ServerRule>) -> Result<Value> {
    let mut clean = Vec::new();
    for r in rules {
        let server = normalize_server(&r.server);
        if server.is_empty() {
            continue;
        }
        let mut modules = Vec::new();
        for m in r.modules {
            valid_id(&m)?;
            if !modules.contains(&m) {
                modules.push(m);
            }
        }
        clean.push(json!({ "server": server, "modules": modules }));
    }
    let mut cfg = read(instance_dir);
    cfg["serverRules"] = Value::Array(clean);
    write(instance_dir, &cfg)?;
    Ok(cfg)
}

fn write(instance_dir: &Path, cfg: &Value) -> Result<()> {
    let path = file(instance_dir);
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(cfg)?)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("kairo-cfg-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn preserva_chaves_e_posicoes() {
        let d = tmp();
        std::fs::create_dir_all(d.join("config")).unwrap();
        std::fs::write(d.join("config/kairo.json"), r##"{"accent":"#FFFFFF","modules":{"fps":{"enabled":true,"x":10,"y":20}},"outra":1}"##).unwrap();
        let cfg = set_module(&d, "fps", false).unwrap();
        assert_eq!(cfg["modules"]["fps"]["x"], 10);
        assert_eq!(cfg["outra"], 1);
        let cfg = set_option(&d, "crosshair", "style", json!("dot")).unwrap();
        assert_eq!(cfg["modules"]["crosshair"]["style"], "dot");
        assert!(set_option(&d, "fps", "x", json!(1)).is_err());
    }

    #[test]
    fn layout_da_hud() {
        let d = tmp();
        set_module(&d, "fps", true).unwrap();
        let cfg = set_hud(&d, "fps", 0.5, 1.7, 9.0).unwrap();
        assert_eq!(cfg["modules"]["fps"]["rx"], 0.5);
        assert_eq!(cfg["modules"]["fps"]["ry"], 1.0);
        assert_eq!(cfg["modules"]["fps"]["scale"], 3.0);
        assert_eq!(cfg["modules"]["fps"]["enabled"], true);
        assert!(set_option(&d, "fps", "scale", json!(2)).is_err());
        set_hud(&d, "cps", 0.1, 0.1, 1.5).unwrap();
        let cfg = reset_hud(&d, Some("fps")).unwrap();
        assert!(cfg["modules"]["fps"].get("rx").is_none());
        assert_eq!(cfg["modules"]["cps"]["scale"], 1.5);
        let cfg = reset_hud(&d, None).unwrap();
        assert!(cfg["modules"]["cps"].get("scale").is_none());
    }

    #[test]
    fn perfis() {
        let d = tmp();
        let mut states = BTreeMap::new();
        states.insert("fps".to_string(), false);
        states.insert("zoom".to_string(), true);
        save_profile(&d, "Gravação", &states).unwrap();
        set_module(&d, "fps", true).unwrap();
        let cfg = apply_profile(&d, "Gravação").unwrap();
        assert_eq!(cfg["modules"]["fps"]["enabled"], false);
        assert_eq!(cfg["activeProfile"], "Gravação");
        let cfg = delete_profile(&d, "Gravação").unwrap();
        assert!(cfg.get("activeProfile").is_none());
    }

    #[test]
    fn regras_de_servidor() {
        assert_eq!(normalize_server(" Mc.Exemplo.com:25565 "), "mc.exemplo.com");
        let d = tmp();
        let cfg = set_server_rules(&d, vec![
            ServerRule { server: "Exemplo.com".into(), modules: vec!["freelook".into(), "freelook".into()] },
            ServerRule { server: "  ".into(), modules: vec![] },
        ]).unwrap();
        assert_eq!(cfg["serverRules"].as_array().unwrap().len(), 1);
        assert_eq!(cfg["serverRules"][0]["modules"].as_array().unwrap().len(), 1);
    }
}

/// Tela de carregamento do Kairo: liga uma única vez a opção "Fundo monocromático"
/// (`darkMojangStudiosBackground`) no options.txt, para o logo do Kairo aparecer no fundo
/// escuro em vez do vermelho da Mojang. Se o jogador desligar depois, respeitamos.
pub fn ensure_dark_loading(game_dir: &std::path::Path) -> std::io::Result<()> {
    let marker = game_dir.join(".kairo-dark-loading");
    if marker.exists() {
        return Ok(());
    }
    let path = game_dir.join("options.txt");
    let text = std::fs::read_to_string(&path).unwrap_or_default();
    let mut found = false;
    let mut lines: Vec<String> = text
        .lines()
        .map(|l| {
            if l.starts_with("darkMojangStudiosBackground:") {
                found = true;
                "darkMojangStudiosBackground:true".to_string()
            } else {
                l.to_string()
            }
        })
        .collect();
    if !found {
        lines.push("darkMojangStudiosBackground:true".to_string());
    }
    std::fs::create_dir_all(game_dir)?;
    std::fs::write(&path, lines.join("\n") + "\n")?;
    std::fs::write(&marker, "1")
}

#[cfg(test)]
mod dark_loading_tests {
    use super::ensure_dark_loading;

    #[test]
    fn liga_uma_vez_e_preserva_o_resto() {
        let d = std::env::temp_dir().join(format!("kairo-dark-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("options.txt"), "version:3955\ndarkMojangStudiosBackground:false\nfov:0.5\n").unwrap();
        ensure_dark_loading(&d).unwrap();
        let t = std::fs::read_to_string(d.join("options.txt")).unwrap();
        assert!(t.contains("darkMojangStudiosBackground:true") && t.contains("fov:0.5") && t.contains("version:3955"));
        // o jogador desligou depois: não liga de novo
        std::fs::write(d.join("options.txt"), "darkMojangStudiosBackground:false\n").unwrap();
        ensure_dark_loading(&d).unwrap();
        assert!(std::fs::read_to_string(d.join("options.txt")).unwrap().contains(":false"));
        std::fs::remove_dir_all(&d).unwrap();

        // instância nova, sem options.txt
        let n = std::env::temp_dir().join(format!("kairo-dark-new-{}", std::process::id()));
        ensure_dark_loading(&n).unwrap();
        assert_eq!(std::fs::read_to_string(n.join("options.txt")).unwrap(), "darkMojangStudiosBackground:true\n");
        std::fs::remove_dir_all(&n).unwrap();
    }
}
