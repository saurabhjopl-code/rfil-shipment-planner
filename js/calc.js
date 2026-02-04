/* =========================================================
   CALC.JS – Shipment & Recall Logic Engine
   ========================================================= */

function runCalculations(normalizedData) {
  console.log("Starting calculation engine...");

  // Clone to avoid mutation
  const data = JSON.parse(JSON.stringify(normalizedData));

  // 🚧 STEP ORDER (we will fill one by one)
  // 1. Closed-style override
  // 2. Demand Weight calculation
  // 3. Uniware 40% allocation
  // 4. FC priority override
  // 5. 45D shipment / 60D recall

  return data;
}

