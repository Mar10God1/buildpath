import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFor } from "../lib/verticals/seed";
import { PRODUCTS } from "../lib/verticals/products/index";
import { dryingFindings, equipmentDays, pointStatuses, roomDryDay } from "../lib/verticals/restore/drying";
import { classify, depositRows, depositSummary } from "../lib/verticals/lease/deposit";
import { budgetSummary, expandGuestLines } from "../lib/verticals/event/budget";
import { accessMap, projectEvidence, projectRequests } from "../lib/verticals/core/sharing";
import { evidenceWinner } from "../lib/verticals/core/evidence";
import { fallbackCapture, fallbackRequest } from "../lib/verticals/ai/fallback";
import { priceLines } from "../lib/verticals/client-ai";

const today = new Date().toISOString().slice(0, 10);

test("drying: hall dries, gap on P2 is flagged, overstay is flagged", () => {
  const d = seedFor("restore");
  const p = d.projects[0];
  const { rows } = pointStatuses(p, d.evidence);
  assert.ok(roomDryDay("rm_hall", rows), "hall should be dry");
  assert.equal(roomDryDay("rm_kitchen", rows), null, "kitchen P3 still wet");
  const f = dryingFindings(p, d.evidence, `${today}T18:00:00`);
  assert.ok(f.some((x) => x.severity === "risk" && x.title.startsWith("No reading at P2")), "P2 gap");
  assert.ok(f.some((x) => /AM-13 ran \d+ days? past dry/.test(x.title)), "hall air mover overstay");
  assert.ok(!f.some((x) => /work authorization/.test(x.title)), "authorization is on file");
});

test("drying: equipment days are started 24h periods", () => {
  assert.equal(equipmentDays({ id: "x", type: "Air mover", tag: "A", roomId: "r", placedAt: "2026-10-01T11:00:00", removedAt: "2026-10-03T10:00:00" }, ""), 2);
  assert.equal(equipmentDays({ id: "x", type: "Air mover", tag: "A", roomId: "r", placedAt: "2026-10-01T11:00:00", removedAt: "2026-10-03T12:00:00" }, ""), 3);
});

test("deposit: wear vs damage, tenant-reported leak not charged, no double counting", () => {
  assert.equal(classify({ id: "a", room: "", item: "", condition: "good", photoIds: [] }, { id: "b", room: "", item: "", condition: "fair", photoIds: [] }, 13).cls, "normal_wear");
  assert.equal(classify({ id: "a", room: "", item: "", condition: "good", photoIds: [] }, { id: "b", room: "", item: "", condition: "fair", photoIds: [] }, 6).cls, "damage");
  const d = seedFor("lease");
  const rows = depositRows(d.projects[0], d.evidence, d.requests);
  const vanity = rows.find((r) => r.item === "Vanity cabinet")!;
  assert.equal(vanity.classification, "damage");
  assert.equal(vanity.include, false, "tenant reported the leak twice");
  assert.equal(vanity.priorReports.length, 2);
  const door = rows.find((r) => r.item === "Closet door")!;
  assert.equal(door.suggested, 150, "quote cited by the work order is counted once");
  const blinds = rows.find((r) => r.item === "Window blinds")!;
  assert.equal(blinds.classification, "no_baseline");
  const s = depositSummary(d.projects[0], rows, today);
  assert.equal(s.deductionsTotal, 240 + 150);
  assert.equal(s.refund, 1800 - 390);
});

test("event: added guests re-price per-head vendors; unpriced stays null", () => {
  const d = seedFor("event");
  const p = d.projects[0];
  const { items, guestDelta } = expandGuestLines(p, [{ description: "Additional guests", code: null, quantity: 12, unit: "guest", unit_price: null, amount: null }]);
  assert.equal(guestDelta, 12);
  assert.equal(items.find((i) => i.description.startsWith("Saffron Table"))!.amount, 12 * 118);
  const priced = priceLines([...items, { description: "Sparkler send-off", code: null, quantity: null, unit: null, unit_price: null }]);
  assert.equal(priced.total, null, "one unpriced line means no total");
  const s = budgetSummary(p, d.requests);
  assert.equal(s.approvedTotal, 1450);
  assert.equal(s.pendingUnpriced, 1);
});

test("sharing: projections hide internal, candidates, drafts and money per level", () => {
  const d = seedFor("restore");
  const cfg = PRODUCTS.restore;
  const homeowner = d.people.find((p) => p.role === "homeowner")!;
  const adjuster = d.people.find((p) => p.role === "adjuster")!;
  const seen = projectEvidence(cfg, homeowner, d.evidence);
  assert.ok(!seen.some((e) => e.category === "internal" || e.category === "carrier" || e.status === "candidate"));
  assert.ok(seen.every((e) => e.privateNote === undefined && e.amount === undefined));
  assert.ok(seen.some((e) => e.id === "e_r8"), "homeowner sees their own text (their slice)");
  assert.equal(accessMap(cfg, adjuster).internal, "off");
  assert.ok(projectEvidence(cfg, adjuster, d.evidence).some((e) => e.category === "carrier"));
  assert.equal(projectRequests(cfg, homeowner, d.requests).length, 0);

  const ev = seedFor("event");
  const vendor = ev.people.find((p) => p.id === "p_nova")!;
  const reqs = projectRequests(PRODUCTS.event, vendor, ev.requests);
  assert.deepEqual(reqs.map((r) => r.id), ["ch_2"], "DJ sees only the change assigned to them");
});

test("evidence: a person's correction is never overwritten", () => {
  assert.equal(evidenceWinner({ source: "user_correction" }, { source: "instrument" }), "keep");
  assert.equal(evidenceWinner({ source: "call_note" }, { source: "signed_document" }), "replace");
});

test("fallback AI never invents prices and finds readings", () => {
  const cfg = PRODUCTS.event;
  const ctx = { projectName: "x", projectSummary: "", people: [{ name: "Priya Rao", role: "Client" }], today };
  const draft = fallbackRequest(cfg, ctx, "Priya: can we add a sparkler send-off? Also mom wants 12 more guests.");
  assert.ok(draft.line_items.every((l) => l.unit_price === null));
  assert.ok(draft.line_items.some((l) => l.unit === "guest" && l.quantity === 12));
  assert.equal(draft.requested_by, "Priya");
  const cap = fallbackCapture(PRODUCTS.restore, { ...ctx, people: [] }, "Kitchen subfloor at P3 read 31 today, still wet.");
  assert.deepEqual(cap[0].reading, { point: "P3", value: 31 });
});
