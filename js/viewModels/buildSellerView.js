/**
 * SELLER VIEW MODEL CONTRACT
 *
 * SELLER is NOT an MP.
 * SELLER rows MUST already be filtered:
 *   shipmentQty > 0 only
 *
 * NO RECALL
 * NO ACTION COLUMN
 */

export function buildSellerView({
  summaries,
  reportRows,
  filters
}) {
  return {
    mp: "SELLER",

    summaries: {
      shipment: summaries.shipment || []
    },

    report: {
      rows: reportRows || [],
      pageSize: 50
    },

    filters: {
      fcList: filters.fcList || []
    }
  };
}
