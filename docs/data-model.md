# Data model

## Core tenancy

`User`, `Organization`, `OrganizationMember`, `Campaign`, `CampaignMember`, `Election`, `Territory`, `CandidateProfile`, and `MandataryProfile` establish identity and scope. Election-wide data belongs to `Election`/`Territory`, not duplicated per campaign.

## Finance

`Donor` and `Supplier` are reusable identity records; campaign-specific financial facts are `Contribution`, `CorporateContributionDetails`, `InKindContribution`, `Expense`, and `ExpenseAllocation`. Contributions, services, invoices, obligations and bank payments are distinct. `Expense.relevantAmountForLimit` is determined by the active ruleset and may differ from gross amount. All monetary fields use `numeric` plus ISO currency (initially EUR).

Donor aggregation is a domain projection keyed by donor, campaign/election/year period and ruleset context. It is recalculated transactionally or by idempotent events, never only in the browser.

## Banking and documents

`BankAccount`, `BankConnection`, `ImportBatch`, `BankTransaction`, and `Reconciliation` represent source data and confirmation state. Imports deduplicate by stable provider ID or deterministic fingerprint. A reconciliation is only authoritative at `CONFIRMED`.

`Document` is immutable original-file metadata; `DocumentVersion` references replacement versions; `DocumentAnalysis` stores model output separately from verified data. Store SHA-256, content metadata, private storage key, provenance and verification state. Do not mutate source files.

## Rules and compliance

`LegalSource`, `RulesetVersion`, `ComplianceRule`, and versioned rule parameters define the legal configuration. `ComplianceFinding`, `Task`, and `Deadline` are derived operational records. A deadline stores trigger, offset definition and calculated date. Findings may be overridden only with actor, reason and date preserved.

## Reporting and governance

`Report`, immutable `ReportSnapshot`, `Filing`, `Authority`, authority communication/request records, `TransparencyRecord`, `PrivacyCampaignProfile`, `MunicipalLocalRulesStatus`, and append-only `AuditLog` complete the V1 model.

## Integrity constraints

- Add `organization_id` and/or `campaign_id` to operational records and index it with common filters.
- A campaign has at most one active mandatary unless an explicit historical workflow allows otherwise; violations remain findings, not discarded data.
- Unique document SHA checks are scoped deliberately: exact duplicate detection must not leak another tenant’s document.
- Soft-deleted material records retain `deleted_at` and `deleted_by`; every deletion/restoration emits an audit entry.
- A finalized report references a frozen snapshot and never reads live facts for reproducibility.
