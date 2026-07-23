# Product Scope

Local desktop application for a small family business that sells jewelry, mate products, and clothing. The MVP prioritizes simplicity, consistency, readability, reliability, and preventing incorrect usage.

## Confirmed Facts

### Operational context
- Target OS: Windows.
- Initial deployment: one computer.
- Distribution: Windows `.exe` installer for MVP.
- Internet connection: not required.
- Data persistence: local only.
- Out of MVP scope: users, authentication, roles, multiple branches, cloud sync.

### Approved stack
- Electron
- React
- TypeScript
- Vite
- SQLite
- Drizzle ORM
- Zod
- React Hook Form
- Tailwind CSS
- shadcn/ui
- SheetJS
- Electron Forge
- pnpm
- Vitest
- React Testing Library

### Business scope in MVP
- Reusable product catalog for jewelry, mate products, and clothing.
- Stock intake linked to reusable products.
- Optional personalization charge for jewelry and mate products.
- Customer registration and duplicate warnings.
- Sales with one or more items.
- Partial payments.
- Sale cancellation with stock restitution.
- Liquidation settlement for a single supplier.
- Excel export.
- Manual backup and safe restore inside MVP.
- Packaging, installation, and usability validation.
- No portable build in MVP.

### Approved MVP simplification for product availability
- MVP does not implement product archiving or logical deactivation.
- MVP does not add an archived product state to the model.
- A reusable product remains in the catalog even when all related stock reaches zero.
- Product search may show zero-stock products, but the UI should visually differentiate them from products with available stock.
- This simplification is intentional for MVP because the catalog is expected to stay small, there is a single user, and zero-stock products are not an operational problem.
- If future catalog growth justifies it, product archiving may be added later through an explicit migration without affecting historical records.

### Approved MVP simplification for product identification
- MVP does not include a visible product code.
- MVP does not include a functional `productCode` field.
- Internal relations use only the technical internal `id`.
- Product search remains based on name, category, material, and variant, using case-insensitive, accent-insensitive, spacing-tolerant partial matching from the first typed character.
- Excel exports identify products using category, name, material, and variant.
- No structure is reserved in MVP for future internal codes or supplier-code mapping.
- If a real future need appears, codes or supplier-code mapping must be added later through an explicit migration.

### Approved MVP interpretation for personalization
- Personalization is an optional additional amount charged to the buyer.
- This interpretation is approved now and must be stated explicitly before the functional implementation slice.
- Personalization is not a product category.
- Personalization is not a jewelry material.
- Personalization may apply to jewelry or mate products.
- Personalization does not apply to clothing in MVP.
- Personalization amount is entered manually.
- Stock-intake cash price starts by copying supplier cost, remains fully editable, and stops auto-syncing after a manual override.
- Stock-intake list price remains manually entered.
- Personalization default profit percentage is `5%`.
- Personalization expected profit is calculated only on the personalization amount.
- Base product profit is calculated separately and is not replaced by personalization.
- Personalization is optional.

### Approved MVP Excel report scope
- Excel export is a general operational report that the user may generate on demand at any time.
- Month and dates remain important as visible business context for interpreting the report, but they are not the main filtering function.
- MVP does not require a mandatory month/year selection step or a strict monthly-close export flow.
- The approved MVP export format is Excel `.xlsx` only.
- PDF export is not part of MVP.
- The generated file must clearly show generation date and time plus the relevant visible date/month context needed to interpret the exported information.

### Approved MVP sale allocation and confirmation scope
- Sales allocate stock automatically using FIFO.
- FIFO order is intake date ascending.
- When multiple intakes share the same intake date, deterministic tie-break uses creation date or internal ID ascending.
- The user never manually selects stock intake or lot during sale.
- The sale UI must not expose technical lot details in MVP.
- The system must validate total available stock and resolve allocation inside the sale-confirm transaction.
- If one sale consumes units from multiple intakes, allocation is distributed through FIFO.
- Historical allocation data must preserve the consumed stock intake, historical cost, historical percentage, corresponding cash/list price, and personalization data when applicable.
- Real profit uses the cost of the actually consumed intake.
- Sale cancellation restores quantities to the exact original intakes used.
- Average cost, LIFO, and manual lot selection are out of MVP.

