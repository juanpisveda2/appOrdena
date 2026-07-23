# Architecture

Electron desktop architecture for an offline Windows application with strict separation between UI, privileged access, and persistence.

## Confirmed Facts

## Approved Runtime Boundary

| Layer | Responsibility | Forbidden |
|------|----------------|-----------|
| React renderer | UI, form interaction, presentation state | Direct Node.js, filesystem, SQLite access |
| Preload | Minimal typed bridge exposed through `contextBridge` | Business rule execution beyond adapter-level validation/mapping |
| Electron main / privileged process | IPC handling, input validation, business use cases, file access, database access, audit, backup/export orchestration | Trusting renderer input without validation |
| SQLite | Local persistence | Direct access from renderer |

## Security Requirements
- `contextIsolation` must be enabled.
- `nodeIntegration` must remain disabled.
- Renderer must not access Node.js, filesystem, or SQLite directly.
- Preload must expose a minimal typed API through `contextBridge`.
- All renderer-originated input must be validated in the privileged process.
- Business rules must be centralized outside React components.
- SQL must not appear in UI components.

## High-Level Module View

| Module | Role |
|--------|------|
| Renderer app | Screens, navigation, forms, readable feedback |
| Shared contracts | Typed request/response contracts and validation schemas shared across boundaries where safe |
| IPC interface | Narrow channel surface for renderer-to-main operations |
| Application services | Use cases for products, stock, customers, sales, payments, consignments, exports, backups |
| Domain rules | Pure business rules and state calculations |
| Persistence adapters | Repositories, migrations, transaction handling |
| Audit module | Sensitive operation logging |
| Backup/export module | Database copy/restore and `.xlsx` generation |

## Recommended Boundary Rules
- React components may request operations through a typed bridge only.
- React components may not calculate authoritative sale state, stock mutations, or settlement mutations.
- Privileged services own validation, transaction scope, and persistence writes.
- Domain calculations must be reusable outside UI.
- Migrations must exist from day one.
- Database file must live in Electron user data directory, never in the installation directory.

## Suggested Runtime Flow
1. Renderer collects user input.
2. Renderer calls a preload-exposed typed API.
3. Preload forwards only approved operations.
4. Main process validates payloads.
5. Main process executes domain service.
6. Service opens transaction if needed.
7. Repository persists to SQLite.
8. Audit is stored for sensitive operations.
9. Main process returns typed result.
10. Renderer presents outcome in everyday language.

## Cross-Cutting Concerns

### Windows packaging boundary
- MVP Windows distribution format is an installer that delivers a `.exe` setup flow, not a portable build.
- Current documented Electron Forge direction is `@electron-forge/maker-squirrel` because Forge officially documents it as the Windows installer maker that produces `Setup.exe` installers.
- This is an approved technical direction, not a locked implementation detail yet: packaging work must confirm the installed Electron Forge version still officially supports this maker before configuration is added.
- MVP packaging must stay minimal: include only files required to run the app.
- MVP does not implement auto-update even if the chosen installer technology supports updater-related artifacts.

### Validation
- UI validation improves usability.
- Privileged validation is mandatory and authoritative.
- Invalid payloads from renderer must fail safely.

### Historical integrity
- Sales must keep copies of cost, percentage, and used price.
- Configuration changes must not rewrite history.

### Exact arithmetic
- Money uses integer cents only.
- Percentages require exact, consistent representation.

### Audit
- Sensitive operations require audit records.
- At minimum this includes sale confirmation, payment cancellation, replacement payment creation after a correction, sale cancellation, consignment settlement, backup, and restore.

### Restore boundary
- Restore is initiated from the application UI and orchestrated by the privileged process.
- Restore runs only on explicit user request; there is no permanent infrastructure, resident background service, or always-on helper process for MVP.
- The privileged process verifies the selected SQLite file, creates an automatic copy of the current database, closes the active SQLite connection, replaces the database file, restarts the application, and validates that the restored database opens.
- If reopen validation fails after restart, the privileged process must recover the previous database copy automatically.
- The restore approach is intentionally proportional to MVP scope: prioritize basic safety, simplicity, and maintainability over advanced backup management.

### Install-time data boundary
- SQLite database, backups, and user-managed files must live outside the installation folder using Electron path APIs, especially `app.getPath("userData")` for active application data.
- Reinstall or update must not delete user data.
- Uninstall behavior for user data must be documented from observed installer behavior during validation, not guessed in advance.

## Assumptions
- Drizzle ORM is used in the privileged process only.
- Zod can define boundary validation schemas, but the exact shared-code placement is still an implementation detail.
- SheetJS runs in the privileged process because export touches files.

## Pending Decisions
- Exact IPC channel naming and grouping.
- Exact folder/module structure.
- Whether one app-wide service layer is enough for MVP or feature-scoped service modules are preferred.
- Whether export generation writes directly to disk or first creates an in-memory workbook then saves.
