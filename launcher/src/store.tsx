import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { checkForUpdate, showWhatsNew } from "./updater";
import { api, on, type AccountView, type Bootstrap, type GameState, type Instance, type Progress, type Settings } from "./api";

export type Page = "home" | "mods" | "client" | "instances" | "console" | "settings";

export interface Toast {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
}

export interface LogLine {
  id: number;
  instance: string;
  line: string;
}

interface Store {
  boot: Bootstrap | null;
  page: Page;
  setPage: (p: Page) => void;
  settings: Settings | null;
  saveSettings: (s: Settings) => Promise<void>;
  instances: Instance[];
  selected: Instance | null;
  selectInstance: (id: string) => void;
  upsertInstance: (i: Instance) => void;
  removeInstance: (id: string) => void;
  accounts: AccountView[];
  activeAccount: AccountView | null;
  setAccounts: (list: AccountView[], active: string | null) => void;
  games: Record<string, GameState>;
  progress: Progress | null;
  logs: LogLine[];
  clearLogs: () => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  accountsOpen: boolean;
  setAccountsOpen: (v: boolean) => void;
}

const Ctx = createContext<Store | null>(null);
const MAX_LOG = 3000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accounts, setAccountList] = useState<AccountView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [games, setGames] = useState<Record<string, GameState>>({});
  const [progress, setProgress] = useState<Progress | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const seq = useRef(0);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3800);
  }, []);

  useEffect(() => {
    api.bootstrap().then((b) => {
      setBoot(b);
      setSettings(b.settings);
      setInstances(b.instances);
      setSelectedId(b.selected ?? b.instances[0]?.id ?? null);
      setAccountList(b.accounts);
      setActiveId(b.active_account);
      // depois da abertura animada: primeiro "novidades" (se acabou de atualizar), depois procura versão nova
      setTimeout(() => {
        showWhatsNew(b.version).finally(() => {
          if (b.settings.check_updates) checkForUpdate(toast);
        });
      }, 2400);
    }).catch((e) => toast(String(e), "error"));
  }, [toast]);

  // aplica a cor de destaque escolhida em toda a interface
  useEffect(() => {
    if (settings?.accent) document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings?.accent]);

  useEffect(() => {
    const offs = [
      on<Progress>("progress", (p) => setProgress(p)),
      on<GameState>("game-state", (s) => {
        setGames((g) => ({ ...g, [s.instance_id]: s }));
        if (s.state !== "installing") setProgress(null);
        if (s.state === "error") toast(s.message || "O jogo fechou com erro", "error");
        if (s.state === "stopped") {
          // atualiza tempo jogado/última sessão
          api.bootstrap().then((b) => setInstances(b.instances)).catch(() => undefined);
        }
      }),
      on<{ instance_id: string; line: string }>("game-log", (l) => {
        setLogs((prev) => {
          const next = [...prev, { id: ++seq.current, instance: l.instance_id, line: l.line }];
          return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
        });
      }),
      on<{ title: string; body: string; kind: Toast["kind"] }>("notify", (n) => toast(n.body, n.kind)),
    ];
    return () => offs.forEach((f) => f());
  }, [toast]);

  const store = useMemo<Store>(() => ({
    boot,
    page,
    setPage,
    settings,
    saveSettings: async (s) => {
      setSettings(s);
      await api.saveSettings(s);
    },
    instances,
    selected: instances.find((i) => i.id === selectedId) ?? instances[0] ?? null,
    selectInstance: (id) => {
      setSelectedId(id);
      api.selectInstance(id).catch(() => undefined);
    },
    upsertInstance: (i) =>
      setInstances((list) => (list.some((x) => x.id === i.id) ? list.map((x) => (x.id === i.id ? i : x)) : [...list, i])),
    removeInstance: (id) => setInstances((list) => list.filter((x) => x.id !== id)),
    accounts,
    activeAccount: accounts.find((a) => a.uuid === activeId) ?? null,
    setAccounts: (list, active) => {
      setAccountList(list);
      setActiveId(active);
    },
    games,
    progress,
    logs,
    clearLogs: () => setLogs([]),
    toasts,
    toast,
    accountsOpen,
    setAccountsOpen,
  }), [boot, page, settings, instances, selectedId, accounts, activeId, games, progress, logs, toasts, toast, accountsOpen]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}

// ---------- utilidades de exibição ----------

export function formatPlaytime(seconds: number): string {
  if (seconds < 60) return "0 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

export function formatAgo(ts: number | null): string {
  if (!ts) return "nunca";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "agora há pouco";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")} mil`;
  return String(n);
}

export function loaderLabel(i: Instance): string {
  return i.loader ? `Fabric · ${i.game_version}` : `Vanilla · ${i.game_version}`;
}
