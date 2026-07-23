# Data Model

Proposed MVP data model derived strictly from the requirements.

## Confirmed Facts

- Percentages are stored as exact integer basis points.
- Basis point examples for approved defaults: `10000 = 100%`, `300 = 3%`, `1000 = 10%`.
- Sales use a visible sequential `sale_number` separate from the internal `id`.
- `sale_number` is commercial only; all technical references and relations use the internal `id`.
- `sale_number` is never reused.
- Cancelled sales keep their original `sale_number`; only status changes.
- MVP sales are not physically deleted.
- MVP products do not have a visible code or functional `productCode` field.
- Product relations use only internal `id` values.
- Product search and export identification use category, name, material, and variant.

## Entity Summary

| Entity | Purpose |
|--------|---------|
| ReusableProduct | Reusable catalog template |
| StockIntake | Concrete stock entry with cost, prices, and availability |
| Customer | Buyer reference |
| Sale | Commercial transaction header |
| SaleItem | Historical sold item record linked to a sale |
| Payment | Actual money received for a sale |
| ConsignmentBatch | Group settlement event |
| ConsignmentBatchItem | Join between settlement batch and sale items |
| SettingsMarginRule | Configurable default percentages |
| AuditLog | Sensitive operation history |

## Relationships

| From | Relation | To | Notes |
|------|----------|----|-------|
| ReusableProduct | 1 -> many | StockIntake | Same catalog template may have many entries over time |
| Customer | 1 -> many | Sale | Customer is mandatory for active sales with pending balance; fully paid walk-in sales may keep `customer_id = null` |
| Sale | 1 -> many | SaleItem | Sale contains one or more products |
| StockIntake | 1 -> many | SaleItem | Sale items must resolve against available stock |
| SaleItem | 1 -> many | SaleItemAllocation | One commercial line may consume stock from one or more intakes through FIFO allocation |
| StockIntake | 1 -> many | SaleItemAllocation | Allocation preserves the exact consumed intake history |
| Sale | 1 -> many | Payment | Payments happen after or during sale confirmation |
| SaleItem | 0..1 -> many through join | ConsignmentBatch | Each sale item may be settled once in MVP |
| ConsignmentBatch | 1 -> many | ConsignmentBatchItem | Grouped settlement linkage |

## Proposed Fields

### ReusableProduct
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| category | enum/text | Jewelry, Mate, Clothing |
| name | text | Required |
| description | text nullable | Optional |
| material | text | Required for jewelry and mate products; optional for clothing |
| variant | text | Variant, size, or measurement |
| created_at | datetime | Auditability support |
| updated_at | datetime | Auditability support |

No product-code field is included in MVP. No archived/deactivated product field is included in MVP either. If a real future need appears for internal codes, supplier-code mapping, or product archiving, it must be introduced later via an explicit migration rather than reserved now.

### StockIntake
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| reusable_product_id | fk | Required |
| entered_quantity | integer | Required, positive |
| available_quantity | integer | Required, non-negative |
| supplier_unit_cost_cents | integer | Required |
| personalization_amount_cents | integer nullable | Optional additional amount charged to the buyer; cents only |
| personalization_percentage_exact | integer basis points nullable | Optional personalization percentage; default rule is `5%` |
| personalization_expected_profit_cents | integer nullable | Calculated only from personalization amount and personalization percentage |
| cash_price_cents | integer | Required |
| list_price_cents | integer | Required |
| profit_percentage_exact | integer basis points | Exact representation (`10000 = 100%`) |
| expected_profit_cents | integer | Derived at save time or stored snapshot |
| intake_date | date/datetime | Required |
| notes | text nullable | Optional |
| created_at | datetime | Auditability support |

### Customer
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| name | text | Required |
| phone_text | text | Required text storage |
| note | text nullable | Optional |
| created_at | datetime | Auditability support |
| updated_at | datetime | Auditability support |

### Sale
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| sale_number | integer auto-increment | Visible commercial number `1, 2, 3...`; never reused |
| customer_id | fk nullable | Nullable only for fully paid walk-in sales; mandatory for active sales with pending balance |
| customer_name_snapshot | text nullable | Historical customer name used by sales/liquidations/export |
| customer_phone_snapshot | text nullable | Historical phone used by sales/liquidations/export |
| customer_note_snapshot | text nullable | Historical note used by sales detail when needed |
| sale_date | datetime | Required |
| total_cents | integer | Computed |
| paid_cents | integer | Computed |
| balance_cents | integer | Computed |
| status | enum | Pending, Partial payment, Paid, Cancelled |
| cancellation_reason | text nullable | Required only when cancelled |
| created_at | datetime | Auditability support |
| updated_at | datetime | Auditability support |

### SaleItem
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| sale_id | fk | Required |
| reusable_product_id | fk | Required commercial product reference |
| product_category_snapshot | text | Immutable historical category |
| product_name_snapshot | text | Immutable historical product name |
| product_material_snapshot | text | Immutable historical material |
| product_variant_snapshot | text | Immutable historical variant |
| quantity | integer | Positive |
| price_type | enum | Cash or List |
| unit_price_cents | integer | Historical used price |
| line_subtotal_cents | integer | Computed snapshot |
| consignment_status | enum | Pending settlement, Settled |
| created_at | datetime | Auditability support |

