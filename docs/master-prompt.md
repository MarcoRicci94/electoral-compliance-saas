<!--
Fonte: chat ChatGPT del progetto — https://chatgpt.com/share/6a99e3bd-42f8-83ed-af57-74a1065a2cf1
Questo e' il prompt originale consegnato a Codex il 19/08/2026. E' la specifica
di riferimento del prodotto: architettura, modello dati, Rules Engine, catalogo
regole e Milestone 0-10. Non modificarlo per registrare decisioni successive:
quelle vanno in docs/backlog.md e docs/adr/.
-->

# MASTER PROMPT — ELECTORAL COMPLIANCE SaaS

## 0. YOUR ROLE

You are the lead software architect and senior full-stack engineer responsible for building a production-grade Italian Electoral Compliance SaaS.

You must behave as if you were implementing a regulated professional software product dealing with:

- electoral compliance;
- campaign finance;
- political candidates;
- electoral mandates;
- financial transactions;
- potentially sensitive political data;
- identity documents;
- legal deadlines;
- legally relevant reports.

Correctness, auditability, data isolation, versioning and traceability are more important than implementation speed.

Do not treat this as a prototype, demo, toy project or generic CRUD dashboard.

The product must be designed from the beginning as a serious multi-tenant SaaS capable of being commercialized nationally in Italy.

---

# 1. FUNDAMENTAL PRODUCT PRINCIPLE

The software is NOT merely a tool for filling in an electoral expense report at the end of a campaign.

It is an:

> **Electoral Compliance Management System**

Its purpose is to accompany an electoral candidate:

1. before the campaign;
2. during the campaign;
3. after the election;
4. until the final electoral financial report has been filed and any subsequent authority requests have been handled.

The core product principle is:

> **The report must be built automatically while the campaign is taking place, rather than reconstructed manually after the election.**

The candidate should continuously know:

- what must be done;
- what has already been completed;
- what documentation is missing;
- which transactions need attention;
- whether a mandatary is required;
- how much has been spent;
- how much of the applicable spending limit remains;
- what contributions have been received;
- which services have been received in kind;
- which bank transactions are not reconciled;
- which legal deadlines are approaching;
- whether the final filing dossier is complete.

The interface should therefore answer one persistent question:

> **“What do I have to do now?”**

---

# 2. PRODUCT SCOPE

The product must support three election modules through ONE application:

```text
POLITICAL
MUNICIPAL
REGIONAL
```

Do NOT build three separate applications.

The same UI and data model must dynamically adapt according to the applicable ruleset.

Initial legal implementation scope:

```text
POLITICAL
MUNICIPAL
```

The architecture and database must already support:

```text
REGIONAL
```

but regional legal rules will be implemented later.

---

# 3. OUT OF SCOPE FOR THE FIRST RELEASE

Do NOT implement yet:

- political party/list management UI;
- presentation of electoral lists;
- candidate nomination forms;
- signature collection;
- list-level electoral reporting;
- integrated PEC transmission;
- integrated qualified electronic signature;
- party treasury;
- white-label mode;
- complete regional rulesets;
- complete candidate-list campaign management.

However, the database and APIs MUST be designed so these features can later be introduced without structural rewrites.

In particular, already support:

- Organizations;
- multiple Campaigns;
- ExpenseAllocation;
- bulk onboarding;
- related campaign references;
- API-first architecture.

---

# 4. FEATURES REQUIRED IN V1

V1 MUST include:

### Campaign setup

- user registration;
- organization;
- campaign creation;
- election type;
- candidate role;
- territory;
- election data;
- candidate profile;
- political list/party metadata.

### Compliance

- compliance onboarding wizard;
- deterministic rules engine;
- mandatary determination;
- spending limit calculation;
- deadlines;
- findings;
- tasks;
- transparency obligations;
- local municipal rules status;
- final compliance pre-check.

### Mandatary

- mandatary profile;
- appointment workflow;
- generated appointment document;
- status tracking;
- invitation to campaign workspace;
- dedicated permissions.

### Finance

- contributions;
- self-financing;
- donors;
- donor aggregation;
- corporate donors;
- corporate contribution documentation;
- in-kind contributions;
- third-party expenses;
- suppliers;
- expenses;
- outstanding obligations;
- expense allocations;
- budget;
- spending-limit tracking.

### Documents

- file upload;
- secure object storage;
- OCR;
- automatic document classification;
- AI field extraction;
- human verification;
- document associations;
- document versioning;
- duplicate detection;
- SHA-256 hashes;
- malware scan abstraction;
- bulk upload.

### Banking

- electoral bank account;
- Open Banking provider abstraction;
- transaction synchronization;
- CSV import;
- XLS/XLSX import;
- flexible column mapping;
- import batches;
- duplicate prevention;
- transaction reconciliation;
- automatic matching suggestions;
- manual confirmation.

### Reporting

- continuously calculated report completeness;
- final pre-check;
- report generation;
- report snapshot;
- versioning;
- report freezing;
- filing dossier;
- filing record;
- authority response/request tracking.

### Transparency

- CV;
- criminal record certificate;
- issue date validation;
- political entity publication status;
- institutional publication status.

### Privacy

Basic electoral campaign privacy profile.

### AI assistant

- legal RAG;
- campaign-aware answers;
- source-aware explanations;
- campaign data querying;
- no autonomous legal decision-making.

### Platform

- multi-tenancy;
- RBAC;
- audit log;
- notifications;
- jobs;
- API;
- bulk onboarding;
- exports;
- security controls.

---

# 5. COMMERCIAL MODEL VS APPLICATION ROLES

Do not confuse application roles with commercial licences.

For V1 the commercial object is essentially:

> one Candidate Campaign.

A campaign may contain multiple authorized users without separate licences.

Roles:

```text
CANDIDATE
MANDATARY
ADVISOR
CONTRIBUTOR
```

These are permissions, not subscription types.

Later a List/Party commercial product may aggregate multiple candidate campaigns.

Design the architecture now so this becomes possible without reworking core entities.

---

# 6. UX PRINCIPLES

The candidate must NOT feel like they are using traditional accounting software.

Use plain professional Italian in the UI.

Avoid excessive legal jargon in primary interactions.

Legal explanations should be available through:

```text
Perché?
Approfondisci
Fonte normativa
```

The main sidebar should approximately be:

```text
Dashboard
Cose da fare
Campagna
Finanze
Conto corrente
Documenti
Compliance
Rendiconto
Assistente
```

Secondary:

```text
Impostazioni
Utenti
Assistenza
```

The main global CTA should be:

```text
+ Registra operazione
```

with:

```text
Nuova spesa
Nuovo contributo
Nuovo bene o servizio ricevuto
Carica documento
```

Desktop-first for compliance/reporting.

Mobile-first for operational capture.

On mobile, a candidate must easily be able to:

- photograph an invoice;
- register a contribution;
- upload a receipt;
- register an in-kind service;
- see open tasks;
- ask the assistant a question.

---

# 7. DASHBOARD

The main candidate dashboard must show at least:

### Campaign identity

Candidate name.

Election.

Role.

Territory.

List.

### Completeness

Use wording such as:

```text
Stato della campagna
87% completo
```

Do NOT call this an absolute legal “compliance score”.

Show:

```text
Mandatario
Conto
Entrate
Spese
Documenti
Trasparenza
Rendiconto
```

with status indicators.

### Critical findings

Example:

```text
1 criticità bloccante
3 attività richiedono attenzione
```

### Spending

```text
Spese elettorali
€18.400 / €31.725
```

plus:

```text
Pagato
Da pagare
Servizi valorizzati
```

### Contributions

Totals by:

- self-financing;
- individuals;
- companies;
- other entities;
- in-kind services.

### Bank reconciliation

```text
83 movimenti
79 riconciliati
4 da classificare
```

### Tasks

Show the most important tasks directly.

Example:

```text
Carica delibera Alfa S.r.l.
Riconcilia bonifico €2.500
Carica fattura evento
```

---

# 8. TECHNICAL STACK

Use:

### Language

TypeScript.

### Application

Next.js current stable version with App Router.

### Frontend

React.

Tailwind CSS.

shadcn/ui or equivalent accessible component primitives.

### Database

PostgreSQL.

### ORM

Prisma unless an objectively superior reason emerges during implementation.

If you believe Prisma is inappropriate, STOP and document the architectural reason before replacing it.

### Validation

Zod.

### Storage

S3-compatible private object storage.

Create a storage provider abstraction.

### Jobs

Redis + BullMQ or an equivalent robust background job queue.

