import { describe, expect, it } from 'vitest';
import { saveStockIntake } from '../../../src/main/catalog/saveStockIntake';
import {
  assignSaleCustomerForPaymentRecovery,
  cancelSale,
  cancelSalePayment,
  confirmSaleDraft,
  getSaleDetail,
  listSalesHistory,
  registerSalePayment
} from '../../../src/main/services/sales/service';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

function createInitializedAppForTest() {
  return createInitializedApp('project-mama-sales-');
}

function seedReusableProduct(
  initialized: ReturnType<typeof createInitializedAppForTest>,
  options: {
    name: string;
    enteredQuantity: number;
    availableQuantity: number;
    intakeDate: string;
    supplierUnitCostCents?: number;
    cashPriceCents?: number;
    listPriceCents?: number;
  }
) {
  const result = saveStockIntake(initialized.database, {
    newReusableProduct: {
      category: 'jewelry',
      name: options.name,
      material: 'Plata',
      variant: '18 mm'
    },
    enteredQuantity: options.enteredQuantity,
    availableQuantity: options.availableQuantity,
    supplierUnitCostCents: options.supplierUnitCostCents ?? 100_000,
    cashPriceCents: options.cashPriceCents ?? 120_000,
    listPriceCents: options.listPriceCents ?? 125_000,
    profitPercentageBasisPoints: 1_000,
    intakeDate: options.intakeDate
  });

  if (result.kind !== 'saved') {
    throw new Error('Expected stock intake seed to be saved.');
  }

  return result;
}

