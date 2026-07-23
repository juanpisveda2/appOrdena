# Business Rules

This document captures confirmed business behavior only. No rule below should be expanded without explicit approval.

## Confirmed Facts

- Percentage storage uses exact integer basis points.
- Approved basis point examples: `10000 = 100%`, `300 = 3%`, `1000 = 10%`.
- Each sale has a visible sequential `saleNumber`: `1, 2, 3...`.
- `saleNumber` is used in UI, search, reports, and exports.
- The internal technical `id` remains separate from `saleNumber`.
- `saleNumber` is never reused.
- Cancelled sales keep their original `saleNumber` and only change status.
- MVP sales are not physically deleted.
- Entity references use internal `id`; `saleNumber` is commercial only.

## Products and Catalog

### Reusable product
- Fields:
  - Category
  - Name
  - Optional description
  - Material
  - Variant, size, or measurement
- MVP must not add a visible product code.
- MVP must not add a functional `productCode` field.
- MVP must not add an archived product state or any logical deactivation flag.
- Reusable products are identified for user workflows by category, name, material when present, and variant.
- Internal technical relations use only the internal `id`.
- Reusable products remain visible in the catalog even when their current available stock is zero.
- Initial categories:
  - Jewelry
  - Mate products
  - Clothing

### Stock intake
- Fields:
  - Reusable product reference
  - Entered quantity
  - Available quantity
  - Supplier unit cost
  - Optional personalization amount
  - Optional personalization percentage
  - Optional personalization expected profit
  - Cash price
  - List price
  - Profit percentage
  - Expected profit
  - Date
  - Notes
- One reusable product may have many stock intakes.
- Jewelry usually uses quantity `1`, but quantities greater than `1` must remain allowed.
- Sales without stock are not allowed.
- If personalization applies, the entered personalization amount represents the additional amount charged to the buyer.
- Personalization is optional.
- Personalization is not a product category and not a material.
- Personalization may apply to jewelry or mate products.
- Personalization does not apply to clothing in MVP.
- Personalization amount is entered manually.
- Personalization default percentage is `5%`.
- Personalization percentage must not replace the base product percentage.
- Historical applied personalization values must be saved from the sale-time snapshot and reused by downstream liquidation/export reads.

### Product autocomplete
- Search fields:
  - Name
  - Category
  - Material
  - Variant
- Matching rules:
  - Ignore case differences
  - Ignore spacing differences
  - Ignore accent differences
  - Match from the first typed character using partial substrings
- Behavior:
  - Show readable matches
  - Allow matches with zero stock
  - Visually differentiate zero-stock products from products with available stock
  - Warn before creating a possible duplicate
  - Do not auto-merge products
  - Do not depend on any code field

## Pricing and Profit
- Expected profit formula:
  - `expected profit = supplier cost × profit percentage`
- Personalization expected profit formula:
  - `personalization expected profit = personalization amount × personalization percentage`
- Total expected profit formula when personalization applies:
  - `total expected profit = base expected profit + personalization expected profit`
- Suggested price formula:
  - `suggested price = supplier cost + expected profit`
- Stock intake cash price is prefilled from supplier cost on new forms, remains editable, and stops auto-syncing after manual override.
- Stock intake list price is entered manually.
- During sale creation, the user may only choose the stored cash price or stored list price for each item.
- Manual sale-price editing is not allowed in MVP.
- Suggested price is informative only.
- The system must show:
  - Supplier cost
  - Configured percentage
  - Expected profit
  - Personalization amount when applicable
  - Personalization percentage when applicable
  - Personalization expected profit when applicable
  - Entered cash price
  - Entered list price
- Real profit at sale time:
  - `real profit = sale price used - supplier cost`
- When a sale consumes stock from multiple intakes, real profit must use the historical cost of the actually consumed intake for each consumed allocation.
- Default percentages:
  - Gold jewelry: `3%`
  - Silver jewelry: `10%`
  - Mate products and clothing: general `10%`
- Default personalization percentage:
  - Personalization charge: `5%`
