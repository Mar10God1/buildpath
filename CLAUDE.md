# BuildPath — working rules

BuildPath (construction, aimed at small builders, remodelers and specialty contractors) and ConsultationPath (independent consultants) share this repo, one Next.js app on Vercel and one Supabase project (`cdlhqovdfiolkpfzbtqu`).

## Definition of done

A change is not done until it is live. Before ending a session:

1. **Branch from current `main`.** Run `git fetch origin main` first. Use one short-lived branch per change.
2. **Build passes.** `npx tsc --noEmit` and `npx next build` succeed.
3. **Database matches the code.** If the change adds a file in `supabase/migrations/`, that migration is applied to the live Supabase project before the code reaches `main`. Code that reads a new table must never ship ahead of its migration.
   - Name new migrations with a timestamp later than the newest one already applied (check `supabase_migrations.schema_migrations`), not the date the work started.
4. **Merged and deployed.** The branch is merged to `main`, the Vercel production deployment is `READY`, and the branch is deleted.
5. **If something can't be finished**, say so in the final message: which branch, what's missing, what's needed to land it. Don't leave work silently on a branch.

## Before starting new work

- Check open branches and PRs for unfinished work that touches the same files, and finish or close it first.
- Check for migrations in `supabase/migrations/` that aren't in the live database. Ask the owner before applying them.

## Permissions

All project data access goes through the role system in `lib/buildpath-permissions.ts` and `private.can_project(project_id, capability)` in the database. New tables get RLS policies built on `can_project`, not on org membership alone, and new sidebar modules get a case in `moduleAllowed` in `components/workspace.tsx`.

## Cost guardrail

Do not enable paid infrastructure, subscriptions or usage-based third-party services without explicit owner approval. The Anthropic API (`ANTHROPIC_API_KEY`) is approved for BuildPath's AI features.