describe('sales service', () => {
  it('confirms a sale using FIFO allocations and stores allocation snapshots', () => {
    const initialized = createInitializedAppForTest();
    const first = seedReusableProduct(initialized, {
      name: 'Aros de plata FIFO',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-01',
      supplierUnitCostCents: 90_000,
      cashPriceCents: 110_000,
      listPriceCents: 120_000
    });

    saveStockIntake(initialized.database, {
      reusableProductId: first.reusableProductId,
      enteredQuantity: 2,
      availableQuantity: 2,
      supplierUnitCostCents: 95_000,
      cashPriceCents: 115_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-10'
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [
        {
          reusableProductId: first.reusableProductId,
          quantity: 2,
          priceType: 'cash'
        }
      ],
      initialPayment: {
        amountCents: 100_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    expect(sale.status).toBe('partial_payment');
    expect(sale.totalCents).toBe(230_000);
    expect(sale.paidCents).toBe(100_000);
    expect(sale.balanceCents).toBe(130_000);
    expect(sale.items[0].allocations).toEqual([
      expect.objectContaining({ stockIntakeId: 1, consumedQuantity: 1, allocationOrder: 1 }),
      expect.objectContaining({ stockIntakeId: 2, consumedQuantity: 1, allocationOrder: 2 })
    ]);

    initialized.database.close();
  });

  it('rejects confirming a pending sale without customer data', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Pulsera sin cliente',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });

    expect(() =>
      confirmSaleDraft(initialized.database, {
        draftItems: [
          {
            reusableProductId: product.reusableProductId,
            quantity: 1,
            priceType: 'cash'
          }
        ],
        initialPayment: {
          amountCents: 10_000,
          paymentMethod: 'cash'
        }
      })
    ).toThrow(/customer/i);

    initialized.database.close();
  });

  it('rejects confirming a sale when requested quantity exceeds available stock', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Stock insuficiente',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });

    expect(() =>
      confirmSaleDraft(initialized.database, {
        customer: {
          name: 'Ana',
          phoneText: '3510000000'
        },
        draftItems: [
          {
            reusableProductId: product.reusableProductId,
            quantity: 2,
            priceType: 'cash'
          }
        ]
      })
    ).toThrow(`Insufficient stock for reusable product ${product.reusableProductId}.`);

    const saleCount = initialized.database.client
      .prepare('SELECT COUNT(*) AS count FROM sales')
      .get() as { count: number };
    const remainingQuantity = initialized.database.client
      .prepare('SELECT available_quantity AS availableQuantity FROM stock_intakes WHERE id = 1')
      .get() as { availableQuantity: number };

    expect(saleCount.count).toBe(0);
    expect(remainingQuantity.availableQuantity).toBe(1);

    initialized.database.close();
  });

  it('registers a payment atomically and rejects overpayment', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Cadena pago',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });
    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Beto',
        phoneText: '3511111111'
      },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'list'
        }
      ],
      initialPayment: {
        amountCents: 25_000,
        paymentMethod: 'cash'
      }
    });

    const updated = registerSalePayment(initialized.database, {
      saleId: sale.saleId,
      amountCents: 100_000,
      paymentMethod: 'bank_transfer'
    });

    expect(updated.status).toBe('paid');
    expect(updated.balanceCents).toBe(0);
    expect(() =>
      registerSalePayment(initialized.database, {
        saleId: sale.saleId,
        amountCents: 1,
        paymentMethod: 'cash'
      })
    ).toThrow(/greater than the remaining balance/i);

    initialized.database.close();
  });

  it('normalizes persisted sale and payment timestamps to ISO datetimes', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Fechas normalizadas',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Norma',
        phoneText: '3517777777'
      },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      saleDate: ' 2026-07-31T23:30:00-03:00 '
    });

    const paidSale = registerSalePayment(initialized.database, {
      saleId: sale.saleId,
      amountCents: sale.balanceCents,
      paymentMethod: 'cash',
      paymentDate: '2026-08-01'
    });
    const reopenedSale = cancelSalePayment(initialized.database, {
      saleId: sale.saleId,
      paymentId: paidSale.payments.at(-1)?.paymentId ?? 0,
      reason: 'Correction',
      cancelledAt: '2026-08-02 03:04:05Z'
    });

    expect(sale.saleDate).toBe('2026-08-01T02:30:00.000Z');
    expect(paidSale.payments.at(-1)?.paymentDate).toBe('2026-08-01T00:00:00.000Z');
    expect(reopenedSale.payments.at(-1)?.cancelledAt).toBe('2026-08-02T03:04:05.000Z');

    initialized.database.close();
  });

  it('rejects malformed persisted sale and payment timestamps', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Fecha inválida',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });

    expect(() =>
      confirmSaleDraft(initialized.database, {
        customer: {
          name: 'Ana',
          phoneText: '3510000000'
        },
        draftItems: [
          {
            reusableProductId: product.reusableProductId,
            quantity: 1,
            priceType: 'cash'
          }
        ],
        saleDate: 'not-a-date'
      })
    ).toThrow(/valid date\/time string/i);

    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash'
        }
      ]
    });

    expect(() =>
      registerSalePayment(initialized.database, {
        saleId: sale.saleId,
        amountCents: sale.balanceCents,
        paymentMethod: 'cash',
        paymentDate: 'still-not-a-date'
      })
    ).toThrow(/valid date\/time string/i);
    expect(() =>
      cancelSale(initialized.database, {
        saleId: sale.saleId,
        reason: 'Bad timestamp',
        cancelledAt: 'nope'
      })
    ).toThrow(/valid date\/time string/i);

    initialized.database.close();
  });

  it('lists existing sales and reuses the detail snapshot by sale id', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Consulta de venta',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });
    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    expect(listSalesHistory(initialized.database, { query: 'Ana', limit: 10 })).toEqual([
      expect.objectContaining({
        saleId: sale.saleId,
        saleNumber: sale.saleNumber,
        customerName: 'Ana',
        customerPhoneText: '3510000000',
        totalProfitCents: 12_000
      })
    ]);

    expect(getSaleDetail(initialized.database, { saleId: sale.saleId })).toEqual(
      expect.objectContaining({ saleId: sale.saleId, saleNumber: sale.saleNumber, totalProfitCents: 12_000 })
    );

    initialized.database.close();
  });

  it('blocks payment cancellation that would leave a walk-in sale pending', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Venta mostrador',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });
    const sale = confirmSaleDraft(initialized.database, {
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      initialPayment: {
        amountCents: 120_000,
        paymentMethod: 'cash'
      }
    });

    expect(() =>
      cancelSalePayment(initialized.database, {
        saleId: sale.saleId,
        paymentId: sale.payments[0].paymentId,
        reason: 'Correction'
      })
    ).toThrow(/walk-in sale/i);

    initialized.database.close();
  });

  it('assigns a customer to a fully paid walk-in sale before reopening balance by payment cancellation', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Venta recuperación',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });
    const sale = confirmSaleDraft(initialized.database, {
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      initialPayment: {
        amountCents: 120_000,
        paymentMethod: 'cash'
      }
    });

    const assignedSale = assignSaleCustomerForPaymentRecovery(initialized.database, {
      saleId: sale.saleId,
      name: 'Elena',
      phoneText: '3514444444'
    });

    expect(assignedSale.customer.name).toBe('Elena');
    expect(assignedSale.customer.phoneText).toBe('3514444444');

    const reopenedSale = cancelSalePayment(initialized.database, {
      saleId: sale.saleId,
      paymentId: sale.payments[0].paymentId,
      reason: 'Correction'
    });

    expect(reopenedSale.status).toBe('pending_payment');
    expect(reopenedSale.balanceCents).toBe(120_000);
    expect(reopenedSale.customer.name).toBe('Elena');

    expect(() =>
      assignSaleCustomerForPaymentRecovery(initialized.database, {
        saleId: reopenedSale.saleId,
        name: 'Otra persona',
        phoneText: '3515555555'
      })
    ).toThrow(/already has a customer|limited to fully paid walk-in sales/i);

    initialized.database.close();
  });

  it('cancels a sale restoring stock and blocks cancellation for settled items', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Anillo cancelable',
      enteredQuantity: 3,
      availableQuantity: 3,
      intakeDate: '2026-07-14'
    });
    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Carla',
        phoneText: '3512222222'
      },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 2,
          priceType: 'cash'
        }
      ]
    });

    const cancelled = cancelSale(initialized.database, {
      saleId: sale.saleId,
      reason: 'Customer changed mind'
    });

    expect(cancelled.status).toBe('cancelled');
    const restoredQuantity = initialized.database.client
      .prepare('SELECT available_quantity AS availableQuantity FROM stock_intakes WHERE id = 1')
      .get() as { availableQuantity: number };
    expect(restoredQuantity.availableQuantity).toBe(3);

    const secondSale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Dani',
        phoneText: '3513333333'
      },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash'
        }
      ]
    });

    initialized.database.client
      .prepare("UPDATE sale_items SET consignment_status = 'settled' WHERE sale_id = ?")
      .run(secondSale.saleId);

    expect(() =>
      cancelSale(initialized.database, {
        saleId: secondSale.saleId,
        reason: 'Should fail'
      })
    ).toThrow(/settled items/i);

    initialized.database.close();
  });

  it('calculates the same historical total profit for sales history and detail', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Ganancia histórica',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14',
      supplierUnitCostCents: 90_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: { name: 'Luz', phoneText: '3519999999' },
      draftItems: [{ reusableProductId: product.reusableProductId, quantity: 1, priceType: 'cash' }],
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    const historySale = listSalesHistory(initialized.database, { query: 'Luz', limit: 10 })[0];
    const detailSale = getSaleDetail(initialized.database, { saleId: sale.saleId });

    expect(historySale?.totalProfitCents).toBe(12_000);
    expect(detailSale.totalProfitCents).toBe(12_000);

    initialized.database.close();
  });

  it('derives persisted gain snapshots from the actual FIFO allocations for mixed-intake sales', () => {
    const initialized = createInitializedAppForTest();
    const first = seedReusableProduct(initialized, {
      name: 'Ganancia mixta histórica',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-01',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 240_000,
      listPriceCents: 245_000
    });

    saveStockIntake(initialized.database, {
      reusableProductId: first.reusableProductId,
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 200_000,
      cashPriceCents: 260_000,
      listPriceCents: 265_000,
      profitPercentageBasisPoints: 2_500,
      intakeDate: '2026-07-10'
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: { name: 'Luz', phoneText: '3519999999' },
      draftItems: [
        {
          reusableProductId: first.reusableProductId,
          quantity: 2,
          priceType: 'cash',
          personalizationAmountCents: 10_000,
          personalizationPercentageBasisPoints: 500
        }
      ],
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    initialized.database.client
      .prepare(
        `
          UPDATE stock_intakes
          SET expected_profit_cents = 1,
              personalization_expected_profit_cents = 1,
              profit_percentage_basis_points = 1
          WHERE reusable_product_id = ?
        `
      )
      .run(first.reusableProductId);

    const persistedRow = initialized.database.client
      .prepare(
        `
          SELECT
            product_gain_cents AS productGainCents,
            personalization_gain_cents AS personalizationGainCents,
            total_gain_cents AS totalGainCents
          FROM sale_items
          WHERE id = ?
        `
      )
      .get(sale.items[0]!.saleItemId) as {
      productGainCents: number;
      personalizationGainCents: number;
      totalGainCents: number;
    };
    const historySale = listSalesHistory(initialized.database, { query: 'Luz', limit: 10 })[0];
    const detailSale = getSaleDetail(initialized.database, { saleId: sale.saleId });

    expect(persistedRow).toEqual({
      productGainCents: 89_000,
      personalizationGainCents: 1_000,
      totalGainCents: 90_000
    });
    expect(historySale?.totalProfitCents).toBe(90_000);
    expect(detailSale.totalProfitCents).toBe(90_000);
    expect(detailSale.items[0]).toEqual(
      expect.objectContaining({
        productGainCents: 89_000,
        personalizationGainCents: 1_000,
        totalGainCents: 90_000
      })
    );

    initialized.database.close();
  });

  it('falls back to historical allocation gains for legacy sale rows without v8 snapshots', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Venta legacy',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14',
      supplierUnitCostCents: 90_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: { name: 'Legacy', phoneText: '3511234567' },
      draftItems: [
        {
          reusableProductId: product.reusableProductId,
          quantity: 1,
          priceType: 'cash',
          personalizationAmountCents: 20_000,
          personalizationPercentageBasisPoints: 500
        }
      ],
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    initialized.database.client
      .prepare(
        `
          UPDATE sale_items
          SET unit_base_price_cents = NULL,
              unit_personalization_amount_cents = NULL,
              personalization_percentage_basis_points = NULL,
              line_base_subtotal_cents = NULL,
              line_personalization_subtotal_cents = NULL,
              product_gain_cents = NULL,
              personalization_gain_cents = NULL,
              total_gain_cents = NULL
          WHERE id = ?
        `
      )
      .run(sale.items[0]!.saleItemId);

    const historySale = listSalesHistory(initialized.database, { query: 'Legacy', limit: 10 })[0];
    const detailSale = getSaleDetail(initialized.database, { saleId: sale.saleId });

    expect(historySale?.totalProfitCents).toBe(10_000);
    expect(detailSale.items[0]).toEqual(
      expect.objectContaining({
        productGainCents: 9_000,
        personalizationGainCents: 1_000,
        totalGainCents: 10_000
      })
    );

    initialized.database.close();
  });

  it('keeps sales history and detail on immutable snapshots after product and customer edits', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Aros snapshot venta',
      enteredQuantity: 1,
      availableQuantity: 1,
      intakeDate: '2026-07-14'
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [{ reusableProductId: product.reusableProductId, quantity: 1, priceType: 'cash' }],
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    initialized.database.client
      .prepare(
        `
          UPDATE reusable_products
          SET category = 'mate', name = 'Producto editado', material = 'Acero', variant = 'Otro'
          WHERE id = ?
        `
      )
      .run(product.reusableProductId);
    initialized.database.client
      .prepare("UPDATE customers SET name = 'Ana editada', phone_text = '0000000000' WHERE id = 1")
      .run();

    const historySale = listSalesHistory(initialized.database, { query: 'Ana', limit: 10 })[0];
    const detailSale = getSaleDetail(initialized.database, { saleId: sale.saleId });

    expect(historySale).toEqual(
      expect.objectContaining({
        customerName: 'Ana',
        customerPhoneText: '3510000000'
      })
    );
    expect(detailSale.customer).toEqual(
      expect.objectContaining({
        name: 'Ana',
        phoneText: '3510000000'
      })
    );
    expect(detailSale.items[0]).toEqual(
      expect.objectContaining({
        productCategory: 'jewelry',
        productName: 'Aros snapshot venta',
        productMaterial: 'Plata',
        productVariant: '18 mm'
      })
    );

    initialized.database.close();
  });

  it('blocks confirming a sale for a deleted product', () => {
    const initialized = createInitializedAppForTest();
    const product = seedReusableProduct(initialized, {
      name: 'Producto eliminado para venta',
      enteredQuantity: 1,
      availableQuantity: 0,
      intakeDate: '2026-07-14'
    });

    initialized.database.client
      .prepare("UPDATE reusable_products SET deleted_at = '2026-07-16T10:00:00.000Z' WHERE id = ?")
      .run(product.reusableProductId);

    expect(() =>
      confirmSaleDraft(initialized.database, {
        customer: {
          name: 'Ana',
          phoneText: '3510000000'
        },
        draftItems: [
          {
            reusableProductId: product.reusableProductId,
            quantity: 1,
            priceType: 'cash'
          }
        ]
      })
    ).toThrow(`Reusable product ${product.reusableProductId} was not found.`);

    initialized.database.close();
  });

  it('rejects clothing personalization even if a forged request bypasses the UI', () => {
    const initialized = createInitializedAppForTest();
    const saved = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'clothing',
        name: 'Remera forjada',
        material: '',
        variant: 'M'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 50_000,
      cashPriceCents: 70_000,
      listPriceCents: 75_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    if (saved.kind !== 'saved') {
      throw new Error('Expected clothing stock intake seed to be saved.');
    }

    expect(() =>
      confirmSaleDraft(initialized.database, {
        draftItems: [
          {
            reusableProductId: saved.reusableProductId,
            quantity: 1,
            priceType: 'cash',
            personalizationAmountCents: 5_000,
            personalizationPercentageBasisPoints: 500
          }
        ],
        initialPayment: {
          amountCents: 75_000,
          paymentMethod: 'cash'
        }
      })
    ).toThrow(/Personalization is not allowed for clothing products/i);

    initialized.database.close();
  });
});