- Percentage persistence uses exact integer basis points (`10000 = 100%`).
- Personalization percentage persistence also uses exact integer basis points.
- Personalization amount persistence uses integer cents.
- Percentages must be editable in Settings.
- A stock intake may override the configured percentage.
- Percentage changes must not alter historical products, stock intakes, or sales.
- Personalization percentage changes must not alter historical sold-item snapshots or allocation history.
- Example approved for documentation and implementation:
  - Base cost: `$100,000`
  - Silver base percentage: `10%`
  - Base expected profit: `$10,000`
  - Personalization amount: `$5,000`
  - Personalization expected profit: `$250`
  - Total expected profit: `$10,250`

## Customers
- Fields:
  - Name
  - Phone number
  - Optional note
- Phone must be stored as text.
- While typing name or phone, existing customers must be suggested.
- Possible duplicates must be warned.
- Duplicates must not be merged automatically.

### Customer requirement by sale state
- Customer is optional only when the sale is fully paid at confirmation time.
- Customer is mandatory when the sale remains pending or partially paid.
- For a sale with pending balance, both customer name and phone are mandatory.
- Do not create a fake customer record named `Walk-in sale`.
- When a fully paid sale has no customer, `customerId` remains `null`.
- Fully paid sales without customer must be displayed as `Walk-in sale`.

## Sales
- A sale may contain one or many products.
- Each sale has a visible sequential `saleNumber` for commercial use.
- UI label must use "Products in this sale" and avoid e-commerce wording.
- Before confirmation, the user may remove products from the draft sale.
- The sale flow must show a clear confirmation summary before final confirmation.
- That summary does not need a separate mandatory screen if it is clearly visible in the same flow.
- The confirmation summary must show:
  - Products
  - Quantity
  - Price type
  - Subtotal per product
  - Total
  - Initial payment
  - Balance
  - Buyer when applicable
- During sale creation, the user never manually selects a stock intake or lot.
- Sale UI must not expose technical lot details during sale creation in MVP.
- Stock allocation strategy for sales is automatic FIFO.
- FIFO order uses intake date ascending.
- If multiple stock intakes share the same intake date, tie-break using creation date or internal ID ascending to keep deterministic behavior.
- The system must not allow confirming a sale whose requested quantity exceeds the total currently available stock.
- Sale confirmation must:
  - Validate total available stock
  - Validate customer rules in the business layer
  - Resolve consumed stock automatically using FIFO inside the confirmation transaction
  - Create the sale
  - Create sale items
  - Store historical copies of cost, percentage, used price, and personalization values when applicable
  - Preserve per consumed allocation at least:
    - `stockIntakeId`
    - Historical supplier cost
    - Historical percentage
    - Corresponding cash/list price
    - Personalization data when applicable
  - Decrease stock from the exact consumed intakes
  - Register initial payment if present
  - Calculate total, paid, and balance
  - Calculate status
  - Register audit
- All of the above must run inside one transaction.
- Do not allow confirming a sale with balance greater than zero without a customer.
- Validation for customer requirement must exist in the business layer, not only in the UI.
- FIFO allocation must distribute a sale across multiple stock intakes when required by available stock.
- Average cost is not allowed in MVP.
- LIFO is not allowed in MVP.
- Manual lot selection is not allowed in MVP.
- General sale editing is out of MVP scope.
- Controlled exception: the model may later associate a customer to a fully paid sale that currently has no customer, only to support a future payment cancellation that would otherwise create pending balance.
- When that controlled recovery assignment happens, historical sale/liquidation/export views must update to show the assigned customer name for that sale.

### Sale status rules
- `Pending`: no payments.
- `Partial payment`: payments exist but do not cover the total.
- `Paid`: payments equal the total.
- `Cancelled`: the sale was cancelled.
- `Pending`, `Partial payment`, and `Paid` are computed automatically.
- Sale status is not manually editable.
- Cancelled sales keep their original `saleNumber`.

## Payments
- Payments are recorded only when they happen.
- No scheduled installments.
- No due dates.
- Fields:
  - Sale reference
  - Date
  - Amount
  - Optional payment method
  - Optional note
- Initial payment methods:
  - Cash
  - Bank transfer
