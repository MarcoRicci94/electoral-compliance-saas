# Engineering instructions

## Product invariants

1. Legal decisions, thresholds, formulas, deadlines and report readiness belong to the Rules Engine, never React components, free-form API conditionals or an LLM.
2. Every active legal rule has a `LegalSource`, unless explicitly classified as a `SYSTEM_CONTROL` or `PRODUCT_BEST_PRACTICE`.
3. AI/OCR extraction is non-authoritative until a user with appropriate permission verifies it. Never silently create or alter finance records from model output.
4. Every campaign read or write must prove organization membership and campaign membership. Do not authorize by entity ID alone.
5. Reports use immutable snapshots; final reports are never mutated. Underlying changes make a report stale and require a new version.
6. Preserve historical facts: use audit events and soft deletion for material financial data. Overrides retain the rule, finding, reason, actor and timestamp.
7. Never make a silent legal-rule change. Ambiguity or missing authoritative evidence is `LEGAL_REVIEW_REQUIRED`.

## Architecture and naming

- Build a TypeScript modular monolith. Domain modules: auth, organizations, campaigns, elections, finance, banking, documents, rules, compliance, reporting, notifications and administration.
- Put business logic in domain/application services, not pages or route handlers. Route handlers validate input, authorize, invoke a service and serialize typed output.
- Use singular PascalCase domain types, `camelCase` TypeScript members and `snake_case` database columns through Prisma mappings where useful.
- Store authoritative money as PostgreSQL `numeric`/Prisma `Decimal`; never calculate money with JavaScript floats.
- Store legal calendar values as date-only data; timestamps are UTC. Model `P3M` separately from `P90D`.
- Use transactional writes for finance, audit and report-finalization workflows. Domain events are application-level and processed idempotently.

## Database and migrations

- Schema changes require a reviewed Prisma migration; never rely on `db push` outside local exploration.
- Index tenant and high-volume query paths. Seed data must be idempotent and must label unverified legal material.
- Do not use unscoped Prisma reads such as `findUnique({ where: { id } })` for campaign data. Resolve access first and include tenant/campaign scope.

## Testing and completion

Required checks before declaring an implementation task complete: format, lint, typecheck, unit tests, integration tests, rules regression tests and build.

Tests must cover authorization boundaries and legal threshold boundaries (`<`, `<=`, `>`, `>=`). Do not weaken a regression test to make a change pass without documenting a legal review.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
