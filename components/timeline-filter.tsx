"use client";

import { type CSSProperties } from "react";
import { type EventCategory, categoryForEvent, categoryGlyph, categoryName, eventCategories } from "@/components/project-schedule-timeline";
import styles from "./timeline-filter.module.css";

type FilterableEvent = { event_type: string; title: string; schedule_impact_days: number | null };

// Matches the marker colours used on the schedule chart.
const categoryColor: Record<EventCategory, string> = {
  milestone: "#c9922a", weather: "#388dc2", injury: "#c23941", setback: "#d97836", change: "#9268bb",
  decision: "#45a180", field: "#6885aa", meeting: "#5f8291", general: "#8a949a",
};

/**
 * Multi-select category filter for the project timeline.
 * An empty selection means "show everything".
 */
export function TimelineFilter({ events, selected, onChange }: {
  events: FilterableEvent[];
  selected: EventCategory[];
  onChange: (next: EventCategory[]) => void;
}) {
  const counts = new Map<EventCategory, number>();
  for (const e of events) {
    const c = categoryForEvent(e);
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  // Only offer categories this project actually has, in a stable order.
  const available = eventCategories.filter(c => counts.has(c));
  if (available.length < 2) return null;

  const toggle = (c: EventCategory) => {
    const next = selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c];
    // Selecting every category is the same as no filter.
    onChange(next.length === available.length ? [] : next);
  };
  const shownCount = selected.length ? selected.reduce((s, c) => s + (counts.get(c) || 0), 0) : events.length;

  return <div className={styles.bar} role="group" aria-label="Filter timeline by category">
    <span className={styles.label}>Show</span>
    <button type="button" className={styles.chip} aria-pressed={selected.length === 0} onClick={() => onChange([])}>
      All <b>{events.length}</b>
    </button>
    {available.map(c => (
      <button type="button" key={c} className={styles.chip} aria-pressed={selected.includes(c)}
        style={{ "--chip": categoryColor[c] } as CSSProperties} onClick={() => toggle(c)}>
        <i aria-hidden="true">{categoryGlyph[c]}</i>{categoryName[c]} <b>{counts.get(c)}</b>
      </button>
    ))}
    {selected.length > 0 && <span className={styles.summary}>
      {shownCount} of {events.length} events
      <button type="button" className={styles.clear} onClick={() => onChange([])}>Clear</button>
    </span>}
  </div>;
}