Required for:

- OCR;
- AI analysis;
- bank sync;
- report generation;
- bulk uploads;
- rules recalculation;
- bulk onboarding.

### Tests

Unit tests.

Integration tests.

Rules regression tests.

Critical workflow end-to-end tests.

### APIs

REST API versioned:

```text
/api/v1/
```

The frontend should use the same service layer/API concepts exposed externally.

Do not place business-critical legal logic directly inside React components.

---

# 9. ARCHITECTURAL STYLE

Start as a modular monolith.

DO NOT prematurely build microservices.

Keep clear boundaries for:

```text
Auth
Organizations
Campaigns
Elections
Finance
Banking
Documents
Rules
Compliance
Reporting
AI
Notifications
Administration
```

Business modules must not be tightly coupled to UI pages.

Use an event-driven application architecture internally where appropriate.

Example:

```text
ContributionCreated
    ↓
UpdateDonorAggregation
EvaluateContributionRules
TryBankReconciliation
GenerateFindings
GenerateTasks
UpdateDashboardProjection
```

Do not introduce Kafka or other distributed infrastructure at this stage.

Application-level domain events are enough.

---

# 10. MULTI-TENANCY

The system must be multi-tenant from day one.

Core hierarchy:

```text
Organization
    └── Campaign
```

Each relevant database read/write must be scoped by organization/campaign membership.

Never trust an entity ID supplied by the client without authorization verification.

Avoid unsafe patterns equivalent to:

```sql
SELECT *
FROM expenses
WHERE id = ?
```

without also checking campaign/organization authorization.

Prevent cross-tenant IDOR attacks.

---

# 11. CORE DATABASE ENTITIES

Implement at least the following conceptual entities.

Names can be adapted slightly to framework conventions but not removed without documented reason.

## User

```text
id
email
password_hash
first_name
last_name
phone
status
email_verified_at
mfa_enabled
created_at
updated_at
last_login_at
```

---

## Organization

```text
id
name
type
owner_user_id
billing_status
created_at
updated_at
```

Types:

```text
INDIVIDUAL
POLITICAL_LIST
PARTY
PROFESSIONAL
INTERNAL
```

V1 primarily uses INDIVIDUAL.

---

## OrganizationMember

```text
id
organization_id
user_id
role
status
invited_at
accepted_at
```

---

## Campaign

```text
id
organization_id

name
election_id
election_type
office_sought

country
region
province
municipality

constituency_id
district_id

election_date
runoff_date

candidate_proclamation_date
last_proclamation_date

status

ruleset_version_id

created_at
updated_at
archived_at
```

Election types:

```text
POLITICAL
MUNICIPAL
REGIONAL
```

Offices:

```text
DEPUTY
SENATOR
MAYOR
MUNICIPAL_COUNCILLOR
REGIONAL_PRESIDENT
REGIONAL_COUNCILLOR
```

Campaign statuses:

```text
DRAFT
SETUP
ACTIVE
ELECTION_COMPLETED
POST_ELECTION
REPORT_PREPARATION
REPORT_READY
REPORT_FILED
UNDER_REVIEW
CLOSED
ARCHIVED
```

---

## Election

An Election represents the actual electoral consultation.

Example:

```text
Elezioni Comunali Firenze 2027
```

Fields:

```text
id
type
name

election_date
runoff_date
call_date
candidate_submission_deadline

country
region
province
municipality

population
population_reference_date

registered_voters
registered_voters_reference_date

official_source_url
source_verified_at

status
```

Multiple campaigns can belong to the same Election.

Never duplicate election-wide data across every candidate campaign.

---

## Territory

```text
id
type
istat_code
name
parent_id

population
population_reference_date

registered_voters
registered_voters_reference_date

source
source_verified_at
```

Keep population and registered voters separate.

They are NOT interchangeable legal inputs.

---

## CandidateProfile

```text
id
campaign_id

first_name
last_name
tax_code
birth_date
birth_place

residence_address
domicile_address

email
pec
phone

political_party
list_name
coalition_name

identity_document_id

created_at
updated_at
```

---

## CampaignMember

```text
id
campaign_id
user_id
role
permissions_override
status
joined_at
```

Roles:

```text
CANDIDATE
MANDATARY
ADVISOR
CONTRIBUTOR
```

---

## MandataryProfile

```text
id
campaign_id
user_id

first_name
last_name
tax_code
birth_date
birth_place
residence

pec
email
phone

appointment_date
status

identity_document_id
appointment_document_id
submission_receipt_id
```

Statuses:

```text
NOT_STARTED
DATA_COMPLETE
DOCUMENT_GENERATED
SIGNED
SUBMITTED
CONFIRMED
```

---

# 12. FINANCE DATA MODEL

## Donor

```text
id

type

first_name
last_name
company_name

tax_code
vat_number

country
address

email
pec

created_at
updated_at
```

Types:

```text
INDIVIDUAL
COMPANY
ASSOCIATION
POLITICAL_ENTITY
OTHER
```

---

## Contribution

```text
id
campaign_id
donor_id

type

date
amount
currency

payment_method

bank_transaction_id

status

notes

created_at
updated_at
deleted_at
```

Types:

```text
MONEY
SELF_FINANCING
THIRD_PARTY_PAYMENT
OTHER
```

---

## Donor aggregation

Implement a domain service.

The system must be able to aggregate a donor's contributions according to different legal periods.

At minimum:

```text
total_for_campaign
total_for_election
total_for_calendar_year
```

Do not derive legal thresholds only in the UI.

---

## CorporateContributionDetails

```text
contribution_id

resolution_date
resolution_document_id

corporate_book_document_id
accounting_record_document_id
journal_document_id

documentation_status
```

---

## InKindContribution

```text
id
campaign_id
provider_id

type
description

service_date

estimated_value
valuation_method
valuation_notes

supporting_document_id

paid_by_third_party

status

created_at
updated_at
```

This represents:

- free services;
- goods made available;
- services provided by third parties;
- expenses incurred by third parties for the candidate.

---

## Supplier

```text
id
name
tax_code
vat_number
address
email
pec
```

---

## Expense

```text
id
campaign_id
supplier_id

expense_date
description

legal_category
subcategory

gross_amount
net_amount
vat_amount

relevant_amount_for_limit

paid_amount
outstanding_amount

status

invoice_document_id

created_at
updated_at
deleted_at
```

Never assume:

```text
gross_amount == relevant_amount_for_limit
```

The applicable rules determine the amount legally relevant to the spending limit.

Never assume:

```text
expense amount == bank payment
```

Expenses and payments are different concepts.

A €5,000 invoice with €0 paid must still exist as a €5,000 obligation.

---

## ExpenseAllocation

Create now even though List UI is out of scope.

```text
id
expense_id
campaign_id

allocation_type
percentage
amount
reason

created_at
```

This enables future allocation of shared party/list expenses across candidates.

---

# 13. BANKING DATA MODEL

## BankAccount

```text
id
campaign_id

iban
bank_name
account_holder

type

opened_at
closed_at

connection_type

status
```

Connection types:

```text
OPEN_BANKING
CSV
XLS
MANUAL
```

---

## BankConnection

```text
id
bank_account_id

provider
provider_connection_id

consent_expires_at

status
last_sync_at

created_at
updated_at
```

Never store online banking credentials.

Store only the minimum tokens/references required by the selected regulated Open Banking provider.

---

## BankTransaction

```text
id
bank_account_id

external_id

booking_date
value_date

description

counterparty_name
counterparty_iban

amount
currency
direction

balance_after

raw_data

import_batch_id

created_at
```

Prevent transaction duplication.

Use provider external IDs when stable.

For imports, use deterministic fingerprints as fallback.

---

## ImportBatch

```text
id
bank_account_id

filename
format

mapping_config

row_count
imported_count
duplicate_count
error_count

created_at
created_by
```

---

## Reconciliation

```text
id

bank_transaction_id

entity_type
entity_id

match_type

confidence_score

status

suggested_by

confirmed_by
confirmed_at
```

Statuses:

```text
SUGGESTED
CONFIRMED
REJECTED
```

Match types:

```text
EXPENSE
CONTRIBUTION
REFUND
TRANSFER
OTHER
```

---

# 14. OPEN BANKING ABSTRACTION

Do NOT hard-code the application to one provider.

Implement an internal interface conceptually equivalent to:

```typescript
interface BankingProvider {
  createConnection(...): Promise<...>;
  refreshConnection(...): Promise<...>;
  getAccounts(...): Promise<...>;
  getTransactions(...): Promise<...>;
  revokeConnection(...): Promise<void>;
}
```

