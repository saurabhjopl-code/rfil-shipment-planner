/**
 * Renders a generic summary table
 * UI ONLY – no business logic
 */

export function renderSummaryTable({
  title,
  columns,
  rows,
  showGrandTotal = false
}) {
  const section = document.createElement("div");
  section.className = "section";

  const table = document.createElement("table");

  table.innerHTML = `
    <thead>
      <tr>
        ${columns.map(col => `<th>${col}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${
        rows.length === 0
          ? `<tr><td colspan="${columns.length}" class="empty-state">No data</td></tr>`
          : rows.map(row => `
              <tr>
                ${columns.map(col => `<td>${formatValue(row[col])}</td>`).join("")}
              </tr>
            `).join("")
      }
      ${
        showGrandTotal && rows.length > 0
          ? `
            <tr class="grand-total">
              ${columns.map(col => `<td>${formatGrandTotal(col, rows)}</td>`).join("")}
            </tr>
          `
          : ""
      }
    </tbody>
  `;

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;

  section.appendChild(titleEl);
  section.appendChild(table);

  return section;
}

/* =========================
   HELPERS
========================= */

function formatValue(val) {
  if (typeof val === "number") {
    return Number(val.toFixed(2));
  }
  return val ?? "-";
}

function formatGrandTotal(column, rows) {
  /* Non-numeric columns */
  if (!rows.every(r => typeof r[column] === "number")) {
    return "Grand Total";
  }

  /* 🔒 SPECIAL CASE: Stock Cover */
  if (column === "Stock Cover") {
    const totalSale = rows.reduce(
      (sum, r) => sum + (Number(r["Total Sale"]) || 0),
      0
    );

    const totalStock = rows.reduce(
      (sum, r) => sum + (Number(r["Total Stock"]) || 0),
      0
    );

    const drr = totalSale / 30;
    const sc = drr > 0 ? totalStock / drr : 0;

    return Number(sc.toFixed(2));
  }

  /* Default additive behavior */
  const sum = rows.reduce(
    (total, r) => total + (Number(r[column]) || 0),
    0
  );

  return Number(sum.toFixed(2));
}
