let FINAL_DATA = [];
let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

/* ================= UTILS ================= */

function fmt(num, digits = 2) {
  const n = Number(num);
  if (!isFinite(n)) return "-";
  return n.toFixed(digits);
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", async () => {
  const normalized = await ingestAllSheets();
  FINAL_DATA = runCalculations(normalized);

  renderSummary();
  buildMPTabs();
});

/* ================= SUMMARY ================= */

function renderSummary() {
  const ship = FINAL_DATA.reduce((s, r) => s + (Number(r.shipmentQty) || 0), 0);
  const recall = FINAL_DATA.reduce((s, r) => s + (Number(r.recallQty) || 0), 0);
  const closed = FINAL_DATA.filter(r => r.isClosedStyle).length;

  document.getElementById("summary").innerHTML = `
    <div class="summary-card"><h3>Total Rows</h3><p>${FINAL_DATA.length}</p></div>
    <div class="summary-card"><h3>Shipment Qty</h3><p>${ship}</p></div>
    <div class="summary-card"><h3>Recall Qty</h3><p>${recall}</p></div>
    <div class="summary-card"><h3>Closed Rows</h3><p>${closed}</p></div>
  `;
}

/* ================= MP TABS ================= */

function buildMPTabs() {
  const container = document.getElementById("mp-tabs");
  container.innerHTML = "";

  const mps = [...new Set(FINAL_DATA.map(r => r.mp))].filter(Boolean);

  mps.forEach((mp, idx) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (idx === 0 ? " active" : "");
    btn.innerText = mp;

    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      CURRENT_PAGE = 1;
      renderTable(mp);
    };

    container.appendChild(btn);

    if (idx === 0) {
      CURRENT_MP = mp;
      renderTable(mp);
    }
  });
}

/* ================= TABLE ================= */

function renderTable(mp) {
  CURRENT_MP = mp;

  const rows = FINAL_DATA.filter(r => r.mp === mp);
  const visibleRows = rows.slice(0, CURRENT_PAGE * PAGE_SIZE);

  document.getElementById("table-title").innerText =
    `${mp} – FC Planning (${rows.length} rows, showing ${visibleRows.length})`;

  if (!rows.length) {
    document.getElementById("table-container").innerHTML =
      `<div style="padding:24px;color:#64748b">No data</div>`;
    return;
  }

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

  visibleRows.forEach(r => {
    let tag = "tag-none";
    if (r.actionType === "SHIP") tag = "tag-ship";
    if (r.actionType === "RECALL") tag = "tag-recall";
    if (r.actionType === "CLOSED_RECALL") tag = "tag-closed";

    html += `
      <tr>
        <td>${r.styleId || "-"}</td>
        <td>${r.sku || "-"}</td>
        <td>${r.warehouseId || "-"}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty ?? "-"}</td>
        <td>${r.stockCover === Infinity ? "∞" : fmt(r.stockCover, 1)}</td>
        <td>${r.shipmentQty || 0}</td>
        <td>${r.recallQty || 0}</td>
        <td><span class="tag ${tag}">${r.actionType}</span></td>
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
