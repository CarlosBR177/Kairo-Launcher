import { AlertTriangle, ArrowRight, Check, Download, Gamepad2, PartyPopper, RotateCw, Sparkles, Wrench, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useStore } from "../store";
import { closeUpdate, installUpdate, useUpdate } from "../updater";
import { Logo } from "./TitleBar";

/**
 * Janela de atualização: mostra as novidades ANTES de atualizar, o botão "Atualizar agora",
 * o progresso do download e, depois de reiniciar, "Novidades da versão X".
 */
export function UpdateModal() {
  const u = useUpdate();
  const { boot, games } = useStore();
  const gameOpen = Object.values(games).some((g) => g.state === "running" || g.state === "installing");
  const busy = u.phase === "downloading" || u.phase === "installing" || u.phase === "done";
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null);

  // Esc fecha (menos durante o download)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) closeUpdate(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  if (!u.open) return null;
  const pct = u.total > 0 ? Math.min(100, (u.downloaded / u.total) * 100) : null;
  const eta = pct !== null && u.speed > 0 ? (u.total - u.downloaded) / u.speed : null;
  const celebrate = u.phase === "done" || u.phase === "whatsnew";

  const onUpdate = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - r.left, y: e.clientY - r.top, k: Date.now() });
    setTimeout(installUpdate, 260);
  };

  return (
    <div className="modal-backdrop update-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) closeUpdate(); }}>
      <div className={`modal update-modal phase-${u.phase}`}>
        <div className="update-border" aria-hidden />
        <div className="update-hero">
          <Particles />
          <div className="update-rings"><span /><span /><span /></div>
          {celebrate && <Confetti key={u.phase} />}
          <div className="update-logo">
            {u.phase === "done" ? <Check size={36} strokeWidth={3} />
              : u.phase === "whatsnew" ? <PartyPopper size={34} />
              : u.phase === "error" ? <AlertTriangle size={32} />
              : <Logo size={40} />}
            {(u.phase === "downloading" || u.phase === "installing") && <svg className="update-orbit" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" /></svg>}
          </div>
        </div>

        <div className="update-head" key={u.phase}>
          {u.phase === "done" ? (
            <><h2>Tudo pronto!</h2><p>Reiniciando o Kairo na versão {u.version}…</p></>
          ) : u.phase === "installing" ? (
            <><h2>Instalando<Dots /></h2><p>O launcher vai fechar e abrir de novo sozinho.</p></>
          ) : u.phase === "downloading" ? (
            <><h2>Baixando a versão {u.version}</h2><p>{pct === null ? formatBytes(u.downloaded) : `${formatBytes(u.downloaded)} de ${formatBytes(u.total)}`}{u.speed > 0 && ` · ${formatBytes(u.speed)}/s`}{eta !== null && ` · ${formatEta(eta)}`}</p></>
          ) : u.phase === "error" ? (
            <><h2>A atualização falhou</h2><p className="update-error">{u.error}</p></>
          ) : u.phase === "whatsnew" ? (
            <>
              <span className="update-badge ok"><Check size={13} strokeWidth={3} /> Atualizado</span>
              <h2 className="update-title">Novidades da {u.version}</h2>
              <p>Valeu por manter o Kairo em dia. Olha o que mudou:</p>
            </>
          ) : (
            <>
              <span className="update-badge"><Sparkles size={13} /> Nova versão disponível</span>
              <h2 className="update-title">Kairo {u.version}</h2>
              <div className="update-versions">
                <span className="v-old">{boot?.version ?? "atual"}</span>
                <span className="v-arrow"><ArrowRight size={14} /></span>
                <span className="v-new">{u.version}</span>
              </div>
              {u.date && <p className="update-date">Publicada {formatDate(u.date)}</p>}
            </>
          )}
        </div>

        {(u.phase === "downloading" || u.phase === "installing" || u.phase === "done") && (
          <>
            <div className={`update-progress2 ${pct === null || u.phase !== "downloading" ? "indeterminate" : ""} ${u.phase === "done" ? "complete" : ""}`}>
              <span style={pct !== null && u.phase === "downloading" ? { width: `${pct}%` } : undefined}><i /></span>
            </div>
            {pct !== null && u.phase === "downloading" && <div className="update-pct">{Math.floor(pct)}<small>%</small></div>}
            <ol className="update-steps">
              <Step on={u.phase === "downloading"} ok={u.phase !== "downloading"}>Baixar</Step>
              <Step on={u.phase === "installing"} ok={u.phase === "done"}>Instalar</Step>
              <Step on={u.phase === "done"} ok={false}>Reiniciar</Step>
            </ol>
          </>
        )}

        {(u.phase === "available" || u.phase === "error" || u.phase === "whatsnew") && (
          <>
            {u.notes.trim()
              ? <div className="update-notes2"><Notes text={u.notes} /></div>
              : u.phase !== "error" && <p className="update-nonotes">Melhorias e correções gerais.</p>}
            {gameOpen && u.phase !== "whatsnew" && (
              <p className="update-warn"><Gamepad2 size={15} /> Feche o Minecraft para atualizar. A atualização reinicia o launcher.</p>
            )}
            <div className="modal-actions update-actions">
              {u.phase === "whatsnew" ? (
                <button className="update-cta" onClick={closeUpdate}><Zap size={16} /> Bora jogar</button>
              ) : (
                <>
                  <button className="ghost" onClick={closeUpdate}>Depois</button>
                  <button className="update-cta" disabled={gameOpen} onClick={onUpdate}>
                    {ripple && <span className="cta-ripple" key={ripple.k} style={{ left: ripple.x, top: ripple.y }} />}
                    {u.phase === "error" ? <><RotateCw size={16} /> Tentar de novo</> : <><Download size={16} className="cta-icon" /> Atualizar agora</>}
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {u.phase === "error" && <p className="update-foot"><AlertTriangle size={13} /> Se continuar, baixe o Kairo-Setup.exe novo na página de releases do GitHub.</p>}
      </div>
    </div>
  );
}

function Step({ on, ok, children }: { on: boolean; ok: boolean; children: ReactNode }) {
  return <li className={`${on ? "on" : ""} ${ok ? "ok" : ""}`}><b>{ok ? <Check size={11} strokeWidth={3.5} /> : null}</b>{children}</li>;
}

function Dots() {
  return <span className="update-dots"><i>.</i><i>.</i><i>.</i></span>;
}

/** Faíscas subindo atrás do logo. */
function Particles() {
  const items = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    left: 6 + Math.random() * 88,
    size: 2 + Math.random() * 4,
    delay: -Math.random() * 4,
    dur: 2.6 + Math.random() * 2.6,
    drift: (Math.random() - 0.5) * 60,
    key: i,
  })), []);
  return (
    <div className="update-particles" aria-hidden>
      {items.map((p) => (
        <span key={p.key} style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ["--drift" as string]: `${p.drift}px` }} />
      ))}
    </div>
  );
}

