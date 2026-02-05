/**
 * APP ORCHESTRATOR
 * VA3.2 — STABLE BASELINE
 *
 * MP planner LOCKED
 * Seller planner SIMPLIFIED
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

    /* 5️⃣ MP PLANNING */
    const MPs = ["AMAZON", "FLIPKART", "MYNTRA"];
    const mpViews = {};
    const allMpPlanningRows = [];

    MPs.forEach(mp => {
      const mpResult = planMP({
        mp,
        mpSales,
        fcStock,
        companyRemarks,
        uniwareStock
      });

      allMpPlanningRows.push(...mpResult.rows);

      mpViews[mp] = buildMpView({
        mp,
        summaries: {
          fcStock: fcStockSummary(fcStock, mp),
          fcSale: fcSaleSummary(mpResult.rows, fcStock, mp),
          topSkus: mpTopSkuSummary(mpResult.rows),
          topStyles: mpTopStyleSummary(mpResult.rows),
          shipment: shipmentSummary(mpResult.rows)
        },
        reportRows: mpResult.rows,
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

    /* 6️⃣ SELLER PLANNING (SIMPLIFIED) */
    const fallbackFCsByMP = {
      AMAZON: ["BLR8", "HYD3", "BOM5", "CJB1", "DEL5"],
      FLIPKART: ["MALUR", "KOLKATA", "SANPKA", "HYDERABAD", "BHIWANDI"],
      MYNTRA: ["Bangalore", "Mumbai", "Bilaspur"]
    };

    const sellerResult = planSellerShipments({
      sellerSales,
      uniwareStock,
      companyRemarks,
      mpPlanningRows: allMpPlanningRows,
      fallbackFCsByMP
    });

    const sellerView = buildSellerView({
      summaries: {
        shipment: sellerSummary({
          sellerRows: sellerResult.rows
        })
      },
      reportRows: sellerResult.rows,
      filters: {
        fcList: [...new Set(sellerResult.rows.map(r => r.fc))]
      }
    });

    /* 7️⃣ TABS */
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
        rows: sellerView.reportRows,
        mode: "SELLER"
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
      rows: view.reportRows,
      includeRecall: true
    })
  );

  content.appendChild(page);
}
