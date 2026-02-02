// os/storage/db.js
// IndexedDB bootstrap + safe, additive migrations for YamanOS.
//
// NON-NEGOTIABLES:
// - 100% client-side.
// - Never delete stores (especially fs_entries).
// - Upgrades must be additive and survive mixed/older DB states.
// - This file is the SINGLE source of truth for:
//   stores, indexes, kv helpers, and DEFAULTS.

export const DB_NAME = "yamanos";
export const DB_VERSION = 4;

// Store names (single source of truth)
export const STORES = Object.freeze({
  FS: "fs_entries",
  SPATIAL_NODES: "spatial_nodes",
  SHELL_STATE: "shell_state",
  KV: "kv",
});

// Defaults consumed by core modules
export const DEFAULTS = Object.freeze({
  CAMERA: { x: 0, y: 0, zoom: 1 },
  SETTINGS: {
    theme: "dark",
    wallpaper: "gradient-aurora",
    uiScale: "normal",        // compact | normal | large
    reduceMotion: false,
    timeFormat: "12h",        // 12h | 24h
    browserMode: "external",  // external | embedded
  },
});

let _dbPromise = null;

export async function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = initDB();
  return _dbPromise;
}

export async function initDB() {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction;
      try {
        upgrade(db, tx, e.oldVersion, e.newVersion || DB_VERSION);
      } catch (err) {
        console.error("DB upgrade failed:", err);
        throw err;
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function hasStore(db, name) {
  return db.objectStoreNames.contains(name);
}

export function upgrade(db, tx, oldVersion, newVersion) {
  // Additive store creation. Never delete/rename stores.

  // fs_entries: file system entries (must survive upgrades)
  if (!hasStore(db, STORES.FS)) {
    // key = full path string: "/Desktop/note.txt"
    const st = db.createObjectStore(STORES.FS, { keyPath: "path" });
    st.createIndex("byType", "type", { unique: false });
    st.createIndex("byParent", "parent", { unique: false });
    st.createIndex("byMtime", "mtime", { unique: false });
  } else {
    // ensure indexes (additive)
    const st = tx.objectStore(STORES.FS);
    safeEnsureIndex(st, "byType", "type", { unique: false });
    safeEnsureIndex(st, "byParent", "parent", { unique: false });
    safeEnsureIndex(st, "byMtime", "mtime", { unique: false });
  }

  // spatial_nodes: canvas nodes (apps, urls, files)
  if (!hasStore(db, STORES.SPATIAL_NODES)) {
    const st = db.createObjectStore(STORES.SPATIAL_NODES, { keyPath: "nodeId" });
    st.createIndex("byEntity", ["entityType", "entityId"], { unique: false });
    st.createIndex("byZ", "z", { unique: false });
  } else {
    const st = tx.objectStore(STORES.SPATIAL_NODES);
    safeEnsureIndex(st, "byEntity", ["entityType", "entityId"], { unique: false });
    safeEnsureIndex(st, "byZ", "z", { unique: false });
  }

  // shell_state: single-record store for UI state blobs
  if (!hasStore(db, STORES.SHELL_STATE)) {
    db.createObjectStore(STORES.SHELL_STATE, { keyPath: "key" });
  }

  // kv: generic key/value settings store
  if (!hasStore(db, STORES.KV)) {
    db.createObjectStore(STORES.KV);
  }
}

function safeEnsureIndex(store, name, keyPath, opts) {
  try {
    if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, opts);
  } catch (_) {
    // If creation fails due to older browser quirks or conflicting definitions, we don't hard-crash.
    // The app can still run without optional indexes.
  }
}

/**
 * Transaction helper.
 * @param {string|string[]} storeNames
 * @param {"readonly"|"readwrite"} mode
 * @param {(tx: IDBTransaction, stores: Record<string, IDBObjectStore>) => Promise<any>} fn
 */
export async function withTx(storeNames, mode, fn) {
  const db = await getDB();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    const stores = {};
    for (const n of names) stores[n] = tx.objectStore(n);

    let finished = false;

    tx.oncomplete = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };
    tx.onerror = () => reject(tx.error || new Error("IndexedDB tx error"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));

    Promise.resolve()
      .then(() => fn(tx, stores))
      .then((result) => {
        // Resolve early with result, but still let tx complete
        if (!finished) {
          finished = true;
          resolve(result);
        }
      })
      .catch((err) => reject(err));
  });
}

// KV helpers (single source of truth)
export async function kvGet(key) {
  return await withTx(STORES.KV, "readonly", async (_tx, stores) => {
    const st = stores[STORES.KV];
    return await new Promise((resolve) => {
      const req = st.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  });
}

export async function kvSet(key, value) {
  return await withTx(STORES.KV, "readwrite", async (_tx, stores) => {
    const st = stores[STORES.KV];
    return await new Promise((resolve, reject) => {
      const req = st.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error || new Error("kvSet failed"));
    });
  });
}

export async function kvDel(key) {
  return await withTx(STORES.KV, "readwrite", async (_tx, stores) => {
    const st = stores[STORES.KV];
    return await new Promise((resolve) => {
      const req = st.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  });
}
