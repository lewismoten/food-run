"use strict";
const MEAL_TYPE_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  any: "Any meal",
  snack: "Snack",
  drink: "Drink",
};
const HEAT_LABELS = {
  microwave: "Microwave",
  hotplate: "Hotplate",
  oven: "Oven",
};
const mealTypeLabel = (r) => MEAL_TYPE_LABELS[r.mealType] || "Any meal";
function mealHeatLabel(r) {
  if (r.heatMethods === undefined) return "Review heating";
  if (!r.heatMethods.length) return "No heat";
  return r.heatMethods.map((method) => HEAT_LABELS[method] || method).join(" or ");
}
// Only web links are shown, so a saved link cannot run script.
function safeRecipeLink(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
// For drinks: which meals they go with, and whether they can repeat daily.
function drinkLabel(r) {
  const meals = (r.drinkFor || []).map((meal) => MEAL_TYPE_LABELS[meal]);
  return [
    meals.length ? `With ${meals.join(", ").toLowerCase()}` : "",
    r.repeats ? "Can repeat every day" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
function mealSummary(r) {
  const cost = estimatedMealCost(r);
  return [
    mealTypeLabel(r),
    r.mealType === "drink" ? drinkLabel(r) : "",
    mealHeatLabel(r),
    PREP_LABELS[prepLevel(r)],
    cost === 0
      ? "free"
      : Number.isFinite(cost)
        ? `about ${money(cost)} a serving`
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
function renderMealList() {
  const query = key($("#mealSearch").value);
  const type = $("#mealTypeFilter").value;
  const prep = $("#mealPrepFilter").value;
  const meals = state.recipes
    .filter(
      (r) =>
        (!query || key(r.name).includes(query)) &&
        (!type || (r.mealType || "any") === type) &&
        (prep === "" || prepLevel(r) === Number(prep)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  $("#mealCount").textContent =
    meals.length === state.recipes.length
      ? `${state.recipes.length} meal${state.recipes.length === 1 ? "" : "s"}`
      : `${meals.length} of ${state.recipes.length} meals`;
  $("#mealList").innerHTML =
    meals
      .map(
        (r) =>
          `<li><button type="button" class="meal-row" data-open-meal="${esc(r.id)}"><strong>${esc(r.name)}</strong><small>${esc(mealSummary(r))}</small></button></li>`,
      )
      .join("") ||
    `<li class="muted meal-empty">${state.recipes.length ? "No matching meals." : "No meals yet. Add one to get started."}</li>`;
}
