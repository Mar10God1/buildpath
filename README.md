# BuildPath

BuildPath is a connected project-memory and intelligence layer for construction projects.

Instead of replacing every project-management system, BuildPath connects evidence from schedules, emails, meeting notes, change orders, invoices, drawings, field updates and photos so teams can understand not just **what** happened, but **why**.

## Initial product principles

1. **One connected project graph** — people, companies, activities, documents, decisions, costs and schedule impacts are related rather than isolated.
2. **Evidence-first intelligence** — every conclusion should be traceable to source evidence.
3. **Canonical records** — multiple references to the same change order, issue or event update one record rather than creating duplicates.
4. **Uncertainty is valid data** — date ranges, confidence and incomplete facts are preserved instead of inventing precision.
5. **Timeline is the backbone** — baseline plan, actual events and forecast are displayed together.
6. **Ask BuildPath** — natural-language questions reconstruct cause and effect across project data.

## V1 information architecture

- Overview
- Timeline
- Ask BuildPath
- People & Companies
- Documents
- Costs
- Schedule
- Project Data

## Core graph model

```text
Project
 ├── Phase / Activity
 ├── Person
 ├── Company
 ├── Document / Evidence
 ├── Conversation
 ├── Decision
 ├── Issue / Risk
 ├── Change Order
 ├── Cost Event
 ├── Schedule Event
 └── Photo / Field Observation

Every object may connect to one or more other objects, and every inferred relationship can retain its evidence and confidence.
```

## Suggested stack

- Next.js App Router + TypeScript
- Supabase Postgres + Auth + Storage
- Vercel
- AI extraction/reconciliation pipeline for incoming evidence

## Next implementation steps

1. Add Supabase schema for projects, entities, evidence, events and relationships.
2. Add authentication and organization/project membership.
3. Build real project creation and project switching.
4. Build evidence ingestion (documents first, then email/calendar connectors).
5. Add extraction + review queue before facts enter the canonical project graph.
6. Turn the demo timeline into baseline vs actual vs forecast.
7. Implement Ask BuildPath with citations back to project evidence.
