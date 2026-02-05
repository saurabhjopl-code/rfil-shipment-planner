/**
 * SHIPMENT & RECALL SUMMARY
 *
 * Adds:
 * - Actual Shipment Qty (demand)
 * Keeps:
 * - Shipment Qty (allocated)
 * - Recall Qty
 */

export function shipmentSummary(rows) {
  const map = new Map();

  rows.forEach(r => {
    if (!map.has(r.fc)) {
      map.set(r.fc, {
        FC: r.fc,
        "Total Stock": 0,
        "Total Sale": 0,
        DRR: 0,
        "Actual Shipment Qty": 0,
        "Shipment Qty": 0,
        "Recall Qty": 0
      });
    }

    const row = map.get(r.fc);

    row["Total Stock"] += r.fcStock || 0;
    row["Total Sale"] += r.saleQty || 0;
    row["Actual Shipment Qty"] += r.actualShipmentQty || 0;
    row["Shipment Qty"] += r.shipmentQty || 0;
    row["Recall Qty"] += r.recallQty || 0;
  });

  map.forEach(row => {
    row.DRR = Number((row["Total Sale"] / 30).toFixed(2));
  });

  return Array.from(map.values());
}
