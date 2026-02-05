/**
 * SELLER DERIVATION
 *
 * Pure classification logic.
 * Enforces data contract for SELLER rows.
 * No shipment logic.
 * No Uniware math.
 * No MP logic changes.
 */

/**
 * Derive MP sales vs SELLER sales
 *
 * @param {Object} input
 * @param {Array} input.sale30D  - normalized sale data
 * @param {Array} input.fcStock  - normalized FC stock data
 *
 * @returns {Object}
 * {
 *   mpSales:      Sale rows fulfilled by FCs
 *   sellerSales: Sale rows fulfilled by Seller (uniwareSku enforced)
 * }
 */
export function deriveSellerSales({ sale30D, fcStock }) {
  /* -----------------------------
     Build FC list by MP
  ----------------------------- */
  const fcByMP = new Map();

  fcStock.forEach(r => {
    if (!fcByMP.has(r.mp)) {
      fcByMP.set(r.mp, new Set());
    }
    fcByMP.get(r.mp).add(r.warehouseId);
  });

  /* -----------------------------
     Split sales
  ----------------------------- */
  const mpSales = [];
  const sellerSales = [];

  sale30D.forEach(r => {
    const fcSet = fcByMP.get(r.mp);

    if (fcSet && fcSet.has(r.warehouseId)) {
      mpSales.push(r);
    } else {
      /* 🔑 ENFORCE SELLER DATA CONTRACT */
      sellerSales.push({
        ...r,
        uniwareSku: r.uniwareSku ?? null
      });
    }
  });

  return {
    mpSales,
    sellerSales
  };
}
