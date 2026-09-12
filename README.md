# Electoral Compliance SaaS

Production-oriented, multi-tenant Italian electoral-compliance platform. It supports a candidate through campaign setup, campaign-finance recording, compliance evaluation, reporting and filing tracking. The product is not an accounting package and does not make autonomous legal decisions.

## Status

Aggiornato al 12 settembre 2026. Lo stato dichiarato qui deve sempre corrispondere al
codice effettivamente presente: le migration Prisma da sole non provano che una
milestone sia completa.

| Milestone                          | Stato       | Cosa esiste davvero                                                                                                                                                              |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Fondazione e documentazione    | Completa    | `AGENTS.md`, `docs/`, backlog, policy legale, `docs/master-prompt.md`.                                                                                                             |
| 1 — Fondazione applicativa         | Completa    | Next.js/Prisma, migration iniziale, autenticazione a password, organizzazioni, campagne, `CampaignMember`, RBAC, audit log append-only, shell di dashboard, test di tenant isolation. |
| 2 — Dati elezione e Rules Engine   | **Parziale** | Schema di `LegalSource`/`RulesetVersion`/`RuleParameter`/`ComplianceRule`/`ComplianceFinding`/`Task`/`Deadline`; DSL delle condizioni e motore di calcolo Decimal come funzioni pure. **Mancano** il servizio di valutazione persistente, la generazione di finding/task/deadline, la console legale di amministrazione, il rule tester e il caricamento dei seed. |
| 3 — Wizard di campagna e mandatario | **Parziale** | `MandataryProfile` con upsert e invito, funzione pura di determinazione, bozza di template documentale. **Mancano** il wizard di onboarding, il questionario finanziario e la rivalutazione automatica al variare delle condizioni. |
| 4 — Finance                        | **Parziale** | Creazione di contributi e spese con audit, riepilogo finanziario aggregato. **Mancano** l'aggregazione per finanziatore, il calcolo del limite di spesa, il budget, il workflow documentale dei contributi societari e la gestione dei contributi in natura. |
| 5–10                               | Non iniziate | Documenti/OCR, banking, compliance e trasparenza, reporting, assistente, API e hardening.                                                                                          |

Nessuna regola legale è attiva: tutti i seed sono `LEGAL_REVIEW_REQUIRED` e restano
bozze finché una fonte ufficiale non viene verificata e collegata.

## Product principles

- The report is built continuously from authoritative campaign records.
- Legal obligations, calculations and deadlines are evaluated by a versioned rules engine.
- AI and OCR can suggest; a human verifies before financial data becomes authoritative.
- Every tenant-scoped operation is authorized by organization and campaign membership.
- Financial records are auditable, soft-deleted where appropriate, and never silently discarded.
- Final reports are immutable snapshots; later changes create a new version.

## Planned stack

Next.js (App Router), TypeScript, React, Tailwind and accessible component primitives; PostgreSQL with Prisma; Zod; Redis/BullMQ; private S3-compatible storage. This remains a modular monolith with REST endpoints under `/api/v1`.

## Local requirements (Milestone 1 onward)

- Node.js 22 LTS and npm 10+
- PostgreSQL 16+
- Redis 7+
- S3-compatible private object storage (or a development adapter)

## Start locally

1. Copy `.env.example` to `.env` and set a 32+ character `SESSION_SECRET`.
2. Start PostgreSQL and Redis locally.
3. Run `npm install`, `npm run db:generate`, `npm run db:deploy`, then `npm run dev`.

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Rules engine](docs/rules-engine.md)
- [Security](docs/security.md)
- [Initial legal-rule policy](docs/legal-rules.md)
- [Implementation backlog](docs/backlog.md)

## Delivery checks

Every implementation milestone must run format, lint, typecheck, unit tests, integration tests, legal-rule regression tests and a production build. See [AGENTS.md](AGENTS.md).
