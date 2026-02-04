/* =========================================================
   CALC.JS – Shipment & Recall Logic Engine
   STEP 1: Closed Style Override
   STEP 2: Demand Weight (DW)
   STEP C: 40% Uniware Allocation
   STEP E: 45D Shipment & 60D Recall
   ========================================================= */

function runCalculations(normalizedData) {
  console.log("Calculation engine started");

  // Deep clone to avoid mutation
  const data = JSON.parse(JSON.stringify(normalizedData));

  /* =====================================================
     STEP 1: COMPANY CLOSED OVERRIDE
     ===================================================== */
  data.forEach(row => {
    if (row.isClosedStyle) {
      row.actionType = "CLOSED_RECALL";
      row.recallQty = row.fcStockQty || 0;
      row.shipmentQty = 0;
    } else {
      row.actionType = "PENDING";
      row.recallQty = 0;
      row.shipmentQty = 0;
    }
  });

  /* =====================================================
     STEP 2: DEMAND WEIGHT (DW)
     ===================================================== */

  const totalSaleByUniware = {};
  const mpSaleByUniware = {};
  const fcSaleByUniware = {};

  data.forEach(r => {
    if (r.isClosedStyle) return;

    totalSaleByUniware[r.uniwareSku] =
      (totalSaleByUniware[r.uniwareSku] || 0) + r.totalSale30d;

    const mpKey = `${r.uniwareSku}|${r.mp}`;
    mpSaleByUniware[mpKey] =
      (mpSaleByUniware[mpKey] || 0) + r.totalSale30d;

    const fcKey = `${r.uniwareSku}|${r.mp}|${r.warehouseId}`;
    fcSaleByUniware[fcKey] =
      (fcSaleByUniware[fcKey] || 0) + r.sale30dFc;
  });

  data.forEach(r => {
    if (r.isClosedStyle) {
      r.mpDw = 0;
      r.fcDw = 0;
      r.finalSkuDw = 0;
      return;
    }

    const totalSaleUW = totalSaleByUniware[r.uniwareSku] || 0;
    const mpSale =
      mpSaleByUniware[`${r.uniwareSku}|${r.mp}`] || 0;
    const fcSale =
      fcSaleByUniware[
        `${r.uniwareSku}|${r.mp}|${r.warehouseId}`
      ] || 0;

    r.mpDw = totalSaleUW > 0 ? mpSale / totalSaleUW : 0;
    r.fcDw = mpSale > 0 ? fcSale / mpSale : 0;
    r.finalSkuDw = r.mpDw * r.fcDw;
  });

  /* =====================================================
     STEP C: 40% UNIWARE STOCK ALLOCATION
     ===================================================== */

  const allocatableByUniware = {};

  data.forEach(r => {
    if (r.isClosedStyle) return;
    if (!allocatableByUniware[r.uniwareSku]) {
      allocatableByUniware[r.uniwareSku] =
        (r.uniwareStockQty || 0) * 0.4;
    }
  });

  data.forEach(r => {
    if (r.isClosedStyle) {
      r.allocatableQtyForRow = 0;
      return;
    }

    r.allocatableQtyForRow =
      (allocatableByUniware[r.uniwareSku] || 0) *
      (r.finalSkuDw || 0);
  });

  /* =====================================================
     STEP E: 45D SHIPMENT & 60D RECALL
     ===================================================== */

  data.forEach(r => {
    if (r.isClosedStyle) return;

    const drr = r.drr || 0;
    const fcStock = r.fcStockQty || 0;

    let stockCover =
      drr > 0 ? fcStock / drr : Infinity;

    r.stockCover = stockCover;

    // ---- RECALL (Priority)
    if (stockCover > 60) {
      const maxStock60 = drr * 60;
      r.recallQty = Math.max(
        0,
        Math.floor(fcStock - maxStock60)
      );

      r.shipmentQty = 0;
      r.actionType = r.recallQty > 0 ? "RECALL" : "NONE";
      return;
    }

    // ---- SHIPMENT
    if (stockCover < 45) {
      const targetStock45 = drr * 45;
      const requiredShipment =
        Math.ceil(targetStock45 - fcStock);

      r.shipmentQty = Math.max(0, requiredShipment);
      r.recallQty = 0;
      r.actionType = r.shipmentQty > 0 ? "SHIP" : "NONE";
      return;
    }

    // ---- NO ACTION
    r.shipmentQty = 0;
    r.recallQty = 0;
    r.actionType = "NONE";
  });

  console.log("Step E (45D / 60D logic) applied");
  return data;
}
