"use strict";
let openMealId = null;
const sortedFoods = () =>
  state.inventory.slice().sort((a, b) => a.name.localeCompare(b.name));
const formatQty = (qty) => String(Math.round(num(qty) * 1000) / 1000);

function showMealView(r) {
  openMealId = r.id;
  $("#mealDialogTitle").textContent = r.name;
  const link = safeRecipeLink(r.link);
  const ingredients = (r.ingredients || [])
    .map((i) => {
      const item = food(i.foodId);
      return `<li><span>${esc(foodName(item))}</span><span>${esc(formatQty(i.qty))} ${esc(item?.unit || "")}</span></li>`;
    })
    .join("");
  $("#mealView").innerHTML = `
    <p class="meal-meta">
      <span class="pill">${esc(mealTypeLabel(r))}</span>
      ${r.mealType === "drink" && drinkLabel(r) ? `<span class="pill">${esc(drinkLabel(r))}</span>` : ""}
      <span class="pill">${esc(mealHeatLabel(r))}</span>
      <span class="pill">${esc(PREP_LABELS[prepLevel(r)])}</span>
      <span class="pill">${r.servings} serving${r.servings === 1 ? "" : "s"}</span>
      <span class="pill">Taste ${tasteRating(r)}/5</span>
      <span class="pill">Heat ${num(r.spice)}/5</span>
    </p>
    <h3>Ingredients <small class="muted">whole batch</small></h3>
    ${ingredients ? `<ul class="meal-ingredients">${ingredients}</ul>` : `<p class="muted">${r.mealType === "drink" ? "No ingredients needed." : "No ingredients yet. Edit the meal to add some."}</p>`}
    <h3>Directions</h3>
    <p class="recipe-directions">${esc(r.directions || "No directions yet.")}</p>
    ${link ? `<p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open recipe ↗</a></p>` : ""}
    <div class="dialog-actions">
      <button type="button" class="secondary" data-close-dialog>Close</button>
      <button type="button" id="editMeal">Edit meal</button>
    </div>`;
  $("#mealView").hidden = false;
  $("#mealForm").hidden = true;
}

function toggleDrinkOptions() {
  $("#drinkOptions").hidden = $("#mealForm").elements.mealType.value !== "drink";
}
function ingredientRow(foodId = "", qty = 1) {
  return `<div class="ingredient-row">
    <select name="ingredientFood" aria-label="Ingredient">${options(sortedFoods(), foodId, "— Choose food —")}</select>
    <input name="ingredientQty" type="number" min="0.001" step="any" value="${esc(formatQty(qty))}" aria-label="Batch quantity">
    <span class="ingredient-unit">${esc(food(foodId)?.unit || "")}</span>
    <button type="button" class="secondary tiny" data-remove-ingredient-row aria-label="Remove ingredient">Remove</button>
  </div>`;
}

function showMealForm(r = null) {
  openMealId = r?.id || null;
  const form = $("#mealForm");
  form.reset();
  $("#mealDialogTitle").textContent = r ? `Edit ${r.name}` : "Add a meal";
  const heat = r ? recipeHeatValue(r) : "none";
  form.elements.heatMethod.innerHTML =
    (heat === "unknown"
      ? '<option value="unknown">Review method</option>'
      : "") +
    HEAT_OPTIONS.map(
      ([value, label]) => `<option value="${value}">${label}</option>`,
    ).join("");
  form.elements.heatMethod.value = heat;
  form.elements.mealId.value = r?.id || "";
  form.elements.name.value = r?.name || "";
  form.elements.mealType.value = r?.mealType || "dinner";
  form.elements.servings.value = r?.servings ?? 1;
  form.elements.taste.value = r ? tasteRating(r) : 3;
  form.elements.spice.value = r?.spice ?? 0;
  form.elements.link.value = r?.link || "";
  form.elements.prep.value = String(r ? prepLevel(r) : 2);
  for (const box of form.querySelectorAll("[name=drinkFor]"))
    box.checked = (r?.drinkFor || []).includes(box.value);
  form.elements.repeats.checked = Boolean(r?.repeats);
  toggleDrinkOptions();
  form.elements.directions.value = r?.directions || "";
  const rows = (r?.ingredients || []).filter((i) => food(i.foodId));
  $("#mealIngredientRows").innerHTML = rows.length
    ? rows.map((i) => ingredientRow(i.foodId, i.qty)).join("")
    : ingredientRow();
  $("#deleteMeal").hidden = !r;
  $("#mealView").hidden = true;
  form.hidden = false;
}

