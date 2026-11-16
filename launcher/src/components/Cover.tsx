// Capas geradas em SVG: paisagens em "blocos", únicas para cada instância.
// Nada de imagens externas — é tudo desenhado a partir de uma semente.

import { useMemo } from "react";

export const COVERS = {
  aurora: { name: "Aurora", sky: ["#07061a", "#1d1150", "#3a1d7a"], glow: "#7cf5ff", layers: ["#2b1a5e", "#1b1040", "#0d0824"], stars: true },
  nether: { name: "Nether", sky: ["#140303", "#4a0d06", "#a3290d"], glow: "#ff8a3d", layers: ["#5c1309", "#360a05", "#1a0402"], stars: false },
  ocean: { name: "Oceano", sky: ["#020c18", "#06304d", "#0f6a85"], glow: "#9ff3ff", layers: ["#0a4660", "#062e42", "#031824"], stars: true },
  forest: { name: "Floresta", sky: ["#04100a", "#0f3a22", "#2f7a44"], glow: "#d6ff8f", layers: ["#16502c", "#0c331b", "#05190d"], stars: false },
  end: { name: "The End", sky: ["#05040c", "#14102b", "#2a2150"], glow: "#f4f0b0", layers: ["#3b3466", "#231e44", "#100d22"], stars: true },
  sunset: { name: "Pôr do sol", sky: ["#1a0a24", "#7a2b4f", "#ff8a4c"], glow: "#ffd27a", layers: ["#5a2141", "#38142b", "#1a0915"], stars: false },
} as const;

export type CoverKey = keyof typeof COVERS;

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linha de "morros" em degraus, estilo voxel. */
function ridge(rand: () => number, block: number, base: number, amp: number, width: number) {
  let y = base - rand() * amp;
  let d = `M0 200 L0 ${y}`;
  for (let x = 0; x <= width; x += block) {
    y = Math.max(base - amp, Math.min(base, y + (rand() - 0.5) * block * 1.6));
    const snapped = Math.round(y / (block / 2)) * (block / 2);
    d += ` L${x} ${snapped} L${x + block} ${snapped}`;
  }
  return d + ` L${width} 200 Z`;
}

export function Cover({ cover, seed, className }: { cover: string; seed: string; className?: string }) {
  const p = COVERS[(cover in COVERS ? cover : "aurora") as CoverKey];
  const gid = useMemo(() => `c${Math.abs([...seed + cover].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}`, [seed, cover]);
  const art = useMemo(() => {
    const rand = seeded(seed + cover);
    const stars = p.stars
      ? Array.from({ length: 46 }, () => ({ x: rand() * 400, y: rand() * 110, s: rand() > 0.85 ? 2 : 1, o: 0.3 + rand() * 0.7 }))
      : [];
    const sun = { x: 60 + rand() * 280, y: 40 + rand() * 40, r: 16 + rand() * 18 };
    const layers = [
      ridge(rand, 8, 120, 50, 400),
      ridge(rand, 12, 150, 44, 400),
      ridge(rand, 18, 182, 36, 400),
    ];
    return { stars, sun, layers };
  }, [seed, cover, p.stars]);

  return (
    <svg className={className} viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${gid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.6" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <radialGradient id={`${gid}g`}>
          <stop offset="0" stopColor={p.glow} stopOpacity="0.9" />
          <stop offset="0.35" stopColor={p.glow} stopOpacity="0.25" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${gid}s)`} />
      {art.stars.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} fill="#fff" opacity={s.o} />
      ))}
      <circle cx={art.sun.x} cy={art.sun.y} r={art.sun.r * 4} fill={`url(#${gid}g)`} />
      <rect x={art.sun.x - art.sun.r / 2} y={art.sun.y - art.sun.r / 2} width={art.sun.r} height={art.sun.r} fill={p.glow} opacity="0.95" />
      {art.layers.map((d, i) => (
        <path key={i} d={d} fill={p.layers[i]} />
      ))}
    </svg>
  );
}
