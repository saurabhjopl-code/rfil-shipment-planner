let FINAL_DATA = [];
let CURRENT_MP = "Amazon";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Starting app...");

  const normalized = await ingestAllSheets();
  FINAL_DATA = runCalculations(normalized);

  console.log("TOTAL ROWS:", FINAL_DATA.length);

  // DEBUG: log unique MP values
  const mpSet = new Set(FINAL_DATA.map(r => (r.mp || "").toString().trim()));
  console.log("UNIQUE MP VALUES:", [...mpSet]);

  renderSummary();
  renderTable("Amazon");

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      CURRENT_PAGE = 1;
      renderTable(tab.dataset.mp);
    });
  });
});

/* ================= SUMMARY ================= */

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

/* ================= TABLE ================= */

function renderTable(mp) {
  CURRENT_MP = mp;

  // 🔥 TEMPORARY: DO NOT FILTER BY MP TEXT
  // This guarantees rows render
  const rows = FINAL_DATA.filter(r =>
    r.shipmentQty > 0 ||
    r.recallQty > 0 ||
    r.fcStockQty > 0
  );

  const visibleRows = rows.slice(0, CURRENT_PAGE * PAGE_SIZE);

  document.getElementById("table-title").innerText =
    `${mp} – FC Planning (${rows.length} rows, showing ${visibleRows.length})`;

  if (!rows.length) {
    document.getElementById("table-container").innerHTML =
      `<div style="padding:24px;color:#64748b">No rows to display</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>MP</th>
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

  visibleRows.forEach(r => {
    let tagClass = "tag-none";
    if (r.actionType === "SHIP") tagClass = "tag-ship";
    if (r.actionType === "RECALL") tagClass = "tag-recall";
    if (r.actionType === "CLOSED_RECALL") tagClass = "tag-closed";

    html += `
      <tr>
        <td>${r.mp || "-"}</td>
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

  html += `</tbody></table>`;

  if (visibleRows.length < rows.length) {
    html += `
      <div style="padding:16px;text-align:center">
        <button class="tab" onclick="loadMore()">Load more</button>
      </div>
    `;
  }

  document.getElementById("table-container").innerHTML = html;
}

function loadMore() {
  CURRENT_PAGE++;
  renderTable(CURRENT_MP);
}
