"use strict";
const mealSlots = ["Breakfast", "Lunch", "Dinner"];
const snackSlots = ["Snack 1", "Snack 2", "Snack 3"];
const drinkSlots = ["Breakfast drink", "Lunch drink", "Dinner drink"];
// Saved lists map recipe positions to these slots, so new slots go last.
const slots = [...mealSlots, ...snackSlots, ...drinkSlots];
const mealPortions = { small: 0.75, medium: 1, large: 2 };
const isSnackSlot = (slot) => snackSlots.includes(slot);
const isDrinkSlot = (slot) => drinkSlots.includes(slot);
const slotKind = (slot) =>
  isDrinkSlot(slot) ? "drink" : isSnackSlot(slot) ? "snack" : "meal";
const recipeKind = (r) =>
  r.mealType === "drink" ? "drink" : r.mealType === "snack" ? "snack" : "meal";
// The meal a drink slot goes with, such as "breakfast" for "Breakfast drink".
const drinkMeal = (slot) => slot.split(" ")[0].toLowerCase();
function slotAccepts(r, slot) {
  const kind = slotKind(slot);
  if (recipeKind(r) !== kind) return false;
  if (kind === "drink") return (r.drinkFor || []).includes(drinkMeal(slot));
  if (kind === "snack") return true;
  return !r.mealType || r.mealType === "any" || r.mealType === slot.toLowerCase();
}
const HEAT_OPTIONS = [
  ["none", "No heat"],
  ["microwave", "Microwave"],
  ["hotplate", "Hotplate / stovetop"],
  ["oven", "Oven"],
  ["microwave,hotplate", "Microwave or hotplate"],
];
const heatMethods = (value) => (value === "none" ? [] : value.split(","));
const recipeHeatValue = (r) =>
  r.heatMethods === undefined
    ? "unknown"
    : r.heatMethods.length
      ? r.heatMethods.join(",")
      : "none";
// Preparation levels, easiest first. Meals without one count as Cooking.
const PREP_LABELS = ["No prep", "Easy", "Cooking", "Skilled"];
const PREP_SKILLED = 3;
const prepLevel = (r) =>
  Number.isInteger(r.prep) && r.prep >= 0 && r.prep <= PREP_SKILLED ? r.prep : 2;