Then adapters can implement:

```text
ProviderA
ProviderB
ProviderC
```

The actual commercial provider must remain replaceable.

---

# 15. BANK RECONCILIATION

Matching logic should use deterministic criteria before AI.

Possible weighted signals:

```text
amount
counterparty IBAN
counterparty name
date proximity
invoice number in description
reference text
```

AI/fuzzy matching may enhance suggestions.

Do NOT automatically treat an AI-suggested match as legally authoritative.

Default flow:

```text
system suggests
        ↓
user confirms
        ↓
reconciliation becomes authoritative
```

---

# 16. DOCUMENT DATA MODEL

## Document

```text
id
campaign_id

type

filename
original_filename

mime_type
size

storage_key
sha256

status

uploaded_by
uploaded_at

document_date

metadata_json

created_at
deleted_at
```

Original files must never be modified.

---

## DocumentVersion

```text
id
document_id
version

storage_key
sha256

created_at
created_by
```

---

## DocumentAnalysis

```text
id
document_id

model_provider
model_name

detected_type
confidence

extracted_fields
warnings

processed_at

human_verified_at
human_verified_by
```

Separate the file itself from AI interpretation.

---

# 17. DOCUMENT PIPELINE

Implement conceptually:

```text
Upload
 ↓
File validation
 ↓
Malware scan
 ↓
SHA-256
 ↓
Private storage
 ↓
OCR
 ↓
Document classification
 ↓
Field extraction
 ↓
Entity matching
 ↓
User confirmation
 ↓
Authoritative database update
```

The OCR/AI layer may recognize:

```text
INVOICE
RECEIPT
IDENTITY_DOCUMENT
BANK_STATEMENT
CORPORATE_RESOLUTION
ACCOUNTING_DOCUMENT
MANDATARY_APPOINTMENT
CV
CRIMINAL_RECORD_CERTIFICATE
OTHER
```

---

# 18. ABSOLUTE AI SAFETY RULE FOR FINANCIAL DATA

Never silently update authoritative financial information solely on the basis of OCR or AI extraction.

Example:

OCR reads:

```text
€12,200
```

but the real invoice says:

```text
€1,220
```

The system must present extracted data for confirmation.

Use:

```text
AI suggestion → human verification → authoritative data
```

not:

```text
AI extraction → final financial record
```

---

# 19. DOCUMENT DEDUPLICATION

Use SHA-256 for exact duplicates.

Also optionally use semantic/document similarity to identify near duplicates.

If a duplicate is detected:

```text
Questo documento sembra già presente.
```

Allow:

```text
Visualizza esistente
Carica comunque
```

Do not silently discard.

---

# 20. RULES ENGINE — NON-NEGOTIABLE ARCHITECTURE

This is the core of the product.

Legal obligations MUST NOT be hard-coded into:

- React pages;
- random API handlers;
- AI prompts;
- conditional UI spaghetti.

Create:

```text
RulesetVersion
LegalSource
ComplianceRule
```

---

## RulesetVersion

```text
id

name
jurisdiction
election_type

version

effective_from
effective_to

status

reviewed_by
reviewed_at

created_at
```

Statuses:

```text
DRAFT
UNDER_REVIEW
ACTIVE
SUPERSEDED
ARCHIVED
```

Every campaign must be associated with a precise legal ruleset version.

Historical campaigns must remain reproducible even after future legal changes.

---

## LegalSource

```text
id

source_type

title

law_number
law_date

article
paragraph

authority

official_url

effective_from
effective_to

text_excerpt

verified_at
verified_by
```

Source types:

```text
LAW
DECREE
REGULATION
COREGE_GUIDANCE
AGCOM_DECISION
PRIVACY_AUTHORITY
MUNICIPAL_REGULATION
PRACTICE
SYSTEM_CONTROL
PRODUCT_BEST_PRACTICE
```

The application must distinguish:

- legal obligation;
- authority guidance;
- municipal rule;
- product recommendation;
- internal consistency control.

Never present all of them as having the same legal status.

---

## ComplianceRule

```text
id
ruleset_version_id

rule_code

name
description

category

severity_default

condition_expression

effect_type
effect_payload

legal_source_id

effective_from
effective_to

is_active

created_at
updated_at
```

Rule categories:

```text
MANDATARY
BANK_ACCOUNT
SPENDING_LIMIT
CONTRIBUTION
DONOR
CORPORATE_DONATION
EXPENSE
IN_KIND_SERVICE
TRANSPARENCY
DOCUMENT
DEADLINE
REPORT
PROPAGANDA
PRIVACY
LOCAL_REQUIREMENT
```

Effects:

```text
REQUIREMENT
WARNING
BLOCKER
TASK
DEADLINE
CALCULATION
DOCUMENT_REQUIREMENT
CLASSIFICATION
INFORMATION
```

---

# 21. RULE DSL

DO NOT store executable arbitrary JavaScript in the database.

Use a declarative JSON DSL.

Example:

```json
{
  "all": [
    {
      "field": "campaign.election_type",
      "operator": "eq",
      "value": "MUNICIPAL"
    },
    {
      "field": "election.population",
      "operator": "gt",
      "value": 15000
    },
    {
      "any": [
        {
          "field": "campaign.has_third_party_contributions",
          "operator": "eq",
          "value": true
        },
        {
          "field": "campaign.self_funded_spending",
          "operator": "gte",
          "value": 2500
        }
      ]
    }
  ]
}
```

Output:

```json
{
  "type": "REQUIREMENT",
  "requirement": "MANDATARY_REQUIRED"
}
```

Supported operators should initially include:

```text
eq
neq
gt
gte
lt
lte
in
not_in
exists
not_exists
```

with:

```text
all
any
not
```

composition.

Validate DSL expressions before activation.

---

# 22. CALCULATION ENGINE

Numerical legal formulas must also be declarative and versioned.

Example:

```json
{
  "operation": "add",
  "items": [
    {
      "constant_parameter": "MUNICIPAL_COUNCILLOR_FIXED_AMOUNT"
    },
    {
      "operation": "multiply",
      "items": [
        {
          "field": "election.registered_voters"
        },
        {
          "constant_parameter": "MUNICIPAL_COUNCILLOR_PER_VOTER"
        }
      ]
    }
  ]
}
```

Never hide relevant legal parameters directly in UI code.

---

# 23. COMPLIANCE FINDINGS

Create:

```text
ComplianceFinding
```

Fields:

```text
id

campaign_id
rule_id

entity_type
entity_id

severity

status

title
description

detected_at
resolved_at

resolution_method
```

Statuses:

```text
OPEN
ACKNOWLEDGED
RESOLVED
OVERRIDDEN
```

A finding is NOT the same as a task.

---

# 24. PROFESSIONAL OVERRIDE

Legal professionals must be able to override a finding without deleting it.

Require:

```text
reason
user
date
```

Status:

```text
OVERRIDDEN
```

Keep the original rule, finding and reason visible in audit history.

Never silently erase legal alerts.

---

# 25. TASKS

Create:

```text
Task
```

Fields:

```text
id
campaign_id

source_type
source_id

title
description

priority
status

assigned_to

due_at
completed_at

created_at
```

Sources:

```text
RULE
FINDING
USER
SYSTEM
DOCUMENT
```

The “Cose da fare” page is essentially the task/compliance inbox.

---

# 26. DEADLINES

Create:

```text
Deadline
```

Fields:

```text
id
campaign_id

rule_id

name

trigger_event
trigger_date

offset_definition

calculated_due_date

status

source
```

Do not merely persist a resulting calendar date.

Persist the formula and trigger.

Example:

```text
trigger = LAST_PROCLAMATION
offset = P3M
```

Use ISO duration semantics.

Respect the difference between:

```text
P3M
```

three calendar months

and:

```text
P90D
```

ninety days.

They are legally different concepts.

---

# 27. RULE EVALUATION EVENTS

Rules should be reevaluated on relevant domain events such as:

```text
CampaignCreated
CampaignUpdated
ElectionUpdated
ContributionCreated
ContributionUpdated
ContributionDeleted
ExpenseCreated
ExpenseUpdated
InKindContributionCreated
DocumentUploaded
DocumentVerified
BankTransactionImported
ReconciliationConfirmed
MandataryUpdated
ProclamationRecorded
RulesetChanged
```

Do not reevaluate every rule unnecessarily after every request.

Create rule dependency metadata if useful.

---

# 28. SEVERITY MODEL

Use exactly these concepts unless a clear technical reason is documented:

