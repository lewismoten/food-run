"use strict";
const EMPTY_CHOICE = {
  meal: "— No meal —",
  snack: "— No snack —",
  drink: "— No drink —",
};
function renderCalendar() {
  const start = parseDate($("#weekStart").value || weekKey(new Date()));
  const openGroups = new Set(
    $$("#calendarGrid details[open]").map((details) => details.dataset.group),
  );
  $("#calendarGrid").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const date = fmt(day);
    const entryFor = (slot) =>
      state.schedule.find((x) => x.date === date && x.slot === slot);
    const renderSlot = (slot) => {
      const entry = entryFor(slot);
      const kind = slotKind(slot);
      const choices = state.recipes.filter(
        (r) => r.id === entry?.recipeId || slotAccepts(r, slot),
      );
      const size =
        kind === "meal" && entry?.mealSize ? ` · ${esc(entry.mealSize)}` : "";
      return `<label class="meal"><small>${slot}${entry ? ` · ${entry.confirmedAt ? "Purchased" : "Idea"}${size}` : ""}</small><select data-date="${date}" data-slot="${slot}">${options(choices, entry?.recipeId || "", EMPTY_CHOICE[kind], mealName)}</select></label>`;
    };
    const group = (label, groupSlots) => {
      const id = `${date}:${label}`;
      const filled = groupSlots.filter((slot) => entryFor(slot)?.recipeId);
      return `<details class="snack-slots" data-group="${id}" ${openGroups.has(id) ? "open" : ""}>
        <summary>${label} (${filled.length}/${groupSlots.length})</summary>
        ${groupSlots.map(renderSlot).join("")}
      </details>`;
    };
    return `<div class="day"><h3>${day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</h3>
      ${mealSlots.map(renderSlot).join("")}
      ${group("Snacks", snackSlots)}
      ${group("Drinks", drinkSlots)}</div>`;
  }).join("");
}
