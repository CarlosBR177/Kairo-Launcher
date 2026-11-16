import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Instance, type VersionInfo } from "../api";
import { useStore } from "../store";
import { COVERS, Cover, type CoverKey } from "./Cover";

/** Criar (instance = null) ou editar uma instância. */
export function InstanceModal({ instance, onClose }: { instance: Instance | null; onClose: () => void }) {
  const { settings, upsertInstance, selectInstance, toast } = useStore();
  const [name, setName] = useState(instance?.name ?? "Minha instância");
  const [cover, setCover] = useState<string>(instance?.cover ?? "aurora");
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [version, setVersion] = useState(instance?.game_version ?? "");
  const [fabric, setFabric] = useState(instance ? instance.loader !== null : true);
  const [ram, setRam] = useState<number | null>(instance?.ram_mb ?? null);
  const [busy, setBusy] = useState(false);
  const editing = instance !== null;

  useEffect(() => {
    if (editing) return;
    api.listVersions(settings?.show_snapshots ?? false).then((v) => {
      setVersions(v);
      setVersion((cur) => cur || v[0]?.id || "");
    }).catch((e) => toast(String(e), "error"));
  }, [editing, settings?.show_snapshots, toast]);

  const selectedInfo = versions.find((v) => v.id === version);
  const fabricAvailable = editing || (selectedInfo?.fabric ?? false);

  async function submit() {
    setBusy(true);
    try {
      if (editing) {
        const updated = { ...instance, name: name.trim() || instance.name, cover, ram_mb: ram };
        await api.updateInstance(updated);
        upsertInstance(updated);
      } else {
        const created = await api.createInstance(name.trim() || "Instância", version, fabric && fabricAvailable, cover);
        upsertInstance(created);
        selectInstance(created.id);
      }
      onClose();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-cover">
          <Cover cover={cover} seed={instance?.id ?? name} />
          <button className="icon-btn modal-close" onClick={onClose}><X size={18} /></button>
          <h2>{editing ? "Editar instância" : "Nova instância"}</h2>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </label>

          {!editing && (
            <div className="row-2">
              <label className="field">
                <span>Versão do Minecraft</span>
                <select value={version} onChange={(e) => setVersion(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.id}{v.kind !== "release" ? ` (${v.kind})` : ""}</option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Loader</span>
                <div className="segmented">
                  <button className={fabric && fabricAvailable ? "on" : ""} disabled={!fabricAvailable} onClick={() => setFabric(true)}>Fabric + Kairo</button>
                  <button className={!fabric || !fabricAvailable ? "on" : ""} onClick={() => setFabric(false)}>Vanilla</button>
                </div>
              </div>
            </div>
          )}
          {!editing && !fabricAvailable && version && <p className="hint">O Fabric ainda não suporta {version}; será vanilla.</p>}

          <div className="field">
            <span>Capa</span>
            <div className="cover-picker">
              {(Object.keys(COVERS) as CoverKey[]).map((k) => (
                <button key={k} className={cover === k ? "on" : ""} onClick={() => setCover(k)} title={COVERS[k].name}>
                  <Cover cover={k} seed="picker" />
                  <span>{COVERS[k].name}</span>
                </button>
              ))}
            </div>
          </div>

          {editing && (
            <label className="field">
              <span>Memória desta instância {ram ? `· ${(ram / 1024).toFixed(1)} GB` : "· padrão dos Ajustes"}</span>
              <div className="ram-row">
                <input type="range" min={1024} max={16384} step={512} value={ram ?? settings?.ram_mb ?? 4096} onChange={(e) => setRam(Number(e.target.value))} />
                <button className="ghost small" onClick={() => setRam(null)}>Usar padrão</button>
              </div>
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={busy || (!editing && !version)} onClick={submit}>
            {editing ? "Salvar" : "Criar instância"}
          </button>
        </div>
      </div>
    </div>
  );
}
