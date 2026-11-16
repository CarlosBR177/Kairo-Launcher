//! Ponte entre a interface (React) e o kairo-core.

mod discord;

use kairo_core::auth::{self, Account, AccountKind, DeviceCode};
use kairo_core::launch::{self, LaunchOptions};
use kairo_core::paths::Paths;
use kairo_core::progress::{Progress, ProgressFn};
use kairo_core::store::{AfterLaunch, Accounts, Instance, Instances, Settings};
use kairo_core::client_config::ServerRule;
use kairo_core::server_ping::{self, ServerStatus};
use kairo_core::{client_config, fabric, install, mods, Error};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::oneshot;

/// Client ID do Azure (app pública). Defina na compilação:
/// `KAIRO_MS_CLIENT_ID=xxxxxxxx-... npm run tauri build`
const MS_CLIENT_ID: Option<&str> = option_env!("KAIRO_MS_CLIENT_ID");

/// Qual jar do Kairo Client serve para cada versão do jogo
/// (mesmas faixas de mod/versions/<versão>/gradle.properties → mc_range).
fn kairo_jar_for(game_version: &str) -> Option<&'static str> {
    match game_version {
        "1.21" | "1.21.1" => Some("1.21.1"),
        "1.21.4" => Some("1.21.4"),
        "1.21.6" | "1.21.7" | "1.21.8" => Some("1.21.8"),
        "1.21.11" => Some("1.21.11"),
        v if v == "26.3" || v.starts_with("26.3.") => Some("26.3"),
        _ => None,
    }
}

type CmdResult<T> = Result<T, Error>;

struct AppState {
    paths: Paths,
    settings: Mutex<Settings>,
    instances: Mutex<Instances>,
    accounts: Mutex<Accounts>,
    /// Instâncias instalando ou rodando → canal para encerrar o jogo.
    running: Mutex<HashMap<String, Option<oneshot::Sender<()>>>>,
}

fn ms_client_id() -> Option<&'static str> {
    MS_CLIENT_ID.filter(|s| !s.trim().is_empty())
}

// ---------- visões para a interface (sem tokens) ----------

#[derive(Serialize, Clone)]
struct AccountView {
    uuid: String,
    name: String,
    kind: AccountKind,
}

impl From<&Account> for AccountView {
    fn from(a: &Account) -> Self {
        Self { uuid: a.uuid.clone(), name: a.name.clone(), kind: a.kind.clone() }
    }
}

fn account_views(acc: &Accounts) -> Vec<AccountView> {
    acc.list.iter().map(AccountView::from).collect()
}

#[derive(Serialize)]
struct Bootstrap {
    settings: Settings,
    instances: Vec<Instance>,
    selected: Option<String>,
    accounts: Vec<AccountView>,
    active_account: Option<String>,
    ms_login_available: bool,
    version: String,
    data_dir: String,
    total_memory_mb: u64,
    discord_available: bool,
}

#[derive(Serialize, Clone)]
struct GameState {
    instance_id: String,
    state: &'static str,
    message: String,
}

#[derive(Serialize, Clone)]
struct GameLog {
    instance_id: String,
    line: String,
}

#[derive(Serialize)]
struct VersionInfo {
    id: String,
    kind: String,
    release_time: String,
    fabric: bool,
}

// ---------- geral ----------

#[tauri::command]
fn bootstrap(app: AppHandle, state: State<'_, AppState>) -> Bootstrap {
    let instances = state.instances.lock().unwrap().clone();
    let accounts = state.accounts.lock().unwrap();
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    Bootstrap {
        settings: state.settings.lock().unwrap().clone(),
        selected: instances.selected.clone(),
        instances: instances.list,
        accounts: account_views(&accounts),
        active_account: accounts.active.clone(),
        ms_login_available: ms_client_id().is_some(),
        version: app.package_info().version.to_string(),
        data_dir: state.paths.root.to_string_lossy().to_string(),
        total_memory_mb: sys.total_memory() / 1024 / 1024,
        discord_available: discord::available(),
    }
}

