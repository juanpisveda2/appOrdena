# Definition of Ready

A slice is ready for implementation only when every item below is satisfied.

## Mandatory Checklist
- [ ] Human has approved the relevant product and architecture documents.
- [ ] Scope is limited to one approved MVP slice.
- [ ] Confirmed facts, assumptions, and pending decisions are separated for that slice.
- [ ] Business rules for the slice are documented without invention.
- [ ] Entities, relationships, constraints, and invariants for the slice are documented.
- [ ] User flows, states, transitions, and edge cases for the slice are documented.
- [ ] Transaction boundaries are documented for all critical writes in the slice.
- [ ] Security boundary impact is documented for renderer, preload, and privileged process.
- [ ] Data persistence and migration impact is documented.
- [ ] Audit requirements are identified.
- [ ] Open questions that block correctness are answered or explicitly deferred by human decision.
- [ ] No additional libraries are proposed unless tied to a concrete technical issue.
- [ ] AI agents have explicit approval to begin implementation.

## Slice-Specific Exit From Ready Review
- Foundation slice may start now because storage location, preload boundary, and migration strategy are already approved in the current documentation set.
- Sales slice cannot start until historical snapshot fields and status derivation are approved.
- Backup/restore slice cannot start until safe replacement behavior, restart-based restore flow, verification scope, and rollback expectation are approved.

## Not Ready Signals
- Business rules are inferred rather than stated.
- Data model still hides unresolved contradictions.
- Transactional operations are not clearly atomic.
- Security boundary is ambiguous.
- Human approval for coding has not been given.

## Current Readiness Note
- After the approved documentation updates for personalization interpretation, on-demand Excel reporting scope, and indefinite commercial data retention, the project is approved to start implementation of **Slice 1 — Desktop foundation, security, SQLite, and migrations**.
