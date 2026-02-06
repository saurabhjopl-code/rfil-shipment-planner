/**
 * VA4 — APPLY UNIWARE 40% ALLOCATION
 *
 * INPUT:
 * - demandRows  (output of Phase A)
 * - uniwareStock (normalized)
 *
 * OUTPUT:
 * - demandRows + shipmentQty + allocationRemarks
 *
 * RULES:
 * - 40% Uniware per Uniware SKU
 * - ShipmentQty = min(Allocatable × FinalDW, ActualDemand)
 * - If Uniware = 0 → Shipment = 0, remark
 * - If demand > 0 but allocation < 1 → round UP to 1
 *
 * ❌ No recall
 * ❌ No FC redistribution
 * ❌ No UI
 */

export function applyAllocation({
  demandRows,
  uniwareStock
}) {
  /* -----------------------------
     Uniware stock by Uniware SKU
  ----------------------------- */
  const uniwareByUniSku = new Map();
  uniwareStock.forEach(r => {
    uniwareByUniSku.set(
      r.uniwareSku,
      (uniwareByUniSku.get(r.uniwareSku) || 0) + r.qty
    );
  });

  /* -----------------------------
     Allocatable 40% per Uniware SKU
  ----------------------------- */
  const allocatableByUniSku = new Map();
  uniwareByUniSku.forEach((qty, uniSku) => {
    allocatableByUniSku.set(
      uniSku,
      Math.floor(qty * 0.4)
    );
  });

  /* -----------------------------
     Group rows by Uniware SKU
  ----------------------------- */
  const rowsByUniSku = new Map();
  demandRows.forEach(r => {
    if (!rowsByUniSku.has(r.uniwareSku)) {
      rowsByUniSku.set(r.uniwareSku, []);
    }
    rowsByUniSku.get(r.uniwareSku).push({ ...r });
  });

  /* -----------------------------
     Apply allocation
  ----------------------------- */
  const allocatedRows = [];

  rowsByUniSku.forEach((rows, uniSku) => {
    const allocatable =
      allocatableByUniSku.get(uniSku) || 0;

    if (allocatable <= 0) {
      rows.forEach(r => {
        allocatedRows.push({
          ...r,
          shipmentQty: 0,
          allocationRemarks: "Uniware stock-out"
        });
      });
      return;
    }

    rows.forEach(r => {
      let theoretical =
        allocatable * (r.finalDW || 0);

      let shipmentQty = Math.min(
        Math.floor(theoretical),
        r.actualDemand
      );

      if (
        shipmentQty === 0 &&
        r.actualDemand > 0 &&
        theoretical > 0
      ) {
        shipmentQty = 1;
      }

      let remark = "";
      if (shipmentQty < r.actualDemand) {
        remark = "40% Uniware / DW constrained";
      }

      allocatedRows.push({
        ...r,
        shipmentQty,
        allocationRemarks: remark
      });
    });
  });

  return allocatedRows;
}
