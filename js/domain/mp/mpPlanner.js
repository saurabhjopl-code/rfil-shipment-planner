import {
  TARGET_STOCK_DAYS,
  RECALL_THRESHOLD_DAYS
} from "../shared/constants.js";

import {
  calculateDRR,
  calculateStockCover
} from "../shared/metrics.js";

import {
  calculateMPDW,
  calculateFCDW,
  calculateFinalDW
} from "../shared/demandWeight.js";

/**
 * MP PLANNER — VA2.0 + Actual Shipment Qty (STEP 1)
 *
 * ✔ Planning logic unchanged
 * ✔ Shipment logic unchanged
 * ✔ New field: actualShipmentQty (demand truth)
 * ✔ No allocation yet
 */

export function planMP({
  mp,
  mpSales,
  fcStock,
  companyRemarks
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
     Total SKU sale (global)
  ----------------------------- */
  const totalSkuSaleMap = new Map();
  mpSales.forEach(r => {
    totalSkuSaleMap.set(
      r.sku,
      (totalSkuSaleMap.get(r.sku) || 0) + r.qty
    );
  });

  /* -----------------------------
     MP SKU sale
  ----------------------------- */
  const mpSkuSaleMap = new Map();
  mpSales
    .filter(r => r.mp === mp)
    .forEach(r => {
      mpSkuSaleMap.set(
        r.sku,
        (mpSkuSaleMap.get(r.sku) || 0) + r.qty
      );
    });

  /* -----------------------------
     FC stock (FC + SKU)
  ----------------------------- */
  const fcStockMap = new Map();
  fcStock
    .filter(r => r.mp === mp)
    .forEach(r => {
      const key = `${r.warehouseId}|${r.sku}`;
      fcStockMap.set(key, r.qty);
    });

  /* -----------------------------
     Aggregate FC–SKU–STYLE sales
  ----------------------------- */
  const fcSkuStyleMap = new Map();

  mpSales
    .filter(r => r.mp === mp)
    .forEach(r => {
      const key = `${r.warehouseId}|${r.sku}|${r.style}`;
      if (!fcSkuStyleMap.has(key)) {
        fcSkuStyleMap.set(key, {
          fc: r.warehouseId,
          sku: r.sku,
          style: r.style,
          saleQty: 0
        });
      }
      fcSkuStyleMap.get(key).saleQty += r.qty;
    });

  /* -----------------------------
     Build planning rows
  ----------------------------- */
  const rows = [];

  fcSkuStyleMap.forEach(row => {
    const totalSkuSale = totalSkuSaleMap.get(row.sku) || 0;
    const mpSkuSale = mpSkuSaleMap.get(row.sku) || 0;

    /* DW (observability only) */
    const mpDW = calculateMPDW(mpSkuSale, totalSkuSale);
    const fcDW = calculateFCDW(row.saleQty, mpSkuSale);
    const finalDW = calculateFinalDW(mpDW, fcDW);

    const fcStockQty =
      fcStockMap.get(`${row.fc}|${row.sku}`) || 0;

    const drr = calculateDRR(row.saleQty);
    const stockCover = calculateStockCover(fcStockQty, drr);

    let actualShipmentQty = 0;
    let shipmentQty = 0;
    let recallQty = 0;
    let action = "NONE";
    let remarks = "";

    if (closedStyles.has(row.style)) {
      recallQty = fcStockQty;
      action = recallQty > 0 ? "RECALL" : "NONE";
      remarks = "Style Closed";
    } else {
      if (stockCover < TARGET_STOCK_DAYS) {
        actualShipmentQty = Math.max(
          0,
          TARGET_STOCK_DAYS * drr - fcStockQty
        );

        /* STEP 1: shipmentQty = demand */
        shipmentQty = actualShipmentQty;

        action = actualShipmentQty > 0 ? "SHIP" : "NONE";
      } else if (stockCover > RECALL_THRESHOLD_DAYS) {
        recallQty = Math.max(
          0,
          fcStockQty - RECALL_THRESHOLD_DAYS * drr
        );
        action = recallQty > 0 ? "RECALL" : "NONE";
      }
    }

    rows.push({
      style: row.style,
      sku: row.sku,
      fc: row.fc,
      saleQty: row.saleQty,
      drr: Number(drr.toFixed(2)),
      fcStock: fcStockQty,
      stockCover: Number(stockCover.toFixed(2)),

      /* 🔑 NEW FIELD */
      actualShipmentQty: Math.floor(actualShipmentQty),

      /* Existing fields unchanged */
      shipmentQty: Math.floor(shipmentQty),
      recallQty: Math.floor(recallQty),
      action,
      remarks,

      /* DW metadata */
      mpDW: Number(mpDW.toFixed(4)),
      fcDW: Number(fcDW.toFixed(4)),
      finalDW: Number(finalDW.toFixed(4))
    });
  });

  return {
    mp,
    rows
  };
}
