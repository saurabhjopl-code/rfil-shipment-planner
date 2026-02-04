/* =========================================================
   CALC.JS – FINAL Shipment & Recall Logic Engine
   ========================================================= */

function runCalculations(normalizedData) {
  console.log("Calculation engine started");

  const data = JSON.parse(JSON.stringify(normalizedData));

  /* =====================================================
     STEP 1: COMPANY CLOSED OVERRIDE
     ===================================================== */
  data.forEach(r => {
    if (r.isClosedStyle) {
      r.actionType = "CLOSED_RECALL";
      r.recallQty = r.fcStockQty || 0;
      r.shipmentQty = 0;
    } else {
      r.actionType = "PENDING";
      r.recallQty = 0;
      r.shipmentQty = 0;
    }
  });

  /* =====================================================
     STEP 2: DEMAND WEIGHT (DW)
     ===================================================== */
  const totalSaleByUW = {};
  const mpSaleByUW = {};
  const fcSaleByUW = {};

  data.forEach(r => {
    if (r.isClosedStyle) return;

    totalSaleByUW[r.uniwareSku] =
      (totalSaleByUW[r.uniwareSku] || 0) + r.totalSale30d;

    mpSaleByUW[`${r.uniwareSku}|${r.mp}`] =
      (mpSaleByUW[`${r.uniwareSku}|${r.mp}`] || 0) + r.totalSale30d;

    fcSaleByUW[`${r.uniwareSku}|${r.mp}|${r.warehouseId}`] =
      (fcSaleByUW[`${r.uniwareSku}|${r.mp}|${r.warehouseId}`] || 0) +
      r.sale30dFc;
  });

  data.forEach(r => {
    if (r.isClosedStyle) {
      r.mpDw = r.fcDw = r.finalSkuDw = 0;
      return;
    }

    const totalUW = totalSaleByUW[r.uniwareSku] || 0;
    const mpSale = mpSaleByUW[`${r.uniwareSku}|${r.mp}`] || 0;
    const fcSale =
      fcSaleByUW[`${r.uniwareSku}|${r.mp}|${r.warehouseId}`] || 0;

    r.mpDw = totalUW > 0 ? mpSale / totalUW : 0;
    r.fcDw = mpSale > 0 ? fcSale / mpSale : 0;
    r.finalSkuDw = r.mpDw * r.fcDw;
  });

  /* =====================================================
     STEP C: 40% UNIWARE STOCK ALLOCATION
     ===================================================== */
  const allocatableByUW = {};

  data.forEach(r => {
    if (r.isClosedStyle) return;
    if (!allocatableByUW[r.uniwareSku]) {
      allocatableByUW[r.uniwareSku] =
        (r.uniwareStockQty || 0) * 0.4;
    }
  });

  data.forEach(r => {
    if (r.isClosedStyle) {
      r.allocatableQtyForRow = 0;
      return;
    }
    r.allocatableQtyForRow =
      (allocatableByUW[r.uniwareSku] || 0) *
      (r.finalSkuDw || 0);
  });

  /* =====================================================
     STEP E: 45D SHIPMENT & 60D RECALL NEED
     ===================================================== */
  data.forEach(r => {
    if (r.isClosedStyle) return;

    const drr = r.drr || 0;
    const fcStock = r.fcStockQty || 0;
    const stockCover = drr > 0 ? fcStock / drr : Infinity;
    r.stockCover = stockCover;

    if (stockCover > 60) {
      r.recallQty = Math.floor(fcStock - drr * 60);
      r.shipmentQty = 0;
      r.actionType = r.recallQty > 0 ? "RECALL" : "NONE";
      return;
    }

    if (stockCover < 45) {
      r.requiredShipmentQty = Math.max(
        0,
        Math.ceil(drr * 45 - fcStock)
      );
      r.actionType = r.requiredShipmentQty > 0 ? "SHIP" : "NONE";
      return;
    }

    r.actionType = "NONE";
    r.requiredShipmentQty = 0;
  });

  /* =====================================================
     STEP D: FC PRIORITY OVERRIDE & FINAL SHIPMENT
     ===================================================== */

  // Group rows by Uniware SKU
  const rowsByUW = {};
  data.forEach(r => {
    if (!rowsByUW[r.uniwareSku]) rowsByUW[r.uniwareSku] = [];
    rowsByUW[r.uniwareSku].push(r);
  });

  Object.values(rowsByUW).forEach(rows => {
    // Only rows eligible for shipment
    const shipRows = rows.filter(
      r => r.actionType === "SHIP" && !r.isClosedStyle
    );

    if (!shipRows.length) return;

    // Normalize DRR & DW
    const maxDRR = Math.max(...shipRows.map(r => r.drr || 0), 0);
    const maxDW = Math.max(...shipRows.map(r => r.finalSkuDw || 0), 0);

    shipRows.forEach(r => {
      r.normFcDrr = maxDRR > 0 ? r.drr / maxDRR : 0;
      r.normFcDw = maxDW > 0 ? r.finalSkuDw / maxDW : 0;
      r.fcPriorityScore = Math.max(r.normFcDrr, r.normFcDw);
    });

    // Sort by priority DESC
    shipRows.sort((a, b) => b.fcPriorityScore - a.fcPriorityScore);

    let remainingAlloc = allocatableByUW[shipRows[0].uniwareSku] || 0;

    shipRows.forEach(r => {
      if (remainingAlloc <= 0) {
        r.shipmentQty = 0;
        return;
      }

      const maxAllowed = r.allocatableQtyForRow || 0;
      const need = r.requiredShipmentQty || 0;

      const finalShip = Math.min(
        remainingAlloc,
        maxAllowed,
        need
      );

      r.shipmentQty = Math.max(0, Math.floor(finalShip));
      remainingAlloc -= r.shipmentQty;
    });
  });

  console.log("STEP D applied – Final shipment quantities ready");
  return data;
}
