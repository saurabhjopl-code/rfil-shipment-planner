/**
 * FC Wise Sale | DRR | Stock Cover Summary
 * Input: mpPlanningRows[]
 */

export function fcSaleSummary(mpRows) {
  const map = new Map();

  mpRows.forEach(r => {
    const fc = r.fc;

    if (!map.has(fc)) {
      map.set(fc, {
        sale: 0,
        stock: 0
      });
    }

    const entry = map.get(fc);
    entry.sale += Number(r.saleQty) || 0;
    entry.stock += Number(r.fcStock) || 0;
  });

  return Array.from(map.entries()).map(([fc, v]) => {
    const drr = v.sale / 30;
    const sc = drr > 0 ? v.stock / drr : 0;

    return {
      FC: fc,
      "Total Sale": v.sale,
      DRR: Number(drr.toFixed(2)),
      "Stock Cover": Number(sc.toFixed(1))
    };
  });
}
