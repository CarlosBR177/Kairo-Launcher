// Atualização automática do launcher (tauri-plugin-updater + releases do GitHub).
import { isTauri } from "./api";
import type { Toast } from "./store";

type ToastFn = (text: string, kind?: Toast["kind"]) => void;

let busy = false;

/** @param manual true quando o usuário clicou em "Procurar agora" (mostra "já está atualizado"). */
export async function checkForUpdate(toast: ToastFn, manual = false): Promise<void> {
  if (!isTauri) {
    if (manual) toast("No modo navegador não há atualizações", "info");
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      if (manual) toast("Você já está na versão mais recente", "ok");
      return;
    }
    toast(`Baixando a versão ${update.version}…`, "info");
    await update.downloadAndInstall();
    toast(`Versão ${update.version} instalada. Reiniciando…`, "ok");
    const { relaunch } = await import("@tauri-apps/plugin-process");
    setTimeout(() => relaunch(), 1200);
  } catch (e) {
    // sem internet ou sem release publicada: só avisa se foi pedido
    if (manual) toast(`Não consegui procurar atualizações: ${String(e)}`, "error");
  } finally {
    busy = false;
  }
}
