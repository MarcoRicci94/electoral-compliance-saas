# Architecture

## Decision

The system is a TypeScript modular monolith. It exposes a Next.js App Router web application and versioned REST endpoints under `/api/v1`, backed by PostgreSQL, Prisma, Redis/BullMQ and private object storage. This minimizes operational complexity while preserving clean module boundaries for future extraction only when justified by scale.

## Module boundaries

| Module                | Owns                                                      | Must not decide                            |
| --------------------- | --------------------------------------------------------- | ------------------------------------------ |
| Auth & organizations  | identities, sessions, memberships, RBAC                   | campaign legal eligibility                 |
| Campaigns & elections | campaign profile, election, territory                     | finance calculations                       |
| Finance               | donors, contributions, expenses, allocations              | legal thresholds                           |
| Banking               | accounts, imports, transactions, reconciliations          | authoritative matches without confirmation |
| Documents             | immutable files, versions, analyses                       | authoritative finance mutations from AI    |
| Rules & compliance    | versioned rules, calculations, findings, tasks, deadlines | UI presentation                            |
| Reporting             | snapshots, reports, filing dossier and tracking           | rewriting finalized reports                |
| Administration        | legal sources, rulesets, templates, authorities           | bypassing audit controls                   |

## Request flow

```text
UI / external client
  -> /api/v1 route handler (Zod validation + authorization)
  -> application service (transaction + domain event + audit event)
  -> Prisma/PostgreSQL
  -> projection/job enqueue where relevant
```

Example: `ContributionCreated` updates donor aggregates, evaluates dependent rules, creates or updates findings and tasks, attempts a non-authoritative banking suggestion, updates dashboard projections, and records an audit event. Handlers must be idempotent and retry-safe.

## Authorization model

`Organization -> Campaign` is the tenancy hierarchy. A request first resolves the authenticated user’s active organization membership, then campaign membership and permission. All repository/service queries accept a scoped access context. Public identifiers do not confer access.

Roles initially are `CANDIDATE`, `MANDATARY`, `ADVISOR`, and `CONTRIBUTOR`; permissions are capabilities, not licences. System administration is a separate, audited role.

## Provider ports

Use interfaces at the application boundary: `StorageProvider`, `MalwareScanner`, `OcrProvider`, `DocumentAnalysisProvider`, `BankingProvider`, `NotificationProvider`, and `AssistantProvider`. A mock/development adapter is acceptable; live integrations require explicit configuration and must report their connection state truthfully.

## Failure policy

If rules cannot be evaluated, campaign compliance is `EVALUATION_INCOMPLETE`, never complete. AI uncertainty is retained with confidence and provenance. Background jobs use idempotency keys, bounded retries, failure observability and a recoverable dead-letter state.

## Future composition

Rulesets compose by jurisdiction/layer: `ITALY_BASE`, election-type rules, and later regional or municipality-specific overlays. List/party features reuse Organization, Campaign, ExpenseAllocation and bulk onboarding without changing the candidate campaign’s tenancy boundary.