#[tauri::command]
async fn list_versions(snapshots: bool) -> CmdResult<Vec<VersionInfo>> {
    let (manifest, fabric_versions) = tokio::join!(install::manifest(), fabric::game_versions());
    let manifest = manifest?;
    let fabric_ids: std::collections::HashSet<String> =
        fabric_versions.unwrap_or_default().into_iter().map(|v| v.version).collect();
    Ok(manifest
        .versions
        .into_iter()
        .filter(|v| v.kind == "release" || (snapshots && v.kind == "snapshot"))
        .map(|v| VersionInfo {
            fabric: fabric_ids.contains(&v.id),
            id: v.id,
            kind: v.kind,
            release_time: v.release_time,
        })
        .collect())
}

#[tauri::command]
fn save_settings(state: State<'_, AppState>, settings: Settings) -> CmdResult<()> {
    settings.save(&state.paths)?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

#[tauri::command]
fn open_folder(app: AppHandle, state: State<'_, AppState>, instance_id: Option<String>) -> CmdResult<()> {
    let path = match instance_id {
        Some(id) => state.paths.instance(&id),
        None => state.paths.root.clone(),
    };
    std::fs::create_dir_all(&path)?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| Error::msg(e.to_string()))
}

// ---------- instâncias ----------

fn slug(name: &str) -> String {
    let s: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let s = s.split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-");
    let short = &uuid::Uuid::new_v4().simple().to_string()[..6];
    if s.is_empty() { format!("instancia-{short}") } else { format!("{}-{short}", &s[..s.len().min(24)]) }
}

#[tauri::command]
async fn create_instance(
    state: State<'_, AppState>,
    name: String,
    game_version: String,
    fabric: bool,
    cover: String,
) -> CmdResult<Instance> {
    let loader = if fabric { Some(fabric::latest_loader().await?) } else { None };
    let instance = Instance {
        id: slug(&name),
        name: name.trim().chars().take(40).collect(),
        game_version,
        loader,
        cover,
        created_at: chrono::Utc::now().timestamp(),
        last_played: None,
        play_seconds: 0,
        last_server: None,
        ram_mb: None,
    };
    std::fs::create_dir_all(state.paths.instance(&instance.id))?;
    let mut list = state.instances.lock().unwrap();
    list.list.push(instance.clone());
    list.selected = Some(instance.id.clone());
    list.save(&state.paths)?;
    Ok(instance)
}

#[tauri::command]
fn update_instance(state: State<'_, AppState>, instance: Instance) -> CmdResult<()> {
    let mut list = state.instances.lock().unwrap();
    let current = list.get_mut(&instance.id).ok_or_else(|| Error::msg("Instância não encontrada"))?;
    // só o que a interface pode editar
    current.name = instance.name;
    current.cover = instance.cover;
    current.ram_mb = instance.ram_mb;
    list.save(&state.paths)
}

#[tauri::command]
fn delete_instance(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    if state.running.lock().unwrap().contains_key(&id) {
        return Err(Error::msg("Feche o jogo antes de apagar a instância"));
    }
    let dir = state.paths.instance(&id);
    if dir.starts_with(state.paths.instances()) && dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    let mut list = state.instances.lock().unwrap();
    list.list.retain(|i| i.id != id);
    if list.selected.as_deref() == Some(&id) {
        list.selected = list.list.first().map(|i| i.id.clone());
    }
    list.save(&state.paths)
}

#[tauri::command]
fn select_instance(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let mut list = state.instances.lock().unwrap();
    list.selected = Some(id);
    list.save(&state.paths)
}

// ---------- contas ----------

