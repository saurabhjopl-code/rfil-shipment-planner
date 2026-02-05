import {
  TARGET_STOCK_DAYS,
  RECALL_THRESHOLD_DAYS,
  UNIWARE_ALLOCATION_PERCENT
} from "../shared/constants.js";

import {
  calculateDRR,
  calculateStockCover
} from "../shared/metrics.js";

import { calculateFCPriority } from "./fcPriority.js";

/**
 * MP PLANNING CORE
 *
 * Produces FC-level planning rows:
 * SHIP / RECALL / NONE
 */

export function planMP({
  mp,
  mpSales,
  fcStock,
  uniwareStock,
  companyRemarks
}) {
  // -----------------------------
  // Build lookup helpers
  // -----------------------------

  const closedStyles = new Set(
    companyRemarks
      .filter(r => r.remark === "Closed")
      .map(r => r.style)
  );

  const fcStockMap = new Map();
  fcStock
    .filter(r => r.mp === mp)
    .forEach(r => {
      const key = `${r.warehouseId}|${r.sku}|${r.channelId}`;
      fcStockMap.set(key, r.qty);
    });

  const uniwareMap = new Map();
  uniwareStock.forEach(r => {
    uniwareMap.set(r.uniwareSku, r.qty);
  });

  const totalUniwareQty = Array.from(uniwareMap.values())
    .reduce((a, b) => a + b, 0);

  let availableUniware =
    totalUniwareQty * UNIWARE_ALLOCATION_PERCENT;

  // -----------------------------
  // Aggregate sales FC-wise
  // -----------------------------

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
          uniwareSku: r.uniwareSku,
          saleQty: 0
        });
      }

      saleMap.get(key).saleQty += r.qty;
    });

  // -----------------------------
  // Build planning rows
  // -----------------------------

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
      stockCover: Number(stockCover.toFixed(1)),
      shipmentQty: Math.floor(shipmentQty),
      recallQty: Math.floor(recallQty),
      action,
      remarks
    });
  });

  // -----------------------------
  // Allocate Uniware for SHIP rows
  // (priority applied here)
  // -----------------------------

  const shipRows = planningRows.filter(r => r.action === "SHIP");

  const maxDRR = Math.max(...shipRows.map(r => r.drr), 0);
  const maxDW = shipRows.length; // placeholder for DW (added later)

  shipRows.forEach(r => {
    const priority = calculateFCPriority({
      fcDRR: r.drr,
      maxDRR,
      fcDW: 1,
      maxDW
    });

    const allocatable = Math.min(
      r.shipmentQty,
      availableUniware
    );

    r.shipmentQty = Math.floor(allocatable);
    availableUniware -= r.shipmentQty;

    if (r.shipmentQty === 0) {
      r.action = "NONE";
    }

    r.remarks = "FC Priority Allocation";
  });

  return {
    mp,
    rows: planningRows,
    uniwareUsed: totalUniwareQty * UNIWARE_ALLOCATION_PERCENT - availableUniware,
    remainingUniware: availableUniware
  };
}
