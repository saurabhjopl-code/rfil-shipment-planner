let FINAL_DATA = [];
let CURRENT_MP = "Amazon";

document.addEventListener("DOMContentLoaded", async () => {
  const normalized = await ingestAllSheets();
  FINAL_DATA = runCalculations(normalized);

  renderSummary();
  renderTable("Amazon");
});

/* ================= SUMMARY ================= */

function renderSummary() {
  const totalShip = FINAL_DATA.reduce((s, r) => s + (r.shipmentQty || 0), 0);
  const totalRecall = FINAL_DATA.reduce((s, r) => s + (r.recallQty || 0), 0);
  const closedCount = FINAL_DATA.filter(r => r.isClosedStyle).length;

  document.getElementById("summary").innerHTML = `
    <div class="summary-item">Total Rows<br><b>${FINAL_DATA.length}</b></div>
    <div class="summary-item">Shipment Qty<br><b>${totalShip}</b></div>
    <div class="summary-item">Recall Qty<br><b>${totalRecall}</b></div>
    <div class="summary-item">Closed Rows<br><b>${closedCount}</b></div>
  `;
}

/* ================= TABLE ================= */

function showMP(mp) {
  CURRENT_MP = mp;
  renderTable(mp);
}

function renderTable(mp) {
  const rows = FINAL_DATA.filter(r => r.mp === mp);

  let html = `
    <table>
      <thead>
        <tr>
          <th>Style ID</th>
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
    html += `
      <tr class="action-${r.actionType}">
        <td>${r.styleId}</td>
        <td>${r.sku}</td>
        <td>${r.warehouseId}</td>
        <td>${r.drr.toFixed(2)}</td>
        <td>${r.fcStockQty}</td>
        <td>${r.stockCover === Infinity ? "∞" : r.stockCover.toFixed(1)}</td>
        <td>${r.shipmentQty || 0}</td>
        <td>${r.recallQty || 0}</td>
        <td>${r.actionType}</td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  document.getElementById("table-container").innerHTML = html;
}
