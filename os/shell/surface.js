// os/shell/surface.js
// YamanOS v0.4 - Spatial Canvas Surface
//
// Updates in this revision:
// - Visually distinguishes URL nodes (adds .node-url + icon)
// - Clicking a URL node opens Browser app overlay AND navigates it to that URL
//   via CustomEvent "yamanos:browser:navigate"
// - Listens for optional "yamanos:toast" events (from apps like Browser pin action)
//   and shows toast in shell

import { withTx, STORES } from "../storage/db.js";
import {
  initializeCanvasState,
  getCamera,
  setCamera,
} from "../core/state.js";
import { executeCommand } from "../core/commander.js";
import { openApp, openAppIfKnown } from "./appRunner.js";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5.0;
const NODE_REFRESH_MS = 500;
const TOAST_MS = 2200;

const ID_CANVAS = "canvas";
const ID_HUD = "hud";
const ID_CMD = "commandInput";
const ID_TOAST = "toast";

const BROWSER_NAV_EVENT = "yamanos:browser:navigate";
const TOAST_EVENT = "yamanos:toast";

let _running = false;
let _rafId = null;

let _camera = { x: 0, y: 0, zoom: 1 };
let _isDragging = false;
let _dragStart = { mx: 0, my: 0, camX: 0, camY: 0 };

let _nodeCache = new Map(); // nodeId -> nodeRecord
let _nodeEls = new Map();   // nodeId -> { el, lastKey }
let _lastCanvasTransformKey = "";

// DOM refs
let $canvas = null;
let $hud = null;
let $cmd = null;
let $toast = null;

// App icons
const APP_ICON = {
  snake: "🐍",
  settings: "⚙️",
  files: "🗂️",
  browser: "🌐",
  games: "🎮",
};

export async function initSurface() {
  if (_running) return;

  await initializeCanvasState();
  ensureDOM();

  _camera = await getCamera();
  await refreshNodes();

  bindPanZoom();
  bindCommandBar();
  bindToastEvents();

  _running = true;
  startLoop();

  setInterval(() => {
    if (_running) refreshNodes().catch(() => {});
  }, NODE_REFRESH_MS);
}

/* ----------------------------- DOM Setup ----------------------------- */

function ensureDOM() {
  $canvas = document.getElementById(ID_CANVAS);
  if (!$canvas) {
    $canvas = document.createElement("div");
    $canvas.id = ID_CANVAS;
    document.body.appendChild($canvas);
  }

  $hud = document.getElementById(ID_HUD);
  if (!$hud) {
    $hud = document.createElement("div");
    $hud.id = ID_HUD;
    $hud.innerHTML = `
      <div class="hud-bar">
        <button class="hud-btn" data-action="home" title="Home">⌂</button>
        <button class="hud-btn" data-action="files" title="Files">☰</button>
        <div class="hud-cmd-wrap">
          <input id="${ID_CMD}" class="hud-cmd" type="text" autocomplete="off" spellcheck="false"
                 placeholder="NEW NOTE Space Ideas   •   OPEN BROWSER   •   RESET" />
        </div>
      </div>

      <div class="files-drawer" data-open="false">
        <div class="files-drawer-header">
          <div class="files-title">FILES</div>
          <button class="hud-btn" data-action="closeFiles" title="Close">×</button>
        </div>
        <div class="files-drawer-body">
          <div class="files-hint">Fallback navigation (Phase 6+ will add search + recent).</div>
          <div class="files-list" id="filesList"></div>
        </div>
      </div>
    `;
    document.body.appendChild($hud);
  }

  $cmd = document.getElementById(ID_CMD);

  $toast = document.getElementById(ID_TOAST);
  if (!$toast) {
    $toast = document.createElement("div");
    $toast.id = ID_TOAST;
    $toast.setAttribute("aria-live", "polite");
    document.body.appendChild($toast);
  }
}

/* ----------------------------- Rendering ----------------------------- */

function startLoop() {
  const tick = () => {
    applyCanvasTransform();
    renderNodes();
    _rafId = requestAnimationFrame(tick);
  };
  _rafId = requestAnimationFrame(tick);
}

function applyCanvasTransform() {
  const key = `${_camera.x.toFixed(3)}|${_camera.y.toFixed(3)}|${_camera.zoom.toFixed(4)}`;
  if (key === _lastCanvasTransformKey) return;
  _lastCanvasTransformKey = key;

  $canvas.style.transform =
    `translate3d(${-_camera.x}px, ${-_camera.y}px, 0) scale(${_camera.zoom})`;
}

