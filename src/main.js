"use strict";
(async () => {
  try {
    await loadStarterData();
    db = await openDB();
    const mobile = matchMedia("(max-width: 600px)").matches;
    for (const id of ["workflowDetails", "plannerOptions", "coveragePanel"])
      $("#" + id).open = !mobile;
    $("#weekStart").value = weekKey(new Date());
    $("#planStartDate").value = fmt(new Date());
    $("#priceDate").value = fmt(new Date());
    restorePlanSettings();
    await seedStarterData();
    await reload();
    await restoreFolder();
  } catch (e) {
    alert(
      "Could not start Food Run. Open it through the local web server described in README.md. " +
        e.message,
    );
  }
})();
