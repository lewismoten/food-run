"use strict";
const tasteRating = (r) => Math.max(1, Math.min(5, num(r.taste) || 3));
// getPlan builds many trial plans from the same foods and prices. While it
// runs, this cache keeps lookups that don't change between trials.
let planCache = null;
function cached(name, key, compute) {
  if (!planCache) return compute();
  const store = planCache[name];
  if (!store.has(key)) store.set(key, compute());
  return store.get(key);
}
const planFood = (id) => cached("foods", id, () => food(id));
const basicsOn = () =>
  planCache ? planCache.basics : $("#haveBasics").checked;
// Starter foods marked basic: common spices, condiments, oil, and sugar.
// Foods saved before the flag existed match a starter food by name.
const isBasic = (item) =>
  Boolean(
    item &&
      (item.basic ??
        starterData.foods.some(
          (seed) => seed.basic && key(seed.name) === key(item.name),
        )),
  );
// With "I have the basics" on, basic foods count as unlimited stock, so plans
// never buy them and meals that use them cost nothing extra for them.
const stockOf = (item) =>
  basicsOn() && isBasic(item) ? Infinity : num(item.qty);
// The planning price with the lowest cost per unit for a food.
const cheapestOffer = (foodId) =>
  cached(
    "offers",
    foodId,
    () =>
      planningPrices(foodId).sort((a, b) => a.price / a.qty - b.price / b.qty)[0],
  );
function availableEquipment() {
  return {
    fridge: $("#hasFridge").checked,
    freezer: $("#hasFreezer").checked,
    microwave: $("#hasMicrowave").checked,
    hotplate: $("#hasHotplate").checked,
    oven: $("#hasOven").checked,
    prep: Number($("#prepLevel").value),
  };
}
function recipeCompatible(r, equipment) {
  if (!planCache) return checkRecipeCompatible(r, equipment);
  if (!planCache.compatible.has(equipment))
    planCache.compatible.set(equipment, new Map());
  const byRecipe = planCache.compatible.get(equipment);
  if (!byRecipe.has(r.id)) byRecipe.set(r.id, checkRecipeCompatible(r, equipment));
  return byRecipe.get(r.id);
}
function checkRecipeCompatible(r, equipment) {
  if (!r) return false;
  // Only a drink, such as tap water, can have no ingredients.
  if (!r.ingredients?.length && r.mealType !== "drink") return false;
  const ingredients = r.ingredients || [];
  if (ingredients.some((i) => !planFood(i.foodId))) return false;
  if (prepLevel(r) > equipment.prep) return false;
  if (r.servings > 1 && !equipment.fridge) return false;
  for (const ing of ingredients) {
    const req = foodRequirements(planFood(ing.foodId));
    if (req.storage === "refrigerated" && !equipment.fridge) return false;
    if (req.storage === "frozen" && !equipment.freezer) return false;
    if (
      req.needsCooking &&
      Array.isArray(r.heatMethods) &&
      !r.heatMethods.length
    )
      return false;
  }
  return (
    r.heatMethods === undefined ||
    !r.heatMethods.length ||
    r.heatMethods.some((method) => equipment[method])
  );
}
function estimatedMealCost(r) {
  return cached("mealCosts", r.id, () => servingCost(r));
}
function servingCost(r) {
  if (!r.ingredients?.length) return r.mealType === "drink" ? 0 : Infinity;
  let total = 0;
  for (const ing of r.ingredients) {
    const item = planFood(ing.foodId);
    if (item && stockOf(item) === Infinity) continue;
    const offer = cheapestOffer(ing.foodId);
    if (!offer || !item) return Infinity;
    total += (ing.qty / r.servings) * (offer.price / offer.qty);
  }
  return total;
}
// What a meal adds to the grocery total: whole packages beyond what is on hand
// and already planned. Leftovers from earlier meals in the plan cost nothing.
function marginalMealCost(r, scale, requirements) {
  if (!r.ingredients?.length) return r.mealType === "drink" ? 0 : Infinity;
  let total = 0;
  for (const ing of r.ingredients) {
    const item = planFood(ing.foodId);
    if (item && stockOf(item) === Infinity) continue;
    const offer = cheapestOffer(ing.foodId);
    if (!offer || !item) return Infinity;
    const planned = requirements.get(ing.foodId) || 0;
    const packages = (need) =>
      Math.ceil((Math.max(0, need - stockOf(item)) - 1e-9) / offer.qty);
    const added = (ing.qty / r.servings) * scale;
    total += (packages(planned + added) - packages(planned)) * offer.price;
  }
  return total;
}
// Meal scores count new packages twice as heavily as the per-serving cost, so
// the planner favors meals that use food already on the list.
const NEW_PACKAGE_WEIGHT = 2;
// A meal can't repeat on the same day or the day after; see isRepeat. Drinks
// marked repeats, such as morning coffee and evening tea, are exempt.
// Beyond that, this score is added to a meal used two to four days ago, plus a
// little for every earlier use, so plans spread meals out. The planner scales
// it by a variety level from 0 (no penalty) to 1.
const REPEAT_PENALTY = {
  byDaysAgo: [0, 0, 0.6, 0.3, 0.15],
  perUse: 0.04,
};
const isRepeat = (r, variety) =>
  !r.repeats && (variety.lastDay.get(r.id) ?? -Infinity) >= variety.day - 1;
