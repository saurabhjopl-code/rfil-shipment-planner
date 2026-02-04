/* =========================================================
   INGEST.JS – Google Sheet Ingestion & Normalization
   ========================================================= */

const SHEETS = {
  sale30d:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRarC7jnt04o-cSMEJN-h3nrbNyhgd-JCoxy6B0oDwwlX09SLQjB4kMJIOkeLRXy9RId28iJjbTd8Tm/pub?gid=1268196089&single=true&output=csv",

  fcStock:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRarC7jnt04o-cSMEJN-h3nrbNyhgd-JCoxy6B0oDwwlX09SLQjB4kMJIOkeLRXy9RId28iJjbTd8Tm/pub?gid=2046154602&single=true&output=csv",

  uniwareStock:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRarC7jnt04o-cSMEJN-h3nrbNyhgd-JCoxy6B0oDwwlX09SLQjB4kMJIOkeLRXy9RId28iJjbTd8Tm/pub?gid=535319358&single=true&output=csv",

  companyRemarks:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRarC7jnt04o-cSMEJN-h3nrbNyhgd-JCoxy6B0oDwwlX09SLQjB4kMJIOkeLRXy9RId28iJjbTd8Tm/pub?gid=998019043&single=true&output=csv"
};

/* ---------- CSV Parser ---------- */

function parseCSV(text) {
  const rows = [];
  let row = [], val = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];

    if (c === '"' && inQuotes && n === '"') {
      val += '"'; i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(val.trim()); val = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (val || row.length) {
        row.push(val.trim());
        rows.push(row);
        row = []; val = "";
      }
    } else {
      val += c;
    }
  }

  if (val || row.length) {
    row.push(val.trim());
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] ? r[i].trim() : "");
    return obj;
  });
}

const norm = v => (v || "").toString().trim();
const num = v => (isNaN(Number(v)) ? 0 : Number(v));

async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Sheet fetch failed");
  return rowsToObjects(parseCSV(await res.text()));
}

/* ---------- MAIN INGEST ---------- */

async function ingestAllSheets() {
  const [sale, fc, uw, cr] = await Promise.all([
    fetchSheet(SHEETS.sale30d),
    fetchSheet(SHEETS.fcStock),
    fetchSheet(SHEETS.uniwareStock),
    fetchSheet(SHEETS.companyRemarks)
  ]);

  const uniwareStockMap = {};
  uw.forEach(r => uniwareStockMap[norm(r["Uniware SKU"])] = num(r["Quantity"]));

  const companyRemarkMap = {};
  cr.forEach(r => companyRemarkMap[norm(r["Style ID"])] = norm(r["Company Remark"]));

  const fcStockMap = {};
  fc.forEach(r => {
    const k = [norm(r.MP), norm(r["Channel ID"]), norm(r["Warehouse Id"]), norm(r.SKU)].join("|");
    fcStockMap[k] = num(r.Quantity);
  });

  const fcSaleAgg = {}, sellerSaleAgg = {};

  sale.forEach(r => {
    const mp = norm(r.MP);
    const wh = norm(r["Warehouse Id"]);
    const sku = norm(r.SKU);
    const uwsku = norm(r["Uniware SKU"]);
    const style = norm(r["Style ID"]);
    const ch = norm(r["Channel ID"]);
    const qty = num(r.Quantity);
    if (!sku || !uwsku || qty === 0) return;

    if (wh === "SELLER") {
      sellerSaleAgg[[mp, sku, uwsku, style].join("|")] =
        (sellerSaleAgg[[mp, sku, uwsku, style].join("|")] || 0) + qty;
    } else {
      fcSaleAgg[[mp, ch, wh, sku, uwsku, style].join("|")] =
        (fcSaleAgg[[mp, ch, wh, sku, uwsku, style].join("|")] || 0) + qty;
    }
  });

  const normalized = [];

  Object.keys(fcSaleAgg).forEach(k => {
    const [mp, ch, wh, sku, uwsku, style] = k.split("|");
    const fcSale = fcSaleAgg[k];
    const sellerSale = sellerSaleAgg[[mp, sku, uwsku, style].join("|")] || 0;

    normalized.push({
      mp,
      channelId: ch,
      warehouseId: wh,
      sku,
      uniwareSku: uwsku,
      styleId: style,

      sale30dFc: fcSale,
      sale30dSeller: sellerSale,
      totalSale30d: fcSale + sellerSale,

      drr: fcSale / 30,
      fcStockQty: fcStockMap[[mp, ch, wh, sku].join("|")] || 0,
      uniwareStockQty: uniwareStockMap[uwsku] || 0,

      companyRemark: companyRemarkMap[style] || "",
      isClosedStyle: (companyRemarkMap[style] || "").toLowerCase() === "closed"
    });
  });

  return normalized;
}

