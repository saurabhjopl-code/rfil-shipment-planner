/**
 * VA4 — FC DISTRIBUTION
 *
 * INPUT:
 * - allocatedRows   (output of Phase B)
 * - fallbackFCsByMP (existing config)
 *
 * OUTPUT:
 * - finalRows (MP + FC level rows)
 *
 * RULES:
 * - MP rows: shipment already FC-scoped → pass through
 * - SELLER rows:
 *     - If FC DW exists → use highest DW FC
 *     - Else → fallback FC list
 *
 * ❌ No allocation math
 * ❌ No recall
 * ❌ No stock cover
 */

export function distributeToFC({
  allocatedRows,
  fallbackFCsByMP
}) {
  const finalRows = [];

  /* -----------------------------
     Pre-build FC DW lookup (MP only)
  ----------------------------- */
  const fcDwBySkuMp = new Map();

  allocatedRows
    .filter(r => r.mp !== "SELLER" && r.fc)
    .forEach(r => {
      const key = `${r.mp}|${r.sku}|${r.fc}`;
      fcDwBySkuMp.set(key, r.fcDW || 0);
    });

  /* -----------------------------
     Process rows
  ----------------------------- */
  allocatedRows.forEach(r => {
    /* MP rows already FC-specific */
    if (r.mp !== "SELLER") {
      finalRows.push({
        ...r,
        action: r.shipmentQty > 0 ? "SHIP" : "NONE"
      });
      return;
    }

    /* -----------------------------
       SELLER → choose FC
    ----------------------------- */
    let selectedFC = null;

    /* Try DW-based FC first */
    let bestDW = -1;
    fcDwBySkuMp.forEach((dw, key) => {
      const [mp, sku, fc] = key.split("|");
      if (sku === r.sku && dw > bestDW) {
        bestDW = dw;
        selectedFC = fc;
      }
    });

    /* Fallback FCs */
    if (!selectedFC) {
      const lists = Object.values(fallbackFCsByMP);
      for (const list of lists) {
        if (list.length > 0) {
          selectedFC = list[0];
          break;
        }
      }
    }

    finalRows.push({
      ...r,
      fc: selectedFC,
      action: r.shipmentQty > 0 ? "SHIP" : "NONE"
    });
  });

  return finalRows;
}