- Payment method is optional.
- Active payment representation:
  - `cancelledAt` is nullable
  - `cancellationReason` is nullable at rest but mandatory when cancelling
  - A payment is active while `cancelledAt` is `null`
  - No editable payment status field is needed for MVP
- Rules:
  - Amount must be greater than zero
  - Amount cannot exceed the pending balance during MVP
  - Payments are not allowed on cancelled sales
  - Confirmed payments are never directly edited
  - Confirmed payments are never physically deleted
  - Direct payment editing is out of MVP scope
  - A confirmed payment may be cancelled only through an explicit action
  - Cancellation requires a mandatory reason
  - The original payment keeps its amount, date, method, and notes
  - Cancellation must record date and time
  - Payment cancellation must be recorded in audit
  - If a payment was recorded incorrectly, it must be cancelled and then replaced by a new correct payment
  - Payments of an already cancelled sale cannot be cancelled in MVP unless a future rule explicitly allows it
  - Sale paid amount, balance, and computed status consider only active payments
  - Payment cancellation and sale recalculation must run inside a single transaction
  - Payment registration, cancellation, total paid, balance, and status recalculation must run inside a transaction
  - Do not allow cancelling a payment if that cancellation would leave pending balance on a sale without customer
  - In that case, a customer with name and phone must be assigned first

## Sale Cancellation
- Cancellation requires:
  - Explicit confirmation
  - Required reason
- Cancellation must:
  - Mark sale as cancelled
  - Restore exactly the deducted stock to the original consumed stock intakes
  - Prevent new payments
  - Register audit
  - Keep sale and sale items stored
- Entire operation must run inside a transaction.
- If any sale item has already been settled with the supplier, automatic cancellation is not allowed.
- In that case, the system must inform that the settlement must be reversed or adjusted before cancellation.
- Returns and exchanges are out of MVP scope.

## Consignment
- MVP supports one supplier only.
- Each sold item has a settlement state:
  - Pending settlement
  - Settled
- Settlement belongs to each sale item, not only to the sale.
- The system must allow:
  - Marking one item as settled
  - Selecting multiple items with checkboxes
  - Showing selected quantity
  - Showing selected total
  - Confirming a grouped settlement
  - Storing date
  - Storing optional note
  - Keeping a batch identifier
  - Reviewing settled batch history
- Group settlement must:
  - Validate items are sold
  - Validate items are pending
  - Validate related sales are not cancelled
  - Create settlement batch
  - Associate items
  - Calculate total
  - Mark them as settled
  - Register audit
- Entire operation must run inside a transaction.
- Multiple suppliers and supplier current accounts are out of MVP scope.

## Export to Excel
- Generate formal `.xlsx` monthly sales report.
- PDF export is not part of MVP.
- The user chooses a target month.
- Required sheets:
  - Summary
  - Sales
- The Summary sheet must show, for the selected month:
  - Total sales amount
  - Sales count
  - Total collected
  - Pending balance
  - Total payable to supplier
  - Total profit
  - Category summary with category, quantity sold, total sold, and profit
- The Sales sheet must show one historical sold-product row per sale item and include at least:
  - Date
  - Sale number
  - Product
  - Category
  - Customer
  - Product price
  - Personalization
  - Sale total
  - Payable to supplier
  - Profit
  - Liquidation status
- Product-related export rows must identify products using historical category, name, material, and variant snapshots.
- Historical export data must read only sale/sale-item/allocation/payment/consignment snapshots and persisted financial values.
- Historical export must never read current catalog or current customer data to represent past operations.
- Customer display rules for reports and exports:
  - If the sale still has no assigned customer snapshot, show `Walk-in sale`
  - If the approved payment-recovery flow later assigns a customer, show that assigned customer snapshot in historical export
- Formatting requirements:
  - Clear headers
  - Bold headers
  - Argentine currency formatting
  - Uniform date formatting
  - Readable widths
  - Subdued formatting only

