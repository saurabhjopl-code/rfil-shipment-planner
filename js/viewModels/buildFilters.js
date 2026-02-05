/**
 * FILTER VIEW MODEL CONTRACT
 *
 * UI reads this to populate dropdowns.
 * UI NEVER infers values on its own.
 */

export function buildFilters({
  mpList,
  fcList
}) {
  return {
    mpList: mpList || ["AMAZON", "FLIPKART", "MYNTRA", "SELLER"],
    fcList: fcList || []
  };
}
