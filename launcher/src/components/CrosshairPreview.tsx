// Desenha a mira com a mesma geometria do CrosshairModule do mod (em pixels da GUI, ampliado).

interface Props {
  style: string;
  size: number;
  gap: number;
  thickness: number;
  color: string;
  outline: boolean;
  dot: boolean;
  scale?: number;
}

type R = [number, number, number, number];

function rects({ style, size, gap, thickness, dot }: Props): { boxes: R[]; ring: null | { r: number; t: number } } {
  const t = thickness;
  const h = Math.floor(t / 2);
  const boxes: R[] = [];
  if (style === "dot") return { boxes: [[-h - 1, -h - 1, t + 2, t + 2]], ring: null };
  if (style === "circle") {
    if (dot) boxes.push([-h, -h, t, t]);
    return { boxes, ring: { r: size, t } };
  }
  const sp = style === "plus" ? 0 : gap;
  boxes.push([-sp - size, -h, size, t]);
  boxes.push([sp + (sp === 0 ? t - h : 1), -h, size, t]);
  boxes.push([-h, sp + (sp === 0 ? t - h : 1), t, size]);
  if (style !== "t") boxes.push([-h, -sp - size, t, size]);
  if (sp === 0 || dot) boxes.push([-h, -h, t, t]);
  return { boxes, ring: null };
}

export function CrosshairPreview(props: Props) {
  const scale = props.scale ?? 4;
  const { boxes, ring } = rects(props);
  const half = 20;
  const grow = (b: R, g: number): R => [b[0] - g, b[1] - g, b[2] + g * 2, b[3] + g * 2];
  return (
    <svg
      width={half * 2 * scale}
      height={half * 2 * scale}
      viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}
      shapeRendering="crispEdges"
      aria-label="Prévia da mira"
    >
      {props.outline && boxes.map((b, i) => { const [x, y, w, h] = grow(b, 1); return <rect key={`o${i}`} x={x} y={y} width={w} height={h} fill="rgba(0,0,0,.75)" />; })}
      {props.outline && ring && <circle r={ring.r - ring.t / 2 + 0.5} fill="none" stroke="rgba(0,0,0,.75)" strokeWidth={ring.t + 2} />}
      {boxes.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={props.color} />)}
      {ring && <circle r={ring.r - ring.t / 2 + 0.5} fill="none" stroke={props.color} strokeWidth={ring.t} />}
    </svg>
  );
}