### Approved MVP sale UX clarifications
- User may remove products from the draft sale before confirmation.
- Manual sale-price editing is not allowed during sale; the user only chooses cash or list price.
- Before final confirmation, the flow must clearly show products, quantity, price type, subtotal per product, total, initial payment, balance, and buyer when applicable.
- That summary does not require a separate mandatory screen if it is clearly shown in the same flow.

### Approved MVP commercial data retention
- MVP commercial data is retained indefinitely.
- There is no automatic deletion by age.
- Commercial records must not be deleted after six months.
- Future cleanup rules for backups, Excel files, or logs are separate from the commercial database retention policy.

### Initial screens
- Home
- Products
- Register Stock
- New Sale
- Sales
- Pending Payments
- Liquidations
- Export and Backup
- Settings

### Approved MVP Home screen scope
- Home is an operational screen, not an analytical dashboard.
- Home exists to help a low-technical user quickly identify the next action.
- Home prioritizes direct actions and operational pending items.
- Home must avoid decorative metrics, charts, and excess information.
- Main Home actions use large readable text buttons, never icon-only controls:
  - Register Stock
  - Register Sale
  - Register Payment
  - Settle Liquidations
- Home operational indicators in MVP:
  - Count of active sales with pending balance
  - Total amount pending collection
  - Total amount pending supplier settlement
- Each indicator acts as a shortcut when useful:
  - Register Stock opens the stock intake form directly
  - Register Sale opens a new sale directly
  - Register Payment opens search for sales with pending balance
  - Settle Liquidations opens the list of pending items
- Payment search may use customer name, phone, or sale number.
- If no stock exists yet, Home shows a clear invitation to register the first product.
- MVP Home must not show a complex empty dashboard or decorative zero-state metrics.
- Indicators refresh when entering or returning to Home.
- MVP Home does not include real-time updates, polling, or background refresh processes.
- Failure to load one indicator must not block the main actions.
- Layout must stay brief, readable, and avoid unnecessary vertical scrolling on a typical notebook resolution.

## Confirmed Product Goals
- Make frequent tasks easy to complete correctly.
- Keep commercial history readable and reversible through explicit business actions.
- Preserve historical pricing, cost, and margin context.
- Prevent stock-negative sales.
- Support offline work without internet dependencies.

## Explicit Non-Goals for MVP
- E-commerce terminology or workflows.
- Automated duplicate merging.
- Programmed installments or due dates.
- Returns or exchanges.
- Multiple suppliers.
- Supplier current accounts.
- Multiple branches.
- Remote sync or cloud backup.

## Core Concepts

| Concept | Meaning |
|-------|---------|
| Reusable product | Catalog template reused across multiple stock intakes |
| Stock intake | Concrete stock entry with its own quantity, cost, prices, and margin snapshot |
| Sale | Commercial operation that groups one or more sold items |
| Sale item | Specific sold stock quantity with historical pricing and cost snapshot |
| Payment | Amount received when it actually occurs |
| Consignment settlement | Payment obligation to the supplier for sold items |

## Scope Boundaries

### Included in MVP
- Local data entry and consultation.
- Inventory availability tracking.
- Customer suggestions while typing.
- Sale state calculation.
- Payment recording.
- Audit trail for sensitive operations.
- Export to `.xlsx`.
- Manual database backup and safe restore.

### Excluded until explicitly approved
- New business rules not present in the requirements.
- New libraries without a documented technical issue.
- Any code implementation before human approval.

## Assumptions
- The single supplier model applies to all consignment logic during MVP.
- "Products" screen covers both browsing reusable products and current availability, but exact visual split is still a design decision.
- Reusable products with zero stock remain visible in the catalog during MVP and are handled through presentation cues rather than lifecycle states.
- Packaging must prioritize a simple installer flow for a low-technical Windows user.
- The approved technical direction is an Electron Forge Windows `Setup.exe` installer using the currently documented `@electron-forge/maker-squirrel` maker, subject to implementation-time verification against the installed Forge version.
- MVP packaging excludes portable distribution and auto-update implementation.
- Restore happens inside the application but includes an application restart as part of the approved MVP flow.
- Restore scope must stay proportional to MVP size: basic safety, simplicity, and maintainability first.
- MVP restore does not include permanent infrastructure, resident background services, always-on helper processes, advanced multi-backup administration, automatic repair of damaged databases, or compatibility promises for unknown future versions.
- Structured commercial data volume is expected to remain small enough for SQLite without justifying age-based deletion.

## Pending Decisions
- None related to the approved MVP product scope.
