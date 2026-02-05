/**
 * SHARED METRICS
 */

export function calculateDRR(saleQty) {
  return saleQty / 30;
}

export function calculateStockCover(fcStock, drr) {
  if (drr <= 0) return 0;
  return fcStock / drr;
}
