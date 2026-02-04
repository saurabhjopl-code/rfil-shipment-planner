/* =========================================================
   app.js – V1.1.1 HOTFIX (FULL REPLACE)
   Fix: Toggle FC Summary not working
   ========================================================= */

let FINAL_DATA = [];
let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

function fmt(n, d = 2) {
  const x = Number(n);
  return isFinite(x) ? x.toFixed(d) : "-";
}

/* ================= SAFE INIT ================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const normalized = await ingestAllSheets();
    FINAL_DATA = runCalculations(normalized);

    renderSummary();
    buildMPTabs();
  } catch (err) {
    console.error("APP INIT FAILED:", err);
    document.querySelector(".container").innerHTML = `
      <div class="card" style="padding:24px">
        <h2 style="color:#dc2626">Data Load Failed</h2>
        <pre style="margin-top:12px;font-size:12px;color:#991b1b">
${err.message}
        </pre>
      </div>
    `;
  }
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

/* ================= MP TABS ================= */

function buildMPTabs() {
  const container = document.getElementById("mp-tabs");
  container.innerHTML = "";

  const mps = [...new Set(FINAL_DATA.map(r => r.mp))].filter(Boolean);

  mps.forEach((mp, i) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (i === 0 ? " active" : "");
    btn.innerText = mp;

    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      CURRENT_PAGE = 1;
      renderTable(mp);
    };

    container.appendChild(btn);

    if (i === 0) {
      CURRENT_MP = mp;
      renderTable(mp);
    }
  });
}

/* ================= FC SUMMARY (FIXED) ================= */

/* 🔥 IMPORTANT: attach to window */
window.toggleFCSummary = function () {
  const card = document.getElementById("fc-summary-card");
  if (!card) return;

  if (card.style.display === "none" || card.style.display === "") {
    card.style.display = "block";
    renderMPSummary(CURRENT_MP);
  } else {
    card.style.display = "none";
  }
};

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
      </thead>
      <tbody>
  `;

  Object.entries(map).forEach(([fc, v]) => {
    html += `
      <tr>
        <td>${fc}</td>
        <td>${v.sku.size}</td>
        <td>${v.ship}</td>
        <td>${v.recall}</td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  document.getElementById("mp-summary").innerHTML = html;
}

/* ================= MAIN TABLE ================= */

function renderTable(mp) {
  CURRENT_MP = mp;

  const rows = FINAL_DATA.filter(r => r.mp === mp);
  const visible = rows.slice(0, CURRENT_PAGE * PAGE_SIZE);

  document.getElementById("table-title").innerText =
    `${mp} – FC Planning (${rows.length} rows, showing ${visible.length})`;

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
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
  `;

  visible.forEach(r => {
    html += `
      <tr>
        <td>${r.styleId || "-"}</td>
        <td>${r.sku || "-"}</td>
        <td>${r.warehouseId || "-"}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty ?? "-"}</td>
        <td>${fmt(r.stockCover, 1)}</td>
        <td>${r.shipmentQty || 0}</td>
        <td>${r.recallQty || 0}</td>
        <td>${r.actionType}</td>
        <td style="max-width:280px">${r.remark || ""}</td>
      </tr>
    `;
  });

  html += "</tbody></table>";

  if (visible.length < rows.length) {
    html += `
      <div style="text-align:center;padding:12px">
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
