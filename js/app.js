/**
 * APP ORCHESTRATOR
 * This is the ONLY file allowed to wire data → logic → UI
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

import { deriveSellerSales } from "./domain/seller/sellerDerivation.js";
import { planMP } from "./domain/mp/mpPlanner.js";

/* 🔴 FIXED IMPORTS */
import { fcStockSummary } from "./summaries/fcStockSummary.js";
import { fcSaleSummary } from "./summaries/fcSaleSummary.js";
import { mpTopSkuSummary } from "./summaries/mpTopSkuSummary.js";
import { mpTopStyleSummary } from "./summaries/mpTopStyleSummary.js";
import { shipmentSummary } from "./summaries/shipmentSummary.js";
import { sellerSummary } from "./summaries/sellerSummary.js";

import { buildMpView } from "./viewModels/buildMpView.js";
import { buildSellerView } from "./viewModels/buildSellerView.js";

import { renderAppHeader } from "./ui/layout/appHeader.js";
import { renderFiltersBar } from "./ui/layout/filtersBar.js";
import { renderTabs } from "./ui/layout/tabs.js";
import { renderPageShell } from "./ui/layout/pageShell.js";

import { renderSummaryTable } from "./ui/render/summaryTables.js";
import { renderReportTable } from "./ui/render/reportTable.js";

/* =============================
   APP BOOTSTRAP
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
    // 1️⃣ Load CSVs
    const [saleCSV, fcStockCSV, uniwareCSV, remarksCSV] =
      await Promise.all([
        loadCSV(SOURCES.sale30D),
        loadCSV(SOURCES.fcStock),
        loadCSV(SOURCES.uniwareStock),
        loadCSV(SOURCES.companyRemarks)
      ]);

    // 2️⃣ Parse
    const saleRows = parseCSV(saleCSV);
    const fcStockRows = parseCSV(fcStockCSV);
    const uniwareRows = parseCSV(uniwareCSV);
    const remarksRows = parseCSV(remarksCSV);

    // 3️⃣ Normalize
    const sale30D = normalizeSale30D(saleRows);
    const fcStock = normalizeFCStock(fcStockRows);
    const uniwareStock = normalizeUniwareStock(uniwareRows);
    const companyRemarks = normalizeCompanyRemarks(remarksRows);

    // 4️⃣ SELLER derivation
    const { mpSales, sellerSales } = deriveSellerSales({
      sale30D,
      fcStock
    });

    // 5️⃣ MP Planning
    const MPs = ["AMAZON", "FLIPKART", "MYNTRA"];
    const mpViews = {};

    let remainingUniwareGlobal = 0;

    MPs.forEach(mp => {
      const mpResult = planMP({
        mp,
        mpSales,
        fcStock,
        uniwareStock,
        companyRemarks
      });

      remainingUniwareGlobal = mpResult.remainingUniware;

      const summaries = {
        fcStock: fcStockSummary(mpResult.rows),
        fcSale: fcSaleSummary(mpResult.rows),
        topSkus: mpTopSkuSummary(mpResult.rows),
        topStyles: mpTopStyleSummary(mpResult.rows),
        shipment: shipmentSummary(mpResult.rows)
      };

      mpViews[mp] = buildMpView({
        mp,
        summaries,
        reportRows: mpResult.rows,
        filters: {
          fcList: [...new Set(mpResult.rows.map(r => r.fc))]
        }
      });
    });

    // SELLER placeholder (next phase)
    const sellerView = buildSellerView({
      summaries: {
        shipment: sellerSummary({
          sellerRows: [],
          uniwareUsed: 0,
          remainingUniware: remainingUniwareGlobal
        })
      },
      reportRows: [],
      filters: { fcList: [] }
    });

    // Tabs
    tabsContainer.appendChild(
      renderTabs(tab => renderTab(tab, mpViews, sellerView))
    );

    renderTab("AMAZON", mpViews, sellerView);

  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <div style="padding:16px;color:red">
        Failed to load app. Check console for errors.
      </div>
    `;
  }
}

/* =============================
   TAB RENDERING
============================= */

function renderTab(tab, mpViews, sellerView) {
  content.innerHTML = "";

  if (tab === "SELLER") {
    content.appendChild(renderPageShell("SELLER"));
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
