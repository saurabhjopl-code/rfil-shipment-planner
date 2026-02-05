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
 * MP PLANNER — STEP 4 (STABLE, FIXED)
 *
 * - actualShipmentQty = true demand
 * - shipmentQty      = DW + 40% Uniware capped
 * - Recall logic unchanged
 * - Action logic unchanged
 */

export function planMP({
  mp,
  mpSales,
  fcStock,
  companyRemarks,
  uniwareStock
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
     🔑 SKU → Uniware SKU mapping
  ----------------------------- */
  const skuToUniwareSku = new Map();
  mpSales.forEach(r => {
    if (r.sku && r.uniwareSku) {
      skuToUniwareSku.set(r.sku, r.uniwareSku);
    }
  });

  /* -----------------------------
     Uniware stock by UNIWARE SKU
  ----------------------------- */
  const uniwareByUniSku = new Map();
  (uniwareStock || []).forEach(r => {
    uniwareByUniSku.set(
      r.uniwareSku,
      (uniwareByUniSku.get(r.uniwareSku) || 0) + r.qty
    );
  });

  /* -----------------------------
     Allocatable 40% per SKU
  ----------------------------- */
  const allocatableBySku = new Map();
  skuToUniwareSku.forEach((uniSku, sku) => {
    const totalUniware = uniwareByUniSku.get(uniSku) || 0;
    allocatableBySku.set(sku, Math.floor(totalUniware * 0.4));
  });

  /* -----------------------------
     Total SKU sale (ALL MPs)
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
      fcStockMap.set(`${r.warehouseId}|${r.sku}`, r.qty);
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
     MP allocation envelope per SKU
  ----------------------------- */
  const mpAllocBySku = new Map();
  mpSkuSaleMap.forEach((mpSale, sku) => {
    const totalSale = totalSkuSaleMap.get(sku) || 0;
    const pool = allocatableBySku.get(sku) || 0;
    if (totalSale > 0 && pool > 0) {
      mpAllocBySku.set(
        sku,
        Math.floor((mpSale / totalSale) * pool)
      );
    }
  });

  /* -----------------------------
     Build rows
  ----------------------------- */
  const rows = [];

  fcSkuStyleMap.forEach(row => {
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

        const mpCap = mpAllocBySku.get(row.sku) || 0;
        shipmentQty = Math.min(
          Math.floor(actualShipmentQty),
          mpCap
        );

        if (shipmentQty < actualShipmentQty) {
          remarks = "DW / Uniware 40% constraint";
        }

        action = actualShipmentQty > 0 ? "SHIP" : "NONE";
      } else if (stockCover > RECALL_THRESHOLD_DAYS) {
        recallQty = Math.max(
          0,
          fcStockQty - RECALL_THRESHOLD_DAYS * drr
        );
        action = recallQty > 0 ? "RECALL" : "NONE";
      }
    }

    const totalSkuSale = totalSkuSaleMap.get(row.sku) || 0;
    const mpSkuSale = mpSkuSaleMap.get(row.sku) || 0;

    const mpDW = calculateMPDW(mpSkuSale, totalSkuSale);
    const fcDW = calculateFCDW(row.saleQty, mpSkuSale);
    const finalDW = calculateFinalDW(mpDW, fcDW);

    rows.push({
      style: row.style,
      sku: row.sku,
      fc: row.fc,
      saleQty: row.saleQty,
      drr: Number(drr.toFixed(2)),
      fcStock: fcStockQty,
      stockCover: Number(stockCover.toFixed(2)),
      actualShipmentQty: Math.floor(actualShipmentQty),
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
    rows
  };
}
