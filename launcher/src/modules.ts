// Catálogo dos módulos do Kairo Client (mesmos ids e padrões do mod: gg.kairo.module.impl).
import {
  Crosshair, Eye, Flame, Footprints, Gauge, Hand, Keyboard, MapPin, MousePointerClick, Package, Shield,
  Sparkles, Sun, Swords, Timer, Wifi, Zap, ZoomIn, FlaskConical, type LucideIcon,
} from "lucide-react";
import type { OptionValue } from "./api";

export type Group = "hud" | "pvp" | "visual" | "movimento";

export const GROUPS: { id: Group; label: string }[] = [
  { id: "hud", label: "HUD" },
  { id: "pvp", label: "PvP" },
  { id: "visual", label: "Visual" },
  { id: "movimento", label: "Câmera e movimento" },
];

export type OptionField =
  | { key: string; label: string; type: "bool"; def: boolean }
  | { key: string; label: string; type: "range"; def: number; min: number; max: number; step: number; unit?: string }
  | { key: string; label: string; type: "select"; def: string; choices: { value: string; label: string }[] }
  | { key: string; label: string; type: "color"; def: string };

export interface ModuleInfo {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  group: Group;
  hud: boolean;
  def: boolean;
  options?: OptionField[];
}

export const MODULES: ModuleInfo[] = [
  { id: "fps", name: "FPS", desc: "Quadros por segundo na tela.", icon: Gauge, group: "hud", hud: true, def: true },
  { id: "cps", name: "CPS", desc: "Cliques por segundo, esquerdo e direito.", icon: MousePointerClick, group: "hud", hud: true, def: true },
  { id: "keystrokes", name: "Keystrokes", desc: "WASD, mouse e espaço com animação.", icon: Keyboard, group: "hud", hud: true, def: true },
  { id: "coords", name: "Coordenadas", desc: "X, Y, Z e direção.", icon: MapPin, group: "hud", hud: true, def: true },
  { id: "ping", name: "Ping", desc: "Latência até o servidor.", icon: Wifi, group: "hud", hud: true, def: true },
  { id: "clock", name: "Relógio", desc: "Hora do seu PC.", icon: Timer, group: "hud", hud: true, def: false },

  {
    id: "combo", name: "Combo e distância", desc: "Hits seguidos e a distância do último hit. Só mostra.", icon: Swords, group: "pvp", hud: true, def: true,
    options: [
      { key: "showCombo", label: "Mostrar combo", type: "bool", def: true },
      { key: "showReach", label: "Mostrar distância", type: "bool", def: true },
    ],
  },
  {
    id: "potions", name: "Efeitos de poção", desc: "Efeitos ativos com o tempo que falta.", icon: FlaskConical, group: "pvp", hud: true, def: true,
    options: [{ key: "blink", label: "Piscar nos últimos 10 s", type: "bool", def: true }],
  },
  {
    id: "armor", name: "Armadura", desc: "Peças vestidas e item na mão com a durabilidade.", icon: Shield, group: "pvp", hud: true, def: true,
    options: [
      { key: "percent", label: "Durabilidade em %", type: "bool", def: false },
      { key: "horizontal", label: "Em linha (horizontal)", type: "bool", def: false },
      { key: "showHand", label: "Incluir item na mão", type: "bool", def: true },
    ],
  },
  {
    id: "items", name: "Contador de itens", desc: "Pérolas, maçãs, poções, flechas e totens.", icon: Package, group: "pvp", hud: true, def: false,
    options: [{ key: "hideZero", label: "Esconder itens zerados", type: "bool", def: true }],
  },
  {
    id: "crosshair", name: "Mira personalizada", desc: "Estilo, tamanho, espaço, espessura e cor.", icon: Crosshair, group: "pvp", hud: false, def: false,
    options: [
      {
        key: "style", label: "Estilo", type: "select", def: "cross", choices: [
          { value: "cross", label: "Cruz aberta" }, { value: "plus", label: "Cruz fechada" }, { value: "t", label: "T" },
          { value: "circle", label: "Círculo" }, { value: "dot", label: "Ponto" },
        ],
      },
      { key: "size", label: "Tamanho", type: "range", def: 5, min: 1, max: 16, step: 1, unit: "px" },
      { key: "gap", label: "Espaço no meio", type: "range", def: 2, min: 0, max: 8, step: 1, unit: "px" },
      { key: "thickness", label: "Espessura", type: "range", def: 1, min: 1, max: 4, step: 1, unit: "px" },
      { key: "color", label: "Cor", type: "color", def: "accent" },
      { key: "outline", label: "Contorno preto", type: "bool", def: true },
      { key: "dot", label: "Ponto no centro", type: "bool", def: false },
      { key: "attackIndicator", label: "Barra de recarga do ataque", type: "bool", def: true },
    ],
  },
  {
    id: "particles", name: "Partículas de hit", desc: "Multiplica as partículas de crítico e afiação.", icon: Sparkles, group: "pvp", hud: false, def: false,
    options: [
      { key: "multiplier", label: "Multiplicador", type: "range", def: 2, min: 1, max: 10, step: 1, unit: "×" },
      { key: "alwaysCrit", label: "Sempre mostrar crítico", type: "bool", def: false },
      { key: "alwaysSharpness", label: "Sempre mostrar afiação", type: "bool", def: false },
    ],
  },

  {
    id: "lowfire", name: "Fogo baixo", desc: "Desce o fogo da tela para não atrapalhar.", icon: Flame, group: "visual", hud: false, def: true,
    options: [
      { key: "offset", label: "Quanto descer", type: "range", def: 0.3, min: 0, max: 0.5, step: 0.05 },
      { key: "hide", label: "Esconder de vez", type: "bool", def: false },
    ],
  },
  {
    id: "handview", name: "Item na mão", desc: "Tamanho e posição do item, escudo mais baixo.", icon: Hand, group: "visual", hud: false, def: false,
    options: [
      { key: "scale", label: "Tamanho", type: "range", def: 1, min: 0.3, max: 1.5, step: 0.05, unit: "×" },
      { key: "x", label: "Horizontal", type: "range", def: 0, min: -1, max: 1, step: 0.05 },
      { key: "y", label: "Vertical", type: "range", def: 0, min: -1, max: 1, step: 0.05 },
      { key: "z", label: "Profundidade", type: "range", def: 0, min: -1, max: 1, step: 0.05 },
      { key: "offhandY", label: "Escudo / mão secundária", type: "range", def: -0.15, min: -1, max: 0.5, step: 0.05 },
    ],
  },
  { id: "fullbright", name: "Brilho máximo", desc: "Enxerga no escuro sem tocha.", icon: Sun, group: "visual", hud: false, def: false },

  { id: "freelook", name: "Freelook", desc: "Segure Alt e olhe ao redor sem virar o personagem.", icon: Eye, group: "movimento", hud: false, def: true },
  { id: "zoom", name: "Zoom", desc: "Segure C; a rodinha ajusta o nível.", icon: ZoomIn, group: "movimento", hud: false, def: true },
  { id: "togglesprint", name: "Auto Sprint", desc: "Corre sem precisar segurar Ctrl.", icon: Zap, group: "movimento", hud: false, def: false },
  { id: "togglesneak", name: "Toggle Sneak", desc: "Um toque no Shift agacha; outro levanta.", icon: Footprints, group: "movimento", hud: false, def: false },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<string, ModuleInfo>;

/** Módulos que costumam ser proibidos em alguns servidores (sugestões nas regras). */
export const RULE_CANDIDATES = ["freelook", "zoom", "fullbright", "togglesprint", "togglesneak", "combo", "particles", "crosshair"];

export function optionValue(
  modules: Record<string, Record<string, OptionValue | undefined>> | undefined,
  id: string,
  field: OptionField,
): OptionValue {
  const v = modules?.[id]?.[field.key];
  return v === undefined ? field.def : v;
}

/** Versões do jogo com Kairo Client (mesma tabela do launcher, kairo_jar_for em lib.rs). */
export const KAIRO_VERSIONS_LABEL = "1.21.1, 1.21.4, 1.21.6–1.21.8, 1.21.11 e 26.3";

export function kairoSupports(gameVersion: string): boolean {
  return ["1.21", "1.21.1", "1.21.4", "1.21.6", "1.21.7", "1.21.8", "1.21.11", "26.3"].includes(gameVersion)
    || gameVersion.startsWith("26.3.");
}
