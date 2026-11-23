/**
 * Gaelic grid knotwork generator.
 *
 * The lattice uses half-cell units: a grid of `cols` x `rows` cells spans
 * (0..2*cols, 0..2*rows). Primary dots sit on (even, even), secondary dots on
 * (odd, odd), and every remaining lattice point (i + j odd) is a crossing.
 * Two strands cross diagonally at each crossing unless a break line ("wall")
 * sits there, in which case the strands bounce off it. The outer border is
 * always walled.
 */

export type Wall = "h" | "v";
export type Walls = Record<string, Wall>;
export type Symmetry =
  | "none"
  | "mirror-x"
  | "mirror-y"
  | "mirror-xy"
  | "rot2"
  | "rot4";

export interface GridSpec {
  cols: number;
  rows: number;
  seed: number;
  /** Probability (0..1) that an interior crossing gets a break line. */
  density: number;
  symmetry: Symmetry;
}

export type Point = [number, number];

export interface Piece {
  a: Point;
  b: Point;
  /** The crossing this piece passes through (or bounces at). */
  c: Point;
  kind: "over" | "under" | "bounce";
  strand: number;
}

export interface Knot {
  pieces: Piece[];
  strandCount: number;
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

// Arm directions: 0 NW, 1 NE, 2 SE, 3 SW.
const DIRS: Point[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

export function buildKnot(cols: number, rows: number, walls: Walls): Knot {
  const W = 2 * cols;
  const H = 2 * rows;
  const stride = W + 1;
  const armId = (i: number, j: number, d: number) => (j * stride + i) * 4 + d;
  const inside = (i: number, j: number) => i >= 0 && i <= W && j >= 0 && j <= H;

  const parent = new Int32Array((W + 1) * (H + 1) * 4).map((_, n) => n);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  const raw: (Omit<Piece, "strand"> & { arm: number })[] = [];

  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      if ((i + j) % 2 !== 1) continue;
      const has = DIRS.map(([dx, dy]) => inside(i + dx, j + dy));
      // Link each arm to the facing arm of the neighbouring crossing.
      for (let d = 1; d <= 2; d++) {
        if (has[d]) {
          const [dx, dy] = DIRS[d];
          union(armId(i, j, d), armId(i + dx, j + dy, (d + 2) % 4));
        }
      }
      const wall = borderWall(i, j, cols, rows) ?? walls[wallKey(i, j)];
      const pairs: [number, number][] =
        wall === "v"
          ? [
              [0, 3],
              [1, 2],
            ]
          : wall === "h"
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [0, 2],
                [1, 3],
              ];
      const overPair = i % 2 === 1 ? 0 : 1;
      pairs.forEach(([p, q], n) => {
        if (!has[p] || !has[q]) return;
        union(armId(i, j, p), armId(i, j, q));
        raw.push({
          a: [i + DIRS[p][0] / 2, j + DIRS[p][1] / 2],
          b: [i + DIRS[q][0] / 2, j + DIRS[q][1] / 2],
          c: [i, j],
          kind: wall ? "bounce" : n === overPair ? "over" : "under",
          arm: armId(i, j, p),
        });
      });
    }
  }

  const ids = new Map<number, number>();
  const pieces: Piece[] = raw.map(({ arm, ...rest }) => {
    const root = find(arm);
    if (!ids.has(root)) ids.set(root, ids.size);
    return { ...rest, strand: ids.get(root)! };
  });
  return { pieces, strandCount: ids.size };
}
