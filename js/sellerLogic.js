/* =========================================================
   sellerLogic.js – SELLER FC REPLENISHMENT ENGINE (FINAL)
   Business-driven, MP-safe, FC-safe
   ========================================================= */

function buildSellerPlanning(finalData, sale30DRaw) {

  /* -------------------------------
     Guard
  -------------------------------- */
  if (!Array.isArray(finalData) || !Array.isArray(sale30DRaw)) {
    return [];
  }

  /* =======================================================
     STEP 0: BUILD FC SET (FROM MP DATA)
     Any warehouse NOT in this set is SELLER
     ======================================================= */

  const fcSet = new Set(
    finalData
      .map(r => r.warehouseId)
      .filter(v => typeof v === "string" && v.trim() !== "")
  );

  if (fcSet.size === 0) {
    return [];
  }

  /* =======================================================
     STEP 1: IDENTIFY SELLER SALES (DATA-DRIVEN)
     ======================================================= */

  const sellerSales = sale30DRaw.filter(r => {
    const wh = String(r["Warehouse Id"] || "").trim();
    if (!wh) return false;
    return !fcSet.has(wh);
  });

  if (!sellerSales.length) {
    return [];
  }

  /* =======================================================
     STEP 2: AGGREGATE SELLER SALES
     ======================================================= */

  const map = {};

  sellerSales.forEach(r => {
    const styleId = r["Style ID"];
    const sku = r["SKU"];
    const uniwareSku = r["Uniware SKU"] || sku;

    if (!styleId || !sku) return;

    const key = `${styleId}|${sku}`;

    if (!map[key]) {
      map[key] = {
        mp: "SELLER",
        styleId,
        sku,
        uniwareSku,
        warehouseId: "SELLER",

        saleQty: 0,
        drr: 0,
        fcStockQty: 0,
        stockCover: 0,
        shipmentQty: 0,
        remark: ""
      };
    }

    map[key].saleQty += Number(r["Quantity"]) || 0;
  });

  const rows = Object.values(map);
  if (!rows.length) return [];

  /* =======================================================
     STEP 3: DRR
     ======================================================= */

  rows.forEach(r => {
    r.drr = r.saleQty / 30;
  });

  /* =======================================================
     STEP 4: UNIWARE STOCK MAP (MASTER)
     ======================================================= */

  const uniwareStockMap = {};
  finalData.forEach(r => {
    if (!r.uniwareSku) return;
    if (uniwareStockMap[r.uniwareSku] == null) {
      uniwareStockMap[r.uniwareSku] = r.uniwareStockQty || 0;
    }
  });

  /* =======================================================
     STEP 5: 40% CAP + 45 DAY TARGET
     ======================================================= */

  rows.forEach(r => {

    const uwStock = uniwareStockMap[r.uniwareSku] || 0;
    const maxAllocatable = Math.floor(uwStock * 0.4);

    if (r.drr <= 0) {
      r.shipmentQty = 0;
      r.stockCover = 0;
      r.remark = "No recent seller sales";
      return;
    }

    if (maxAllocatable <= 0) {
      r.shipmentQty = 0;
      r.stockCover = 0;
      r.remark = "No allocatable Uniware stock (40% cap)";
      return;
    }

    const targetQty = Math.ceil(r.drr * 45);

    r.shipmentQty = Math.min(targetQty, maxAllocatable);
    r.stockCover = r.shipmentQty / r.drr;
    r.remark = "Seller sale → FC replenishment planning (45D target)";
  });

  return rows;
}
