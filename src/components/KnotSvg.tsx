import {
  buildKnot,
  interiorCrossings,
  wallKey,
  type Piece,
  type Walls,
} from "@/lib/knot";

export type RibbonStyle = "solid" | "split" | "line";

export interface KnotStyle {
  /** Ribbon width in half-cell units. */
  width: number;
  /** Outline thickness in half-cell units. */
  outline: number;
  /** 0 = chamfered turns, 1 = as round as the ribbon width allows. */
  roundness: number;
  ribbon: RibbonStyle;
  paper: string;
  ink: string;
  /** Strand colours; cycled per strand. */
  colors: string[];
  /** Misregistration of the colour plate, in half-cell units. */
  overprint: number;
}

export const defaultKnotStyle: KnotStyle = {
  width: 0.36,
  outline: 0.05,
  roundness: 0.85,
  ribbon: "solid",
  paper: "#f3ecdc",
  ink: "#1b1712",
  colors: ["#2a4b9b", "#c8372d", "#c9972b", "#3f7d5a"],
  overprint: 0.06,
};

const PAD = 0.5;
const EXT = 0.06;

function piecePath(p: Piece, k: number, ext: number) {
  const [ax, ay] = p.a;
  const [bx, by] = p.b;
  const [cx, cy] = p.c;
  const f = (n: number) => +n.toFixed(3);
  const a2 = `${f(ax + (ax - cx) * ext)} ${f(ay + (ay - cy) * ext)}`;
  const b2 = `${f(bx + (bx - cx) * ext)} ${f(by + (by - cy) * ext)}`;
  if (p.kind !== "bounce") return `M${a2}L${b2}`;
  const c1 = `${f(ax + (cx - ax) * k)} ${f(ay + (cy - ay) * k)}`;
  const c2 = `${f(bx + (cx - bx) * k)} ${f(by + (cy - by) * k)}`;
  return `M${a2}L${ax} ${ay}C${c1} ${c2} ${bx} ${by}L${b2}`;
}

interface Props {
  cols: number;
  rows: number;
  walls: Walls;
  style?: Partial<KnotStyle>;
  /** Show the construction grid (dots and break lines). */
  showGrid?: boolean;
  /** When set, interior crossings become clickable. */
  onToggle?: (i: number, j: number) => void;
  className?: string;
  title?: string;
}

export default function KnotSvg({
  cols,
  rows,
  walls,
  style,
  showGrid = false,
  onToggle,
  className,
  title,
}: Props) {
  const s = { ...defaultKnotStyle, ...style };
  const W = 2 * cols;
  const H = 2 * rows;
  const { pieces } = buildKnot(cols, rows, walls);

  // Ribbons bounce on both sides of a wall, so the turn must stay clear of it.
  const clearance = Math.min(0.5, s.width / 2 + s.outline + 0.03);
  const kMax = Math.max(0, (2 - 4 * clearance) / 1.5);
  const k = s.roundness * kMax;

  const under = pieces.filter((p) => p.kind !== "over");
  const over = pieces.filter((p) => p.kind === "over");
  const inkW = s.width + 2 * s.outline;
  const color = (p: Piece) => s.colors[p.strand % s.colors.length];
  const filled = s.ribbon !== "line" && s.colors.length > 0;

  const linePass = (list: Piece[], tag: string) => (
    <g key={tag}>
      {list.map((p, n) => (
        <path key={`i${n}`} d={piecePath(p, k, 0)} stroke={s.ink} strokeWidth={inkW} />
      ))}
      {list.map((p, n) => (
        <path key={`p${n}`} d={piecePath(p, k, EXT)} stroke={s.paper} strokeWidth={s.width} />
      ))}
      {s.ribbon === "split" &&
        list.map((p, n) => (
          <path key={`s${n}`} d={piecePath(p, k, EXT)} stroke={s.ink} strokeWidth={s.outline} />
        ))}
    </g>
  );

  const fillPass = (list: Piece[]) =>
    list.map((p, n) => (
      <path
        key={`${p.kind}${n}`}
        d={piecePath(p, k, EXT)}
        stroke={color(p)}
        strokeWidth={s.width}
      />
    ));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}`}
      width={(W + 2 * PAD) * 40}
      height={(H + 2 * PAD) * 40}
      className={className}
      role="img"
      aria-label={title ?? "Knotwork panel"}
    >
      <rect x={-PAD} y={-PAD} width={W + 2 * PAD} height={H + 2 * PAD} fill={s.paper} />
      <g fill="none" strokeLinecap="butt" strokeLinejoin="round">
        {linePass(under, "under")}
        {linePass(over, "over")}
        {filled && (
          <g
            style={{ mixBlendMode: "multiply" }}
            transform={`translate(${s.overprint} ${s.overprint * 0.6})`}
          >
            {fillPass(under)}
            {fillPass(over)}
          </g>
        )}
      </g>

      {(showGrid || onToggle) && (
        <g data-editor="">
          {showGrid && (
            <g opacity={0.9}>
              <rect
                width={W}
                height={H}
                fill="none"
                stroke={s.ink}
                strokeWidth={0.03}
                strokeDasharray="0.08 0.08"
              />
              {Array.from({ length: (W + 1) * (H + 1) }, (_, n) => {
                const i = n % (W + 1);
                const j = Math.floor(n / (W + 1));
                if ((i + j) % 2 === 1) return null;
                const primary = i % 2 === 0;
                return (
                  <circle
                    key={n}
                    cx={i}
                    cy={j}
                    r={0.07}
                    fill={primary ? s.ink : s.paper}
                    stroke={s.ink}
                    strokeWidth={0.025}
                  />
                );
              })}
              {Object.entries(walls).map(([key, wall]) => {
                const [i, j] = key.split(",").map(Number);
                if (i <= 0 || i >= W || j <= 0 || j >= H) return null;
                const h = wall === "h";
                return (
                  <line
                    key={key}
                    x1={h ? i - 1 : i}
                    y1={h ? j : j - 1}
                    x2={h ? i + 1 : i}
                    y2={h ? j : j + 1}
                    stroke="#d4380d"
                    strokeWidth={0.07}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}
          {onToggle &&
            interiorCrossings(cols, rows).map(([i, j]) => (
              <circle
                key={wallKey(i, j)}
                className="knot-handle"
                cx={i}
                cy={j}
                r={0.42}
                onClick={() => onToggle(i, j)}
              />
            ))}
        </g>
      )}
    </svg>
  );
}
