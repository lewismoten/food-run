"use strict";
// Folder synchronization uses a persisted folder handle and a last-common snapshot hash.
// If both sides have changed, never silently discard either side.
const SYNC_FILE = "eat-cheap-sync.json",
  HANDLE_DB = "Eat Cheap USB Handles";
let usbFolder = null,
  syncBusy = false,
  lastSyncedHash = null;
const syncStatus = (t) => ($("#syncStatus").textContent = t);
function canonical(data) {
  return JSON.stringify(
    Object.fromEntries(
      STORES.map((k) => [
        k,
        normalizeRecords(k, data[k] || [])
          .slice()
          .sort((a, b) => String(a.id).localeCompare(String(b.id))),
      ]),
    ),
  );
}
function fingerprint(data) {
  return canonical(data);
}
function snapshot() {
  return {
    app: APP_NAME,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(STORES.map((k) => [k, state[k]])),
  };
}
function validSnapshot(x) {
  return (
    x &&
    x.app === APP_NAME &&
    x.data &&
    CORE_STORES.every((k) => Array.isArray(x.data[k])) &&
    (!x.data.savedLists || Array.isArray(x.data.savedLists))
  );
}
function handleStore(mode, action) {
  return new Promise((resolve, reject) => {
    let r = indexedDB.open(HANDLE_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("settings");
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      let d = r.result,
        t = d.transaction("settings", mode),
        q = action(t.objectStore("settings"));
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
      t.oncomplete = () => d.close();
    };
  });
}
async function saveFolder(folder) {
  await handleStore("readwrite", (s) => s.put(folder, "folder"));
}
async function savedFolder() {
  return handleStore("readonly", (s) => s.get("folder"));
}
async function hasPermission(folder, request = false) {
  let options = { mode: "readwrite" };
  if ((await folder.queryPermission(options)) === "granted") return true;
  return request && (await folder.requestPermission(options)) === "granted";
}
async function usbRead() {
  try {
    const h = await usbFolder.getFileHandle(SYNC_FILE);
    return JSON.parse(await (await h.getFile()).text());
  } catch (e) {
    if (e.name === "NotFoundError") return null;
    throw e;
  }
}
async function usbWrite() {
  const h = await usbFolder.getFileHandle(SYNC_FILE, { create: true }),
    w = await h.createWritable();
  try {
    await w.write(JSON.stringify(snapshot(), null, 2));
    await w.close();
  } catch (e) {
    await w.abort();
    throw e;
  }
}
async function synchronize(interactive = false) {
  if (syncBusy || !usbFolder) return;
  syncBusy = true;
  try {
    if (!(await hasPermission(usbFolder, interactive))) {
      syncStatus(
        "USB folder permission needed. Click Sync now to grant access.",
      );
      return;
    }
    const remote = await usbRead(),
      localHash = fingerprint(state);
    if (remote && !validSnapshot(remote))
      throw Error("USB file is not a Food Run backup");
    const remoteHash = remote ? fingerprint(remote.data) : null;
    if (remoteHash === localHash) {
      lastSyncedHash = localHash;
      syncStatus("In sync · " + new Date().toLocaleTimeString());
      return;
    }
    if (!remote) {
      await usbWrite();
      lastSyncedHash = localHash;
      syncStatus("Saved first snapshot to USB");
      return;
    }
    const localChanged =
      lastSyncedHash !== null && localHash !== lastSyncedHash;
    const remoteChanged =
      lastSyncedHash !== null && remoteHash !== lastSyncedHash;
    if (lastSyncedHash !== null && !localChanged && remoteChanged) {
      await replaceData(remote.data);
      lastSyncedHash = remoteHash;
      syncStatus("Updated local data from USB");
      return;
    }
    if (lastSyncedHash !== null && localChanged && !remoteChanged) {
      await usbWrite();
      lastSyncedHash = localHash;
      syncStatus("Saved local changes to USB");
      return;
    }
    // On a fresh connection or a true conflict, require an explicit choice.
    syncStatus("Different copies detected — action required");
    if (!interactive) return;
    const choice = prompt(
      "USB and browser contain different data. Type USB to replace browser data, LOCAL to replace USB data, or CANCEL to keep both unchanged. Export a JSON backup first if unsure.",
      "CANCEL",
    );
    if (choice?.trim().toUpperCase() === "USB") {
      if (!confirm("Replace ALL browser data with the USB snapshot?")) return;
      await replaceData(remote.data);
      lastSyncedHash = remoteHash;
      syncStatus("Loaded USB snapshot");
    } else if (choice?.trim().toUpperCase() === "LOCAL") {
      if (!confirm("Overwrite the USB snapshot with browser data?")) return;
      await usbWrite();
      lastSyncedHash = localHash;
      syncStatus("Saved browser snapshot to USB");
    }
  } catch (e) {
    syncStatus("Sync failed: " + e.message);
  } finally {
    syncBusy = false;
  }
}
$("#connectUsb").addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    syncStatus("Folder access unsupported here. Use JSON import/export.");
    return;
  }
  try {
    usbFolder = await window.showDirectoryPicker({ mode: "readwrite" });
    lastSyncedHash = null;
    await saveFolder(usbFolder);
    syncStatus("Connected: " + usbFolder.name);
    await synchronize(true);
  } catch (e) {
    if (e.name !== "AbortError") syncStatus("Connection failed: " + e.message);
  }
});
$("#syncNow").addEventListener("click", () => synchronize(true));
$("#disconnectUsb").addEventListener("click", async () => {
  usbFolder = null;
  lastSyncedHash = null;
  await handleStore("readwrite", (s) => s.delete("folder"));
  syncStatus("Disconnected");
});
window.addEventListener("focus", () => synchronize(false));
setInterval(() => {
  if (document.visibilityState === "visible") synchronize(false);
}, 15000);
async function restoreFolder() {
  try {
    usbFolder = await savedFolder();
    if (usbFolder) {
      syncStatus(
        "Previously selected: " +
          usbFolder.name +
          " · click Sync now to reconnect",
      );
      await synchronize(false);
    }
  } catch (e) {
    syncStatus("USB reconnect unavailable: " + e.message);
  }
}
