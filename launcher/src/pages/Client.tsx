import { Bookmark, Plus, Settings2, ShieldBan, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { api, type ClientConfig, type OptionValue, type ServerRule } from "../api";
import { CrosshairPreview } from "../components/CrosshairPreview";
import { HudLayoutEditor } from "../components/HudLayoutEditor";
import { Toggle } from "../components/Toggle";
import { GROUPS, KAIRO_VERSIONS_LABEL, MODULE_BY_ID, MODULES, RULE_CANDIDATES, kairoSupports, optionValue, type ModuleInfo, type OptionField } from "../modules";
import { useStore } from "../store";

const SWATCHES = ["#8B5CFF", "#3DDCFF", "#3DFFA2", "#FFD84D", "#FF7A45", "#FF4D8D", "#FFFFFF"];

export function Client() {
  const { selected, toast, settings, saveSettings } = useStore();
  const [cfg, setCfg] = useState<ClientConfig | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (selected?.loader) api.clientConfig(selected.id).then(setCfg).catch((e) => toast(String(e), "error"));
  }, [selected?.id, selected?.loader, toast]);

  if (!selected?.loader || !kairoSupports(selected.game_version)) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>Client</h1>
            <p>
              {!selected?.loader ? "Os módulos do Kairo funcionam em instâncias Fabric." : `O Kairo Client ainda não tem versão para o Minecraft ${selected.game_version}.`}
              {" "}Versões com Kairo: {KAIRO_VERSIONS_LABEL}.
            </p>
          </div>
        </header>
      </div>
    );
  }
  const id = selected.id;

  const enabled = (mid: string) => cfg?.modules?.[mid]?.enabled ?? MODULE_BY_ID[mid]?.def ?? false;
  const opt = (mid: string, key: string) => {
    const field = MODULE_BY_ID[mid]?.options?.find((f) => f.key === key);
    return field ? optionValue(cfg?.modules, mid, field) : undefined;
  };
  const accent = cfg?.accent ?? "#8B5CFF";

  async function run(p: Promise<ClientConfig>) {
    try { setCfg(await p); } catch (e) { toast(String(e), "error"); }
  }
  const setModule = (mid: string, v: boolean) => run(api.clientSetModule(id, mid, v));
  const setOption = (mid: string, key: string, v: OptionValue) => {
    // atualiza na hora (sliders) e grava em seguida
    setCfg((c) => c && { ...c, modules: { ...c.modules, [mid]: { ...c.modules[mid], [key]: v } } });
    const k = `${mid}.${key}`;
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => {
      api.clientSetOption(id, mid, key, v).catch((e) => toast(String(e), "error"));
    }, 250);
  };
  async function setAccent(hex: string) {
    await run(api.clientSetAccent(id, hex));
    if (settings) await saveSettings({ ...settings, accent: hex }).catch(() => undefined);
  }

  // ---------- perfis ----------
  const profiles = Object.keys(cfg?.profiles ?? {});
  function currentStates() {
    return Object.fromEntries(MODULES.map((m) => [m.id, enabled(m.id)]));
  }
  async function saveProfile() {
    const name = newProfile.trim();
    if (!name) return;
    await run(api.clientSaveProfile(id, name, currentStates()));
    setNewProfile("");
    toast(`Perfil “${name}” salvo`, "ok");
  }

  // ---------- regras por servidor ----------
  const rules = cfg?.serverRules ?? [];
  const setRules = (next: ServerRule[]) => run(api.clientSetServerRules(id, next));

  const cross = {
    style: String(opt("crosshair", "style")),
    size: Number(opt("crosshair", "size")),
    gap: Number(opt("crosshair", "gap")),
    thickness: Number(opt("crosshair", "thickness")),
    color: opt("crosshair", "color") === "accent" ? accent : String(opt("crosshair", "color")),
    outline: Boolean(opt("crosshair", "outline")),
    dot: Boolean(opt("crosshair", "dot")),
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Kairo Client</h1>
          <p>Ligue módulos e ajuste as opções antes de abrir o jogo. Dentro do jogo: <kbd>Shift direito</kbd>.</p>
        </div>
      </header>

      <div className="profile-bar">
        <Bookmark size={16} />
        <span className="profile-label">Perfis</span>
        {profiles.length === 0 && <span className="muted note">Salve combinações de módulos (PvP, Survival, Gravação) e troque com um clique.</span>}
        {profiles.map((p) => (
          <span key={p} className={`profile-chip ${cfg?.activeProfile === p ? "on" : ""}`}>
            <button onClick={() => run(api.clientApplyProfile(id, p))} title="Aplicar perfil">{p}</button>
            <button className="x" onClick={() => run(api.clientDeleteProfile(id, p))} aria-label={`Apagar ${p}`}><X size={12} /></button>
          </span>
        ))}
        <form className="profile-new" onSubmit={(e) => { e.preventDefault(); saveProfile(); }}>
          <input placeholder="Nome do perfil" maxLength={20} value={newProfile} onChange={(e) => setNewProfile(e.target.value)} />
          <button type="submit" className="ghost small" disabled={!newProfile.trim()}><Plus size={14} /> Salvar atual</button>
        </form>
      </div>

      <HudLayoutEditor
        cfg={cfg}
        accent={accent}
        enabled={enabled}
        opt={opt}
        crosshair={enabled("crosshair")
          ? <CrosshairPreview {...cross} scale={2} />
          : <CrosshairPreview style="plus" size={4} gap={0} thickness={1} color="#fff" outline={false} dot={false} scale={2} />}
        onLayout={(mid, l) => run(api.clientSetHud(id, mid, l.rx, l.ry, l.scale))}
        onToggle={(mid, on) => setModule(mid, on)}
        onReset={(mid) => run(api.clientResetHud(id, mid))}
        aside={
          <div className="accent-block">
            <h3>Cor de destaque</h3>
            <p>Usada na HUD do jogo, na mira (cor “destaque”) e no launcher.</p>
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button key={c} className={c.toLowerCase() === accent.toLowerCase() ? "on" : ""} style={{ background: c }} onClick={() => setAccent(c)} aria-label={c} />
              ))}
              <label className="swatch-custom" title="Cor personalizada">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} />
              </label>
            </div>
          </div>
        }
      />

      {GROUPS.map((g) => {
        const list = MODULES.filter((m) => m.group === g.id);
        const openInGroup = list.find((m) => m.id === open && m.options);
        return (
          <Fragment key={g.id}>
            <h3 className="module-group">{g.label}</h3>
            <div className="module-grid">
              {list.map((m) => (
                <ModuleCard
                  key={m.id}
                  m={m}
                  on={enabled(m.id)}
                  open={open === m.id}
                  onToggle={(v) => setModule(m.id, v)}
                  onOpen={() => setOpen(open === m.id ? null : m.id)}
                />
              ))}
            </div>
            {openInGroup && (
              <section className="module-options">
                <header>
                  <h4><openInGroup.icon size={16} /> {openInGroup.name}</h4>
                  <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Fechar opções"><X size={16} /></button>
                </header>
                <div className="options-body">
                  {openInGroup.id === "crosshair" && (
                    <div className="crosshair-stage" style={{ ["--hud" as string]: accent }}>
                      <CrosshairPreview {...cross} scale={5} />
                    </div>
                  )}
                  <div className="options-fields">
                    {openInGroup.options!.map((f) => (
                      <Field key={f.key} field={f} value={optionValue(cfg?.modules, openInGroup.id, f)} accent={accent}
                        onChange={(v) => setOption(openInGroup.id, f.key, v)} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </Fragment>
        );
      })}

      <section className="settings-card rules">
        <h3><ShieldBan size={18} /> Regras por servidor</h3>
        <p className="hint">Alguns servidores proíbem certos módulos (freelook é o caso mais comum). Os módulos marcados são desligados ao entrar nesse servidor e voltam ao sair. Vale para subdomínios: <code>exemplo.com</code> cobre <code>mc.exemplo.com</code>.</p>
        {rules.map((r, i) => (
          <div className="rule-row" key={i}>
            <input defaultValue={r.server} placeholder="servidor.com" spellCheck={false}
              onBlur={(e) => e.target.value !== r.server && setRules(rules.map((x, j) => (j === i ? { ...x, server: e.target.value } : x)))} />
            <div className="rule-mods">
              {RULE_CANDIDATES.map((mid) => {
                const on = r.modules.includes(mid);
                return (
                  <button key={mid} className={`chip ${on ? "on" : ""}`}
                    onClick={() => setRules(rules.map((x, j) => (j === i ? { ...x, modules: on ? x.modules.filter((y) => y !== mid) : [...x.modules, mid] } : x)))}>
                    {MODULE_BY_ID[mid].name}
                  </button>
                );
              })}
            </div>
            <button className="icon-btn" aria-label="Remover regra" onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
        ))}
        <button className="ghost small" onClick={() => setRules([...rules, { server: "", modules: ["freelook"] }])}><Plus size={14} /> Adicionar servidor</button>
        {rules.some((r) => !r.server.trim()) && <p className="hint">Regras sem endereço são descartadas ao salvar.</p>}
      </section>
    </div>
  );
}

function ModuleCard({ m, on, open, onToggle, onOpen }: { m: ModuleInfo; on: boolean; open: boolean; onToggle: (v: boolean) => void; onOpen: () => void }) {
  const Icon = m.icon;
  return (
    <div className={`module ${on ? "on" : ""} ${open ? "open" : ""}`} onClick={() => onToggle(!on)} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(!on))}>
      <span className="module-icon"><Icon size={20} /></span>
      <span className="module-text">
        <b>{m.name} {m.hud && <em>HUD</em>}</b>
        <small>{m.desc}</small>
      </span>
      {m.options && (
        <button className="module-gear" title="Opções" aria-label={`Opções de ${m.name}`} onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          <Settings2 size={16} />
        </button>
      )}
      <span onClick={(e) => e.stopPropagation()}><Toggle on={on} onChange={onToggle} label={m.name} /></span>
    </div>
  );
}

function Field({ field, value, accent, onChange }: { field: OptionField; value: OptionValue; accent: string; onChange: (v: OptionValue) => void }) {
  switch (field.type) {
    case "bool":
      return (
        <div className="setting-line">
          <span><b>{field.label}</b></span>
          <Toggle on={Boolean(value)} onChange={onChange} label={field.label} />
        </div>
      );
    case "range": {
      const n = Number(value);
      const shown = field.step < 1 ? n.toFixed(2) : String(n);
      return (
        <label className="field range-field">
          <span>{field.label} <output>{shown}{field.unit ?? ""}</output></span>
          <input type="range" min={field.min} max={field.max} step={field.step} value={n}
            onChange={(e) => onChange(Number(e.target.value))} />
        </label>
      );
    }
    case "select":
      return (
        <div className="field">
          <span>{field.label}</span>
          <div className="seg">
            {field.choices.map((c) => (
              <button key={c.value} className={value === c.value ? "on" : ""} onClick={() => onChange(c.value)}>{c.label}</button>
            ))}
          </div>
        </div>
      );
    case "color": {
      const isAccent = value === "accent";
      return (
        <div className="field">
          <span>{field.label}</span>
          <div className="color-pick">
            <button className={`chip ${isAccent ? "on" : ""}`} onClick={() => onChange("accent")}>
              <i style={{ background: accent }} /> Cor de destaque
            </button>
            {["#FFFFFF", "#3DFFA2", "#FF4D8D", "#FFD84D"].map((c) => (
              <button key={c} className={`dot-swatch ${value === c ? "on" : ""}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
            ))}
            <label className="swatch-custom small" title="Outra cor">
              <input type="color" value={isAccent ? accent : String(value)} onChange={(e) => onChange(e.target.value.toUpperCase())} />
            </label>
          </div>
        </div>
      );
    }
  }
}
