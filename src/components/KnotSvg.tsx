import {
  buildKnot,
  interiorCrossings,
  wallKey,
  type Piece,
  type Point,
  type Strand,
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
// How far an over-crossing patch reaches from the crossing toward each end of
// its piece. The cover layers reach a touch past the ink so no seam shows.
const OVER_INK = 0.66;
const OVER_COVER = 0.7;

const lerp = (p: Point, q: Point, t: number) =>
  p.map((v, n) => +(v + (q[n] - v) * t).toFixed(3));

/** A whole strand as one closed path. Only turns curve; `k` sets how far
 *  their handles pull toward the break (0 = chamfer). */
function strandPath(strand: Strand, k: number) {
  const steps = strand.map(({ a, b, c, kind }) =>
    kind === "turn" ? `C${lerp(a, c, k)} ${lerp(b, c, k)} ${b}` : `L${b}`,
  );
  return `M${strand[0].a}${steps.join("")}Z`;
}

/** The short stretch of a piece either side of its crossing. */
const patchPath = ({ a, b, c }: Piece, reach: number) =>
  `M${lerp(c, a, reach)}L${lerp(c, b, reach)}`;

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
  const { strands } = buildKnot(cols, rows, walls);

  // Ribbons turn on both sides of a break, so the curve must stay clear of it.
  const clearance = Math.min(0.5, s.width / 2 + s.outline + 0.03);
  const k = (s.roundness * Math.max(0, 2 - 4 * clearance)) / 1.5;

  const inkW = s.width + 2 * s.outline;
  const split = s.ribbon === "split";
  const filled = s.ribbon !== "line" && s.colors.length > 0;
  const color = (n: number) => s.colors[n % s.colors.length];

  // Every strand is drawn whole, then each over-crossing is patched on top.
  const overs = strands.flatMap((strand, n) =>
    strand.filter((p) => p.kind === "over").map((piece) => ({ piece, n })),
  );
  const whole = (paint: (n: number) => string, width: number) =>
    strands.map((strand, n) => (
      <path
        key={n}
        d={strandPath(strand, k)}
        stroke={paint(n)}
        strokeWidth={width}
      />
    ));
  const patches = (
    paint: (n: number) => string,
    width: number,
    reach = OVER_COVER,
  ) =>
    overs.map(({ piece, n }, m) => (
      <path
        key={m}
        d={patchPath(piece, reach)}
        stroke={paint(n)}
        strokeWidth={width}
      />
    ));
  const ink = () => s.ink;
  const paper = () => s.paper;

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
      <rect
        x={-PAD}
        y={-PAD}
        width={W + 2 * PAD}
        height={H + 2 * PAD}
        fill={s.paper}
      />
      <g fill="none" strokeLinejoin="round">
        {whole(ink, inkW)}
        {whole(paper, s.width)}
        {split && whole(ink, s.outline)}
        {patches(ink, inkW, OVER_INK)}
        {patches(paper, s.width)}
        {split && patches(ink, s.outline)}
        {filled && (
          <g
            style={{ mixBlendMode: "multiply" }}
            transform={`translate(${s.overprint} ${s.overprint * 0.6})`}
          >
            {whole(color, s.width)}
            {patches(color, s.width)}
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
