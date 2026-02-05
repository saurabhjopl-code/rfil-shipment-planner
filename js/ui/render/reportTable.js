/**
 * REPORT TABLE RENDERER
 *
 * Supports:
 * - MP mode (default)
 * - SELLER mode (simplified)
 */

export function renderReportTable({
  rows,
  includeRecall = true,
  mode = "MP" // "MP" or "SELLER"
}) {
  const table = document.createElement("table");
  table.className = "report-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const headers =
    mode === "SELLER"
      ? [
          "Style",
          "SKU",
          "MP",
          "FC",
          "Sale Qty",
          "DRR",
          "Actual Shipment Qty",
          "Shipment Qty",
          "Action",
          "Remarks"
        ]
      : [
          "Style",
          "SKU",
          "FC",
          "Sale Qty",
          "DRR",
          "FC Stock",
          "Stock Cover",
          "Actual Shipment Qty",
          "Shipment Qty",
          "Recall Qty",
          "Action",
          "Remarks"
        ];

  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const cells =
      mode === "SELLER"
        ? [
            r.style,
            r.sku,
            r.mp,
            r.fc,
            r.saleQty,
            r.drr,
            r.actualShipmentQty,
            r.shipmentQty,
            r.action,
            r.remarks
          ]
        : [
            r.style,
            r.sku,
            r.fc,
            r.saleQty,
            r.drr,
            r.fcStock,
            r.stockCover,
            r.actualShipmentQty,
            r.shipmentQty,
            r.recallQty,
            r.action,
            r.remarks
          ];

    cells.forEach(val => {
      const td = document.createElement("td");
      td.textContent = val ?? "";
      tr.appendChild(td);
    });

    /* Action color */
    if (r.action === "SHIP") tr.classList.add("row-ship");
    if (r.action === "RECALL") tr.classList.add("row-recall");
    if (r.action === "NONE") tr.classList.add("row-none");

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}
