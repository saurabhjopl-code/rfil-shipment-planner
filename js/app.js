/**
 * APP ORCHESTRATOR
 * VA4.0 — UNIFIED DEMAND + ALLOCATION ENGINE
 *
 * VA3 planners untouched (frozen)
 * VA4 engine ACTIVE
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

/* VA3 — DERIVATION ONLY */
import { deriveSellerSales } from "./domain/seller/sellerDerivation.js";

/* VA4 ENGINE */
import { buildDemandUniverse } from "./domain/va4/buildDemandUniverse.js";
import { applyAllocation } from "./domain/va4/applyAllocation.js";
import { distributeToFC } from "./domain/va4/distributeToFC.js";

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

/* =============================
   INIT
============================= */

init();

async function init() {
  try {
    /* 1️⃣ LOAD */
    const [saleCSV, fcCSV, uniCSV, remarksCSV] =
      await Promise.all([
        loadCSV(SOURCES.sale30D),
        loadCSV(SOURCES.fcStock),
        loadCSV(SOURCES.uniwareStock),
        loadCSV(SOURCES.companyRemarks)
      ]);

    /* 2️⃣ PARSE */
    const saleRows = parseCSV(saleCSV);
    const fcRows = parseCSV(fcCSV);
    const uniRows = parseCSV(uniCSV);
    const remarksRows = parseCSV(remarksCSV);

    /* 3️⃣ NORMALIZE */
    const sale30D = normalizeSale30D(saleRows);
    const fcStock = normalizeFCStock(fcRows);
    const uniwareStock = normalizeUniwareStock(uniRows);
    const companyRemarks = normalizeCompanyRemarks(remarksRows);

    /* 4️⃣ DERIVE SELLER */
    const { mpSales, sellerSales } = deriveSellerSales({
      sale30D,
      fcStock
    });

    /* =============================
       VA4 ENGINE
    ============================= */

    /* Phase A — Demand + DW */
    const demandRows = buildDemandUniverse({
      mpSales,
      sellerSales
    });

    /* Phase B — 40% Allocation */
    const allocatedRows = applyAllocation({
      demandRows,
      uniwareStock
    });

    /* Phase C — FC Distribution */
    const fallbackFCsByMP = {
      AMAZON: ["BLR8", "HYD3", "BOM5", "CJB1", "DEL5"],
      FLIPKART: ["MALUR", "KOLKATA", "SANPKA", "HYDERABAD", "BHIWANDI"],
      MYNTRA: ["Bangalore", "Mumbai", "Bilaspur"],
      SELLER: []
    };

    const finalRows = distributeToFC({
      allocatedRows,
      fallbackFCsByMP
    });

    /* =============================
       BUILD MP VIEWS
    ============================= */

    const MPs = ["AMAZON", "FLIPKART", "MYNTRA"];
    const mpViews = {};

    MPs.forEach(mp => {
      const mpRows = finalRows.filter(r => r.mp === mp);

      mpViews[mp] = buildMpView({
        mp,
        summaries: {
          fcStock: fcStockSummary(fcStock, mp),
          fcSale: fcSaleSummary(mpRows, fcStock, mp),
          topSkus: mpTopSkuSummary(mpRows),
          topStyles: mpTopStyleSummary(mpRows),
          shipment: shipmentSummary(mpRows)
        },
        reportRows: mpRows,
        filters: {
          fcList: [
            ...new Set(
              mpRows
                .map(r => r.fc)
                .filter(Boolean)
            )
          ]
        }
      });
    });

    /* =============================
       SELLER VIEW
    ============================= */

    const sellerRows = finalRows.filter(r => r.mp === "SELLER");

    const sellerView = buildSellerView({
      summaries: {
        shipment: sellerSummary({
          sellerRows
        })
      },
      reportRows: sellerRows,
      filters: {
        fcList: [...new Set(sellerRows.map(r => r.fc))]
      }
    });

    /* =============================
       TABS
    ============================= */

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

/* =============================
   TAB RENDERING
============================= */

function renderTab(tab, mpViews, sellerView) {
  content.innerHTML = "";

  /* SELLER TAB */
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

  /* MP TAB */
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
