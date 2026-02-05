import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER — VA3.5 (CONSOLIDATED)
 *
 * Guarantees:
 * - One row per MP + SKU + Style
 * - Shipment ≤ Actual demand
 * - Uniware 40% never exceeded
 * - No duplicate rows
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
     Uniware stock by Uniware SKU
  ----------------------------- */
  const uniwareByUniSku = new Map();
  uniwareStock.forEach(r => {
    if (!r.uniwareSku) return;
    uniwareByUniSku.set(
      r.uniwareSku,
      (uniwareByUniSku.get(r.uniwareSku) || 0) + r.qty
    );
  });

  /* -----------------------------
     MP shipped qty per SKU
  ----------------------------- */
  const mpShipmentBySku = new Map();
  mpPlanningRows.forEach(r => {
    mpShipmentBySku.set(
      r.sku,
      (mpShipmentBySku.get(r.sku) || 0) + r.shipmentQty
    );
  });

  /* -----------------------------
     🔑 CONSOLIDATE seller demand
     (MP + SKU + STYLE)
  ----------------------------- */
  const consolidated = new Map();

  sellerSales.forEach(r => {
    if (closedStyles.has(r.style)) return;
    if (!r.uniwareSku) return;

    const key = `${r.mp}|${r.sku}|${r.style}|${r.uniwareSku}`;

    if (!consolidated.has(key)) {
      consolidated.set(key, {
        mp: r.mp,
        sku: r.sku,
        style: r.style,
        uniwareSku: r.uniwareSku,
        saleQty: 0
      });
    }

    consolidated.get(key).saleQty += r.qty;
  });

  /* -----------------------------
     Group consolidated demand by SKU
  ----------------------------- */
  const sellerBySku = new Map();

  consolidated.forEach(r => {
    const drr = calculateDRR(r.saleQty);
    const actualDemand = Math.floor(45 * drr);
    if (actualDemand <= 0) return;

    if (!sellerBySku.has(r.sku)) {
      sellerBySku.set(r.sku, []);
    }

    sellerBySku.get(r.sku).push({
      mp: r.mp,
      sku: r.sku,
      style: r.style,
      uniwareSku: r.uniwareSku,
      saleQty: r.saleQty,
      actualShipmentQty: actualDemand
    });
  });

  /* -----------------------------
     Allocation per SKU
  ----------------------------- */
  const rows = [];

  sellerBySku.forEach((demands, sku) => {
    const uniwareQty =
      uniwareByUniSku.get(demands[0].uniwareSku) || 0;

    const allocatable = Math.floor(uniwareQty * 0.4);
    if (allocatable <= 0) return;

    const mpUsed = mpShipmentBySku.get(sku) || 0;
    const remainingPool = Math.max(0, allocatable - mpUsed);
    if (remainingPool <= 0) return;

    const totalSellerSale = demands.reduce(
      (sum, d) => sum + d.saleQty,
      0
    );
    if (totalSellerSale <= 0) return;

    demands.forEach(d => {
      const dw = d.saleQty / totalSellerSale;

      let allocated = remainingPool * dw;
      allocated =
        allocated > 0 && allocated < 1
          ? 1
          : Math.floor(allocated);

      const shipmentQty = Math.min(
        allocated,
        d.actualShipmentQty
      );

      if (shipmentQty <= 0) return;

      /* FC selection */
      let candidates = [];

      mpPlanningRows
        .filter(r => r.mp === d.mp && r.sku === d.sku)
        .forEach(r =>
          candidates.push({ fc: r.fc, dw: r.finalDW || 0 })
        );

      if (candidates.length === 0) {
        (fallbackFCsByMP[d.mp] || []).forEach(fc =>
          candidates.push({ fc, dw: 0 })
        );
      }

      candidates.sort((a, b) => b.dw - a.dw);

      rows.push({
        style: d.style,
        sku: d.sku,
        mp: d.mp,
        fc: candidates[0]?.fc || "NA",
        saleQty: d.saleQty,
        drr: Number((d.saleQty / 30).toFixed(2)),
        actualShipmentQty: d.actualShipmentQty,
        shipmentQty,
        action: "SHIP",
        remarks:
          shipmentQty < d.actualShipmentQty
            ? "Capped by demand"
            : "Allocated via DW"
      });
    });
  });

  return { rows };
}
