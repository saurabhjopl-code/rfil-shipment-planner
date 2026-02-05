/**
 * SUMMARY TABLE RENDERER
 *
 * Supports:
 * - Actual Shipment Qty column
 * - Grand total calculation
 */

export function renderSummaryTable({
  title,
  columns,
  rows,
  showGrandTotal = false
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "summary-block";

  const h3 = document.createElement("h3");
  h3.textContent = title;
  wrapper.appendChild(h3);

  const table = document.createElement("table");
  table.className = "summary-table";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  columns.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach(r => {
    const tr = document.createElement("tr");
    columns.forEach(c => {
      const td = document.createElement("td");
      td.textContent = r[c] ?? 0;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  /* Grand Total */
  if (showGrandTotal) {
    const totalRow = {};
    columns.forEach(c => {
      totalRow[c] =
        c === columns[0]
          ? "Grand Total"
          : rows.reduce(
              (sum, r) => sum + (Number(r[c]) || 0),
              0
            ).toFixed(2);
    });

    const tr = document.createElement("tr");
    tr.className = "grand-total";

    columns.forEach(c => {
      const td = document.createElement("td");
      td.textContent = totalRow[c];
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}