function renderNodes() {
  for (const [nodeId, node] of _nodeCache.entries()) {
    let entry = _nodeEls.get(nodeId);
    if (!entry) {
      const el = document.createElement("div");
      el.className = "node";
      el.dataset.nodeId = nodeId;
      el.dataset.entityType = node.entityType || "";
      el.dataset.entityId = node.entityId || "";
      el.dataset.active = "false";

      el.innerHTML = `
        <div class="node-inner">
          <div class="node-icon" aria-hidden="true"></div>
          <div class="node-meta">
            <div class="node-label"></div>
            <div class="node-sub"></div>
          </div>
        </div>
      `;

      $canvas.appendChild(el);
      entry = { el, lastKey: "" };
      _nodeEls.set(nodeId, entry);

      // Prevent background drag on node mouse down
      el.addEventListener("mousedown", (e) => e.stopPropagation());

      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          // URL node: open browser + navigate
          if (node.entityType === "url") {
            await openApp("browser", { nodeId, nodeEl: el });
            // Tell browser to navigate
            window.dispatchEvent(new CustomEvent(BROWSER_NAV_EVENT, {
              detail: { url: node.entityId }
            }));
            return;
          }

          // App node: open overlay app
          if (node.entityType === "app") {
            await openApp(node.entityId, { nodeId, nodeEl: el });
            return;
          }

          // Other node types: focus/zoom only
          await zoomToNodeId(nodeId);

        } catch (err) {
          showToast(err?.message || "Action failed", true);
        }
      });
    }

    // Apply URL node class for visuals
    if (node.entityType === "url") entry.el.classList.add("node-url");
    else entry.el.classList.remove("node-url");

    const label = buildNodeLabel(node);
    const sub = buildNodeSub(node);
    const icon = buildNodeIcon(node);

    const tKey = `${node.x}|${node.y}|${node.scale}|${node.z}|${node.flags?.hidden ? 1 : 0}|${label}|${sub}|${icon}|${node.entityType}`;
    if (tKey !== entry.lastKey) {
      entry.lastKey = tKey;

      const scale = Number.isFinite(node.scale) && node.scale > 0 ? node.scale : 1;
      const z = Number.isFinite(node.z) ? node.z : 0;

      entry.el.style.transform = `translate3d(${node.x}px, ${node.y}px, 0) scale(${scale})`;
      entry.el.style.zIndex = String(1000 + z);

      const hidden = !!node.flags?.hidden;
      entry.el.style.display = hidden ? "none" : "block";

      const $i = entry.el.querySelector(".node-icon");
      const $l = entry.el.querySelector(".node-label");
      const $s = entry.el.querySelector(".node-sub");

      if ($i) $i.textContent = icon;
      if ($l) $l.textContent = label;
      if ($s) $s.textContent = sub;
    }
  }

  // Remove stale DOM nodes
  for (const [nodeId, entry] of _nodeEls.entries()) {
    if (!_nodeCache.has(nodeId)) {
      entry.el.remove();
      _nodeEls.delete(nodeId);
    }
  }
}

function buildNodeIcon(node) {
  if (node.entityType === "app") {
    return APP_ICON[node.entityId] || "◆";
  }
  if (node.entityType === "url") {
    return "🔗";
  }
  // file/folder placeholder
  const id = String(node.entityId || "");
  if (id.startsWith("draft:")) return "📝";
  return "📄";
}

function buildNodeLabel(node) {
  if (node.entityType === "app") {
    return String(node.entityId || "app").toUpperCase();
  }
  if (node.entityType === "url") {
    // show hostname if possible (but we only have URL in entityId)
    try {
      const u = new URL(String(node.entityId || ""));
      return u.hostname.replace(/^www\./, "").toUpperCase();
    } catch {
      return "WEB";
    }
  }
  const id = String(node.entityId || "file");
  if (id.startsWith("draft:")) return "NOTE";
  return "FILE";
}

function buildNodeSub(node) {
  if (node.entityType === "app") return "TAP TO LAUNCH";
  if (node.entityType === "url") return "TAP TO BROWSE";
  return "TAP TO FOCUS";
}

/* --------------------------- Node Data Cache -------------------------- */

async function refreshNodes() {
  const nodes = await readAllSpatialNodes();
  const next = new Map();
  for (const n of nodes) next.set(n.nodeId, n);
  _nodeCache = next;
}

async function readAllSpatialNodes() {
  return await withTx(STORES.SPATIAL_NODES, "readonly", async (_tx, stores) => {
    const st = stores[STORES.SPATIAL_NODES];
    const results = [];

    await new Promise((resolve, reject) => {
      const req = st.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(true);
        results.push(cursor.value);
        cursor.continue();
      };
    });

    return results;
  });
}