### SaleItemAllocation
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| sale_item_id | fk | Required |
| stock_intake_id | fk | Required exact consumed intake reference |
| consumed_quantity | integer | Positive |
| historical_supplier_unit_cost_cents | integer | Snapshot from the consumed intake |
| historical_profit_percentage_exact | integer basis points | Snapshot from the consumed intake |
| historical_cash_price_cents | integer | Snapshot from the consumed intake |
| historical_list_price_cents | integer | Snapshot from the consumed intake |
| historical_personalization_amount_cents | integer nullable | Snapshot when personalization applied |
| historical_personalization_percentage_exact | integer basis points nullable | Snapshot when personalization applied |
| historical_personalization_expected_profit_cents | integer nullable | Snapshot when personalization applied |
| allocation_order | integer | Persisted FIFO order used during confirmation |
| created_at | datetime | Auditability support |

### Payment
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| sale_id | fk | Required |
| payment_date | datetime | Required |
| amount_cents | integer | Must be > 0 |
| payment_method | enum/text nullable | Cash, Bank transfer, or null |
| note | text nullable | Optional |
| cancelled_at | datetime nullable | Null means active; set only by explicit cancellation |
| cancellation_reason | text nullable | Must be present when `cancelled_at` is set |
| created_at | datetime | Auditability support |

### ConsignmentBatch
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| batch_identifier | text | Required |
| settlement_date | datetime | Required |
| note | text nullable | Optional |
| total_cents | integer | Computed |
| created_at | datetime | Auditability support |

### ConsignmentBatchItem
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| consignment_batch_id | fk | Required |
| sale_item_id | fk | Required |
| settled_cost_cents | integer | Snapshot for reporting stability |

### SettingsMarginRule
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| scope_type | enum/text | Material-specific or category-wide |
| scope_value | text | Gold, Silver, Mate, Clothing, or Personalization |
| percentage_exact | integer basis points | Required exact representation (`10000 = 100%`) |
| active_from | datetime nullable | Optional if versioning is needed |
| created_at | datetime | Auditability support |

### AuditLog
| Field | Type intent | Notes |
|------|-------------|-------|
| id | identifier | Internal primary key |
| occurred_at | datetime | Required |
| operation_type | enum/text | Sensitive action category |
| entity_type | text | Sale, Payment, Batch, Backup, etc. |
| entity_id | text | Related record |
| summary | text | Human-readable summary |
| detail_json | structured text | Optional operation detail |

## Invariants
- `available_quantity >= 0`
- `entered_quantity > 0`
- `sale item quantity > 0`
- `payment amount > 0`
- `payment.cancelled_at is null` means the payment is active
- `payment.cancelled_at is not null` requires `payment.cancellation_reason` to be present
- `personalization_amount_cents` must use integer cents only when present
- `personalization_percentage_exact` must use integer basis points only when present
- Personalization, when present, is an additional buyer charge and must not replace base product percentage fields
- `total_cents = sum(sale item subtotals)`
- `paid_cents = sum(active payments)`
- `balance_cents = total_cents - paid_cents`
- `balance_cents >= 0` during MVP because overpayment is forbidden
- `sale.status = Cancelled` overrides computed payment status
- Non-cancelled sale status must match paid/balance totals
- Every active sale with `balance_cents > 0` must have non-null `customer_id`
- Every active sale with `balance_cents > 0` must reference a customer with non-empty `name` and `phone_text`
- A sale with `customer_id is null` must have `status = Paid` and `balance_cents = 0`
- Payment corrections happen by cancelling the original payment and creating a new payment; the original amount, date, method, and note do not change
- Sale item settlement status must be consistent with batch linkage
- Historical snapshot fields on sale items must never change after sale confirmation, except the sale-level customer snapshot update allowed by the approved payment-recovery assignment flow
- Historical allocation snapshot fields must never change after sale confirmation
- Historical sales, liquidations, and export views must read sale and sale-item snapshots instead of current `reusable_products` or `customers` rows
- `sum(consumed_quantity for sale item allocations) = sale item quantity`
- Allocation order must reflect FIFO by intake date ascending with deterministic tie-break by creation date or internal ID ascending

## Constraints and Notes
- Money fields must use integer cents.
- Floating-point persistence for money is forbidden.
- Percentage persistence must use exact integer basis points.
- Personalization amount persistence also uses integer cents.
- Personalization percentage persistence also uses exact integer basis points.
- Duplicate warnings are UX/business checks, not automatic uniqueness merges.
- Customer phone stays as text; normalization for suggestion/search is separate from stored value.
- `Walk-in sale` is a presentation label, not a persisted customer record.
- Reports and exports must show `Walk-in sale` and empty phone when `customer_id` is null.
- No editable payment status field is needed in MVP because active/cancelled state is derived from `cancelled_at`.
- Product-related reports and exports must identify products with category, name, material, and variant.
- Reusable products remain queryable in the catalog even when current availability is zero.
- Zero-stock product differentiation is a UI/presentation rule, not a persisted lifecycle state.
- MVP must not reserve schema structure for future product codes or supplier-code mapping.
- Personalization is not modeled as product category or material.
- Sale UI must not require or expose manual lot/intake selection.
- Real profit calculations must use the historical cost of the actually consumed allocations rather than average cost.
- Sale cancellation must restore stock by replaying saved sale item allocations back to their original stock intakes.
- Historical records are retained indefinitely; no age-based deletion policy applies to commercial entities.

## Assumptions
- Sale items stay at the commercial line level while sale item allocations preserve the intake-level stock and cost history required by FIFO.
- `consignment_status` can live directly on sale items even if batch linkage also exists, to simplify current-state queries.

## Pending Decisions
- None for the current approved model.
