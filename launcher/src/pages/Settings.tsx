import { Download, FolderOpen, Loader2, MemoryStick, MessageCircle, MonitorPlay, Rocket, Wrench } from "lucide-react";
import { checkForUpdate, useUpdate } from "../updater";
import { useEffect, useState } from "react";
import { api, type Settings as S } from "../api";
import { Toggle } from "../components/Toggle";
import { useStore } from "../store";

export function Settings() {
  const { settings, saveSettings, boot, toast } = useStore();
  const upd = useUpdate();
  const [s, setS] = useState<S | null>(settings);
  useEffect(() => setS(settings), [settings]);
  if (!s || !boot) return null;

  const total = boot.total_memory_mb || 8192;
  const maxRam = Math.max(2048, Math.floor((total * 0.75) / 512) * 512);
  const recommended = Math.min(8192, Math.max(3072, Math.floor(total / 4 / 512) * 512));

  function update(patch: Partial<S>) {
    const next = { ...s!, ...patch };
    setS(next);
    saveSettings(next).catch((e) => toast(String(e), "error"));
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Kairo Launcher {boot.version}</p>
        </div>
        <button className="ghost" onClick={() => api.openFolder(null)}><FolderOpen size={16} /> Pasta do launcher</button>
      </header>

      <section className="settings-card">
        <h3><MemoryStick size={18} /> Memória</h3>
        <div className="ram">
          <input type="range" min={1024} max={maxRam} step={512} value={s.ram_mb} onChange={(e) => setS({ ...s, ram_mb: Number(e.target.value) })} onPointerUp={() => update({ ram_mb: s.ram_mb })} onKeyUp={() => update({ ram_mb: s.ram_mb })} />
          <output>{(s.ram_mb / 1024).toFixed(1)} GB</output>
        </div>
        <p className="hint">Seu PC tem {(total / 1024).toFixed(0)} GB. Recomendado: {(recommended / 1024).toFixed(1)} GB. Mais RAM que o necessário pode piorar as pausas do coletor de lixo.</p>
      </section>

      <section className="settings-card">
        <h3><Rocket size={18} /> Desempenho do Java</h3>
        <div className="choice-row">
          <button className={`choice ${s.gc === "g1" ? "on" : ""}`} onClick={() => update({ gc: "g1" })}>
            <b>G1 otimizado</b>
            <small>Equilibrado, usa menos RAM. Recomendado.</small>
          </button>
          <button className={`choice ${s.gc === "zgc" ? "on" : ""}`} onClick={() => update({ gc: "zgc" })}>
            <b>ZGC geracional</b>
            <small>Quase sem travadinhas; pede ~1 GB a mais.</small>
          </button>
        </div>
        <div className="setting-line">
          <span><b>Instalar pacote de desempenho automaticamente</b><small>Em instâncias Fabric novas, no primeiro “Jogar”.</small></span>
          <Toggle on={s.auto_performance_pack} onChange={(v) => update({ auto_performance_pack: v })} />
        </div>
      </section>

      <section className="settings-card">
        <h3><MonitorPlay size={18} /> Janela do jogo</h3>
        <div className="row-3">
          <label className="field"><span>Largura</span><input type="number" value={s.width} onChange={(e) => setS({ ...s, width: Number(e.target.value) })} onBlur={() => update({})} /></label>
          <label className="field"><span>Altura</span><input type="number" value={s.height} onChange={(e) => setS({ ...s, height: Number(e.target.value) })} onBlur={() => update({})} /></label>
          <label className="field"><span>Ao abrir o jogo</span>
            <select value={s.after_launch} onChange={(e) => update({ after_launch: e.target.value as S["after_launch"] })}>
              <option value="minimize">Minimizar launcher</option>
              <option value="keep">Manter aberto</option>
              <option value="close">Fechar launcher</option>
            </select>
          </label>
        </div>
        <div className="setting-line">
          <span><b>Tela cheia</b></span>
          <Toggle on={s.fullscreen} onChange={(v) => update({ fullscreen: v })} />
        </div>
      </section>

      <section className="settings-card">
        <h3><MessageCircle size={18} /> Discord e atualizações</h3>
        <div className="setting-line first">
          <span>
            <b>Mostrar no Discord o que estou jogando</b>
            <small>{boot.discord_available ? "Aparece no seu perfil: instância, versão e servidor." : "Esta versão foi compilada sem o Application ID do Discord (KAIRO_DISCORD_APP_ID)."}</small>
          </span>
          <Toggle on={s.discord_rpc} disabled={!boot.discord_available} onChange={(v) => update({ discord_rpc: v })} />
        </div>
        <div className="setting-line">
          <span><b>Procurar atualizações ao abrir</b><small>Avisa quando sai uma versão nova do launcher (o mod vem junto). Você escolhe quando instalar.</small></span>
          <Toggle on={s.check_updates} onChange={(v) => update({ check_updates: v })} />
        </div>
        <div className="setting-line">
          <span><b>Versão {boot.version}</b></span>
          <button className="ghost small" disabled={upd.phase === "checking"} onClick={() => checkForUpdate(toast, true)}>{upd.phase === "checking" ? <><Loader2 size={14} className="spin" /> Procurando…</> : <><Download size={14} /> Procurar agora</>}</button>
        </div>
      </section>

      <section className="settings-card">
        <h3><Wrench size={18} /> Avançado</h3>
        <label className="field"><span>Argumentos extras da JVM</span>
          <input value={s.jvm_args} placeholder="-Dsodium.checks.issue2561=false" onChange={(e) => setS({ ...s, jvm_args: e.target.value })} onBlur={() => update({})} spellCheck={false} />
        </label>
        <label className="field"><span>Java personalizado (deixe vazio para o automático)</span>
          <input value={s.java_path ?? ""} placeholder="C:\\Program Files\\Java\\jdk-25\\bin\\javaw.exe" onChange={(e) => setS({ ...s, java_path: e.target.value || null })} onBlur={() => update({})} spellCheck={false} />
        </label>
        <div className="setting-line">
          <span><b>Mostrar snapshots</b><small>Versões de teste da Mojang ao criar instâncias.</small></span>
          <Toggle on={s.show_snapshots} onChange={(v) => update({ show_snapshots: v })} />
        </div>
        <p className="hint mono">{boot.data_dir}</p>
      </section>
    </div>
  );
}
