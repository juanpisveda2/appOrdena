import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  updateReusableProductRecord,
  deleteReusableProductRecord,
  getCatalogProductDetail,
  listCatalogProducts,
  searchReusableProducts
} from '../../../src/main/catalog/repository';
import { saveStockIntake } from '../../../src/main/catalog/saveStockIntake';
import { reusableProductsTable, stockIntakesTable } from '../../../src/main/db/schema';
import { listPendingConsignmentItems } from '../../../src/main/services/consignments/service';
import { confirmSaleDraft, getSaleDetail, listSalesHistory } from '../../../src/main/services/sales/service';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

function createInitializedAppForTest() {
  return createInitializedApp('project-mama-catalog-');
}

describe('saveStockIntake', () => {
  it('keeps zero-stock reusable products searchable when spacing differs', () => {
    const initialized = createInitializedAppForTest();

    saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 2,
      availableQuantity: 0,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 110_000,
      listPriceCents: 120_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    expect(searchReusableProducts(initialized.database, 'aros plata')).toEqual([
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 0,
        isOutOfStock: true
      }
    ]);

    expect(searchReusableProducts(initialized.database, 'arosdeplata')).toEqual([
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 0,
        isOutOfStock: true
      }
    ]);

    initialized.database.close();
  });

  it('returns a duplicate warning before creating a second matching reusable product', () => {
    const initialized = createInitializedAppForTest();

    saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 110_000,
      listPriceCents: 120_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    expect(
      saveStockIntake(initialized.database, {
        newReusableProduct: {
          category: 'jewelry',
          name: '  Árosdeplata ',
          material: 'plata',
          variant: '18mm'
        },
        enteredQuantity: 1,
        availableQuantity: 1,
        supplierUnitCostCents: 100_000,
        cashPriceCents: 110_000,
        listPriceCents: 120_000,
        profitPercentageBasisPoints: 1_000,
        intakeDate: '2026-07-14'
      })
    ).toEqual({
      kind: 'duplicate-warning',
      matches: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 1
        }
      ]
    });

    const products = initialized.database.orm.select().from(reusableProductsTable).all();

    expect(products).toHaveLength(1);

    initialized.database.close();
  });

  it('saves a non-duplicate reusable product without returning a warning', () => {
    const initialized = createInitializedAppForTest();

    saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 110_000,
      listPriceCents: 120_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    expect(
      saveStockIntake(initialized.database, {
        newReusableProduct: {
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Acero',
          variant: '18 mm'
        },
        enteredQuantity: 2,
        availableQuantity: 2,
        supplierUnitCostCents: 90_000,
        cashPriceCents: 105_000,
        listPriceCents: 115_000,
        profitPercentageBasisPoints: 1_000,
        intakeDate: '2026-07-15'
      })
    ).toEqual({
      kind: 'saved',
      stockIntakeId: 2,
      reusableProductId: 2
    });

    const products = initialized.database.orm.select().from(reusableProductsTable).all();

    expect(products).toHaveLength(2);

    initialized.database.close();
  });

  it('matches accent variants through persistence and catalog search', () => {
    const initialized = createInitializedAppForTest();

    saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Áros de plata',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 0,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 110_000,
      listPriceCents: 120_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    expect(searchReusableProducts(initialized.database, 'aros plata')).toEqual([
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Áros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 0,
        isOutOfStock: true
      }
    ]);

    expect(searchReusableProducts(initialized.database, 'áros pláta')).toEqual([
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Áros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 0,
        isOutOfStock: true
      }
    ]);

    initialized.database.close();
  });

  it('persists manual prices while leaving intake personalization empty in the new flow', () => {
    const initialized = createInitializedAppForTest();

    const result = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'mate',
        name: 'Mate grabado',
        material: 'Calabaza',
        variant: 'Premium'
      },
      enteredQuantity: 3,
      availableQuantity: 2,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 125_000,
      listPriceCents: 130_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14',
      notes: 'Keep handwritten price tags.'
    });

    expect(result).toEqual({
      kind: 'saved',
      stockIntakeId: 1,
      reusableProductId: 1
    });

    const intake = initialized.database.orm
      .select()
      .from(stockIntakesTable)
      .where(eq(stockIntakesTable.id, 1))
      .get();

    expect(intake).toMatchObject({
      enteredQuantity: 3,
      availableQuantity: 2,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 125_000,
      listPriceCents: 130_000,
      profitPercentageBasisPoints: 1_000,
      expectedProfitCents: 10_000,
      personalizationAmountCents: null,
      personalizationPercentageBasisPoints: null,
      personalizationExpectedProfitCents: null,
      intakeDate: '2026-07-14',
      notes: 'Keep handwritten price tags.'
    });

    initialized.database.close();
  });

  it('lists recent and general catalog products without requiring a search term', () => {
    const initialized = createInitializedAppForTest();

    saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    expect(listCatalogProducts(initialized.database, { category: 'all' })).toEqual({
      recentProducts: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 1,
          isOutOfStock: false,
          currentCashPriceCents: 120_000,
          currentListPriceCents: 125_000
        }
      ],
      products: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 1,
          isOutOfStock: false,
          currentCashPriceCents: 120_000,
          currentListPriceCents: 125_000
        }
      ]
    });

    initialized.database.close();
  });

  it('returns product detail with current prices, profit summary, and recent intakes', () => {
    const initialized = createInitializedAppForTest();

    saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Pulsera grabada',
        material: 'Plata',
        variant: 'Ajustable'
      },
      enteredQuantity: 2,
      availableQuantity: 2,
      supplierUnitCostCents: 80_000,
      cashPriceCents: 95_000,
      listPriceCents: 105_000,
      profitPercentageBasisPoints: 1_500,
      intakeDate: '2026-07-14',
      notes: 'Front engraving included.'
    });

    expect(getCatalogProductDetail(initialized.database, 1)).toEqual({
      reusableProductId: 1,
      category: 'jewelry',
      name: 'Pulsera grabada',
      description: null,
      material: 'Plata',
      variant: 'Ajustable',
      availableQuantity: 2,
      currentCashPriceCents: 95_000,
      currentListPriceCents: 105_000,
      currentProfitPercentageBasisPoints: 1_500,
      currentExpectedProfitCents: 12_000,
      currentPersonalizationExpectedProfitCents: null,
      currentTotalExpectedProfitCents: 12_000,
      recentIntakes: [
        {
          stockIntakeId: 1,
          enteredQuantity: 2,
          availableQuantity: 2,
          supplierUnitCostCents: 80_000,
          cashPriceCents: 95_000,
          listPriceCents: 105_000,
          profitPercentageBasisPoints: 1_500,
          expectedProfitCents: 12_000,
          personalizationAmountCents: null,
          personalizationPercentageBasisPoints: null,
          personalizationExpectedProfitCents: null,
          totalExpectedProfitCents: 12_000,
          intakeDate: '2026-07-14',
          notes: 'Front engraving included.'
        }
      ]
    });

    initialized.database.close();
  });

  it('keeps old intake personalization snapshots readable for historical catalog detail', () => {
    const initialized = createInitializedAppForTest();

    const result = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Pulsera grabada',
        material: 'Plata',
        variant: 'Ajustable'
      },
      enteredQuantity: 2,
      availableQuantity: 2,
      supplierUnitCostCents: 80_000,
      cashPriceCents: 95_000,
      listPriceCents: 105_000,
      profitPercentageBasisPoints: 1_500,
      intakeDate: '2026-07-14',
      notes: 'Front engraving included.'
    });

    expect(result).toEqual({
      kind: 'saved',
      stockIntakeId: 1,
      reusableProductId: 1
    });

    initialized.database.client
      .prepare(
        `
          UPDATE stock_intakes
          SET personalization_amount_cents = 8000,
              personalization_percentage_basis_points = 750,
              personalization_expected_profit_cents = 600
          WHERE id = 1
        `
      )
      .run();

    expect(getCatalogProductDetail(initialized.database, 1)).toEqual(
      expect.objectContaining({
        currentPersonalizationExpectedProfitCents: 600,
        currentTotalExpectedProfitCents: 12_600,
        recentIntakes: [
          expect.objectContaining({
            personalizationAmountCents: 8_000,
            personalizationPercentageBasisPoints: 750,
            personalizationExpectedProfitCents: 600,
            totalExpectedProfitCents: 12_600
          })
        ]
      })
    );

    initialized.database.close();
  });

  it('rejects deprecated personalization fields in the new stock intake flow', () => {
    const initialized = createInitializedAppForTest();

    expect(() =>
      saveStockIntake(initialized.database, {
        newReusableProduct: {
          category: 'mate',
          name: 'Mate legacy',
          material: 'Calabaza',
          variant: 'M'
        },
        enteredQuantity: 1,
        availableQuantity: 1,
        supplierUnitCostCents: 20_000,
        cashPriceCents: 25_000,
        listPriceCents: 28_000,
        profitPercentageBasisPoints: 1_000,
        personalizationAmountCents: 3_000,
        intakeDate: '2026-07-14'
      } as any)
    ).toThrowError();

    initialized.database.close();
  });

  it('removes a product only from the active catalog while preserving sales and consignment history', () => {
    const initialized = createInitializedAppForTest();

    const intake = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros borrables',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    if (intake.kind !== 'saved') {
      throw new Error('Expected seed intake to be saved.');
    }

    const sale = confirmSaleDraft(initialized.database, {
      draftItems: [{ reusableProductId: intake.reusableProductId, quantity: 1, priceType: 'cash' }],
      initialPayment: { amountCents: 120_000, paymentMethod: 'cash' },
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    deleteReusableProductRecord(initialized.database, intake.reusableProductId);

    expect(listCatalogProducts(initialized.database, { category: 'all' }).products).toEqual([]);
    expect(searchReusableProducts(initialized.database, 'aros borrables')).toEqual([]);
    expect(listSalesHistory(initialized.database, { limit: 10 })[0]).toEqual(
      expect.objectContaining({ saleId: sale.saleId, totalProfitCents: 10_000 })
    );
    expect(getSaleDetail(initialized.database, { saleId: sale.saleId })).toEqual(
      expect.objectContaining({ saleId: sale.saleId, totalProfitCents: 10_000 })
    );
    expect(listPendingConsignmentItems(initialized.database)).toEqual([
      expect.objectContaining({ saleItemId: sale.items[0]?.saleItemId, productName: 'Aros borrables', gainCents: 10_000 })
    ]);

    initialized.database.close();
  });

  it('allows deleting a product that still has stock available while removing it from the active catalog', () => {
    const initialized = createInitializedAppForTest();

    const intake = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros con stock',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 2,
      availableQuantity: 2,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    if (intake.kind !== 'saved') {
      throw new Error('Expected seed intake to be saved.');
    }

    expect(deleteReusableProductRecord(initialized.database, intake.reusableProductId)).toEqual({
      reusableProductId: intake.reusableProductId
    });
    expect(listCatalogProducts(initialized.database, { category: 'all' }).products).toEqual([]);
    expect(searchReusableProducts(initialized.database, 'aros con stock')).toEqual([]);
    expect(
      initialized.database.client
        .prepare('SELECT available_quantity AS availableQuantity FROM stock_intakes WHERE reusable_product_id = ?')
        .all(intake.reusableProductId)
    ).toEqual([expect.objectContaining({ availableQuantity: 2 })]);

    initialized.database.close();
  });

  it('blocks updating a deleted product', () => {
    const initialized = createInitializedAppForTest();

    const intake = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros archivados',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 0,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    if (intake.kind !== 'saved') {
      throw new Error('Expected seed intake to be saved.');
    }

    deleteReusableProductRecord(initialized.database, intake.reusableProductId);

    expect(() =>
      updateReusableProductRecord(initialized.database, intake.reusableProductId, {
        category: 'jewelry',
        name: 'Aros archivados editados',
        material: 'Plata',
        variant: '20 mm'
      })
    ).toThrow(`Reusable product ${intake.reusableProductId} was not found.`);

    initialized.database.close();
  });
});
