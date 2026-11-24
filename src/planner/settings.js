"use strict";
const PLAN_FIELDS = [
  "planStartDate",
  "days",
  "budget",
  "mealSize",
  "hasFridge",
  "hasFreezer",
  "hasMicrowave",
  "hasHotplate",
  "hasOven",
  "haveBasics",
  "tastePriority",
  "spicePreference",
  "prepLevel",
  "varietyPreference",
];
function updatePlanControls() {
  $("#tasteValue").textContent = `${$("#tastePriority").value}% toward taste`;
  $("#spiceValue").textContent =
    Number($("#spicePreference").value) === 0
      ? "Mild"
      : `${$("#spicePreference").value} / 5 heat`;
  $("#prepValue").textContent =
    PREP_LABELS[Number($("#prepLevel").value)] || "Cooking";
  const variety = Number($("#varietyPreference").value);
  $("#varietyValue").textContent =
    variety === 0
      ? "Repeat cheapest meals"
      : variety <= 30
        ? "A little"
        : variety <= 70
          ? "Some"
          : "As much as fits";
}
function savePlanSettings() {
  let previous = {};
  try {
    previous = JSON.parse(localStorage.getItem("eat-cheap-plan-v1") || "{}");
  } catch {
    /* Ignore damaged saved preferences. */
  }
  localStorage.setItem(
    "eat-cheap-plan-v1",
    JSON.stringify({
      ...previous,
      ...Object.fromEntries(
        PLAN_FIELDS.map((id) => [
          id,
          $("#" + id).type === "checkbox"
            ? $("#" + id).checked
            : $("#" + id).value,
        ]),
      ),
    }),
  );
}
function restorePlanSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("eat-cheap-plan-v1") || "{}");
    for (const id of PLAN_FIELDS)
      if (Object.hasOwn(saved, id)) {
        const field = $("#" + id);
        if (field.type === "checkbox") field.checked = Boolean(saved[id]);
        else field.value = saved[id];
      }
  } catch {
    /* Ignore a damaged local preference; pantry data is in IndexedDB. */
  }
  updatePlanControls();
}
for (const id of PLAN_FIELDS)
  $("#" + id).addEventListener("change", savePlanSettings);
$("#days").addEventListener("change", renderPlan);
$("#planStartDate").addEventListener("change", renderPlan);
$("#budget").addEventListener("change", renderPlan);
$("#mealSize").addEventListener("change", renderPlan);
for (const id of [
  "hasFridge",
  "hasFreezer",
  "hasMicrowave",
  "hasHotplate",
  "hasOven",
  "haveBasics",
])
  $("#" + id).addEventListener("change", () => {
    updatePlanControls();
    renderPlan();
  });
$("#tastePriority").addEventListener("input", () => {
  updatePlanControls();
  savePlanSettings();
  renderPlan();
});
$("#spicePreference").addEventListener("input", () => {
  updatePlanControls();
  savePlanSettings();
  renderPlan();
});
$("#prepLevel").addEventListener("input", () => {
  updatePlanControls();
  savePlanSettings();
  renderPlan();
});
$("#varietyPreference").addEventListener("input", () => {
  updatePlanControls();
  savePlanSettings();
  renderPlan();
});
