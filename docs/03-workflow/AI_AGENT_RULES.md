# AI Agent Rules

These rules govern future AI-assisted work in this repository.

## Non-Negotiable Workflow Constraints
- No code implementation before explicit human approval.
- Documentation is the source of truth until a human approves implementation start.
- Agents must work in English for technical artifacts.
- Agents must not invent business rules.
- Agents must not expand MVP scope.
- Agents must not add libraries unless a concrete technical problem is documented first.

## Architecture Guardrails
- Respect Electron security boundaries.
- Keep `contextIsolation` enabled.
- Keep `nodeIntegration` disabled.
- Do not allow renderer access to Node.js, filesystem, or SQLite.
- Use preload plus `contextBridge` as the only renderer bridge.
- Keep business rules out of React components.
- Do not place SQL in UI components.
- Validate renderer-originated data in the privileged process.

## Persistence Guardrails
- Use versioned migrations from day one.
- Store the database in the Electron user data directory.
- Never store the active database in the installation folder.
- Use transactions for sales, stock, payments, cancellations, and settlements.
- Use integer cents for all money values.
- Do not use floating-point numbers for money.
- Use the approved exact representation for percentages.
- Maintain audit logging for sensitive operations.

## Documentation Discipline
- Separate confirmed facts, assumptions, and pending decisions.
- Update docs when an approved decision changes architecture, workflow, or business behavior.
- Keep product, architecture, and delivery docs internally consistent.
- Record open questions instead of silently guessing.

## Approval Gates
- Before coding, confirm:
  - product docs approved
  - architecture docs approved
  - slice approved
  - blocking open questions resolved or explicitly deferred
- If any gate is missing, stop and ask for approval rather than coding.

## Prohibited Agent Behavior
- Implementing code without approval
- Smuggling in extra features
- Changing the stack without documented justification
- Moving business logic into React UI for speed
- Writing direct SQLite or filesystem access in the renderer
- Rewriting history-sensitive data without explicit approved rules
