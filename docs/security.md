# Security and privacy baseline

This product processes political, identity, financial and donor data. Treat all production data as sensitive.

## Controls

- Use secure password hashing, verified email, session rotation, CSRF safeguards where applicable, MFA-ready authentication and rate limits.
- Enforce server-side organization/campaign authorization on every action. Test cross-tenant IDOR attempts.
- Use private object storage, short-lived signed URLs, safe MIME/content validation, size limits, SHA-256, malware-scan abstraction and quarantine before normal availability.
- Use TLS in transit, managed encryption at rest, secrets supplied only by environment/secret manager, secure response headers and framework XSS protections.
- Never log passwords, complete tokens, banking credentials, raw sensitive documents or unnecessary PII. Use structured logs with redaction.
- Keep `AuditLog` append-only in normal application flows; audit administrative and override actions too.
- Implement retention, export and deletion workflows deliberately. Soft deletion does not mean immediate physical-object deletion.

## Authorization checklist

Before touching an entity: authenticate; resolve organization membership; resolve campaign membership/capability; scope the database query; perform the transaction; append an audit event. Client-submitted IDs are inputs, not proof of entitlement.

## Incident and operations posture

Provide error-tracking and metrics abstractions without exporting sensitive payloads. Track document/OCR failures, bank-sync failures, rule failures, report failures and job retries. Rule failure must visibly degrade compliance state.
