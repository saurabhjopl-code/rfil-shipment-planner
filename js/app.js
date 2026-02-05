/* =========================================================
   app.js – V1.2.5 (FULL REPLACE)
   FIX: SELLER data wiring from Sale 30D
   ========================================================= */

let FINAL_DATA = [];
let SELLER_DATA = [];

let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

/* filter state */
const FILTERS = { sku:"", fc:"ALL", action:"ALL" };

/* FC Summary state */
let FC_SUMMARY_VISIBLE = false;

/* helpers */
function fmt(n,d=2){const x=Number(n);return isFinite(x)?x.toFixed(d):"-";}
function sum(arr,k){return arr.reduce((s,r)=>s+(+r[k]||0),0);}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    const normalized = await ingestAllSheets();

    /* ===============================
       FC PLANNING (UNCHANGED)
       =============================== */
    FINAL_DATA = runCalculations(normalized);

    /* ===============================
       🔥 SELLER PLANNING (FIXED)
       =============================== */

    // 🔒 Explicitly extract Sale 30D sheet
    const sale30DRaw =
      normalized.sale30d ||
      normalized.sale30D ||
      normalized.Sale30D ||
      normalized.sheets?.Sale30D ||
      [];

    SELLER_DATA = buildSellerPlanning(
      FINAL_DATA,
      sale30DRaw
    );

    renderSummary();
    buildMPTabs();

  }catch(e){
    document.querySelector(".container").innerHTML=`<pre>${e.stack || e.message}</pre>`;
  }
});

/* ================= SUMMARY ================= */

function renderSummary(){
  document.getElementById("summary").innerHTML=`
    <div class="summary-card"><h3>Total Rows</h3><p>${FINAL_DATA.length + SELLER_DATA.length}</p></div>
    <div class="summary-card"><h3>Shipment Qty</h3><p>${sum(FINAL_DATA,"shipmentQty")}</p></div>
    <div class="summary-card"><h3>Recall Qty</h3><p>${sum(FINAL_DATA,"recallQty")}</p></div>
    <div class="summary-card"><h3>Closed Rows</h3><p>${FINAL_DATA.filter(r=>r.isClosedStyle).length}</p></div>
  `;
}

/* ================= MP TABS ================= */

function buildMPTabs(){
  const c=document.getElementById("mp-tabs");
  c.innerHTML="";

  const baseMPs = [...new Set(FINAL_DATA.map(r=>r.mp))];
  const mps = [...baseMPs, "SELLER"];

  mps.forEach((mp,i)=>{
    const b=document.createElement("button");
    b.className="tab"+(i===0?" active":"");
    b.innerText=mp;

    b.onclick=()=>{
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      b.classList.add("active");
      CURRENT_MP=mp;
      CURRENT_PAGE=1;

      renderTable(mp);

      if(FC_SUMMARY_VISIBLE && mp!=="SELLER"){
        renderMPSummary(mp);
      }
    };

    c.appendChild(b);

    if(i===0){
      CURRENT_MP=mp;
      renderTable(mp);
    }
  });
}

/* ================= FC SUMMARY ================= */

window.toggleFCSummary = function(){
  const card=document.getElementById("fc-summary-card");

  FC_SUMMARY_VISIBLE = !FC_SUMMARY_VISIBLE;
  card.style.display = FC_SUMMARY_VISIBLE ? "block" : "none";

  if(FC_SUMMARY_VISIBLE && CURRENT_MP!=="SELLER"){
    renderMPSummary(CURRENT_MP);
  }
};

function renderMPSummary(mp){
  const rows=FINAL_DATA.filter(r=>r.mp===mp);
  const map={};

  rows.forEach(r=>{
    map[r.warehouseId] ??= {sku:new Set(),sale:0,stock:0,ship:0,recall:0};
    map[r.warehouseId].sku.add(r.sku);
    map[r.warehouseId].sale+=r.sale30dFc||0;
    map[r.warehouseId].stock+=r.fcStockQty||0;
    map[r.warehouseId].ship+=r.shipmentQty||0;
    map[r.warehouseId].recall+=r.recallQty||0;
  });

  let gt={sku:0,sale:0,stock:0,ship:0,recall:0};

  let html=`
    <table>
      <thead>
        <tr>
          <th>FC</th><th>SKU Count</th><th>Total Sale</th>
          <th>Total Stock</th><th>Shipment Qty</th><th>Recall Qty</th>
        </tr>
      </thead><tbody>
  `;

  Object.entries(map).forEach(([fc,v])=>{
    html+=`
      <tr>
        <td>${fc}</td>
        <td>${v.sku.size}</td>
        <td>${v.sale}</td>
        <td>${v.stock}</td>
        <td>${v.ship}</td>
        <td>${v.recall}</td>
      </tr>`;
    gt.sku+=v.sku.size; gt.sale+=v.sale; gt.stock+=v.stock;
    gt.ship+=v.ship; gt.recall+=v.recall;
  });

  html+=`
    <tr style="font-weight:600;background:#f8fafc">
      <td>GRAND TOTAL</td>
      <td>${gt.sku}</td>
      <td>${gt.sale}</td>
      <td>${gt.stock}</td>
      <td>${gt.ship}</td>
      <td>${gt.recall}</td>
    </tr>
  </tbody></table>`;

  document.getElementById("mp-summary").innerHTML=html;
}

/* ================= MAIN TABLE ================= */

function renderTable(mp){
  CURRENT_MP=mp;

  const source =
    mp==="SELLER" ? SELLER_DATA : FINAL_DATA.filter(r=>r.mp===mp);

  let rows=[...source].sort(
    (a,b)=>(b.saleQty||b.sale30dFc||0)-(a.saleQty||a.sale30dFc||0)
  );

  const fcs=[...new Set(source.map(r=>r.warehouseId))];

  let html=`
  <table>
    <thead>
      <tr>
        <th>Style</th><th>SKU</th><th>FC</th><th>Sale Qty</th>
        <th>DRR</th><th>FC Stock</th><th>Stock Cover</th>
        <th>Shipment Qty</th><th>Remarks</th>
      </tr>
    </thead><tbody>
  `;

  rows.slice(0,CURRENT_PAGE*PAGE_SIZE).forEach(r=>{
    html+=`
      <tr>
        <td>${r.styleId||""}</td>
        <td>${r.sku||""}</td>
        <td>${r.warehouseId}</td>
        <td>${r.saleQty||r.sale30dFc||0}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty||0}</td>
        <td>${fmt(r.stockCover,1)}</td>
        <td>${r.shipmentQty||0}</td>
        <td>${r.remark||"SELLER → FC replenishment planning"}</td>
      </tr>`;
  });

  html+="</tbody></table>";
  document.getElementById("table-container").innerHTML=html;
}
