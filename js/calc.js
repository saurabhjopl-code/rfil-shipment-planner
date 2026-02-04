/* =========================================================
   CALC.JS – Shipment & Recall Logic Engine
   STEP 1: Closed Style Override
   ========================================================= */

function runCalculations(normalizedData) {
  console.log("Calculation engine started");

  // Deep clone to avoid mutating ingestion output
  const data = JSON.parse(JSON.stringify(normalizedData));

  data.forEach(row => {
    // -------------------------------
    // STEP 1: COMPANY CLOSED OVERRIDE
    // -------------------------------
    if (row.isClosedStyle) {
      row.actionType = "CLOSED_RECALL";

      // Recall full FC stock
      row.recallQty = row.fcStockQty || 0;

      // No shipment allowed
      row.shipmentQty = 0;

      // Skip all other logic for this row
      return;
    }

    // ---------------------------------
    // PLACEHOLDERS (NEXT STEPS)
    // ---------------------------------
    row.actionType = "PENDING";
    row.shipmentQty = 0;
    row.recallQty = 0;
  });

  console.log("Step 1 (Closed-style override) applied");
  return data;
}
