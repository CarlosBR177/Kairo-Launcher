import { Download, Gauge, Loader2, Lock, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type LocalMod, type SearchHit } from "../api";
import { Toggle } from "../components/Toggle";
import { formatCount, useStore } from "../store";

const SORTS = [
  { id: "relevance", label: "Relevância" },
  { id: "downloads", label: "Mais baixados" },
  { id: "updated", label: "Atualizados" },
  { id: "newest", label: "Novos" },
];

export function Mods() {
  const { selected, toast } = useStore();
  const [tab, setTab] = useState<"installed" | "browse">("installed");
  const [mods, setMods] = useState<LocalMod[]>([]);
  const [filter, setFilter] = useState("");
  const [busyPack, setBusyPack] = useState(false);

  const refresh = useCallback(() => {
    if (selected) api.modsList(selected.id).then(setMods).catch((e) => toast(String(e), "error"));
  }, [selected, toast]);
  useEffect(refresh, [refresh]);

  if (!selected) return <div className="page"><p>Crie uma instância primeiro.</p></div>;
  if (!selected.loader) {
    return (
      <div className="page">
        <header className="page-head"><div><h1>Mods</h1><p>“{selected.name}” é vanilla. Crie uma instância Fabric para usar mods.</p></div></header>
      </div>
    );
  }

  const shown = mods.filter((m) => (m.name + m.id).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Mods</h1>
          <p>{selected.name} · Fabric {selected.game_version}</p>
        </div>
        <div className="segmented">
          <button className={tab === "installed" ? "on" : ""} onClick={() => setTab("installed")}>Instalados ({mods.length})</button>
          <button className={tab === "browse" ? "on" : ""} onClick={() => setTab("browse")}>Explorar</button>
        </div>
      </header>

      {tab === "installed" ? (
        <>
          <div className="perf-banner">
            <Gauge size={22} />
            <div>
              <b>Pacote de desempenho</b>
              <span>Sodium, Lithium, FerriteCore, ImmediatelyFast, EntityCulling e ModernFix.</span>
            </div>
            <button className="primary small" disabled={busyPack} onClick={async () => {
              setBusyPack(true);
              try {
                const r = await api.performancePack(selected.id);
                toast(`${r.installed.length} instalados/atualizados${r.skipped.length ? `, ${r.skipped.length} já ok ou indisponíveis` : ""}`, "ok");
                refresh();
              } catch (e) { toast(String(e), "error"); }
              setBusyPack(false);
            }}>{busyPack ? <Loader2 size={14} className="spin" /> : "Instalar / atualizar"}</button>
          </div>

          <div className="input-icon wide">
            <Search size={16} />
            <input placeholder="Filtrar mods instalados" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>

          <ul className="mod-list">
            {shown.map((m) => (
              <li key={m.file} className={m.enabled ? "" : "off"}>
                <div className="mod-icon">{m.name.slice(0, 1).toUpperCase()}</div>
                <div className="mod-text">
                  <b>{m.name} <small>{m.version}</small>{m.builtin && <span className="tag">Kairo</span>}</b>
                  <span>{m.description || m.file}</span>
                </div>
                {m.builtin ? (
                  <span className="locked" title="Mod do próprio client"><Lock size={14} /></span>
                ) : (
                  <>
                    <Toggle on={m.enabled} label={`Ativar ${m.name}`} onChange={async (v) => {
                      try { await api.modsToggle(selected.id, m.file, v); refresh(); } catch (e) { toast(String(e), "error"); }
                    }} />
                    <button className="icon-btn danger" title="Remover" onClick={async () => {
                      try { await api.modsRemove(selected.id, m.file); refresh(); } catch (e) { toast(String(e), "error"); }
                    }}><Trash2 size={16} /></button>
                  </>
                )}
              </li>
            ))}
            {!shown.length && <li className="empty">Nenhum mod aqui ainda. Use “Explorar”.</li>}
          </ul>
        </>
      ) : (
        <Browse instanceId={selected.id} installedIds={new Set(mods.map((m) => m.id))} onInstalled={refresh} />
      )}
    </div>
  );
}

function Browse({ instanceId, installedIds, onInstalled }: { instanceId: string; installedIds: Set<string>; onInstalled: () => void }) {
  const { toast } = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevance");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<Record<string, "busy" | "done">>({});
  const timer = useRef<number>(undefined);

  const load = useCallback(async (q: string, s: string, offset: number) => {
    setLoading(true);
    try {
      const r = await api.modsSearch(instanceId, q, offset, s);
      setHits((h) => (offset === 0 ? r.hits : [...h, ...r.hits]));
      setTotal(r.total_hits);
    } catch (e) {
      toast(String(e), "error");
    }
    setLoading(false);
  }, [instanceId, toast]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => load(query, sort, 0), 300);
    return () => window.clearTimeout(timer.current);
  }, [query, sort, load]);

  return (
    <>
      <div className="browse-bar">
        <div className="input-icon wide">
          <Search size={16} />
          <input placeholder="Buscar no Modrinth (ex.: minimap, shaders, zoom)" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          {loading && <Loader2 size={16} className="spin" />}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className="hit-grid">
        {hits.map((h) => {
          const state = installing[h.project_id];
          const already = installedIds.has(h.slug) || state === "done";
          return (
            <article key={h.project_id} className="hit">
              {h.icon_url ? <img src={h.icon_url} alt="" loading="lazy" /> : <div className="mod-icon">{h.title.slice(0, 1)}</div>}
              <div className="hit-text">
                <b>{h.title}</b>
                <small>por {h.author} · {formatCount(h.downloads)} downloads</small>
                <p>{h.description}</p>
              </div>
              <button className={already ? "ghost small" : "primary small"} disabled={already || state === "busy"} onClick={async () => {
                setInstalling((s) => ({ ...s, [h.project_id]: "busy" }));
                try {
                  const r = await api.modsInstall(instanceId, h.project_id);
                  toast(`${h.title} instalado${r.installed.length > 1 ? ` (+${r.installed.length - 1} dependências)` : ""}`, "ok");
                  setInstalling((s) => ({ ...s, [h.project_id]: "done" }));
                  onInstalled();
                } catch (e) {
                  toast(String(e), "error");
                  setInstalling((s) => { const n = { ...s }; delete n[h.project_id]; return n; });
                }
              }}>
                {state === "busy" ? <Loader2 size={14} className="spin" /> : already ? "Instalado" : <><Download size={14} /> Instalar</>}
              </button>
            </article>
          );
        })}
      </div>
      {hits.length < total && (
        <button className="ghost load-more" disabled={loading} onClick={() => load(query, sort, hits.length)}>Carregar mais</button>
      )}
      <p className="credit">Mods fornecidos pela API pública do Modrinth.</p>
    </>
  );
}
