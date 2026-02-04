/* =========================================================
   APP.JS – Orchestrator
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("App started");

    const normalizedData = await ingestAllSheets();
    console.log("Ingestion done");

    const finalData = runCalculations(normalizedData);
    console.log("Calculation done", finalData);

    window.APP_DATA = finalData;

  } catch (e) {
    console.error("App error:", e);
  }
});
