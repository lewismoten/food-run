"use strict";
document.addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-delete]");
  if (delBtn) {
    let [s, id] = delBtn.dataset.delete.split(":");
    if (!confirm("Delete this item?")) return;
    await del(s, id);
    await reload();
  }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.foodStorage || t.dataset.foodCooking) {
    const item = food(t.dataset.foodStorage || t.dataset.foodCooking);
    if (item) {
      const change = t.dataset.foodStorage
        ? { storage: t.value }
        : { needsCooking: t.checked };
      await put("inventory", { ...item, ...change });
      await reload();
    }
  }
  if (t.dataset.inv) {
    let f = food(t.dataset.inv);
    await put("inventory", {
      ...f,
      [t.dataset.field]: Math.max(0, num(t.value)),
    });
    await reload();
  }
  if (t.dataset.date) {
    let entry = state.schedule.find(
      (x) => x.date === t.dataset.date && x.slot === t.dataset.slot,
    );
    if (t.value)
      await put("schedule", {
        id: entry?.id || uid(),
        date: t.dataset.date,
        slot: t.dataset.slot,
        recipeId: t.value,
      });
    else if (entry) await del("schedule", entry.id);
    await reload();
  }
});
