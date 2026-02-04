/* =========================================================
   GOOGLE SHEET INGESTION & NORMALIZATION – V1
   Works on GitHub Pages (CSV fetch)
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

/* ===================== CSV PARSER ===================== */

function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      current.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (value || current.length) {
        current.push(value.trim());
        rows.push(current);
        current = [];
        value = "";
      }
    } else {
      value += char;
    }
  }

  if (value || current.length) {
    current.push(value.trim());
    rows.push(current);
  }

  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] !== undefined ? r[i].trim() : "";
    });
    return obj;
  });
}

/* ===================== HELPERS ===================== */

const norm = v => (v || "").toString().trim();
const num = v => (isNaN(Number(v)) ? 0 : Number(v));

/* ===================== FETCH ===================== */

async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch sheet");
  const text = await res.text();
  return rowsToObjects(parseCSV(text));
}

/* ===================== MAIN INGESTION ===================== */

async function ingestAllSheets() {
  console.log("Fetching Google Sheets...");

  const [
    saleRows,
    fcStockRows,
    uniwareRows,
    companyRemarkRows
  ] = await Promise.all([
    fetchSheet(SHEETS.sale30d),
    fetchSheet(SHEETS.fcStock),
    fetchSheet(SHEETS.uniwareStock),
    fetchSheet(SHEETS.companyRemarks)
  ]);

  console.log("Raw rows loaded");

  /* ============ UNIWARE STOCK MAP ============ */
  const uniwareStockMap = {};
  uniwareRows.forEach(r => {
    const uw = norm(r["Uniware SKU"]);
    if (!uw) return;
    uniwareStockMap[uw] = num(r["Quantity"]);
  });

  /* ============ COMPANY REMARK MAP ============ */
  const companyRemarkMap = {};
  companyRemarkRows.forEach(r => {
    const style = norm(r["Style ID"]);
    if (!style) return;
    companyRemarkMap[style] = norm(r["Company Remark"]);
  });

  /* ============ FC STOCK MAP ============ */
  const fcStockMap = {};
  fcStockRows.forEach(r => {
    const key = [
      norm(r["MP"]),
      norm(r["Channel ID"]),
      norm(r["Warehouse Id"]),
      norm(r["SKU"])
    ].join("|");

    fcStockMap[key] = num(r["Quantity"]);
  });

  /* ============ SALES AGGREGATION ============ */

  const fcSaleAgg = {};
  const sellerSaleAgg = {};

  saleRows.forEach(r => {
    const mp = norm(r["MP"]);
    const wh = norm(r["Warehouse Id"]);
    const sku = norm(r["SKU"]);
    const uw = norm(r["Uniware SKU"]);
    const style = norm(r["Style ID"]);
    const channel = norm(r["Channel ID"]);
    const qty = num(r["Quantity"]);

    if (!sku || !uw || qty === 0) return;

    if (wh === "SELLER") {
      const key = [mp, sku, uw, style].
