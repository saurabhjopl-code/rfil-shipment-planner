/**
 * Renders report table
 * UI ONLY
 */

export function renderReportTable({ rows, includeRecall }) {
  const container = document.createElement("div");

  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Style</th>
            <th>SKU</th>
            <th>FC</th>
            <th>Sale Qty</th>
            <th>DRR</th>
            <th>FC Stock</th>
            <th>Stock Cover</th>
            <th>Shipment Qty</th>
            ${includeRecall ? "<th>Recall Qty</th><th>Action</th>" : ""}
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length === 0
              ? `<tr><td colspan="${includeRecall ? 11 : 9}" class="empty-state">
                   No rows to display
                 </td></tr>`
              : rows.map(r => renderRow(r, includeRecall)).join("")
          }
        </tbody>
      </table>
    </div>

    <div class="show-more">
      <button>Show More</button>
    </div>
  `;

  return container;
}

function renderRow(row, includeRecall) {
  return `
    <tr>
      <td>${row.style}</td>
      <td>${row.sku}</td>
      <td>${row.fc}</td>
      <td>${format(row.saleQty)}</td>
      <td>${format(row.drr)}</td>
      <td>${format(row.fcStock)}</td>
      <td>${format(row.stockCover)}</td>
      <td>${format(row.shipmentQty)}</td>
      ${
        includeRecall
          ? `<td>${format(row.recallQty)}</td>
             <td>${renderActionBadge(row.action)}</td>`
          : ""
      }
      <td>${row.remarks || "-"}</td>
    </tr>
  `;
}

function format(val) {
  if (typeof val === "number") {
    return Number(val.toFixed(2));
  }
  return val ?? "-";
}

function renderActionBadge(action) {
  if (action === "SHIP") return `<span class="badge ship">SHIP</span>`;
  if (action === "RECALL") return `<span class="badge recall">RECALL</span>`;
  return `<span class="badge none">NONE</span>`;
}
