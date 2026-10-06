# BuildPath

**Less paperwork. More building.**

BuildPath is job software for small builders, remodelers and specialty contractors (roughly $2–20M a year). Most tools make the contractor type data in. BuildPath captures it from the site and does the paperwork:

- **Snap photos and talk through the day** → BuildPath writes the daily log.
- **A client texts asking for an extra outlet** → BuildPath drafts the change order, ready to price and send.
- **A dispute about cost or delays** → BuildPath shows the full timeline with the evidence behind every step.

Under the hood, every photo, voice note, receipt, email and document is kept as evidence and linked to the job, the people involved and the decisions made. That connected record is what makes the AI outputs trustworthy and traceable.

## Who it's for

Custom home builders, remodelers, and small commercial or specialty contractors who are big enough to feel the admin pain, too small for Procore or Autodesk Build, and frustrated with tools that just add data entry.

## What's in the app today

| Area | What it does |
|---|---|
| Field Capture (`/field`) | Mobile capture of progress photos, receipts, invoices, deliveries, incidents, safety notes and voice notes (with dictation) |
| Daily Logs (`/daily-logs`) | Claude writes the day's log from that day's field captures and photos; edit, finalize, print |
| Change Orders (`/change-orders`) | Paste or dictate a client request; Claude drafts scope and line items (never invents prices); price it, mark sent, record approval. Approved changes roll into the job's cost and schedule |
| Upload & Extract (`/documents/upload`) | Claude reads uploaded PDFs/text and proposes dates, costs, people, change requests and requirements for review |
| Subs & Vendors (`/vendors`) | Sub onboarding: W-9, insurance and payment details |
| Job workspace (`/`) | Job overview, timeline, documents, people, cost and schedule, with modules tailored to the job type and your role |

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Supabase Postgres, Auth and Storage (row-level security on every table)
- Claude (Anthropic API) for extraction and drafting, via `@anthropic-ai/sdk`

## Configuration

Copy `.env.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`: required for AI features. Without it, document extraction falls back to pattern matching and the daily-log and change-order buttons explain that AI isn't set up yet.
- `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-5-5`

## Database

`supabase/schema.sql` is the original base schema. Later changes live in `supabase/migrations/`. The earlier migrations were applied directly in Supabase and haven't all been copied into the repo yet.

## Roadmap

1. **Milestone 1 (this release):** small-builder positioning, AI daily logs, AI change-order drafts, client records
2. Client portal: homeowners see updates, approve change orders with e-signature, make selections
3. Money loop: estimates/budget lines, invoices and progress draws, QuickBooks sync
4. Capture where builders already talk: a forwarding email address per job, then a text-in number
5. Self-serve signup, Stripe billing, and import from spreadsheets, Buildertrend or JobTread
6. Ask BuildPath answering with citations back to the evidence

Deliberately paused until we move upmarket: RFIs, submittals, procurement, commissioning, compliance programs, and Procore/Autodesk integrations.
