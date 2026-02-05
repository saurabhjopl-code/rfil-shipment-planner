import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER
 *
 * SELLER ONLY
 * - Uses Uniware 40% cap
 * - Uses DW for FC choice
 * - No recall
 * - No MP impact
 */

/**
 * @param {Object} input
 * @param {Array}  input.sellerSales
 * @param {Array}  input.uniwareStock
 * @param {Array}  input.companyRemarks
 * @param {Array}  input.mpPlanningRows   // for DW reference
 * @param {Object} input.fallbackFCsByMP
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
     Uniware pool (40%)
  ----------------------------- */
  const totalUniware = uniwareStock.reduce(
    (sum, r) => sum + (Number(r.qty) || 0),
    0
  );

  let remainingUniware = Math.floor(totalUniware * 0.4);

  /* -----------------------------
     Aggregate seller sale
     Style + SKU + Uniware SKU
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
     DW reference
     SKU + FC → finalDW
  ----------------------------- */
  const dwMap = new Map();
  mpPlanningRows.forEach(r => {
    dwMap.set(`${r.sku}|${r.fc}`, r.finalDW || 0);
  });

  /* -----------------------------
     Build shipments
  ----------------------------- */
  const rows = [];

  sellerMap.forEach(row => {
    if (closedStyles.has(row.style)) return;
    if (remainingUniware <= 0) return;

    const drr = calculateDRR(row.saleQty);
    const requiredQty = Math.floor(45 * drr);

    if (requiredQty <= 0) return;

    /* -----------------------------
       Candidate FCs via DW
    ----------------------------- */
    let candidates = [];

    mpPlanningRows
      .filter(r => r.sku === row.sku)
      .forEach(r => {
        candidates.push({
          fc: r.fc,
          dw: r.finalDW || 0
        });
      });

    /* -----------------------------
       Fallback FCs
    ----------------------------- */
    if (candidates.length === 0) {
      Object.values(fallbackFCsByMP).forEach(fcList => {
        fcList.forEach(fc => {
          candidates.push({ fc, dw: 0 });
        });
      });
    }

    /* Sort by DW desc */
    candidates.sort((a, b) => b.dw - a.dw);

    /* -----------------------------
       Allocate Uniware
    ----------------------------- */
    for (const c of candidates) {
      if (remainingUniware <= 0) break;

      const alloc = Math.min(requiredQty, remainingUniware);
      if (alloc <= 0) continue;

      rows.push({
        style: row.style,
        sku: row.sku,
        fc: c.fc,
        saleQty: row.saleQty,
        drr: Number(drr.toFixed(2)),
        fcStock: 0,
        stockCover: 0,
        shipmentQty: alloc,
        remarks: c.dw > 0 ? "DW Allocation" : "Fallback FC"
      });

      remainingUniware -= alloc;
      break; // one FC per SKU for seller
    }
  });

  return {
    rows,
    uniwareUsed: totalUniware * 0.4 - remainingUniware,
    remainingUniware
  };
}
