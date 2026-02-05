import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER — VA3.0 FIXED
 *
 * ✔ Uniware consolidated by Uniware SKU
 * ✔ Fallback SKU → Uniware SKU mapping added
 * ✔ Actual Shipment Qty preserved
 * ✔ Shipment Qty now works
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
     Uniware stock by Uniware SKU (CONSOLIDATED)
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
     SKU → Uniware SKU fallback map (from MP data)
  ----------------------------- */
  const skuToUniwareSku = new Map();
  mpPlanningRows.forEach(r => {
    if (r.sku && r.uniwareSku) {
      skuToUniwareSku.set(r.sku, r.uniwareSku);
    }
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

    const uniwareSku =
      r.uniwareSku || skuToUniwareSku.get(r.sku);

    if (!uniwareSku) return; // cannot allocate without mapping

    if (!sellerDemand.has(r.sku)) {
      sellerDemand.set(r.sku, {
        sku: r.sku,
        style: r.style,
        uniwareSku,
        saleQty: 0,
        actualShipmentQty: 0
      });
    }

    const row = sellerDemand.get(r.sku);
    row.saleQty += r.qty;
    row.actualShipmentQty += actualShipmentQty;
  });

  /* -----------------------------
     MP + Seller total sale by SKU (for DW)
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

    const shipmentQty = Math.min(
      Math.floor(allocatable * sellerDW),
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
