"use strict";
// Starter data loads from JSON before IndexedDB is seeded.
let starterData = {
  foods: [],
  prices: [],
  meals: [],
  example: {},
};
let FOOD_REQUIREMENTS = {};
async function loadStarterData() {
  const names = ["foods", "prices", "meals", "example"];
  const files = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`data/${name}.json`);
      if (!response.ok)
        throw Error(`Could not load data/${name}.json (${response.status})`);
      const rows = await response.json();
      if (
        name === "example"
          ? !rows || Array.isArray(rows) || typeof rows !== "object"
          : !Array.isArray(rows)
      )
        throw Error(`data/${name}.json has an invalid format`);
      return [name, rows];
    }),
  );
  starterData = Object.fromEntries(files);
  FOOD_REQUIREMENTS = Object.fromEntries(
    starterData.foods.map((food) => [
      food.name,
      [food.storage, food.needsCooking],
    ]),
  );
}
function foodRequirements(item) {
  if (!item) return { storage: "unknown", needsCooking: null };
  const fallback = FOOD_REQUIREMENTS[item.name];
  return {
    storage: item.storage || fallback?.[0] || "unknown",
    needsCooking: item.needsCooking ?? fallback?.[1] ?? null,
  };
}

async function seedStarterData() {
  const foods = await getAll("inventory");
  const recipes = await getAll("recipes");
  // Seed once, but seed again if there are no meals at all, so an emptied
  // database never leaves the planner with nothing to choose from.
  if (localStorage.getItem(SEED_FLAG) && recipes.length) return;
  const findFood = (name, unit) =>
    foods.find((food) => key(food.name) === key(name) && food.unit === unit);
  for (const seed of starterData.foods) {
    if (foods.some((food) => key(food.name) === key(seed.name))) continue;
    const item = { ...seed, qty: 0, minimum: 0 };
    await put("inventory", item);
    foods.push(item);
  }
  for (const seed of starterData.meals) {
    if (recipes.some((recipe) => key(recipe.name) === key(seed.name))) continue;
    const ingredients = seed.ingredients.map((ingredient) => ({
      foodId: findFood(ingredient.name, ingredient.unit)?.id,
      qty: ingredient.qty,
    }));
    if (ingredients.some((ingredient) => !ingredient.foodId)) continue;
    await put("recipes", { ...seed, spice: seed.spice ?? 0, ingredients });
  }
  const prices = await getAll("prices");
  for (const { name, unit, ...estimate } of starterData.prices) {
    const item = findFood(name, unit);
    if (
      !item ||
      prices.some((price) => price.estimated && price.foodId === item.id)
    )
      continue;
    await put("prices", {
      ...estimate,
      foodId: item.id,
      recordedAt: new Date().toISOString(),
    });
  }
  localStorage.setItem(SEED_FLAG, "1");
}