```text
INFO
ACTION_REQUIRED
WARNING
CRITICAL
BLOCKER
```

Meanings:

### INFO

Informational.

### ACTION_REQUIRED

An applicable obligation is incomplete.

### WARNING

Potential anomaly requiring review.

### CRITICAL

Significant compliance/documentary issue.

### BLOCKER

The campaign cannot be marked “ready to file”.

Important:

A BLOCKER must generally NOT prevent recording the real-world transaction.

Example:

If the candidate exceeded a spending limit, the €10,000 expense must still be recordable.

The system must record reality and alert:

```text
Limite superato di € X
```

Never hide reality to maintain a green dashboard.

---

# 29. COMPLIANCE STATE

Campaign compliance evaluation states:

```text
COMPLETE
ATTENTION_REQUIRED
CRITICAL
EVALUATION_INCOMPLETE
```

If rules execution fails technically, NEVER show green/complete.

Fail safe.

Display:

```text
Alcuni controlli non sono stati completati.
```

---

# 30. LEGAL RULESET — POLITICAL ELECTIONS

Create initial seed/test definitions for the following conceptual rules.

Do not assume the numerical parameters remain valid forever.

All numerical thresholds must be versioned parameters with verified sources.

---

## IT-POL-SCOPE-001

Condition:

```text
election_type = POLITICAL
office_sought IN [DEPUTY, SENATOR]
```

Effect:

activate political candidate rules.

---

## IT-POL-MAND-001

Political campaign fundraising after election call requires evaluation of electoral mandatary obligation.

Relevant fundraising/contribution events without required mandatary must generate CRITICAL findings.

---

## IT-POL-MAND-002

Only one active electoral mandatary per candidate campaign.

More than one active mandatary:

```text
BLOCKER
```

---

## IT-POL-MAND-003

A mandatary cannot validly act for multiple candidates according to the applicable legal framework.

Within platform data:

if identical tax code appears as active mandatary for another relevant candidate campaign:

```text
CRITICAL verification
```

Do not claim the database is exhaustive.

Require explicit confirmation by the user.

---

## IT-POL-BANK-001

When a mandatary is required:

```text
electoral bank account required
```

Track:

- IBAN;
- institution;
- holder;
- opening date;
- closing date;
- full account statement coverage.

---

## IT-POL-BANK-002

Detect multiple simultaneously active electoral bank accounts where inconsistent with applicable rules.

Flag for critical verification.

---

## IT-POL-LIMIT-001

Support the political candidate spending limit formula through versioned parameters.

Initial parameter model must support a formula structurally equivalent to:

```text
fixed amount × relevant constituencies
+
per-resident amount × relevant population
```

The parameter values themselves belong to the ruleset, not application code.

Store calculation snapshot.

---

## IT-POL-LIMIT-002

Product risk thresholds:

```text
>=70% INFO
>=85% WARNING
>=95% high warning
>100% CRITICAL
```

Mark as PRODUCT_BEST_PRACTICE, not statutory law.

---

## IT-POL-EXP-CAT-001

Implement legal expense categories corresponding to statutory electoral expenditure categories.

UX may contain modern subcategories such as:

```text
Meta Ads
Google Ads
TikTok
Printing
Events
Photography
Consultants
```

but every subcategory must map to a legal category.

---

## IT-POL-EXP-FLAT-001

Support rule-based calculation of statutory flat-rate general campaign expenditure where required by the applicable legislation/ruleset.

The value and calculation must be determined by the rules engine.

Never insert the percentage directly into a React component.

---

## IT-POL-REPORT-001

Electoral report required for covered political candidates.

Must work for elected and non-elected candidates.

---

## IT-POL-REPORT-002

For elected candidate:

```text
trigger = candidate proclamation
offset = P3M
```

using the applicable verified rule.

---

## IT-POL-REPORT-003

For non-elected candidate:

```text
trigger = last relevant proclamation
offset = P3M
```

using the applicable verified rule.

---

## IT-POL-REPORT-CONT-001

Report completeness must evaluate, where applicable:

```text
contributions
services received
expenses
bank statements
candidate signature
mandatary countersignature
supporting documentation
```

---

# 31. GENERAL CONTRIBUTION RULES

## IT-FIN-DECL-001

Implement donor annual aggregation.

A threshold-dependent declaration requirement must support:

```text
annual aggregate > threshold
```

not:

```text
single payment > threshold
```

The annual aggregate must include forms of contribution required by the applicable rule, including services where applicable.

Threshold must be stored as versioned legal parameter.

Boundary tests are mandatory.

---

## IT-FIN-CORP-001

For COMPANY donors activate a corporate documentation workflow.

Separate:

### statutory requirements

from

### authority-specific documentation requirements.

The data model must support at least:

```text
corporate resolution
corporate book evidence
accounting record
journal record
```

but applicability must be rule-driven.

---

## IT-FIN-CORP-002

Support prohibited/high-risk donor checks.

Do NOT rely on AI to make final determinations about whether a company is a prohibited public-sector donor.

Allow:

```text
CONFIRMED_ALLOWED
CONFIRMED_PROHIBITED
REQUIRES_VERIFICATION
UNKNOWN
```

Any prohibited donor determination must have source/audit evidence.

---

## IT-FIN-INKIND-001

Any qualifying:

```text
free service
asset made available
third-party expense benefiting candidate
```

must be representable as an InKindContribution.

Require:

```text
provider
description
date
estimated value
valuation method
supporting evidence
```

AI may suggest that an uploaded document represents a third-party benefit.

AI may NOT automatically create authoritative contribution records without user confirmation.

---

# 32. LEGAL RULESET — MUNICIPAL ELECTIONS

## IT-COM-SCOPE-001

Applies to:

```text
election_type = MUNICIPAL
```

---

## IT-COM-SCOPE-002

The system must distinguish the legal threshold:

```text
population > 15000
```

Boundary tests:

```text
15000 → false
15001 → true
```

Never use:

```text
>= 15000
```

if the applicable rule is strictly “more than 15,000”.

---

# 33. MUNICIPAL SPENDING LIMITS

All monetary parameters must be versioned.

The calculation engine must support candidate-office and population-band formulas.

Required structural rules:

### Mayor

Band 1:

```text
15000 < population <= 100000
```

Formula structure:

```text
fixed_amount + per_registered_voter × registered_voters
```

Band 2:

```text
100000 < population <= 500000
```

Same configurable structure with different parameters.

Band 3:

```text
population > 500000
```

Same configurable structure with different parameters.

### Municipal councillor

Implement the same three population bands with their own configurable fixed and per-voter parameters.

CRITICAL:

Use:

```text
registered voters
```

where the rule requires registered voters.

Do NOT substitute resident population.

Store inputs used for every spending limit calculation.

---

# 34. MUNICIPAL MANDATARY EXCEPTION

Support the legally relevant exception for certain self-funded campaigns.

Conceptual rule:

```text
IF
municipality above applicable threshold
AND
candidate uses only personal funds
AND
candidate spending remains below applicable exception threshold
AND
no relevant third-party contribution/service exists
THEN
mandatary may not be required
ELSE
ordinary mandatary regime applies
```

The threshold must be versioned.

The system must continuously reevaluate eligibility.

Example:

Campaign starts:

```text
€1,900 planned spending
self-funded only
```

Result:

```text
possible no-mandatary regime
```

Later candidate receives:

```text
€50 from family member
```

Immediately reevaluate and create an appropriate critical finding/task.

Boundary tests are mandatory:

```text
2499.99
2500.00
```

if the current legal threshold remains €2,500 and the exception is formulated as “less than €2,500”.

Do not encode these numbers permanently into source code.

---

# 35. MUNICIPAL REPORT OBLIGATION

Where the national municipal campaign finance reporting regime applies, reporting must remain required even when:

```text
candidate not elected
```

and/or

```text
mandatary exception applies
```

A zero-activity campaign does NOT automatically mean no reporting obligation.

---

# 36. MUNICIPAL LOCAL RULES

Municipal compliance is not purely national.

Create:

```text
MunicipalLocalRulesStatus
```

conceptually supporting:

```text
VERIFIED_NO_ADDITIONAL_RULES
VERIFIED_ADDITIONAL_RULES
NOT_YET_VERIFIED
```

Where a municipality falls into the population band for which local statutes/regulations may impose campaign finance declarations/reporting requirements, activate:

```text
LOCAL_RULESET_LOOKUP_REQUIRED
```

If:

```text
NOT_YET_VERIFIED
```

the application must not present the campaign as fully complete.

Display:

