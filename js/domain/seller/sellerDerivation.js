/**
 * SELLER DERIVATION — VA3.3
 *
 * Pure classification logic.
 * Enforces MP normalization.
 */

export function deriveSellerSales({ sale30D, fcStock }) {
  /* -----------------------------
     Build FC list by MP
  ----------------------------- */
  const fcByMP = new Map();

  fcStock.forEach(r => {
    const mp = r.mp.trim().toUpperCase();
    if (!fcByMP.has(mp)) {
      fcByMP.set(mp, new Set());
    }
    fcByMP.get(mp).add(r.warehouseId);
  });

  /* -----------------------------
     Split sales
  ----------------------------- */
  const mpSales = [];
  const sellerSales = [];

  sale30D.forEach(r => {
    const mp = r.mp.trim().toUpperCase();
    const fcSet = fcByMP.get(mp);

    const normalizedRow = {
      ...r,
      mp
    };

    if (fcSet && fcSet.has(r.warehouseId)) {
      mpSales.push(normalizedRow);
    } else {
      sellerSales.push(normalizedRow);
    }
  });

  return {
    mpSales,
    sellerSales
  };
}
