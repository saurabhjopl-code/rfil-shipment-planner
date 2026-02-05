import { validateContract } from "./contracts.js";

/**
 * Normalize datasets into canonical shapes
 * NO business logic
 * NO joins
 */

export function normalizeSale30D(rows) {
  validateContract(rows, "sale30D");

  return rows.map(r => ({
    mp: r["MP"],
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
    mp: r["MP"],
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
