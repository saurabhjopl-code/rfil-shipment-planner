/**
 * Renders a generic summary table
 * @param {Object} config
 * @param {string} config.title
 * @param {Array<string>} config.columns
 * @param {Array<Object>} config.rows
 * @param {boolean} config.showGrandTotal
 */
export function renderSummaryTable({ title, columns, rows, showGrandTotal = false }) {
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
                ${columns.map(col => `<td>${row[col] ?? "-"}</td>`).join("")}
              </tr>
            `).join("")
      }
      ${
        showGrandTotal && rows.length > 0
          ? `
            <tr style="font-weight:bold;border-top:2px solid #ccc">
              ${columns.map(col => `<td>${getGrandTotal(col, rows)}</td>`).join("")}
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

function getGrandTotal(column, rows) {
  const numeric = rows.every(r => typeof r[column] === "number");
  if (!numeric) return "Grand Total";

  return rows.reduce((sum, r) => sum + (r[column] || 0), 0);
}
