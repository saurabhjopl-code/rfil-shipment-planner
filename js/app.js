/* =========================================================
   app.js – FINAL UI RENDERER (FULL FILE)
   ========================================================= */

let FINAL_DATA = [];
let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

function fmt(n, d = 2) {
  const x = Number(n);
  return isFinite(x) ? x.toFixed(d) : "-";
}

document.addEventListener("DOMContentLoaded", async () => {
  const normalized = await ingestAllSheets();
  FINAL_DATA = runCalculations(normalized);
  renderSummary();
  buildMPTabs();
});

/* ================= SUMMARY ================= */

function renderSummary() {
  const ship = FINAL_DATA.reduce((s, r) => s + (r.shipmentQty || 0), 0);
  const recall = FINAL_DATA.reduce((s, r) => s + (r.recallQty || 0), 0);

  document.getElementById("summary").innerHTML = `
    <div class="summary-card"><h3>Total Rows</h3><p>${FINAL_DATA.length}</p></div>
    <div class="summary-card"><h3>Shipment Qty</h3><p>${ship}</p></div>
    <div class="summary-card"><h3>Recall Qty</h3><p>${recall}</p></div>
    <div class="summary-card"><h3>Closed Rows</h3><p>${FINAL_DATA.filter(r=>r.isClosedStyle).length}</p></div>
  `;
}

/* ================= MP TABS ================= */

function buildMPTabs() {
  const mps = [...new Set(FINAL_DATA.map(r => r.mp))];
  const container = document.getElementById("mp-tabs");
  container.innerHTML = "";

  mps.forEach((mp, i) => {
    const b = document.createElement("button");
    b.className = "tab" + (i === 0 ? " active" : "");
    b.innerText = mp;
    b.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      b.classList.add("active");
      CURRENT_PAGE = 1;
      renderTable(mp);
    };
    container.appendChild(b);
    if (i === 0) {
      CURRENT_MP = mp;
      renderTable(mp);
    }
  });
}

/* ================= MP SUMMARY ================= */

function renderMPSummary(mp) {
  const rows = FINAL_DATA.filter(r => r.mp === mp);
  const map = {};

  rows.forEach(r => {
    if (!map[r.warehouseId]) {
      map[r.warehouseId] = { sku: new Set(), ship: 0, recall: 0 };
    }
    map[r.warehouseId].sku.add(r.sku);
    map[r.warehouseId].ship += r.shipmentQty || 0;
    map[r.warehouseId].recall += r.recallQty || 0;
  });

  let html = `
    <table>
      <thead>
        <tr>
          <th>FC</th>
          <th>SKU Count</th>
          <th>Shipment Qty</th>
          <th>Recall Qty</th>
        </tr>
      </thead><tbody>
  `;

  Object.entries(map).forEach(([fc, v]) => {
    html += `
      <tr>
        <td>${fc}</td>
        <td>${v.sku.size}</td>
        <td>${v.ship}</td>
        <td>${v.recall}</td>
      </tr>`;
  });

  html += "</tbody></table>";
  document.getElementById("mp-summary").innerHTML = html;
}

/* ================= MAIN TABLE ================= */

function renderTable(mp) {
  CURRENT_MP = mp;
  renderMPSummary(mp);

  const rows = FINAL_DATA.filter(r => r.mp === mp);
  const visible = rows.slice(0, CURRENT_PAGE * PAGE_SIZE);

  document.getElementById("table-title").innerText =
    `${mp} – FC Planning (${rows.length} rows, showing ${visible.length})`;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Style</th><th>SKU</th><th>FC</th><th>DRR</th>
          <th>FC Stock</th><th>Stock Cover</th>
          <th>Shipment</th><th>Recall</th><th>Action</th><th>Remarks</th>
        </tr>
      </thead><tbody>
  `;

  visible.forEach(r => {
    html += `
      <tr>
        <td>${r.styleId}</td>
        <td>${r.sku}</td>
        <td>${r.warehouseId}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty}</td>
        <td>${fmt(r.stockCover,1)}</td>
        <td>${r.shipmentQty}</td>
        <td>${r.recallQty}</td>
        <td>${r.actionType}</td>
        <td style="max-width:280px">${r.remark}</td>
      </tr>`;
  });

  html += "</tbody></table>";

  if (visible.length < rows.length) {
    html += `<div style="text-align:center;padding:12px">
      <button class="tab" onclick="loadMore()">Load more</button>
    </div>`;
  }

  document.getElementById("table-container").innerHTML = html;
}

function loadMore() {
  CURRENT_PAGE++;
  renderTable(CURRENT_MP);
}
