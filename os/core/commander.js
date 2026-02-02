// os/core/commander.js
// YamanOS v0.4 - Offline Command "Brain" (regex/pattern matching only)
//
// Exports:
//   async function executeCommand(inputString)
//
// Supported commands:
//   - "new note [name?]"
//   - "new folder [name?]"
//   - "open <snake|settings|filename>"
//   - "clear" / "reset"
//
// Notes:
// - This module is intentionally deterministic (no AI, no APIs).
// - It uses IndexedDB to find existing files/apps and their nodes.
// - It will CREATE an app node if missing, then zoom to it.
// - For "new note/folder", it tries to create a filesystem entry if possible,
//   but because FS schema can vary between builds, it uses a safe, minimal strategy.
//   If FS write fails, it still creates a spatial node as a fallback and returns
//   a warning message.

import { upsertNode, zoomToNode, setCamera, getCamera } from "./state.js";
import { withTx, STORES } from "../storage/db.js";

/** Known apps that can be "open"-ed even if no file exists */
const KNOWN_APPS = new Set([
  "snake",
  "settings",
  "notes",
  "files",
  "browser",
  "games",
]);

/** Default zoom when focusing a node */
const DEFAULT_FOCUS_ZOOM = 1.25;

/** Normalize input for matching */
function normalizeInput(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Lowercase for comparison */
function normKey(s) {
  return normalizeInput(s).toLowerCase();
}

/** Safe UUID */
function uid() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * Compute world center position from camera + viewport.
 * Convention matches state.js:
 * - camera.x, camera.y = world coord of screen top-left
 * - camera.zoom = scale
 */
async function getWorldCenter() {
  const cam = await getCamera();

  const vw =
    typeof window !== "undefined" && Number.isFinite(window.innerWidth) ? window.innerWidth : null;
  const vh =
    typeof window !== "undefined" && Number.isFinite(window.innerHeight) ? window.innerHeight : null;

  if (vw && vh) {
    return {
      x: cam.x + vw / (2 * cam.zoom),
      y: cam.y + vh / (2 * cam.zoom),
      zoom: cam.zoom,
      viewportWidth: vw,
      viewportHeight: vh,
    };
  }

  // Fallback: no viewport available (e.g., headless)
  return { x: cam.x, y: cam.y, zoom: cam.zoom, viewportWidth: null, viewportHeight: null };
}

/**
 * Find a spatial node by entity.
 * @param {"fs"|"app"} entityType
 * @param {string} entityId
 * @returns {Promise<any|null>}
 */
async function findNodeByEntity(entityType, entityId) {
  return await withTx(STORES.SPATIAL_NODES, "readonly", async (_tx, stores) => {
    const st = stores[STORES.SPATIAL_NODES];
    const idx = st.index("byEntity");

    return await new Promise((resolve, reject) => {
      const req = idx.get([entityType, entityId]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Best-effort filesystem entry search by name.
 * This assumes fs_entries contains objects with at least: { id, name, kind }.
 * If your schema differs, adapt here (this is the only place that assumes it).
 *
 * @param {string} queryName
 * @returns {Promise<{id:string,name:string,kind?:string}|null>}
 */
async function findFsEntryByName(queryName) {
  const q = normKey(queryName);
  if (!q) return null;

  // Two-pass match:
  //  1) exact (case-insensitive)
  //  2) partial contains
  const exactMatches = [];
  const partialMatches = [];

  await withTx(STORES.FS_ENTRIES, "readonly", async (_tx, stores) => {
    const st = stores[STORES.FS_ENTRIES];

    await new Promise((resolve, reject) => {
      const req = st.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(true);

        const v = cursor.value;
        const name = typeof v?.name === "string" ? v.name : "";
        const nameKey = name.toLowerCase();

        if (nameKey === q) exactMatches.push(v);
        else if (nameKey.includes(q)) partialMatches.push(v);

        cursor.continue();
      };
    });
  });

  const pick = exactMatches[0] || partialMatches[0] || null;
  if (!pick || typeof pick.id !== "string") return null;

  return {
    id: pick.id,
    name: typeof pick.name === "string" ? pick.name : queryName,
    kind: typeof pick.kind === "string" ? pick.kind : undefined,
  };
}

/**
 * Best-effort filesystem entry creation.
 * WARNING: This assumes a minimal schema, and may need adjustment to match your v0.3.2 fs_entries structure.
 *
 * If it fails, caller should still create a spatial node as fallback.
 *
 * @param {"note"|"folder"} type
 * @param {string} name
 * @returns {Promise<{id:string,name:string,kind:string}|null>}
 */
async function tryCreateFsEntry(type, name) {
  const id = uid();
  const now = new Date().toISOString();

  // Minimal record guess (adjust if your FS requires different fields)
  const record =
    type === "folder"
      ? {
          id,
          name,
          kind: "folder",
          parentId: "root", // common pattern; adapt if needed
          createdAt: now,
          modifiedAt: now,
        }
      : {
          id,
          name,
          kind: "file",
          mime: "text/note",
          parentId: "root",
          content: "", // minimal
          createdAt: now,
          modifiedAt: now,
        };

  try {
    await withTx(STORES.FS_ENTRIES, "readwrite", async (_tx, stores) => {
      const st = stores[STORES.FS_ENTRIES];
      await new Promise((resolve, reject) => {
        const req = st.add(record);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    });

    return { id, name, kind: record.kind };
  } catch (_err) {
    return null;
  }
}

/**
 * Ensure an app node exists; if missing, create it at world center.
 * @param {string} appId
 * @returns {Promise<any>} node record (existing or newly created)
 */
async function ensureAppNode(appId) {
  const existing = await findNodeByEntity("app", appId);
  if (existing) return existing;

  const center = await getWorldCenter();
  return await upsertNode({
    entityType: "app",
    entityId: appId,
    x: center.x,
    y: center.y,
    scale: 1,
    z: 0,
    flags: { pinned: true },
  });
}

/**
 * Ensure an fs node exists for a file/folder id; if missing, create at world center.
 * @param {string} fsId
 * @returns {Promise<any>} node record
 */
async function ensureFsNode(fsId) {
  const existing = await findNodeByEntity("fs", fsId);
  if (existing) return existing;

  const center = await getWorldCenter();
  return await upsertNode({
    entityType: "fs",
    entityId: fsId,
    x: center.x,
    y: center.y,
    scale: 1,
    z: 0,
    flags: { pinned: false },
  });
}

/**
 * MAIN COMMAND EXECUTOR
 * @param {string} inputString
 * @returns {Promise<{success:boolean,message?:string,error?:string}>}
 */
export async function executeCommand(inputString) {
  const raw = normalizeInput(inputString);

  if (!raw) {
    return { success: false, error: "Empty command" };
  }

  const lower = raw.toLowerCase();

  // ---- CLEAR / RESET ----
  if (/^(clear|reset)\b/.test(lower)) {
    await setCamera({ x: 0, y: 0, zoom: 1 });
    return { success: true, message: "Canvas reset to home (0,0)" };
  }

  // ---- NEW NOTE / NEW FOLDER ----
  // Supports:
  //   "new note"
  //   "new note Space Ideas"
  //   "new folder"
  //   "new folder Project X"
  const newMatch = raw.match(/^new\s+(note|folder)(?:\s+(.+))?$/i);
  if (newMatch) {
    const type = newMatch[1].toLowerCase(); // note|folder
    const nameRaw = newMatch[2] ? newMatch[2].trim() : "";
    const defaultName = type === "folder" ? "New Folder" : "New Note";
    const name = nameRaw || defaultName;

    // Try to create FS entry (best effort).
    // If it fails (schema mismatch), we still create a spatial node with a local-only id.
    let fsEntry = await tryCreateFsEntry(type, name);

    if (!fsEntry) {
      // Fallback: create a spatial-only node (still deterministic).
      const fallbackId = `draft:${uid()}`;
      const center = await getWorldCenter();
      const node = await upsertNode({
        entityType: "fs",
        entityId: fallbackId,
        x: center.x,
        y: center.y,
        scale: 1,
        z: 0,
        flags: { pinned: false },
      });

      // Optional: zoom to new node
      await zoomToNode(node.nodeId, {
        zoom: DEFAULT_FOCUS_ZOOM,
        viewportWidth: center.viewportWidth ?? undefined,
        viewportHeight: center.viewportHeight ?? undefined,
      });

      return {
        success: true,
        message:
          type === "folder"
            ? `Created folder '${name}' (spatial-only fallback)`
            : `Created note '${name}' (spatial-only fallback)`,
      };
    }

    // Create / ensure spatial node linked to FS
    const node = await ensureFsNode(fsEntry.id);

    // Zoom to it
    const center = await getWorldCenter();
    await zoomToNode(node.nodeId, {
      zoom: DEFAULT_FOCUS_ZOOM,
      viewportWidth: center.viewportWidth ?? undefined,
      viewportHeight: center.viewportHeight ?? undefined,
    });

    return {
      success: true,
      message:
        type === "folder"
          ? `Created folder '${name}'`
          : `Created note '${name}'`,
    };
  }

  // ---- OPEN ... ----
  // Supports:
  //   "open snake"
  //   "open settings"
  //   "open <filename>"
  const openMatch = raw.match(/^open\s+(.+)$/i);
  if (openMatch) {
    const targetRaw = openMatch[1].trim();
    if (!targetRaw) return { success: false, error: "Open what?" };

    const targetKey = normKey(targetRaw);

    // If it's a known app: ensure node exists and zoom to it
    if (KNOWN_APPS.has(targetKey)) {
      const node = await ensureAppNode(targetKey);
      const center = await getWorldCenter();
      await zoomToNode(node.nodeId, {
        zoom: DEFAULT_FOCUS_ZOOM,
        viewportWidth: center.viewportWidth ?? undefined,
        viewportHeight: center.viewportHeight ?? undefined,
      });

      return { success: true, message: `Opened ${targetRaw}` };
    }

    // Otherwise treat as file/folder name:
    const fsEntry = await findFsEntryByName(targetRaw);
    if (!fsEntry) {
      return { success: false, error: `Not found: ${targetRaw}` };
    }

    const node = await ensureFsNode(fsEntry.id);
    const center = await getWorldCenter();
    await zoomToNode(node.nodeId, {
      zoom: DEFAULT_FOCUS_ZOOM,
      viewportWidth: center.viewportWidth ?? undefined,
      viewportHeight: center.viewportHeight ?? undefined,
    });

    return { success: true, message: `Opened ${fsEntry.kind || "item"} '${fsEntry.name}'` };
  }

  return { success: false, error: "Unknown command" };
}
