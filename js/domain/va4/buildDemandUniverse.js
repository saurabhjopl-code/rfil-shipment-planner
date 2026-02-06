import { calculateDRR } from "../shared/metrics.js";
import {
  computeMPDW,
  computeFCDW,
  computeStyleDW,
  computeSkuDW,
  computeFinalDW
} from "./computeDW.js";

import { createDemandRow } from "./va4.contract.js";

/**
 * VA4 — BUILD UNIFIED DEMAND UNIVERSE
 *
 * INPUT:
 * - mpSales      (from deriveSellerSales)
 * - sellerSales
 *
 * OUTPUT:
 * - Array of demand rows with DW + ActualDemand
 *
 * ❌ No Uniware
 * ❌ No shipment
 * ❌ No recall
 */
export function buildDemandUniverse({
  mpSales,
  sellerSales
}) {
  const allSales = [];

  /* -----------------------------
     Normalize SELLER as MP
  ----------------------------- */
  mpSales.forEach(r => allSales.push(r));
  sellerSales.forEach(r =>
    allSales.push({
      ...r,
      mp: "SELLER",
      warehouseId: null
    })
  );

  /* -----------------------------
     TOTAL SALE BY SKU (ALL MPs)
  ----------------------------- */
  const totalSaleBySku = new Map();
  allSales.forEach(r => {
    totalSaleBySku.set(
      r.sku,
      (totalSaleBySku.get(r.sku) || 0) + r.qty
    );
  });

  /* -----------------------------
     MP SALE BY SKU
  ----------------------------- */
  const mpSkuSale = new Map();
  allSales.forEach(r => {
    const key = `${r.mp}|${r.sku}`;
    mpSkuSale.set(
      key,
      (mpSkuSale.get(key) || 0) + r.qty
    );
  });

  /* -----------------------------
     STYLE SALE BY MP
  ----------------------------- */
  const styleSaleByMp = new Map();
  allSales.forEach(r => {
    const key = `${r.mp}|${r.style}`;
    styleSaleByMp.set(
      key,
      (styleSaleByMp.get(key) || 0) + r.qty
    );
  });

  /* -----------------------------
     SKU SALE BY MP + STYLE
  ----------------------------- */
  const skuSaleByMpStyle = new Map();
  allSales.forEach(r => {
    const key = `${r.mp}|${r.style}|${r.sku}`;
    skuSaleByMpStyle.set(
      key,
      (skuSaleByMpStyle.get(key) || 0) + r.qty
    );
  });

  /* -----------------------------
     FC SALE BY MP + SKU (MP only)
  ----------------------------- */
  const fcSaleByMpSku = new Map();
  allSales
    .filter(r => r.mp !== "SELLER")
    .forEach(r => {
      const key = `${r.mp}|${r.warehouseId}|${r.sku}`;
      fcSaleByMpSku.set(
        key,
        (fcSaleByMpSku.get(key) || 0) + r.qty
      );
    });

  /* -----------------------------
     BUILD DEMAND ROWS
  ----------------------------- */
  const demandRows = [];

  allSales.forEach(r => {
    const totalSkuSale = totalSaleBySku.get(r.sku) || 0;
    const mpSale =
      mpSkuSale.get(`${r.mp}|${r.sku}`) || 0;
    const styleSale =
      styleSaleByMp.get(`${r.mp}|${r.style}`) || 0;
    const skuSale =
      skuSaleByMpStyle.get(`${r.mp}|${r.style}|${r.sku}`) || 0;

    const mpDW = computeMPDW(mpSale, totalSkuSale);
    const styleDW = computeStyleDW(styleSale, mpSale);
    const skuDW = computeSkuDW(skuSale, styleSale);

    let fcDW = 1;
    if (r.mp !== "SELLER") {
      const fcSale =
        fcSaleByMpSku.get(
          `${r.mp}|${r.warehouseId}|${r.sku}`
        ) || 0;
      fcDW = computeFCDW(fcSale, mpSale);
    }

    const finalDW = computeFinalDW({
      mpDW,
      fcDW,
      styleDW,
      skuDW
    });

    const drr = calculateDRR(r.qty);
    let actualDemand = 45 * drr;
    if (actualDemand > 0 && actualDemand < 1) {
      actualDemand = 1;
    }

    demandRows.push(
      createDemandRow({
        mp: r.mp,
        fc: r.warehouseId,
        style: r.style,
        sku: r.sku,
        uniwareSku: r.uniwareSku,
        saleQty: r.qty,
        drr: Number(drr.toFixed(4)),
        actualDemand: Math.floor(actualDemand),
        mpDW: Number(mpDW.toFixed(6)),
        fcDW: Number(fcDW.toFixed(6)),
        styleDW: Number(styleDW.toFixed(6)),
        skuDW: Number(skuDW.toFixed(6)),
        finalDW: Number(finalDW.toFixed(8))
      })
    );
  });

  return demandRows;
}

