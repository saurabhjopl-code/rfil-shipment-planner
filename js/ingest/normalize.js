import { validateContract } from "./contracts.js";

/**
 * Normalize MP names into canonical values
 */
function normalizeMP(mpRaw) {
  if (!mpRaw) return "";

  const v = mpRaw.toString().trim().toUpperCase();

  if (v.includes("AMAZON")) return "AMAZON";
  if (v.includes("FLIPKART")) return "FLIPKART";
  if (v.includes("MYNTRA")) return "MYNTRA";

  return v; // fallback (future MPs)
}

/**
 * Normalize datasets into canonical shapes
 * NO business logic
 */

export function normalizeSale30D(rows) {
  validateContract(rows, "sale30D");

  return rows.map(r => ({
    mp: normalizeMP(r["MP"]),
    date: r["Date"],
    sku: r["SKU"],
    channelId: r["Channel ID"],
    qty: Number(r["Quantity"]) || 0,
    warehouseId: r["Warehouse Id"],
    fulfillmentType: r["Fulfillment Type"],
    uniwareSku: r["Uniware SKU"],
    style: r["Style ID"],
    size: r["Size"]
  }));
}

export function normalizeFCStock(rows) {
  validateContract(rows, "fcStock");

  return rows.map(r => ({
    mp: normalizeMP(r["MP"]),
    warehouseId: r["Warehouse Id"],
    sku: r["SKU"],
    channelId: r["Channel ID"],
    qty: Number(r["Quantity"]) || 0
  }));
}

export function normalizeUniwareStock(rows) {
  validateContract(rows, "uniwareStock");

  return rows.map(r => ({
    uniwareSku: r["Uniware SKU"],
    qty: Number(r["Quantity"]) || 0
  }));
}

export function normalizeCompanyRemarks(rows) {
  validateContract(rows, "companyRemarks");

  return rows.map(r => ({
    style: r["Style ID"],
    category: r["Category"],
    remark: r["Company Remark"]
  }));
}
