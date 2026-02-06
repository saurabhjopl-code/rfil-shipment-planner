/**
 * VA4 — ENRICH MP ROWS
 *
 * Adds:
 * - FC Stock
 * - Stock Cover
 * - Recall Qty
 * - Action
 * - Remarks
 *
 * Seller rows are NOT touched
 */

import {
  TARGET_STOCK_DAYS,
  RECALL_THRESHOLD_DAYS
} from "../shared/constants.js";

import {
  calculateStockCover
} from "../shared/metrics.js";

export function enrichMpRows({
  rows,
  fcStock,
  companyRemarks
}) {
  const closedStyles = new Set(
    companyRemarks
      .filter(r => r.remark === "Closed")
      .map(r => r.style)
  );

  const fcStockMap = new Map();
  fcStock.forEach(r => {
    fcStockMap.set(
      `${r.mp}|${r.warehouseId}|${r.sku}`,
      r.qty
    );
  });

  return rows.map(r => {
    if (r.mp === "SELLER") {
      return {
        ...r,
        fcStock: "",
        stockCover: "",
        recallQty: "",
        action: r.shipmentQty > 0 ? "SHIP" : "NONE",
        remarks: r.allocationRemarks || ""
      };
    }

    const fcStockQty =
      fcStockMap.get(`${r.mp}|${r.fc}|${r.sku}`) || 0;

    const stockCover = calculateStockCover(fcStockQty, r.drr);

    let recallQty = 0;
    let action = "NONE";
    let remarks = r.allocationRemarks || "";

    if (closedStyles.has(r.style)) {
      recallQty = fcStockQty;
      action = recallQty > 0 ? "RECALL" : "NONE";
      remarks = "Style Closed";
    } else {
      if (stockCover < TARGET_STOCK_DAYS) {
        action = r.shipmentQty > 0 ? "SHIP" : "NONE";
      } else if (stockCover > RECALL_THRESHOLD_DAYS) {
        recallQty = Math.floor(
          fcStockQty - RECALL_THRESHOLD_DAYS * r.drr
        );
        action = recallQty > 0 ? "RECALL" : "NONE";
      }
    }

    return {
      ...r,
      fcStock: fcStockQty,
      stockCover: Number(stockCover.toFixed(2)),
      recallQty: Math.floor(recallQty),
      action,
      remarks
    };
  });
}
