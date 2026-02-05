/**
 * DEMAND WEIGHT CALCULATIONS
 *
 * Pure math
 * No side effects
 * No assumptions
 */

export function calculateMPDW(mpSkuSale, totalSkuSale) {
  if (totalSkuSale <= 0) return 0;
  return mpSkuSale / totalSkuSale;
}

export function calculateFCDW(fcSkuSale, mpSkuSale) {
  if (mpSkuSale <= 0) return 0;
  return fcSkuSale / mpSkuSale;
}

export function calculateFinalDW(mpDW, fcDW) {
  return mpDW * fcDW;
}
