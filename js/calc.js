/* =========================================================
   CALC.JS – Shipment & Recall Logic Engine
   STEP 1: Closed Style Override
   STEP 2: Demand Weight (DW)
   STEP C: 40% Uniware Stock Allocation
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

  console.log("Step 2 (DW) applied");

  /* =====================================================
     STEP C: 40% UNIWARE STOCK ALLOCATION
     ===================================================== */

  // ---- 3.1 Allocatable stock per Uniware SKU
  const allocatableByUniware = {};

  data.forEach(r => {
    if (r.isClosedStyle) return;

    if (!allocatableByUniware[r.uniwareSku]) {
      allocatableByUniware[r.uniwareSku] =
        (r.uniwareStockQty || 0) * 0.4;
    }
  });

  // ---- 3.2 Allocate using FINAL_SKU_DW
  data.forEach(r => {
    if (r.isClosedStyle) {
      r.allocatableQtyForRow = 0;
      return;
    }

    const allocatableUW =
      allocatableByUniware[r.uniwareSku] || 0;

    r.allocatableQtyForRow =
      allocatableUW * (r.finalSkuDw || 0);
  });

  console.log("Step C (40% Uniware allocation) applied");
  return data;
}
