import { renderAppHeader } from "./ui/layout/appHeader.js";
import { renderFiltersBar } from "./ui/layout/filtersBar.js";
import { renderTabs } from "./ui/layout/tabs.js";
import { renderPageShell } from "./ui/layout/pageShell.js";

const app = document.getElementById("app");

app.appendChild(renderAppHeader());
app.appendChild(renderFiltersBar());

const content = document.createElement("div");
app.appendChild(renderTabs(changeTab));
app.appendChild(content);

function changeTab(tab) {
  content.innerHTML = "";
  content.appendChild(renderPageShell(tab));
}

// Initial load
changeTab("AMAZON");
