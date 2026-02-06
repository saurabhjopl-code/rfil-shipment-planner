/**
 * SEARCH CONTROLLER
 *
 * Search logic is handled centrally via filterState
 * This file exists for future extensibility
 */

export function matchesSearch(row, search) {
  if (!search) return true;

  const style = (row.style || "").toLowerCase();
  const sku = (row.sku || "").toLowerCase();

  return style.includes(search) || sku.includes(search);
}
