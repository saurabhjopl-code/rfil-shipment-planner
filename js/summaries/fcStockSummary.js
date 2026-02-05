/**
 * FC Wise Stock Summary
 *
 * IMPORTANT:
 * - Must be derived from fcStock
 * - NOT from mp planning rows
 *
 * Input:
 *  - fcStock[] (normalized)
 *  - mp (string)
 *
 * Output:
 *  [{ FC, "Total Stock" }]
 */

export function fcStockSummary(fcStock, mp) {
  const map = new Map();

  fcStock
    .filter(r => r.mp === mp)
    .forEach(r => {
      const fc = r.warehouseId;
      const qty = Number(r.qty) || 0;

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
