"use strict";
let quickPhotoData = null;

function normalizeUpc(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^0\d{12}$/.test(digits) ? digits.slice(1) : digits;
}

function productQuantity(amount, packageUnit, foodUnit) {
  const mass = { g: 1, kg: 1000, oz: 28.349523, lb: 453.59237 };
  const volume = { cup: 1, gallon: 16 };
  if (packageUnit === foodUnit) return amount;
  if (mass[packageUnit] && mass[foodUnit])
    return (
      Math.round(((amount * mass[packageUnit]) / mass[foodUnit]) * 1e6) / 1e6
    );
  if (volume[packageUnit] && volume[foodUnit])
    return (
      Math.round(((amount * volume[packageUnit]) / volume[foodUnit]) * 1e6) /
      1e6
    );
  return null;
}

function productSafePhoto(value) {
  return /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(value || "")
    ? value
    : "";
}

function renderQuickProduct() {
  const foodSelect = $("#quickFood");
  const listSelect = $("#quickListTarget");
  const foodChoice = foodSelect.value;
  const listChoice = listSelect.value;
  foodSelect.innerHTML =
    '<option value="">Choose food type</option>' +
    state.inventory
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (item) =>
          `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.unit)}</option>`,
      )
      .join("") +
    '<option value="__new__">+ New food type</option>';
  if (foodChoice) foodSelect.value = foodChoice;
  listSelect.innerHTML =
    '<option value="none">Record price only</option><option value="new">Start a new buy list</option>' +
    state.savedLists
      .filter((list) => !list.purchasedAt)
      .map(
        (list) =>
          `<option value="${esc(list.id)}">Add to ${esc(list.startDate)} list</option>`,
      )
      .join("");
  if (listChoice) listSelect.value = listChoice;
}

function productPreview() {
  const form = $("#productQuickForm");
  $("#quickListPackagesField").hidden =
    form.elements.listTarget.value === "none";
  const foodId = form.elements.foodId.value;
  const newFood = foodId === "__new__";
  $("#quickNewFood").hidden = !newFood;
  const foodUnit = newFood
    ? form.elements.newFoodUnit.value
    : food(foodId)?.unit;
  const amount = Number(form.elements.packageAmount.value);
  const price =
    form.elements.price.value === ""
      ? NaN
      : roundPackagePrice(Number(form.elements.price.value));
  const qty = productQuantity(
    amount,
    form.elements.packageUnit.value,
    foodUnit,
  );
  const servings = Number(form.elements.servingsPerPackage.value);
  $("#quickCost").textContent =
    price >= 0 && amount > 0 && foodUnit
      ? qty === null
        ? `Package unit cannot convert to ${foodUnit}. Choose a matching unit.`
        : `${money(price / qty)} per ${foodUnit}${servings > 0 ? ` · ${money(price / servings)} per serving` : " · enter servings for cost per serving"}`
      : "Enter a food type, size, and price to compare costs.";
  const code = normalizeUpc(form.elements.upc.value);
  const matches = code
    ? state.prices.filter((offer) => offer.upc === code)
    : [];
  $("#quickMatches").textContent = matches.length
    ? `Seen before: ${matches
        .slice(-4)
        .map(
          (offer) =>
            `${money(offer.price)} (${money(offer.price / offer.qty)} / ${food(offer.foodId)?.unit || "unit"}${offer.servingsPerPackage > 0 ? `, ${money(offer.price / offer.servingsPerPackage)} / serving` : ""})${offer.observedAt ? ` on ${offer.observedAt}` : ""}`,
        )
        .join(" · ")}`
    : "";
}

function fillKnownProduct() {
  const fields = $("#productQuickForm").elements;
  const code = normalizeUpc(fields.upc.value);
  const match = state.prices
    .slice()
    .reverse()
    .find((offer) => offer.upc === code);
  if (!match) return productPreview();
  if (!fields.product.value) fields.product.value = match.product || "";
  if (!fields.brand.value) fields.brand.value = match.brand || "";
  if (!fields.foodId.value) fields.foodId.value = match.foodId;
  if (fields.packageAmount.value === "1") {
    fields.packageAmount.value = match.packageAmount ?? match.qty;
    fields.packageUnit.value =
      match.packageUnit || food(match.foodId)?.unit || "oz";
  }
  if (!fields.servingsPerPackage.value)
    fields.servingsPerPackage.value = match.servingsPerPackage ?? "";
  if (!fields.servingLabel.value)
    fields.servingLabel.value = match.servingLabel || "";
  productPreview();
}

