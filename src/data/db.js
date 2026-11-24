"use strict";
function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const s of STORES)
        if (!r.result.objectStoreNames.contains(s))
          r.result.createObjectStore(s, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function getAll(s) {
  return new Promise((res, rej) => {
    const t = db.transaction(s, "readonly").objectStore(s).getAll();
    t.onsuccess = () => res(t.result);
    t.onerror = () => rej(t.error);
  });
}
function normalizeRecords(name, records) {
  return name === "prices"
    ? records.map((price) => ({
        ...price,
        price: roundPackagePrice(price.price),
      }))
    : records;
}
function put(s, obj) {
  return new Promise((res, rej) => {
    const record = normalizeRecords(s, [obj])[0];
    const r = db.transaction(s, "readwrite").objectStore(s).put(record);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}
function del(s, id) {
  return new Promise((res, rej) => {
    const r = db.transaction(s, "readwrite").objectStore(s).delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}
function clearStore(s) {
  return new Promise((res, rej) => {
    const r = db.transaction(s, "readwrite").objectStore(s).clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}
async function reload() {
  for (const s of STORES) state[s] = normalizeRecords(s, await getAll(s));
  render();
}
