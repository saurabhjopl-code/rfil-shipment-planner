/**
 * VA4 DEMAND ROW CONTRACT
 *
 * This is a PURE demand object.
 * No stock, no shipment, no recall.
 */

export function createDemandRow({
  mp,
  fc = null,        // null for SELLER
  style,
  sku,
  uniwareSku,
  saleQty,
  drr,
  actualDemand,
  mpDW,
  fcDW,
  styleDW,
  skuDW,
  finalDW
}) {
  return {
    mp,
    fc,
    style,
    sku,
    uniwareSku,
    saleQty,
    drr,
    actualDemand,
    mpDW,
    fcDW,
    styleDW,
    skuDW,
    finalDW
  };
}

