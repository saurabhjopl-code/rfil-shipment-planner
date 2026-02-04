/* =========================================================
   calc.js – V1.3.1 (FULL REPLACE HOTFIX)
   Fixes allocation break while keeping SELLER logic
   ========================================================= */

const FC_ALLOCATION_RATIO = 0.40;

const BEST_FC_BY_MP = {
  "Amazon IN": ["BLR8","HYD3","BOM5","CJB1","DEL5"],
  "Myntra": ["Bangalore","Mumbai","Bilaspur"],
  "Flipkart": ["MALUR","KOLKATA","SANPKA","HYDERABAD","BHIWANDI"]
};

function runCalculations(rows) {

  const data = rows.map(r => ({ ...r }));

  data.forEach(r => {
    r.shipmentQty = 0;
    r.recallQty = 0;
    r.actionType = "NONE";
    r.shipmentSource = "";
  });

  const groups = {};
  const k = (m,s,sku)=>`${m}||${s}||${sku}`;

  data.forEach(r=>{
    groups[k(r.mp,r.styleId,r.sku)] ??= [];
    groups[k(r.mp,r.styleId,r.sku)].push(r);
  });

  Object.values(groups).forEach(group => {

    const ref = group[0];

    if (ref.isClosedStyle) {
      group.forEach(r=>{
        r.actionType="NONE";
        r.remark="Style closed – no action";
      });
      return;
    }

    let uniwareStock = ref.uniwareStockQty || 0;
    let fcPoolTotal = Math.floor(uniwareStock * FC_ALLOCATION_RATIO);
    let fcPoolRemaining = fcPoolTotal;

    const sellerRow = group.find(r=>r.warehouseId==="SELLER");
    const fcRows = group.filter(r=>r.warehouseId!=="SELLER");

    const sellerSale = sellerRow?.sale30dFc || 0;
    const fcSale = fcRows.reduce((s,r)=>s+(r.sale30dFc||0),0);

    /* ================= FC RECALL ================= */

    fcRows.forEach(r=>{
      if (r.stockCover > 60 && r.drr > 0) {
        const recall = Math.max(0, Math.floor(r.fcStockQty - r.drr * 60));
        if (recall > 0) {
          r.recallQty += recall;
          r.actionType = "RECALL";
          r.shipmentSource = "FC_RECALL";
          uniwareStock += recall;
        }
      }
    });

    /* ================= FC REPLENISH ================= */

    fcRows.forEach(r=>{
      if (r.stockCover < 45 && r.drr > 0 && fcPoolRemaining > 0) {
        const need = Math.max(0, Math.floor((45 - r.stockCover) * r.drr));
        const ship = Math.min(need, fcPoolRemaining);
        if (ship > 0) {
          r.shipmentQty += ship;
          if (r.actionType === "NONE") r.actionType = "SHIP";
          r.shipmentSource ||= "FC_REPLENISHMENT";
          fcPoolRemaining -= ship;
          uniwareStock -= ship;
        }
      }
    });

    /* ================= SELLER LOGIC ================= */

    if (sellerSale <= 0 || fcPoolRemaining <= 0) {
      // no seller processing
    }

    /* ---------- BRANCH A: FC SALE EXISTS ---------- */
    else if (fcSale > 0) {

      const sellerDW = sellerSale / (sellerSale + fcSale);

      let sellerAlloc = Math.floor(
        fcPoolRemaining *
        ref.dwMp *
        ref.dwStyle *
        ref.dwSku *
        sellerDW
      );

      sellerAlloc = Math.min(sellerAlloc, fcPoolRemaining, uniwareStock);
      if (sellerAlloc > 0) {

        const strengths = fcRows.map(r=>({
          r,
          w: Math.max(r.drr||0, r.dwFc||0)
        })).filter(x=>x.w>0);

        const totalW = strengths.reduce((s,x)=>s+x.w,0);

        let rem = sellerAlloc;

        strengths.forEach((x,i)=>{
          const qty = (i===strengths.length-1)
            ? rem
            : Math.floor(sellerAlloc * x.w / totalW);

          if (qty > 0) {
            x.r.shipmentQty += qty;
            if (x.r.actionType === "NONE") x.r.actionType = "SHIP";
            x.r.shipmentSource ||= "SELLER_REBALANCE";
            rem -= qty;
          }
        });

        fcPoolRemaining -= sellerAlloc;
        uniwareStock -= sellerAlloc;
      }
    }

    /* ---------- BRANCH B: NO FC SALE (BOOTSTRAP) ---------- */
    else {

      const best = BEST_FC_BY_MP[ref.mp] || [];
      const targets = fcRows.filter(r=>best.includes(r.warehouseId));
      if (!targets.length) return;

      let sellerAlloc = Math.floor(
        fcPoolRemaining *
        ref.dwMp *
        ref.dwStyle *
        ref.dwSku
      );

      sellerAlloc = Math.min(sellerAlloc, fcPoolRemaining, uniwareStock);
      if (sellerAlloc <= 0) return;

      const base = Math.floor(sellerAlloc / targets.length);
      let rem = sellerAlloc % targets.length;

      targets.forEach(r=>{
        let qty = base;
        if (rem > 0) { qty++; rem--; }
        if (qty > 0) {
          r.shipmentQty += qty;
          if (r.actionType === "NONE") r.actionType = "SHIP";
          r.shipmentSource ||= "SELLER_BOOTSTRAP_BEST_FC";
        }
      });

      fcPoolRemaining -= sellerAlloc;
      uniwareStock -= sellerAlloc;
    }

  });

  /* ================= FINAL REMARKS ================= */

  data.forEach(r=>{
    if (r.actionType==="RECALL") {
      r.remark="Stock above 60 days – recall";
    } else if (r.shipmentSource==="SELLER_REBALANCE") {
      r.remark="Seller demand redistributed to FCs";
    } else if (r.shipmentSource==="SELLER_BOOTSTRAP_BEST_FC") {
      r.remark="Bootstrap FC allocation (no FC sale history)";
    } else if (r.shipmentSource==="FC_REPLENISHMENT") {
      r.remark="Shipment allocated as per 45-day stock target";
    } else {
      r.remark="No action required";
    }
  });

  return data;
}
