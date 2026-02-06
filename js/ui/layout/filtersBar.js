export function renderFiltersBar() {
  const bar = document.createElement("div");
  bar.className = "filter-bar";

  bar.innerHTML = `
    <select id="filter-mp">
      <option value="ALL">All MPs</option>
      <option value="AMAZON">Amazon</option>
      <option value="FLIPKART">Flipkart</option>
      <option value="MYNTRA">Myntra</option>
      <option value="SELLER">Seller</option>
    </select>

    <select id="filter-fc">
      <option value="ALL">All FCs</option>
    </select>

    <input
      type="text"
      id="search"
      placeholder="Search Style or SKU"
    />
  `;

  return bar;
}
