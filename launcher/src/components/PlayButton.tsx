import { Loader2, Play, Square } from "lucide-react";
import { api, type Instance } from "../api";
import { useStore } from "../store";

const STAGES: Record<string, string> = {
  meta: "Preparando",
  libraries: "Bibliotecas",
  assets: "Recursos",
  java: "Java",
  mods: "Mods",
  done: "Iniciando",
};

export function PlayButton({ instance, server }: { instance: Instance; server: string | null }) {
  const { games, progress, activeAccount, setAccountsOpen, toast } = useStore();
  const state = games[instance.id]?.state ?? "stopped";

  if (state === "running") {
    return (
      <div className="play-group">
        <button className="play running" disabled>
          <span className="pulse" />
          EM JOGO
        </button>
        <button className="play-stop" title="Forçar fechamento" onClick={() => api.kill(instance.id)}>
          <Square size={16} fill="currentColor" />
        </button>
      </div>
    );
  }

  if (state === "installing") {
    const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <button className="play installing" disabled>
        <span className="fill" style={{ width: `${pct}%` }} />
        <span className="play-label">
          <Loader2 size={18} className="spin" />
          <span>
            <b>{STAGES[progress?.stage ?? "meta"] ?? "Preparando"}</b>
            <small>{progress?.message ?? "Conectando"}{progress && progress.total > 1 ? ` · ${progress.current}/${progress.total}` : ""}</small>
          </span>
          <em>{pct}%</em>
        </span>
      </button>
    );
  }

  return (
    <button
      className="play"
      onClick={async () => {
        if (!activeAccount) {
          setAccountsOpen(true);
          toast("Adicione uma conta para jogar", "info");
          return;
        }
        try {
          await api.launch(instance.id, server);
        } catch (e) {
          toast(String(e), "error");
        }
      }}
    >
      <Play size={22} fill="currentColor" />
      JOGAR
    </button>
  );
}
