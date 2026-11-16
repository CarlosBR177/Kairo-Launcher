import { Check, Copy, ExternalLink, Loader2, LogIn, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, isTauri, on, type AccountView, type DeviceCode } from "../api";
import { useStore } from "../store";
import { Avatar } from "./Avatar";

async function openUrl(url: string) {
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank");
}

export function AccountsModal() {
  const { accounts, activeAccount, setAccounts, setAccountsOpen, boot, toast } = useStore();
  const [mode, setMode] = useState<"list" | "microsoft" | "offline">(accounts.length ? "list" : "microsoft");
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [nick, setNick] = useState("");
  const [copied, setCopied] = useState(false);
  const msAvailable = boot?.ms_login_available ?? false;

  useEffect(() => {
    if (!msAvailable && mode === "microsoft") setMode(accounts.length ? "list" : "offline");
  }, [msAvailable, mode, accounts.length]);

  useEffect(() => {
    const offs = [
      on<{ account: AccountView; accounts: AccountView[] }>("auth-done", (r) => {
        setAccounts(r.accounts, r.account.uuid);
        toast(`Bem-vindo, ${r.account.name}!`, "ok");
        setCode(null);
        setAccountsOpen(false);
      }),
      on<string>("auth-error", (msg) => {
        toast(msg, "error");
        setCode(null);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [setAccounts, setAccountsOpen, toast]);

  async function startMicrosoft() {
    try {
      const c = await api.msLoginStart();
      setCode(c);
      await navigator.clipboard?.writeText(c.user_code).catch(() => undefined);
      openUrl(c.verification_uri);
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function addOffline() {
    try {
      const acc = await api.addOffline(nick);
      setAccounts([...accounts.filter((a) => a.uuid !== acc.uuid), acc], acc.uuid);
      setNick("");
      setAccountsOpen(false);
    } catch (e) {
      toast(String(e), "error");
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setAccountsOpen(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Contas</h2>
          <button className="icon-btn" onClick={() => setAccountsOpen(false)}><X size={18} /></button>
        </div>

        <div className="segmented full">
          <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")} disabled={!accounts.length}>Minhas contas</button>
          <button className={mode === "microsoft" ? "on" : ""} onClick={() => setMode("microsoft")} disabled={!msAvailable} title={msAvailable ? "" : "Configure o Client ID do Azure (veja o README)"}>Microsoft</button>
          <button className={mode === "offline" ? "on" : ""} onClick={() => setMode("offline")}>Offline</button>
        </div>

        {mode === "list" && (
          <ul className="account-list">
            {accounts.map((a) => (
              <li key={a.uuid} className={a.uuid === activeAccount?.uuid ? "active" : ""}>
                <button className="account-pick" onClick={async () => { await api.selectAccount(a.uuid); setAccounts(accounts, a.uuid); }}>
                  <Avatar uuid={a.uuid} name={a.name} size={40} />
                  <span><b>{a.name}</b><small>{a.kind === "microsoft" ? "Conta Microsoft" : "Offline · servidores sem autenticação"}</small></span>
                  {a.uuid === activeAccount?.uuid && <Check size={18} className="accent" />}
                </button>
                <button className="icon-btn danger" title="Remover" onClick={async () => {
                  await api.removeAccount(a.uuid);
                  const rest = accounts.filter((x) => x.uuid !== a.uuid);
                  setAccounts(rest, a.uuid === activeAccount?.uuid ? rest[0]?.uuid ?? null : activeAccount?.uuid ?? null);
                }}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}

        {mode === "microsoft" && (
          <div className="ms-login">
            {!code ? (
              <>
                <p>Você vai entrar pela página oficial da Microsoft. O launcher nunca vê sua senha.</p>
                <button className="primary big" onClick={startMicrosoft}><LogIn size={18} /> Entrar com Microsoft</button>
              </>
            ) : (
              <>
                <p>Digite este código na página que abriu:</p>
                <button className="device-code" onClick={() => { navigator.clipboard?.writeText(code.user_code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {code.user_code} {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <button className="ghost" onClick={() => openUrl(code.verification_uri)}><ExternalLink size={15} /> Abrir {code.verification_uri.replace("https://", "")}</button>
                <p className="waiting"><Loader2 size={15} className="spin" /> Aguardando você confirmar…</p>
              </>
            )}
          </div>
        )}

        {mode === "offline" && (
          <div className="offline-login">
            <p>Conta sem login, para singleplayer e servidores em modo offline. Para servidores originais use Microsoft.</p>
            <div className="input-icon">
              <UserRound size={16} />
              <input autoFocus placeholder="Seu nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOffline()} />
            </div>
            <button className="primary" disabled={nick.trim().length < 3} onClick={addOffline}>Adicionar</button>
          </div>
        )}
      </div>
    </div>
  );
}
