/**
 * Shipment & Recall Summary
 * Input: mpPlanningRows[]
 */

export function shipmentSummary(mpRows) {
  const map = new Map();

  mpRows.forEach(r => {
    const fc = r.fc;

    if (!map.has(fc)) {
      map.set(fc, {
        stock: 0,
        sale: 0,
        ship: 0,
        recall: 0
      });
    }

    const entry = map.get(fc);
    entry.stock += Number(r.fcStock) || 0;
    entry.sale += Number(r.saleQty) || 0;
    entry.ship += Number(r.shipmentQty) || 0;
    entry.recall += Number(r.recallQty) || 0;
  });

  return Array.from(map.entries()).map(([fc, v]) => ({
    FC: fc,
    "Total Stock": v.stock,
    "Total Sale": v.sale,
    DRR: Number((v.sale / 30).toFixed(2)),
    "Shipment Qty": v.ship,
    "Recall Qty": v.recall
  }));
}
