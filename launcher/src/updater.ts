// Atualização do launcher (tauri-plugin-updater + releases do GitHub).
// Guarda o estado aqui fora do React e a janela (UpdateModal) só observa.
//
// Fluxo:
//  1. check() acha versão nova → abre a janela com as novidades (nada é baixado sozinho)
//  2. "Atualizar agora" → baixa com progresso DENTRO da janela (download())
//  3. mostra "Instalando…" por um instante e só então chama install()
//     (no Windows o install() fecha o app e o instalador reabre o Kairo já atualizado)
//  4. na próxima abertura, a janela "Novidades da versão X" aparece com o changelog
import { useSyncExternalStore } from "react";
import { isTauri } from "./api";

export type UpdatePhase =
  | "idle" | "checking" | "available" | "downloading" | "installing" | "done" | "error"
  | "whatsnew"; // depois de atualizar: mostra o que mudou

export interface UpdateState {
  phase: UpdatePhase;
  open: boolean; // janela aberta
  version: string;
  notes: string;
  date: string | null;
  downloaded: number;
  total: number; // 0 = tamanho desconhecido
  speed: number; // bytes/s
  error: string;
}

type ToastFn = (text: string, kind?: "ok" | "error" | "info") => void;

// o objeto Update do plugin (só existe no app de verdade)
type PluginUpdate = {
  version: string;
  body?: string;
  date?: string;
  download: (cb?: (e: DownloadEvent) => void) => Promise<void>;
  install: () => Promise<void>;
};
type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

const REPO = "CarlosBR177/Kairo-Launcher";
const PENDING_KEY = "kairo.update.pending"; // { version, notes } gravado antes de instalar
const SEEN_KEY = "kairo.update.seen"; // última versão aberta

const initial: UpdateState = { phase: "idle", open: false, version: "", notes: "", date: null, downloaded: 0, total: 0, speed: 0, error: "" };
let state: UpdateState = initial;
let pending: PluginUpdate | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

/** Demonstração no navegador: abra http://localhost:1420/?update (ou ?novidades) para ver a janela. */
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const demo = !isTauri && params.has("update");
const demoWhatsNew = !isTauri && params.has("novidades");
const DEMO_NOTES = "## Novidades\n- Janela de atualização nova, com as mudanças antes de atualizar\n- Aba Console mostra as etapas do launcher e os erros do Java\n- Tela inicial do Kairo no Minecraft\n\n## Correções\n- Java baixado corrompido (erro do jvm.cfg) agora é reparado sozinho\n- Console parava no primeiro acento do log";

/** Notas da release no GitHub (o texto que você escreve na release). Cai para o latest.json se falhar. */
async function releaseNotes(version: string, fallback = ""): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version.replace(/^v/, "")}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    clearTimeout(t);
    if (r.ok) {
      const body = String((await r.json()).body ?? "");
      if (body.trim()) return cleanNotes(body);
    }
  } catch { /* sem internet / limite da API: usa o fallback */ }
  return cleanNotes(fallback);
}

/** Tira o texto de "primeira vez? baixe o setup", que é só para quem vê a página da release. */
function cleanNotes(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !/primeira vez\?|baixe o .*setup|recebe a atualiza[çc][ãa]o sozinho/i.test(l))
    .join("\n")
    .trim();
}

/**
 * Procura uma versão nova. Se achar, abre a janela (o usuário decide).
 * @param manual true quando veio do botão "Procurar agora" (avisa se já está atualizado).
 */
