/**
 * Seller Shipment Summary
 * Input:
 *  - sellerRows[]
 *  - uniwareUsed
 *  - remainingUniware
 */

export function sellerSummary({
  sellerRows,
  uniwareUsed,
  remainingUniware
}) {
  const totalSale = sellerRows.reduce(
    (sum, r) => sum + (Number(r.saleQty) || 0),
    0
  );

  const totalShipment = sellerRows.reduce(
    (sum, r) => sum + (Number(r.shipmentQty) || 0),
    0
  );

  return [{
    "Total Seller Sale": totalSale,
    "Shipment Qty": totalShipment,
    "Uniware Used": uniwareUsed,
    "Remaining Uniware": remainingUniware
  }];
}
