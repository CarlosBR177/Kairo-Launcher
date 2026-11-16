// Camada única de comunicação com o backend (Rust/Tauri).
// Fora do Tauri (npm run dev no navegador) usa dados de demonstração,
// o que permite trabalhar no visual sem compilar o app.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------- tipos (espelham kairo-core) ----------

export type GcMode = "g1" | "zgc";
export type AfterLaunch = "minimize" | "keep" | "close";

export interface Settings {
  ram_mb: number;
  gc: GcMode;
  jvm_args: string;
  after_launch: AfterLaunch;
  width: number;
  height: number;
  fullscreen: boolean;
  java_path: string | null;
  accent: string;
  auto_performance_pack: boolean;
  show_snapshots: boolean;
  discord_rpc: boolean;
  check_updates: boolean;
  favorite_servers: FavoriteServer[];
}

export interface FavoriteServer {
  name: string;
  address: string;
}

export interface ServerStatus {
  address: string;
  online: boolean;
  ping_ms: number | null;
  players_online: number | null;
  players_max: number | null;
  version: string | null;
  motd: string | null;
  favicon: string | null;
  error: string | null;
}

export interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader: string | null;
  cover: string;
  created_at: number;
  last_played: number | null;
  play_seconds: number;
  last_server: string | null;
  ram_mb: number | null;
}

export interface AccountView {
  uuid: string;
  name: string;
  kind: "microsoft" | "offline";
}

export interface Bootstrap {
  settings: Settings;
  instances: Instance[];
  selected: string | null;
  accounts: AccountView[];
  active_account: string | null;
  ms_login_available: boolean;
  version: string;
  data_dir: string;
  total_memory_mb: number;
  discord_available: boolean;
}

export interface VersionInfo {
  id: string;
  kind: string;
  release_time: string;
  fabric: boolean;
}

export interface DeviceCode {
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

export interface LocalMod {
  file: string;
  enabled: boolean;
  id: string;
  name: string;
  version: string;
  description: string;
  authors: string[];
  builtin: boolean;
}

export interface SearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  author: string;
  categories: string[];
}

export interface InstallReport {
  installed: string[];
  skipped: string[];
}

export interface Progress {
  stage: string;
  message: string;
  current: number;
  total: number;
}

export type GameStateKind = "installing" | "running" | "stopped" | "error";
export interface GameState {
  instance_id: string;
  state: GameStateKind;
  message: string;
}

export type OptionValue = boolean | number | string;

export interface ServerRule {
  server: string;
  modules: string[];
}

export interface ClientConfig {
  accent: string;
  modules: Record<string, { enabled?: boolean; x?: number; y?: number; rx?: number; ry?: number; scale?: number; [key: string]: OptionValue | undefined }>;
  profiles?: Record<string, Record<string, boolean>>;
  activeProfile?: string;
  serverRules?: ServerRule[];
}

// ---------- chamadas ----------

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return mock<T>(cmd, args ?? {});
  return invoke<T>(cmd, args);
}