// Variety levels the planner tries, strongest first, below the slider's cap.
const VARIETY_LEVELS = [1, 0.75, 0.5, 0.35, 0.25, 0.15, 0.1, 0.05];
// The slider's low end gets finer steps, where tight budgets need them.
const varietyCap = (value) => Math.max(0, Math.min(1, num(value) / 100)) ** 1.5;
function repeatPenalty(r, variety) {
  if (!variety.level || r.repeats) return 0;
  const id = r.id;
  const daysAgo = variety.day - (variety.lastDay.get(id) ?? -Infinity);
  return (
    ((REPEAT_PENALTY.byDaysAgo[daysAgo] || 0) +
      REPEAT_PENALTY.perUse * (variety.uses.get(id) || 0)) *
    variety.level
  );
}
function chooseMeal(
  scheduled,
  tastePreference,
  slot,
  equipment,
  variety,
  requirements,
  scale,
) {
  let candidates = state.recipes.filter((r) => {
    const matchesSlot =
      slotAccepts(r, slot) ||
      (r.id === scheduled?.id && recipeKind(r) === slotKind(slot));
    return (
      matchesSlot && !isRepeat(r, variety) && recipeCompatible(r, equipment)
    );
  });
  // A fallback drink, such as water, never takes the place of morning coffee
  // or evening tea; it is used there only when no such drink fits.
  if (candidates.some((r) => r.repeats))
    candidates = candidates.filter((r) => !r.fallback);
  if (!candidates.length) return null;
  // A drink that can repeat daily, such as coffee, spreads its package price
  // over the days left in the plan, since one package serves many mornings.
  const daysLeft = Math.max(1, variety.horizon - variety.day);
  const costs = candidates.map(
    (r) =>
      estimatedMealCost(r) * scale +
      (NEW_PACKAGE_WEIGHT * marginalMealCost(r, scale, requirements)) /
        (r.repeats ? daysLeft : 1),
  );
  const finite = costs.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  let best = candidates[0],
    bestScore = Infinity;
  candidates.forEach((r, i) => {
    const costScore = Number.isFinite(costs[i])
      ? max === min
        ? 0
        : (costs[i] - min) / (max - min)
      : 1;
    const flavorScore = (5 - tasteRating(r)) / 4;
    const spicePenalty =
      Math.abs((Number(r.spice) || 0) - Number($("#spicePreference").value)) /
      5;
    const costWeight = 1 - tastePreference;
    const score =
      costWeight * costScore +
      tastePreference * flavorScore +
      spicePenalty * 0.5 +
      (r.id === scheduled?.id ? 0 : 0.02 + repeatPenalty(r, variety));
    if (score < bestScore) {
      best = r;
      bestScore = score;
    }
  });
  return best;
}
// horizon is the number of days requested. It stays fixed while getPlan tries
// shorter plans, so each day's choices don't depend on the trial length.
function quotePlan(
  days,
  tastePreference,
  equipment,
  mealPortion,
  level = 0,
  horizon = days,
) {
  const firstDay = parseDate($("#planStartDate").value || fmt(new Date()));
  const requirements = new Map(),
    coverage = [],
    variety = {
      level,
      horizon,
      day: 0,
      lastDay: new Map(),
      uses: new Map(),
    };
  for (let n = 0; n < days; n++) {
    const date = addDays(firstDay, n);
    variety.day = n;
    const chosen = slots.map((slot, index) => {
      const entry = state.schedule.find(
        (x) => x.date === fmt(date) && x.slot === slot,
      );
      const scale = index < mealSlots.length ? mealPortion : 1;
      const selected = chooseMeal(
        entry ? recipe(entry.recipeId) : null,
        tastePreference,
        slot,
        equipment,
        variety,
        requirements,
        scale,
      );
      if (!selected) return null;
      variety.lastDay.set(selected.id, n);
      variety.uses.set(selected.id, (variety.uses.get(selected.id) || 0) + 1);
      for (const ing of selected.ingredients || [])
        requirements.set(
          ing.foodId,
          (requirements.get(ing.foodId) || 0) +
            (ing.qty / selected.servings) * scale,
        );
      return selected;
    });
    const meals = chosen.filter(Boolean);
    coverage.push({
      date: fmt(date),
      meals: meals.map((r) => r.name),
      recipeIds: chosen.map((r) => r?.id || null),
      tastes: meals.map(tasteRating),
      recipes: meals,
      mainMeals: chosen.slice(0, mealSlots.length).filter(Boolean),
      snacks: chosen
        .slice(mealSlots.length, mealSlots.length + snackSlots.length)
        .filter(Boolean),
      drinks: chosen.slice(mealSlots.length + snackSlots.length).filter(Boolean),
    });
  }
  for (const item of state.inventory)
    if (item.minimum > 0) {
      const planned = requirements.get(item.id) || 0;
      if (stockOf(item) - planned < item.minimum)
        requirements.set(item.id, planned + item.minimum);
    }
  const rows = [];
  for (const [id, need] of requirements) {
    const f = planFood(id);
    if (!f) continue;
    const missing = Math.max(0, need - stockOf(f));
    if (missing <= 0.000001) continue;
    const offers = planningPrices(id);
    const price = offers.sort(
      (a, b) =>
        Math.ceil((missing - 1e-9) / a.qty) * a.price -
        Math.ceil((missing - 1e-9) / b.qty) * b.price,
    )[0];
    const packages = price ? Math.ceil((missing - 1e-9) / price.qty) : null;
    rows.push({
      foodId: id,
      name: f.name,
      unit: f.unit,
      need,
      missing,
      price,
      packages,
      cost: price ? packages * price.price : null,
      checked: false,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const tastes = coverage.flatMap((d) => d.tastes);
  const mealCount = coverage.reduce(
    (count, day) => count + day.recipes.length,
    0,
  );
  const prepReview = coverage
    .flatMap((d) => d.recipes)
    .filter(
      (r) =>
        !r.directions ||
        r.heatMethods === undefined ||
        r.ingredients.some((i) => {
          const requirement = foodRequirements(planFood(i.foodId));
          return (
            requirement.storage === "unknown" ||
            requirement.needsCooking === null
          );
        }),
    ).length;
  return {
    days,
    rows,
    coverage,
    total: roundMoney(rows.reduce((s, r) => s + (r.cost || 0), 0)),
    unknown: rows.filter((r) => r.cost === null).length,
    prepReview,
    mealCount,
    distinctMeals: variety.uses.size,
    missingSlots: days * slots.length - mealCount,
    // Empty slots by kind, such as { meal: 0, snack: 0, drink: 21 }.
    missingByKind: Object.fromEntries(
      ["meal", "snack", "drink"].map((kind) => [
        kind,
        coverage.reduce(
          (count, day) =>
            count +
            day.recipeIds.filter((id, index) => !id && slotKind(slots[index]) === kind)
              .length,
          0,
        ),
      ]),
    ),
    averageTaste: tastes.length
      ? tastes.reduce((s, x) => s + x, 0) / tastes.length
      : 0,
  };
}
// The grocery total never drops when a day is added, so a binary search finds
// the most days that fit the spending limit.
const fitsBudget = (q, budget) =>
  q.mealCount > 0 && !q.unknown && q.total <= budget + 0.001;
// The plan for the day after the last affordable one, shown as a warning.
// A day with no compatible meals is not a spending-limit problem.
function nextDayQuote(days, targetDays, quote, level) {
  const next = days < targetDays ? quote(days + 1, level) : null;
  return next?.mealCount ? next : null;
}
function longestPlanWithinBudget(targetDays, budget, quote, level) {
  const fits = (q) => fitsBudget(q, budget);
  let low = 0,
    high = targetDays,
    result = null;
  while (low < high) {
    const days = Math.ceil((low + high) / 2);
    const q = quote(days, level);
    if (fits(q)) {
      low = days;
      result = q;
    } else high = days - 1;
  }
  if (result?.days !== low) result = low ? quote(low, level) : null;
  return { result, nextDay: nextDayQuote(low, targetDays, quote, level) };
}
// Use the most variety, up to the slider's cap, that still covers as many
// days as the cheapest repeat plan. Weaker levels cost less in practice, so a
// binary search finds the strongest level that fits the spending limit.
function planWithVariety(targetDays, budget, quote, cap) {
  const cheapest = longestPlanWithinBudget(targetDays, budget, quote, 0);
  let { result, nextDay } = cheapest;
  const levels = cap
    ? [cap, ...VARIETY_LEVELS.filter((level) => level < cap)]
    : [];
  let low = 0,
    high = levels.length,
    chosenLevel = 0;
  while (result && low < high) {
    const middle = Math.floor((low + high) / 2);
    const varied = quote(cheapest.result.days, levels[middle]);
    if (fitsBudget(varied, budget)) {
      result = varied;
      chosenLevel = levels[middle];
      high = middle;
    } else low = middle + 1;
  }
  if (chosenLevel)
    nextDay = nextDayQuote(result.days, targetDays, quote, chosenLevel);
  return { result, nextDay, cheapestTotal: cheapest.result?.total ?? 0 };
}
function getPlan() {
  planCache = {
    foods: new Map(),
    offers: new Map(),
    mealCosts: new Map(),
    compatible: new Map(),
    basics: $("#haveBasics").checked,
  };
  try {
    return buildPlan();
  } finally {
    planCache = null;
  }
}
function buildPlan() {
  const targetDays = Math.max(
    1,
    Math.min(365, Math.floor(num($("#days").value) || 7)),
  );
  const budget = $("#budget").value === "" ? NaN : Number($("#budget").value);
  if (!Number.isFinite(budget) || budget < 0)
    return { error: "Enter how much money you have available." };
  const equipment = availableEquipment();
  const tastePreference = num($("#tastePriority").value) / 100;
  const mealSize = $("#mealSize").value || "medium";
  const cap = varietyCap($("#varietyPreference").value);
  const planOver = (kit, horizon) =>
    planWithVariety(
      targetDays,
      budget,
      (days, level) =>
        quotePlan(
          days,
          tastePreference,
          kit,
          mealPortions[mealSize],
          level,
          horizon,
        ),
      cap,
    );
  // First plan without spreading daily drinks' package prices (horizon 1) to
  // learn how many days the budget covers. Then spread them over that many
  // days, and keep that plan only if it covers at least as many days.
  const planFor = (kit) => {
    const plain = planOver(kit, 1);
    const days = plain.result?.days ?? 0;
    if (days < 2) return plain;
    const spread = planOver(kit, days);
    return (spread.result?.days ?? 0) >= days ? spread : plain;
  };
  let plan = planFor(equipment),
    scratchSkipped = false;
  // Baking staples come in whole packages. When buying them would cover fewer
  // days than skipping from-scratch recipes, skip them and say so.
  if (equipment.prep >= PREP_SKILLED) {
    const plain = planFor({ ...equipment, prep: PREP_SKILLED - 1 });
    if ((plain.result?.days ?? 0) > (plan.result?.days ?? 0)) {
      plan = plain;
      scratchSkipped = true;
    }
  }
  const { result, nextDay, cheapestTotal } = plan;
  return {
    cheapestTotal,
    scratchSkipped,
    ...(result || {
      days: 0,
      rows: [],
      coverage: [],
      total: 0,
      unknown: 0,
      prepReview: 0,
      mealCount: 0,
      distinctMeals: 0,
      missingSlots: 0,
      averageTaste: 0,
    }),
    targetDays,
    budget,
    mealSize,
    nextDay,
  };
}