#[tauri::command]
async fn ms_login_start(app: AppHandle) -> CmdResult<DeviceCode> {
    let client_id = ms_client_id().ok_or_else(|| Error::msg("Login Microsoft não configurado (KAIRO_MS_CLIENT_ID)"))?;
    let code = auth::start_device_code(client_id).await?;
    let poll = code.clone();
    tauri::async_runtime::spawn(async move {
        match auth::poll_device_code(client_id, &poll).await {
            Ok(account) => {
                let state = app.state::<AppState>();
                let views = {
                    let mut acc = state.accounts.lock().unwrap();
                    acc.upsert(account.clone());
                    let _ = acc.save(&state.paths);
                    account_views(&acc)
                };
                let _ = app.emit(
                    "auth-done",
                    serde_json::json!({ "account": AccountView::from(&account), "accounts": views }),
                );
            }
            Err(e) => {
                let _ = app.emit("auth-error", e.to_string());
            }
        }
    });
    Ok(code)
}

#[tauri::command]
fn add_offline(state: State<'_, AppState>, name: String) -> CmdResult<AccountView> {
    let account = auth::offline(&name)?;
    let mut acc = state.accounts.lock().unwrap();
    acc.upsert(account.clone());
    acc.save(&state.paths)?;
    Ok(AccountView::from(&account))
}

#[tauri::command]
fn remove_account(state: State<'_, AppState>, uuid: String) -> CmdResult<()> {
    let mut acc = state.accounts.lock().unwrap();
    acc.list.retain(|a| a.uuid != uuid);
    if acc.active.as_deref() == Some(&uuid) {
        acc.active = acc.list.first().map(|a| a.uuid.clone());
    }
    acc.save(&state.paths)
}

#[tauri::command]
fn select_account(state: State<'_, AppState>, uuid: String) -> CmdResult<()> {
    let mut acc = state.accounts.lock().unwrap();
    if acc.list.iter().any(|a| a.uuid == uuid) {
        acc.active = Some(uuid);
    }
    acc.save(&state.paths)
}

// ---------- jogar ----------

/// O jar embutido no instalador para essa versão do jogo: kairo-client-<mod>+<mc>.jar.
fn bundled_mod(app: &AppHandle, game_version: &str) -> Option<PathBuf> {
    let target = kairo_jar_for(game_version)?;
    let suffix = format!("+{target}.jar");
    let dir = app.path().resolve("resources", BaseDirectory::Resource).ok()?;
    std::fs::read_dir(dir).ok()?.flatten().map(|e| e.path()).find(|p| {
        let n = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        n.starts_with("kairo-client") && n.ends_with(&suffix) && !n.contains("sources")
    })
}

#[tauri::command]
async fn launch(app: AppHandle, state: State<'_, AppState>, instance_id: String, server: Option<String>) -> CmdResult<()> {
    let instance = state
        .instances
        .lock()
        .unwrap()
        .get(&instance_id)
        .cloned()
        .ok_or_else(|| Error::msg("Instância não encontrada"))?;
    if state.accounts.lock().unwrap().active().is_none() {
        return Err(Error::msg("Adicione uma conta antes de jogar"));
    }
    {
        let mut running = state.running.lock().unwrap();
        if running.contains_key(&instance_id) {
            return Err(Error::msg("Essa instância já está aberta"));
        }
        running.insert(instance_id.clone(), None);
    }

    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        let id = instance.id.clone();
        if let Err(e) = run_game(app2.clone(), instance, server).await {
            let _ = app2.emit("game-state", GameState { instance_id: id.clone(), state: "error", message: e.to_string() });
        }
        app2.state::<AppState>().running.lock().unwrap().remove(&id);
        if let Some(w) = app2.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.show();
        }
    });
    Ok(())
}

