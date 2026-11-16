import { AlertTriangle, Check, Download, Gamepad2, RotateCw, Sparkles } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useStore } from "../store";
import { closeUpdate, installUpdate, useUpdate } from "../updater";
import { Logo } from "./TitleBar";

/** Janela de atualização: novidades, "Atualizar agora"/"Depois" e progresso do download. */
export function UpdateModal() {
  const u = useUpdate();
  const { boot, games } = useStore();
  const gameOpen = Object.values(games).some((g) => g.state === "running" || g.state === "installing");
  const busy = u.phase === "downloading" || u.phase === "installing" || u.phase === "done";

  // Esc fecha (menos durante o download)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) closeUpdate(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  if (!u.open) return null;
  const pct = u.total > 0 ? Math.min(100, Math.round((u.downloaded / u.total) * 100)) : null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) closeUpdate(); }}>
      <div className={`modal update-modal phase-${u.phase}`}>
        <div className="update-hero">
          <div className="update-rings"><span /><span /><span /></div>
          <div className="update-logo">
            {u.phase === "done" ? <Check size={34} strokeWidth={3} /> : <Logo size={40} />}
          </div>
        </div>

        <div className="update-head">
          {u.phase === "done" ? (
            <><h2>Tudo pronto!</h2><p>Reiniciando o Kairo na versão {u.version}…</p></>
          ) : u.phase === "installing" ? (
            <><h2>Instalando…</h2><p>Só um instante, o launcher vai reiniciar sozinho.</p></>
          ) : u.phase === "downloading" ? (
            <><h2>Baixando a versão {u.version}</h2><p>{pct === null ? formatBytes(u.downloaded) : `${formatBytes(u.downloaded)} de ${formatBytes(u.total)}`}</p></>
          ) : u.phase === "error" ? (
            <><h2>A atualização falhou</h2><p className="update-error">{u.error}</p></>
          ) : (
            <>
              <span className="update-badge"><Sparkles size={13} /> Nova versão</span>
              <h2>Kairo {u.version}</h2>
              <p>Você está na {boot?.version ?? "versão atual"}{u.date ? ` · publicada ${formatDate(u.date)}` : ""}</p>
            </>
          )}
        </div>

        {(u.phase === "downloading" || u.phase === "installing" || u.phase === "done") && (
          <div className={`update-progress ${pct === null || u.phase !== "downloading" ? "indeterminate" : ""} ${u.phase === "done" ? "complete" : ""}`}>
            <span style={pct !== null && u.phase === "downloading" ? { width: `${pct}%` } : undefined} />
            {pct !== null && u.phase === "downloading" && <em>{pct}%</em>}
          </div>
        )}

        {(u.phase === "available" || u.phase === "error") && (
          <>
            {u.notes.trim() && <div className="update-notes"><Notes text={u.notes} /></div>}
            {gameOpen && (
              <p className="update-warn"><Gamepad2 size={15} /> Feche o Minecraft para atualizar. A atualização reinicia o launcher.</p>
            )}
            <div className="modal-actions update-actions">
              <button className="ghost" onClick={closeUpdate}>Depois</button>
              <button className="primary" disabled={gameOpen} onClick={installUpdate}>
                {u.phase === "error" ? <><RotateCw size={15} /> Tentar de novo</> : <><Download size={15} /> Atualizar agora</>}
              </button>
            </div>
          </>
        )}
        {u.phase === "error" && <p className="update-foot"><AlertTriangle size={13} /> Se continuar, baixe o instalador novo na página de releases do GitHub.</p>}
      </div>
    </div>
  );
}

/** Markdown bem simples das notas da release: ## títulos, - listas e texto. */
function Notes({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={out.length}>{list.map((l, i) => <li key={i} style={{ animationDelay: `${0.15 + i * 0.05}s` }}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, "")); continue; }
    flush();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) out.push(<h4 key={out.length}>{line.replace(/^#{1,6}\s+/, "")}</h4>);
    else out.push(<p key={out.length}>{inline(line)}</p>);
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

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `em ${d.toLocaleDateString("pt-BR")}`;
}
