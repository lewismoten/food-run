"use strict";
$("#weekStart").addEventListener("change", () => {
  const d = parseDate($("#weekStart").value);
  if (isNaN(d)) return;
  $("#weekStart").value = weekKey(d);
  renderCalendar();
  renderPlan();
});
for (const [id, delta] of [
  ["prevWeek", -7],
  ["nextWeek", 7],
])
  $("#" + id).addEventListener("click", () => {
    $("#weekStart").value = fmt(
      addDays(parseDate($("#weekStart").value), delta),
    );
    renderCalendar();
    renderPlan();
  });
$("#calculate").addEventListener("click", () => {
  draftRequested = true;
  renderPlan();
  $("#draftCard").scrollIntoView?.({ behavior: "smooth", block: "start" });
  if (currentPlan?.error) toast(currentPlan.error);
  else if (!currentPlan?.mealCount && !currentPlan?.nextDay?.mealCount)
    toast("No recipes match the selected equipment");
  else if (!currentPlan?.mealCount)
    toast(
      currentPlan?.nextDay?.unknown
        ? "Add planning estimates for missing foods"
        : "Spending limit prevents one day",
    );
  else toast("Buy list ready to save.");
});