async fn run_game(app: AppHandle, instance: Instance, server: Option<String>) -> Result<(), Error> {
    let state = app.state::<AppState>();
    let paths = state.paths.clone();
    let settings = state.settings.lock().unwrap().clone();
    let id = instance.id.clone();
    let emit_state = |s: &'static str, m: String| {
        let _ = app.emit("game-state", GameState { instance_id: id.clone(), state: s, message: m });
    };
    emit_state("installing", String::new());

    let emitter = app.clone();
    let progress: ProgressFn = Arc::new(move |p: Progress| {
        let _ = emitter.emit("progress", p);
    });

    // 1) conta (renova o token Microsoft se precisar)
    let mut account = state.accounts.lock().unwrap().active().cloned().ok_or_else(|| Error::msg("Sem conta ativa"))?;
    if account.needs_refresh() {
        let client_id = ms_client_id().ok_or_else(|| Error::msg("Login Microsoft não configurado"))?;
        kairo_core::progress::report(&progress, "meta", "Renovando sessão Microsoft", 0, 1);
        account = auth::refresh(client_id, &account).await?;
        let mut acc = state.accounts.lock().unwrap();
        acc.upsert(account.clone());
        acc.save(&paths)?;
    }

    // 2) jogo, bibliotecas, assets e Java
    let installed = install::install(&paths, &instance.game_version, instance.loader.as_deref(), &progress).await?;

    // 3) mods (só Fabric): mod do Kairo + pacote de desempenho na primeira vez
    let game_dir = paths.instance(&instance.id);
    std::fs::create_dir_all(&game_dir)?;
    if instance.loader.is_some() {
        let mods_dir = paths.mods(&instance.id);
        match bundled_mod(&app, &instance.game_version) {
            Some(jar) => mods::sync_builtin(&mods_dir, &jar)?,
            None => mods::remove_builtin(&mods_dir),
        }
        let marker = game_dir.join(".kairo-setup");
        if !marker.exists() {
            let msg = if settings.auto_performance_pack { "Instalando Fabric API e pacote de desempenho" } else { "Instalando Fabric API" };
            kairo_core::progress::report(&progress, "mods", msg, 0, 1);
            if settings.auto_performance_pack {
                mods::install_performance_pack(&instance.game_version, &mods_dir).await;
            } else {
                mods::install("fabric-api", &instance.game_version, "fabric", &mods_dir).await?;
            }
            std::fs::write(&marker, chrono::Utc::now().to_rfc3339())?;
        }
        // cor do launcher → HUD do jogo, se o usuário ainda não escolheu outra
        let cfg = client_config::read(&game_dir);
        if cfg.get("accent").is_none() {
            client_config::set_accent(&game_dir, &settings.accent)?;
        }
    }

    // 4) iniciar
    let opts = LaunchOptions {
        account,
        game_dir: game_dir.clone(),
        ram_mb: instance.ram_mb.unwrap_or(settings.ram_mb),
        gc: settings.gc,
        extra_jvm_args: settings.jvm_args.split_whitespace().map(String::from).collect(),
        resolution: Some((settings.width.max(640), settings.height.max(480))),
        fullscreen: settings.fullscreen,
        quick_play_server: server.clone(),
        java_override: settings.java_path.as_ref().filter(|p| !p.trim().is_empty()).map(PathBuf::from),
    };
    let mut child = launch::build_command(&paths, &installed, &opts)
        .spawn()
        .map_err(|e| Error::msg(format!("Não consegui iniciar o Java: {e}")))?;

    let (kill_tx, kill_rx) = oneshot::channel();
    state.running.lock().unwrap().insert(instance.id.clone(), Some(kill_tx));
    {
        let mut list = state.instances.lock().unwrap();
        if let Some(i) = list.get_mut(&instance.id) {
            i.last_played = Some(chrono::Utc::now().timestamp());
            if server.is_some() {
                i.last_server = server.clone();
            }
        }
        list.save(&paths)?;
    }
    emit_state("running", String::new());
    if settings.discord_rpc {
        discord::set_playing(instance.name.clone(), instance.game_version.clone(), server.clone(), chrono::Utc::now().timestamp());
    }

    match settings.after_launch {
        AfterLaunch::Minimize => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.minimize();
            }
        }
        AfterLaunch::Close => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        AfterLaunch::Keep => {}
    }

    // logs → aba Console
    for stream in [child.stdout.take().map(|s| Box::new(s) as Box<dyn tokio::io::AsyncRead + Unpin + Send>),
                   child.stderr.take().map(|s| Box::new(s) as Box<dyn tokio::io::AsyncRead + Unpin + Send>)]
        .into_iter()
        .flatten()
    {
        let app = app.clone();
        let id = instance.id.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stream).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("game-log", GameLog { instance_id: id.clone(), line });
            }
        });
    }

    let started = std::time::Instant::now();
    let status = tokio::select! {
        s = child.wait() => s?,
        _ = kill_rx => {
            let _ = child.kill().await;
            child.wait().await?
        }
    };

    if settings.discord_rpc {
        discord::clear();
    }
    {
        let mut list = state.instances.lock().unwrap();
        if let Some(i) = list.get_mut(&instance.id) {
            i.play_seconds += started.elapsed().as_secs();
        }
        list.save(&paths)?;
    }

    if settings.after_launch == AfterLaunch::Close {
        app.exit(0);
    }
    if status.success() || started.elapsed().as_secs() > 30 && status.code().is_none() {
        emit_state("stopped", String::new());
    } else {
        emit_state(
            "error",
            format!("O jogo fechou com erro (código {}). Veja a aba Console.", status.code().unwrap_or(-1)),
        );
    }
    Ok(())
}

