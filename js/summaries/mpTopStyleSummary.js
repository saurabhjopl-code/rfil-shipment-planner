/**
 * MP Wise Top 10 Styles
 * Input: mpPlanningRows[]
 */

export function mpTopStyleSummary(mpRows) {
  const map = new Map();

  mpRows.forEach(r => {
    const style = r.style;
    const sale = Number(r.saleQty) || 0;

    if (!map.has(style)) {
      map.set(style, 0);
    }
    map.set(style, map.get(style) + sale);
  });

  return Array.from(map.entries())
    .map(([style, totalSale]) => ({
      Style: style,
      "Total Sale": totalSale,
      DRR: Number((totalSale / 30).toFixed(2))
    }))
    .sort((a, b) => b["Total Sale"] - a["Total Sale"])
    .slice(0, 10);
}
