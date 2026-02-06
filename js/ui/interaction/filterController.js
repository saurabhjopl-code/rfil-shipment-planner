/**
 * FILTER CONTROLLER
 *
 * Single source of truth for UI filters
 */

export const filterState = {
  fc: "",
  search: ""
};

export function initFilterController({ onChange }) {
  const fcSelect = document.getElementById("fcFilter");
  const searchInput = document.getElementById("searchFilter");
  const resetBtn = document.getElementById("resetFilters");

  if (!fcSelect || !searchInput || !resetBtn) return;

  fcSelect.addEventListener("change", e => {
    filterState.fc = e.target.value;
    onChange();
  });

  searchInput.addEventListener("input", e => {
    filterState.search = e.target.value.trim().toLowerCase();
    onChange();
  });

  resetBtn.addEventListener("click", () => {
    filterState.fc = "";
    filterState.search = "";

    fcSelect.value = "";
    searchInput.value = "";

    onChange();
  });
}
