/**
 * APP ORCHESTRATOR
 * VA4.1 — CONSOLIDATED + ENRICHED
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

/* DERIVATION */
import { deriveSellerSales } from "./domain/seller/sellerDerivation.js";

/* VA4 ENGINE */
import { buildDemandUniverse } from "./domain/va4/buildDemandUniverse.js";
import { consolidateDemandRows } from "./domain/va4/consolidateDemandRows.js";
import { applyAllocation } from "./domain/va4/applyAllocation.js";
import { distributeToFC } from "./domain/va4/distributeToFC.js";
import { enrichMpRows } from "./domain/va4/enrichMpRows.js";

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

/* ============================= */

const app = document.getElementById("app");
app.innerHTML = "";
app.appendChild(renderAppHeader());
app.appendChild(renderFiltersBar());

const tabsContainer = document.createElement("div");
const content = document.createElement("div");
app.appendChild(tabsContainer);
app.appendChild(content);

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

    const { mpSales, sellerSales } = deriveSellerSales({
      sale30D,
      fcStock
    });

    /* VA4 PIPELINE */
    const demand = buildDemandUniverse({ mpSales, sellerSales });
    const consolidated = consolidateDemandRows(demand);
    const allocated = applyAllocation({ demandRows: consolidated, uniwareStock });
    const distributed = distributeToFC({
      allocatedRows: allocated,
      fallbackFCsByMP: {
        AMAZON: ["BLR8", "HYD3", "BOM5", "CJB1", "DEL5"],
        FLIPKART: ["MALUR", "KOLKATA", "SANPKA", "HYDERABAD", "BHIWANDI"],
        MYNTRA: ["Bangalore", "Mumbai", "Bilaspur"],
        SELLER: []
      }
    });

    const finalRows = enrichMpRows({
      rows: distributed,
      fcStock,
      companyRemarks
    });

    /* BUILD VIEWS */
    const mpViews = {};
    ["AMAZON", "FLIPKART", "MYNTRA"].forEach(mp => {
      const rows = finalRows.filter(r => r.mp === mp);
      mpViews[mp] = buildMpView({
        mp,
        summaries: {
          fcStock: fcStockSummary(fcStock, mp),
          fcSale: fcSaleSummary(rows, fcStock, mp),
          topSkus: mpTopSkuSummary(rows),
          topStyles: mpTopStyleSummary(rows),
          shipment: shipmentSummary(rows)
        },
        reportRows: rows,
        filters: { fcList: [...new Set(rows.map(r => r.fc))] }
      });
    });

    const sellerRows = finalRows.filter(r => r.mp === "SELLER");
    const sellerView = buildSellerView({
      summaries: { shipment: sellerSummary({ sellerRows }) },
      reportRows: sellerRows,
      filters: { fcList: [...new Set(sellerRows.map(r => r.fc))] }
    });

    tabsContainer.appendChild(
      renderTabs(tab => renderTab(tab, mpViews, sellerView))
    );

    renderTab("AMAZON", mpViews, sellerView);

  } catch (e) {
    console.error(e);
    content.innerHTML =
      `<div style="padding:16px;color:red">Failed to load app. Check console.</div>`;
  }
}

/* ============================= */

function renderTab(tab, mpViews, sellerView) {
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

  sections[0].replaceWith(renderSummaryTable({
    title: "FC Wise Stock",
    columns: ["FC", "Total Stock"],
    rows: view.summaries.fcStock,
    showGrandTotal: true
  }));

  sections[1].replaceWith(renderSummaryTable({
    title: "FC Wise Sale | DRR | Stock Cover",
    columns: ["FC", "Total Sale", "DRR", "Stock Cover"],
    rows: view.summaries.fcSale,
    showGrandTotal: true
  }));

  sections[2].replaceWith(renderSummaryTable({
    title: "MP Wise Top 10 SKUs",
    columns: ["SKU", "Total Sale", "DRR"],
    rows: view.summaries.topSkus
  }));

  sections[3].replaceWith(renderSummaryTable({
    title: "MP Wise Top 10 Styles",
    columns: ["Style", "Total Sale", "DRR"],
    rows: view.summaries.topStyles
  }));

  sections[4].replaceWith(renderSummaryTable({
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
  }));

  sections[5].replaceWith(
    renderReportTable({
      rows: view.report.rows,
      includeRecall: true
    })
  );

  content.appendChild(page);
}
