# ConsultationPath Product & Business Strategy

## Objective
Build ConsultationPath into a low-touch SaaS for independent consultants and small consulting firms that can eventually exceed $500K in annual recurring revenue without requiring founder-led onboarding, implementation, or ongoing account management.

## Target customer
ConsultationPath is for independent consultants and small firms who run implementation-style engagements on any platform: Salesforce, NetSuite, HubSpot, ServiceNow, ERP, HCM, CRM, finance systems, custom builds, and similar work. The product is platform-neutral; workstreams are defined per engagement, not hardcoded to any vendor.

The strongest fit is a consultant who:
- bills roughly $150–$300+ per hour
- runs multi-week or multi-month engagements against a SOW
- works with several client stakeholders
- receives requirements through meetings and email
- experiences scope creep and client-side delays
- has to defend why dates or fees changed

Focus without narrowing the product:
- Keep one product and one data model for every consultant.
- Lead marketing with a recognizable segment at a time (for example ERP implementers, CRM/Salesforce consultants, fractional CFOs, RevOps consultants) through separate landing pages, examples and ads, without changing the app per segment.
- The first pilot tester is an implementation consultant; treat his feedback as one implementation profile, not the definition of the market.

Adjacent customers:
- ERP, CRM, HCM and finance-system implementation consultants
- Fractional CFOs and finance transformation consultants
- RevOps, operations and technology consultants
- Cybersecurity consultants
- Small professional-services boutiques

## Core positioning
ConsultationPath is not another project-management system.

**Positioning:** The memory and evidence layer for client engagements.

The product should answer:
- What was originally agreed?
- What changed?
- Who requested it?
- What milestones did it create or move?
- What did the client owe?
- What did the consultant commit to?
- What changed the schedule or fee?
- What evidence supports each conclusion?

## Product-led operating model
The business is being designed to minimize founder involvement.

Target customer journey:
1. Self-serve signup.
2. Create engagement.
3. Upload SOW / baseline evidence.
4. Confirm or rename starting workstreams (platform-neutral defaults) and add milestones.
5. Connect or import meetings and email.
6. ConsultationPath suggests changes, milestones, dependencies and commitments.
7. Consultant reviews/accepts recommendations.
8. Product continuously maintains the engagement history.
9. Customer receives evidence-backed project summaries without manual reconstruction.
10. Billing, renewal and support become self-serve before broader commercialization.

The product should prefer guided workflows, contextual help, automated setup and in-product feedback over required onboarding calls.

## Pricing hypothesis — not yet a commitment
These are validation targets, not published pricing:
- Solo: ~$79/month
- Consultant Pro: ~$129/month
- Boutique: ~$299–$499/month

A useful reference point is ~$99/month. At $99/month, roughly 421 active customers would produce ~$500K ARR.

The long-term owner-income target should be modeled above $500K ARR because infrastructure, AI, payments, support, insurance, accounting and ongoing development will consume part of revenue.

## Validation gates
Before investing heavily:
- 10 independent consultants use the product on real engagements.
- At least 3–5 indicate they would pay approximately $79–$129/month.
- At least one tester uses it repeatedly without founder assistance.
- Users can complete setup, ingest a conversation, review a suggestion and understand project impact without a training call.
- Product demonstrates measurable value such as recovered billable work, avoided scope leakage, reduced reconstruction time, or clearer client accountability.

## Product success metrics
Track:
- activation completion
- time to first evidence item
- time to first meeting ingestion
- first AI suggestion reviewed
- milestones created
- scope additions identified
- return usage
- willingness to pay
- expected monthly price
- top missing capability
- support requests per active user

## Commercialization guardrail
Do not add paid infrastructure, subscriptions, third-party services or plan upgrades without Martin's explicit approval.

Prefer free-tier architecture during validation where it does not compromise tester safety or data isolation. Any feature that introduces a recurring or usage-based charge should be surfaced with its expected cost before activation.

Known cost trigger before charging anyone: Vercel's free Hobby plan is limited to non-commercial use, so accepting payment will require moving to a paid Vercel plan (about $20/month at last check). This requires Martin's approval before the first paying customer.
