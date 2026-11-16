//! Discord Rich Presence: "Jogando Kairo · Kairo PvP · mc.servidor.com".
//! Precisa de um Application ID do Discord na compilação (KAIRO_DISCORD_APP_ID);
//! sem ele, ou com o Discord fechado, tudo aqui vira silenciosamente um no-op.

use discord_rich_presence::activity::{Activity, Assets, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

const APP_ID: Option<&str> = option_env!("KAIRO_DISCORD_APP_ID");

static CLIENT: Mutex<Option<DiscordIpcClient>> = Mutex::new(None);

pub fn available() -> bool {
    APP_ID.is_some_and(|id| !id.trim().is_empty())
}

fn with_client(f: impl FnOnce(&mut DiscordIpcClient) -> Result<(), discord_rich_presence::error::Error>) {
    let Some(id) = APP_ID.filter(|s| !s.trim().is_empty()) else { return };
    let mut guard = CLIENT.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let mut c = DiscordIpcClient::new(id);
        if c.connect().is_err() {
            return; // Discord fechado: tenta de novo na próxima vez
        }
        *guard = Some(c);
    }
    if let Some(c) = guard.as_mut() {
        if f(c).is_err() {
            let _ = c.close();
            *guard = None;
        }
    }
}

/// Mostra a instância (e o servidor, se houver) no perfil do Discord.
pub fn set_playing(instance: String, version: String, server: Option<String>, started_at: i64) {
    std::thread::spawn(move || {
        with_client(|c| {
            let details = format!("{instance} · {version}");
            let state = match &server {
                Some(s) => format!("Em {s}"),
                None => "No menu ou em mundo local".to_string(),
            };
            c.set_activity(
                Activity::new()
                    .details(details)
                    .state(state)
                    .timestamps(Timestamps::new().start(started_at))
                    .assets(Assets::new().large_image("kairo").large_text("Kairo PvP Client")),
            )
        });
    });
}

pub fn clear() {
    std::thread::spawn(|| with_client(|c| c.clear_activity()));
}
