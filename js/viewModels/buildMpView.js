/**
 * MP VIEW MODEL CONTRACT
 *
 * This file defines the EXACT structure the UI expects
 * for AMAZON / FLIPKART / MYNTRA tabs.
 *
 * NO LOGIC HERE.
 * NO CALCULATIONS HERE.
 */

export function buildMpView({
  mp,
  summaries,
  reportRows,
  filters
}) {
  return {
    mp, // "AMAZON" | "FLIPKART" | "MYNTRA"

    summaries: {
      fcStock: summaries.fcStock || [],
      fcSale: summaries.fcSale || [],
      topSkus: summaries.topSkus || [],
      topStyles: summaries.topStyles || [],
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
