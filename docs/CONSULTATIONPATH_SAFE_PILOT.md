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
