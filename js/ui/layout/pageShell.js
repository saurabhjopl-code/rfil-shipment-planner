export function renderPageShell(type) {
  const page = document.createElement("div");
  page.className = "page";

  if (type === "SELLER") {
    page.innerHTML = `
      <div class="section">
        <h3>Seller Shipment Summary</h3>
        <div class="empty-state">No data available</div>
      </div>

      <div class="section">
        <h3>Seller Shipment Report</h3>
        ${renderEmptyTable(false)}
      </div>
    `;
  } else {
    page.innerHTML = `
      <div class="summary-grid">
        <div class="section">
          <h3>FC Wise Stock</h3>
          <div class="empty-state">No data</div>
        </div>

        <div class="section">
          <h3>FC Wise Sale | DRR | Stock Cover</h3>
          <div class="empty-state">No data</div>
        </div>

        <div class="section">
          <h3>MP Wise Top 10 SKUs</h3>
          <div class="empty-state">No data</div>
        </div>

        <div class="section">
          <h3>MP Wise Top 10 Styles</h3>
          <div class="empty-state">No data</div>
        </div>
      </div>

      <div class="section">
        <h3>Shipment & Recall Summary</h3>
        <div class="empty-state">No data</div>
      </div>

      <div class="section">
        <h3>FC Planning Report</h3>
        ${renderEmptyTable(true)}
      </div>
    `;
  }

  return page;
}

function renderEmptyTable(includeRecall) {
  return `
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
          <tr>
            <td colspan="${includeRecall ? 11 : 9}" class="empty-state">
              No rows to display
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="show-more">
      <button disabled>Show More</button>
    </div>
  `;
}
