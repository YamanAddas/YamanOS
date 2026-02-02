// os/core/state.js
// YamanOS v0.4 Spatial Shell State Layer (Offline / No external APIs)
//
// Responsibilities:
// - Persist and retrieve camera state (pan/zoom).
// - Persist and retrieve spatial nodes (files/apps on the canvas).
// - Provide a deterministic "zoomToNode" state update.
// - Provide initializeCanvasState() for boot-time defaults.
//
// IMPORTANT:
// - This layer does NOT depend on DOM. If you want perfect centering,
//   pass viewportWidth/viewportHeight into zoomToNode().

import { withTx, STORES, DEFAULTS } from "../storage/db.js";

const SHELL_KEY_DEFAULT = "default";

/**
 * Internal: now() helper
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Validate/normalize camera object.
 * Camera coordinates are "world coords" of the *screen origin* (top-left)
 * at the current zoom. (You can use a different convention if you want,
 * but keep it consistent everywhere.)
 *
 * @param {any} cam
 * @returns {{x:number, y:number, zoom:number}}
 */
function normalizeCamera(cam) {
  const fallback = DEFAULTS.CAMERA;

  const x = Number.isFinite(cam?.x) ? cam.x : fallback.x;
  const y = Number.isFinite(cam?.y) ? cam.y : fallback.y;
  const zoom = Number.isFinite(cam?.zoom) && cam.zoom > 0 ? cam.zoom : fallback.zoom;

  return { x, y, zoom };
}

/**
 * Ensure the shell_state record exists with default camera.
 * Call this once during boot (early).
 */
