/* =========================================================
   app.js – FINAL CRASH-PROOF ORCHESTRATOR (FULL REPLACE)
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

    if (!Array.isArray(FINAL_DATA) || FINAL_DATA.length === 0) {
      throw new Error("No data returned after calculation");
    }

    renderSummary();
    buildMPTabs();

  } catch (err) {
    console.error("APP INIT FAILED:", err);

    document.querySelector(".container").innerHTML = `
      <div class="card" style="padding:24px">
        <h2 style="color:#dc2626">Data Load Failed</h2>
        <p style="margin-top:8px;color:#475569">
          The app could not load Google Sheet data.
        </p>
        <pre style="margin-top:12px;font-size:12px;color:#991b1b">
${err.message}
        </pre>
        <p style="margin-top:12px">
          Open <b>DevTools → Console</b> to see which sheet failed.
        </p>
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

  if (!mps.length) {
    container.innerHTML = `<span style="color:#64748b">No MP found</span>`;
    return;
  }

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
        <td>${fmt(r.stockCover,1)}</td>
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
