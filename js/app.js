/**
 * APP ORCHESTRATOR
 * VA4.3 — FILTERS WIRED
 * Core logic LOCKED
 */

import { SOURCES } from "./ingest/sources.js";
import { loadCSV } from "./ingest/loadSheets.js";
import { parseCSV } from "./ingest/parseCSV.js";
import {
  normalizeSale30D,
  normalizeFCStock,
  normalizeUniwareStock,
  normalizeCompanyRemarks
} from "./ingest/normalize.js";

/* DOMAIN */
import { planMP } from "./domain/mp/mpPlanner.js";
import { deriveSellerSales } from "./domain/seller/sellerDerivation.js";
import { planSellerShipments } from "./domain/seller/sellerPlanner.js";
import { enforceShipmentCeiling } from "./domain/mp/enforceShipmentCeiling.js";

/* SUMMARIES */
import { fcStockSummary } from "./summaries/fcStockSummary.js";
import { fcSaleSummary } from "./summaries/fcSaleSummary.js";
import { mpTopSkuSummary } from "./summaries/mpTopSkuSummary.js";
import { mpTopStyleSummary } from "./summaries/mpTopStyleSummary.js";
import { shipmentSummary } from "./summaries/shipmentSummary.js";
import { sellerSummary } from "./summaries/sellerSummary.js";

/* VIEW MODELS */
import { buildMpView } from "./viewModels/buildMpView.js";
import { buildSellerView } from "./viewModels/buildSellerView.js";

/* UI */
import { renderAppHeader } from "./ui/layout/appHeader.js";
import { renderFiltersBar } from "./ui/layout/filtersBar.js";
import { renderTabs } from "./ui/layout/tabs.js";
import { renderPageShell } from "./ui/layout/pageShell.js";
import { renderSummaryTable } from "./ui/render/summaryTables.js";
import { renderReportTable } from "./ui/render/reportTable.js";

/* FILTERS */
import { initFilterController } from "./ui/interaction/filterController.js";
import { applyFilters } from "./ui/interaction/filterUtils.js";

/* =============================
   BOOTSTRAP
============================= */

const app = document.getElementById("app");
app.innerHTML = "";

app.appendChild(renderAppHeader());
app.appendChild(renderFiltersBar());

const tabsContainer = document.createElement("div");
const content = document.createElement("div");

app.appendChild(tabsContainer);
app.appendChild(content);

let mpViews = {};
let sellerView = null;
let activeTab = "AMAZON";

init();

async function init() {
  try {
    const [saleCSV, fcCSV, uniCSV, remarksCSV] =
      await Promise.all([
        loadCSV(SOURCES.sale30D),
        loadCSV(SOURCES.fcStock),
        loadCSV(SOURCES.uniwareStock),
        loadCSV(SOURCES.companyRemarks)
      ]);

    const sale30D = normalizeSale30D(parseCSV(saleCSV));
    const fcStock = normalizeFCStock(parseCSV(fcCSV));
    const uniwareStock = normalizeUniwareStock(parseCSV(uniCSV));
    const companyRemarks = normalizeCompanyRemarks(parseCSV(remarksCSV));

    const { mpSales, sellerSales } = deriveSellerSales({ sale30D, fcStock });

    const MPs = ["AMAZON", "FLIPKART", "MYNTRA"];
    mpViews = {};
    const allMpPlanningRows = [];

    MPs.forEach(mp => {
      const mpResult = planMP({
        mp,
        mpSales,
        fcStock,
        companyRemarks,
        uniwareStock
      });

      const fixedRows = enforceShipmentCeiling(mpResult.rows);
      allMpPlanningRows.push(...fixedRows);

      mpViews[mp] = buildMpView({
        mp,
        summaries: {
          fcStock: fcStockSummary(fcStock, mp),
          fcSale: fcSaleSummary(fixedRows, fcStock, mp),
          topSkus: mpTopSkuSummary(fixedRows),
          topStyles: mpTopStyleSummary(fixedRows),
          shipment: shipmentSummary(fixedRows)
        },
        reportRows: fixedRows,
        filters: {
          fcList: [
            ...new Set(
              fcStock.filter(r => r.mp === mp).map(r => r.warehouseId)
            )
          ]
        }
      });
    });

    const sellerResult = planSellerShipments({
      sellerSales,
      uniwareStock,
      companyRemarks,
      mpPlanningRows: allMpPlanningRows,
      fallbackFCsByMP: {
        AMAZON: ["BLR8", "HYD3", "BOM5", "CJB1", "DEL5"],
        FLIPKART: ["MALUR", "KOLKATA", "SANPKA", "HYDERABAD", "BHIWANDI"],
        MYNTRA: ["Bangalore", "Mumbai", "Bilaspur"]
      }
    });

    sellerView = buildSellerView({
      summaries: {
        shipment: sellerSummary({ sellerRows: sellerResult.rows })
      },
      reportRows: sellerResult.rows,
      filters: {
        fcList: [...new Set(sellerResult.rows.map(r => r.fc))]
      }
    });

    tabsContainer.appendChild(
      renderTabs(tab => {
        activeTab = tab;
        populateFcFilter(tab);
        renderTab();
      })
    );

    initFilterController({ onChange: renderTab });

    populateFcFilter(activeTab);
    renderTab();

  } catch (e) {
    console.error(e);
    content.innerHTML =
      `<div style="padding:16px;color:red">Failed to load app. Check console.</div>`;
  }
}

