/* =========================================================
   calc.js – FINAL CALCULATION ENGINE (FULL FILE)
   ========================================================= */

function runCalculations(normalizedData) {
  const data = JSON.parse(JSON.stringify(normalizedData));

  /* ===============================
     STEP 1: CLOSED STYLE OVERRIDE
     =============================== */
  data.forEach(r => {
    r.shipmentQty = 0;
    r.recallQty = 0;
    r.requiredShipmentQty = 0;
    r.remark = "";
    if (r.isClosedStyle) {
      r.actionType = "CLOSED_RECALL";
      r.recallQty = r.fcStockQty || 0;
    }
  });

  /* ===============================
     STEP 2: DEMAND WEIGHT
     =============================== */
  const totalSaleUW = {};
  const mpSaleUW = {};
  const fcSaleUW = {};

  data.forEach(r => {
    if (r.isClosedStyle) return;

    totalSaleUW[r.uniwareSku] =
      (totalSaleUW[r.uniwareSku] || 0) + r.totalSale30d;

    mpSaleUW[`${r.uniwareSku}|${r.mp}`] =
      (mpSaleUW[`${r.uniwareSku}|${r.mp}`] || 0) + r.totalSale30d;

    fcSaleUW[`${r.uniwareSku}|${r.mp}|${r.warehouseId}`] =
      (fcSaleUW[`${r.uniwareSku}|${r.mp}|${r.warehouseId}`] || 0) +
      r.sale30dFc;
  });

  data.forEach(r => {
    if (r.isClosedStyle) {
      r.finalSkuDw = 0;
      return;
    }
    const t = totalSaleUW[r.uniwareSku] || 0;
    const m = mpSaleUW[`${r.uniwareSku}|${r.mp}`] || 0;
    const f = fcSaleUW[`${r.uniwareSku}|${r.mp}|${r.warehouseId}`] || 0;

    const mpDw = t > 0 ? m / t : 0;
    const fcDw = m > 0 ? f / m : 0;
    r.finalSkuDw = mpDw * fcDw;
  });

  /* ===============================
     STEP 3: 40% UNIWARE ALLOCATION
     =============================== */
  const allocUW = {};
  data.forEach(r => {
    if (r.isClosedStyle) return;
    if (!allocUW[r.uniwareSku]) {
      allocUW[r.uniwareSku] = (r.uniwareStockQty || 0) * 0.4;
    }
  });

  data.forEach(r => {
    r.allocatableQtyForRow = r.isClosedStyle
      ? 0
      : (allocUW[r.uniwareSku] || 0) * r.finalSkuDw;
  });

  /* =========================================================
     STEP 3.5: SELLER AS MP DERIVATION (NEW - ADDITIVE)
     ========================================================= */

  const SELLER_BEST_FCS = {
    "Amazon IN": ["BLR8", "HYD3", "BOM5", "CJB1", "DEL5"],
    "Myntra": ["Bangalore", "Mumbai", "Bilaspur"],
    "Flipkart": ["MALUR", "KOLKATA", "SANPKA", "HYDERABAD", "BHIWANDI"]
  };

  const sellerDerivedRows = [];

  data.forEach(r => {
    if (r.isClosedStyle) return;
    if (r.warehouseId !== "SELLER") return;
    if (!SELLER_BEST_FCS[r.mp]) return;

    const saleQty = r.sale30dFc || 0;
    if (saleQty <= 0) return;

    const sellerDRR = saleQty / 30;

    SELLER_BEST_FCS[r.mp].forEach(fc => {
      sellerDerivedRows.push({
        ...r,
        mp: "SELLER",
        originMp: r.mp,
        warehouseId: fc,
        sale30dFc: saleQty,
        drr: sellerDRR,
        fcStockQty: 0,
        stockCover: 0
      });
    });
  });

  /* Attach FC stock to SELLER MP rows */
  const fcStockIndex = {};
  data.forEach(r => {
    if (r.warehouseId !== "SELLER") {
      fcStockIndex[`${r.mp}|${r.warehouseId}|${r.sku}`] = r.fcStockQty || 0;
    }
  });

  sellerDerivedRows.forEach(r => {
    const key = `${r.originMp}|${r.warehouseId}|${r.sku}`;
    r.fcStockQty = fcStockIndex[key] || 0;
  });

  /* Merge SELLER MP rows into main dataset */
  data.push(...sellerDerivedRows);

  /* ===============================
     STEP 4: 45D / 60D LOGIC
     =============================== */
  data.forEach(r => {
    if (r.isClosedStyle) return;

    const drr = r.drr || 0;
    if (drr === 0) {
      r.actionType = "NONE";
      return;
    }

    const cover = r.fcStockQty / drr;
    r.stockCover = cover;

    if (cover > 60 && r.mp !== "SELLER") {
      r.actionType = "RECALL";
      r.recallQty = Math.floor(r.fcStockQty - drr * 60);
      return;
    }

    if (cover < 45) {
      r.actionType = "SHIP";
      r.requiredShipmentQty = Math.ceil(drr * 45 - r.fcStockQty);
    } else {
      r.actionType = "NONE";
    }
  });

  /* ===============================
     STEP 5: FC PRIORITY + FINAL SHIP
     =============================== */
  const byUW = {};
  data.forEach(r => {
    if (!byUW[r.uniwareSku]) byUW[r.uniwareSku] = [];
    byUW[r.uniwareSku].push(r);
  });

  Object.values(byUW).forEach(rows => {
    const shipRows = rows.filter(r => r.actionType === "SHIP");
    if (!shipRows.length) return;

    const maxDRR = Math.max(...shipRows.map(r => r.drr || 0));
    const maxDW = Math.max(...shipRows.map(r => r.finalSkuDw || 0));

    shipRows.forEach(r => {
      const drrScore = maxDRR ? r.drr / maxDRR : 0;
      const dwScore = maxDW ? r.finalSkuDw / maxDW : 0;
      r.priorityScore = Math.max(drrScore, dwScore);
    });

    shipRows.sort((a, b) => b.priorityScore - a.priorityScore);

    let remaining = allocUW[shipRows[0].uniwareSku] || 0;

    shipRows.forEach(r => {
      const finalQty = Math.min(
        remaining,
        r.allocatableQtyForRow || 0,
        r.requiredShipmentQty || 0
      );
      r.shipmentQty = Math.max(0, Math.floor(finalQty));
      remaining -= r.shipmentQty;
    });
  });

  /* ===============================
     STEP 6: REMARKS (FINAL)
     =============================== */
  data.forEach(r => {
    if (r.isClosedStyle)
      r.remark = "Style closed – full stock recall enforced";
    else if (r.actionType === "RECALL")
      r.remark = "Stock above 60 days cover – recall required";
    else if (r.actionType === "SHIP" && r.shipmentQty === 0)
      r.remark =
        "Shipment needed but Uniware stock exhausted or FC has lower priority";
    else if (r.actionType === "SHIP")
      r.remark = "Shipment allocated as per 45-day stock target";
    else if ((r.drr || 0) === 0)
      r.remark = "No recent sales – shipment not planned";
    else
      r.remark = "Stock within optimal range";
  });

  return data;
}
