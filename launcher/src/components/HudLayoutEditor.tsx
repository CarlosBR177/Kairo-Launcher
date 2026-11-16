// Editor de layout da HUD: arrastar, redimensionar e posicionar os elementos como no jogo.
// Usa a mesma regra do mod: posição relativa à tela (rx, ry de 0 a 1) + escala, então o que
// você monta aqui fica igual em qualquer resolução. Tamanhos em "pixels da GUI" (tela de 480×270).

import { Eye, EyeOff, Move, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { ClientConfig, OptionValue } from "../api";
import { MODULE_BY_ID } from "../modules";

const GW = 480;
const GH = 270;
const SNAP = 6;
const MARGIN = 4;
const MIN_S = 0.5;
const MAX_S = 3;

type Layout = { rx: number; ry: number; scale: number };

interface Spec {
  w: number;
  h: number;
  def: { x: number; y: number } | { rx: number; ry: number };
  render: () => ReactNode;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const roundScale = (s: number) => clamp(Math.round(s * 20) / 20, MIN_S, MAX_S);

const Pill = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="hl-pill"><b>{k}</b> {v}</div>
);

function specs(opt: (id: string, key: string) => OptionValue | undefined): Record<string, Spec> {
  const armorH = Boolean(opt("armor", "horizontal"));
  const armorHand = opt("armor", "showHand") !== false;
  const armorN = armorHand ? 5 : 4;
  const showCombo = opt("combo", "showCombo") !== false;
  const showReach = opt("combo", "showReach") !== false;
  const pct = Boolean(opt("armor", "percent"));
  return {
    fps: { w: 52, h: 15, def: { x: 4, y: 4 }, render: () => <Pill k="FPS" v="412" /> },
    cps: { w: 62, h: 15, def: { x: 4, y: 22 }, render: () => <Pill k="CPS" v="9 | 2" /> },
    ping: { w: 62, h: 15, def: { x: 4, y: 40 }, render: () => <Pill k="Ping" v="38ms" /> },
    clock: { w: 64, h: 15, def: { x: 4, y: 58 }, render: () => <Pill k="Hora" v="18:42" /> },
    combo: {
      w: showCombo && showReach ? 86 : showCombo ? 50 : 40, h: 15, def: { rx: 0.5, ry: 0.58 },
      render: () => <Pill k={showCombo ? "Combo" : ""} v={<>{showCombo ? "4 " : ""}{showReach ? "2.87m" : ""}</>} />,
    },
    coords: {
      w: 76, h: 48, def: { x: 4, y: 80 },
      render: () => (
        <div className="hl-pill col"><span><b>X</b> 128.5</span><span><b>Y</b> 64</span><span><b>Z</b> -42.0</span><i>Norte (-Z)</i></div>
      ),
    },
    potions: {
      w: 112, h: 30, def: { rx: 1, ry: 0 },
      render: () => (
        <div className="hl-pill col potions">
          <span><i style={{ background: "#FFC700" }} />Força II<em>1:24</em></span>
          <span><i style={{ background: "#33EBFF" }} />Velocidade II<em>0:07</em></span>
        </div>
      ),
    },
    armor: {
      w: armorH ? armorN * 48 : 46, h: armorH ? 17 : armorN * 17, def: { rx: 0, ry: 0.62 },
      render: () => (
        <div className={`hl-armor ${armorH ? "row" : ""}`}>
          {[92, 78, 64, 41, 88].slice(0, armorN).map((p, i) => (
            <span key={i}><i />{pct ? `${p}%` : [334, 461, 318, 176, 1371][i]}</span>
          ))}
        </div>
      ),
    },
    items: {
      w: 40, h: 51, def: { rx: 1, ry: 0.45 },
      render: () => (
        <div className="hl-armor items">
          {[["#3f9e8a", 16], ["#f2c94c", 12], ["#e0557a", 7]].map(([c, n], i) => (
            <span key={i}><i style={{ background: String(c) }} />{n}</span>
          ))}
        </div>
      ),
    },
    keystrokes: {
      w: 70, h: 76, def: { rx: 1, ry: 1 },
      render: () => (
        <div className="hl-keys">
          <div><span className="gk" /><span className="down">W</span><span className="gk" /></div>
          <div><span>A</span><span>S</span><span className="down">D</span></div>
          <div className="mouse"><span className="down">9 CPS</span><span>2 CPS</span></div>
          <div className="space"><span /></div>
        </div>
      ),
    },
  };
}

export const HUD_IDS = ["fps", "cps", "ping", "clock", "combo", "coords", "potions", "armor", "items", "keystrokes"];

interface Props {
  cfg: ClientConfig | null;
  accent: string;
  enabled: (id: string) => boolean;
  opt: (id: string, key: string) => OptionValue | undefined;
  crosshair: ReactNode;
  onLayout: (id: string, l: Layout) => void;
  onToggle: (id: string, on: boolean) => void;
  onReset: (id: string | null) => void;
  /** Conteúdo extra na coluna da direita (ex.: cor de destaque). */
  aside?: ReactNode;
}

export function HudLayoutEditor({ cfg, accent, enabled, opt, crosshair, onLayout, onToggle, onReset, aside }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(1.6);
  const [selected, setSelected] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Layout>>({});
  const [guides, setGuides] = useState({ x: false, y: false });
  const drag = useRef<{ id: string; mode: "move" | "resize"; offX: number; offY: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const S = specs(opt);

  // escala da prévia acompanha a largura do painel
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setF(el.clientWidth / GW));
    ro.observe(el);
    setF(el.clientWidth / GW);
    return () => ro.disconnect();
  }, []);

  // descarta o estado local quando a config muda por fora (perfil, redefinir…)
  useEffect(() => setLocal({}), [cfg]);

  function layoutOf(id: string): Layout {
    if (local[id]) return local[id];
    const m = cfg?.modules?.[id];
    const sp = S[id];
    const scale = roundScale(typeof m?.scale === "number" ? m.scale : 1);
    if (typeof m?.rx === "number" && typeof m?.ry === "number") return { rx: m.rx, ry: m.ry, scale };
    const free = (w: number, total: number) => Math.max(1, total - w * scale);
    if ("rx" in sp.def) return { rx: sp.def.rx, ry: sp.def.ry, scale };
    const px = typeof m?.x === "number" ? m.x : sp.def.x;
    const py = typeof m?.y === "number" ? m.y : sp.def.y;
    return { rx: clamp(px / free(sp.w, GW), 0, 1), ry: clamp(py / free(sp.h, GH), 0, 1), scale };
  }

  function rect(id: string) {
    const l = layoutOf(id);
    const w = S[id].w * l.scale;
    const h = S[id].h * l.scale;
    return { x: l.rx * Math.max(1, GW - w), y: l.ry * Math.max(1, GH - h), w, h, l };
  }

  function commit(id: string, l: Layout, delay = 0) {
    setLocal((s) => ({ ...s, [id]: l }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onLayout(id, l), delay);
  }

  function moveTo(id: string, gx: number, gy: number, scale: number): Layout {
    const w = S[id].w * scale;
    const h = S[id].h * scale;
    return { rx: clamp(gx / Math.max(1, GW - w), 0, 1), ry: clamp(gy / Math.max(1, GH - h), 0, 1), scale };
  }

  function toGui(e: { clientX: number; clientY: number }) {
    const r = boxRef.current!.getBoundingClientRect();
    return { gx: (e.clientX - r.left) / f, gy: (e.clientY - r.top) / f };
  }

  function onDown(e: RPointerEvent, id: string, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);
    const { gx, gy } = toGui(e);
    const r = rect(id);
    drag.current = { id, mode, offX: gx - r.x, offY: gy - r.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMove(e: RPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { gx, gy } = toGui(e);
    const r = rect(d.id);
    if (d.mode === "resize") {
      const scale = roundScale((gx - r.x) / S[d.id].w);
      setLocal((s) => ({ ...s, [d.id]: moveTo(d.id, r.x, r.y, scale) }));
      return;
    }
    let px = gx - d.offX;
    let py = gy - d.offY;
    const cx = (GW - r.w) / 2;
    const cy = (GH - r.h) / 2;
    const g = { x: false, y: false };
    if (Math.abs(px - cx) < SNAP) { px = cx; g.x = true; }
    else if (Math.abs(px - MARGIN) < SNAP) px = MARGIN;
    else if (Math.abs(px + r.w - (GW - MARGIN)) < SNAP) px = GW - MARGIN - r.w;
    if (Math.abs(py - cy) < SNAP) { py = cy; g.y = true; }
    else if (Math.abs(py - MARGIN) < SNAP) py = MARGIN;
    else if (Math.abs(py + r.h - (GH - MARGIN)) < SNAP) py = GH - MARGIN - r.h;
    setGuides(g);
    setLocal((s) => ({ ...s, [d.id]: moveTo(d.id, px, py, r.l.scale) }));
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    setGuides({ x: false, y: false });
    if (d) onLayout(d.id, layoutOf(d.id));
  }

  // rodinha sobre um elemento = redimensionar (listener nativo, não passivo, para a página não rolar)
  const wheelRef = useRef<(e: WheelEvent) => void>(() => undefined);
  wheelRef.current = (e: WheelEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-hud]");
    if (!el) return;
    e.preventDefault();
    const id = el.dataset.hud!;
    setSelected(id);
    const r = rect(id);
    const scale = roundScale(r.l.scale + (e.deltaY < 0 ? 0.1 : -0.1));
    commit(id, moveTo(id, r.x, r.y, scale), 300);
  };
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  function setScale(id: string, scale: number) {
    const r = rect(id);
    commit(id, moveTo(id, r.x, r.y, roundScale(scale)), 250);
  }

  function snapTo(id: string, col: number, row: number) {
    const r = rect(id);
    const px = col === 0 ? MARGIN : col === 1 ? (GW - r.w) / 2 : GW - r.w - MARGIN;
    const py = row === 0 ? MARGIN : row === 1 ? (GH - r.h) / 2 : GH - r.h - MARGIN;
    commit(id, moveTo(id, px, py, r.l.scale));
  }

  const sel = selected ? rect(selected) : null;
  const ARROWS = ["↖", "↑", "↗", "←", "•", "→", "↙", "↓", "↘"];

  return (
    <div className="hl-wrap">
      <div className="hl-left">
      <div
        ref={boxRef}
        className="hud-preview hl-canvas"
        style={{ ["--hud" as string]: accent, height: GH * f }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerDown={() => setSelected(null)}
      >
        <div className="hud-sky" />
        <div className="hud-cross-custom">{crosshair}</div>
        {guides.x && <div className="hl-guide v" />}
        {guides.y && <div className="hl-guide h" />}
        {HUD_IDS.map((id) => {
          const r = rect(id);
          const on = enabled(id);
          return (
            <div
              key={id}
              className={`hl-el ${on ? "" : "off"} ${selected === id ? "sel" : ""}`}
              style={{ left: r.x * f, top: r.y * f, width: r.w * f, height: r.h * f }}
              data-hud={id}
              onPointerDown={(e) => onDown(e, id, "move")}
              title={`${MODULE_BY_ID[id]?.name ?? id} · ${Math.round(r.l.scale * 100)}%`}
            >
              {on ? (
                <div className="hl-inner" style={{ width: S[id].w, height: S[id].h, transform: `scale(${f * r.l.scale})` }}>
                  {S[id].render()}
                </div>
              ) : (
                <span className="hl-off-name">{MODULE_BY_ID[id]?.name ?? id}</span>
              )}
              {selected === id && <span className="hl-handle" onPointerDown={(e) => onDown(e, id, "resize")} />}
            </div>
          );
        })}
      </div>
      <p className="hl-caption">
        <Move size={13} /> Arraste para mover · rodinha ou alça do canto para redimensionar · no jogo: tecla <kbd>H</kbd>
      </p>
      </div>

      <div className="hl-panel">
        {selected && sel ? (
          <>
            <div className="hl-panel-head">
              <b>{MODULE_BY_ID[selected]?.name ?? selected}</b>
              <span className="muted note">{enabled(selected) ? "Visível" : "Oculto"}</span>
            </div>
            <label className="field range-field">
              <span>Tamanho <output>{Math.round(sel.l.scale * 100)}%</output></span>
              <input type="range" min={MIN_S} max={MAX_S} step={0.05} value={sel.l.scale} onChange={(e) => setScale(selected, Number(e.target.value))} />
            </label>
            <div className="field">
              <span>Posição rápida</span>
              <div className="hl-grid">
                {ARROWS.map((a, i) => (
                  <button key={i} onClick={() => snapTo(selected, i % 3, Math.floor(i / 3))}>{a}</button>
                ))}
              </div>
            </div>
            <div className="hl-actions">
              <button className="ghost small" onClick={() => onToggle(selected, !enabled(selected))}>
                {enabled(selected) ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Mostrar</>}
              </button>
              <button className="ghost small" onClick={() => onReset(selected)}><RotateCcw size={14} /> Redefinir</button>
            </div>
          </>
        ) : (
          <>
            <h3>Layout da HUD</h3>
            <p>Clique num elemento da prévia para mudar tamanho e posição. Elementos ocultos aparecem tracejados.</p>
            <p className="muted note">O mesmo editor existe no jogo: tecla <kbd>H</kbd> ou “Editar HUD” no menu do Kairo.</p>
          </>
        )}
        <button className="ghost small hl-reset-all" onClick={() => { setSelected(null); onReset(null); }}>
          <RotateCcw size={14} /> Redefinir HUD inteira
        </button>
        {aside}
      </div>
    </div>
  );
}
