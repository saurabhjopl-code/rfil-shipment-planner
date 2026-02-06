/**
 * VA4 — DEMAND WEIGHT CALCULATIONS
 * PURE FUNCTIONS ONLY
 */

/**
 * Safe division
 */
function div(n, d) {
  if (!d || d <= 0) return 0;
  return n / d;
}

/**
 * MP DW (includes SELLER)
 */
export function computeMPDW(mpSale, totalSale) {
  return div(mpSale, totalSale);
}

/**
 * FC DW (only for MP rows)
 */
export function computeFCDW(fcSale, mpSale) {
  return div(fcSale, mpSale);
}

/**
 * Style DW (inside MP)
 */
export function computeStyleDW(styleSale, mpSale) {
  return div(styleSale, mpSale);
}

/**
 * SKU DW (inside Style + MP)
 */
export function computeSkuDW(skuSale, styleSale) {
  return div(skuSale, styleSale);
}

/**
 * Final DW
 */
export function computeFinalDW({
  mpDW,
  fcDW = 1,
  styleDW,
  skuDW
}) {
  return mpDW * fcDW * styleDW * skuDW;
}

