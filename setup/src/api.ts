// Ponte com o backend (Rust). Fora do Tauri (npm run dev) simula tudo para ver as telas.
import { invoke } from "@tauri-apps/api/core";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface SetupInfo {
  version: string;
  default_dir: string;
  /** Já existe um Kairo Launcher instalado na pasta padrão. */
  installed: boolean;
  /** O instalador NSIS foi embutido na compilação. */
  payload_ok: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);

export const api = {
  async info(): Promise<SetupInfo> {
    if (isTauri) return invoke("info");
    return { version: "0.1.0", default_dir: "C:\\Users\\Carlos\\AppData\\Local\\Kairo Launcher", installed: params.has("update"), payload_ok: true };
  },
  async pickDir(current: string): Promise<string | null> {
    if (!isTauri) return current;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const res = await open({ directory: true, defaultPath: current, title: "Escolha onde instalar o Kairo" });
    return typeof res === "string" ? res : null;
  },
  async install(dir: string, desktopShortcut: boolean): Promise<void> {
    if (isTauri) return invoke("install", { dir, desktopShortcut });
    await wait(params.has("slow") ? 60_000 : 6500);
    if (params.has("fail")) throw "O instalador terminou com código 2. Feche o Kairo Launcher se ele estiver aberto e tente de novo.";
  },
  async launch(dir: string): Promise<void> {
    if (isTauri) return invoke("launch", { dir });
  },
  async minimize() {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  },
  async close() {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  },
};
