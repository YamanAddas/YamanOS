// os/shell/appRunner.js
// YamanOS v0.4 — App Runner (Overlay Window Manager)
// 100% client-side, ES modules, no canvas coupling.

const APP_LAYER_ID = "appLayer";

// These must match folder names in /apps
const KNOWN_APP_IDS = new Set([
  "files",
  "notes",
  "browser",
  "settings",
  "paint",
  "games",
  "snake",
  "minesweeper",
]);

let _running = new Map(); // appId -> { loading, panelEl, cleanupFn, nodeEl }

function ensureLayer() {
  let layer = document.getElementById(APP_LAYER_ID);
  if (!layer) {
    layer = document.createElement("div");
    layer.id = APP_LAYER_ID;
    document.body.appendChild(layer);
  }
  return layer;
}

function normalizeAppId(appId) {
  return String(appId || "").trim().toLowerCase();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makePanel(appId) {
  const panel = document.createElement("div");
  panel.className = "app-panel";
  panel.dataset.appId = appId;
  panel.innerHTML = `
    <div class="app-chrome">
      <div class="app-title">
        <span class="app-dot"></span>
        <span class="app-name">${escapeHtml(appId)}</span>
      </div>
      <div class="app-actions">
        <button class="app-close" title="Close">✕</button>
      </div>
    </div>
    <div class="app-content"></div>
  `;

  panel.querySelector(".app-close")?.addEventListener("click", () => closeApp(appId));

  // ESC closes the top-most app (best effort)
  const onKey = (e) => { if (e.key === "Escape") closeApp(appId); };
  window.addEventListener("keydown", onKey);
  panel._onKey = onKey;

  return panel;
}

function resolveMountUnmount(mod) {
  const mount = (typeof mod.mount === "function" && mod.mount) || (mod.default?.mount) || null;
  const unmount = (typeof mod.unmount === "function" && mod.unmount) || (mod.default?.unmount) || null;
  return { mount, unmount };
}

function animateOpen(panelEl, fromRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = Math.max(16, Math.min(28, Math.floor(Math.min(vw, vh) * 0.03)));
  const toRect = { left: margin, top: margin, width: vw - margin * 2, height: vh - margin * 2 - 60 };

  panelEl.style.left = `${fromRect.left}px`;
  panelEl.style.top = `${fromRect.top}px`;
  panelEl.style.width = `${Math.max(140, fromRect.width)}px`;
  panelEl.style.height = `${Math.max(90, fromRect.height)}px`;
  panelEl.style.opacity = "0";
  panelEl.style.transform = "scale(0.98)";

  panelEl.getBoundingClientRect(); // force layout

  panelEl.classList.add("opening");
  panelEl.style.opacity = "1";
  panelEl.style.left = `${toRect.left}px`;
  panelEl.style.top = `${toRect.top}px`;
  panelEl.style.width = `${toRect.width}px`;
  panelEl.style.height = `${toRect.height}px`;
  panelEl.style.transform = "scale(1)";

  setTimeout(() => panelEl.classList.remove("opening"), 240);
}

function animateClose(panelEl, toRect) {
  panelEl.classList.add("closing");
  panelEl.style.opacity = "0";
  panelEl.style.left = `${toRect.left}px`;
  panelEl.style.top = `${toRect.top}px`;
  panelEl.style.width = `${Math.max(140, toRect.width)}px`;
  panelEl.style.height = `${Math.max(90, toRect.height)}px`;
  panelEl.style.transform = "scale(0.98)";
}

async function importAppModule(appId) {
  // Clean relative import for GitHub Pages
  return await import(`../../apps/${appId}/app.js`);
}

export async function openApp(appId, opts = {}) {
  appId = normalizeAppId(appId);
  if (!appId) throw new Error("openApp: missing appId");

  if (!KNOWN_APP_IDS.has(appId)) {
    throw new Error(`openApp: unknown app '${appId}'`);
  }

  // If already running or loading, just "raise"
  if (_running.has(appId)) {
    const r = _running.get(appId);
    if (r.loading) return { alreadyRunning: true };
    if (r.panelEl) {
      r.panelEl.classList.add("raise");
      setTimeout(() => r.panelEl.classList.remove("raise"), 120);
      return { alreadyRunning: true };
    }
  }

  // Reserve immediately
  _running.set(appId, { loading: true });

  let panel = null;
  try {
    const layer = ensureLayer();

    // Animation origin
    let fromRect = null;
    if (opts.nodeEl?.getBoundingClientRect) {
      fromRect = opts.nodeEl.getBoundingClientRect();
    }
    if (!fromRect) {
      const vw = window.innerWidth, vh = window.innerHeight;
      fromRect = { left: vw / 2 - 140, top: vh / 2 - 80, width: 280, height: 160 };
    }

    panel = makePanel(appId);
    const content = panel.querySelector(".app-content");
    layer.appendChild(panel);

    animateOpen(panel, fromRect);

    const mod = await importAppModule(appId);
    const { mount, unmount } = resolveMountUnmount(mod);

    let cleanupFn = null;
    if (!mount) {
      content.innerHTML = `<div class="app-fallback">No mount() found in ${escapeHtml(appId)}</div>`;
    } else {
      const ctx = { appId };
      const ret = await mount(content, ctx);
      if (typeof ret === "function") cleanupFn = ret;
      else if (typeof unmount === "function") cleanupFn = () => unmount(content, ctx);
    }

    _running.set(appId, { panelEl: panel, cleanupFn, loading: false, nodeEl: opts.nodeEl || null });

    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });

    return { opened: true };

  } catch (err) {
    _running.delete(appId);
    try { panel?.remove(); } catch (_) {}
    throw err;
  }
}

export async function closeApp(appId) {
  appId = normalizeAppId(appId);
  const r = _running.get(appId);
  if (!r || r.loading) return { closed: false };

  try { if (typeof r.cleanupFn === "function") r.cleanupFn(); } catch (_) {}
  if (r.panelEl && r.panelEl._onKey) window.removeEventListener("keydown", r.panelEl._onKey);

  let toRect = null;
  if (r.nodeEl?.getBoundingClientRect) toRect = r.nodeEl.getBoundingClientRect();
  if (!toRect) toRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };

  animateClose(r.panelEl, toRect);
  setTimeout(() => { try { r.panelEl.remove(); } catch (_) {} }, 220);

  _running.delete(appId);
  return { closed: true };
}

export async function openAppIfKnown(token) {
  const appId = normalizeAppId(token);
  if (!KNOWN_APP_IDS.has(appId)) return { opened: false };
  await openApp(appId);
  return { opened: true };
}
