import { Plus, RefreshCw, Server, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type Instance, type ServerStatus } from "../api";
import { useStore } from "../store";

/** Servidores fixados na tela inicial, com ping ao vivo (atualiza a cada 30 s). */
export function ServerList({ instance }: { instance: Instance }) {
  const { settings, saveSettings, activeAccount, setAccountsOpen, toast, games } = useStore();
  const favorites = settings?.favorite_servers ?? [];
  const [status, setStatus] = useState<Record<string, ServerStatus>>({});
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const key = favorites.map((f) => f.address).join("|");

  const refresh = useCallback(async () => {
    if (favorites.length === 0) return;
    setLoading(true);
    try {
      const list = await api.serversPing(favorites.map((f) => f.address));
      setStatus(Object.fromEntries(list.map((s) => [s.address, s])));
    } catch {
      /* sem rede: mantém o último resultado */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function save(next: typeof favorites) {
    if (!settings) return;
    await saveSettings({ ...settings, favorite_servers: next }).catch((e) => toast(String(e), "error"));
  }

  async function add() {
    const a = address.trim();
    if (!a) return;
    if (favorites.some((f) => f.address.toLowerCase() === a.toLowerCase())) {
      toast("Esse servidor já está na lista", "info");
      return;
    }
    await save([...favorites, { name: name.trim() || a, address: a }]);
    setName("");
    setAddress("");
    setAdding(false);
  }

  async function play(addr: string) {
    if (!activeAccount) {
      setAccountsOpen(true);
      toast("Adicione uma conta para jogar", "info");
      return;
    }
    if (games[instance.id]?.state === "running" || games[instance.id]?.state === "installing") {
      toast("Essa instância já está aberta", "info");
      return;
    }
    try {
      await api.launch(instance.id, addr);
    } catch (e) {
      toast(String(e), "error");
    }
  }

  return (
    <section className="shelf servers">
      <div className="shelf-head">
        <h3>Servidores</h3>
        <div className="row-gap">
          {favorites.length > 0 && (
            <button className="ghost small" onClick={refresh} disabled={loading} title="Atualizar ping">
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          )}
          <button className="ghost small" onClick={() => setAdding((v) => !v)}>{adding ? <X size={14} /> : <Plus size={14} />} {adding ? "Cancelar" : "Adicionar"}</button>
        </div>
      </div>

      {adding && (
        <form className="server-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input placeholder="Nome (opcional)" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          <input placeholder="ip.do.servidor:25565" value={address} onChange={(e) => setAddress(e.target.value)} spellCheck={false} autoFocus />
          <button className="primary small" type="submit" disabled={!address.trim()}>Salvar</button>
        </form>
      )}

      {favorites.length === 0 && !adding ? (
        <p className="hint">Fixe os servidores que você mais joga para ver o ping e entrar com um clique.</p>
      ) : (
        <div className="shelf-row">
          {favorites.map((f) => {
            const s = status[f.address];
            const ping = s?.ping_ms ?? null;
            const quality = !s ? "wait" : !s.online ? "off" : ping === null ? "mid" : ping < 80 ? "good" : ping < 160 ? "mid" : "bad";
            return (
              <div key={f.address} className="server-card">
                <div className="server-top">
                  {s?.favicon ? <img src={s.favicon} alt="" className="server-icon" /> : <span className="server-icon fallback"><Server size={18} /></span>}
                  <span className="server-meta">
                    <b title={f.name}>{f.name}</b>
                    <small className="mono" title={f.address}>{f.address}</small>
                  </span>
                  <span className={`ping ${quality}`} title={s?.error ?? (ping !== null ? `${ping} ms` : "")}>
                    <i /><i /><i />
                    <em>{!s ? "…" : !s.online ? "offline" : ping !== null ? `${ping}ms` : "online"}</em>
                  </span>
                </div>
                <p className="server-motd" title={s?.motd ?? ""}>{s?.online ? s.motd ?? s.version ?? "" : s?.error ?? "Verificando…"}</p>
                <div className="server-actions">
                  {s?.online && s.players_online !== null && (
                    <span className="players"><Users size={13} /> {s.players_online}/{s.players_max}</span>
                  )}
                  <span className="row-gap right">
                    <button className="icon-btn danger" title="Remover" onClick={() => save(favorites.filter((x) => x.address !== f.address))}><Trash2 size={15} /></button>
                    <button className="primary small" onClick={() => play(f.address)}>Jogar aqui</button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
