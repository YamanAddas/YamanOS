// os/theme/theme.js
// Theme + wallpaper application. Settings persistence lives in os/core/settings.js.

import { DEFAULT_WALLPAPERS } from "../config.js";

export function applyTheme({ theme, wallpaper, wallpaperUrl }) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(`theme-${t}`);

  // Wallpaper: keep it robust even if CSS doesn't explicitly reference --wallpaper yet.
  // 1) Set CSS var (preferred)
  // 2) Also set background-image directly (fallback)
  const url = wallpaperUrl || `./assets/wallpapers/${wallpaper}.svg`;
  const cssUrl = `url("${url}")`;
  document.documentElement.style.setProperty("--wallpaper", cssUrl);

  try {
    const cs = getComputedStyle(document.body);
    const existing = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "";
    const combined = existing ? `${cssUrl}, ${existing}` : cssUrl;
    document.body.style.backgroundImage = combined;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundAttachment = "fixed";
  } catch (_) {
    // ignore
  }
}

export function getWallpaperById(id) {
  return DEFAULT_WALLPAPERS.find((w) => w.id === id) || DEFAULT_WALLPAPERS[0];
}
