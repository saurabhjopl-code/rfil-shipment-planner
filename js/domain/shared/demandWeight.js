/**
 * DEMAND WEIGHT (DW) – PURE CALCULATION
 *
 * This file is OBSERVABILITY ONLY.
 * It does NOT affect:
 * - Shipment Qty
 * - Recall Qty
 * - Allocation
 * - Priority
 *
 * Safe to add on VA1.0
 */

/**
 * MP Demand Weight
 * MP Sale of SKU / Total Sale of SKU
 */
export function calculateMPDW(mpSkuSale, totalSkuSale) {
  if (!totalSkuSale || totalSkuSale <= 0) return 0;
  return mpSkuSale / totalSkuSale;
}

/**
 * FC Demand Weight
 * FC Sale of SKU / MP Sale of SKU
 */
export function calculateFCDW(fcSkuSale, mpSkuSale) {
  if (!mpSkuSale || mpSkuSale <= 0) return 0;
  return fcSkuSale / mpSkuSale;
}

/**
 * Final Demand Weight
 */
export function calculateFinalDW(mpDW, fcDW) {
  return mpDW * fcDW;
}
