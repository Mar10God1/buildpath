# BuildPath project access and role permissions

## Current implementation

BuildPath supports project-scoped capability grants. The **Access & Roles** screen is available only to organization owners and authorized project administrators. They can assign a preset role and selectively grant/revoke individual permissions. Organization owners always retain full access. A project administrator cannot grant admin rights, modify an owner, or change their own permissions.

Existing team invitations are available through the field contributor invite flow. It requires a named email when used from Access & Roles. The invited person gets a minimal field reporter experience by default; after they accept, an administrator can elevate their project role as needed.

### Presets

| Role | Default access |
| --- | --- |
| Organization owner | All capabilities; immutable via project grants |
| Project administrator | All project capabilities, including managing access; appointed by organization owner |
| Project manager | Project settings, timeline editing, documents, costs, contacts, field review/submissions and vendors |
| Superintendent | Timeline, documents, contacts, field reports and safety |
| Safety officer | Read timeline and documents, field reports and safety details, can upload evidence |
| Finance | Read project/timeline/documents and costs; no safety information by default |
| Field reporter | Read assigned project and submit field evidence; no office reports or cost data |
| Viewer | View project and non-sensitive timeline; no editing or detailed safety access |

The authorization keys are `view_project`, `view_timeline`, `edit_timeline`, `view_documents`, `upload_documents`, `view_costs`, `view_people`, `manage_people`, `view_field`, `submit_field`, `view_safety`, `manage_project`, `manage_vendors`, and `manage_access`. Only the role determines `manage_access`. The other permissions can be overridden per project/member.

## Enforcement

- Supabase RLS is authoritative. The frontend also hides unavailable navigation and editing controls, but **frontend hiding is not the security boundary**.
- `project_access_grants` records explicit roles/overrides, scoped by project and user ID, with a database-validated permission whitelist.
- `private.can_project` resolves the actual authenticated user from Supabase Auth, the organization's owner/admin status, the project assignment, and active field contributor status. A user-editable role preference does **not** confer authorization.
- Project events, documents, field submissions, their source extraction jobs, project settings, vendor workflows, organizations' shared contacts, and related records have capability-based policies. Incident/safety categories require `view_safety` for detailed viewing, with the uploader's own field-report access preserved.
- Role grants cannot target yourself or an organizational owner. Only an organization owner can appoint an admin. Project admins may allocate non-admin roles and their capability overrides.
- Member email lookup uses a permission-checked private-schema function, exposed through a security-invoker RPC.

## Important constraints / future improvements

1. **No non-owner members have been onboarded yet**; database checks confirmed owner access and blocked unknown users, but role-by-role real-user acceptance testing is still needed as teammates join.
2. **Shared organization contacts** are inherently organization-scoped. The authorization layer restricts who can access them, but true per-project contact visibility will require linking contacts to project memberships and changing the shared data model.
3. Certain safety data may arrive as unclassified notes. Sensitivity should be explicit and immutable at ingestion, with detailed medical information separated from ordinary project events and protected storage. Do not rely solely on event title or classification.
4. Storage RLS now checks project role and linked evidence/submission ownership for project assets, document files, field media, and vendor files. Complete end-to-end media download tests with non-owner accounts, and separately audit media transformation, export, search, and notification endpoints before a broad external rollout.
5. Admin audit log for permission edits, team invitations, role expiry, contractor separation, and revocation alerts should be built ahead of broader customer onboarding.
6. Field mobile integration should honor the same project ID and capabilities from signed-in server-side auth. Offline cached information must be cleared on permission revocation or logout; offline enforcement cannot depend solely on locally cached role strings.
7. Existing account password configuration currently has leaked-password protection disabled. Review Supabase Auth hardening before external rollout.

**Cost guardrail:** No new paid integrations or subscriptions are required by the role architecture.
