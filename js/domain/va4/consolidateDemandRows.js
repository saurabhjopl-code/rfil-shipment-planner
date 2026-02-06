/**
 * VA4 — CONSOLIDATE DEMAND ROWS
 *
 * Groups raw demand rows into real planning units
 *
 * GROUP BY:
 * MP + FC + STYLE + SKU + UNIWARE SKU
 */

import { calculateDRR } from "../shared/metrics.js";

export function consolidateDemandRows(demandRows) {
  const map = new Map();

  demandRows.forEach(r => {
    const key = [
      r.mp,
      r.fc || "",
      r.style,
      r.sku,
      r.uniwareSku
    ].join("|");

    if (!map.has(key)) {
      map.set(key, {
        ...r,
        saleQty: 0,
        drr: 0,
        actualDemand: 0
      });
    }

    const row = map.get(key);
    row.saleQty += r.saleQty;
  });

  /* Recalculate DRR + Actual Demand */
  map.forEach(row => {
    const drr = calculateDRR(row.saleQty);
    let actual = 45 * drr;

    if (actual > 0 && actual < 1) actual = 1;

    row.drr = Number(drr.toFixed(4));
    row.actualDemand = Math.floor(actual);
  });

  return Array.from(map.values());
}
