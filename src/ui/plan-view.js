"use strict";
// For example: "No compatible recipe for 3 snack slots and 21 drink slots."
function missingSlotsText(p) {
  const parts = Object.entries(p.missingByKind || {})
    .filter(([, count]) => count)
    .map(([kind, count]) => `${count} ${kind} slot${count === 1 ? "" : "s"}`);
  return `No compatible recipe for ${parts.join(" and ")}. Check your settings, or add recipes in <b>Meals</b>.`;
}
function varietySummary(p) {
  const meals = `${p.distinctMeals} different meal${p.distinctMeals === 1 ? "" : "s"}`;
  const extra = p.total - p.cheapestTotal;
  const scratch = p.scratchSkipped
    ? `<p class="muted">This plan skips Skilled recipes: buying the baking staples would cover fewer days within your spending limit. Raise the limit, or add staples you already have in <b>On hand</b>.</p>`
    : "";
  return scratch + `<p>${meals}${extra >= 0.005 ? `. Extra variety adds ${money(extra)} over the cheapest plan.` : "."}</p>`;
}
function renderPlan() {
  $("#draftCard").classList.toggle("empty", !draftRequested);
  $("#coveragePanel").classList.toggle("empty", !draftRequested);
  if (!draftRequested) {
    currentPlan = null;
    $("#planSummary").textContent =
      "Set your spending limit and dates, then get a buy list.";
    $("#groceryRows").innerHTML =
      '<tr class="empty-row"><td colspan="4">No draft yet.</td></tr>';
    $("#groceryTotal").textContent = "";
    $("#coverage").textContent =
      "Build a draft to see recipe ideas and a buy list.";
    return;
  }
  if (!$("#weekStart").value) return;
  currentPlan = getPlan();
  const p = currentPlan;
  if (p.error) {
    $("#planSummary").textContent = p.error;
    $("#groceryRows").innerHTML = "";
    $("#groceryTotal").textContent = "";
    $("#coverage").innerHTML = "";
    return;
  }
  $("#planSummary").innerHTML =
    `<p><b>${p.days} of ${p.targetDays} days drafted</b> · ${p.rows.length} foods to buy · Spending limit <b>${money(p.budget)}</b></p>
    ${p.mealCount ? `<p>Average taste rating: <b>${p.averageTaste.toFixed(1)} / 5</b> (subjective).</p>${varietySummary(p)}` : p.nextDay?.unknown ? '<p class="warn">Estimates are missing for the next day. Add planning estimates before checking the total.</p>' : p.nextDay?.mealCount ? '<p class="warn">Your spending limit prevents filling all recipe slots for a day.</p>' : state.recipes.length ? '<p class="warn">No meals fit your equipment and preparation settings. Check <b>Food settings</b>.</p>' : '<p class="warn">There are no meals saved. Use <b>Backup → Reset to starter data</b> to load the starter meals.</p>'}
    ${p.unknown ? `<p class="warn">${p.unknown} food${p.unknown === 1 ? " has" : "s have"} no price. The total is incomplete.</p>` : ""}
    ${p.prepReview ? `<p class="warn">${p.prepReview} selected meal slot${p.prepReview === 1 ? " needs" : "s need"} directions, heating, or food storage reviewed.</p>` : ""}
    ${p.missingSlots ? `<p class="warn">${missingSlotsText(p)}</p>` : ""}
    ${p.nextDay && !p.nextDay.unknown ? `<p class="warn">The next day exceeds your spending limit. Its estimated grocery total is ${money(p.nextDay.total)}.</p>` : ""}`;
  $("#groceryRows").innerHTML =
    p.rows
      .map(
        (r) =>
          `<tr><td>${esc(foodName(food(r.foodId) || { name: r.name }))}</td><td data-label="Need">${r.missing.toFixed(2)} ${esc(r.unit)}</td><td data-label="Packages">${r.packages === null ? "?" : r.packages + " × " + r.price.qty + " " + esc(r.unit)}</td><td data-label="Cost">${r.cost === null ? "Unknown" : money(r.cost)}</td></tr>`,
      )
      .join("") ||
    '<tr class="empty-row"><td colspan="4">Nothing to buy for the selected meals.</td></tr>';
  $("#groceryTotal").innerHTML =
    `<b>Estimated grocery total</b><span>${p.unknown ? "At least " : ""}${money(p.total)}</span>`;
  $("#coverage").innerHTML = p.coverage
    .map(
      (d) =>
        `<div class="coverage-day"><b>${d.date}</b>: ${d.mainMeals.length ? esc(d.mainMeals.map(mealName).join(" · ")) : '<span class="warn">No compatible meals</span>'}
        <small>Snacks: ${d.snacks.length ? esc(d.snacks.map(mealName).join(" · ")) : "No compatible snacks"}</small>
        <small>Drinks: ${d.drinks?.length ? esc(d.drinks.map(mealName).join(" · ")) : "No compatible drinks"}</small></div>`,
    )
    .join("");
}
function renderSavedLists() {
  const lists = state.savedLists
    .slice()
    .sort(
      (a, b) =>
        b.startDate.localeCompare(a.startDate) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  $("#savedRunsCard").classList.toggle("empty", !lists.length);
  const mobile = matchMedia("(max-width: 600px)").matches;
  const mobileOpenId = openSavedListId ?? null;
  $("#savedLists").innerHTML =
    lists
      .map((list) => {
        const purchased = Boolean(list.purchasedAt);
        const basketCount = list.rows.filter(
          (row) => row.checked && !row.purchased && !purchased,
        ).length;
        const purchasedCount = list.rows.filter(
          (row) => row.purchased || purchased,
        ).length;
        return `<details class="saved-list" data-list-id="${esc(list.id)}" ${!purchased && (!mobile || list.id === mobileOpenId) ? "open" : ""}>
      <summary><b>${esc(list.startDate)}</b> · ${list.days} day${list.days === 1 ? "" : "s"} · ${purchased ? "Purchased" : `${purchasedCount}/${list.rows.length} purchased · ${basketCount} in basket`} · ${money(list.foodTotal)}</summary>
      <p class="muted">${purchased ? `Confirmed ${esc(list.purchasedAt.slice(0, 10))}.` : "Checking an item does not change food on hand."}</p>
      <div class="saved-list-items">${list.rows.map((row, index) => `<label class="saved-list-item"><input type="checkbox" data-list-check="${esc(list.id)}:${index}" ${row.checked || row.purchased || purchased ? "checked" : ""} ${row.purchased || purchased ? "disabled" : ""}><span>${esc(row.product ? [row.brand, row.product].filter(Boolean).join(" · ") : savedFoodName(row))} · ${row.packages} × ${row.packageQty} ${esc(row.unit)} · ${money(row.cost)}${row.servingsPerPackage > 0 ? ` · ${money(row.cost / (row.packages * row.servingsPerPackage))} / serving` : ""}${row.purchased || purchased ? " · Purchased" : ""}</span></label>`).join("")}</div>
      <details class="saved-list-meals"><summary>Meals, snacks, and drinks${list.mealSize ? ` · ${esc(list.mealSize)} meals` : ""}</summary><p class="muted">${list.coverage
        .map(
          (day) =>
            `${day.date}: ${day.meals.map((name, index) => savedMealName(day.recipeIds?.filter(Boolean)[index], name)).join(" / ")}`,
        )
        .map(esc)
        .join(" · ")}</p></details>
      ${purchased ? "" : `<button data-list-confirm="${esc(list.id)}" ${basketCount ? "" : "disabled"}>Confirm checked purchase</button>`}
      <button class="secondary" data-list-copy="${esc(list.id)}">Copy list</button>
      <button class="danger" data-list-delete="${esc(list.id)}">Delete list</button>
    </details>`;
      })
      .join("") ||
    '<p class="muted">No saved lists yet. Make one before shopping.</p>';
}
