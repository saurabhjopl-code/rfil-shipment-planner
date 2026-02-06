/**
 * FILTERS BAR
 *
 * - FC dropdown (dynamic)
 * - Search (Style / SKU)
 * - Reset button
 */

export function renderFiltersBar() {
  const wrapper = document.createElement("div");
  wrapper.className = "filters-bar";

  wrapper.innerHTML = `
    <div class="filter-group">
      <label>FC</label>
      <select id="fcFilter">
        <option value="">All FCs</option>
      </select>
    </div>

    <div class="filter-group">
      <label>Search (Style / SKU)</label>
      <input
        type="text"
        id="searchFilter"
        placeholder="Type Style or SKU"
      />
    </div>

    <div class="filter-group">
      <button id="resetFilters">Reset</button>
    </div>
  `;

  return wrapper;
}
