/**
 * FC Wise Sale | DRR | Stock Cover Summary
 *
 * RULES:
 * - Sale → from mpPlanningRows
 * - Stock → from fcStock (authoritative)
 * - DRR = Total Sale / 30
 * - Stock Cover = Total Stock / DRR
 *
 * IMPORTANT:
 * - "Total Stock" MUST be present in rows
 *   even if UI does not show it
 */

export function fcSaleSummary(mpPlanningRows, fcStock, mp) {
  const saleMap = new Map();

  /* Aggregate sale per FC */
  mpPlanningRows.forEach(r => {
    const fc = r.fc;
    if (!saleMap.has(fc)) {
      saleMap.set(fc, 0);
    }
    saleMap.set(fc, saleMap.get(fc) + (Number(r.saleQty) || 0));
  });

  /* Aggregate stock per FC */
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

  /* Build summary rows */
  return Array.from(saleMap.entries()).map(([fc, totalSale]) => {
    const totalStock = stockMap.get(fc) || 0;
    const drr = totalSale / 30;
    const sc = drr > 0 ? totalStock / drr : 0;

    return {
      FC: fc,
      "Total Sale": totalSale,
      "Total Stock": totalStock,     // 🔒 REQUIRED
      DRR: Number(drr.toFixed(2)),
      "Stock Cover": Number(sc.toFixed(2))
    };
  });
}