#[tauri::command]
fn kill(state: State<'_, AppState>, instance_id: String) {
    if let Some(Some(tx)) = state.running.lock().unwrap().get_mut(&instance_id).map(|t| t.take()) {
        let _ = tx.send(());
    }
}

// ---------- mods ----------

fn instance_of(state: &AppState, id: &str) -> Result<Instance, Error> {
    state.instances.lock().unwrap().get(id).cloned().ok_or_else(|| Error::msg("Instância não encontrada"))
}

#[tauri::command]
fn mods_list(state: State<'_, AppState>, instance_id: String) -> CmdResult<Vec<mods::LocalMod>> {
    mods::list(&state.paths.mods(&instance_id))
}

#[tauri::command]
async fn mods_search(
    state: State<'_, AppState>,
    instance_id: String,
    query: String,
    offset: u32,
    sort: String,
) -> CmdResult<mods::SearchResult> {
    let i = instance_of(&state, &instance_id)?;
    let sort = match sort.as_str() {
        "downloads" | "updated" | "newest" | "follows" => sort,
        _ => "relevance".into(),
    };
    mods::search(&query, &i.game_version, "fabric", offset, &sort).await
}

#[tauri::command]
async fn mods_install(state: State<'_, AppState>, instance_id: String, project: String) -> CmdResult<mods::InstallReport> {
    let i = instance_of(&state, &instance_id)?;
    mods::install(&project, &i.game_version, "fabric", &state.paths.mods(&instance_id)).await
}

#[tauri::command]
fn mods_toggle(state: State<'_, AppState>, instance_id: String, file: String, enabled: bool) -> CmdResult<()> {
    mods::set_enabled(&state.paths.mods(&instance_id), &file, enabled).map(|_| ())
}

#[tauri::command]
fn mods_remove(state: State<'_, AppState>, instance_id: String, file: String) -> CmdResult<()> {
    if file.starts_with("kairo-client") {
        return Err(Error::msg("O mod do Kairo é parte do launcher"));
    }
    mods::remove(&state.paths.mods(&instance_id), &file)
}

#[tauri::command]
async fn performance_pack(state: State<'_, AppState>, instance_id: String) -> CmdResult<mods::InstallReport> {
    let i = instance_of(&state, &instance_id)?;
    Ok(mods::install_performance_pack(&i.game_version, &state.paths.mods(&instance_id)).await)
}

// ---------- client (config do mod) ----------

#[tauri::command]
fn client_config(state: State<'_, AppState>, instance_id: String) -> serde_json::Value {
    client_config::read(&state.paths.instance(&instance_id))
}

#[tauri::command]
fn client_set_module(state: State<'_, AppState>, instance_id: String, module: String, enabled: bool) -> CmdResult<serde_json::Value> {
    client_config::set_module(&state.paths.instance(&instance_id), &module, enabled)
}

