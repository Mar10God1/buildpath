# ConsultationPath Safe Pilot

This checklist defines the minimum operating standard before a real external pilot.

## Implemented
- Organization/project RLS on ConsultationPath data.
- Anonymous access revoked for ConsultationPath email rules, milestones, and audit logs.
- Server-side authenticated transcript processing through the `consultation-ingest` Supabase Edge Function.
- Human Review Inbox remains the approval gate before extracted facts become canonical.
- Database-enforced audit logging for projects, changes/decisions, evidence metadata, review candidates, email rules, and milestones.
- Full transcript bodies are not duplicated into the audit log.
- Stronger 10-character password minimum in ConsultationPath UI.
- Version-controlled database migration and Edge Function source.
- Vercel feature-branch previews used before production merge.
- Self-serve activation checklist guides testers without a setup call.
- In-product pilot feedback captures usefulness, ease-of-use, willingness-to-pay, price expectation and missing capabilities.

## Required before wider beta
- Enable Supabase leaked-password protection.
- Configure custom SMTP for production auth email.
- Provision a separate Supabase staging branch/project and point Vercel Preview to it.
- Add direct Outlook/Teams and Gmail/Zoom integrations.
- Add model-backed extraction/evaluation and quality monitoring.
- Define retention/deletion policy for transcripts and evidence.
- Add automated cross-tenant integration tests with two test organizations.

## Release rule
No schema, RLS, ingestion, or auth change should be tested first against production data. Use the staging branch/database once provisioned, then promote only after the preview passes functional and security checks.


## Cost control
No paid plan, infrastructure upgrade, API subscription, or other recurring/usage-based service may be enabled without explicit owner approval. During validation, prefer existing/free-tier capabilities unless doing so would compromise data security or tester isolation.
