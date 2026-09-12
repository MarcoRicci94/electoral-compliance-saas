# ADR 0001: Begin as a modular monolith

## Status

Accepted for the initial implementation.

## Context

The product needs strong transactional integrity across finance, audit events, compliance evaluation and reporting. It also needs well-defined module boundaries and asynchronous processing, but has no demonstrated scale requirement that justifies distributed coordination.

## Decision

Build one TypeScript deployment with explicit domain modules, PostgreSQL transactions and an internal application-event/job boundary. Next.js exposes the web UI and `/api/v1`; Redis/BullMQ runs slow or retryable work. Modules communicate through typed application services and events rather than database access from arbitrary UI code.

## Consequences

This reduces deployment and data-consistency complexity while preserving extractable interfaces for storage, banking, OCR/AI and notifications. Any future service extraction must be justified by concrete scaling, isolation or organizational evidence and preserve audit and tenant-authorization guarantees.
