"use strict";
$("#saveList").addEventListener("click", async () => {
  const plan = currentPlan;
  if (!plan || plan.error || !plan.days || !plan.rows.length)
    return toast("Build a draft with groceries first");
  if (plan.unknown || plan.rows.some((row) => !row.price))
    return toast("Add prices for every food before saving");
  const list = {
    id: uid(),
    startDate: $("#planStartDate").value,
    days: plan.days,
    createdAt: new Date().toISOString(),
    purchasedAt: null,
    foodTotal: plan.total,
    mealSize: plan.mealSize,
    coverage: plan.coverage.map((day) => ({
      date: day.date,
      meals: day.meals,
      recipeIds: day.recipeIds,
    })),
    rows: plan.rows.map((row) => ({
      foodId: row.foodId,
      name: row.name,
      unit: row.unit,
      packages: row.packages,
      packageQty: row.price.qty,
      product: row.price.product || "",
      brand: row.price.brand || "",
      upc: row.price.upc || "",
      priceId: row.price.id,
      servingsPerPackage: row.price.servingsPerPackage || null,
      cost: row.cost,
      checked: false,
    })),
  };
  await put("savedLists", list);
  draftRequested = false;
  openSavedListId = list.id;
  await reload();
  $("#savedRunsCard").scrollIntoView({ behavior: "smooth", block: "start" });
  toast("List saved. Check items as they go in your basket.");
});
$("#newDraft").addEventListener("click", () => {
  draftRequested = false;
  $("#planStartDate").value = fmt(new Date());
  savePlanSettings();
  renderPlan();
  toast("Ready for a new draft");
});
$("#savedLists").addEventListener("change", async (e) => {
  const value = e.target.dataset.listCheck;
  if (!value) return;
  const [id, indexText] = value.split(":"),
    list = state.savedLists.find((x) => x.id === id),
    index = Number(indexText);
  if (
    !list ||
    list.purchasedAt ||
    !list.rows[index] ||
    list.rows[index].purchased
  )
    return;
  const rows = list.rows.map((row, i) =>
    i === index ? { ...row, checked: e.target.checked } : row,
  );
  await put("savedLists", { ...list, rows });
  await reload();
});
async function confirmSavedPurchase(list) {
  const selected = list.rows.filter((row) => row.checked && !row.purchased);
  if (list.purchasedAt || !selected.length)
    throw Error("Check an item after placing it in your basket");
  if (
    selected.some(
      (row) =>
        !food(row.foodId) || !Number.isFinite(row.packages * row.packageQty),
    )
  )
    throw Error("A saved food or package size is missing");
  const now = new Date().toISOString();
  const rows = list.rows.map((row) =>
    row.checked && !row.purchased ? { ...row, purchased: true } : row,
  );
  const complete = rows.every((row) => row.purchased);
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ["inventory", "schedule", "savedLists"],
      "readwrite",
    );
    const inventory = transaction.objectStore("inventory");
    const schedule = transaction.objectStore("schedule");
    for (const row of selected) {
      const item = food(row.foodId);
      inventory.put({
        ...item,
        qty: num(item.qty) + row.packages * row.packageQty,
      });
    }
    if (complete)
      for (const day of list.coverage)
        day.recipeIds.forEach((recipeId, index) => {
          if (!slots[index] || !recipeId || !recipe(recipeId)) return;
          const existing = state.schedule.find(
            (entry) => entry.date === day.date && entry.slot === slots[index],
          );
          schedule.put({
            id: existing?.id || uid(),
            date: day.date,
            slot: slots[index],
            recipeId,
            mealSize:
              slotKind(slots[index]) === "meal" ? list.mealSize : undefined,
            confirmedAt: now,
            sourceListId: list.id,
          });
        });
    transaction.objectStore("savedLists").put({
      ...list,
      rows,
      purchasedAt: complete ? now : null,
      lastPurchaseAt: now,
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
$("#savedLists").addEventListener("click", async (e) => {
  const summary = e.target.closest("summary");
  if (summary?.parentElement.classList.contains("saved-list")) {
    const details = summary.closest("[data-list-id]");
    openSavedListId = details.open ? null : details.dataset.listId;
    return;
  }
  const button = e.target.closest("button");
  if (!button) return;
  const id =
    button.dataset.listConfirm ||
    button.dataset.listCopy ||
    button.dataset.listDelete;
  const list = state.savedLists.find((x) => x.id === id);
  if (!list) return;
  if (button.dataset.listConfirm) {
    try {
      await confirmSavedPurchase(list);
      draftRequested = false;
      const completed = list.rows.every((row) => row.checked || row.purchased);
      if (completed) $("#weekStart").value = weekKey(parseDate(list.startDate));
      if (completed) openSavedListId = undefined;
      await reload();
      toast(
        completed
          ? "Purchase confirmed. Food on hand and week updated."
          : "Checked purchases added to food on hand. Remaining items stay on this list.",
      );
    } catch (error) {
      toast(error.message);
    }
  } else if (button.dataset.listCopy) {
    const text = list.rows
      .map(
        (row) =>
          `${row.checked ? "[x]" : "[ ]"} ${savedFoodName(row)}: ${row.packages} × ${row.packageQty} ${row.unit} — ${money(row.cost)}`,
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Saved list copied");
    } catch {
      prompt("Copy grocery list:", text);
    }
  } else if (button.dataset.listDelete) {
    if (
      !confirm(
        "Delete this saved grocery list? Inventory and calendar will not change.",
      )
    )
      return;
    await del("savedLists", id);
    await reload();
    toast("Saved list deleted");
  }
});
$("#copyList").addEventListener("click", async () => {
  if (!currentPlan?.rows) return;
  const s =
    currentPlan.rows
      .map(
        (r) =>
          `${foodName(food(r.foodId) || { name: r.name })}: ${r.packages === null ? r.missing.toFixed(2) + " " + r.unit : r.packages + " package(s)"} — ${r.cost === null ? "?" : money(r.cost)}`,
      )
      .join("\n") + `\nEstimated groceries: ${money(currentPlan.total)}`;
  try {
    await navigator.clipboard.writeText(s);
    toast("List copied");
  } catch {
    prompt("Copy grocery list:", s);
  }
});
