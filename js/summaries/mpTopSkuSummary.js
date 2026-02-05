/**
 * MP Wise Top 10 SKUs
 * Input: mpPlanningRows[]
 */

export function mpTopSkuSummary(mpRows) {
  const map = new Map();

  mpRows.forEach(r => {
    const sku = r.sku;
    const sale = Number(r.saleQty) || 0;

    if (!map.has(sku)) {
      map.set(sku, 0);
    }
    map.set(sku, map.get(sku) + sale);
  });

  return Array.from(map.entries())
    .map(([sku, totalSale]) => ({
      SKU: sku,
      "Total Sale": totalSale,
      DRR: Number((totalSale / 30).toFixed(2))
    }))
    .sort((a, b) => b["Total Sale"] - a["Total Sale"])
    .slice(0, 10);
}
