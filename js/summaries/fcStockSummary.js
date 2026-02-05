/**
 * FC Wise Stock Summary
 * Input: mpPlanningRows[]
 * Output: [{ FC, "Total Stock" }]
 */

export function fcStockSummary(mpRows) {
  const map = new Map();

  mpRows.forEach(r => {
    const fc = r.fc;
    const qty = Number(r.fcStock) || 0;

    if (!map.has(fc)) {
      map.set(fc, 0);
    }
    map.set(fc, map.get(fc) + qty);
  });

  return Array.from(map.entries()).map(([fc, totalStock]) => ({
    FC: fc,
    "Total Stock": totalStock
  }));
}
