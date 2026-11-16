import { Minus, Square, X } from "lucide-react";
import { isTauri } from "../api";
import { useStore } from "../store";
import { Avatar } from "./Avatar";

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function TitleBar() {
  const { activeAccount, setAccountsOpen } = useStore();
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <Logo />
        <span data-tauri-drag-region>KAIRO</span>
      </div>
      <div className="titlebar-right">
        <button className="account-chip" onClick={() => setAccountsOpen(true)}>
          {activeAccount ? (
            <>
              <Avatar uuid={activeAccount.uuid} name={activeAccount.name} size={26} />
              <span>{activeAccount.name}</span>
              <em>{activeAccount.kind === "microsoft" ? "Microsoft" : "Offline"}</em>
            </>
          ) : (
            <span>Entrar</span>
          )}
        </button>
        {isTauri && (
          <div className="window-controls">
            <button aria-label="Minimizar" onClick={async () => (await win()).minimize()}><Minus size={14} /></button>
            <button aria-label="Maximizar" onClick={async () => (await win()).toggleMaximize()}><Square size={12} /></button>
            <button aria-label="Fechar" className="close" onClick={async () => (await win()).close()}><X size={15} /></button>
          </div>
        )}
      </div>
    </header>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  // "K" com duas pernas em lâmina e o losango na cor de destaque (branding/kairo-mark.svg)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x="8" y="8" width="11" height="48" rx="1.5" fill="currentColor" />
      <polygon points="30,24 46,8 58,8 36,30" fill="currentColor" />
      <polygon points="30,40 46,56 58,56 36,34" fill="currentColor" />
      <polygon points="28,26 34,32 28,38 22,32" fill="var(--accent)" />
    </svg>
  );
}