function openProductQuick(offer = null) {
  renderQuickProduct();
  const form = $("#productQuickForm");
  form.reset();
  form.dataset.offerId = offer?.id || "";
  form.elements.observedAt.value = offer?.observedAt || fmt(new Date());
  form.elements.estimated.checked = Boolean(offer?.estimated);
  form.elements.foodId.value = offer?.foodId || "";
  form.elements.brand.value = offer?.brand || "";
  form.elements.product.value = offer?.product || "";
  form.elements.upc.value = offer?.upc || "";
  form.elements.price.value = offer?.price ?? "";
  form.elements.packageAmount.value = offer?.packageAmount ?? offer?.qty ?? 1;
  form.elements.packageUnit.value =
    offer?.packageUnit || food(offer?.foodId)?.unit || "oz";
  form.elements.servingsPerPackage.value = offer?.servingsPerPackage ?? "";
  form.elements.servingLabel.value = offer?.servingLabel || "";
  quickPhotoData = productSafePhoto(offer?.photo);
  showProductPhoto();
  $("#productDialogTitle").textContent = offer ? "Edit product" : "Add product";
  productPreview();
  openFoodDialog($("#productDialog"));
}

async function addProductToList(target, offer, packages) {
  if (target === "none") return;
  const old =
    target === "new"
      ? null
      : state.savedLists.find(
          (list) => list.id === target && !list.purchasedAt,
        );
  if (target !== "new" && !old) throw Error("Choose an open buy list");
  const item = food(offer.foodId);
  const rows = [
    ...(old?.rows || []),
    {
      foodId: item.id,
      name: item.name,
      unit: item.unit,
      packages,
      packageQty: offer.qty,
      cost: roundMoney(offer.price * packages),
      product: offer.product,
      brand: offer.brand,
      upc: offer.upc,
      priceId: offer.id,
      servingsPerPackage: offer.servingsPerPackage,
      checked: false,
    },
  ];
  const foodTotal = roundMoney(
    rows.reduce((sum, row) => sum + Number(row.cost || 0), 0),
  );
  const list = {
    id: old?.id || uid(),
    startDate: old?.startDate || fmt(new Date()),
    days: old?.days || 1,
    createdAt: old?.createdAt || new Date().toISOString(),
    purchasedAt: null,
    coverage: old?.coverage || [],
    rows,
    foodTotal,
  };
  await put("savedLists", list);
  openSavedListId = list.id;
}

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (event) => {
    if (event.target.closest(".open-product-quick")) openProductQuick();
    const edit = event.target.closest("[data-edit-price]");
    if (edit)
      openProductQuick(
        state.prices.find((offer) => offer.id === edit.dataset.editPrice),
      );
    if (event.target.id === "removeQuickPhoto") {
      quickPhotoData = null;
      showProductPhoto();
    }
  });
  $("#productQuickForm").addEventListener("input", productPreview);
  $("#productQuickForm").addEventListener("change", productPreview);
  $("#productQuickForm [name=upc]").addEventListener(
    "change",
    fillKnownProduct,
  );
  for (const id of ["quickCamera", "quickPhoto"])
    $("#" + id).addEventListener("change", async (event) => {
      await handleProductPhoto(event.target.files[0]);
      event.target.value = "";
    });
  $("#productQuickForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const newFood = values.foodId === "__new__";
    const unit = newFood ? values.newFoodUnit : food(values.foodId)?.unit;
    const qty = productQuantity(
      Number(values.packageAmount),
      values.packageUnit,
      unit,
    );
    if (!qty || qty <= 0)
      return toast(
        `Package unit must match the food's ${unit || "tracking"} unit.`,
      );
    const upc = normalizeUpc(values.upc);
    if (values.upc && !/^\d{8,14}$/.test(upc))
      return toast("UPC / EAN must be 8–14 digits.");
    let foodId = values.foodId;
    if (newFood) {
      const name = values.newFoodName.trim();
      if (!name) return toast("Name the new food type.");
      const existing = state.inventory.find(
        (item) => key(item.name) === key(name) && item.unit === unit,
      );
      foodId = existing?.id || uid();
      if (!existing)
        await put("inventory", {
          id: foodId,
          name,
          unit,
          qty: 0,
          minimum: 0,
          storage: values.newFoodStorage,
          needsCooking: Boolean(values.newFoodNeedsCooking),
        });
    }
    const previous = state.prices.find(
      (price) => price.id === form.dataset.offerId,
    );
    const offer = {
      ...previous,
      id: form.dataset.offerId || uid(),
      foodId,
      brand: values.brand.trim(),
      product: values.product.trim(),
      upc,
      packageAmount: Number(values.packageAmount),
      packageUnit: values.packageUnit,
      qty,
      price: roundPackagePrice(Number(values.price)),
      servingsPerPackage: values.servingsPerPackage
        ? Number(values.servingsPerPackage)
        : null,
      servingLabel: values.servingLabel.trim(),
      observedAt: values.observedAt,
      estimated: Boolean(values.estimated),
      photo: quickPhotoData,
      recordedAt: new Date().toISOString(),
    };
    await put("prices", offer);
    if (newFood) state.inventory = await getAll("inventory");
    try {
      await addProductToList(
        values.listTarget,
        offer,
        Number(values.listPackages),
      );
    } catch (error) {
      return toast(error.message);
    }
    closeFoodDialog($("#productDialog"));
    await reload();
    toast(
      values.listTarget === "none"
        ? "Product price saved."
        : "Product saved and added to your buy list.",
    );
  });
});
