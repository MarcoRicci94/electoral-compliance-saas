# Implementation backlog

## Milestone 0 — complete

- Foundation docs, engineering invariants, initial model, rule and security design.
- Environment template and explicit legal-review policy.

## Milestone 1 — application foundation

- Scaffold Next.js/TypeScript/Tailwind/Prisma, local development services and CI quality gates.
- Implement auth, organizations, campaigns, candidate profile, campaign RBAC, scoped repositories and append-only audit infrastructure.
- Deliver responsive dashboard shell and tenant-isolation integration tests.

## Milestone 2 — elections and rules

- Implement election/territory, legal sources, versioned rulesets/parameters, declarative DSL and calculation engine.
- Implement findings, tasks, deadlines, admin rules console and rule tester.
- Add draft-only initial Politiche/Comunali seeds plus boundary regression suite.

## Milestones 3–10

3. Setup wizard and mandatary workflow.
4. Finance, aggregates, budget and limits.
5. Secure documents, asynchronous analysis and verification.
   - Dalla schermata Finanze: inserimento manuale oppure foto/caricamento di fattura o scontrino.
   - OCR e classificazione propongono i campi della spesa; l'utente li verifica prima della registrazione autorevole.
6. Banking import/reconciliation and provider port.
7. Compliance inbox, transparency, privacy and timeline.
8. Snapshotted reports, PDF templates, dossier and filing tracking.
9. Source-aware assistant and planned-operation simulator.
10. OpenAPI, bulk onboarding/export, MFA, observability, security and staging hardening.

## Gated decisions

- Legal reviewer approval and official sources before activating legal seeds.
- Chosen identity, object-storage, email, OCR/AI, malware and Open Banking vendors before their production adapters are enabled.
- Hosting, backup, retention and incident-response policy before production deployment.
