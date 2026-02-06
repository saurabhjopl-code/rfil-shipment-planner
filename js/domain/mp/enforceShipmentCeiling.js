/**
 * ENFORCE SHIPMENT CEILING — VA4.2
 *
 * Guarantees:
 * - Actual Shipment Qty is always computed
 * - Shipment Qty NEVER exceeds Actual Shipment Qty
 *
 * This runs AFTER allocation & FC enrichment
 */

export function enforceShipmentCeiling(rows) {
  return rows.map(r => {
    if (r.fcStock == null || r.drr == null) {
      return {
        ...r,
        actualShipmentQty: 0
      };
    }

    const actualShipmentQty = Math.max(
      0,
      Math.ceil(45 * r.drr - r.fcStock)
    );

    let shipmentQty = r.shipmentQty || 0;
    let remarks = r.remarks || "";

    if (shipmentQty > actualShipmentQty) {
      shipmentQty = actualShipmentQty;

      if (actualShipmentQty === 0) {
        remarks = "No demand (45D stock covered)";
      } else {
        remarks = remarks
          ? remarks
          : "Capped by actual demand";
      }
    }

    return {
      ...r,
      actualShipmentQty,
      shipmentQty
    };
  });
}
