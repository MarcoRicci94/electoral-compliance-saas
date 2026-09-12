# Initial legal-rule policy

## Status of this document

The supplied requirements define rule codes and expected behaviour, not verified statutory values. Until a qualified reviewer links each active rule to an official, effective `LegalSource`, its status is `LEGAL_REVIEW_REQUIRED`. No numeric threshold or interpretation in this document is treated as production legal advice.

## Seed strategy

Create only reviewable draft seeds during Milestone 2. Each seed must include code, election type, condition/effect, parameter identifiers, source placeholder, effective period and reviewer status. Activation is blocked where legal source or parameter verification is missing.

## Required initial coverage

- Political scope, mandatary, account, spending-limit structure, expense categories and report rules (`IT-POL-*`).
- Donor aggregation, corporate documentation and in-kind contribution workflows (`IT-FIN-*`).
- Municipal population boundary, spending-limit bands, mandatary exception, report and local-rule verification (`IT-COM-*`).
- Transparency certificate/publication rules (`IT-TRANS-*`).

## Source hierarchy in UI

Distinguish `LAW`, `DECREE`, `REGULATION`, authority/COREGE guidance, municipal regulation, practice, `SYSTEM_CONTROL` and `PRODUCT_BEST_PRACTICE`. Product risk alerts (for example spending-limit warning bands) must never be presented as statutory obligations.

## Open legal-review register

1. Verify the current effective sources and parameters for all spending-limit formulas.
2. Verify mandatary applicability and exceptions by election type, date and factual condition.
3. Verify filing authority, deadlines and report requirements for elected/non-elected candidates.
4. Verify municipal local-rule triggers and territory-specific requirements.
5. Verify contribution aggregation, corporate-donor documentation and prohibited-donor assessments.
6. Verify transparency applicability, publication duties and certificate validity intervals.

If a rule conflicts with a later source or is ambiguous, mark it `LEGAL_REVIEW_REQUIRED`, retain its history, prevent activation as needed and show the campaign evaluation as incomplete rather than guessing.
