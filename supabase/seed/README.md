# BuildPath sample data

`sample_data.sql` creates a self-contained demo company, **Live Oak Builders (Sample)**, with four realistic Austin-area projects:

| Project | Type | Stage | Story |
|---|---|---|---|
| Riverside Medical Office Building | Healthcare, $12.4M | Construction | Framing 14 days late (rain, curtain-wall embed hold, clinical layout rework); CO-017 electrical redesign awaiting owner decision |
| Mueller Residence — Ridge Oak | Residential, $1.85M | Construction | Overdue tile selections, scullery change order, appliance backorder, lender draws |
| Fieldwork Coffee — South Congress TI | Commercial retail, $640k | Closeout | Punch list, retainage release blocked on lien waivers |
| Northbrook Elementary Roof & HVAC | Education / public, $3.25M | Procurement | Asbestos found in roof mastic, 38-week RTU lead time, prevailing wage + HUB plan |

It also includes companies, people, participants, events, evidence documents, evidence links, cause-and-effect relationships, vendors with compliance documents in mixed states, AI review-queue items and field captures.

## Load

1. Open `sample_data.sql` and replace `you@example.com` on the `_seed_owner` line with the email you log in to BuildPath with.
2. Paste the file into the Supabase SQL editor and run it.

Re-running it replaces the sample set; it never touches other organizations.

To regenerate after editing the scenarios:

```
python3 supabase/seed/generate_sample_data.py you@example.com > supabase/seed/sample_data.sql
```

## Remove

```sql
delete from public.organizations where id = 'da091272-ccf7-5f49-a828-02a0e9c8b4c9';
```

All sample rows cascade from that organization.

Note: vendor documents and ingestion jobs reference storage paths under `sample/` that have no real files behind them, so downloads from those rows won't open.
