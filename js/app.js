/* =========================================================
   app.js – V1.2.3 (FULL REPLACE)
   Fixes:
   - Toggle FC Summary reliability
   - FC Summary auto-refresh on MP change
   ========================================================= */

let FINAL_DATA = [];
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

/* init */
document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    const normalized = await ingestAllSheets();
    FINAL_DATA = runCalculations(normalized);
    renderSummary();
    buildMPTabs();
  }catch(e){
    document.querySelector(".container").innerHTML=`<pre>${e.message}</pre>`;
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

  [...new Set(FINAL_DATA.map(r=>r.mp))].forEach((mp,i)=>{
    const b=document.createElement("button");
    b.className="tab"+(i===0?" active":"");
    b.innerText=mp;

    b.onclick=()=>{
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      b.classList.add("active");
      CURRENT_MP=mp;
      CURRENT_PAGE=1;

      renderTable(mp);

      /* 🔥 FIX: auto-refresh FC summary if visible */
      if(FC_SUMMARY_VISIBLE){
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

  if(FC_SUMMARY_VISIBLE){
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

  let rows=FINAL_DATA.filter(r=>r.mp===mp)
    .sort((a,b)=>(b.sale30dFc||0)-(a.sale30dFc||0));

  rows=rows.filter(r=>{
    if(FILTERS.sku && !r.sku?.toLowerCase().includes(FILTERS.sku)) return false;
    if(FILTERS.fc!=="ALL" && r.warehouseId!==FILTERS.fc) return false;
    if(FILTERS.action!=="ALL" && r.actionType!==FILTERS.action) return false;
    return true;
  });

  const fcs=[...new Set(FINAL_DATA.filter(r=>r.mp===mp).map(r=>r.warehouseId))];

  let html=`
  <table>
    <thead>
      <tr>
        <th>Style</th><th>SKU</th><th>FC</th><th>Sale Qty</th>
        <th>DRR</th><th>FC Stock</th><th>Stock Cover</th>
        <th>Shipment Qty</th><th>Recall Qty</th><th>Action</th><th>Remarks</th>
      </tr>
      <tr class="filter-row">
        <th></th>
        <th>
          <input class="filter-input" value="${FILTERS.sku}"
            placeholder="Search SKU"
            onkeydown="if(event.key==='Enter'){FILTERS.sku=this.value.toLowerCase();CURRENT_PAGE=1;renderTable(CURRENT_MP)}"
            onblur="FILTERS.sku=this.value.toLowerCase();CURRENT_PAGE=1;renderTable(CURRENT_MP)">
        </th>
        <th>
          <select class="filter-select"
            onchange="FILTERS.fc=this.value;CURRENT_PAGE=1;renderTable(CURRENT_MP)">
            <option>ALL</option>
            ${fcs.map(fc=>`<option ${FILTERS.fc===fc?"selected":""}>${fc}</option>`).join("")}
          </select>
        </th>
        <th colspan="6"></th>
        <th>
          <select class="filter-select"
            onchange="FILTERS.action=this.value;CURRENT_PAGE=1;renderTable(CURRENT_MP)">
            ${["ALL","SHIP","RECALL","NONE","CLOSED_RECALL"]
              .map(a=>`<option ${FILTERS.action===a?"selected":""}>${a}</option>`).join("")}
          </select>
        </th>
        <th></th>
      </tr>
    </thead><tbody>
  `;

  rows.slice(0,CURRENT_PAGE*PAGE_SIZE).forEach(r=>{
    const cls=r.actionType==="SHIP"?"tag tag-ship":r.actionType==="RECALL"?"tag tag-recall":"tag tag-closed";
    html+=`
      <tr>
        <td>${r.styleId}</td><td>${r.sku}</td><td>${r.warehouseId}</td>
        <td>${r.sale30dFc||0}</td><td>${fmt(r.drr)}</td>
        <td>${r.fcStockQty||0}</td><td>${fmt(r.stockCover,1)}</td>
        <td>${r.shipmentQty||0}</td><td>${r.recallQty||0}</td>
        <td><span class="${cls}">${r.actionType}</span></td>
        <td>${r.remark||""}</td>
      </tr>`;
  });

  html+="</tbody></table>";
  document.getElementById("table-container").innerHTML=html;
}
