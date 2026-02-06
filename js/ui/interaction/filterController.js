/**
 * FILTER CONTROLLER
 * VA4.3
 *
 * Responsibility:
 * - MP → FC dependent filter
 * - Search (Style / SKU)
 * - Reset filters
 *
 * NO business logic
 * NO recalculation
 */

export function createFilterController({
  getActiveView,
  onFilterApplied
}) {
  const mpSelect = document.getElementById("filter-mp");
  const fcSelect = document.getElementById("filter-fc");
  const searchInput = document.getElementById("search");

  let state = {
    mp: "ALL",
    fc: "ALL",
    search: ""
  };

  /* -----------------------------
     Helpers
  ----------------------------- */
  function clearFCOptions() {
    fcSelect.innerHTML = `<option value="ALL">All FCs</option>`;
  }

  function populateFCOptions(fcList = []) {
    clearFCOptions();
    fcList.forEach(fc => {
      const opt = document.createElement("option");
      opt.value = fc;
      opt.textContent = fc;
      fcSelect.appendChild(opt);
    });
  }

  function applyFilters() {
    const view = getActiveView();
    if (!view) return;

    const { reportRows } = view;

    let filteredRows = [...reportRows];

    /* FC filter */
    if (state.fc !== "ALL") {
      filteredRows = filteredRows.filter(
        r => r.fc === state.fc
      );
    }

    /* Search filter (Style / SKU) */
    if (state.search) {
      const q = state.search.toLowerCase();
      filteredRows = filteredRows.filter(
        r =>
          (r.style && r.style.toLowerCase().includes(q)) ||
          (r.sku && r.sku.toLowerCase().includes(q))
      );
    }

    onFilterApplied({
      filteredRows,
      originalView: view
    });
  }

  /* -----------------------------
     Event: MP Change
  ----------------------------- */
  mpSelect.addEventListener("change", () => {
    state.mp = mpSelect.value;
    state.fc = "ALL";
    state.search = "";

    const view = getActiveView(state.mp);
    populateFCOptions(view?.filters?.fcList || []);

    fcSelect.value = "ALL";
    searchInput.value = "";

    applyFilters();
  });

  /* -----------------------------
     Event: FC Change
  ----------------------------- */
  fcSelect.addEventListener("change", () => {
    state.fc = fcSelect.value;
    applyFilters();
  });

  /* -----------------------------
     Event: Search
  ----------------------------- */
  searchInput.addEventListener("input", e => {
    state.search = e.target.value.trim();
    applyFilters();
  });

  /* -----------------------------
     Reset (Public API)
  ----------------------------- */
  function reset() {
    state = { mp: "ALL", fc: "ALL", search: "" };
    mpSelect.value = "ALL";
    clearFCOptions();
    fcSelect.value = "ALL";
    searchInput.value = "";
    applyFilters();
  }

  return {
    reset
  };
}
