// Atualização do launcher (tauri-plugin-updater + releases do GitHub).
// Guarda o estado aqui fora do React e a janela (UpdateModal) só observa.
import { useSyncExternalStore } from "react";
import { isTauri } from "./api";

export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "done" | "error";

export interface UpdateState {
  phase: UpdatePhase;
  open: boolean; // janela aberta
  version: string;
  notes: string;
  date: string | null;
  downloaded: number;
  total: number; // 0 = tamanho desconhecido
  error: string;
}

type ToastFn = (text: string, kind?: "ok" | "error" | "info") => void;

// o objeto Update do plugin (só existe no app de verdade)
type PluginUpdate = {
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall: (cb?: (e: DownloadEvent) => void) => Promise<void>;
};
type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

const initial: UpdateState = { phase: "idle", open: false, version: "", notes: "", date: null, downloaded: 0, total: 0, error: "" };
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

/** Demonstração no navegador: abra http://localhost:1420/?update para ver a janela. */
const demo = !isTauri && typeof location !== "undefined" && new URLSearchParams(location.search).has("update");

/**
 * Procura uma versão nova. Se achar, abre a janela (o usuário decide).
 * @param manual true quando veio do botão "Procurar agora" (avisa se já está atualizado).
 */
export async function checkForUpdate(toast: ToastFn, manual = false): Promise<void> {
  if (state.phase === "checking" || state.phase === "downloading" || state.phase === "installing") return;
  if (state.phase === "available") { set({ open: true }); return; }

  if (!isTauri && !demo) {
    if (manual) toast("No modo navegador não há atualizações", "info");
    return;
  }
  set({ phase: "checking" });
  try {
    if (demo) {
      await sleep(600);
      set({
        phase: "available", open: true, version: "0.2.0", date: new Date().toISOString(),
        notes: "## Novidades\n- Janela de atualização com progresso\n- Tela de carregamento animada\n- Módulo Mão funcionando na 26.3\n\n## Correções\n- Login mais estável",
      });
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
    set({ phase: "available", open: true, version: update.version, notes: update.body ?? "", date: update.date ?? null });
  } catch (e) {
    set({ phase: "idle" });
    // sem internet ou sem release publicada: só avisa se foi pedido
    if (manual) toast(`Não consegui procurar atualizações: ${String(e)}`, "error");
  }
}

export function openUpdate() {
  if (state.phase !== "idle" && state.phase !== "checking") set({ open: true });
}

/** "Depois": fecha a janela, mas deixa o aviso na barra de título. */
export function closeUpdate() {
  if (state.phase === "error") set({ open: false, phase: "available", error: "" });
  else set({ open: false });
}

export async function installUpdate(): Promise<void> {
  if (state.phase !== "available" && state.phase !== "error") return;
  set({ phase: "downloading", downloaded: 0, total: 0, error: "" });
  try {
    if (demo) {
      const total = 9_800_000;
      set({ total });
      for (let d = 0; d < total; d += 380_000) { await sleep(70); set({ downloaded: Math.min(d, total) }); }
      set({ downloaded: total, phase: "installing" });
      await sleep(1400);
      set({ phase: "done" });
      await sleep(1600);
      set({ ...initial });
      return;
    }
    if (!pending) throw new Error("Nenhuma atualização carregada");
    await pending.downloadAndInstall((e) => {
      if (e.event === "Started") set({ total: e.data.contentLength ?? 0 });
      else if (e.event === "Progress") set({ downloaded: state.downloaded + e.data.chunkLength });
      else if (e.event === "Finished") set({ phase: "installing" });
    });
    set({ phase: "done" });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    setTimeout(() => relaunch(), 1500);
  } catch (e) {
    set({ phase: "error", error: String(e) });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