function readIngredients(form) {
  const merged = new Map();
  for (const row of form.querySelectorAll(".ingredient-row")) {
    const foodId = row.querySelector("[name=ingredientFood]").value;
    const qty = num(row.querySelector("[name=ingredientQty]").value);
    if (!foodId) continue;
    if (qty <= 0) throw Error("Give each ingredient a quantity above zero.");
    merged.set(foodId, (merged.get(foodId) || 0) + qty);
  }
  return [...merged].map(([foodId, qty]) => ({ foodId, qty }));
}

$("#mealList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-meal]");
  const r = button && recipe(button.dataset.openMeal);
  if (!r) return;
  showMealView(r);
  openFoodDialog($("#mealDialog"));
});
$("#addMeal").addEventListener("click", () => {
  showMealForm();
  openFoodDialog($("#mealDialog"));
});
$("#mealSearch").addEventListener("input", renderMealList);
$("#mealTypeFilter").addEventListener("change", renderMealList);
$("#mealPrepFilter").addEventListener("change", renderMealList);
$("#mealForm").elements.mealType.addEventListener("change", toggleDrinkOptions);
$("#mealView").addEventListener("click", (event) => {
  if (event.target.id !== "editMeal") return;
  const r = recipe(openMealId);
  if (r) showMealForm(r);
});
$("#addIngredientRow").addEventListener("click", () => {
  $("#mealIngredientRows").insertAdjacentHTML("beforeend", ingredientRow());
});
$("#mealIngredientRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-ingredient-row]");
  if (button) button.closest(".ingredient-row").remove();
});
$("#mealIngredientRows").addEventListener("change", (event) => {
  if (event.target.name !== "ingredientFood") return;
  event.target
    .closest(".ingredient-row")
    .querySelector(".ingredient-unit").textContent =
    food(event.target.value)?.unit || "";
});
$("#cancelMealEdit").addEventListener("click", () => {
  const r = recipe(openMealId);
  if (r) showMealView(r);
  else closeFoodDialog($("#mealDialog"));
});
$("#mealForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const v = Object.fromEntries(new FormData(form));
  let ingredients;
  try {
    ingredients = readIngredients(form);
  } catch (error) {
    return toast(error.message);
  }
  if (!ingredients.length && v.mealType !== "drink")
    return toast("Add at least one ingredient.");
  if (
    v.mealType === "drink" &&
    !form.querySelector("[name=drinkFor]:checked")
  )
    return toast("Choose at least one meal to serve the drink with.");
  const link = v.link.trim();
  if (link && !safeRecipeLink(link))
    return toast("Use a recipe link that starts with http:// or https://.");
  const existing = recipe(v.mealId);
  const meal = {
    ...(existing || {}),
    id: existing?.id || uid(),
    name: v.name.trim(),
    mealType: v.mealType,
    heatMethods:
      v.heatMethod === "unknown" ? undefined : heatMethods(v.heatMethod),
    servings: Math.max(1, Math.round(num(v.servings)) || 1),
    taste: Math.max(1, Math.min(5, num(v.taste) || 3)),
    spice: Math.max(0, Math.min(5, num(v.spice))),
    link: safeRecipeLink(link),
    prep: Number(form.elements.prep.value),
    ...(v.mealType === "drink"
      ? {
          drinkFor: [...form.querySelectorAll("[name=drinkFor]:checked")].map(
            (box) => box.value,
          ),
          repeats: form.elements.repeats.checked,
        }
      : { drinkFor: undefined, repeats: undefined }),
    directions: v.directions.trim(),
    ingredients,
  };
  await put("recipes", meal);
  await reload();
  showMealView(recipe(meal.id));
  toast(existing ? "Meal updated" : "Meal added");
});
$("#deleteMeal").addEventListener("click", async () => {
  const r = recipe(openMealId);
  if (!r || !confirm(`Delete ${r.name}?`)) return;
  await del("recipes", r.id);
  closeFoodDialog($("#mealDialog"));
  openMealId = null;
  await reload();
  toast("Meal deleted");
});
