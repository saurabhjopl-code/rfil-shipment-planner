/**
 * PAGE SHELL
 * -----------------------------
 * RESPONSIBILITY:
 * - Define page STRUCTURE only
 * - No styling
 * - No data logic
 * - No rendering logic
 *
 * THIS FILE IS NOW LOCKED
 */

export function renderPageShell(type) {
  const page = document.createElement("div");
  page.className = "page";

  /* ============================
     SELLER PAGE
  ============================ */
  if (type === "SELLER") {
    page.innerHTML = `
      <div class="section">
        <h3>Seller Shipment Summary</h3>
        <div class="empty-state">No data available</div>
      </div>

      <div class="sectionz2section">
        <h3>Seller Shipment Report</h3>
        <div class="empty-state">No data available</div>
      </div>
    `;
    return page;
  }

  /* ============================
     MP PAGES (AMAZON / FLIPKART / MYNTRA)
  ============================ */
  page.innerHTML = `
    <!-- ROW 1 -->
    <div class="summary-grid">
      <div class="section">
        <h3>FC Wise Stock</h3>
        <div class="empty-state">No data</div>
      </div>

      <div class="section">
        <h3>FC Wise Sale | DRR | Stock Cover</h3>
        <div class="empty-state">No data</div>
      </div>
    </div>

    <!-- ROW 2 -->
    <div class="summary-grid">
      <div class="section">
        <h3>MP Wise Top 10 SKUs</h3>
        <div class="empty-state">No data</div>
      </div>

      <div class="section">
        <h3>MP Wise Top 10 Styles</h3>
        <div class="empty-state">No data</div>
      </div>
    </div>

    <!-- ROW 3 -->
    <div class="section">
      <h3>Shipment & Recall Summary</h3>
      <div class="empty-state">No data</div>
    </div>

    <!-- ROW 4 -->
    <div class="section">
      <h3>Shipment Report</h3>
      <div class="empty-state">No data</div>
    </div>
  `;

  return page;
}
