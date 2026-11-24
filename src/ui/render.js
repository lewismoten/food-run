"use strict";
function renderMobileInventory(inv) {
  const container = $("#mobileInventoryList");
  const wasOpen = container.querySelector("details")?.open || false;
  const query = key($("#inventorySearch").value.trim());
  const row = (item) => {
    const requirements = foodRequirements(item);
    const details = [
      STORAGE_LABELS[requirements.storage] || "Review storage",
      requirements.needsCooking === null
        ? "Review prep"
        : requirements.needsCooking
          ? "Cook first"
          : "No cooking marked",
      item.minimum > 0 ? `Low at ${item.minimum} ${item.unit}` : "",
    ].filter(Boolean);
    return `<button type="button" class="mobile-food-row" data-edit-food="${esc(item.id)}" aria-label="Edit ${esc(foodName(item))}">
      <span class="mobile-food-main"><strong>${esc(foodName(item))}</strong><small>${esc(details.join(" · "))}</small></span>
      <span class="mobile-food-qty${item.minimum > 0 && item.qty <= item.minimum ? " is-low" : ""}">${item.qty} ${esc(item.unit)}</span>
    </button>`;
  };
  if (query) {
    const matches = inv.filter(
      (item) =>
        key(item.name).includes(query) || key(foodName(item)).includes(query),
    );
    container.innerHTML =
      matches.map(row).join("") || '<p class="muted">No matching foods.</p>';
    return;
  }
  const stocked = inv.filter((item) => item.qty > 0);
  const empty = inv.filter((item) => item.qty <= 0);
  container.innerHTML = `${stocked.map(row).join("") || '<p class="muted">Nothing on hand yet. Add food or confirm a grocery purchase.</p>'}
    ${empty.length ? `<details class="mobile-empty-foods" ${wasOpen ? "open" : ""}><summary>Other foods · ${empty.length}</summary>${empty.map(row).join("")}</details>` : ""}`;
}
function render() {
  const inv = state.inventory
    .slice()
    .sort((a, b) => foodName(a).localeCompare(foodName(b)));
  $("#stats").innerHTML =
    `<span class="stat"><b>${inv.length}</b> food options</span><span class="stat"><b>${state.recipes.length}</b> meal ideas</span><span class="stat"><b>${state.prices.length}</b> price entries</span><span class="stat"><b>${state.savedLists.filter((list) => !list.purchasedAt).length}</b> open lists</span>`;
  $("#lowStockCard").classList.toggle(
    "empty",
    !inv.some((x) => x.minimum > 0 && x.qty <= x.minimum),
  );
  $("#lowStock").innerHTML =
    inv
      .filter((x) => x.minimum > 0 && x.qty <= x.minimum)
      .map(
        (x) =>
          `<p class="warn">${esc(foodName(x))}: ${x.qty} ${esc(x.unit)} remaining</p>`,
      )
      .join("") || '<p class="good">No items flagged low.</p>';
  $("#inventoryRows").innerHTML =
    inv
      .map(
        (x) =>
          `<tr><td>${esc(foodName(x))}</td><td><input type="number" min="0" step="any" data-inv="${x.id}" data-field="qty" value="${x.qty}"></td><td>${esc(x.unit)}</td><td><input type="number" min="0" step="any" data-inv="${x.id}" data-field="minimum" value="${x.minimum}"></td><td>${requirementEditor(x)}</td><td><button class="danger tiny" data-delete="inventory:${x.id}">Delete</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="6">No food added yet.</td></tr>';
  renderMobileInventory(inv);
  $("#priceFood").innerHTML = options(inv, "", "— Select —", foodName);
  renderQuickProduct();
  $("#priceRows").innerHTML =
    state.prices
      .slice()
      .sort((a, b) => (b.observedAt || "").localeCompare(a.observedAt || ""))
      .map(
        (x) =>
          `<tr><td>${esc(foodName(food(x.foodId)))}${x.product ? `<small>${esc([x.brand, x.product].filter(Boolean).join(" · "))}</small>` : ""}${x.upc ? `<small>UPC ${esc(x.upc)}</small>` : ""}${productSafePhoto(x.photo) ? `<img class="product-thumb" src="${productSafePhoto(x.photo)}" alt="Product package">` : ""}</td><td>${esc(x.packageAmount ?? x.qty)} ${esc(x.packageUnit || food(x.foodId)?.unit || "")}</td><td>${money(x.price)}${x.servingsPerPackage > 0 ? `<small>${money(x.price / x.servingsPerPackage)} / serving${x.servingLabel ? ` · ${esc(x.servingLabel)}` : ""}</small>` : ""}</td><td>${money(x.price / x.qty)} / ${esc(food(x.foodId)?.unit || "unit")}</td><td>${esc(requirementText(food(x.foodId)))}</td><td><button class="secondary tiny" data-edit-price="${esc(x.id)}">Edit</button> <button class="danger tiny" data-delete="prices:${x.id}">Delete</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="6">No prices recorded.</td></tr>';
  const chartFood = $("#chartFood"),
    selectedFood = chartFood.value;
  chartFood.innerHTML = options(inv, selectedFood, "— Select food —", foodName);
  if (!chartFood.value && inv.length)
    chartFood.value =
      inv.find((x) =>
        state.prices.some(
          (p) => p.foodId === x.id && p.observedAt && !p.estimated,
        ),
      )?.id || inv[0].id;
  renderPriceChart();
  renderMealList();
  renderCalendar();
  renderPlan();
  renderSavedLists();
}
