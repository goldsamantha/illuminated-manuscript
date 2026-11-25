"use client";

import { useMemo, useRef, useState } from "react";
import KnotSvg, {
  defaultKnotStyle,
  type KnotStyle,
  type RibbonStyle,
} from "./KnotSvg";
import {
  buildKnot,
  generateWalls,
  toggleWall,
  type GridSpec,
  type Symmetry,
  type Walls,
} from "@/lib/knot";

const SHAPES = [
  { name: "square", cols: 4, rows: 4 },
  { name: "initial", cols: 6, rows: 6 },
  { name: "column", cols: 2, rows: 12 },
  { name: "band", cols: 12, rows: 2 },
];

const PALETTES: {
  name: string;
  paper: string;
  ink: string;
  colors: string[];
}[] = [
  {
    name: "lapis & vermilion",
    paper: "#f3ecdc",
    ink: "#1b1712",
    colors: ["#2a4b9b", "#c8372d", "#c9972b", "#3f7d5a"],
  },
  { name: "gold leaf", paper: "#f3ecdc", ink: "#2a1d0e", colors: ["#d2a12c"] },
  {
    name: "verdigris",
    paper: "#eef0e4",
    ink: "#12211c",
    colors: ["#3f8f7a", "#1f4e79", "#d9b44a"],
  },
  {
    name: "rubric",
    paper: "#f6efe4",
    ink: "#1b1712",
    colors: ["#c8372d", "#f3ecdc"],
  },
  {
    name: "process cmy",
    paper: "#fbf8f1",
    ink: "#16161d",
    colors: ["#00a8d6", "#e6007e", "#ffd400"],
  },
  { name: "ink only", paper: "#f3ecdc", ink: "#1b1712", colors: [] },
];

const SYMMETRIES: { value: Symmetry; label: string }[] = [
  { value: "none", label: "none" },
  { value: "mirror-x", label: "mirror ↔" },
  { value: "mirror-y", label: "mirror ↕" },
  { value: "mirror-xy", label: "mirror ✛" },
  { value: "rot2", label: "rotate ×2" },
  { value: "rot4", label: "rotate ×4" },
];

const RIBBONS: RibbonStyle[] = ["solid", "split", "line"];

