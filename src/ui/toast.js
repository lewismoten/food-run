"use strict";
function toast(t) {
  const n = $("#notice");
  n.textContent = t;
  n.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (n.style.display = "none"), 3500);
}
// Show errors that would otherwise fail silently in an async event handler.
window.addEventListener("unhandledrejection", (event) => {
  toast(`Something went wrong: ${event.reason?.message || event.reason}`);
});
