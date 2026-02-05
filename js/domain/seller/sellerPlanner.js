import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER — VA3.0 FINAL FIX
 *
 * ✔ Uniware consolidated
 * ✔ DW-based allocation
 * ✔ Minimum 1-unit safeguard
 * ✔ MP untouched
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
     Seller demand by SKU
  ----------------------------- */
  const sellerDemand = new Map();

  sellerSales.forEach(r => {
    if (closedStyles.has(r.style)) return;
    if (!r.uniwareSku) return;

    const drr = calculateDRR(r.qty);
    const actualShipmentQty = Math.floor(45 * drr);
    if (actualShipmentQty <= 0) return;

    if (!sellerDemand.has(r.sku)) {
      sellerDemand.set(r.sku, {
        sku: r.sku,
        uniwareSku: r.uniwareSku,
        style: r.style,
        saleQty: 0,
        actualShipmentQty: 0
      });
    }

    const row = sellerDemand.get(r.sku);
    row.saleQty += r.qty;
    row.actualShipmentQty += actualShipmentQty;
  });

  /* -----------------------------
     MP + Seller sale totals (for DW)
  ----------------------------- */
  const totalSaleBySku = new Map();

  mpPlanningRows.forEach(r => {
    totalSaleBySku.set(
      r.sku,
      (totalSaleBySku.get(r.sku) || 0) + r.saleQty
    );
  });

  sellerSales.forEach(r => {
    totalSaleBySku.set(
      r.sku,
      (totalSaleBySku.get(r.sku) || 0) + r.qty
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

    const allocatable = Math.floor(uniwareQty * 0.4);
    if (allocatable <= 0) return;

    const totalSale = totalSaleBySku.get(demand.sku) || 0;
    if (totalSale <= 0) return;

    const sellerDW = demand.saleQty / totalSale;

    let shipmentQty = Math.floor(allocatable * sellerDW);

    /* 🔑 MINIMUM ALLOCATION SAFEGUARD (SELLER ONLY) */
    if (
      shipmentQty === 0 &&
      allocatable > 0 &&
      demand.actualShipmentQty > 0
    ) {
      shipmentQty = 1;
    }

    shipmentQty = Math.min(
      shipmentQty,
      demand.actualShipmentQty
    );

    if (shipmentQty <= 0) return;

    /* -----------------------------
       FC selection (DW → fallback)
    ----------------------------- */
    let candidates = [];

    mpPlanningRows
      .filter(r => r.sku === demand.sku)
      .forEach(r => {
        candidates.push({
          fc: r.fc,
          dw: r.finalDW || 0
        });
      });

    if (candidates.length === 0) {
      Object.values(fallbackFCsByMP).forEach(list =>
        list.forEach(fc => candidates.push({ fc, dw: 0 }))
      );
    }

    candidates.sort((a, b) => b.dw - a.dw);

    rows.push({
      style: demand.style,
      sku: demand.sku,
      fc: candidates[0].fc,
      saleQty: demand.saleQty,
      drr: Number((demand.saleQty / 30).toFixed(2)),
      fcStock: 0,
      stockCover: 0,
      actualShipmentQty: demand.actualShipmentQty,
      shipmentQty,
      remarks:
        shipmentQty < demand.actualShipmentQty
          ? "DW / Uniware 40% constraint"
          : "DW allocation"
    });
  });

  return { rows };
}
