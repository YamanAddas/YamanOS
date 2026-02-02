// os/core/settings.js
// Central settings: single source of truth (IndexedDB kv store) + DOM application.
// This module is intentionally small and dependency-light.

import { kvGet, kvSet, kvDel, withTx, STORES, DEFAULTS } from "../storage/db.js";
import { DEFAULT_WALLPAPERS } from "../config.js";
import { applyTheme } from "../theme/theme.js";

export const WALLPAPERS = DEFAULT_WALLPAPERS;

const KV_KEYS = Object.freeze({
  SETTINGS: "settings.v1",
});

let _cached = null;

function normalizeSettings(s) {
  const d = DEFAULTS.SETTINGS;
  const o = (s && typeof s === "object") ? s : {};
  return {
    theme: o.theme === "light" ? "light" : "dark",
    wallpaper: String(o.wallpaper || d.wallpaper),
    uiScale: ["compact", "normal", "large"].includes(o.uiScale) ? o.uiScale : d.uiScale,
    reduceMotion: !!o.reduceMotion,
    timeFormat: o.timeFormat === "24h" ? "24h" : "12h",
    browserMode: o.browserMode === "embedded" ? "embedded" : "external",
  };
}

export async function getSettings({ force = false } = {}) {
  if (!force && _cached) return _cached;
  const raw = await kvGet(KV_KEYS.SETTINGS);
  _cached = normalizeSettings(raw);
  return _cached;
}

export async function setSetting(key, value) {
  const cur = await getSettings();
  const next = normalizeSettings({ ...cur, [key]: value });
  await kvSet(KV_KEYS.SETTINGS, next);
  _cached = next;
  applySettingsToDom(next);
  return next;
}

export function applySettingsToDom(settings) {
  const s = normalizeSettings(settings);

  // Data attributes used by CSS for lightweight behavior.
  document.documentElement.dataset.uiScale = s.uiScale;
  document.documentElement.dataset.reduceMotion = s.reduceMotion ? "1" : "0";
  document.documentElement.dataset.timeFormat = s.timeFormat;
  document.documentElement.dataset.browserMode = s.browserMode;

  const wp = DEFAULT_WALLPAPERS.find((w) => w.id === s.wallpaper) || DEFAULT_WALLPAPERS[0];
  applyTheme({ theme: s.theme, wallpaper: wp.id, wallpaperUrl: wp.url });
}

export async function resetLayoutOnly() {
  // Clears layout records ONLY. Does not touch fs_entries.
  // Safe: you keep your files.
  await withTx([STORES.SPATIAL_NODES, STORES.SHELL_STATE], "readwrite", async (_tx, stores) => {
    try { stores[STORES.SPATIAL_NODES].clear(); } catch (_) {}
    try { stores[STORES.SHELL_STATE].delete("camera"); } catch (_) {}
    try { stores[STORES.SHELL_STATE].delete("surface"); } catch (_) {}
  });
}

export async function resetSettingsOnly() {
  // Clears ONLY settings blob, leaves everything else intact.
  await kvDel(KV_KEYS.SETTINGS);
  _cached = null;
  const s = await getSettings({ force: true });
  applySettingsToDom(s);
}
