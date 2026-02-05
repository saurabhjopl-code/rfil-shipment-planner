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
 * MP PLANNING CORE — VA.1 (FIXED)
 *
 * - Style propagation restored
 * - DW preserved
 * - NO allocation logic
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
     Aggregate SKU sales (GLOBAL)
  ----------------------------- */
  const totalSkuSaleMap = new Map();
  mpSales.forEach(r => {
    totalSkuSaleMap.set(
      r.sku,
      (totalSkuSaleMap.get(r.sku) || 0) + r.qty
    );
  });

  /* -----------------------------
     Aggregate MP SKU sales
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
     Aggregate FC–SKU–STYLE sales
  ----------------------------- */
  const fcSkuStyleSaleMap = new Map();

  mpSales
    .filter(r => r.mp === mp)
    .forEach(r => {
      const key = `${r.warehouseId}|${r.sku}|${r.style}`;
      if (!fcSkuStyleSaleMap.has(key)) {
        fcSkuStyleSaleMap.set(key, {
          fc: r.warehouseId,
          sku: r.sku,
          style: r.style,
          channelId: r.channelId,
          saleQty: 0
        });
      }
      fcSkuStyleSaleMap.get(key).saleQty += r.qty;
    });

  /* -----------------------------
     Build planning rows
  ----------------------------- */
  const planningRows = [];

  fcSkuStyleSaleMap.forEach(row => {
    const totalSkuSale = totalSkuSaleMap.get(row.sku) || 0;
    const mpSkuSale = mpSkuSaleMap.get(row.sku) || 0;

    const mpDW = calculateMPDW(mpSkuSale, totalSkuSale);
    const fcDW = calculateFCDW(row.saleQty, mpSkuSale);
    const finalDW = calculateFinalDW(mpDW, fcDW);

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
      style: row.style,              // ✅ FIXED
      sku: row.sku,
      fc: row.fc,
      saleQty: row.saleQty,
      drr: Number(drr.toFixed(2)),
      fcStock: fcStockQty,
      stockCover: Number(stockCover.toFixed(2)),
      shipmentQty: Math.floor(shipmentQty),
      recallQty: Math.floor(recallQty),
      action,
      remarks,
      mpDW: Number(mpDW.toFixed(4)),
      fcDW: Number(fcDW.toFixed(4)),
      finalDW: Number(finalDW.toFixed(4))
    });
  });

  return {
    mp,
    rows: planningRows
  };
}
