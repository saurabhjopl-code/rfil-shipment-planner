/* =========================================================
   sellerLogic.js – SELLER FC REPLENISHMENT ENGINE (FINAL)
   ========================================================= */

function buildSellerPlanning(finalData, sale30DRaw) {

  if (!Array.isArray(sale30DRaw) || sale30DRaw.length === 0) {
    return [];
  }

  /* ===============================
     STEP 1: IDENTIFY SELLER SALES
     SELLER is a fulfillment source,
     NOT an MP
     =============================== */

  const sellerSales = sale30DRaw.filter(r => {
    const ft = String(r["Fulfillment Type"] || "").toUpperCase();
    const wh = String(r["Warehouse Id"] || "").toUpperCase();
    return ft === "SELLER" || wh === "SELLER";
  });

  if (!sellerSales.length) {
    return [];
  }

  /* ===============================
     STEP 2: AGGREGATE SELLER SALES
     =============================== */

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

        // fields expected by UI
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

  if (!rows.length) {
    return [];
  }

  /* ===============================
     STEP 3: DRR CALCULATION
     =============================== */

  rows.forEach(r => {
    r.drr = r.saleQty / 30;
  });

  /* ===============================
     STEP 4: UNIWARE STOCK MAP
     (MASTER STOCK SOURCE)
     =============================== */

  const uniwareStockMap = {};

  finalData.forEach(r => {
    if (!r.uniwareSku) return;
    if (uniwareStockMap[r.uniwareSku] == null) {
      uniwareStockMap[r.uniwareSku] = r.uniwareStockQty || 0;
    }
  });

  /* ===============================
     STEP 5: 40% CAP + 45D TARGET
     =============================== */

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

    r.remark = "Seller sale replenishment planned (45D target, 40% cap)";
  });

  return rows;
}
