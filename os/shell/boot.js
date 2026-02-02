// os/shell/boot.js
import { initDB } from "../storage/db.js";
import { initLauncherShell } from "./launcherShell.js";

export async function boot() {
  // Theme defaults (safe)
  if (!document.documentElement.getAttribute("data-theme")) {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.classList.add("theme-dark");
  }

  // Init DB (upgrade-safe, must NOT delete fs_entries)
  await initDB();

  // Start the new shell UI
  await initLauncherShell();

  // Remove boot screen
  const bootEl = document.getElementById("boot");
  if (bootEl) bootEl.remove();

  // Show app root
  const appRoot = document.getElementById("app");
  if (appRoot) appRoot.hidden = false;
}