#[tauri::command]
fn client_set_accent(state: State<'_, AppState>, instance_id: String, hex: String) -> CmdResult<serde_json::Value> {
    let valid = hex.len() == 7 && hex.starts_with('#') && hex[1..].chars().all(|c| c.is_ascii_hexdigit());
    if !valid {
        return Err(Error::msg("Cor inválida"));
    }
    client_config::set_accent(&state.paths.instance(&instance_id), &hex)
}

#[tauri::command]
fn client_set_option(
    state: State<'_, AppState>,
    instance_id: String,
    module: String,
    key: String,
    value: serde_json::Value,
) -> CmdResult<serde_json::Value> {
    client_config::set_option(&state.paths.instance(&instance_id), &module, &key, value)
}

#[tauri::command]
fn client_set_hud(
    state: State<'_, AppState>,
    instance_id: String,
    module: String,
    rx: f64,
    ry: f64,
    scale: f64,
) -> CmdResult<serde_json::Value> {
    client_config::set_hud(&state.paths.instance(&instance_id), &module, rx, ry, scale)
}

#[tauri::command]
fn client_reset_hud(state: State<'_, AppState>, instance_id: String, module: Option<String>) -> CmdResult<serde_json::Value> {
    client_config::reset_hud(&state.paths.instance(&instance_id), module.as_deref())
}

#[tauri::command]
fn client_save_profile(
    state: State<'_, AppState>,
    instance_id: String,
    name: String,
    states: BTreeMap<String, bool>,
) -> CmdResult<serde_json::Value> {
    client_config::save_profile(&state.paths.instance(&instance_id), &name, &states)
}

#[tauri::command]
fn client_apply_profile(state: State<'_, AppState>, instance_id: String, name: String) -> CmdResult<serde_json::Value> {
    client_config::apply_profile(&state.paths.instance(&instance_id), &name)
}

#[tauri::command]
fn client_delete_profile(state: State<'_, AppState>, instance_id: String, name: String) -> CmdResult<serde_json::Value> {
    client_config::delete_profile(&state.paths.instance(&instance_id), &name)
}

#[tauri::command]
fn client_set_server_rules(
    state: State<'_, AppState>,
    instance_id: String,
    rules: Vec<ServerRule>,
) -> CmdResult<serde_json::Value> {
    client_config::set_server_rules(&state.paths.instance(&instance_id), rules)
}

// ---------- servidores ----------

#[tauri::command]
async fn servers_ping(addresses: Vec<String>) -> Vec<ServerStatus> {
    server_ping::ping_many(&addresses).await
}

// ---------- início ----------

#[cfg(test)]
mod tests {
    use super::kairo_jar_for;

    #[test]
    fn jar_por_versao() {
        assert_eq!(kairo_jar_for("1.21"), Some("1.21.1"));
        assert_eq!(kairo_jar_for("1.21.7"), Some("1.21.8"));
        assert_eq!(kairo_jar_for("1.21.11"), Some("1.21.11"));
        assert_eq!(kairo_jar_for("26.3.1"), Some("26.3"));
        assert_eq!(kairo_jar_for("1.21.5"), None);
        assert_eq!(kairo_jar_for("1.20.1"), None);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let paths = Paths::new(Paths::default_root());
    let _ = std::fs::create_dir_all(&paths.root);
    let state = AppState {
        settings: Mutex::new(Settings::load(&paths)),
        instances: Mutex::new(Instances::load(&paths)),
        accounts: Mutex::new(Accounts::load(&paths)),
        running: Mutex::new(HashMap::new()),
        paths,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            list_versions,
            save_settings,
            open_folder,
            create_instance,
            update_instance,
            delete_instance,
            select_instance,
            ms_login_start,
            add_offline,
            remove_account,
            select_account,
            launch,
            kill,
            mods_list,
            mods_search,
            mods_install,
            mods_toggle,
            mods_remove,
            performance_pack,
            client_config,
            client_set_module,
            client_set_accent,
            client_set_option,
            client_set_hud,
            client_reset_hud,
            client_save_profile,
            client_apply_profile,
            client_delete_profile,
            client_set_server_rules,
            servers_ping,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Kairo Launcher");
}
