"use strict";
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  $$("nav button").forEach((x) => x.classList.toggle("active", x === b));
  $("#mobileTab").value = b.dataset.tab;
  $$("main section").forEach((x) =>
    x.classList.toggle("active", x.id === b.dataset.tab),
  );
});
$("#mobileTab").addEventListener("change", (e) => {
  $(`#tabs [data-tab="${e.target.value}"]`).click();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#goGrocery").addEventListener("click", () => {
  $('#tabs [data-tab="grocery"]').click();
  $("#grocery").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#mobileInventoryForm").innerHTML = $("#inventoryForm").innerHTML;
function openFoodDialog(dialog) {
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute("open", "");
}
function closeFoodDialog(dialog) {
  if (dialog.close) dialog.close();
  else dialog.removeAttribute("open");
}
$("#openAddFood").addEventListener("click", () =>
  openFoodDialog($("#addFoodDialog")),
);
$("#inventorySearch").addEventListener("input", () =>
  renderMobileInventory(
    state.inventory
      .slice()
      .sort((a, b) => foodName(a).localeCompare(foodName(b))),
  ),
);
$("#mobileInventoryList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-food]");
  if (!button) return;
  const item = food(button.dataset.editFood);
  if (!item) return;
  const form = $("#foodEditForm");
  const requirements = foodRequirements(item);
  $("#foodEditName").textContent = `${item.name} · ${item.unit}`;
  form.elements.foodId.value = item.id;
  form.elements.qty.value = item.qty;
  form.elements.minimum.value = item.minimum ?? 0;
  form.elements.storage.value = requirements.storage;
  form.elements.needsCooking.checked = Boolean(requirements.needsCooking);
  openFoodDialog($("#foodEditDialog"));
});
$("#foodEditForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const item = food(form.elements.foodId.value);
  if (!item) return;
  const data = new FormData(form);
  await put("inventory", {
    ...item,
    qty: Math.max(0, num(data.get("qty"))),
    minimum: Math.max(0, num(data.get("minimum"))),
    storage: data.get("storage"),
    needsCooking: data.has("needsCooking"),
  });
  closeFoodDialog($("#foodEditDialog"));
  await reload();
  toast("Food updated");
});
$("#deleteFoodMobile").addEventListener("click", async () => {
  const item = food($("#foodEditForm").elements.foodId.value);
  if (!item || !confirm(`Delete ${item.name}?`)) return;
  await del("inventory", item.id);
  closeFoodDialog($("#foodEditDialog"));
  await reload();
  toast("Food deleted");
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-close-dialog]");
  if (button) closeFoodDialog(button.closest("dialog"));
});
