const TABS = ["AMAZON", "FLIPKART", "MYNTRA", "SELLER"];

export function renderTabs(onTabChange) {
  const tabs = document.createElement("div");
  tabs.className = "tabs";

  TABS.forEach((tab, index) => {
    const el = document.createElement("div");
    el.className = "tab" + (index === 0 ? " active" : "");
    el.textContent = tab;

    el.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      el.classList.add("active");
      onTabChange(tab);
    };

    tabs.appendChild(el);
  });

  return tabs;
}