const initialSpec: GridSpec = {
  cols: 4,
  rows: 4,
  seed: 1407,
  density: 0.3,
  symmetry: "rot4",
};

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-[11px] uppercase tracking-widest">
        <span>{props.label}</span>
        <span className="tabular-nums opacity-60">{props.value}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Chips<T extends string>(props: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-widest">
        {props.label}
      </span>
      <div className="flex flex-wrap gap-1">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === props.value}
            onClick={() => props.onChange(o.value)}
            className="chip"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BorderBuilder() {
  const [spec, setSpec] = useState<GridSpec>(initialSpec);
  const [walls, setWalls] = useState<Walls>(() => generateWalls(initialSpec));
  const [style, setStyle] = useState<KnotStyle>(defaultKnotStyle);
  const [palette, setPalette] = useState(PALETTES[0].name);
  const [showGrid, setShowGrid] = useState(true);
  const [copied, setCopied] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  /** Change the grid recipe and regenerate the break lines from it. */
  const respec = (patch: Partial<GridSpec>) => {
    const next = { ...spec, ...patch };
    setSpec(next);
    setWalls(generateWalls(next));
  };

  const restyle = (patch: Partial<KnotStyle>) =>
    setStyle((s) => ({ ...s, ...patch }));

  const strandCount = useMemo(
    () => buildKnot(spec.cols, spec.rows, walls).strands.length,
    [spec.cols, spec.rows, walls],
  );

  const exportSvg = () => {
    const svg = stage.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.querySelectorAll("[data-editor]").forEach((n) => n.remove());
    clone.removeAttribute("class");
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `knot-${spec.cols}x${spec.rows}-${spec.seed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyJson = async () => {
    const data = { cols: spec.cols, rows: spec.rows, walls, style };
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shape = SHAPES.find(
    (s) => s.cols === spec.cols && s.rows === spec.rows,
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-[var(--rule)] p-5 lg:h-screen lg:w-80 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">
            <span className="overprint" data-text="Border builder">
              Border builder
            </span>
          </h1>
          <p className="text-xs leading-relaxed opacity-70">
            Gaelic grid knotwork. Click any crossing on the panel to cycle a
            break line: none → horizontal → vertical.
          </p>
        </header>

        <Chips
          label="shape"
          value={shape?.name ?? null}
          options={SHAPES.map((s) => ({ value: s.name, label: s.name }))}
          onChange={(name) => {
            const s = SHAPES.find((x) => x.name === name)!;
            respec({ cols: s.cols, rows: s.rows });
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="cols"
            min={1}
            max={16}
            step={1}
            value={spec.cols}
            onChange={(cols) => respec({ cols })}
          />
          <Slider
            label="rows"
            min={1}
            max={16}
            step={1}
            value={spec.rows}
            onChange={(rows) => respec({ rows })}
          />
        </div>
        <Chips
          label="symmetry"
          value={spec.symmetry}
          options={SYMMETRIES}
          onChange={(symmetry) => respec({ symmetry })}
        />
        <Slider
          label="break density"
          min={0}
          max={0.8}
          step={0.02}
          value={spec.density}
          onChange={(density) => respec({ density })}
        />

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] uppercase tracking-widest">seed</span>
            <input
              type="number"
              value={spec.seed}
              onChange={(e) => respec({ seed: Number(e.target.value) || 0 })}
              className="field"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => respec({ seed: Math.floor(Math.random() * 100000) })}
          >
            Generate
          </button>
        </div>
        <button type="button" className="btn" onClick={() => setWalls({})}>
          Clear break lines
        </button>

        <hr className="border-[var(--rule)]" />

        <Chips
          label="ribbon"
          value={style.ribbon}
          options={RIBBONS.map((r) => ({ value: r, label: r }))}
          onChange={(ribbon) => restyle({ ribbon })}
        />
        <Slider
          label="ribbon width"
          min={0.12}
          max={0.6}
          step={0.02}
          value={style.width}
          onChange={(width) => restyle({ width })}
        />
        <Slider
          label="outline"
          min={0.01}
          max={0.12}
          step={0.01}
          value={style.outline}
          onChange={(outline) => restyle({ outline })}
        />
        <Slider
          label="roundness"
          min={0}
          max={1}
          step={0.05}
          value={style.roundness}
          onChange={(roundness) => restyle({ roundness })}
        />
        <Slider
          label="overprint offset"
          min={0}
          max={0.2}
          step={0.01}
          value={style.overprint}
          onChange={(overprint) => restyle({ overprint })}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest">palette</span>
          <div className="flex flex-col gap-1">
            {PALETTES.map((p) => (
              <button
                key={p.name}
                type="button"
                aria-pressed={p.name === palette}
                className="chip flex items-center justify-between gap-2 text-left"
                onClick={() => {
                  setPalette(p.name);
                  restyle({ paper: p.paper, ink: p.ink, colors: p.colors });
                }}
              >
                <span>{p.name}</span>
                <span className="flex gap-0.5">
                  {[p.ink, ...p.colors].map((c, n) => (
                    <span
                      key={n}
                      className="h-3 w-3 border border-black/20"
                      style={{ background: c }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          show construction grid
        </label>

        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={exportSvg}>
            Download SVG
          </button>
          <button type="button" className="btn flex-1" onClick={copyJson}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6">
        <div
          ref={stage}
          className="flex w-full flex-1 items-center justify-center"
        >
          <div
            className="w-full"
            style={{
              maxWidth: `calc(82vh * ${(spec.cols * 2 + 1) / (spec.rows * 2 + 1)})`,
            }}
          >
            <KnotSvg
              cols={spec.cols}
              rows={spec.rows}
              walls={walls}
              style={style}
              showGrid={showGrid}
              onToggle={(i, j) =>
                setWalls((w) =>
                  toggleWall(w, i, j, spec.cols, spec.rows, spec.symmetry),
                )
              }
              className="block h-auto w-full shadow-[0_1px_0_var(--rule),0_12px_40px_-20px_rgba(40,25,5,0.5)]"
            />
          </div>
        </div>
        <p className="text-[11px] uppercase tracking-widest opacity-60">
          {spec.cols}×{spec.rows} · {strandCount}{" "}
          {strandCount === 1 ? "strand" : "strands"} ·{" "}
          {Object.keys(walls).length} breaks · seed {spec.seed}
        </p>
      </main>
    </div>
  );
}
