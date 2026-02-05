/* =========================================================
   sellerLogic.js – SELLER PLANNING ENGINE (DW-BASED)
   Depends on:
   - FINAL_DATA (output of calc.js)
   - Raw Sale 30D (SELLER rows)
   ========================================================= */

/* ===============================
   CONFIG
   =============================== */

const SELLER_TARGET_DAYS = 45;

const SELLER_BEST_FCS = {
  "Amazon IN": ["BLR8", "HYD3", "BOM5", "CJB1", "DEL5"],
  "Myntra": ["Bangalore", "Mumbai", "Bilaspur"],
  "Flipkart": ["MALUR", "KOLKATA", "SANPKA", "HYDERABAD", "BHIWANDI"]
};

/* ===============================
   MAIN ENTRY
   =============================== */

/**
 * @param {Array} finalData - output of runCalculations()
 * @param {Array} sale30dRaw - raw Sale 30D rows (before calc)
 * @returns {Array} SELLER planning rows
 */
function buildSellerPlanning(finalData, sale30dRaw) {

  const sellerRows = [];

  /* ===============================
     STEP S1: SELLER SALES
     =============================== */

  const sellerSaleMap = {}; // uniwareSku|mp -> sale

  sale30dRaw.forEach(r => {
    if (r.WarehouseId !== "SELLER") return;
    if (!SELLER_BEST_FCS[r.MP]) return;

    const key = `${r.UniwareSKU}|${r.MP}`;
    sellerSaleMap[key] = (sellerSaleMap[key] || 0) + (r.Quantity || 0);
  });

  /* ===============================
     STEP S2: FC SALE MAP (FROM FINAL_DATA)
     =============================== */

  const fcSaleMap = {}; // uniwareSku|mp -> sale

  finalData.forEach(r => {
    if (r.isClosedStyle) return;
    if (!SELLER_BEST_FCS[r.mp]) return;

    const key = `${r.uniwareSku}|${r.mp}`;
    fcSaleMap[key] = (fcSaleMap[key] || 0) + (r.sale30dFc || 0);
  });

  /* ===============================
     STEP S3: FC STRENGTH MAP
     =============================== */

  const fcStrength = {}; // mp|fc|sku -> strength

  finalData.forEach(r => {
    if (r.isClosedStyle) return;
    if (!SELLER_BEST_FCS[r.mp]) return;

    const k = `${r.mp}|${r.warehouseId}|${r.uniwareSku}`;
    fcStrength[k] = Math.max(r.drr || 0, r.finalSkuDw || 0);
  });

  /* ===============================
     STEP S4: BUILD SELLER ROWS
     =============================== */

  Object.entries(sellerSaleMap).forEach(([key, sellerSale30d]) => {

    const [uniwareSku, mp] = key.split("|");
    const fcSale30d = fcSaleMap[key] || 0;

    if (sellerSale30d <= 0) return;

    const totalSale = sellerSale30d + fcSale30d;
    const sellerDW = totalSale > 0 ? sellerSale30d / totalSale : 0;

    const sellerDRR = sellerSale30d / 30;

    const bestFCs = SELLER_BEST_FCS[mp] || [];
    if (!bestFCs.length) return;

    /* normalize FC strength */
    let totalStrength = 0;
    const fcWeights = {};

    bestFCs.forEach(fc => {
      const sKey = `${mp}|${fc}|${uniwareSku}`;
      const strength = fcStrength[sKey] || 0;
      fcWeights[fc] = strength;
      totalStrength += strength;
    });

    /* fallback: equal split */
    if (totalStrength === 0) {
      bestFCs.forEach(fc => {
        fcWeights[fc] = 1;
      });
      totalStrength = bestFCs.length;
    }

    /* ===============================
       STEP S5: CREATE ROWS
       =============================== */

    bestFCs.forEach(fc => {

      const fcDW = sellerDW * (fcWeights[fc] / totalStrength);

      const fcRow = finalData.find(
        r => r.mp === mp && r.warehouseId === fc && r.uniwareSku === uniwareSku
      );

      const fcStock = fcRow ? fcRow.fcStockQty : 0;

      const stockCover =
        sellerDRR > 0 ? fcStock / sellerDRR : 0;

      const requiredShipmentQty =
        sellerDRR > 0
          ? Math.max(0, Math.ceil((SELLER_TARGET_DAYS - stockCover) * sellerDRR))
          : 0;

      sellerRows.push({
        mp: "SELLER",
        originMp: mp,
        styleId: fcRow ? fcRow.styleId : "",
        sku: fcRow ? fcRow.sku : "",
        uniwareSku,
        warehouseId: fc,
        saleQty: sellerSale30d,
        drr: sellerDRR,
        fcStockQty: fcStock,
        stockCover,
        finalSkuDw: fcDW,
        requiredShipmentQty,
        shipmentQty: 0 // allocated later by main engine
      });
    });
  });

  return sellerRows;
}
