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

import {
  fcStockSummary,
  fcSaleSummary
} from "./summaries/fcStockSummary.js";
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

// -----------------------------
// APP BOOTSTRAP
// -----------------------------

const app = document.getElementById("app");
app.innerHTML = "";

app.appendChild(renderAppHeader());
app.appendChild(renderFiltersBar());

const tabsContainer = document.createElement("div");
const content = document.createElement("div");

app.appendChild(tabsContainer);
app.appendChild(content);

// -----------------------------
// LOAD & RUN PIPELINE
// -----------------------------

init();

async function init() {
  try {
    // 1️⃣ Load CSVs
    const [
      saleCSV,
      fcStockCSV,
      uniwareCSV,
      remarksCSV
    ] = await Promise.all([
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

    // 4️⃣ Derive SELLER
    const { mpSales, sellerSales } = deriveSellerSales({
      sale30D,
      fcStock
    });

    // 5️⃣ Run MP planners
    const MPs = ["AMAZON", "FLIPKART", "MYNTRA"];
    const mpViews = {};

    let remainingUniwareGlobal = null;

    MPs.forEach(mp => {
      const mpResult = planMP({
        mp,
        mpSales,
        fcStock,
        uniwareStock,
        companyRemarks
      });

      remainingUniwareGlobal = mpResult.remainingUniware;

      // 6️⃣ Build summaries
      const summaries = {
        fcStock: fcStockSummary(mpResult.rows),
        fcSale: fcSaleSummary(mpResult.rows),
        topSkus: mpTopSkuSummary(mpResult.rows),
        topStyles: mpTopStyleSummary(mpResult.rows),
        shipment: shipmentSummary(mpResult.rows)
      };

      // 7️⃣ Build ViewModel
      mpViews[mp] = buildMpView({
        mp,
        summaries,
        reportRows: mpResult.rows,
        filters: {
          fcList: [...new Set(mpResult.rows.map(r => r.fc))]
        }
      });
    });

    // 8️⃣ Build SELLER view (shipment only, filtered later)
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

    // 9️⃣ Render tabs
    const tabs = renderTabs(tab => renderTab(tab, mpViews, sellerView));
    tabsContainer.appendChild(tabs);

    // Initial render
    renderTab("AMAZON", mpViews, sellerView);

  } catch (err) {
    console.error(err);
    content.innerHTML = `<div style="padding:16px;color:red">
      Error loading data. Check console.
    </div>`;
  }
}

// -----------------------------
// TAB RENDERING
// -----------------------------

function renderTab(tab, mpViews, sellerView) {
  content.innerHTML = "";

  if (tab === "SELLER") {
    const page = renderPageShell("SELLER");
    content.appendChild(page);

    // SELLER rendering will be added later
    return;
  }

  const view = mpViews[tab];
  const page = renderPageShell(tab);

  const sections = page.querySelectorAll(".section");

  // Summary Grid (4 blocks)
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

  // Shipment summary
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

  // Report table
  sections[5].replaceWith(
    renderReportTable({
      rows: view.report.rows,
      includeRecall: true
    })
  );

  content.appendChild(page);
}
