/* =========================================================
   app.js – V1.2.8 (FULL REPLACE)
   MP logic LOCKED, SELLER isolated, FC Summary fixed
   ========================================================= */

let FINAL_DATA = [];
let SELLER_DATA = [];

let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

const FILTERS = { sku:"", fc:"ALL", action:"ALL" };
let FC_SUMMARY_VISIBLE = false;

/* helpers */
function fmt(n,d=2){const x=Number(n);return isFinite(x)?x.toFixed(d):"-";}
function sum(arr,k){return arr.reduce((s,r)=>s+(+r[k]||0),0);}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    const normalized = await ingestAllSheets();

    FINAL_DATA = runCalculations(normalized);

    const sale30DRaw =
      normalized.sale30d ||
      normalized.sale30D ||
      normalized.Sale30D ||
      normalized.sheets?.Sale30D ||
      [];

    SELLER_DATA = buildSellerPlanning(FINAL_DATA, sale30DRaw);

    renderSummary();
    buildMPTabs();

  }catch(e){
    document.querySelector(".container").innerHTML =
      `<pre>${e.stack || e.message}</pre>`;
  }
});

/* ================= SUMMARY ================= */

function renderSummary(){
  document.getElementById("summary").innerHTML=`
    <div class="summary-card"><h3>Total Rows</h3><p>${FINAL_DATA.length}</p></div>
    <div class="summary-card"><h3>Shipment Qty</h3><p>${sum(FINAL_DATA,"shipmentQty")}</p></div>
    <div class="summary-card"><h3>Recall Qty</h3><p>${sum(FINAL_DATA,"recallQty")}</p></div>
    <div class="summary-card"><h3>Closed Rows</h3><p>${FINAL_DATA.filter(r=>r.isClosedStyle).length}</p></div>
  `;
}

/* ================= MP TABS ================= */

function buildMPTabs(){
  const c=document.getElementById("mp-tabs");
  c.innerHTML="";

  const mps=[...new Set(FINAL_DATA.map(r=>r.mp)), "SELLER"];

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

      if (FC_SUMMARY_VISIBLE && mp !== "SELLER") {
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
  FC_SUMMARY_VISIBLE = !FC_SUMMARY_VISIBLE;
  const card=document.getElementById("fc-summary-card");
  card.style.display = FC_SUMMARY_VISIBLE ? "block" : "none";

  if (FC_SUMMARY_VISIBLE && CURRENT_MP !== "SELLER") {
    renderMPSummary(CURRENT_MP);
  }
};

/* ================= TABLE ROUTER ================= */

function renderTable(mp){
  if(mp==="SELLER"){
    renderSellerTable();
  }else{
    renderMPTable(mp);
  }
}

/* ================= MP TABLE (UNCHANGED) ================= */

function renderMPTable(mp){
  let rows=FINAL_DATA.filter(r=>r.mp===mp)
    .sort((a,b)=>(b.sale30dFc||0)-(a.sale30dFc||0));

  rows=rows.filter(r=>{
    if(FILTERS.sku && !r.sku?.toLowerCase().includes(FILTERS.sku)) return false;
    if(FILTERS.fc!=="ALL" && r.warehouseId!==FILTERS.fc) return false;
    if(FILTERS.action!=="ALL" && r.actionType!==FILTERS.action) return false;
    return true;
  });

  let html=`
  <table>
    <thead>
      <tr>
        <th>Style</th><th>SKU</th><th>FC</th><th>Sale Qty</th>
        <th>DRR</th><th>FC Stock</th><th>Stock Cover</th>
        <th>Shipment Qty</th><th>Recall Qty</th><th>Action</th><th>Remarks</th>
      </tr>
    </thead><tbody>
  `;

  rows.slice(0,PAGE_SIZE).forEach(r=>{
    const cls=r.actionType==="SHIP"?"tag tag-ship":
              r.actionType==="RECALL"?"tag tag-recall":"tag tag-closed";
    html+=`
      <tr>
        <td>${r.styleId}</td>
        <td>${r.sku}</td>
        <td>${r.warehouseId}</td>
        <td>${r.sale30dFc||0}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty||0}</td>
        <td>${fmt(r.stockCover,1)}</td>
        <td>${r.shipmentQty||0}</td>
        <td>${r.recallQty||0}</td>
        <td><span class="${cls}">${r.actionType}</span></td>
        <td>${r.remark||""}</td>
      </tr>`;
  });

  html+="</tbody></table>";
  document.getElementById("table-container").innerHTML=html;
}

/* ================= SELLER TABLE ================= */

function renderSellerTable(){
  if(!SELLER_DATA.length){
    document.getElementById("table-container").innerHTML =
      "<div style='padding:16px'>No SELLER data available</div>";
    return;
  }

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

  SELLER_DATA.slice(0,PAGE_SIZE).forEach(r=>{
    html+=`
      <tr>
        <td>${r.styleId}</td>
        <td>${r.sku}</td>
        <td>${r.warehouseId}</td>
        <td>${r.saleQty}</td>
        <td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty}</td>
        <td>${fmt(r.stockCover,1)}</td>
        <td>${r.shipmentQty}</td>
        <td>${r.remark}</td>
      </tr>`;
  });

  html+="</tbody></table>";
  document.getElementById("table-container").innerHTML=html;
}