## Backups
- MVP must later include:
  - Manual SQLite database backup
  - Destination selection
  - Date-time filename
  - Safe restore flow
  - Backup verification before replacing active database
  - Verification of SQLite validity, application ownership, and compatible schema version
  - Clear confirmation before replacement
  - Automatic copy of the current database before replacement
  - Application restart as part of restore
  - Automatic recovery of the previous copy if the restored database cannot be opened
  - Audit trail
  - No permanent services or always-on helper processes for restore

## Data Retention
- Products, customers, sales, sale items, payments, consignments, and audit records are kept indefinitely.
- There is no automatic deletion by age.
- Commercial data must not be deleted after six months.
- Commercial data may only be cancelled or reversed according to its business rules, not physically deleted because of age.
- Structured commercial data volume is expected to remain small enough for SQLite and does not justify losing history.
- Future cleanup of backups, Excel files, or logs is a separate policy and does not change commercial database retention.

## UX Rules
- Large buttons with text.
- Readable typography.
- One main action per screen.
- Important actions must not rely on icons alone.
- No right-click dependency.
- Essential actions must not be hidden in overflow menus.
- Always show Save, Cancel, or Back when appropriate.
- Use everyday language.
- Do not use CRUD, entity, snapshot, or transaction in UI.
- Do not delete commercial information in normal operation.
- Use Archive, Cancel, or Revert depending on the action.
- Show concrete confirmations.
- Show amounts with Argentine formatting.
- Warn before closing forms with unsaved changes.
- Keep navigation consistent.
- Prioritize clarity and reliability over visual polish.
- Avoid dashboards, animations, and unnecessary components.

## Home Screen Rules
- MVP Home is an operational screen, not an analytical dashboard.
- Home must help a low-technical user identify the next action quickly.
- Main actions on Home are limited to:
  - Register Stock
  - Register Sale
  - Register Payment
  - Settle Consignments
- Main actions must use large readable text buttons and must not rely on icons alone.
- Home indicators in MVP are limited to:
  - Count of active sales with pending balance
  - Total amount pending collection
  - Total amount pending supplier settlement
- Pending sales count includes only active sales whose balance is greater than zero.
- Pending collection amount is the sum of balances for non-cancelled sales.
- Pending supplier settlement amount is the sum of historical supplier cost for sold items that belong to active sales and are not yet settled.
- Cancelled sales, cancelled payments, and already settled items must be excluded from Home indicators.
- Each Home indicator should work as a shortcut to the corresponding operational screen when useful.
- Register Stock opens the stock intake form directly.
- Register Sale opens a new sale directly.
- Register Payment opens search for sales with pending balance.
- Settle Consignments opens the list of pending items.
- Payment search may use customer name, phone, or sale number.
- If no stock exists yet, Home must show a clear invitation to register the first product.
- Home must not show a complex empty dashboard or decorative zero-state metrics.
- Indicators refresh when entering or returning to Home.
- MVP Home does not include real-time updates, polling, or background processes.
- Failure to load one indicator must not block the main actions.
- Home must stay brief, readable, and avoid unnecessary vertical scrolling on a typical notebook resolution.
- Home must not include charts, decorative metrics, historical metrics, best-selling products, low stock, recent movements, latest operations tables, settings as a main action, backups as a main action, or shortcuts without immediate operational value.

## Invariants
- Monetary amounts must use integer cents only.
- Floating-point money is forbidden.
- Percentages must use an exact, consistent representation.
- Exact percentage representation is integer basis points.
- Historical sales must preserve their original cost, percentage, and used price.
- Stock availability must never become negative due to a confirmed sale.
- Computed sale states must always match totals from active payments unless the sale is cancelled.
- Cancelled sales must not accept new payments.
- Confirmed payments must remain historically immutable; corrections happen through cancellation plus replacement.
- Settled sale items must block automatic sale cancellation.
- Sales are not physically deleted in MVP.
- Every active sale with pending balance must have an associated customer with name and phone.

## Assumptions
- "Material" classification is entered manually and reused for matching and default margins.
- The default percentage for mate products and clothing is category-wide unless a stock intake override is entered.
- Personalization, when used, is a separate optional charge layered on top of the base product economics rather than a replacement for them.

## Pending Decisions
- None related to the approved MVP business rules.
