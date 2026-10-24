# RestorePath, LeasePath and EventPath

Three separately branded products on the BuildPath project-memory engine, the same way ConsultationPath is. They start from the lessons of LifePath. A hub at `/paths` links all three.

| Route | Product | For | What it does that BuildPath doesn't |
|---|---|---|---|
| `/restorepath` | RestorePath | Water, fire and mold mitigation | Moisture map against dry goals, equipment days counted in code, an **adjuster-challenge check** (missing readings, equipment left past dry, no work authorization, rooms without photos), supplements from call notes, printable claim packet |
| `/leasepath` | LeasePath | Small landlords and property managers | Move-in/move-out comparison, tenant text → vendor work order, **deposit worksheet** (wear vs damage by tenancy length, prices only from receipts/quotes/approved work orders, flags items the tenant reported during the tenancy, statutory deadline, itemized letter) |
| `/eventpath` | EventPath | Wedding and event planners | Client text → change request split by vendor, per-guest vendors re-price when guests are added, budget vs committed vs pending, payments due, run of show with each vendor's cues, client approval from their own view |

## Status: demo mode

These routes run on seeded demo data kept in the browser (`localStorage`). They do **not** read or write Supabase yet, need no migration, and have no login. Claude drafting goes through `POST /api/verticals/ai`, which uses BuildPath's `lib/ai/claude.ts` when `ANTHROPIC_API_KEY` is set. Without the key it uses a conservative pattern matcher and says so in the UI.

## Layout

- `lib/verticals/core/`: shared model, evidence weights, sharing projections and product config type
- `lib/verticals/products/{restore,lease,event}.ts`: each product as configuration (roles, lanes, sharing categories and levels, prompts)
- `lib/verticals/{restore/drying,lease/deposit,event/budget}.ts`: the domain engines, with all arithmetic done in code
- `lib/verticals/ai/`: prompts/schemas shared by the API route and the no-key fallback
- `lib/verticals/store.tsx` + `seed.ts`: the demo store; same shapes a Supabase store would return
- `components/verticals/`: UI. `verticals.css` is scoped under `.vp-root`; class names BuildPath already uses are `vp-` prefixed, so nothing leaks into BuildPath or ConsultationPath pages
- `tests/verticals-engines.test.ts`: `npm run test:verticals`

## Carried over

**From BuildPath:** forced-tool structured output, never inventing prices, math in code, change-order lifecycle with history, daily logs from the day's captures.

**From LifePath:** date certainty and evidence weights on every record; AI output stays a candidate until confirmed; per-person sharing levels with Custom (Off / Their slice / All), never-shared internal notes, private-note and price stripping, and **View as**; conversation-first capture; photo re-encoding to drop EXIF/GPS; one engine with configuration per vertical instead of separate mini-apps.

## To production (not started)

Map onto existing BuildPath tables rather than new ones:

| Demo shape | BuildPath table |
|---|---|
| `Project` (+ `ext`) | `projects` (+ a jsonb column or per-product tables for rooms/points/equipment, inspections, vendors) |
| `Evidence` | `evidence` + `evidence_links` (add `date_kind`, `source`, `status`, `category`, `private_note`) |
| `ChangeRequest` | `change_orders` (add `assignee_id`, `history`) |
| `DailyLog` | `daily_logs` (add `sections` jsonb) |
| `Person` + sharing | `people` / `project_participants` + a private `sharing_levels` table |

RLS: team access through `private.can_project(project_id, capability)`. Outside parties (adjuster, tenant, owner, vendor, client) read only through security-definer functions that apply the same projection as `lib/verticals/core/sharing.ts`, and approve through a function that checks `approverRoles`. Per the working rules, each of those migrations must be applied before code that reads it reaches `main`.

Before public use: check the three product names for trademark conflicts.
