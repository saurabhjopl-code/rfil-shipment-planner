import { calculateDRR } from "../shared/metrics.js";

/**
 * SELLER SHIPMENT PLANNER — VA3.1 FIXED
 *
 * ✔ Planned per MP + SKU
 * ✔ Uniware 40% respected
 * ✔ Actual vs Shipment works
 * ✔ No FC stock / SC
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
     Total sale by SKU (MP + Seller)
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

    let shipmentQty = Math.ceil(allocatable * sellerDW);
    shipmentQty = Math.min(shipmentQty, demand.actualShipmentQty);
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
      action: shipmentQty > 0 ? "SHIP" : "NONE",
      remarks:
        shipmentQty < demand.actualShipmentQty
          ? "DW / Uniware 40% constraint"
          : "DW allocation"
    });
  });

  return { rows };
}
