# User Flows

This document describes MVP user flows, states, transitions, and edge cases using only confirmed requirements.

## Confirmed Facts

## Flow 0 — Home

### Goal
- Help a low-technical user identify the next operational action quickly.
- Keep Home action-oriented instead of analytical.

### Happy path
1. User opens **Home**.
2. System shows four large readable text buttons: **Register Stock**, **Register Sale**, **Register Payment**, and **Settle Consignments**.
3. System loads the current operational indicators without blocking the main actions.
4. User chooses a direct action or a useful indicator shortcut.
5. If the user selects **Register Stock**, system opens the stock intake form directly.
6. If the user selects **Register Sale**, system opens a new sale directly.
7. If the user selects **Register Payment**, system opens search for sales with pending balance.
8. If the user selects **Settle Consignments**, system opens the list of pending items.
9. If the user enters payment search, system allows search by customer name, phone, or sale number.
10. When the user enters or returns to **Home**, system refreshes the indicators.

### Indicators
- Active sales with pending balance count
- Total amount pending collection
- Total amount pending supplier settlement
- Each indicator acts as a shortcut only when it helps the user reach the related operational screen faster.

### Initial state
- If no stock exists yet, system shows a clear invitation to register the first product.
- System does not show a complex empty dashboard or decorative zero-state metrics.

### Edge cases
- One indicator fails to load while the others load correctly
- No stock exists yet
- No active sales with pending balance
- No pending supplier settlement

### Explicitly excluded on Home in MVP
- Charts
- Profit by period
- Monthly comparisons
- Best-selling products
- Low stock
- Latest operations tables
- Recent movements
- Historical metrics
- Settings as a main action
- Backups as a main action
- Shortcuts or components without immediate operational value

## Flow 1 — Register Reusable Product and Stock Intake

### Happy path
1. User opens **Register Stock**.
2. User starts typing a product name.
3. System searches existing reusable products by name, category, material, and variant.
4. System ignores case, accents, extra spacing, and matches from the first typed character.
5. User either selects an existing reusable product or proceeds to create a new one.
6. If the new entry looks like a duplicate, system warns before continuing.
7. For jewelry, user chooses `Plata`, `Oro`, or `Otro` instead of typing free material directly.
8. If jewelry material is `Otro`, system requires a manual material value.
9. For mate products, material remains manual.
10. For clothing, material is optional and empty is valid.
11. User enters stock intake data.
12. System suggests `10%` gain for silver jewelry, `3%` for gold jewelry, and `10%` for other jewelry materials, while keeping the percentage editable.
13. System shows supplier cost, configured percentage, gain, cash price, and list price.
14. Cash price is prefilled from supplier cost for new forms, remains editable, and stops auto-syncing after manual change.
15. User saves.
16. System persists the stock intake and updates availability.

### States
- Reusable product: no explicit MVP lifecycle state
- Stock intake: no explicit business lifecycle beyond persisted historical record

### Edge cases
- Jewelry with quantity greater than `1`
- Duplicate-like reusable product not auto-merged
- Existing reusable product found with zero available stock
- Optional stock intake percentage override different from Settings default

## Flow 2 — Register Customer

### Happy path
1. User enters customer name or phone while creating or updating a customer reference.
2. System suggests existing customers.
3. User selects an existing customer or creates a new one.
4. If the new customer looks duplicated, system warns before saving.
5. System stores phone as text.

### Edge cases
- Same customer name with different phone
- Same phone formatted differently but still text-based
- User proceeds after duplicate warning

## Flow 3 — Create Sale

