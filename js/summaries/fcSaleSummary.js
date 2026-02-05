/**
 * FC Wise Sale | DRR | Stock Cover Summary
 *
 * RULES:
 * - Sale comes from mpPlanningRows
 * - Stock comes from fcStock (authoritative)
 * - SC = Total FC Stock / DRR
 *
 * Input:
 *  - mpPlanningRows[]
 *  - fcStock[]
 *  - mp (string)
 */

export function fcSaleSummary(mpPlanningRows, fcStock, mp) {
  const saleMap = new Map();

  /* Aggregate sale per FC from planning rows */
  mpPlanningRows.forEach(r => {
    const fc = r.fc;
    if (!saleMap.has(fc)) {
      saleMap.set(fc, 0);
    }
    saleMap.set(fc, saleMap.get(fc) + (Number(r.saleQty) || 0));
  });

  /* Aggregate stock per FC from fcStock */
  const stockMap = new Map();
  fcStock
    .filter(r => r.mp === mp)
    .forEach(r => {
      const fc = r.warehouseId;
      if (!stockMap.has(fc)) {
        stockMap.set(fc, 0);
      }
      stockMap.set(fc, stockMap.get(fc) + (Number(r.qty) || 0));
    });

  /* Build final summary */
  return Array.from(saleMap.entries()).map(([fc, totalSale]) => {
    const drr = totalSale / 30;
    const totalStock = stockMap.get(fc) || 0;
    const sc = drr > 0 ? totalStock / drr : 0;

    return {
      FC: fc,
      "Total Sale": totalSale,
      DRR: Number(drr.toFixed(2)),
      "Stock Cover": Number(sc.toFixed(2))
    };
  });
}
