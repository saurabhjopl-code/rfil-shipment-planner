import {
  TARGET_STOCK_DAYS,
  RECALL_THRESHOLD_DAYS
} from "../shared/constants.js";

import {
  calculateDRR,
  calculateStockCover
} from "../shared/metrics.js";

/**
 * MP PLANNING CORE (PURE)
 *
 * RULES:
 * - NO Uniware allocation
 * - NO FC priority
 * - NO stock limitation
 * - Computes IDEAL shipment / recall only
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
     FC Stock lookup
  ----------------------------- */
  const fcStockMap = new Map();
  fcStock
    .filter(r => r.mp === mp)
    .forEach(r => {
      const key = `${r.warehouseId}|${r.sku}|${r.channelId}`;
      fcStockMap.set(key, r.qty);
    });

  /* -----------------------------
     Aggregate sales FC-wise
  ----------------------------- */
  const saleMap = new Map();

  mpSales
    .filter(r => r.mp === mp)
    .forEach(r => {
      const key = `${r.warehouseId}|${r.sku}|${r.channelId}`;

      if (!saleMap.has(key)) {
        saleMap.set(key, {
          style: r.style,
          sku: r.sku,
          fc: r.warehouseId,
          channelId: r.channelId,
          saleQty: 0
        });
      }

      saleMap.get(key).saleQty += r.qty;
    });

  /* -----------------------------
     Build planning rows
  ----------------------------- */
  const planningRows = [];

  saleMap.forEach(row => {
    const fcStockQty =
      fcStockMap.get(
        `${row.fc}|${row.sku}|${row.channelId}`
      ) || 0;

    const drr = calculateDRR(row.saleQty);
    const stockCover = calculateStockCover(fcStockQty, drr);

    let shipmentQty = 0;
    let recallQty = 0;
    let action = "NONE";
    let remarks = "";

    /* Closed style rule */
    if (closedStyles.has(row.style)) {
      recallQty = fcStockQty;
      action = recallQty > 0 ? "RECALL" : "NONE";
      remarks = "Style Closed";
    } else {
      if (stockCover < TARGET_STOCK_DAYS) {
        shipmentQty = Math.max(
          0,
          TARGET_STOCK_DAYS * drr - fcStockQty
        );
        action = shipmentQty > 0 ? "SHIP" : "NONE";
      } else if (stockCover > RECALL_THRESHOLD_DAYS) {
        recallQty = Math.max(
          0,
          fcStockQty - RECALL_THRESHOLD_DAYS * drr
        );
        action = recallQty > 0 ? "RECALL" : "NONE";
      }
    }

    planningRows.push({
      style: row.style,
      sku: row.sku,
      fc: row.fc,
      saleQty: row.saleQty,
      drr: Number(drr.toFixed(2)),
      fcStock: fcStockQty,
      stockCover: Number(stockCover.toFixed(2)),
      shipmentQty: Math.floor(shipmentQty),
      recallQty: Math.floor(recallQty),
      action,
      remarks
    });
  });

  return {
    mp,
    rows: planningRows
  };
}