### Happy path
1. User opens **New Sale**.
2. User searches an available product.
3. User selects a unit or quantity.
4. If the product is jewelry or a mate product, user may optionally enter a personalization amount for that sale line.
5. If personalization is used, system treats the entered amount as the additional amount charged to the buyer and keeps the base product percentage unchanged.
6. If the product is clothing, system rejects personalization in MVP even if a forged request bypasses the UI.
7. User chooses cash price or list price.
8. System does not allow manual sale-price editing; user only selects one of the stored price types.
9. User adds the item under **Products in this sale**.
10. User optionally adds more products.
11. User may remove products from the draft sale before confirmation.
12. User optionally selects or registers a customer before confirmation.
13. User optionally records an initial payment.
14. System shows a clear confirmation summary in the same flow or in a dedicated confirmation step.
15. Summary shows products, quantity, price type, subtotal per product, total, initial payment, balance, buyer, and sale-time personalization when applicable.
16. System evaluates whether the sale will be fully paid or will keep pending balance.
17. If balance will remain greater than zero, system requires a customer with name and phone before confirmation.
18. If the sale will be fully paid at confirmation time, system allows confirmation without customer.
19. User confirms the sale.
20. System validates total available stock, category personalization rules, and customer rules in the business layer.
21. System automatically allocates stock using FIFO by intake date ascending.
22. If multiple intakes share the same intake date, system resolves them deterministically by creation date or internal ID ascending.
23. System creates sale and sale items.
24. System stores historical snapshots of cost, percentage, used price, and the applied sale-time personalization values for each consumed allocation when applicable.
25. System discounts stock from the exact consumed intakes.
26. System records initial payment if provided.
27. System calculates total, paid, balance, and status.
28. System writes audit log.
29. If the sale is fully paid and has no customer, system shows it as **Walk-in sale** while keeping `customerId = null`.

### Sale state transitions

| From | Trigger | To |
|------|---------|----|
| Draft UI state | Confirm sale with no payment | Pending |
| Draft UI state | Confirm sale with partial payment | Partial payment |
| Draft UI state | Confirm sale with full payment | Paid |

### Edge cases
- Requested quantity exceeds available stock
- Selected product becomes unavailable before confirmation
- Sale with multiple items from different stock intakes
- One sale line must consume quantity from multiple stock intakes through FIFO allocation
- Initial payment greater than total
- Zero or negative initial payment
- Sale confirmed as fully paid without customer
- Attempt to confirm a sale with pending balance and no customer
- Attempt to confirm a sale with pending balance and incomplete customer data
- Attempt to manually edit sale price instead of choosing cash or list price

## Flow 4 — Register Payment

### Happy path
1. User opens **Sales** or **Pending Payments**.
2. User selects an existing sale.
3. User enters payment amount.
4. User optionally enters payment method and note.
5. User confirms.
6. System validates business rules.
7. If the resulting balance will remain greater than zero, system ensures the sale has an associated customer with name and phone.
8. System stores the payment.
9. System recalculates paid amount, balance, and sale status in one transaction.
10. System records audit where correction or cancellation applies.

### Sale state transitions

| From | Trigger | To |
|------|---------|----|
| Pending | Payment amount less than total | Partial payment |
| Pending | Payment amount equals total | Paid |
| Partial payment | Additional payment still below total | Partial payment |
| Partial payment | Additional payment reaches total | Paid |

### Edge cases
- Payment amount equal to zero
- Payment amount below zero
- Payment amount above pending balance
- Payment on cancelled sale
- Optional payment method left blank
- Attempt to register payment against a pending-balance sale missing required customer data

## Flow 4A — Assign Customer to a Fully Paid Walk-in Sale

### Happy path
1. User opens a fully paid sale currently shown as **Walk-in sale**.
2. User chooses an action to assign a customer.
3. User selects an existing customer or creates a new one with name and phone.
4. System associates the customer to the sale without changing totals or payment history.
5. System records audit.

### Purpose
- This controlled exception exists so a future payment cancellation can be allowed without leaving a pending-balance sale without customer.
- This is not general sale editing.

## Flow 4B — Cancel Payment

### Happy path
1. User opens an existing sale.
2. User chooses to cancel an active payment.
3. System asks for confirmation and requires a cancellation reason.
4. System evaluates whether cancelling that payment would leave pending balance.
5. If pending balance would remain, system requires the sale to already have a customer with name and phone.
6. System cancels the payment.
7. System recalculates paid amount, balance, and status in one transaction.
8. System records audit.

