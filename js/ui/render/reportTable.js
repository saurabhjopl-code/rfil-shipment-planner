/**
 * REPORT TABLE RENDERER
 *
 * - MP report (with Recall)
 * - Seller report (no Recall)
 * - Supports Actual Shipment Qty
 *
 * IMPORTANT:
 * Exports BOTH named + default
 * to remain compatible with VA2.0 app.js
 */

export function renderReportTable({
  rows,
  includeRecall = true
}) {
  const table = document.createElement("table");
  table.className = "report-table";

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  const headers = [
    "Style",
    "SKU",
    "FC",
    "Sale Qty",
    "DRR",
    "FC Stock",
    "Stock Cover",
    "Actual Shipment Qty",
    "Shipment Qty"
  ];

  if (includeRecall) headers.push("Recall Qty");

  headers.push("Action", "Remarks");

  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    tr.appendChild(th);
  });

  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const cells = [
      r.style,
      r.sku,
      r.fc,
      r.saleQty,
      r.drr,
      r.fcStock,
      r.stockCover,
      r.actualShipmentQty ?? 0,
      r.shipmentQty
    ];

    if (includeRecall) cells.push(r.recallQty);

    cells.push(r.action);

    let remarks = r.remarks || "";
    if (
      r.action === "SHIP" &&
      r.shipmentQty < (r.actualShipmentQty || 0)
    ) {
      remarks = remarks
        ? `${remarks} | Partial (DW / Uniware 40%)`
        : "Partial (DW / Uniware 40%)";
    }

    cells.push(remarks);

    cells.forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });

    tr.classList.add(
      r.action === "SHIP"
        ? "row-ship"
        : r.action === "RECALL"
        ? "row-recall"
        : "row-none"
    );

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

/* 🔒 Backward compatibility */
export default renderReportTable;
