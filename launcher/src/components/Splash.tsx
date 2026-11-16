import { useEffect, useState } from "react";

const STEPS = ["Iniciando", "Carregando contas", "Carregando instâncias", "Preparando o Kairo Client"];
const MIN_MS = 1500; // tempo mínimo para a animação do logo terminar
const EXIT_MS = 550;

/** Tela de abertura: o logo se monta, a barra corre e tudo some quando o launcher está pronto. */
export function Splash({ ready }: { ready: boolean }) {
  const [step, setStep] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_MS);
    const s = setInterval(() => setStep((n) => Math.min(n + 1, STEPS.length - 1)), 420);
    return () => { clearTimeout(t); clearInterval(s); };
  }, []);

  useEffect(() => {
    if (!ready || !minDone) return;
    setLeaving(true);
    const t = setTimeout(() => setGone(true), EXIT_MS);
    return () => clearTimeout(t);
  }, [ready, minDone]);

  if (gone) return null;
  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} data-tauri-drag-region>
      <div className="splash-glow" />
      <div className="splash-center">
        <svg className="splash-mark" viewBox="0 0 64 64" aria-hidden>
          <rect className="sp-bar" x="8" y="8" width="11" height="48" rx="1.5" />
          <polygon className="sp-blade top" points="30,24 46,8 58,8 36,30" />
          <polygon className="sp-blade bottom" points="30,40 46,56 58,56 36,34" />
          <polygon className="sp-gem" points="28,26 34,32 28,38 22,32" />
        </svg>
        <h1 className="splash-word">
          {"KAIRO".split("").map((c, i) => <span key={i} style={{ animationDelay: `${0.55 + i * 0.06}s` }}>{c}</span>)}
        </h1>
        <div className="splash-track"><span /></div>
        <p className={`splash-step ${step > 0 ? "now" : ""}`} key={step}>{ready && minDone ? "Pronto" : STEPS[step]}</p>
      </div>
    </div>
  );
}
