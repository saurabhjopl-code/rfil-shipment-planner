export function renderAppHeader() {
  const header = document.createElement("div");
  header.className = "app-header";

  header.innerHTML = `
    <div class="left">
      <img src="assets/logo.png" alt="Logo" />
    </div>

    <div class="center">
      <div class="title">🚚 Shipment Planner</div>
    </div>

    <div class="right">
      <button disabled>Export ▼</button>
    </div>
  `;

  return header;
}
