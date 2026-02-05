/**
 * REPORT TABLE RENDERER
 *
 * Restores:
 * - VA1.0 Action coloring (on TD)
 * - Actual Shipment Qty column
 */

export function renderReportTable({
  rows,
  includeRecall = true
}) {
  const table = document.createElement("table");
  table.className = "report-table";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

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
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const values = [
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

    if (includeRecall) values.push(r.recallQty);

    values.push(r.action);

    let remarks = r.remarks || "";
    if (
      r.action === "SHIP" &&
      r.shipmentQty < (r.actualShipmentQty || 0)
    ) {
      remarks = remarks
        ? `${remarks} | Partial (DW / Uniware 40%)`
        : "Partial (DW / Uniware 40%)";
    }

    values.push(remarks);

    values.forEach((v, idx) => {
      const td = document.createElement("td");
      td.textContent = v;

      /* Restore VA1.0 coloring */
      if (headers[idx] === "Action") {
        td.classList.add(
          r.action === "SHIP"
            ? "ship"
            : r.action === "RECALL"
            ? "recall"
            : "none"
        );
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

/* Backward compatibility */
export default renderReportTable;
