"use strict";
function renderPriceChart() {
  const id = $("#chartFood").value;
  const item = food(id);
  const productSelect = $("#chartProduct");
  const selectedProduct = productSelect.value;
  const products = [
    ...new Map(
      state.prices
        .filter((price) => price.foodId === id && price.upc)
        .map((price) => [price.upc, price]),
    ).values(),
  ];
  productSelect.innerHTML =
    '<option value="">All products</option>' +
    products
      .map(
        (price) =>
          `<option value="${esc(price.upc)}">${esc([price.brand, price.product].filter(Boolean).join(" · ") || price.upc)} · ${esc(price.upc)}</option>`,
      )
      .join("");
  if (products.some((price) => price.upc === selectedProduct))
    productSelect.value = selectedProduct;
  const points = state.prices
    .filter(
      (p) =>
        p.foodId === id &&
        p.observedAt &&
        p.qty > 0 &&
        !p.estimated &&
        (!productSelect.value || p.upc === productSelect.value),
    )
    .map((p) => ({ ...p, unitPrice: p.price / p.qty }))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const box = $("#priceChart");
  if (!points.length) {
    box.innerHTML =
      '<p class="muted">No dated prices yet. Record a price to start tracking this food.</p>';
    return;
  }
  const dates = [...new Set(points.map((p) => p.observedAt))];
  const low = Math.min(...points.map((p) => p.unitPrice));
  const high = Math.max(...points.map((p) => p.unitPrice));
  const ceiling = high === low ? high + 1 : high + (high - low) * 0.15;
  const floor = Math.max(0, low - (high - low || 1) * 0.15);
  const x = (date) =>
    65 + dates.indexOf(date) * (640 / Math.max(1, dates.length - 1));
  const y = (value) => 210 - ((value - floor) * 170) / (ceiling - floor);
  const groups = new Map();
  for (const p of points) {
    const name =
      [p.brand, p.product].filter(Boolean).join(" · ") || "Price observations";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(p);
  }
  const colors = ["#f5a15c", "#70cfc2", "#8dbaf8", "#f28d88", "#c9a7f5"];
  const lines = [...groups]
    .map(([name, entries], i) => {
      const color = colors[i % colors.length];
      const path = entries
        .map((p) => `${x(p.observedAt)},${y(p.unitPrice)}`)
        .join(" ");
      return (
        `<polyline points="${path}" fill="none" stroke="${color}" stroke-width="3" />` +
        entries
          .map(
            (p) =>
              `<circle cx="${x(p.observedAt)}" cy="${y(p.unitPrice)}" r="5" fill="${color}"><title>${esc(name)} · ${esc(p.observedAt)} · ${money(p.unitPrice)} / ${esc(item.unit)}</title></circle>`,
          )
          .join("")
      );
    })
    .join("");
  box.innerHTML = `<p class="muted">Price per ${esc(item.unit)} · ${points.length} dated observation${points.length === 1 ? "" : "s"}</p>
    <svg viewBox="0 0 770 260" role="img" aria-label="Price history for ${esc(foodName(item))}">
      <line x1="65" y1="40" x2="65" y2="210" stroke="#819388" />
      <line x1="65" y1="210" x2="705" y2="210" stroke="#819388" />
      <text x="5" y="45">${money(ceiling)}</text><text x="5" y="210">${money(floor)}</text>
      <text x="65" y="240">${esc(dates[0])}</text>
      ${dates.length > 1 ? `<text x="705" y="240" text-anchor="end">${esc(dates.at(-1))}</text>` : ""}
      ${lines}
    </svg>
    <div class="chart-legend">${[...groups.keys()].map((name, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${esc(name)}</span>`).join("")}</div>`;
}