export const api = {
  bootstrap: () => call<Bootstrap>("bootstrap"),
  listVersions: (snapshots: boolean) => call<VersionInfo[]>("list_versions", { snapshots }),

  createInstance: (name: string, gameVersion: string, fabric: boolean, cover: string) =>
    call<Instance>("create_instance", { name, gameVersion, fabric, cover }),
  updateInstance: (instance: Instance) => call<void>("update_instance", { instance }),
  deleteInstance: (id: string) => call<void>("delete_instance", { id }),
  selectInstance: (id: string) => call<void>("select_instance", { id }),

  launch: (instanceId: string, server: string | null) => call<void>("launch", { instanceId, server }),
  kill: (instanceId: string) => call<void>("kill", { instanceId }),

  msLoginStart: () => call<DeviceCode>("ms_login_start"),
  addOffline: (name: string) => call<AccountView>("add_offline", { name }),
  removeAccount: (uuid: string) => call<void>("remove_account", { uuid }),
  selectAccount: (uuid: string) => call<void>("select_account", { uuid }),

  modsList: (instanceId: string) => call<LocalMod[]>("mods_list", { instanceId }),
  modsSearch: (instanceId: string, query: string, offset: number, sort: string) =>
    call<{ hits: SearchHit[]; total_hits: number }>("mods_search", { instanceId, query, offset, sort }),
  modsInstall: (instanceId: string, project: string) => call<InstallReport>("mods_install", { instanceId, project }),
  modsToggle: (instanceId: string, file: string, enabled: boolean) =>
    call<void>("mods_toggle", { instanceId, file, enabled }),
  modsRemove: (instanceId: string, file: string) => call<void>("mods_remove", { instanceId, file }),
  performancePack: (instanceId: string) => call<InstallReport>("performance_pack", { instanceId }),

  clientConfig: (instanceId: string) => call<ClientConfig>("client_config", { instanceId }),
  clientSetModule: (instanceId: string, module: string, enabled: boolean) =>
    call<ClientConfig>("client_set_module", { instanceId, module, enabled }),
  clientSetAccent: (instanceId: string, hex: string) => call<ClientConfig>("client_set_accent", { instanceId, hex }),
  clientSetOption: (instanceId: string, module: string, key: string, value: OptionValue) =>
    call<ClientConfig>("client_set_option", { instanceId, module, key, value }),
  clientSetHud: (instanceId: string, module: string, rx: number, ry: number, scale: number) =>
    call<ClientConfig>("client_set_hud", { instanceId, module, rx, ry, scale }),
  clientResetHud: (instanceId: string, module: string | null) => call<ClientConfig>("client_reset_hud", { instanceId, module }),
  clientSaveProfile: (instanceId: string, name: string, states: Record<string, boolean>) =>
    call<ClientConfig>("client_save_profile", { instanceId, name, states }),
  clientApplyProfile: (instanceId: string, name: string) => call<ClientConfig>("client_apply_profile", { instanceId, name }),
  clientDeleteProfile: (instanceId: string, name: string) => call<ClientConfig>("client_delete_profile", { instanceId, name }),
  clientSetServerRules: (instanceId: string, rules: ServerRule[]) =>
    call<ClientConfig>("client_set_server_rules", { instanceId, rules }),

  serversPing: (addresses: string[]) => call<ServerStatus[]>("servers_ping", { addresses }),

  saveSettings: (settings: Settings) => call<void>("save_settings", { settings }),
  openFolder: (instanceId: string | null) => call<void>("open_folder", { instanceId }),
};

export function on<T>(event: string, handler: (payload: T) => void): () => void {
  if (!isTauri) return mockListen(event, handler as (p: unknown) => void);
  let un: UnlistenFn | null = null;
  let disposed = false;
  listen<T>(event, (e) => handler(e.payload)).then((u) => {
    if (disposed) u();
    else un = u;
  });
  return () => {
    disposed = true;
    un?.();
  };
}

// ---------- modo demonstração (navegador) ----------

const listeners = new Map<string, Set<(p: unknown) => void>>();
function emit(event: string, payload: unknown) {
  listeners.get(event)?.forEach((h) => h(payload));
}
function mockListen(event: string, h: (p: unknown) => void) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(h);
  return () => listeners.get(event)!.delete(h);
}