/* =============================
   HELPERS
============================= */

function populateFcFilter(tab) {
  const select = document.getElementById("fcFilter");
  if (!select) return;

  select.innerHTML = `<option value="">All FCs</option>`;

  const fcs =
    tab === "SELLER"
      ? sellerView.filters.fcList
      : mpViews[tab].filters.fcList;

  fcs.forEach(fc => {
    const opt = document.createElement("option");
    opt.value = fc;
    opt.textContent = fc;
    select.appendChild(opt);
  });
}

/* =============================
   TAB RENDERING
============================= */

function renderTab() {
  content.innerHTML = "";

  if (activeTab === "SELLER") {
    const rows = applyFilters(sellerView.report.rows);

    const page = renderPageShell("SELLER");
    const sections = page.querySelectorAll(".section");

    sections[0].replaceWith(
      renderSummaryTable({
        title: "Seller Shipment Summary",
        columns: ["Total Seller Sale", "Shipment Qty"],
        rows: sellerSummary({ sellerRows: rows }),
        showGrandTotal: false
      })
    );

    sections[1].replaceWith(
      renderReportTable({
        rows,
        includeRecall: false
      })
    );

    content.appendChild(page);
    return;
  }

  const view = mpViews[activeTab];
  const rows = applyFilters(view.report.rows);

  const page = renderPageShell(activeTab);
  const sections = page.querySelectorAll(".section");

  sections[0].replaceWith(
    renderSummaryTable({
      title: "FC Wise Stock",
      columns: ["FC", "Total Stock"],
      rows: fcStockSummary(rows, activeTab),
      showGrandTotal: true
    })
  );

  sections[1].replaceWith(
    renderSummaryTable({
      title: "FC Wise Sale | DRR | Stock Cover",
      columns: ["FC", "Total Sale", "DRR", "Stock Cover"],
      rows: fcSaleSummary(rows),
      showGrandTotal: true
    })
  );

  sections[2].replaceWith(
    renderSummaryTable({
      title: "MP Wise Top 10 SKUs",
      columns: ["SKU", "Total Sale", "DRR"],
      rows: mpTopSkuSummary(rows)
    })
  );

  sections[3].replaceWith(
    renderSummaryTable({
      title: "MP Wise Top 10 Styles",
      columns: ["Style", "Total Sale", "DRR"],
      rows: mpTopStyleSummary(rows)
    })
  );

  sections[4].replaceWith(
    renderSummaryTable({
      title: "Shipment & Recall Summary",
      columns: [
        "FC",
        "Total Stock",
        "Total Sale",
        "DRR",
        "Actual Shipment Qty",
        "Shipment Qty",
        "Recall Qty"
      ],
      rows: shipmentSummary(rows),
      showGrandTotal: true
    })
  );

  sections[5].replaceWith(
    renderReportTable({
      rows,
      includeRecall: true
    })
  );

  content.appendChild(page);
}
