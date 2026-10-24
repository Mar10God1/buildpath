"use client";

import type { Evidence } from "@/lib/verticals/core/types";
import { DATE_KIND_LABELS, SOURCE_LABELS, strength, strengthLabel } from "@/lib/verticals/core/evidence";

export const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });

export function fmtDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function fmtTime(iso: string) {
  const t = iso.slice(11, 16);
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

export function Photo({ e, large }: { e: Pick<Evidence, "photo" | "data" | "title">; large?: boolean }) {
  const src = typeof e.data?.src === "string" ? (e.data.src as string) : null;
  const hue = e.photo?.hue ?? 200;
  return (
    <div
      className={`photo${large ? " lg" : ""}`}
      title={e.title}
      style={src ? { backgroundImage: `url(${src})` } : { background: `linear-gradient(135deg,hsl(${hue} 45% 62%),hsl(${(hue + 40) % 360} 40% 38%))` }}
    >
      {src ? "" : e.photo?.label ?? "Photo"}
    </div>
  );
}

/** The LifePath trio on every record: date certainty, source, and how well it holds up. */
export function EvidenceBadges({ e }: { e: Evidence }) {
  const s = strengthLabel(strength(e));
  return (
    <>
      {e.status === "candidate" && <span className="badge cand">Needs review</span>}
      <span className={`badge ${e.dateKind === "exact" ? "" : "warn"}`} title="How sure we are about the date">{DATE_KIND_LABELS[e.dateKind]}</span>
      <span className="badge" title="Where this came from">{SOURCE_LABELS[e.source] ?? e.source}</span>
      <span className={`badge ${s.tone}`} title="How well this would hold up in a dispute">{s.label}</span>
    </>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`stat${accent ? " accent" : ""}`}>
      <span className="muted small">{label}</span>
      <b>{value}</b>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Downscale a photo in the browser so demo storage stays small. */
export function readPhoto(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.72)); // re-encoding drops EXIF/GPS, as LifePath's shared media does
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