const now = Math.floor(Date.now() / 1000);
const demo = {
  settings: {
    ram_mb: 4096, gc: "g1", jvm_args: "", after_launch: "minimize", width: 1280, height: 720,
    fullscreen: false, java_path: null, accent: "#8B5CFF", auto_performance_pack: true, show_snapshots: false,
    discord_rpc: true, check_updates: true,
    favorite_servers: [{ name: "Servidor da galera", address: "mc.exemplo.com.br" }, { name: "Treino 1v1", address: "pvp.exemplo.net" }],
  } as Settings,
  instances: [
    { id: "kairo", name: "Kairo PvP", game_version: "26.3", loader: "0.20.1", cover: "aurora", created_at: now - 86400 * 9, last_played: now - 3600 * 5, play_seconds: 3600 * 27 + 1200, last_server: "mc.exemplo.com.br", ram_mb: null },
    { id: "survival", name: "Survival com a galera", game_version: "26.3", loader: "0.20.1", cover: "forest", created_at: now - 86400 * 30, last_played: now - 86400 * 2, play_seconds: 3600 * 61, last_server: null, ram_mb: 6144 },
    { id: "vanilla", name: "Vanilla puro", game_version: "26.3", loader: null, cover: "ocean", created_at: now - 86400 * 60, last_played: null, play_seconds: 0, last_server: null, ram_mb: null },
  ] as Instance[],
  accounts: [{ uuid: "b50ad385829d3141a2167e7d7539ba7f", name: "Carlos", kind: "offline" }] as AccountView[],
  mods: [
    { file: "kairo-client-0.1.0.jar", enabled: true, id: "kairo", name: "Kairo Client", version: "0.1.0", description: "Módulos do Kairo", authors: ["Carlos"], builtin: true },
    { file: "sodium.jar", enabled: true, id: "sodium", name: "Sodium", version: "0.8.1", description: "Motor de renderização moderno", authors: ["JellySquid"], builtin: false },
    { file: "lithium.jar", enabled: true, id: "lithium", name: "Lithium", version: "0.18.0", description: "Otimiza física e lógica do jogo", authors: ["CaffeineMC"], builtin: false },
    { file: "ferritecore.jar", enabled: true, id: "ferritecore", name: "FerriteCore", version: "8.0.0", description: "Reduz o uso de memória", authors: ["malte0811"], builtin: false },
    { file: "entityculling.jar.disabled", enabled: false, id: "entityculling", name: "EntityCulling", version: "1.8.2", description: "Não renderiza entidades escondidas", authors: ["tr7zw"], builtin: false },
  ] as LocalMod[],
  client: {
    accent: "#8B5CFF",
    modules: { fps: { enabled: true }, cps: { enabled: true }, ping: { enabled: true }, clock: { enabled: false }, coords: { enabled: true }, keystrokes: { enabled: true }, freelook: { enabled: true }, zoom: { enabled: true }, togglesprint: { enabled: false } },
    profiles: { PvP: { fps: true, cps: true, combo: true, potions: true, armor: true, coords: false, clock: false } },
    activeProfile: "PvP",
    serverRules: [{ server: "exemplo.net", modules: ["freelook"] }],
  } as ClientConfig,
};

