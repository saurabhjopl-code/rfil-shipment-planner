/* =========================================================
   calc.js – V1.3 (FULL REPLACE)
   Adds SELLER → FC logic (Rebalance + Bootstrap)
   ========================================================= */

/* ---------- CONFIG ---------- */

const FC_ALLOCATION_RATIO = 0.40;

const BEST_FC_BY_MP = {
  "Amazon IN": ["BLR8","HYD3","BOM5","CJB1","DEL5"],
  "Myntra": ["Bangalore","Mumbai","Bilaspur"],
  "Flipkart": ["MALUR","KOLKATA","SANPKA","HYDERABAD","BHIWANDI"]
};

/* ---------- MAIN ENTRY ---------- */

function runCalculations(rows) {

  /* deep clone */
  const data = rows.map(r => ({ ...r }));

  /* init defaults */
  data.forEach(r => {
    r.shipmentQty = 0;
    r.recallQty = 0;
    r.actionType = "NONE";
    r.shipmentSource = "";
  });

  /* ===============================
     STEP 1: GROUP HELPERS
     =============================== */

  const byKey = {};
  const key = (mp, style, sku) => `${mp}||${style}||${sku}`;

  data.forEach(r => {
    const k = key(r.mp, r.styleId, r.sku);
    byKey[k] ??= [];
    byKey[k].push(r);
  });

  /* ===============================
     STEP 2: PROCESS EACH SKU GROUP
     =============================== */

  Object.values(byKey).forEach(group => {

    const sample = group[0];
    const mp = sample.mp;
    const styleId = sample.styleId;
    const sku = sample.sku;

    /* ---- Closed styles ---- */
    if (sample.isClosedStyle) {
      group.forEach(r => {
        r.actionType = "NONE";
        r.remark = "Style closed – no shipment";
      });
      return;
    }

    /* ---- Separate SELLER & FC rows ---- */
    const sellerRow = group.find(r => r.warehouseId === "SELLER");
    const fcRows = group.filter(r => r.warehouseId !== "SELLER");

    const sellerSale = sellerRow?.sale30dFc || 0;
    const fcSale = fcRows.reduce((s, r) => s + (r.sale30dFc || 0), 0);

    /* ---- Uniware stock & FC pool ---- */
    let uniwareStock = sample.uniwareStockQty || 0;
    let fcPool = Math.floor(uniwareStock * FC_ALLOCATION_RATIO);

    /* ===============================
       STEP 3: NORMAL FC REPLENISHMENT
       (existing logic – untouched)
       =============================== */

    fcRows.forEach(r => {
      if (r.stockCover > 60) {
        r.recallQty = Math.max(0, Math.floor(r.fcStockQty - (r.drr * 60)));
        if (r.recallQty > 0) {
          r.actionType = "RECALL";
          r.shipmentSource = "FC_RECALL";
          uniwareStock += r.recallQty;
        }
      }
    });

    fcRows.forEach(r => {
      if (r.stockCover < 45 && r.drr > 0) {
        const need = Math.max(0, Math.floor((45 - r.stockCover) * r.drr));
        const ship = Math.min(need, fcPool);
        if (ship > 0) {
          r.shipmentQty += ship;
          r.actionType = "SHIP";
          r.shipmentSource = "FC_REPLENISHMENT";
          fcPool -= ship;
          uniwareStock -= ship;
        }
      }
    });

    /* ===============================
       STEP 4: SELLER → FC LOGIC
       =============================== */

    if (sellerSale <= 0 || fcPool <= 0) return;

    /* ---------- BRANCH A: FC SALE EXISTS ---------- */
    if (fcSale > 0) {

      const totalSale = sellerSale + fcSale;
      const sellerDW = sellerSale / totalSale;

      let sellerAllocQty = Math.floor(
        fcPool *
        sample.dwMp *
        sample.dwStyle *
        sample.dwSku *
        sellerDW
      );

      sellerAllocQty = Math.min(sellerAllocQty, uniwareStock);
      if (sellerAllocQty <= 0) return;

      const strength = fcRows.map(r => ({
        row: r,
        val: Math.max(r.drr || 0, r.dwFc || 0)
      })).filter(x => x.val > 0);

      const totalStrength = strength.reduce((s, x) => s + x.val, 0);
      if (totalStrength <= 0) return;

      let remaining = sellerAllocQty;

      strength.forEach((x, i) => {
        const qty = (i === strength.length - 1)
          ? remaining
          : Math.floor(sellerAllocQty * (x.val / totalStrength));

        if (qty > 0) {
          x.row.shipmentQty += qty;
          x.row.actionType = "SHIP";
          x.row.shipmentSource = "SELLER_REBALANCE";
          remaining -= qty;
        }
      });

      uniwareStock -= sellerAllocQty;
      return;
    }

    /* ---------- BRANCH B: NO FC SALE (BOOTSTRAP) ---------- */

    const bestFCs = BEST_FC_BY_MP[mp] || [];
    const targetFCs = fcRows.filter(r => bestFCs.includes(r.warehouseId));
    if (!targetFCs.length) return;

    let sellerAllocQty = Math.floor(
      fcPool *
      sample.dwMp *
      sample.dwStyle *
      sample.dwSku
    );

    sellerAllocQty = Math.min(sellerAllocQty, uniwareStock);
    if (sellerAllocQty <= 0) return;

    const baseQty = Math.floor(sellerAllocQty / targetFCs.length);
    let remainder = sellerAllocQty % targetFCs.length;

    targetFCs.forEach(r => {
      let qty = baseQty;
      if (remainder > 0) {
        qty += 1;
        remainder -= 1;
      }
      if (qty > 0) {
        r.shipmentQty += qty;
        r.actionType = "SHIP";
        r.shipmentSource = "SELLER_BOOTSTRAP_BEST_FC";
      }
    });

    uniwareStock -= sellerAllocQty;
  });

  /* ===============================
     STEP 5: FINAL REMARKS
     =============================== */

  data.forEach(r => {
    if (r.actionType === "SHIP" && r.shipmentSource === "SELLER_REBALANCE") {
      r.remark = "Seller demand redistributed to FCs";
    } else if (r.actionType === "SHIP" && r.shipmentSource === "SELLER_BOOTSTRAP_BEST_FC") {
      r.remark = "Bootstrap FC allocation (no FC sale history)";
    } else if (r.actionType === "RECALL") {
      r.remark = "Stock above 60 days – recall";
    } else if (!r.remark) {
      r.remark = "No action required";
    }
  });

  return data;
}