/* ---------------------------- Pan + Zoom ------------------------------ */

function bindPanZoom() {
  $canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    _isDragging = true;
    _dragStart.mx = e.clientX;
    _dragStart.my = e.clientY;
    _dragStart.camX = _camera.x;
    _dragStart.camY = _camera.y;
    $canvas.classList.add("grabbing");
  });

  window.addEventListener("mousemove", (e) => {
    if (!_isDragging) return;

    const dx = e.clientX - _dragStart.mx;
    const dy = e.clientY - _dragStart.my;

    const invZoom = 1 / (_camera.zoom || 1);
    const next = {
      x: _dragStart.camX - dx * invZoom,
      y: _dragStart.camY - dy * invZoom,
      zoom: _camera.zoom,
    };

    setCameraLocal(next);
  });

  window.addEventListener("mouseup", async () => {
    if (!_isDragging) return;
    _isDragging = false;
    $canvas.classList.remove("grabbing");
    await setCamera(_camera);
  });

  window.addEventListener(
    "wheel",
    async (e) => {
      if (isEventInHUD(e)) return;
      e.preventDefault();

      const oldZoom = _camera.zoom || 1;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      let newZoom = clamp(oldZoom * factor, ZOOM_MIN, ZOOM_MAX);

      const mx = e.clientX;
      const my = e.clientY;

      const worldX = _camera.x + mx / oldZoom;
      const worldY = _camera.y + my / oldZoom;

      const nextX = worldX - mx / newZoom;
      const nextY = worldY - my / newZoom;

      setCameraLocal({ x: nextX, y: nextY, zoom: newZoom });
      await setCamera(_camera);
    },
    { passive: false }
  );
}

function isEventInHUD(e) {
  if (!$hud) return false;
  const path = e.composedPath ? e.composedPath() : [];
  return path.includes($hud);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function setCameraLocal(next) {
  _camera = {
    x: Number.isFinite(next.x) ? next.x : _camera.x,
    y: Number.isFinite(next.y) ? next.y : _camera.y,
    zoom: Number.isFinite(next.zoom) && next.zoom > 0 ? next.zoom : _camera.zoom,
  };
}

/* --------------------------- Command + HUD ---------------------------- */

function bindCommandBar() {
  $hud.addEventListener("click", async (e) => {
    const btn = e.target.closest(".hud-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "home") {
      await setCameraLocalAndPersist({ x: 0, y: 0, zoom: 1 });
      showToast("HOME", false);
    } else if (action === "files") {
      toggleFilesDrawer(true);
    } else if (action === "closeFiles") {
      toggleFilesDrawer(false);
    }
  });

  $cmd.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const value = $cmd.value.trim();
    if (!value) return;

    $cmd.disabled = true;

    try {
      const result = await executeCommand(value);

      if (result?.success) showToast(result.message || "OK", false);
      else showToast(result?.error || "UNKNOWN COMMAND", true);

      // If user typed OPEN <app>, launch app overlay too
      const m = value.trim().match(/^open\s+(.+)$/i);
      if (m) {
        const token = (m[1] || "").trim().toLowerCase();
        if (token) await openAppIfKnown(token);
      }

      _camera = await getCamera();
      await refreshNodes();
    } catch (err) {
      showToast("COMMAND FAILED", true);
    } finally {
      $cmd.value = "";
      $cmd.disabled = false;
      $cmd.focus();
    }
  });
}

async function setCameraLocalAndPersist(cam) {
  setCameraLocal(cam);
  _camera = await setCamera(_camera);
}

function toggleFilesDrawer(open) {
  const drawer = $hud.querySelector(".files-drawer");
  if (!drawer) return;
  drawer.setAttribute("data-open", open ? "true" : "false");
}

/* ------------------------------ Focus ------------------------------- */

async function zoomToNodeId(nodeId) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const mod = await import("../core/state.js");
  const { zoomToNode } = mod;

  await zoomToNode(nodeId, { viewportWidth: vw, viewportHeight: vh });
  _camera = await getCamera();
}

/* ------------------------------ Toast ------------------------------- */

let _toastTimer = null;

function showToast(text, isError = false) {
  if (!$toast) return;

  $toast.textContent = String(text || "");
  $toast.setAttribute("data-error", isError ? "true" : "false");
  $toast.setAttribute("data-show", "true");

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    $toast.setAttribute("data-show", "false");
  }, TOAST_MS);
}

function bindToastEvents() {
  window.addEventListener(TOAST_EVENT, (e) => {
    const msg = e?.detail?.message;
    const err = !!e?.detail?.error;
    if (msg) showToast(msg, err);
  });
}
