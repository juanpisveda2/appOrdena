# MVP Plan

This plan follows the user-provided slices and adds approval gates before implementation.

## Confirmed Facts

## Recommended Delivery Order

| Slice | Scope | Approval gate before implementation |
|------|-------|--------------------------------------|
| 1 | Desktop foundation, security boundaries, SQLite, migrations | Approve architecture boundaries, storage location, migration strategy |
| 2 | Reusable catalog and stock intake | Approve product/stock model, duplicate warning behavior, percentage defaults |
| 3 | Customers | Approve customer matching and duplicate-warning expectations |
| 4 | Sales with one or more items | Approve sale flow, status rules, historical snapshots |
| 5 | Partial payments | Approve payment constraints and correction model |
| 6 | Sale cancellation and stock restitution | Approve cancellation preconditions and audit behavior |
| 7 | Consignment settlement | Approve sale-item settlement model and batch history behavior |
| 8 | Excel export and backups | Approve export columns, backup flow, restore safety behavior |
| 9 | Packaging, installation, usability trial | Approve validation script for the documented Windows installer direction |

## First Recommended Slice
- **Slice 1: Desktop foundation, security, SQLite, and migrations**

### Why first
- It establishes the non-negotiable security boundary.
- It fixes the local persistence location early.
- It enables every later feature to build on versioned migrations.
- It prevents business logic from leaking into React from the start.

## Slice Outcomes

### Slice 1 — Foundation
- Electron app shell runs on Windows.
- React renderer is isolated from Node.js and SQLite.
- Minimal typed preload bridge exists.
- SQLite database opens from user data directory.
- Versioned migrations run from day one.

### Slice 2 — Catalog and Stock Intake
- Reusable products can be created and remain in the catalog even when stock reaches zero.
- Stock intake creates concrete availability records.
- Duplicate warnings exist for products.
- Expected profit and suggested price are visible but not enforced.

### Slice 3 — Customers
- Customers can be created and suggested by name or phone.
- Duplicate warnings exist without auto-merge.

### Slice 4 — Sales
- One sale can include multiple items.
- Cash/list price selection is stored per item.
- Manual sale-price editing is not allowed; the user only chooses the stored cash or list price.
- Draft sale items may be removed before confirmation.
- Confirmation shows a clear summary before final confirmation, whether in the same flow or a dedicated step.
- Sale confirmation is transactional.
- Stock allocation is automatic FIFO by intake date ascending, with deterministic tie-break by creation date or internal ID ascending.
- Sale UI does not expose manual lot selection.

### Slice 5 — Payments
- Payments can be recorded when they happen.
- Status and balance update transactionally.

### Slice 6 — Cancellation
- Cancelled sale restores stock exactly.
- Cancelled sale blocks further payments.

### Slice 7 — Consignment
- Sale items track pending/settled status.
- Batch settlement and history are available.

### Slice 8 — Export and Backup
- Formal on-demand `.xlsx` operational report is generated.
- PDF export is not included in MVP.
- Manual backup and safe restore flow are available.

### Slice 9 — Packaging and Trial
- App is packaged for Windows as an MVP `.exe` installer.
- Current documented Electron Forge maker direction is `@electron-forge/maker-squirrel`, to be verified against the installed Forge version at implementation time.
- No portable build and no auto-update implementation are included in MVP.
- Installation flow is validated with the target user profile on a clean Windows machine.
- Validation confirms shortcut launch, persisted data after closing, reinstall without user-data loss, and documented uninstall behavior regarding user data.

## Approval Gates Required Before Any Code
- [x] Product docs reviewed and accepted
- [x] Architecture docs reviewed and accepted
- [x] Open questions either answered or explicitly deferred
- [x] First slice scope approved by human owner
- [x] Definition of Ready satisfied for the selected slice
- [x] AI agent rules acknowledged for the repo

## Assumptions
- Slices remain sequential unless a human explicitly approves parallel work.
- Backup/restore can be implemented later within MVP without blocking earlier business slices.
- Excel export remains an approved later slice and `.xlsx` is the only approved MVP export format.
- Packaging should prefer current-user installation without admin permissions when technically possible.

## Pending Decisions
- None blocking the approved start of Slice 1.
