import { Copy, Eraser } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";

function level(line: string): "error" | "warn" | "info" {
  if (/ERROR|FATAL|Exception|Caused by/.test(line)) return "error";
  if (/WARN/.test(line)) return "warn";
  return "info";
}

export function Console() {
  const { logs, clearLogs, instances, selected, toast } = useStore();
  const [only, setOnly] = useState<"all" | "warn" | "error">("all");
  const [instance, setInstance] = useState<string>(selected?.id ?? "");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => logs.filter((l) => {
    if (instance && l.instance !== instance) return false;
    const lv = level(l.line);
    return only === "all" || (only === "warn" ? lv !== "info" : lv === "error");
  }), [logs, only, instance]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, follow]);

  return (
    <div className="page console-page">
      <header className="page-head">
        <div>
          <h1>Console</h1>
          <p>Saída do jogo em tempo real. Útil para descobrir qual mod causou um crash.</p>
        </div>
        <div className="console-tools">
          <select value={instance} onChange={(e) => setInstance(e.target.value)}>
            <option value="">Todas as instâncias</option>
            {instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <div className="segmented">
            <button className={only === "all" ? "on" : ""} onClick={() => setOnly("all")}>Tudo</button>
            <button className={only === "warn" ? "on" : ""} onClick={() => setOnly("warn")}>Avisos</button>
            <button className={only === "error" ? "on" : ""} onClick={() => setOnly("error")}>Erros</button>
          </div>
          <button className="icon-btn" title="Copiar" onClick={() => { navigator.clipboard.writeText(lines.map((l) => l.line).join("\n")); toast("Log copiado", "ok"); }}><Copy size={16} /></button>
          <button className="icon-btn" title="Limpar" onClick={clearLogs}><Eraser size={16} /></button>
        </div>
      </header>
      <div className="console" ref={box} onScroll={(e) => {
        const el = e.currentTarget;
        setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
      }}>
        {lines.length === 0 && <p className="console-empty">Nada por aqui. Abra o jogo para ver os logs.</p>}
        {lines.map((l) => <div key={l.id} className={`log ${level(l.line)}`}>{l.line}</div>)}
      </div>
    </div>
  );
}
