import { UNIWARE_ALLOCATION_PERCENT } from "../shared/constants.js";
import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER
 *
 * - Uses Uniware 40% pool
 * - Uses DW for FC allocation
 * - NO recall
 * - Output rows with shipmentQty > 0 only
 */

export function planSellerShipments({
  sellerSales,
  uniwareStock,
  companyRemarks,
  mpPlanningRows,
  fallbackFCsByMP
}) {
  /* -----------------------------
     Closed styles
  ----------------------------- */
  const closedStyles = new Set(
    companyRemarks
      .filter(r => r.remark === "Closed")
      .map(r => r.style)
  );

  /* -----------------------------
     Uniware pool
  ----------------------------- */
  const totalUniwareQty = uniwareStock.reduce(
    (sum, r) => sum + (Number(r.qty) || 0),
    0
  );

  let remainingUniware =
    totalUniwareQty * UNIWARE_ALLOCATION_PERCENT;

  /* -----------------------------
     Aggregate seller sales
     by Style + SKU
  ----------------------------- */
  const sellerMap = new Map();

  sellerSales.forEach(r => {
    const key = `${r.style}|${r.sku}|${r.uniwareSku}`;
    if (!sellerMap.has(key)) {
      sellerMap.set(key, {
        style: r.style,
        sku: r.sku,
        uniwareSku: r.uniwareSku,
        saleQty: 0
      });
    }
    sellerMap.get(key).saleQty += r.qty;
  });

  /* -----------------------------
     Build DW reference
     SKU + FC → finalDW
  ----------------------------- */
  const dwMap = new Map();
  mpPlanningRows.forEach(r => {
    const key = `${r.sku}|${r.fc}`;
    dwMap.set(key, r.finalDW || 0);
  });

  /* -----------------------------
     Build shipments
  ----------------------------- */
  const shipments = [];

  sellerMap.forEach(row => {
    if (closedStyles.has(row.style)) return;
    if (remainingUniware <= 0) return;

    const drr = calculateDRR(row.saleQty);
    const requiredQty = Math.floor(45 * drr);

    if (requiredQty <= 0) return;

    /* -----------------------------
       FC selection by DW
    ----------------------------- */
    let candidateFCs = [];

    mpPlanningRows
      .filter(r => r.sku === row.sku)
      .forEach(r => {
        candidateFCs.push({
          fc: r.fc,
          dw: r.finalDW || 0
        });
      });

    if (candidateFCs.length === 0) {
      /* Fallback FCs */
      candidateFCs = fallbackFCsByMP.flatMap(mp =>
        fallbackFCsByMP[mp].map(fc => ({ fc, dw: 0 }))
      );
    }

    candidateFCs.sort((a, b) => b.dw - a.dw);

    /* -----------------------------
       Allocate Uniware
    ----------------------------- */
    for (const fcEntry of candidateFCs) {
      if (remainingUniware <= 0) break;
      if (requiredQty <= 0) break;

      const alloc = Math.min(requiredQty, remainingUniware);
      if (alloc <= 0) continue;

      shipments.push({
        style: row.style,
        sku: row.sku,
        fc: fcEntry.fc,
        saleQty: row.saleQty,
        drr: Number(drr.toFixed(2)),
        fcStock: 0,
        stockCover: 0,
        shipmentQty: alloc,
        remarks: fcEntry.dw > 0 ? "DW Allocation" : "Fallback FC"
      });

      remainingUniware -= alloc;
      break; // one FC per SKU for seller
    }
  });

  return {
    rows: shipments,
    uniwareUsed:
      totalUniwareQty * UNIWARE_ALLOCATION_PERCENT - remainingUniware,
    remainingUniware
  };
}
