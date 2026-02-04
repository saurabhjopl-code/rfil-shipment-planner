/* =========================================================
   CALC.JS – Shipment & Recall Logic Engine
   STEP 1: Closed Style Override
   STEP 2: Demand Weight (DW) Calculation
   ========================================================= */

function runCalculations(normalizedData) {
  console.log("Calculation engine started");

  // Deep clone to avoid mutating ingestion output
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
     STEP 2: DEMAND WEIGHT (DW) CALCULATION
     ===================================================== */

  // ---- 2.1 Total sale per Uniware SKU (all MPs, FC + SELLER)
  const totalSaleByUniware = {};
  data.forEach(r => {
    if (r.isClosedStyle) return;
    totalSaleByUniware[r.uniwareSku] =
      (totalSaleByUniware[r.uniwareSku] || 0) + r.totalSale30d;
  });

  // ---- 2.2 MP-wise sale per Uniware SKU
  const mpSaleByUniware = {};
  data.forEach(r => {
    if (r.isClosedStyle) return;
    const key = `${r.uniwareSku}|${r.mp}`;
    mpSaleByUniware[key] =
      (mpSaleByUniware[key] || 0) + r.totalSale30d;
  });

  // ---- 2.3 FC-wise sale per Uniware SKU (FC only, no SELLER)
  const fcSaleByUniware = {};
  data.forEach(r => {
    if (r.isClosedStyle) return;
    const key = `${r.uniwareSku}|${r.mp}|${r.warehouseId}`;
    fcSaleByUniware[key] =
      (fcSaleByUniware[key] || 0) + r.sale30dFc;
  });

  // ---- 2.4 Assign DWs to each row
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

    // MP-wise DW
    r.mpDw = totalSaleUW > 0 ? mpSale / totalSaleUW : 0;

    // FC-wise DW (inside MP)
    r.fcDw = mpSale > 0 ? fcSale / mpSale : 0;

    // Final SKU DW (used later for allocation)
    r.finalSkuDw = r.mpDw * r.fcDw;
  });

  console.log("Step 2 (Demand Weight) applied");
  return data;
}
