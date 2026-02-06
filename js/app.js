/**
 * APP ORCHESTRATOR
 * VA4.3 — FILTERS SAFE IMPLEMENTATION
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

/* =============================
   GLOBAL STATE (FILTER ONLY)
============================= */

const filterState = {
  fc: "ALL",
  search: ""
};

let mpViews = {};
let sellerView = null;
let currentPage = null;
let currentTab = "AMAZON";

/* =============================
   BOOTSTRAP
============================= */

const app = document.getElementById("app");
app.innerHTML = "";

app.appendChild(renderAppHeader());
app.appendChild(renderFiltersBar());

init();

/* =============================
   INIT
============================= */

async function init() {
  try {
    const [saleCSV, fcCSV, uniCSV, remarksCSV] =
      await Promise.all([
        loadCSV(SOURCES.sale30D),
        loadCSV(SOURCES.fcStock),
        loadCSV(SOURCES.uniwareStock),
        loadCSV(SOURCES.companyRemarks)
      ]);

    const saleRows = parseCSV(saleCSV);
    const fcRows = parseCSV(fcCSV);
    const uniRows = parseCSV(uniCSV);
    const remarksRows = parseCSV(remarksCSV);

    const sale30D = normalizeSale30D(saleRows);
    const fcStock = normalizeFCStock(fcRows);
    const uniwareStock = normalizeUniwareStock(uniRows);
    const companyRemarks = normalizeCompanyRemarks(remarksRows);

    const { mpSales, sellerSales } = deriveSellerSales({
      sale30D,
      fcStock
    });

    const MPs = ["AMAZON", "FLIPKART", "MYNTRA"];
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
              fcStock
                .filter(r => r.mp === mp)
                .map(r => r.warehouseId)
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

    app.appendChild(
      renderTabs(tab => {
        currentTab = tab;
        resetFilters();
        renderTab();
      })
    );

    wireFilters();
    renderTab();

  } catch (e) {
    console.error(e);
    app.innerHTML +=
      `<div style="padding:16px;color:red">Failed to load app. Check console.</div>`;
  }
}

/* =============================
   FILTER WIRING
============================= */

function wireFilters() {
  const fcSelect = document.getElementById("filter-fc");
  const searchInput = document.getElementById("search");

  fcSelect.onchange = () => {
    filterState.fc = fcSelect.value;
    renderTab();
  };

  searchInput.oninput = () => {
    filterState.search = searchInput.value.toLowerCase();
    renderTab();
  };
}

function resetFilters() {
  filterState.fc = "ALL";
  filterState.search = "";

  const fc = document.getElementById("filter-fc");
  const search = document.getElementById("search");

  if (fc) fc.value = "ALL";
  if (search) search.value = "";
}

/* =============================
   FILTER HELPERS
============================= */

function applyRowFilters(rows) {
  return rows.filter(r => {
    if (filterState.fc !== "ALL" && r.fc !== filterState.fc) return false;

    if (filterState.search) {
      const s = filterState.search;
      if (
        !String(r.sku).toLowerCase().includes(s) &&
        !String(r.style).toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    return true;
  });
}

/* =============================
   TAB RENDERING
============================= */

function renderTab() {
  if (currentPage) currentPage.remove();

  if (currentTab === "SELLER") {
    const rows = applyRowFilters(sellerView.report.rows);

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

    currentPage = page;
    app.appendChild(page);
    return;
  }

  const view = mpViews[currentTab];
  const filteredRows = applyRowFilters(view.report.rows);

  const page = renderPageShell(currentTab);
  const sections = page.querySelectorAll(".section");

  sections[0].replaceWith(
    renderSummaryTable({
      title: "FC Wise Stock",
      columns: ["FC", "Total Stock"],
      rows: fcStockSummary(filteredRows, currentTab),
      showGrandTotal: true
    })
  );

  sections[1].replaceWith(
    renderSummaryTable({
      title: "FC Wise Sale | DRR | Stock Cover",
      columns: ["FC", "Total Sale", "DRR", "Stock Cover"],
      rows: fcSaleSummary(filteredRows, [], currentTab),
      showGrandTotal: true
    })
  );

  sections[2].replaceWith(
    renderSummaryTable({
      title: "MP Wise Top 10 SKUs",
      columns: ["SKU", "Total Sale", "DRR"],
      rows: mpTopSkuSummary(filteredRows)
    })
  );

  sections[3].replaceWith(
    renderSummaryTable({
      title: "MP Wise Top 10 Styles",
      columns: ["Style", "Total Sale", "DRR"],
      rows: mpTopStyleSummary(filteredRows)
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
      rows: shipmentSummary(filteredRows),
      showGrandTotal: true
    })
  );

  sections[5].replaceWith(
    renderReportTable({
      rows: filteredRows,
      includeRecall: true
    })
  );

  currentPage = page;
  app.appendChild(page);
}