### Edge cases
- Attempt to cancel a payment on a sale already cancelled
- Attempt to cancel a payment without reason
- Attempt to cancel a payment that would create pending balance on a walk-in sale without first assigning customer

## Flow 5 — Cancel Sale

### Happy path
1. User opens a sale.
2. User chooses cancel action.
3. System asks for confirmation.
4. System requires a reason.
5. System validates cancellation preconditions.
6. System marks the sale as cancelled.
7. System restores exactly the deducted stock.
8. System blocks future payments.
9. System records audit.

### Sale state transitions

| From | Trigger | To |
|------|---------|----|
| Pending | Valid cancellation | Cancelled |
| Partial payment | Valid cancellation | Cancelled |
| Paid | Valid cancellation | Cancelled |

### Edge cases
- Sale item already settled with supplier
- Missing cancellation reason
- Concurrent stock state changes before cancellation commit

## Flow 6 — Settle Liquidation Items

### Happy path
1. User opens **Liquidations**.
2. System lists sold items with pending settlement.
3. User selects one or more items with checkboxes.
4. System shows selected quantity, total to supplier, and total gain.
5. User confirms grouped settlement.
6. User enters date and optional note.
7. System validates each selected item.
8. System creates settlement batch with identifier.
9. System links selected sale items.
10. System calculates total to supplier and total gain from immutable historical sale and allocation snapshots.
11. System marks selected items as settled.
12. System records audit.

### Settlement state transitions

| From | Trigger | To |
|------|---------|----|
| Pending settlement | Successful settlement batch | Settled |

### Edge cases
- Item belongs to cancelled sale
- Item already settled
- Selected set changes before confirmation

## Flow 7 — Export Excel

### Happy path
1. User opens **Export and Backup**.
2. User triggers Excel export when needed.
3. System generates the approved MVP export as `.xlsx` only.
4. System presents the approved operational sheets.
5. System shows current stock as of generation time.
6. System shows pending consignments as of generation time.
7. System includes visible dates and month context so the user can interpret sales, payments, and settlements.
8. Settled consignments appear as operational report information and are not tied to a strict month-end control.
9. Export visibly shows the generation date and time.
10. If a sale has `customerId = null`, export shows `Walk-in sale` and empty phone.
11. Export does not create or infer a fake customer record.
12. User receives a readable formal operational report.
13. PDF export is not available in MVP.

### Edge cases
- Export path selection behavior is still a technical design detail
- Report is generated mid-month or on any other day without requiring a month-close process
- Export contains records from different dates that must remain understandable through visible date context
- Pending consignments shown at generation time differ from earlier operational activity
- Very large history volume is not scoped by current requirements

## Flow 8 — Backup and Restore

### Backup happy path
1. User opens **Export and Backup**.
2. User chooses manual backup.
3. User selects destination.
4. System creates a date-time-named SQLite copy.
5. System records audit.

### Restore happy path
1. User chooses restore.
2. User selects a backup file.
3. System verifies that the file is a valid SQLite database belonging to this application and using a compatible schema version.
4. System shows a clear confirmation before replacing the active database.
5. System creates an automatic copy of the current database.
6. System closes the SQLite connection.
7. System replaces the active database.
8. System restarts the application as part of the restore flow.
9. System checks that the restored database can be opened.
10. If opening fails, system automatically recovers the previous copy.
11. System records audit.

### Edge cases
- Invalid or corrupted backup file
- Attempt to overwrite active database without confirmation
- Incompatible schema version
- Restored database fails to open after restart and requires automatic rollback
- Restore is available only when explicitly requested by the user

## Assumptions
- "Draft UI state" exists only inside the interface and is not a persisted business state.
- Product search during sale creation may show zero-stock products, but they must be visually differentiated from currently available options.

## Pending Decisions
- Whether customer creation during sale happens inline or in a dedicated modal/screen.
- Whether payment registration is available from both Sales and Pending Payments or one screen links to the other.
