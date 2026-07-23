# Transaction Rules

Critical transactional boundaries for MVP operations.

## Confirmed Facts

The following operations must execute atomically.

## Transaction 1 — Confirm Sale

### Inputs
- Selected products
- Quantities
- Price type per item
- Optional customer selection/creation before confirmation
- Optional initial payment

### Atomic steps
1. Validate each requested quantity against the total current available stock for the selected product.
2. Validate selected prices and initial payment amount.
3. Compute resulting total, paid, and balance for confirmation.
4. If resulting balance is greater than zero, require customer with name and phone.
5. If resulting balance is zero, allow `customer_id = null`.
6. Resolve stock allocations automatically using FIFO by intake date ascending.
7. If multiple intakes share the same intake date, apply deterministic tie-break by creation date or internal ID ascending.
8. Create sale header.
9. Create sale items.
10. Create sale item allocation records with historical snapshots for each consumed intake:
   - `stock_intake_id`
   - supplier cost
   - profit percentage
   - cash price
   - list price
   - personalization amount when applicable
   - personalization percentage when applicable
   - personalization expected profit when applicable
11. Decrease stock availability on the exact consumed intakes.
12. Create initial payment when provided.
13. Persist final total, paid, balance, and status.
14. Write audit log.
15. Commit.

### Rollback rule
- If any step fails, no sale, sale item, stock deduction, payment, or audit record from that transaction may remain partially applied.

## Transaction 2 — Register Payment

### Atomic steps
1. Validate sale is not cancelled.
2. Validate amount is greater than zero.
3. Validate amount does not exceed pending balance.
4. Validate that any resulting active sale with pending balance has an associated customer with name and phone.
5. Create payment.
6. Recompute paid amount, balance, and status.
7. Write audit when required by the operation type.
8. Commit.

### Rollback rule
- If recalculation fails, payment persistence must also roll back.

## Transaction 3 — Cancel Payment

### Preconditions
- Confirmation received.
- Reason provided.
- Related sale is not cancelled.
- If cancellation would leave pending balance, the sale must already have an associated customer with name and phone.

### Atomic steps
1. Validate payment exists and is active.
2. Validate related sale is not cancelled.
3. Compute whether cancellation would leave pending balance.
4. If cancellation would leave pending balance, require sale customer with name and phone before proceeding.
5. Mark payment as cancelled by setting cancellation date-time.
6. Store cancellation reason.
7. Preserve the original payment amount, date, method, and note unchanged.
8. Recompute paid amount, balance, and status using only active payments.
9. Write audit log including payment cancellation reason and timestamp.
10. Commit.

### Rollback rule
- If recalculation or audit persistence fails, payment cancellation must not persist.

## Transaction 4 — Cancel Sale

### Preconditions
- Confirmation received.
- Reason provided.
- No sale item in the sale is already settled with the supplier.

### Atomic steps
1. Validate sale is cancellable.
2. Mark sale as cancelled.
3. Restore exactly the deducted stock quantities to the original consumed stock intakes recorded by sale item allocations.
4. Prevent future payments by state enforcement.
5. Write audit log including reason.
6. Commit.

### Rollback rule
- If stock restitution fails, cancellation must not persist.

## Transaction 5 — Group Consignment Settlement

### Preconditions
- All selected items are sold.
- All selected items are pending settlement.
- Related sales are not cancelled.

### Atomic steps
1. Validate all selected sale items.
2. Create consignment batch.
3. Associate selected sale items with the batch.
4. Calculate settlement total.
5. Mark selected items as settled.
6. Write audit log.
7. Commit.

### Rollback rule
- If any selected item fails validation or update, no partial batch may remain.

## Transaction 6 — Safe Restore

### Confirmed requirement scope
- Restore starts only when the user explicitly requests it.
- Verify backup before replacing active database.
- Verification must confirm a valid SQLite database for this application and a compatible schema version.
- Do not overwrite without confirmation.
- Create an automatic copy of the current database before replacement.
- Close the SQLite connection before replacing the active file.
- Restart the application as part of the restore flow.
- If the restored database cannot be opened after restart, automatically recover the previous copy.
- Record audit.

### Required transactional intent
- Replacement must be all-or-nothing from the user's perspective.
- If verification fails, the active database must remain untouched.
- If replacement or reopen fails, the previous database copy must be restored automatically.
- The restore design must stay proportional to MVP scope: no permanent services, no resident background processes, and no always-on helper processes.
- Audit must reflect success or failed attempt according to approved implementation design.

## State Derivation Rules

| Aggregate | Rule |
|-----------|------|
| Sale total | Sum of sale item subtotals |
| Sale paid | Sum of active payments |
| Sale balance | Total minus paid |
| Sale status | Cancelled if cancelled; otherwise derived from paid vs total |
| Sale customer requirement | Customer required when active sale balance is greater than zero; optional only when balance is zero at confirmation |
| Sale stock allocation | Automatic FIFO by intake date ascending, with deterministic tie-break by creation date or internal ID ascending |
| Pending settlement total | Sum of unsettled sale item supplier costs |
| Settled batch total | Sum of included sale item supplier costs |
| Personalization economics | Optional personalization charge is calculated separately from base product economics and must not replace base percentage values |

## Concurrency and Integrity Concerns
- Sale confirmation must defend against stale availability between selection and commit.
- Sale confirmation must not expose manual lot selection; allocation happens only inside the transaction boundary.
- Cancellation must restore the exact quantities originally deducted to the original stock intakes.
- Consignment settlement must prevent the same sale item from being settled twice.
- Payment registration must prevent overpayment caused by stale balance reads.
- Payment cancellation must update payment state and sale aggregates in one transaction so no cancelled payment remains counted in totals.
- Customer requirement validation must live in the business layer and transaction boundary, not only in renderer/UI checks.

## Assumptions
- SQLite transactions are sufficient for single-computer MVP concurrency control.
- Audit writes are part of the same transaction for business-critical operations unless a later technical decision explicitly documents an exception.

## Pending Decisions
- Exact behavior for audited failed attempts versus successful operations.