export async function initializeCanvasState() {
  await withTx(STORES.SHELL_STATE, "readwrite", async (_tx, stores) => {
    const st = stores[STORES.SHELL_STATE];

    const existing = await new Promise((resolve, reject) => {
      const req = st.get(SHELL_KEY_DEFAULT);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (existing) return;

    const record = {
      key: SHELL_KEY_DEFAULT,
      version: "0.4",
      camera: { ...DEFAULTS.CAMERA },
      ui: {
        filesDrawerOpen: false,
        lastWorkspaceId: null,
      },
      updatedAt: nowISO(),
    };

    await new Promise((resolve, reject) => {
      const req = st.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Get current camera state from shell_state.
 * @returns {Promise<{x:number, y:number, zoom:number}>}
 */
export async function getCamera() {
  const record = await withTx(STORES.SHELL_STATE, "readonly", async (_tx, stores) => {
    const st = stores[STORES.SHELL_STATE];
    return await new Promise((resolve, reject) => {
      const req = st.get(SHELL_KEY_DEFAULT);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });

  if (!record?.camera) return { ...DEFAULTS.CAMERA };
  return normalizeCamera(record.camera);
}

/**
 * Set camera state in shell_state.
 * @param {{x:number, y:number, zoom:number}} camera
 * @returns {Promise<{x:number, y:number, zoom:number}>} normalized camera
 */
export async function setCamera(camera) {
  const cam = normalizeCamera(camera);

  await withTx(STORES.SHELL_STATE, "readwrite", async (_tx, stores) => {
    const st = stores[STORES.SHELL_STATE];

    const existing = await new Promise((resolve, reject) => {
      const req = st.get(SHELL_KEY_DEFAULT);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    const next = existing || {
      key: SHELL_KEY_DEFAULT,
      version: "0.4",
      ui: {},
    };

    next.camera = cam;
    next.updatedAt = nowISO();

    await new Promise((resolve, reject) => {
      const req = st.put(next);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });

  return cam;
}

/**
 * Build a stable nodeId for an entity.
 * entityType is expected to be "fs" or "app" (tight vocabulary).
 * @param {"fs"|"app"} entityType
 * @param {string} entityId
 */
function buildNodeId(entityType, entityId) {
  return `${entityType}:${entityId}`;
}

/**
 * Upsert a spatial node record.
 *
 * Minimal required:
 * - entityType: "fs" | "app"
 * - entityId: string
 * - x, y: numbers
 *
 * Optional:
 * - nodeId (if you want custom ids)
 * - scale, z, flags, clusterId
 *
 * @param {{
 *  nodeId?: string,
 *  entityType: "fs"|"app",
 *  entityId: string,
 *  x: number,
 *  y: number,
 *  scale?: number,
 *  z?: number,
 *  flags?: { pinned?: boolean, hidden?: boolean, locked?: boolean, collapsed?: boolean },
 *  clusterId?: string|null
 * }} node
 * @returns {Promise<any>} saved node record
 */
export async function upsertNode(node) {
  if (!node || (node.entityType !== "fs" && node.entityType !== "app")) {
    throw new Error("upsertNode: entityType must be 'fs' or 'app'");
  }
  if (typeof node.entityId !== "string" || !node.entityId) {
    throw new Error("upsertNode: entityId must be a non-empty string");
  }

  const x = Number(node.x);
  const y = Number(node.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("upsertNode: x and y must be finite numbers");
  }

  const nodeId = typeof node.nodeId === "string" && node.nodeId
    ? node.nodeId
    : buildNodeId(node.entityType, node.entityId);

  const scale = Number.isFinite(node.scale) && node.scale > 0 ? node.scale : 1;
  const z = Number.isFinite(node.z) ? node.z : 0;

  const flags = {
    pinned: !!node.flags?.pinned,
    hidden: !!node.flags?.hidden,
    locked: !!node.flags?.locked,
    collapsed: !!node.flags?.collapsed,
  };

  const record = {
    nodeId,
    entityType: node.entityType,
    entityId: node.entityId,
    x,
    y,
    scale,
    z,
    flags,
    clusterId: node.clusterId ?? null,
    updatedAt: nowISO(),
  };

  await withTx(STORES.SPATIAL_NODES, "readwrite", async (_tx, stores) => {
    const st = stores[STORES.SPATIAL_NODES];
    await new Promise((resolve, reject) => {
      const req = st.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });

  return record;
}

/**
 * Internal helper: fetch node by nodeId.
 * @param {string} nodeId
 * @returns {Promise<any|null>}
 */
async function getNode(nodeId) {
  if (typeof nodeId !== "string" || !nodeId) return null;

  return await withTx(STORES.SPATIAL_NODES, "readonly", async (_tx, stores) => {
    const st = stores[STORES.SPATIAL_NODES];
    return await new Promise((resolve, reject) => {
      const req = st.get(nodeId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Zoom/pan the camera to center a node.
 *
 * Camera convention used here:
 * - camera.x, camera.y represent the world-coordinate of the screen's top-left corner.
 * - camera.zoom is a scale factor.
 *
 * To truly center on screen, pass viewportWidth/viewportHeight.
 *
 * If viewport sizes are not provided:
 * - we still set camera to the node position as the origin (best-effort)
 *
 * @param {string} nodeId
 * @param {{
 *  zoom?: number,
 *  viewportWidth?: number,
 *  viewportHeight?: number
 * }} [opts]
 * @returns {Promise<{camera: {x:number,y:number,zoom:number}, node: any}>}
 */
export async function zoomToNode(nodeId, opts = {}) {
  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`zoomToNode: node not found: ${nodeId}`);
  }

  const current = await getCamera();
  const zoom = Number.isFinite(opts.zoom) && opts.zoom > 0 ? opts.zoom : current.zoom;

  const vw = Number.isFinite(opts.viewportWidth) ? opts.viewportWidth : null;
  const vh = Number.isFinite(opts.viewportHeight) ? opts.viewportHeight : null;

  // If we know viewport, compute top-left so node lands at center.
  // screenCenter = (vw/2, vh/2)
  // worldTopLeft = node - screenCenter/zoom
  let x, y;
  if (vw !== null && vh !== null && vw > 0 && vh > 0) {
    x = node.x - (vw / (2 * zoom));
    y = node.y - (vh / (2 * zoom));
  } else {
    // Best-effort fallback:
    // Put node near origin (top-left) which will at least bring it into view,
    // and UI can animate/adjust later with real viewport dims.
    x = node.x;
    y = node.y;
  }

  const camera = await setCamera({ x, y, zoom });
  return { camera, node };
}
