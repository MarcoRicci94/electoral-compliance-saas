# Rules engine

## Objective

The deterministic Rules Engine evaluates the campaign context using a precise `RulesetVersion`, emitting requirements, calculations, findings, tasks and deadlines. It is the sole source of legal applicability and must remain explainable and reproducible.

## Configuration

Each `ComplianceRule` has a stable code, category, severity default, JSON condition DSL, typed effect payload, effective dates, dependency metadata and a `LegalSource`. Numerical values and formulas are versioned parameters, never UI constants. A ruleset can become `ACTIVE` only after JSON-schema validation, source linkage, review metadata and regression tests.

## DSL

Conditions are declarative JSON only. Supported comparisons: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `not_exists`; composition: `all`, `any`, `not`. Field paths resolve against a typed, whitelisted context—not arbitrary objects or executable expressions.

Calculation expressions are a separate typed AST, initially `add`, `subtract`, `multiply`, `divide`, `min`, `max`, constants and whitelisted context fields. Evaluation returns the input snapshot, parameter IDs, rounding policy and result. Decimal arithmetic is mandatory.

## Evaluation lifecycle

Relevant events (campaign, election, contribution, expense, mandatary, document, bank import/reconciliation and proclamation updates) enqueue only dependent rules. Evaluation is idempotent and stores result provenance: ruleset ID, rule ID, input timestamp/hash, source IDs and evaluator version. Failures create an operational error and set campaign state to `EVALUATION_INCOMPLETE`.

## Output semantics

Findings are not tasks. Findings state a detected condition (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `OVERRIDDEN`); tasks are actionable work. `BLOCKER` prevents “ready to file” but never blocks recording real events. Product controls are labelled separately from law or authority guidance.

## Testing

Every rule has fixture-based regression tests, including exact threshold boundaries, P3M versus P90D, leap/month-end dates, and source/version assertions. The Admin Rule Tester uses the same service and returns matched rules, calculations, derived records and sources; it must never implement a second evaluation path.
