import Link from "next/link";
import { PRODUCTS, PRODUCT_KEYS } from "@/lib/verticals/products";
import "@/components/verticals/verticals.css";

const CARRIED = [
  ["From BuildPath", [
    "Field capture → AI daily log (RestorePath drying logs)",
    "Client text → AI change order, prices never invented, math in code (supplements, work orders, change requests)",
    "Approval history with who and when; approved changes roll into totals",
    "Evidence-linked timeline for disputes",
  ]],
  ["From LifePath", [
    "Every record carries date certainty, source and strength: exact / approximate / inferred",
    "AI output is a candidate until a person confirms it; corrections outrank everything",
    "Per-person sharing levels + Custom per category, “their slice”, and View as",
    "Private notes never leave the team; photos re-encoded to strip location data",
    "Conversation first, forms second; capture once, link everywhere",
  ]],
] as const;

export const metadata = { title: "RestorePath, LeasePath, EventPath | Built on BuildPath" };

export default function PathsHub() {
  return (
    <div className="vp-root">
    <div className="landing">
      <div className="stack">
        <span className="badge accent" style={{ alignSelf: "flex-start", ["--accent" as string]: "#f97316", ["--accent-dark" as string]: "#c75a0a" }}>Built on the BuildPath engine</span>
        <h1 style={{ fontSize: 34 }}>Restoration, rentals and events</h1>
        <p className="muted" style={{ maxWidth: 680, fontSize: 15, lineHeight: 1.5 }}>
          Each product is configuration over one shared engine: projects, evidence, a timeline, AI-drafted requests and per-person sharing.
          Only the parts that make each trade different are new: drying math, deposit itemization and per-guest repricing.
        </p>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
        {PRODUCT_KEYS.map((k) => {
          const p = PRODUCTS[k];
          return (
            <Link key={k} href={p.basePath} className="card product-card" style={{ ["--accent" as string]: p.accent }}>
              <div className="row"><span className="brand-mark" style={{ background: p.accent }}>{p.name[0]}</span><h2>{p.name}</h2></div>
              <strong>{p.tagline}</strong>
              <ul>{p.pitch.map((x) => <li key={x}>{x}</li>)}</ul>
              <span className="btn primary" style={{ alignSelf: "flex-start", background: p.accent, borderColor: p.accent }}>Open demo →</span>
            </Link>
          );
        })}
      </div>
      <div className="grid2">
        {CARRIED.map(([title, items]) => (
          <div key={title} className="card">
            <h2 style={{ marginBottom: 8 }}>{title}</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="muted small">Also on this engine: <Link href="/">BuildPath</Link> and <Link href="/consultationpath">ConsultationPath</Link>.</p>
    </div>
    </div>
  );
}
