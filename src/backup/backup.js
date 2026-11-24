"use strict";
$("#export").addEventListener("click", () => {
  const blob = new Blob(
      [
        JSON.stringify(
          {
            app: APP_NAME,
            version: 1,
            exportedAt: new Date().toISOString(),
            data: state,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "food-run-backup-" + fmt(new Date()) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
async function replaceData(data) {
  if (
    !data ||
    !CORE_STORES.every((s) => Array.isArray(data[s])) ||
    (data.savedLists && !Array.isArray(data.savedLists))
  )
    throw Error("Invalid backup format");
  for (const s of STORES) await clearStore(s);
  for (const s of STORES) for (const x of data[s] || []) await put(s, x);
  await reload();
}
$("#import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    let data = JSON.parse(await file.text());
    if (
      data.app !== APP_NAME ||
      !confirm("Replace all existing data with this backup?")
    )
      return;
    await replaceData(data.data);
    toast("Backup restored");
  } catch (err) {
    alert("Could not import: " + err.message);
  } finally {
    e.target.value = "";
  }
});
$("#clear").addEventListener("click", async () => {
  if (
    !confirm(
      "Replace all your Food Run data with the starter foods, prices, and meals? Export a backup first.",
    )
  )
    return;
  if (!starterData.foods.length || !starterData.meals.length)
    return alert(
      "The starter data files didn't load, so nothing was changed. Reload the page (Cmd+Shift+R or Ctrl+Shift+R) and try again.",
    );
  try {
    await replaceData(Object.fromEntries(STORES.map((s) => [s, []])));
    localStorage.removeItem(SEED_FLAG);
    await seedStarterData();
    await reload();
    toast(
      `Starter data restored: ${state.inventory.length} foods, ${state.recipes.length} meals, ${state.prices.length} prices`,
    );
  } catch (error) {
    alert("Could not reset to starter data: " + error.message);
  }
});
$("#sample").addEventListener("click", async () => {
  if (
    state.inventory.length &&
    !confirm("Replace your data with example data?")
  )
    return;
  const example = starterData.example;
  const foods = example.foods.map((seed) => ({
    id: uid(),
    name: seed.name,
    qty: seed.qty,
    unit: seed.unit,
    minimum: seed.minimum,
    storage: FOOD_REQUIREMENTS[seed.name]?.[0] || "unknown",
    needsCooking: FOOD_REQUIREMENTS[seed.name]?.[1] ?? null,
  }));
  const foodId = (name) => foods.find((food) => food.name === name)?.id;
  const prices = example.prices.map((seed) => ({
    id: uid(),
    foodId: foodId(seed.name),
    qty: seed.qty,
    price: seed.price,
    estimated: true,
  }));
  const recipes = example.meals.map((seed) => ({
    id: uid(),
    name: seed.name,
    servings: seed.servings,
    taste: seed.taste,
    mealType: seed.mealType,
    heatMethods: seed.heatMethods,
    directions: seed.directions,
    ingredients: seed.ingredients.map((ingredient) => ({
      foodId: foodId(ingredient.name),
      qty: ingredient.qty,
    })),
  }));
  const recipeId = (name) => recipes.find((recipe) => recipe.name === name)?.id;
  const start = parseDate($("#weekStart").value);
  const schedule = [];
  for (let day = 0; day < 7; day++)
    for (const slot of slots) {
      const pattern = example.weeklySchedule[slot];
      const name = Array.isArray(pattern)
        ? pattern[day % pattern.length]
        : pattern;
      if (!recipeId(name)) continue;
      schedule.push({
        id: uid(),
        date: fmt(addDays(start, day)),
        slot,
        recipeId: recipeId(name),
      });
    }
  await replaceData({
    inventory: foods,
    prices,
    recipes,
    schedule,
  });
  toast("Example data loaded");
});
