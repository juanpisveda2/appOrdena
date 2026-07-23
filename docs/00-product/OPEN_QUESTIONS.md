# Open Questions

Only unresolved decisions implied by the requirements are listed here.

## Pending Decisions
- None at this time.

## Explicitly Not Open
- Multi-user support
- Authentication and roles
- Cloud sync
- Multiple suppliers
- Returns and exchanges in MVP
- New libraries without a documented technical issue

## Confirmed Decisions
- MVP Home is an operational screen, not an analytical dashboard. It exists to help a low-technical user identify the next action quickly, prioritizes direct actions and operational pending items, avoids decorative metrics/charts/excess information, and keeps the layout brief and readable.
- Home main actions in MVP are fixed to **Register Stock**, **Register Sale**, **Register Payment**, and **Settle Consignments**, using large readable text buttons rather than icon-only actions.
- Home indicators in MVP are fixed to active sales with pending balance count, total amount pending collection, and total amount pending supplier settlement.
- Home indicators follow these rules: pending sales count includes only active sales with balance greater than zero; pending collection sums balances for non-cancelled sales; pending supplier settlement sums historical supplier cost for sold items belonging to active sales and not yet settled; cancelled sales, cancelled payments, and already settled items are excluded.
- Home navigation is fixed in MVP: **Register Stock** opens the stock intake form directly, **Register Sale** opens a new sale directly, **Register Payment** opens search for sales with pending balance, **Settle Consignments** opens the list of pending items, and payment search may use customer name, phone, or sale number.
- Home initial and refresh behavior is fixed in MVP: if no stock exists yet, show a clear invitation to register the first product; do not show a complex empty dashboard or decorative zero-state metrics; refresh indicators on entering or returning to Home; do not add real-time updates, polling, or background processes; and do not let one indicator failure block the main actions.
- Home explicitly excludes charts, profit by period, monthly comparisons, best-selling products, low stock, latest operations tables, recent movements, historical metrics, settings as a main action, backups as a main action, and shortcuts/components without immediate operational value.
- Percentage storage uses exact integer basis points (`10000 = 100%`, `300 = 3%`, `1000 = 10%`).
- Sales use a visible sequential `saleNumber` separate from the internal `id`; it is commercial only, never reused, and cancelled sales keep their number.
- Payment correction in MVP uses cancellation plus replacement: confirmed payments are never edited or deleted, `cancelledAt` marks cancellation time, `cancellationReason` is required on cancellation, and sale calculations use only active payments.
- Customer is optional only for sales fully paid at confirmation time. If an active sale keeps pending balance, customer name and phone are mandatory, business-layer validation is required, `customerId` may remain `null` only for fully paid walk-in sales, and reports/exports must display `Walk-in sale` with empty phone when `customerId` is `null`.
- MVP product identification is intentionally simplified: no visible product code, no functional `productCode`, no reserved future-code structure, internal relations use only `id`, product search uses name/category/material/variant, and exports identify products with category/name/material/variant only.
- MVP product lifecycle is intentionally simplified: no archived state, no logical deactivation, zero-stock products remain in the catalog, search may still show them with visual differentiation, and future archiving can be added later through migration if needed.
- MVP restore is an explicit user-triggered in-app flow with restart: select backup, verify SQLite ownership and compatible schema, confirm, create an automatic copy of the current database, close SQLite, replace the active database, restart, validate open, and automatically recover the previous copy if reopen fails.
- MVP restore must stay proportional to scope: no permanent infrastructure, no resident background services, no always-on helper processes, no complex external logging systems, no advanced multi-backup administration, no automatic repair of damaged databases, and no compatibility promises for unknown future versions.
- Official MVP Windows distribution format is a `.exe` installer for low-technical users; no portable build is included in MVP.
- Current documented Electron Forge Windows installer direction is `@electron-forge/maker-squirrel` because Forge officially documents it as the Windows installer maker that produces `Setup.exe` installers.
- The maker choice is approved as the technical direction only; implementation must verify the installed Electron Forge version still officially supports `@electron-forge/maker-squirrel` before wiring packaging configuration.
- MVP packaging does not include auto-update implementation even though Squirrel can generate updater-related artifacts.
- Packaging validation is not done until a clean Windows machine confirms: app opens from shortcut, data persists after closing, reinstall does not delete user data, and uninstall behavior regarding user data is documented.
- Personalization is an optional additional amount charged to the buyer; it is not a product category or material, applies only to jewelry and mate products in MVP, remains optional, is entered per unit at sale time, keeps manual stock-intake cash/list prices, uses a default `5%` personalization percentage, and preserves historical personalization values on sold-item snapshots and allocation history.
- Excel export is approved only as Excel `.xlsx`; PDF export is not part of MVP. The export is a general on-demand operational report, not a strict monthly-filter or month-close export. Month and dates remain visible context for interpretation, current stock and pending consignments reflect generation time, settled consignments are not tied to strict month-end control, and the report visibly shows its generation timestamp.
- Sales stock allocation is closed for MVP: allocation is automatic FIFO by intake date ascending, uses creation date or internal ID ascending as deterministic tie-break when needed, never exposes manual lot selection in the sale UI, validates and allocates inside the sale-confirm transaction, preserves allocation history per consumed intake, and restores the exact original intakes on sale cancellation.
- Sale UX is closed for MVP: user may remove draft products before confirmation, may only choose cash or list price without manual sale-price editing, and must see a clear confirmation summary with products, quantity, price type, subtotal per product, total, initial payment, balance, and buyer when applicable.
- Commercial database retention is indefinite for products, customers, sales, sale items, payments, consignments, and audit records; there is no automatic age-based deletion and no six-month deletion rule.
