import Link from "next/link";
import KnotSvg from "@/components/KnotSvg";
import { generateWalls, type GridSpec } from "@/lib/knot";

const column: GridSpec = { cols: 2, rows: 12, seed: 77, density: 0.25, symmetry: "mirror-xy" };
const square: GridSpec = { cols: 4, rows: 4, seed: 1407, density: 0.3, symmetry: "rot4" };

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center gap-8 p-6">
      <KnotSvg cols={column.cols} rows={column.rows} walls={generateWalls(column)} className="hidden h-[80vh] w-auto sm:block" />
      <div className="flex flex-1 flex-col gap-6">
        <KnotSvg cols={square.cols} rows={square.rows} walls={generateWalls(square)} className="h-40 w-40" />
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          <span className="overprint" data-text="Illuminated Manuscript">
            Illuminated Manuscript
          </span>
        </h1>
        <p className="max-w-prose text-sm leading-relaxed opacity-80">
          An interactive manuscript whose decorated letters and marginalia are portals between
          planes. First tool on the bench: a generative builder for the knotwork columns and
          squares that sit within the text.
        </p>
        <Link href="/builder" className="btn btn-primary self-start">
          Open the border builder →
        </Link>
      </div>
      <KnotSvg
        cols={column.cols}
        rows={column.rows}
        walls={generateWalls({ ...column, seed: 78 })}
        className="hidden h-[80vh] w-auto sm:block"
      />
    </main>
  );
}
