import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER — STEP 2
 *
 * ✔ SKU-wise Uniware 40% allocation
 * ✔ DW-based MP split
 * ✔ Seller allocation only
 * ✔ No MP impact
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
     Uniware stock by SKU
  ----------------------------- */
  const uniwareBySku = new Map();
  uniwareStock.forEach(r => {
    uniwareBySku.set(
      r.sku,
      (uniwareBySku.get(r.sku) || 0) + r.qty
    );
  });

  /* -----------------------------
     Seller demand by SKU
  ----------------------------- */
  const sellerDemand = new Map();

  sellerSales.forEach(r => {
    if (closedStyles.has(r.style)) return;

    const drr = calculateDRR(r.qty);
    const actualShipmentQty = Math.floor(45 * drr);

    if (actualShipmentQty <= 0) return;

    if (!sellerDemand.has(r.sku)) {
      sellerDemand.set(r.sku, {
        sku: r.sku,
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
    const uniwareQty = uniwareBySku.get(demand.sku) || 0;
    if (uniwareQty <= 0) return;

    const allocatable = Math.floor(uniwareQty * 0.4);
    if (allocatable <= 0) return;

    const totalSale = totalSaleBySku.get(demand.sku) || 0;
    if (totalSale <= 0) return;

    const sellerSale = demand.saleQty;
    const sellerDW = sellerSale / totalSale;

    const sellerAllocation = Math.min(
      Math.floor(allocatable * sellerDW),
      demand.actualShipmentQty
    );

    if (sellerAllocation <= 0) return;

    /* -----------------------------
       FC selection via DW
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
      shipmentQty: sellerAllocation,
      remarks:
        sellerAllocation < demand.actualShipmentQty
          ? "DW-based partial allocation"
          : "DW allocation"
    });
  });

  return {
    rows
  };
}
