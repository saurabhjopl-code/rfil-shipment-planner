/* =========================================================
   app.js – V1.2 (FULL REPLACE)
   Reporting & UI Enhancements ONLY
   ========================================================= */

let FINAL_DATA = [];
let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

/* -------- helpers -------- */
function fmt(n, d = 2) {
  const x = Number(n);
  return isFinite(x) ? x.toFixed(d) : "-";
}
function sum(arr, key) {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

/* -------- init (guarded) -------- */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const normalized = await ingestAllSheets();
    FINAL_DATA = runCalculations(normalized);
    renderSummary();
    buildMPTabs();
  } catch (e) {
    console.error(e);
    document.querySelector(".container").innerHTML = `
      <div class="card" style="padding:24px">
        <h2 style="color:#dc2626">Data Load Failed</h2>
        <pre style="margin-top:12px;font-size:12px;color:#991b1b">${e.message}</pre>
      </div>`;
  }
});

/* ================= SUMMARY ================= */

function renderSummary() {
  const ship = sum(FINAL_DATA, "shipmentQty");
  const recall = sum(FINAL_DATA, "recallQty");
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

/* ================= FC SUMMARY (TOGGLE) ================= */

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
      map[r.warehouseId] = { sku: new Set(), ship: 0, recall: 0, sale: 0, stock: 0 };
    }
    map[r.warehouseId].sku.add(r.sku);
    map[r.warehouseId].ship += r.shipmentQty || 0;
    map[r.warehouseId].recall += r.recallQty || 0;
    map[r.warehouseId].sale += r.sale30dFc || 0;
    map[r.warehouseId].stock += r.fcStockQty || 0;
  });

  let html = `
    <table>
      <thead>
        <tr>
          <th>FC</th>
          <th>SKU Count</th>
          <th>Total Sale Qty</th>
          <th>Total Stock</th>
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
        <td>${v.sale}</td>
        <td>${v.stock}</td>
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

  // base rows for MP
  let rows = FINAL_DATA.filter(r => r.mp === mp);

  // default sort: Sale Qty DESC
  rows = rows.sort((a, b) => (b.sale30dFc || 0) - (a.sale30dFc || 0));

  // derive filter values
  const fcs = [...new Set(rows.map(r => r.warehouseId))].filter(Boolean);
  const actions = ["ALL", "SHIP", "RECALL", "NONE", "CLOSED_RECALL"];

  // current filter state
  const skuVal = (document.getElementById("flt-sku")?.value || "").toLowerCase();
  const fcVal = document.getElementById("flt-fc")?.value || "ALL";
  const actVal = document.getElementById("flt-action")?.value || "ALL";

  // apply filters
  let filtered = rows.filter(r => {
    if (skuVal && !String(r.sku || "").toLowerCase().includes(skuVal)) return false;
    if (fcVal !== "ALL" && r.warehouseId !== fcVal) return false;
    if (actVal !== "ALL" && r.actionType !== actVal) return false;
    return true;
  });

  const visible = filtered.slice(0, CURRENT_PAGE * PAGE_SIZE);

  document.getElementById("table-title").innerText =
    `${mp} – FC Planning (${filtered.length} rows, showing ${visible.length})`;

  /* ----- table ----- */
  let html = `
    <table>
      <thead>
        <tr>
          <th>Style</th>
          <th>SKU</th>
          <th>FC</th>
          <th>Sale Qty</th>
          <th>DRR</th>
          <th>FC Stock</th>
          <th>Stock Cover</th>
          <th>Shipment Qty</th>
          <th>Recall Qty</th>
          <th>Action</th>
          <th>Remarks</th>
        </tr>
        <tr>
          <th></th>
          <th>
            <input id="flt-sku" placeholder="Search SKU"
              style="width:120px" oninput="CURRENT_PAGE=1;renderTable(CURRENT_MP)">
          </th>
          <th>
            <select id="flt-fc" onchange="CURRENT_PAGE=1;renderTable(CURRENT_MP)">
              <option>ALL</option>
              ${fcs.map(fc => `<option>${fc}</option>`).join("")}
            </select>
          </th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th>
            <select id="flt-action" onchange="CURRENT_PAGE=1;renderTable(CURRENT_MP)">
              ${actions.map(a => `<option>${a}</option>`).join("")}
            </select>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  visible.forEach(r => {
    let cls = "";
    if (r.actionType === "SHIP") cls = "tag tag-ship";
    if (r.actionType === "RECALL") cls = "tag tag-recall";
    if (r.actionType === "CLOSED_RECALL") cls = "tag tag-closed";

    html += `
      <tr>
        <td>${r.styleId || "-"}</td>
        <td>${r.sku || "-"}</td>
        <td>${r.warehouseId || "-"}</td>
        <td>${r.sale30dFc || 0}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty ?? "-"}</td>
        <td>${fmt(r.stockCover,1)}</td>
        <td>${r.shipmentQty || 0}</td>
        <td>${r.recallQty || 0}</td>
        <td><span class="${cls}">${r.actionType}</span></td>
        <td style="max-width:280px">${r.remark || ""}</td>
      </tr>`;
  });

  html += "</tbody></table>";

  if (visible.length < filtered.length) {
    html += `
      <div style="text-align:center;padding:12px">
        <button class="tab" onclick="loadMore()">Load more</button>
      </div>`;
  }

  document.getElementById("table-container").innerHTML = html;
}

function loadMore() {
  CURRENT_PAGE++;
  renderTable(CURRENT_MP);
}
