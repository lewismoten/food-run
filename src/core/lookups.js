"use strict";
const food = (id) => state.inventory.find((x) => x.id === id);
const recipe = (id) => state.recipes.find((x) => x.id === id);
const foodName = (item) => (item ? item.name : "Removed food");
const mealName = (item) => (item ? item.name : "Removed meal");
const savedFoodName = (row) => foodName(food(row.foodId) || { name: row.name });
const savedMealName = (id, name) => mealName(recipe(id) || { name });
function planningPrices(foodId) {
  const byQuantity = new Map();
  for (const offer of state.prices) {
    if (!offer.estimated || offer.foodId !== foodId || !(offer.qty > 0))
      continue;
    const previous = byQuantity.get(offer.qty);
    if (!previous || (offer.recordedAt || "") >= (previous.recordedAt || ""))
      byQuantity.set(offer.qty, offer);
  }
  return [...byQuantity.values()];
}
const options = (
  items,
  selected = "",
  empty = "— Select —",
  label = (item) => item.name,
) =>
  `<option value="">${empty}</option>` +
  items
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${x.id === selected ? "selected" : ""}>${esc(label(x))}</option>`,
    )
    .join("");
const STORAGE_LABELS = {
  shelf: "Shelf stable",
  refrigerated: "Refrigerator",
  frozen: "Freezer",
  unknown: "Review storage",
};
function requirementText(item) {
  const r = foodRequirements(item);
  return `${STORAGE_LABELS[r.storage]} · ${r.needsCooking === null ? "Review cooking" : r.needsCooking ? "Cooking marked" : "No cooking marked"}`;
}
function requirementEditor(item) {
  const r = foodRequirements(item);
  return `<select data-food-storage="${esc(item.id)}" aria-label="Storage for ${esc(item.name)}">
    ${Object.entries(STORAGE_LABELS)
      .map(
        ([value, label]) =>
          `<option value="${value}" ${r.storage === value ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select>
    <label class="checkbox-label"><input type="checkbox" data-food-cooking="${esc(item.id)}" ${r.needsCooking ? "checked" : ""}> Cook first</label>`;
}
