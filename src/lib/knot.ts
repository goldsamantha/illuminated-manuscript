/**
 * Gaelic grid knotwork generator.
 *
 * The lattice uses half-cell units: a grid of `cols` x `rows` cells spans
 * (0..2*cols, 0..2*rows). Primary dots sit on (even, even), secondary dots on
 * (odd, odd), and every remaining lattice point (i + j odd) is a crossing.
 * Two strands cross diagonally at each crossing unless a break line ("wall")
 * sits there, in which case the strands deflect off it. The outer border is
 * always walled.
 */

export type Wall = "h" | "v";
export type Walls = Record<string, Wall>;
export type Symmetry =
  "none" | "mirror-x" | "mirror-y" | "mirror-xy" | "rot2" | "rot4";

export interface GridSpec {
  cols: number;
  rows: number;
  seed: number;
  /** Probability (0..1) that an interior crossing gets a break line. */
  density: number;
  symmetry: Symmetry;
}

export type Point = [number, number];

/** One step of a strand: from midpoint `a` to midpoint `b`, past `c`. */
export interface Piece {
  a: Point;
  b: Point;
  /** The crossing this piece passes through, or the break it deflects off. */
  c: Point;
  /**
   * `over` / `under`: straight through a crossing.
   * `turn`: deflects off a lone break, curving round it.
   * `run`: deflects off a break with a parallel break next door, so the
   *        strand runs straight alongside the pair.
   */
  kind: "over" | "under" | "turn" | "run";
}

/** A closed loop: each piece ends where the next begins. */
export type Strand = Piece[];

export interface Knot {
  strands: Strand[];
}

export const wallKey = (i: number, j: number) => `${i},${j}`;

export function borderWall(
  i: number,
  j: number,
  cols: number,
  rows: number,
): Wall | null {
  if (j === 0 || j === 2 * rows) return "h";
  if (i === 0 || i === 2 * cols) return "v";
  return null;
}

/** Every interior crossing, in a stable order. */
export function interiorCrossings(cols: number, rows: number): Point[] {
  const out: Point[] = [];
  for (let j = 1; j < 2 * rows; j++) {
    for (let i = 1; i < 2 * cols; i++) {
      if ((i + j) % 2 === 1) out.push([i, j]);
    }
  }
  return out;
}

type Placed = { i: number; j: number; wall: Wall };

/** All images of a wall under the symmetry group (including itself). */
export function orbit(
  i: number,
  j: number,
  wall: Wall,
  cols: number,
  rows: number,
  symmetry: Symmetry,
): Placed[] {
  const W = 2 * cols;
  const H = 2 * rows;
  const swap = (w: Wall): Wall => (w === "h" ? "v" : "h");
  const gens: ((p: Placed) => Placed)[] = [];
  if (symmetry === "mirror-x" || symmetry === "mirror-xy")
    gens.push((p) => ({ ...p, i: W - p.i }));
  if (symmetry === "mirror-y" || symmetry === "mirror-xy")
    gens.push((p) => ({ ...p, j: H - p.j }));
  if (symmetry === "rot2" || (symmetry === "rot4" && cols !== rows))
    gens.push((p) => ({ ...p, i: W - p.i, j: H - p.j }));
  if (symmetry === "rot4" && cols === rows)
    gens.push((p) => ({ i: H - p.j, j: p.i, wall: swap(p.wall) }));

  const seen = new Map<string, Placed>();
  const queue: Placed[] = [{ i, j, wall }];
  while (queue.length) {
    const p = queue.pop()!;
    const k = wallKey(p.i, p.j);
    if (seen.has(k)) continue;
    seen.set(k, p);
    for (const g of gens) queue.push(g(p));
  }
  return [...seen.values()];
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWalls(spec: GridSpec): Walls {
  const { cols, rows, seed, density, symmetry } = spec;
  const rand = mulberry32(seed);
  const walls: Walls = {};
  const visited = new Set<string>();
  for (const [i, j] of interiorCrossings(cols, rows)) {
    if (visited.has(wallKey(i, j))) continue;
    const place = rand() < density;
    const wall: Wall = rand() < 0.5 ? "h" : "v";
    for (const p of orbit(i, j, wall, cols, rows, symmetry)) {
      const k = wallKey(p.i, p.j);
      visited.add(k);
      if (place) walls[k] = p.wall;
    }
  }
  return walls;
}

/** Cycle a crossing none -> h -> v -> none, mirrored through the symmetry. */
export function toggleWall(
  walls: Walls,
  i: number,
  j: number,
  cols: number,
  rows: number,
  symmetry: Symmetry,
): Walls {
  const current = walls[wallKey(i, j)];
  const next: Wall | null = !current ? "h" : current === "h" ? "v" : null;
  const out = { ...walls };
  for (const p of orbit(i, j, next ?? "h", cols, rows, symmetry)) {
    const k = wallKey(p.i, p.j);
    if (next) out[k] = p.wall;
    else delete out[k];
  }
  return out;
}

// A crossing has four arms, one toward each diagonal neighbour.
// 0 NW, 1 NE, 2 SE, 3 SW.
const DIRS: Point[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const opposite = (d: number) => (d + 2) % 4;

/** The arm a strand leaves by, having entered a crossing by arm `d`. */
function exitArm(wall: Wall | undefined, d: number) {
  if (wall === "h") return [1, 0, 3, 2][d];
  if (wall === "v") return [3, 2, 1, 0][d];
  return opposite(d);
}

export function buildKnot(cols: number, rows: number, walls: Walls): Knot {
  const W = 2 * cols;
  const H = 2 * rows;
  const inside = (i: number, j: number) => i >= 0 && i <= W && j >= 0 && j <= H;
  const wallAt = (i: number, j: number) =>
    borderWall(i, j, cols, rows) ?? walls[wallKey(i, j)];

  const visited = new Set<string>();
  const strands: Strand[] = [];

  /** Follow a strand from arm `d` of crossing (i, j) until it closes. */
  const trace = (i: number, j: number, d: number): Strand => {
    const strand: Strand = [];
    while (!visited.has(`${i},${j},${d}`)) {
      const wall = wallAt(i, j);
      const e = exitArm(wall, d);
      visited.add(`${i},${j},${d}`).add(`${i},${j},${e}`);

      const next = (arm: number): Point => [i + DIRS[arm][0], j + DIRS[arm][1]];
      const mid = (arm: number): Point => [
        i + DIRS[arm][0] / 2,
        j + DIRS[arm][1] / 2,
      ];
      const parallel = (arm: number) => wallAt(...next(arm)) === wall;
      // Alternate which diagonal is on top so the weave goes over, under, over.
      const over = (d % 2 === 0) === (i % 2 === 1);

      strand.push({
        a: mid(d),
        b: mid(e),
        c: [i, j],
        kind: !wall
          ? over
            ? "over"
            : "under"
          : parallel(d) || parallel(e)
            ? "run"
            : "turn",
      });
      [i, j] = next(e);
      d = opposite(e);
    }
    return strand;
  };

  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      if ((i + j) % 2 !== 1) continue;
      for (let d = 0; d < 4; d++) {
        if (!inside(i + DIRS[d][0], j + DIRS[d][1])) continue;
        if (!visited.has(`${i},${j},${d}`)) strands.push(trace(i, j, d));
      }
    }
  }
  return { strands };
}
