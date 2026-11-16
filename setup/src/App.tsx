import { AlertTriangle, ArrowLeft, Check, ChevronRight, FolderOpen, Gauge, Minus, Play, Settings2, Sparkles, Swords, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type SetupInfo } from "./api";

type Screen = "welcome" | "options" | "installing" | "done" | "error";

const TIPS = [
  "No jogo, aperte H para mover e redimensionar a HUD.",
  "Shift direito abre o menu do Kairo Client.",
  "Segure C para dar zoom; a rodinha ajusta o nível.",
  "Segure Alt para olhar ao redor sem virar o personagem.",
  "Fixe seus servidores na tela inicial para ver o ping ao vivo.",
];

const STAGES: [number, string][] = [
  [0, "Preparando a instalação…"],
  [18, "Copiando o Kairo Launcher…"],
  [52, "Instalando o Kairo Client…"],
  [80, "Criando atalhos…"],
  [96, "Finalizando…"],
];

export function App() {
  const params = new URLSearchParams(location.search);
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [screen, setScreen] = useState<Screen>((params.get("screen") as Screen) || "welcome");
  const [dir, setDir] = useState("");
  const [desktop, setDesktop] = useState(true);
  const [progress, setProgress] = useState(params.get("screen") === "installing" ? 57 : 0);
  const [error, setError] = useState(params.has("fail") ? "O instalador terminou com código 2. Feche o Kairo Launcher se ele estiver aberto e tente de novo." : "");
  const [tip, setTip] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    api.info().then((i) => {
      setInfo(i);
      setDir(i.default_dir);
    }).catch((e) => {
      setError(String(e));
      setScreen("error");
    });
  }, []);

  // progresso visual: sobe rápido no começo e desacelera até a instalação terminar de verdade
  useEffect(() => {
    if (screen !== "installing" || params.get("screen") === "installing") return;
    const started = Date.now();
    const t = setInterval(() => {
      if (finished.current) return;
      const s = (Date.now() - started) / 1000;
      setProgress(Math.min(94, 94 * (1 - Math.exp(-s / 3.2))));
    }, 80);
    const tt = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 4200);
    return () => {
      clearInterval(t);
      clearInterval(tt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  async function install() {
    finished.current = false;
    setProgress(0);
    setScreen("installing");
    try {
      await api.install(dir, desktop);
      finished.current = true;
      setProgress(100);
      setTimeout(() => setScreen("done"), 700);
    } catch (e) {
      finished.current = true;
      setError(String(e));
      setScreen("error");
    }
  }

  async function finish(open: boolean) {
    if (open) await api.launch(dir).catch(() => undefined);
    await api.close();
  }

  const update = info?.installed ?? false;
  const stage = [...STAGES].reverse().find(([p]) => progress >= p)?.[1] ?? STAGES[0][1];
  const busy = screen === "installing";

  return (
    <div className="setup">
      <div className="glow" />
      <div className="grid-bg" />
      {(screen === "welcome" || screen === "options") && <Blocks />}

      <header className="bar" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <Mark size={20} />
          <span data-tauri-drag-region>KAIRO</span>
          <em data-tauri-drag-region>Setup {info ? `v${info.version}` : ""}</em>
        </div>
        <div className="win">
          <button aria-label="Minimizar" onClick={() => api.minimize()}><Minus size={14} /></button>
          <button aria-label="Fechar" className="close" disabled={busy} onClick={() => api.close()}><X size={15} /></button>
        </div>
      </header>

      <main key={screen} className={`screen ${screen}`}>
        {screen === "welcome" && (
          <>
            <section className="hero">
              <span className="eyebrow">{update ? "Nova versão disponível" : "PvP Client para Minecraft"}</span>
              <h1>{update ? <>Atualizar o <b>Kairo</b></> : <>Bem-vindo ao <b>Kairo</b></>}</h1>
              <p className="lead">
                {update
                  ? "Seus mundos, contas e configurações continuam onde estão. Leva só alguns segundos."
                  : "Instala o Minecraft, o Java e os mods certos sozinho. Você só escolhe a versão e clica em Jogar."}
              </p>
              <ul className="feats">
                <li><Gauge size={16} /> Mais FPS com o pacote de desempenho</li>
                <li><Swords size={16} /> HUD de PvP que você monta do seu jeito</li>
                <li><Sparkles size={16} /> Mods do Modrinth com um clique</li>
              </ul>
            </section>
            <footer className="actions">
              <button className="primary" onClick={install} disabled={!info?.payload_ok}>
                {update ? "Atualizar" : "Instalar"} <ChevronRight size={18} />
              </button>
              {!update && (
                <button className="link" onClick={() => setScreen("options")}>
                  <Settings2 size={15} /> Opções de instalação
                </button>
              )}
              <p className="legal">
                {info && !info.payload_ok
                  ? "Este Setup foi compilado sem o instalador embutido."
                  : "Não oficial do Minecraft. Não aprovado nem associado à Mojang ou à Microsoft."}
              </p>
            </footer>
          </>
        )}

        {screen === "options" && (
          <>
            <section className="panel">
              <h2>Opções de instalação</h2>
              <label className="field">
                <span>Pasta de instalação</span>
                <div className="path">
                  <input value={dir} onChange={(e) => setDir(e.target.value)} spellCheck={false} />
                  <button className="ghost" onClick={async () => { const d = await api.pickDir(dir); if (d) setDir(d); }}>
                    <FolderOpen size={15} /> Procurar
                  </button>
                </div>
                <small>Instalado só para o seu usuário — não precisa de administrador.</small>
              </label>
              <Check2 on={desktop} onChange={setDesktop} label="Criar atalho na Área de Trabalho" />
            </section>
            <footer className="actions">
              <button className="primary" onClick={install} disabled={!dir.trim()}>Instalar <ChevronRight size={18} /></button>
              <button className="link" onClick={() => setScreen("welcome")}><ArrowLeft size={15} /> Voltar</button>
            </footer>
          </>
        )}

        {screen === "installing" && (
          <section className="installing">
            <div className="ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" className="track" />
                <circle cx="60" cy="60" r="52" className="fill" style={{ strokeDashoffset: 327 - (327 * progress) / 100 }} />
              </svg>
              <b>{Math.round(progress)}%</b>
            </div>
            <h2>{update ? "Atualizando o Kairo" : "Instalando o Kairo"}</h2>
            <p className="stage">{stage}</p>
            <div className="tip" key={tip}><span>Dica</span> {TIPS[tip]}</div>
          </section>
        )}

        {screen === "done" && (
          <section className="done">
            <div className="check"><Check size={44} strokeWidth={3} /></div>
            <h2>Tudo pronto!</h2>
            <p className="lead">O Kairo Launcher {update ? "foi atualizado" : "está instalado"}. Bora jogar?</p>
            <div className="actions center">
              <button className="primary big" onClick={() => finish(true)}><Play size={18} fill="currentColor" /> Abrir o Kairo</button>
              <button className="link" onClick={() => finish(false)}>Fechar</button>
            </div>
            <small className="muted">Você também encontra o Kairo no menu Iniciar{desktop ? " e na Área de Trabalho" : ""}.</small>
          </section>
        )}

        {screen === "error" && (
          <section className="done error">
            <div className="check bad"><AlertTriangle size={40} /></div>
            <h2>Não deu para instalar</h2>
            <p className="lead err">{error || "Algo deu errado."}</p>
            <div className="actions center">
              <button className="primary" onClick={install}>Tentar de novo</button>
              <button className="link" onClick={() => api.close()}>Fechar</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Check2({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`check2 ${on ? "on" : ""}`} onClick={() => onChange(!on)} role="checkbox" aria-checked={on}>
      <i>{on && <Check size={13} strokeWidth={3} />}</i> {label}
    </button>
  );
}

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x="8" y="8" width="11" height="48" rx="1.5" fill="currentColor" />
      <polygon points="30,24 46,8 58,8 36,30" fill="currentColor" />
      <polygon points="30,40 46,56 58,56 36,34" fill="currentColor" />
      <polygon points="28,26 34,32 28,38 22,32" fill="var(--accent)" />
    </svg>
  );
}

/** Logo grande à direita, com blocos flutuando. */
function Blocks() {
  return (
    <div className="art" aria-hidden>
      <div className="art-mark"><Mark size={210} /></div>
      {[...Array(7)].map((_, i) => <span key={i} className={`cube c${i}`} />)}
    </div>
  );
}