```text
Regole comunali in verifica
```

---

# 37. MUNICIPAL PRE-ELECTION BUDGET

Support a legally relevant:

```text
PRE_ELECTION_BUDGET_REPORT
```

for municipalities/candidates where applicable.

This means the Budget module serves two purposes:

1. internal campaign planning;
2. generating a legally relevant preventive budget when required.

Keep those concepts separate in the model.

---

# 38. TRANSPARENCY RULES

Create:

```text
TransparencyRecord
```

Fields:

```text
id
campaign_id

cv_document_id

criminal_record_document_id
criminal_record_issue_date

party_publication_status
party_publication_date

institutional_publication_status
institutional_publication_date

last_verified_at
```

---

## IT-TRANS-CV-001

Apply CV/certificate transparency rules to election types and population thresholds according to the active legal ruleset.

Do NOT hard-code applicability in the page.

---

## IT-TRANS-CRIM-001

Support validity rule based on a precise day interval such as:

```text
election_date - P90D
```

when the active ruleset requires a certificate issued no more than 90 days before the election.

Boundary tests:

```text
90 days → valid
91 days → invalid
```

---

## IT-TRANS-PUB-001

Support political entity publication deadline based on:

```text
election_date - configured duration
```

For the current ruleset this may correspond to fourteen days.

Store the duration as a legal ruleset parameter.

From the candidate UX perspective, phrase this as:

```text
Assicurati che CV e casellario siano stati trasmessi alla lista/partito per la pubblicazione.
```

Do not incorrectly imply that every publication obligation is personally performed by the candidate.

---

## IT-TRANS-PUB-002

Track institutional “Elezioni trasparenti” publication status/deadline separately.

This may be an authority responsibility rather than a direct candidate action.

Represent this as a status/monitoring requirement.

---

# 39. PROPAGANDA CHECKS

Create room for campaign-material compliance.

Implement a first document/image analysis flow capable of inspecting campaign material for required legal disclosures such as the responsible commissioner where applicable.

AI/Vision output:

```text
required wording detected / not detected / uncertain
```

If uncertain or missing:

```text
WARNING
```

Never represent visual AI detection as definitive legal certification.

---

# 40. PRIVACY CAMPAIGN PROFILE

Create:

```text
PrivacyCampaignProfile
```

Fields:

```text
campaign_id

uses_contact_database

data_sources

privacy_notice_document_id

has_processors
processor_list

uses_whatsapp
uses_email
uses_sms
uses_custom_audiences

retention_policy_confirmed

status
```

This is NOT intended to become a full GDPR management platform.

It is an electoral campaign privacy checklist/profile.

Tasks may include:

```text
Documenta provenienza database
Carica informativa
Verifica base giuridica
Registra fornitori/responsabili
```

---

# 41. COMPLIANCE SCORE / COMPLETENESS

Do not use an AI-generated arbitrary score.

Each applicable requirement may have a weight.

Conceptually:

```text
completed applicable weight
/
total applicable weight
```

Display:

```text
92% completo
```

If a BLOCKER exists:

still show:

```text
92% completo
1 criticità bloccante
```

Do NOT infer:

```text
92% legally compliant
```

---

# 42. REPORTING MODEL

Create:

```text
Report
```

Fields:

```text
id
campaign_id

type
status

template_version

generated_at
generated_by

document_id
snapshot_id
```

Types:

```text
COREGE_REPORT
CONTRIBUTIONS_SCHEDULE
EXPENSES_SCHEDULE
PRE_ELECTION_BUDGET
DOSSIER_INDEX
COMPLIANCE_REPORT
```

---

# 43. REPORT SNAPSHOT

When generating a legally relevant report, persist an immutable snapshot of:

```text
candidate data
mandatary
contributions
donor aggregates
services
expenses
allocations
bank reconciliation state
document references
totals
spending limit calculation
ruleset version
```

This ensures reports remain reproducible.

---

# 44. REPORT FINALIZATION

Support:

```text
DRAFT
GENERATED
FINALIZED
FILED
SUPERSEDED
```

When finalizing:

freeze the report snapshot.

If underlying data later changes:

show:

```text
I dati correnti non corrispondono più al rendiconto definitivo.
```

Require:

```text
Genera nuova versione
```

Never silently mutate a finalized report.

---

# 45. PRE-FILING CHECK

Implement a pre-check engine.

Potential checks include:

```text
candidate identity complete
mandatary complete where applicable
all bank transactions classified/reconciled
all relevant contributions documented
corporate contributions complete
all expenses appropriately documented
services valued
bank statement coverage complete
spending limit evaluation complete
transparency tasks evaluated
rules engine execution complete
candidate signature status
mandatary countersignature status
```

Classify results:

```text
BLOCKER
CRITICAL
WARNING
INFO
```

Product consistency checks must be marked as system controls rather than statutes.

---

# 46. ZERO CAMPAIGN

Implement explicit support for:

```text
contributions = 0
expenses = 0
services = 0
```

If the applicable legal regime still requires reporting:

show:

```text
Nessuna operazione registrata.
Il rendiconto resta comunque da predisporre.
```

Do NOT infer:

```text
no transactions → no reporting obligation
```

---

# 47. FILING DOSSIER

Generate an organized dossier.

Conceptual structure:

```text
01_Rendiconto
02_Documenti_Candidato
03_Mandatario
04_Conto
05_Contributi
06_Spese
07_Servizi
08_Allegati
```

Generate:

```text
Indice_fascicolo.pdf
```

with a manifest of files.

Do not modify originals.

---

# 48. FILING

Create:

```text
Filing
```

Fields:

```text
id
campaign_id
report_id

authority_id

submission_method

submitted_at

protocol_number

receipt_document_id

status
```

Methods:

```text
PEC
REGISTERED_MAIL
IN_PERSON
OTHER
```

Integrated PEC sending is OUT OF SCOPE.

V1 only prepares/tracks filing.

---

# 49. AUTHORITIES

Create:

```text
Authority
```

Fields:

```text
id
type
name

territorial_scope

address
pec
email
website

submission_instructions

verified_at
```

Do not hard-code one COREGE.

---

# 50. AUTHORITY REQUESTS AFTER FILING

Allow:

```text
+ Nuova comunicazione
```

with:

```text
authority
date
protocol
subject
document
response deadline
notes
```

Automatically generate tasks/deadlines when appropriate.

---

# 51. AI ASSISTANT

The assistant must NOT operate as a generic legal chatbot.

Architecture:

```text
Question
 ↓
Campaign context
 ↓
Rules Engine
 ↓
Validated legal sources
 ↓
Relevant campaign records/documents
 ↓
LLM explanation
```

Not:

```text
Question → LLM hallucinated legal answer
```

Response structure ideally contains:

```text
answer
rules_used[]
sources[]
campaign_facts_used[]
confidence
```

UI should render:

```text
In breve
Nel tuo caso
Cosa fare
Fonte
```

---

# 52. AI LEGAL KNOWLEDGE

Maintain separate knowledge domains:

### VALIDATED LEGAL KNOWLEDGE

- laws;
- regulations;
- official authority guidance;
- COREGE material;
- municipal rules;
- election-specific authority decisions.

### CAMPAIGN KNOWLEDGE

- candidate data;
- financial records;
- uploaded documents;
- tasks;
- findings;
- reports.

Do not mix their authority levels.

---

# 53. “ASK MY CAMPAIGN” DATA QUESTIONS

Questions such as:

```text
Quanto ho speso su Meta?
Quali fatture non sono state pagate?
Quali contributi societari sono incompleti?
Quanti movimenti non sono riconciliati?
```

must primarily query structured database data.

The LLM can explain/format the answer.

It must not estimate structured financial values from embeddings or document text when authoritative records exist.

---

# 54. “CAN I DO THIS?” SIMULATOR

Provide a compliance simulation flow.

Example user input:

```text
Una società vuole pagare direttamente una cena elettorale da €3.000.
```

Parse potential facts.

Run relevant rules.

Return:

```text
Cosa risulta
Cosa deve essere verificato
Documenti necessari
Come registrare l'operazione
Fonti
```

Allow creating:

```text
planned operation
```

without entering it into actual campaign accounts until confirmed.

---

# 55. AI PROVIDER ABSTRACTION

Do not bind business logic to one AI provider/model.

Create conceptual provider interfaces for:

```text
OCR
DocumentAnalysis
Assistant
Embeddings/RAG
```

Persist:

```text
provider
model
analysis timestamp
confidence
```

for auditability.

---

# 56. SECURITY — NON-NEGOTIABLE