/** Explosão de confete (versão instalada / novidades). */
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 34 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 110;
    return {
      key: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 30,
      r: Math.random() * 720 - 360,
      hue: i % 3,
      delay: Math.random() * 0.15,
    };
  }), []);
  return (
    <div className="update-confetti" aria-hidden>
      {pieces.map((p) => (
        <span key={p.key} className={`c${p.hue}`} style={{ ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`, ["--r" as string]: `${p.r}deg`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

/** Markdown bem simples das notas da release: ## títulos, - listas e texto. */
function Notes({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  let n = 0; // atraso em cascata entre os itens
  const flush = () => {
    if (list.length) out.push(<ul key={out.length}>{list.map((l, i) => <li key={i} style={{ animationDelay: `${0.25 + n++ * 0.06}s` }}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, "")); continue; }
    flush();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) {
      const title = line.replace(/^#{1,6}\s+/, "");
      const fix = /corre|fix|bug/i.test(title);
      out.push(<h4 key={out.length} className={fix ? "fix" : "new"} style={{ animationDelay: `${0.2 + n++ * 0.06}s` }}>{fix ? <Wrench size={13} /> : <Sparkles size={13} />}{title}</h4>);
    } else out.push(<p key={out.length} style={{ animationDelay: `${0.2 + n++ * 0.06}s` }}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

function inline(s: string): ReactNode {
  // **negrito** e `código`; o resto vai como texto (sem HTML)
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b>
      : part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code>
      : part,
  );
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatEta(s: number) {
  if (s < 1) return "quase lá";
  if (s < 60) return `${Math.ceil(s)} s restantes`;
  return `${Math.ceil(s / 60)} min restantes`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `em ${d.toLocaleDateString("pt-BR")}`;
}
