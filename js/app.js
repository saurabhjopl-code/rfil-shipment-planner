/* =========================================================
   app.js – V1.2.2 (FULL REPLACE)
   Fixes:
   - Header filter UX
   - SKU search usability
   ========================================================= */

let FINAL_DATA = [];
let CURRENT_MP = "";
let CURRENT_PAGE = 1;
const PAGE_SIZE = 200;

/* persistent filter state */
const FILTERS = { sku:"", fc:"ALL", action:"ALL" };

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

/* summary */
function renderSummary(){
  document.getElementById("summary").innerHTML=`
    <div class="summary-card"><h3>Total Rows</h3><p>${FINAL_DATA.length}</p></div>
    <div class="summary-card"><h3>Shipment Qty</h3><p>${sum(FINAL_DATA,"shipmentQty")}</p></div>
    <div class="summary-card"><h3>Recall Qty</h3><p>${sum(FINAL_DATA,"recallQty")}</p></div>
    <div class="summary-card"><h3>Closed Rows</h3><p>${FINAL_DATA.filter(r=>r.isClosedStyle).length}</p></div>
  `;
}

/* mp tabs */
function buildMPTabs(){
  const c=document.getElementById("mp-tabs"); c.innerHTML="";
  [...new Set(FINAL_DATA.map(r=>r.mp))].forEach((mp,i)=>{
    const b=document.createElement("button");
    b.className="tab"+(i===0?" active":"");
    b.innerText=mp;
    b.onclick=()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      b.classList.add("active"); CURRENT_PAGE=1; renderTable(mp);}
    c.appendChild(b);
    if(i===0){CURRENT_MP=mp; renderTable(mp);}
  });
}

/* main table */
function renderTable(mp){
  CURRENT_MP=mp;

  let rows = FINAL_DATA.filter(r=>r.mp===mp)
    .sort((a,b)=>(b.sale30dFc||0)-(a.sale30dFc||0));

  rows = rows.filter(r=>{
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
          <input class="filter-input" placeholder="Search SKU"
            value="${FILTERS.sku}"
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
    </thead>
    <tbody>
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
