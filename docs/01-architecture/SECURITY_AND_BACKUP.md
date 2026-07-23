# Security and Backup

Security and data protection requirements for the offline desktop MVP.

## Confirmed Facts

## Security Baseline
- `contextIsolation` must be enabled.
- `nodeIntegration` must remain disabled.
- React renderer must not directly access:
  - Node.js
  - Filesystem
  - SQLite
- Preload must expose a minimal typed API via `contextBridge`.
- All data from the renderer must be validated in the privileged process.
- Business rules must remain outside React components.
- SQL must not be placed in UI components.

## Local Persistence Rules
- SQLite database must be stored in the Electron user data directory.
- Active application data should use Electron paths, especially `app.getPath("userData")`.
- Database must not be stored inside the installation folder.
- Backups and user-managed files must also live outside the installation folder.
- Persistence must work offline.
- Versioned migrations are required from the start.
- Reinstall or update must not delete user data.
- Commercial database records are retained indefinitely; no automatic age-based deletion is allowed.

## Windows Installer Direction
- MVP Windows distribution format is a `.exe` installer.
- No portable build is included in MVP.
- Current documented Electron Forge direction is `@electron-forge/maker-squirrel` because Forge officially documents it as the Windows installer maker that produces `Setup.exe` installers.
- The maker choice must be re-verified against the actual installed Electron Forge version at implementation time because this repository does not yet contain the package or lockfile that will pin the version.
- MVP does not implement auto-update even though Squirrel supports related artifacts.
- Installer behavior should favor current-user installation and avoid admin permission requirements when technically possible.
- Installer UX must support desktop and Start Menu shortcuts and normal Windows uninstall entry points.

## Audit Requirements
- Maintain an audit log for sensitive operations.
- Sensitive operations confirmed by requirements include:
  - Sale confirmation
  - Payment cancellation
  - Replacement payment creation after a cancellation-based correction
  - Sale cancellation
  - Consignment settlement
  - Backup
  - Restore
- Payment audit entries must capture at minimum:
  - cancellation timestamp
  - mandatory cancellation reason
  - affected sale and payment identifiers
  - the fact that the original payment values remain unchanged

## Backup Requirements

### Manual backup
- User can create a manual copy of the SQLite database.
- User chooses destination.
- Filename includes date and time.
- Operation must be audited.

### Restore
- Restore must run from inside the application and only when the user explicitly requests it.
- Restore must use a safe guided flow sized for the MVP.
- Selected backup must be verified before replacing the active database.
- Verification must confirm a valid SQLite database for this application and a compatible schema version.
- Active database must not be overwritten without confirmation.
- System must create an automatic copy of the current database before replacement.
- SQLite connection must be closed before replacing the active database file.
- Application restart is part of the restore flow.
- After restart, the restored database must be opened successfully or the previous copy must be recovered automatically.
- Operation must be audited.
- MVP restore must not require permanent services, resident background processes, always-on helper processes, complex external logging systems, advanced multi-backup administration, automatic repair of damaged databases, or compatibility with unknown future versions.

## Data Retention Scope
- Products, customers, sales, sale items, payments, consignments, and audit records remain in the commercial database indefinitely.
- Commercial data may be cancelled or reversed according to business rules, but not physically deleted because of age.
- Expected structured data volume remains small enough for SQLite and does not justify losing commercial history.
- Future cleanup policies for backups, Excel exports, or logs are separate operational concerns and do not alter commercial database retention.

## Export Rules
- Excel export is a readable backup/reporting artifact.
- Generated file format: `.xlsx`.
- Excel export is an on-demand operational report, not a strict monthly-close artifact.
- Dates and month context must remain visible in the report for interpretation.
- Export may also be shown to the supplier.
- Export must be formal, clear, and easy to read.

## Failure-Safety Expectations
- Invalid renderer payloads must fail before database mutation.
- Partial writes on critical business operations are forbidden.
- Restore failure must not corrupt or partially replace the active database.
- Failed restore validation must leave the active database untouched.
- Failed reopen after restore must trigger automatic recovery of the previous copy.
- Backup operations must never target the installation directory as the active database location.
- Validation on a clean Windows machine must confirm that reinstall does not delete user data.
- Uninstall behavior regarding user data must be documented from validation results.

## Assumptions
- Because the app is offline and single-machine, security emphasis is process isolation, integrity, and safe local file handling rather than remote threat models.
- Backup verification means at minimum checking that the selected file is a valid SQLite database for this application and that its schema version is compatible with the MVP.

## Pending Decisions
- Exact backup verification checklist beyond SQLite validity, application ownership, and schema-version compatibility.
- Whether audit detail payloads should include before/after snapshots for certain sensitive actions.
