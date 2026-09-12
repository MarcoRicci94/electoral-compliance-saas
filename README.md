# Electoral Compliance SaaS

Production-oriented, multi-tenant Italian electoral-compliance platform. It supports a candidate through campaign setup, campaign-finance recording, compliance evaluation, reporting and filing tracking. The product is not an accounting package and does not make autonomous legal decisions.

## Status

Milestone 1 — application foundation — is implemented. It includes the Next.js/TypeScript shell, Prisma schema and reproducible initial migration, password authentication, organization and campaign creation services, RBAC foundations, tenant-scoped access services, audit logging and a responsive dashboard shell. Legal rules remain intentionally out of scope until Milestone 2.

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
