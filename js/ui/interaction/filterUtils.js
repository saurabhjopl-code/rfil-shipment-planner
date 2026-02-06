import { filterState } from "./filterController.js";
import { matchesSearch } from "./searchController.js";

/**
 * Apply FC + Search filters to rows
 * Works for MP & SELLER
 */
export function applyFilters(rows) {
  return rows.filter(r => {
    if (filterState.fc && r.fc !== filterState.fc) return false;
    if (!matchesSearch(r, filterState.search)) return false;
    return true;
  });
}
