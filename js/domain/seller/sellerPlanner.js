import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER — VA3.3
 *
 * - Actual Shipment Qty = pure demand
 * - Shipment Qty = DW-based allocation from remaining 40%
 * - No FC stock / SC / recall
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
     MP shipment already consumed
  ----------------------------- */
  const mpShipmentBySku = new Map();
  mpPlanningRows.forEach(r => {
    mpShipmentBySku.set(
      r.sku,
      (mpShipmentBySku.get(r.sku) || 0) + r.shipmentQty
    );
  });

  /* -----------------------------
     Seller demand by MP + SKU
  ----------------------------- */
  const sellerDemand = new Map();

  sellerSales.forEach(r => {
    if (closedStyles.has(r.style)) return;
    if (!r.uniwareSku) return;

    const drr = calculateDRR(r.qty);
    const actualShipmentQty = Math.floor(45 * drr);
    if (actualShipmentQty <= 0) return;

    const key = `${r.mp}|${r.sku}`;

    if (!sellerDemand.has(key)) {
      sellerDemand.set(key, {
        mp: r.mp,
        sku: r.sku,
        style: r.style,
        uniwareSku: r.uniwareSku,
        saleQty: 0,
        actualShipmentQty: 0
      });
    }

    const row = sellerDemand.get(key);
    row.saleQty += r.qty;
    row.actualShipmentQty += actualShipmentQty;
  });

  /* -----------------------------
     Total seller sale per SKU (DW base)
  ----------------------------- */
  const totalSellerSaleBySku = new Map();
  sellerDemand.forEach(r => {
    totalSellerSaleBySku.set(
      r.sku,
      (totalSellerSaleBySku.get(r.sku) || 0) + r.saleQty
    );
  });

  /* -----------------------------
     Allocate Seller shipments
  ----------------------------- */
  const rows = [];

  sellerDemand.forEach(demand => {
    const uniwareQty =
      uniwareByUniSku.get(demand.uniwareSku) || 0;
    if (uniwareQty <= 0) return;

    const totalAllocatable = Math.floor(uniwareQty * 0.4);
    if (totalAllocatable <= 0) return;

    const mpUsed = mpShipmentBySku.get(demand.sku) || 0;
    const remainingPool = Math.max(0, totalAllocatable - mpUsed);
    if (remainingPool <= 0) return;

    const totalSellerSale =
      totalSellerSaleBySku.get(demand.sku) || 0;
    if (totalSellerSale <= 0) return;

    const sellerDW = demand.saleQty / totalSellerSale;

    let shipmentQty = remainingPool * sellerDW;

    // round-up small fractions
    shipmentQty =
      shipmentQty > 0 && shipmentQty < 1
        ? 1
        : Math.floor(shipmentQty);

    if (shipmentQty <= 0) return;

    /* -----------------------------
       FC selection (MP-specific)
    ----------------------------- */
    let candidates = [];

    mpPlanningRows
      .filter(
        r => r.mp === demand.mp && r.sku === demand.sku
      )
      .forEach(r => {
        candidates.push({
          fc: r.fc,
          dw: r.finalDW || 0
        });
      });

    if (candidates.length === 0) {
      (fallbackFCsByMP[demand.mp] || []).forEach(fc =>
        candidates.push({ fc, dw: 0 })
      );
    }

    candidates.sort((a, b) => b.dw - a.dw);

    rows.push({
      style: demand.style,
      sku: demand.sku,
      mp: demand.mp,
      fc: candidates[0]?.fc || "NA",
      saleQty: demand.saleQty,
      drr: Number((demand.saleQty / 30).toFixed(2)),
      actualShipmentQty: demand.actualShipmentQty,
      shipmentQty,
      action: "SHIP",
      remarks:
        shipmentQty < demand.actualShipmentQty
          ? "Allocated from remaining 40% via DW"
          : "Fully allocated via DW"
    });
  });

  return { rows };
}
