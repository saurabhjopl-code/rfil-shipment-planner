/**
 * APP ORCHESTRATOR
 * VA4.3 — FILTER SAFE FIX
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

/* =============================
   INIT
============================= */

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
        reportRows: fixedRows
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
      reportRows: sellerResult.rows
    });

    tabsContainer.appendChild(
      renderTabs(tab => renderTab(tab))
    );

    renderTab("AMAZON");

  } catch (e) {
    console.error(e);
    content.innerHTML =
      `<div style="padding:16px;color:red">Failed to load app. Check console.</div>`;
  }
}

/* =============================
   TAB RENDERING
============================= */

function renderTab(tab) {
  content.innerHTML = "";

  if (tab === "SELLER") {
    const page = renderPageShell("SELLER");
    const sections = page.querySelectorAll(".section");

    sections[0].replaceWith(
      renderSummaryTable({
        title: "Seller Shipment Summary",
        columns: ["Total Seller Sale", "Shipment Qty"],
        rows: sellerView.summaries.shipment,
        showGrandTotal: false
      })
    );

    sections[1].replaceWith(
      renderReportTable({
        rows: sellerView.report.rows,
        includeRecall: false
      })
    );

    content.appendChild(page);
    return;
  }

  const view = mpViews[tab];
  const page = renderPageShell(tab);
  const sections = page.querySelectorAll(".section");

  sections[0].replaceWith(
    renderSummaryTable({
      title: "FC Wise Stock",
      columns: ["FC", "Total Stock"],
      rows: view.summaries.fcStock,
      showGrandTotal: true
    })
  );

  sections[1].replaceWith(
    renderSummaryTable({
      title: "FC Wise Sale | DRR | Stock Cover",
      columns: ["FC", "Total Sale", "DRR", "Stock Cover"],
      rows: view.summaries.fcSale,
      showGrandTotal: true
    })
  );

  sections[2].replaceWith(
    renderSummaryTable({
      title: "MP Wise Top 10 SKUs",
      columns: ["SKU", "Total Sale", "DRR"],
      rows: view.summaries.topSkus
    })
  );

  sections[3].replaceWith(
    renderSummaryTable({
      title: "MP Wise Top 10 Styles",
      columns: ["Style", "Total Sale", "DRR"],
      rows: view.summaries.topStyles
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
      rows: view.summaries.shipment,
      showGrandTotal: true
    })
  );

  sections[5].replaceWith(
    renderReportTable({
      rows: view.report.rows,
      includeRecall: true
    })
  );

  content.appendChild(page);
}
