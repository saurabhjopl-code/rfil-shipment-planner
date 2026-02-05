/**
 * SELLER DERIVATION LOGIC
 *
 * Purpose:
 * - Split Sale 30D into:
 *   1. MP sales (valid FC warehouse)
 *   2. SELLER sales (non-FC warehouse)
 *
 * AUTHORITATIVE RULE:
 * Warehouse Id ∉ FC Stock Warehouse Id set → SELLER
 *
 * NO business logic
 * NO shipment logic
 * NO mutation
 */

export function deriveSellerSales({ sale30D, fcStock }) {
  if (!Array.isArray(sale30D)) {
    throw new Error("deriveSellerSales: sale30D must be an array");
  }
  if (!Array.isArray(fcStock)) {
    throw new Error("deriveSellerSales: fcStock must be an array");
  }

  // Build authoritative FC warehouse set
  const fcWarehouseSet = new Set(
    fcStock
      .map(r => r.warehouseId)
      .filter(Boolean)
  );

  const mpSales = [];
  const sellerSales = [];

  for (const row of sale30D) {
    if (!row || !row.warehouseId) {
      // Defensive: treat malformed rows as SELLER
      sellerSales.push(row);
      continue;
    }

    if (fcWarehouseSet.has(row.warehouseId)) {
      mpSales.push(row);
    } else {
      sellerSales.push(row);
    }
  }

  return {
    mpSales,
    sellerSales
  };
}
