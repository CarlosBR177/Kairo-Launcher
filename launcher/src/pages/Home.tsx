import { Clock3, FolderOpen, Keyboard, Plus, Server, Timer, Blocks } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Instance } from "../api";
import { Cover } from "../components/Cover";
import { InstanceModal } from "../components/InstanceModal";
import { PlayButton } from "../components/PlayButton";
import { ServerList } from "../components/ServerList";
import { kairoSupports } from "../modules";
import { formatAgo, formatPlaytime, loaderLabel, useStore } from "../store";

export function Home() {
  const { selected, instances, selectInstance, games } = useStore();
  const [modsCount, setModsCount] = useState<number | null>(null);
  const [useServer, setUseServer] = useState(false);
  const [server, setServer] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setServer(selected.last_server ?? "");
    setUseServer(Boolean(selected.last_server));
    api.modsList(selected.id).then((m) => setModsCount(m.filter((x) => x.enabled).length)).catch(() => setModsCount(null));
  }, [selected?.id, selected?.last_server]);

  if (!selected) {
    return (
      <div className="empty-state">
        <h1>Bem-vindo ao Kairo</h1>
        <p>Crie sua primeira instância para começar.</p>
        <button className="primary big" onClick={() => setCreating(true)}><Plus size={18} /> Nova instância</button>
        {creating && <InstanceModal instance={null} onClose={() => setCreating(false)} />}
      </div>
    );
  }

  return (
    <div className="home">
      <section className="hero" key={selected.id}>
        <Cover cover={selected.cover} seed={selected.id} className="hero-art" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow">{loaderLabel(selected)}</span>
          <h1>{selected.name}</h1>
          <div className="stats">
            <span><Timer size={15} /> {formatPlaytime(selected.play_seconds)} jogadas</span>
            <span><Clock3 size={15} /> {formatAgo(selected.last_played)}</span>
            {modsCount !== null && <span><Blocks size={15} /> {modsCount} {modsCount === 1 ? "mod ativo" : "mods ativos"}</span>}
          </div>

          <div className="play-row">
            <PlayButton instance={selected} server={useServer && server.trim() ? server.trim() : null} />
            <div className={`quickplay ${useServer ? "on" : ""}`}>
              <button className="qp-toggle" onClick={() => setUseServer((v) => !v)} title="Entrar direto num servidor ao abrir">
                <Server size={16} />
              </button>
              {useServer ? (
                <input placeholder="ip.do.servidor:25565" value={server} onChange={(e) => setServer(e.target.value)} spellCheck={false} />
              ) : (
                <span className="qp-hint">Entrar direto num servidor</span>
              )}
            </div>
            <button className="icon-btn glass" title="Abrir pasta da instância" onClick={() => api.openFolder(selected.id)}>
              <FolderOpen size={18} />
            </button>
          </div>

          {selected.loader && kairoSupports(selected.game_version) && (
            <div className="keyhints">
              <Keyboard size={14} />
              <span><kbd>Shift dir.</kbd> menu do Kairo</span>
              <span><kbd>Alt</kbd> freelook</span>
              <span><kbd>C</kbd> zoom</span>
            </div>
          )}
          {!kairoSupports(selected.game_version) && (
            <p className="keyhints no-kairo">
              Esta instância ({selected.game_version}) abre sem o Kairo Client. Crie uma instância 1.21.1 ou mais nova para ter o menu, a HUD e os módulos.
            </p>
          )}
        </div>
      </section>

      <ServerList instance={selected} />

      <section className="shelf">
        <div className="shelf-head">
          <h3>Instâncias</h3>
          <button className="ghost small" onClick={() => setCreating(true)}><Plus size={14} /> Nova</button>
        </div>
        <div className="shelf-row">
          {instances.map((i: Instance) => (
            <button key={i.id} className={`shelf-card ${i.id === selected.id ? "active" : ""}`} onClick={() => selectInstance(i.id)}>
              <Cover cover={i.cover} seed={i.id} />
              <span className="shelf-meta">
                <b>{i.name}</b>
                <small>{loaderLabel(i)}</small>
              </span>
              {games[i.id]?.state === "running" && <i className="live-dot" />}
            </button>
          ))}
        </div>
      </section>
      {creating && <InstanceModal instance={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
