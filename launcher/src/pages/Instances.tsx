import { FolderOpen, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, type Instance } from "../api";
import { Cover } from "../components/Cover";
import { InstanceModal } from "../components/InstanceModal";
import { formatAgo, formatPlaytime, loaderLabel, useStore } from "../store";

export function Instances() {
  const { instances, selected, selectInstance, removeInstance, setPage, toast } = useStore();
  const [editing, setEditing] = useState<Instance | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<string | null>(null);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Instâncias</h1>
          <p>Cada instância tem seus próprios mods, mundos e configurações.</p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}><Plus size={16} /> Nova instância</button>
      </header>

      <div className="instance-grid">
        {instances.map((i) => (
          <article key={i.id} className={`instance-card ${selected?.id === i.id ? "active" : ""}`}>
            <div className="instance-art" onClick={() => selectInstance(i.id)}>
              <Cover cover={i.cover} seed={i.id} />
              <span className="badge">{loaderLabel(i)}</span>
            </div>
            <div className="instance-body">
              <h3>{i.name}</h3>
              <p>{formatPlaytime(i.play_seconds)} · {formatAgo(i.last_played)}</p>
            </div>
            <div className="instance-actions">
              <button className="primary small" onClick={() => { selectInstance(i.id); setPage("home"); }}><Play size={14} fill="currentColor" /> Abrir</button>
              <button className="icon-btn" title="Editar" onClick={() => setEditing(i)}><Pencil size={16} /></button>
              <button className="icon-btn" title="Pasta" onClick={() => api.openFolder(i.id)}><FolderOpen size={16} /></button>
              {confirm === i.id ? (
                <button className="danger small" onClick={async () => {
                  try { await api.deleteInstance(i.id); removeInstance(i.id); toast("Instância apagada", "ok"); } catch (e) { toast(String(e), "error"); }
                  setConfirm(null);
                }}>Apagar mesmo?</button>
              ) : (
                <button className="icon-btn danger" title="Apagar" onClick={() => setConfirm(i.id)}><Trash2 size={16} /></button>
              )}
            </div>
          </article>
        ))}
        <button className="instance-card new" onClick={() => setEditing(null)}>
          <Plus size={28} />
          <span>Nova instância</span>
        </button>
      </div>
      {editing !== undefined && <InstanceModal instance={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
