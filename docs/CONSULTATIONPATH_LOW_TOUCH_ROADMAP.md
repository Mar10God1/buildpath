# ConsultationPath Low-Touch SaaS Roadmap

## Phase 1 — External tester
Goal: prove that an independent consultant can get value without founder-led onboarding.

Implemented or underway:
- self-serve account and engagement setup
- original scope baseline
- per-engagement workstreams with platform-neutral defaults (rename, add, mark in/out of scope)
- workstream milestones
- original-vs-added scope distinction
- meeting transcript ingestion
- server-side extraction pipeline
- human Review Inbox
- evidence library
- email-rule model
- audit trail
- self-serve activation checklist
- in-product pilot feedback including willingness-to-pay and price expectation
- SOW-assisted baseline recommendations using the existing server-side ingestion pipeline
- deterministic cross-source duplicate suppression across prior changes, milestones and review candidates
- engagement value summary highlighting tracked added fees, potential unbilled scope, schedule movement, evidence captured and reviewed recommendations

Exit criteria:
- tester completes the core workflow independently
- tester uses a real engagement
- product captures at least one meaningful change, milestone, decision or dependency
- feedback identifies willingness-to-pay and the biggest missing workflow

## Phase 2 — 10-user validation
Goal: test repeatability across different platforms and consulting types, not just one tester's ecosystem. Recruit the 10 validation users across at least three platforms or engagement types (for example Salesforce, NetSuite, and an advisory or fractional-CFO practice).

Priority:
1. Model-backed extraction instead of rules-only extraction, only after explicit approval of any paid AI usage.
2. Direct Outlook/Teams integration first when a no-cost or approved-cost connection path is available.
3. Expand duplicate reconciliation beyond text similarity when the validation data justifies it.
4. Automated support/help content.
5. Product analytics for activation and recurring usage.
8. Optional starter workstream templates by engagement type (ERP, CRM, advisory), always editable, never platform-locked.

Do not build enterprise administration prematurely.

## Phase 3 — paid beta
Goal: convert validated users into paying customers with minimal manual support.

Priority:
- subscriptions and entitlements
- trial lifecycle
- automated onboarding email/help
- account/project limits
- data export/delete
- simple firm/team administration
- usage and ingestion health
- error monitoring
- support escalation workflow

## Phase 4 — scalable SaaS
Goal: support hundreds of customers without proportional founder labor.

Priority:
- SSO / stronger organization controls where demanded
- automated integration repair/re-auth flows
- billing dunning and lifecycle automation
- self-service knowledge assistant
- customer health / churn indicators
- formal security/compliance program as buyer requirements justify it

## Do not optimize for
- custom consulting work per customer
- founder-led implementations
- one-off bespoke workflows
- replacing a customer's entire PSA/project-management stack
- features that do not improve acquisition, activation, retention, scope protection or evidence quality