This system contains:

- political affiliation;
- candidate information;
- identity documents;
- financial data;
- bank account data;
- donor information;
- potentially sensitive personal data.

Implement security as a foundational concern.

Required principles:

- secure password hashing;
- MFA architecture;
- email verification;
- session security;
- CSRF protection where applicable;
- strict authorization;
- tenant isolation;
- private object storage;
- short-lived signed URLs;
- encryption in transit;
- encryption at rest where provided by infrastructure;
- secrets outside source control;
- rate limiting;
- audit logging;
- upload validation;
- malware scanning abstraction;
- safe MIME validation;
- SQL injection prevention through ORM/parameterization;
- XSS mitigation;
- secure headers;
- security-focused tests.

Never log:

- full passwords;
- full authentication tokens;
- bank credentials;
- sensitive document contents unnecessarily.

---

# 57. AUDIT LOG

Create immutable/append-only:

```text
AuditLog
```

Fields:

```text
id
organization_id
campaign_id

user_id

action

entity_type
entity_id

before_json
after_json

ip_address
user_agent

created_at
```

There must be no normal user endpoint to delete audit events.

Administrative actions must themselves be auditable.

---

# 58. SOFT DELETE

Use soft deletion where appropriate:

```text
deleted_at
deleted_by
```

especially for financial records.

Never allow important financial history to disappear silently.

Audit deletion/restoration.

---

# 59. EXPORT

Implement:

```text
Esporta tutti i dati
```

Generate a package containing, where appropriate:

```text
campaign.json
expenses.csv
contributions.csv
transactions.csv
tasks.csv
findings.csv
documents/
reports/
```

This supports data portability and professional records management.

---

# 60. OBSERVABILITY

Implement:

- structured logs;
- error tracking abstraction;
- metrics hooks;
- job monitoring;
- rule evaluation error tracking.

Track at least:

```text
OCR failure rate
document AI failure rate
bank synchronization errors
rule evaluation failures
report generation failures
job retries
```

If rule evaluation fails:

do not show green.

---

# 61. BULK ONBOARDING

Implement API/admin support now.

Example CSV:

```text
nome
cognome
email
codice_fiscale
tipo_candidatura
comune
lista
```

Flow:

```text
upload
validation
preview
error display
confirmation
creation
invitations
```

Result:

```text
48 create
2 scartate
```

Do not expose a full List/Party dashboard yet.

---

# 62. API-FIRST DESIGN

Expose versioned endpoints conceptually including:

```text
/api/v1/auth

/api/v1/organizations

/api/v1/campaigns
/api/v1/elections
/api/v1/candidates
/api/v1/members
/api/v1/mandataries

/api/v1/donors
/api/v1/contributions
/api/v1/in-kind-contributions

/api/v1/suppliers
/api/v1/expenses
/api/v1/allocations

/api/v1/bank-accounts
/api/v1/bank-connections
/api/v1/bank-transactions
/api/v1/reconciliations

/api/v1/documents
/api/v1/document-analyses

/api/v1/rules
/api/v1/findings
/api/v1/tasks
/api/v1/deadlines

/api/v1/transparency
/api/v1/privacy

/api/v1/reports
/api/v1/filings
```

Use OpenAPI documentation.

Implement request validation.

Implement permission checks consistently.

---

# 63. ADMIN LEGAL CONSOLE

Create an internal admin-only application area.

Must allow management of:

```text
Legal Sources
Rulesets
Compliance Rules
Rule Parameters
Elections
Territories
Authorities
Document Templates
```

Legal rule editing must not require a code deployment.

---

# 64. RULE TESTER

Admin users must be able to input a hypothetical campaign context.

Example:

```text
Election: Municipal
Population: 20,000
Office: Councillor
Self-funded: true
Spending: €1,500
Third-party contributions: false
```

Then:

```text
Evaluate
```

Output:

```text
rules matched
requirements
warnings
deadlines
calculations
sources
```

This is mandatory for maintaining legal rules safely.

---

# 65. LEGAL REGRESSION TESTS

Rules must have regression tests.

Implement fixtures/tests for at least:

### Political

1. political candidate + contribution after relevant election event + no required mandatary → finding;

2. two active mandataries → blocker;

3. political candidate non-elected → report required;

4. political spending-limit calculation with known inputs;

5. unclassified bank transactions at final pre-check → finding;

6. corporate contribution missing required documentation → finding.

### Donor aggregation

7. annual donor amount immediately below threshold → no threshold action;

8. amount exactly equal to a rule phrased as “exceeds X” → no trigger;

9. amount greater than threshold → trigger;

10. multiple payments aggregate correctly.

### Municipal

11. population 15,000 → >15k rules false;

12. population 15,001 → >15k rules true;

13. self-funded spending just below mandatary exception threshold → exception potentially applies;

14. spending exactly at threshold where law says “less than” → exception fails;

15. third-party contribution while previously in no-mandatary regime → immediate reevaluation;

16. municipal candidate non-elected where reporting applies → report required;

17. local rules status NOT_YET_VERIFIED → campaign cannot appear fully complete;

18. municipality crossing preventive budget population threshold → preventive budget rule active.

### Transparency

19. certificate exactly within permitted day period → valid;

20. one day outside permitted period → invalid.

### Reporting

21. zero campaign but reporting regime active → report required;

22. finalized report + underlying expense change → report marked stale/new version required.

CI must fail if a legal regression test changes unexpectedly.

---

# 66. TEST BOUNDARIES EXPLICITLY

Boundary bugs are particularly dangerous in legal software.

Always write tests around:

```text
<
<=
>
>=
```

thresholds.

Do not assume “about 15,000” or “around €3,000”.

Legal expressions such as:

```text
more than
less than
at least
not more than
```

must be represented precisely.

---

# 67. NO SILENT LEGAL CHANGES

Codex must NEVER autonomously “correct”, “simplify” or “modernize” a legal rule because another interpretation seems preferable.

If a legal rule appears:

- inconsistent;
- outdated;
- ambiguous;
- contradictory;
- technically difficult;

STOP implementation of that rule and document:

```text
LEGAL_REVIEW_REQUIRED
```

Describe the ambiguity.

Do not choose a legal interpretation silently.

---

# 68. LEGAL SOURCES POLICY

Prefer official sources.

Every statutory rule must point to a LegalSource.

When source status differs, preserve the hierarchy.

Example:

```text
LAW
COREGE_GUIDANCE
PRODUCT_CONTROL
```

The UI may explain all three, but must not misrepresent a product recommendation as a legal obligation.

---

# 69. DOCUMENT TEMPLATES

Build a template system rather than hardcoding PDF generation.

Conceptual:

```text
DocumentTemplate
```

Fields:

```text
id
authority
document_type
election_type
territory
version
effective_from
effective_to
template_file
mapping_definition
status
```

This enables different COREGE forms without application rewrites.

---

# 70. REPORT GENERATION

Generate PDFs server-side.

Keep originals and generated versions.

Reports must include metadata identifying:

```text
template version
generation timestamp
ruleset version
snapshot ID
```

internally, even if not all metadata is visible in the final PDF.

---

# 71. UX — COMPLIANCE INBOX

Create a dedicated “Cose da fare” page.

Filters:

```text
Tutte
Critiche
Da fare
In attesa
Completate
Scadenze
```

Each task should display:

```text
Titolo
Descrizione
Perché esiste
Scadenza
Priorità
Fonte
CTA
```

Example:

```text
Completa contributo Alfa S.r.l.

Contributo: €5.000
Ricevuto: 10/04/2027

Mancano:
- delibera
- documentazione contabile

[Carica documenti]
```

---

# 72. UX — FINANCE

Create finance navigation:

```text
Panoramica
Entrate
Finanziatori
Spese
Beni e servizi ricevuti
Budget
```

Do not force users to understand accounting terminology beyond what is necessary.

---

# 73. UX — BANK

Create:

```text
Conto
Movimenti
Riconciliazione
Importazioni
```

Reconciliation interface should visually compare:

```text
Bank transaction
vs
Suggested expense/contribution
```

with confidence and explanation.

---

# 74. UX — DOCUMENT CENTER

Organize documents logically:

```text
Candidato
Mandatario
Conto
Entrate
Spese
Servizi
Trasparenza
Rendiconto
Deposito
```

Also provide:

```text
Carica documenti
```

globally.

Bulk upload must classify files asynchronously.

---

# 75. UX — CAMPAIGN TIMELINE

Create a timeline containing:

```text
Election call
Mandatary appointment
Bank account opening
Candidate filing milestones
Election
Runoff
Proclamation
Report deadline
Filing
Authority requests
```

Calculated deadlines should visibly show their origin where appropriate.

---

# 76. MOBILE UX

Prioritize quick capture.

Mobile home should prominently show:

```text
3 cose da fare
```

and large actions:

```text
Fotografa fattura
Registra entrata
Registra servizio
Carica documento
```

Camera upload experience must be excellent.

---

# 77. DESIGN DIRECTION

Use a professional legal/financial SaaS aesthetic.

Avoid:

- flashy consumer fintech styling;
- excessive gradients;
- gamification;
- cartoon visuals;
- “AI magic” language;
- intimidating government-form aesthetics.

Aim for:

- clean;
- sober;
- modern;
- trustworthy;
- spacious;
- information-dense where appropriate.

Tables must remain readable.

Critical alerts must be visible without overwhelming the interface.

---

# 78. ACCESSIBILITY

Build accessible components.

At minimum:

- keyboard navigation;
- proper labels;
- focus states;
- semantic headings;
- sufficient contrast;
- alerts not conveyed by color alone.

---

# 79. PERFORMANCE

Use pagination for large tables.

Do not load hundreds of documents/transactions at once.

Use background jobs for expensive operations.

Use optimized database indexes for:

```text
organization_id
campaign_id
donor_id
supplier_id
bank_account_id
booking_date
expense_date
contribution date
status
```

Add compound indexes based on actual query patterns.

---

# 80. AGENTS.md

At repository root create:

```text
AGENTS.md
```

This file must contain persistent instructions for future Codex tasks.

At minimum include:

### Product invariants

- legal decisions belong to Rules Engine;
- AI never determines final legal compliance;
- AI-extracted financial data requires human verification;
- reports are versioned/snapshotted;
- tenant authorization always required;
- rules must have LegalSource or explicit SYSTEM_CONTROL classification;
- no silent legal rule changes.

### Engineering conventions

- project structure;
- naming;
- commands;
- testing;
- linting;
- migration process;
- architecture boundaries.

### Required checks before task completion

```text
typecheck
lint
unit tests
integration tests
rules regression tests
build
```

---

# 81. PROJECT DOCUMENTATION

Create:

```text
README.md
AGENTS.md

docs/
  architecture.md
  data-model.md
  rules-engine.md
  security.md
  api.md
  legal-rules.md
  document-pipeline.md
  banking.md
  deployment.md
  testing.md
```

Also create Architecture Decision Records where major choices are made:

```text
docs/adr/
```

---

# 82. IMPLEMENTATION METHOD — DO NOT BUILD EVERYTHING AT ONCE

This instruction is mandatory.

Do NOT attempt the full platform in one enormous implementation.

Work incrementally.

Before writing substantial code:

1. inspect the environment/repository;
2. produce an implementation plan;
3. identify unresolved architectural assumptions;
4. scaffold documentation;
5. implement one milestone at a time;
6. run tests after every milestone;
7. summarize completed work and remaining work.

If the repository is initially empty, initialize it according to the architecture defined here.

---

# 83. MILESTONE 0 — PLANNING AND FOUNDATION DOCUMENTS

Before application implementation, create/update:

```text
README.md
AGENTS.md
docs/architecture.md
docs/data-model.md
docs/rules-engine.md
docs/security.md
docs/legal-rules.md
```

Create an implementation backlog.

Do not invent unrequested business features.

Definition of Done:

- architecture documented;
- repo conventions documented;
- environment requirements documented;
- initial entity model documented;
- initial rule architecture documented.

---

# 84. MILESTONE 1 — APPLICATION FOUNDATION

Implement:

- Next.js;
- TypeScript;
- PostgreSQL;
- Prisma;
- migrations;
- authentication;
- Organization;
- OrganizationMember;
- Campaign;
- CampaignMember;
- CandidateProfile;
- basic RBAC;
- tenant isolation;
- initial dashboard shell;
- sidebar;
- responsive layout;
- audit infrastructure.

Definition of Done:

- user can register/login;
- user can create organization;
- user can create campaign;
- unauthorized tenant access is tested and blocked;
- migrations reproducibly create schema;
- lint/typecheck/tests pass.

---

# 85. MILESTONE 2 — ELECTION DATA + RULES ENGINE

Implement:

- Election;
- Territory;
- LegalSource;
- RulesetVersion;
- ComplianceRule;
- declarative condition DSL;
- calculation DSL;
- rule evaluation service;
- findings;
- tasks;
- deadlines;
- admin rules console;
- rule tester;
- regression test infrastructure.

Seed a minimal validated ruleset for Politiche + Comunali based on the rule codes in this specification.

Definition of Done:

- rules can be added without code deployment;
- rules are versioned;
- campaigns evaluate rules;
- findings/tasks generated;
- formulas calculate deterministically;
- regression tests pass.

---

# 86. MILESTONE 3 — CAMPAIGN WIZARD + MANDATARY

Implement onboarding:

- election selection;
- territory;
- role;
- candidate profile;
- finance questionnaire;
- mandatary determination;
- MandataryProfile;
- invitation;
- status workflow;
- document-generation abstraction.

Definition of Done:

- candidate can complete setup;
- rules engine determines applicable mandatary state;
- future campaign changes trigger reevaluation;
- mandatary can be invited with correct role;
- audit events exist.

---

# 87. MILESTONE 4 — FINANCE

Implement:

- Donor;
- donor aggregation;
- Contribution;
- CorporateContributionDetails;
- InKindContribution;
- Supplier;
- Expense;
- ExpenseAllocation;
- outstanding obligations;
- budget;
- spending limit calculation;
- dashboard finance cards.

Definition of Done:

- all finance data is independently modeled;
- contributions aggregate correctly;
- corporate workflows generate requirements;
- expenses do not depend on bank payment;
- limits update automatically;
- boundary tests pass.

---

# 88. MILESTONE 5 — DOCUMENTS + OCR + DOCUMENT AI

Implement:

- private file storage;
- Document;
- DocumentVersion;
- DocumentAnalysis;
- hashing;
- exact duplicate detection;
- job queue;
- OCR provider abstraction;
- document AI abstraction;
- classification;
- extraction;
- human verification;
- entity suggestions;
- bulk upload.

Definition of Done:

- documents upload securely;
- originals remain immutable;
- invoice data can be extracted;
- extracted finance data is not authoritative until confirmed;
- duplicate files detected;
- jobs retry safely.

---

# 89. MILESTONE 6 — BANKING

Implement:

- BankAccount;
- BankConnection;
- BankingProvider abstraction;
- CSV import;
- XLS/XLSX import;
- column mapper;
- ImportBatch;
- BankTransaction;
- duplicate prevention;
- Reconciliation;
- deterministic matching;
- optional AI-assisted matching;
- reconciliation UI.

If no live Open Banking credentials/provider are available, implement a production-ready adapter interface plus a safe mock/sandbox provider and clearly document what remains for provider activation.

Do NOT fake a real banking integration.

Definition of Done:

- CSV/XLS transactions import reliably;
- duplicate transactions prevented;
- matches suggested;
- user can confirm/reject;
- imported data is auditable;
- Open Banking adapter interface exists.

---

# 90. MILESTONE 7 — COMPLIANCE + TRANSPARENCY

Implement:

- compliance overview;
- compliance inbox;
- severity states;
- overrides;
- TransparencyRecord;
- CV;
- criminal certificate validation;
- publication tracking;
- municipal local-rule status;
- preventive budget rules;
- privacy profile;
- campaign timeline;
- notifications/reminders.

Definition of Done:

- candidate sees actionable compliance status;
- blockers cannot be hidden;
- professional override is audited;
- applicable deadlines calculate correctly.

---

# 91. MILESTONE 8 — REPORTING

Implement:

- report completeness;
- pre-filing check;
- Report;
- ReportSnapshot;
- template abstraction;
- PDF generation;
- report versioning;
- finalization;
- stale-report detection;
- dossier generation;
- Filing;
- Authority;
- authority communications.

Definition of Done:

- reproducible report generated from snapshot;
- finalized report cannot silently change;
- dossier export works;
- filing can be tracked;
- zero-campaign workflow works.

---

# 92. MILESTONE 9 — AI ASSISTANT

Only now implement the campaign/legal assistant.

Implement:

- RAG on validated sources;
- campaign context retrieval;
- rules engine tool access;
- structured financial query tools;
- source-aware responses;
- legal uncertainty handling;
- “Posso fare questa operazione?” simulator.

The LLM must never be the primary source of:

- spending limits;
- legal deadlines;
- threshold decisions;
- report completeness;
- mandatary obligations.

Definition of Done:

- assistant /references sources;
- answers use campaign-specific rules;
- structured financial questions query database;
- uncertain legal issues are explicitly flagged.

---

# 93. MILESTONE 10 — BULK/API/HARDENING

Implement/finalize:

- public API structure;
- OpenAPI docs;
- bulk onboarding;
- export;
- MFA;
- security review;
- rate limits;
- comprehensive authorization tests;
- E2E tests;
- performance review;
- observability;
- backup/deployment documentation.

Definition of Done:

- platform can be safely deployed to staging;
- security controls documented;
- critical user journeys covered by tests;
- API documented;
- tenant isolation tested.

---

# 94. DO NOT ASK THE USER TO MAKE LOW-LEVEL TECHNICAL DECISIONS UNLESS NECESSARY

You are responsible for normal engineering decisions.

Do not stop merely to ask:

```text
Prisma or Drizzle?
Vitest or Jest?
folder A or folder B?
```

Choose the sensible option consistent with this spec and document it.

Only escalate decisions that materially affect:

- legal behavior;
- security;
- data integrity;
- irreversible architecture;
- paid external providers;
- product scope.

---

# 95. DO NOT INVENT EXTERNAL INTEGRATIONS

If credentials or contracts are absent for:

- Open Banking;
- AI provider;
- email provider;
- cloud object storage;
- malware scanning;

build:

- provider abstraction;
- configuration;
- mock/sandbox adapter where appropriate;
- documentation.

Do not pretend the live integration works.

---

# 96. ENVIRONMENT VARIABLES

Provide:

```text
.env.example
```

Never commit real secrets.

Validate required env variables at startup.

Separate:

```text
development
test
production
```

config.

---

# 97. DATABASE MIGRATIONS

All schema changes must use migrations.

Never rely solely on development database push.

Seed scripts must be idempotent where possible.

Create seed data for:

- initial legal source placeholders;
- initial ruleset;
- sample election;
- development candidate;
- representative rule fixtures.

Clearly mark legal seed data requiring human verification.

---

# 98. DEVELOPMENT FIXTURES

Create realistic fake test campaigns.

For example:

```text
Campaign A
Political candidate
mandatary
corporate contribution
several expenses

Campaign B
Municipal councillor
population >15k
self-funded < exception threshold

Campaign C
Municipal candidate
local rules unverified
```

Never use real personal data in fixtures.

---

# 99. QUALITY GATES

At the end of every milestone run:

```text
format
lint
typecheck
unit tests
integration tests
rules regression tests
build
```

Where relevant:

```text
e2e
```

Do not claim completion with failing tests unless the failure is clearly documented as environment/external dependency related.

---

# 100. CODE QUALITY

Prefer:

- explicit types;
- small domain services;
- pure rule evaluation functions;
- transactional writes for financial workflows;
- service boundaries;
- predictable errors;
- typed API responses.

Avoid:

- gigantic React components;
- business logic in pages;
- untyped JSON everywhere;
- magic strings;
- hidden financial calculations;
- silent catch blocks;
- duplicated permission checks;
- random legal constants.

---

# 101. TRANSACTIONS

Use database transactions for workflows such as:

```text
create contribution
update donor aggregate
create audit event
generate initial finding
```

where partial execution would corrupt business state.

Similarly for report finalization.

---

# 102. MONEY

Never use floating-point JavaScript numbers for authoritative monetary calculations.

Use:

- database Decimal/Numeric;
- appropriate money helpers.

Define rounding behavior explicitly.

Currency initially:

```text
EUR
```

but keep currency in relevant records.

---

# 103. DATES AND TIME

Legal deadlines are sensitive.

Store timestamps in UTC where appropriate.

Store relevant election/legal calendar dates as date-only types where time is not legally meaningful.

Calculate statutory date offsets deliberately.

Test:

- month ends;
- leap years;
- DST irrelevance for date-only deadlines;
- P3M vs P90D.

---

# 104. LEGAL DISCLAIMER IN PRODUCT

Do not plaster generic disclaimers everywhere.

Provide a professional product notice making clear that:

- the platform supports compliance workflows;
- legal rules are based on configured sources;
- professional review may remain necessary;
- AI suggestions are assistive;
- the platform does not replace competent authorities.

Do not undermine the usefulness of the product with constant warnings.

---

# 105. FUTURE REGIONAL MODULE

Ensure all architecture supports:

```text
ITALY_BASE
+
REGIONAL_NATIONAL_BASE
+
REGION_SPECIFIC_RULESET
+
COREGE_REGION
```

Do not implement speculative regional rules now.

The future regional module must be able to override/extend national rules without code duplication.

---

# 106. FUTURE LIST/PARTY MODULE

The current architecture must allow future:

```text
ListCampaign
CandidateNomination
CandidateDocuments
SignatureCollection
ListExpense
ListDashboard
```

Organization + Campaign + ExpenseAllocation + Bulk Onboarding must already prepare for this.

Do not build the UI now.

---

# 107. INITIAL RULESET COMPOSITION MODEL

Support composable rule layers conceptually such as:

```text
ITALY_BASE

FINANCING_GENERAL

POLITICAL_[VERSION]

MUNICIPAL_NATIONAL_[VERSION]

TRANSPARENCY_[VERSION]

COREGE_TOSCANA_[VERSION]

MUNICIPALITY_[NAME]_[VERSION]
```

A municipal campaign may therefore compose:

```text
ITALY_BASE
+
FINANCING_GENERAL
+
MUNICIPAL_NATIONAL
+
TRANSPARENCY
+
COREGE_TOSCANA
+
MUNICIPALITY_SPECIFIC
```

Rules may extend or override only through explicit, auditable mechanisms.

---

# 108. LEGAL RULE PARAMETER TABLE

Create a data structure for configurable legal parameters.

Conceptually:

```text
LegalParameter
```

Fields:

```text
id
ruleset_version_id

key
value
value_type

unit

effective_from
effective_to

legal_source_id

notes
```

Examples:

```text
POL_FIXED_AMOUNT
POL_PER_RESIDENT_AMOUNT

MUN_COUNCILLOR_BAND1_FIXED
MUN_COUNCILLOR_BAND1_PER_VOTER

MANDATARY_SELF_FUNDED_EXCEPTION_THRESHOLD

DONOR_DECLARATION_THRESHOLD

CRIMINAL_CERTIFICATE_MAX_AGE_DAYS
```

This prevents legal numbers being scattered through code.

---

# 109. ADMIN CHANGE CONTROL

Activating or modifying a legal rule should:

1. create a new draft version;
2. require validation;
3. execute regression tests;
4. record reviewer;
5. activate explicitly;
6. preserve prior version.

Do not mutate active historical rules in place.

---

# 110. EXPECTED FIRST RESPONSE TO THIS MASTER PROMPT

DO NOT immediately generate the entire application.

Your FIRST response/task should:

1. inspect the repository/environment;
2. summarize the architecture you will implement;
3. identify any conflicts between this specification and existing code;
4. create a milestone implementation plan;
5. identify external-provider dependencies that cannot yet be activated;
6. identify any legal rules that require explicit human verification before seeding;
7. propose the initial repository structure;
8. proceed with Milestone 0 and Milestone 1 unless an actual blocking issue exists.

Do not ask for clarification where a safe and reversible engineering assumption can be made.

Document assumptions.

---

# 111. DEFINITION OF SUCCESS

The project is successful when a candidate can eventually:

1. create an electoral campaign;
2. identify the applicable electoral regime;
3. understand whether a mandatary is required;
4. appoint and invite that mandatary;
5. configure the electoral bank account;
6. connect/import bank transactions;
7. photograph/upload invoices;
8. automatically extract invoice data;
9. register contributions and donors;
10. track donor aggregates;
11. manage corporate contributions;
12. register free goods/services;
13. reconcile bank transactions;
14. see the applicable spending limit;
15. see remaining available spending capacity;
16. monitor legal/documentary tasks;
17. receive deadline reminders;
18. manage CV and criminal record transparency requirements;
19. continuously build the electoral report;
20. run a final pre-filing check;
21. generate a versioned report;
22. generate the filing dossier;
23. record filing;
24. manage later authority requests;
25. ask campaign-specific compliance questions with traceable sources.

The system must achieve this while preserving:

```text
legal traceability
data integrity
tenant isolation
auditability
rules versioning
human verification of AI extraction
reproducible reports
security
```

These are non-negotiable product invariants.