async function mock<T>(cmd: string, a: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 120));
  const r = (v: unknown) => v as T;
  switch (cmd) {
    case "bootstrap":
      return r({
        settings: demo.settings, instances: demo.instances, selected: "kairo", accounts: demo.accounts,
        active_account: demo.accounts[0].uuid, ms_login_available: false, version: "0.1.0",
        data_dir: "C:\\Users\\voce\\AppData\\Roaming\\KairoLauncher", total_memory_mb: 16384, discord_available: true,
      });
    case "list_versions":
      return r(["26.3", "26.2", "26.1.2", "26.1", "1.21.11", "1.21.8", "1.20.1", "1.8.9"].map((id, i) => ({
        id, kind: "release", release_time: "", fabric: i < 7,
      })));
    case "mods_list":
      return r(demo.mods);
    case "mods_search":
      return r({
        total_hits: 4,
        hits: [
          { project_id: "1", slug: "iris", title: "Iris Shaders", description: "Shaders compatíveis com Sodium.", icon_url: null, downloads: 81_000_000, author: "coderbot", categories: ["optimization"] },
          { project_id: "2", slug: "zoomify", title: "Zoomify", description: "Zoom altamente configurável.", icon_url: null, downloads: 9_400_000, author: "isXander", categories: ["utility"] },
          { project_id: "3", slug: "xaeros-minimap", title: "Xaero's Minimap", description: "Minimapa com waypoints.", icon_url: null, downloads: 52_000_000, author: "xaero96", categories: ["adventure"] },
          { project_id: "4", slug: "modmenu", title: "Mod Menu", description: "Lista de mods dentro do jogo.", icon_url: null, downloads: 120_000_000, author: "Prospector", categories: ["utility"] },
        ],
      });
    case "mods_install":
    case "performance_pack":
      await new Promise((res) => setTimeout(res, 900));
      return r({ installed: [String(a.project ?? "pacote")], skipped: [] });
    case "client_config":
      return r(demo.client);
    case "client_set_module":
      demo.client.modules[String(a.module)] = { ...demo.client.modules[String(a.module)], enabled: Boolean(a.enabled) };
      return r({ ...demo.client });
    case "client_set_accent":
      demo.client.accent = String(a.hex);
      return r({ ...demo.client });
    case "client_set_option": {
      const id = String(a.module);
      demo.client.modules[id] = { ...demo.client.modules[id], [String(a.key)]: a.value as OptionValue };
      return r({ ...demo.client });
    }
    case "client_set_hud": {
      const id = String(a.module);
      demo.client.modules[id] = { ...demo.client.modules[id], rx: Number(a.rx), ry: Number(a.ry), scale: Number(a.scale) };
      return r({ ...demo.client, modules: { ...demo.client.modules } });
    }
    case "client_reset_hud": {
      Object.entries(demo.client.modules).forEach(([id, m]) => {
        if (a.module && a.module !== id) return;
        const { rx: _a, ry: _b, scale: _c, x: _d, y: _e, ...rest } = m;
        demo.client.modules[id] = rest;
      });
      return r({ ...demo.client, modules: { ...demo.client.modules } });
    }
    case "client_save_profile":
      demo.client.profiles = { ...demo.client.profiles, [String(a.name)]: a.states as Record<string, boolean> };
      demo.client.activeProfile = String(a.name);
      return r({ ...demo.client });
    case "client_apply_profile": {
      const p = demo.client.profiles?.[String(a.name)] ?? {};
      Object.entries(p).forEach(([id, on]) => (demo.client.modules[id] = { ...demo.client.modules[id], enabled: on }));
      demo.client.activeProfile = String(a.name);
      return r({ ...demo.client, modules: { ...demo.client.modules } });
    }
    case "client_delete_profile": {
      const { [String(a.name)]: _gone, ...rest } = demo.client.profiles ?? {};
      demo.client.profiles = rest;
      if (demo.client.activeProfile === a.name) delete demo.client.activeProfile;
      return r({ ...demo.client });
    }
    case "client_set_server_rules":
      demo.client.serverRules = a.rules as ServerRule[];
      return r({ ...demo.client });
    case "servers_ping":
      await new Promise((res) => setTimeout(res, 500));
      return r((a.addresses as string[]).map((address, i) => i === 1
        ? { address, online: false, ping_ms: null, players_online: null, players_max: null, version: null, motd: null, favicon: null, error: "Offline" }
        : { address, online: true, ping_ms: 38 + i * 21, players_online: 214, players_max: 1000, version: "26.3", motd: "Kairo PvP · Temporada nova!", favicon: null, error: null }));
    case "create_instance":
      return r({ id: crypto.randomUUID(), name: a.name, game_version: a.gameVersion, loader: a.fabric ? "0.20.1" : null, cover: a.cover, created_at: now, last_played: null, play_seconds: 0, last_server: null, ram_mb: null });
    case "add_offline":
      return r({ uuid: crypto.randomUUID().replaceAll("-", ""), name: a.name, kind: "offline" });
    case "ms_login_start":
      return r({ user_code: "KR4-9QX", verification_uri: "https://www.microsoft.com/link", expires_in: 900 });
    case "launch":
      simulateLaunch(String(a.instanceId));
      return r(undefined);
    default:
      return r(undefined);
  }
}

function simulateLaunch(id: string) {
  emit("game-state", { instance_id: id, state: "installing", message: "" });
  const stages: [string, string, number][] = [
    ["meta", "Lendo informações da versão 26.3", 1],
    ["libraries", "Baixando bibliotecas", 96],
    ["assets", "Baixando recursos do jogo", 4210],
    ["java", "Baixando Java 25", 380],
  ];
  let t = 0;
  stages.forEach(([stage, message, total]) => {
    for (let i = 0; i <= 10; i++) {
      setTimeout(() => emit("progress", { stage, message, current: Math.round((total * i) / 10), total }), (t += 90));
    }
  });
  setTimeout(() => {
    emit("game-state", { instance_id: id, state: "running", message: "" });
    ["[Render thread/INFO]: Loading Minecraft 26.3 with Fabric Loader 0.20.1", "[Render thread/INFO]: Kairo Client carregado com 9 módulos", "[Render thread/WARN]: Sodium: driver antigo detectado"].forEach((l, i) =>
      setTimeout(() => emit("game-log", { instance_id: id, line: l }), i * 300));
  }, (t += 200));
  setTimeout(() => emit("game-state", { instance_id: id, state: "stopped", message: "" }), t + 6000);
}
