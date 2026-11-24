"use strict";
async function submitInventory(event) {
  event.preventDefault();
  const v = Object.fromEntries(new FormData(event.target)),
    name = v.name.trim(),
    qty = num(v.qty),
    unit = v.unit,
    minimum = num(v.minimum);
  let existing = state.inventory.find(
    (x) => key(x.name) === key(name) && x.unit === unit,
  );
  if (existing)
    await put("inventory", {
      ...existing,
      qty: existing.qty + qty,
      minimum,
    });
  else
    await put("inventory", {
      id: uid(),
      name,
      qty,
      unit,
      minimum,
      storage: v.storage,
      needsCooking: Boolean(v.needsCooking),
    });
  event.target.reset();
  if (event.target.id === "mobileInventoryForm")
    closeFoodDialog($("#addFoodDialog"));
  await reload();
  toast("Food on hand updated");
}
$("#inventoryForm").addEventListener("submit", submitInventory);
$("#mobileInventoryForm").addEventListener("submit", submitInventory);
$("#priceForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  let v = Object.fromEntries(new FormData(e.target));
  if (!food(v.food)) return toast("Select a food");
  await put("prices", {
    id: uid(),
    foodId: v.food,
    qty: num(v.qty),
    price: num(v.price),
    observedAt: v.observedAt,
    product: v.product.trim(),
    estimated: Boolean(v.estimated),
    recordedAt: new Date().toISOString(),
  });
  e.target.reset();
  $("#priceDate").value = fmt(new Date());
  await reload();
});
$("#chartFood").addEventListener("change", renderPriceChart);
$("#chartProduct").addEventListener("change", renderPriceChart);
