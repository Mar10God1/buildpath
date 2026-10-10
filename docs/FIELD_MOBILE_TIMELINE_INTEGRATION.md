# BuildPath timeline and future field-mobile integration

## Purpose
The project timeline is a **read model of the canonical project record**, not a separate data silo. A future iOS/Android field app must be able to contribute time-stamped observations, photos, audio notes, weather interruptions, injuries, deliveries, and progress updates without duplicating manual entries or overwriting baseline schedule facts.

## Existing foundation (October 2026)
- `app/field/page.tsx` already has a mobile-oriented field capture experience with photo/file/audio, optional device location, per-project capture, signed-in user, and `field_submissions` plus source `evidence`.
- `app/api/field-process/route.ts` proposes extracted facts with evidence/submission IDs through `ingestion_jobs` and `extraction_candidates`. These candidates **require review**; they are not automatically verified canonical events.
- `project_events` is the timeline's canonical event source. It records event type, text, start/end dates, schedule impact, status, and cost impact.
- `evidence` contains source-system, occurred-at, file path, uploader, and flexible metadata. `evidence_links` connects source records to canonical entities.
- The timeline now renders all `project_events` with weather, safety, and setback classification. Its colored bands are based only on actual recorded start/end dates. **A field observation is not automatically a verified schedule delay.**

## Proposed shared intake contract for a future mobile app
The mobile client should submit to a protected, project-scoped ingestion endpoint instead of writing directly to `project_events`.

| Field | Meaning |
| --- | --- |
| `project_id` | Authorized project, selected explicitly |
| `client_event_id` | Stable UUID created once on device, used for retry deduplication |
| `source` | `field_mobile`, `field_web`, `manual`, or an approved integration |
| `reporter_id`, `device_id` | Authenticated submitter; pseudonymous device identifier if truly necessary |
| `observed_at` | When the incident happened, with offset/timezone |
| `submitted_at`, `received_at` | Client time and trusted server arrival time |
| `start_at`, `end_at` | Optional verified event interval, **not** an inferred impact duration |
| `category` | Controlled category: weather, injury/safety, work delay, field update, delivery, etc. |
| `description`, `photos`, `audio` | Immutable/raw evidence references; do not place media blobs in `project_events` |
| `location`, `accuracy`, `consent` | Optional permitted geo-context, never silently gathered or displayed |
| `workstream_id` / `milestone_id` | Optional relationships to affected work, not automatic causation |
| `reported_impact_days` | User-reported estimate, distinguished from approved schedule impact |
| `review_status` | Received → proposed → reviewed/verified or rejected |
| `schema_version` | Enables future mobile client compatibility |

These are **future contract fields**, not columns claimed to exist already. Use existing `evidence.metadata` and `field_submissions.metadata` during early pilots. Add dedicated columns/indexes only when the live mobile ingestion flow and idempotent upsert are implemented and tested.

## Event lifecycle
1. Device captures evidence locally (allow intermittent connectivity and queued retry).
2. Backend validates the user, project membership, file type/size, and consent; assigns trusted receipt time.
3. Persist source evidence and a stable `client_event_id` idempotency key to prevent duplicates on retry. A server-side unique constraint should be added before opening the endpoint to mobile clients.
4. Derive proposed event category/date/impact from report, photo metadata, and optional notes, preserving source and confidence.
5. Link or deduplicate with existing canonical events using evidence connections plus human confirmation where ambiguous; **never create a second injury or delay merely because two devices reported it**.
6. Reviewer confirms factual details. Promoted facts update/create canonical `project_events`; link their provenance via `evidence_links`.
7. Timeline reads the canonical event table, shows categorical flags, source links, actual occurrence intervals, and clearly labeled impact estimates. Edits never delete original source evidence.

## Safety and privacy
- Medical details about injuries require stricter visibility than ordinary project progress; the general timeline should default to a category-level summary rather than identify injured workers or expose medical notes.
- Geolocation is opt-in and captured only when appropriate and permitted, with clear controls and retention policy.
- Keep original media private; use scoped authorization and project membership checks, plus authorization on evidence retrieval. Never expose elevated API/service keys in phone clients.
- Do not interpret weather conditions alone as project delay; delay needs a report or explicit project record. Likewise, reporting an injury is not by itself proof of schedule impact.
- Baseline milestones, reported events, verified impacts, and schedule forecast remain distinct concepts. A critical-path delay requires schedule analysis, not summing event durations.

## Near-term implementation boundary
The first pass introduces timeline disruption visuals, event type selection, event date intervals, and field-web capture categories. It does **not** claim that raw field uploads instantly create verified timeline events, that a native app exists, or that offline syncing and automatic forecasts are already working. Those are later implementation phases.

**Cost guardrail:** no paid third-party weather, mapping, notification, or image APIs without explicit approval.
