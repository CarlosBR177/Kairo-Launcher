import { Blocks, Cpu, Layers, Play, Settings2, TerminalSquare } from "lucide-react";
import { useStore, type Page } from "../store";

const ITEMS: { page: Page; label: string; icon: typeof Play }[] = [
  { page: "home", label: "Jogar", icon: Play },
  { page: "instances", label: "Instâncias", icon: Layers },
  { page: "mods", label: "Mods", icon: Blocks },
  { page: "client", label: "Client", icon: Cpu },
  { page: "console", label: "Console", icon: TerminalSquare },
];

export function Sidebar() {
  const { page, setPage, games } = useStore();
  const running = Object.values(games).some((g) => g.state === "running");
  return (
    <nav className="rail">
      {ITEMS.map(({ page: p, label, icon: Icon }) => (
        <button key={p} className={`rail-item ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>
          <Icon size={20} strokeWidth={page === p ? 2.4 : 1.8} />
          <span>{label}</span>
          {p === "console" && running && <i className="live-dot" />}
        </button>
      ))}
      <div className="rail-spacer" />
      <button className={`rail-item ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")}>
        <Settings2 size={20} />
        <span>Ajustes</span>
      </button>
    </nav>
  );
}
