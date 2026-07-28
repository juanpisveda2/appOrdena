export const profitRuleByPriceBaseMigration = {
  version: 10,
  name: 'v010_profit_rule_by_price_base',
  sql: `
    ALTER TABLE stock_intakes
      ADD COLUMN expected_list_profit_cents INTEGER NOT NULL DEFAULT 0;

    UPDATE stock_intakes
    SET expected_profit_cents = CAST(ROUND(
          cash_price_cents * profit_percentage_basis_points / 10000.0
        ) AS INTEGER),
        expected_list_profit_cents = CAST(ROUND(
          list_price_cents * profit_percentage_basis_points / 10000.0
        ) AS INTEGER);
  `
} as const;