export async function checkForUpdate(toast: ToastFn, manual = false): Promise<void> {
  if (state.phase === "checking" || state.phase === "downloading" || state.phase === "installing") return;
  if (state.phase === "whatsnew") return; // acabou de atualizar: não cobre a janela de novidades
  if (state.phase === "available") { set({ open: true }); return; }

  if (!isTauri && !demo) {
    if (manual) toast("No modo navegador não há atualizações", "info");
    return;
  }
  set({ phase: "checking" });
  try {
    if (demo) {
      await sleep(600);
      set({ phase: "available", open: true, version: "0.2.0", date: new Date().toISOString(), notes: DEMO_NOTES });
      return;
    }
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = (await check()) as PluginUpdate | null;
    if (!update) {
      set({ phase: "idle" });
      if (manual) toast("Você já está na versão mais recente", "ok");
      return;
    }
    pending = update;
    const notes = await releaseNotes(update.version, update.body ?? "");
    set({ phase: "available", open: true, version: update.version, notes, date: update.date ?? null });
  } catch (e) {
    set({ phase: "idle" });
    // sem internet ou sem release publicada: só avisa se foi pedido
    if (manual) toast(`Não consegui procurar atualizações: ${String(e)}`, "error");
  }
}

/**
 * Chamado ao abrir o launcher: se acabou de atualizar, mostra "Novidades da versão X".
 * Funciona tanto pelo auto-update quanto por quem instalou o Kairo-Setup.exe por cima.
 */
export async function showWhatsNew(currentVersion: string): Promise<void> {
  if (demoWhatsNew) {
    await sleep(400);
    set({ phase: "whatsnew", open: true, version: "0.2.0", notes: DEMO_NOTES, date: null });
    return;
  }
  if (!isTauri || !currentVersion) return;
  let seen: string | null = null;
  let saved: { version?: string; notes?: string } | null = null;
  try {
    seen = localStorage.getItem(SEEN_KEY);
    saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    localStorage.setItem(SEEN_KEY, currentVersion);
    localStorage.removeItem(PENDING_KEY);
  } catch { /* storage indisponível */ }

  const updatedNow = saved?.version === currentVersion || (seen !== null && seen !== currentVersion);
  if (!updatedNow) return; // primeira instalação ou mesma versão
  const notes = saved?.version === currentVersion && saved.notes ? saved.notes : await releaseNotes(currentVersion);
  if (state.phase !== "idle") return; // já tem outra coisa na tela
  set({ phase: "whatsnew", open: true, version: currentVersion, notes, date: null });
}

export function openUpdate() {
  if (state.phase !== "idle" && state.phase !== "checking") set({ open: true });
}

/** "Depois": fecha a janela, mas deixa o aviso na barra de título. */
export function closeUpdate() {
  if (state.phase === "whatsnew") set({ ...initial });
  else if (state.phase === "error") set({ open: false, phase: "available", error: "" });
  else set({ open: false });
}

export async function installUpdate(): Promise<void> {
  if (state.phase !== "available" && state.phase !== "error") return;
  set({ phase: "downloading", downloaded: 0, total: 0, speed: 0, error: "" });
  const started = performance.now();
  const onBytes = (downloaded: number) => {
    const secs = (performance.now() - started) / 1000;
    set({ downloaded, speed: secs > 0.3 ? downloaded / secs : 0 });
  };
  try {
    if (demo) {
      const total = 9_800_000;
      set({ total });
      for (let d = 0; d < total; d += 260_000) { await sleep(60); onBytes(Math.min(d, total)); }
      onBytes(total);
      set({ phase: "installing" });
      await sleep(1800);
      set({ phase: "done" });
      await sleep(1800);
      set({ ...initial });
      return;
    }
    if (!pending) throw new Error("Nenhuma atualização carregada");
    await pending.download((e) => {
      if (e.event === "Started") set({ total: e.data.contentLength ?? 0 });
      else if (e.event === "Progress") onBytes(state.downloaded + e.data.chunkLength);
    });
    set({ phase: "installing" });
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ version: state.version, notes: state.notes }));
    } catch { /* ok */ }
    await sleep(1600); // deixa a animação de "instalando" aparecer antes do app fechar
    set({ phase: "done" });
    await sleep(900);
    await pending.install(); // Windows: fecha o launcher e o instalador reabre já atualizado
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch(); // macOS/Linux
  } catch (e) {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* ok */ }
    set({ phase: "error", error: String(e) });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
