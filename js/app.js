let FINAL_DATA = [];
let CURRENT_MP = "Amazon";

document.addEventListener("DOMContentLoaded", async () => {
  const normalized = await ingestAllSheets();
  FINAL_DATA = runCalculations(normalized);

  renderSummary();
  renderTable("Amazon");

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderTable(tab.dataset.mp);
    });
  });
});

/* SUMMARY */
function renderSummary() {
  const ship = FINAL_DATA.reduce((s, r) => s + (r.shipmentQty || 0), 0);
  const recall = FINAL_DATA.reduce((s, r) => s + (r.recallQty || 0), 0);
  const closed = FINAL_DATA.filter(r => r.isClosedStyle).length;

  document.getElementById("summary").innerHTML = `
    <div class="summary-card"><h3>Total Rows</h3><p>${FINAL_DATA.length}</p></div>
    <div class="summary-card"><h3>Shipment Qty</h3><p>${ship}</p></div>
    <div class="summary-card"><h3>Recall Qty</h3><p>${recall}</p></div>
    <div class="summary-card"><h3>Closed Rows</h3><p>${closed}</p></div>
  `;
}

/* TABLE */
function renderTable(mp) {
  document.getElementById("table-title").innerText = `${mp} – FC Planning`;

  const rows = FINAL_DATA.filter(r => r.mp === mp);

  let html = `
    <table>
      <thead>
        <tr>
          <th>Style</th>
          <th>SKU</th>
          <th>FC</th>
          <th>DRR</th>
          <th>FC Stock</th>
          <th>Stock Cover</th>
          <th>Shipment</th>
          <th>Recall</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach(r => {
    let tagClass = "tag-none";
    if (r.actionType === "SHIP") tagClass = "tag-ship";
    if (r.actionType === "RECALL") tagClass = "tag-recall";
    if (r.actionType === "CLOSED_RECALL") tagClass = "tag-closed";

    html += `
      <tr>
        <td>${r.styleId}</td>
        <td>${r.sku}</td>
        <td>${r.warehouseId}</td>
        <td>${r.drr.toFixed(2)}</td>
        <td>${r.fcStockQty}</td>
        <td>${r.stockCover === Infinity ? "∞" : r.stockCover.toFixed(1)}</td>
        <td>${r.shipmentQty || 0}</td>
        <td>${r.recallQty || 0}</td>
        <td><span class="tag ${tagClass}">${r.actionType}</span></td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  document.getElementById("table-container").innerHTML = html;
}
