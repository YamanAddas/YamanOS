// apps/settings/app.js
// YamanOS v0.4 — Settings (offline)
// NOTE: No inline styles. All styling lives in css/apps/settings.css

import {
  getSettings,
  setSetting,
  resetLayoutOnly,
  resetSettingsOnly,
  WALLPAPERS,
} from "../../os/core/settings.js";

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function optionRow({ label, hint, controlHtml }) {
  return `
    <div class="settings__row">
      <div class="settings__rowLeft">
        <div class="settings__label">${esc(label)}</div>
        ${hint ? `<div class="settings__hint">${esc(hint)}</div>` : ""}
      </div>
      <div class="settings__rowRight">
        ${controlHtml}
      </div>
    </div>
  `;
}

function section(title, innerHtml) {
  return `
    <section class="settings__section">
      <div class="settings__sectionTitle">${esc(title)}</div>
      <div class="settings__card">
        ${innerHtml}
      </div>
    </section>
  `;
}

function toggle(id, checked) {
  return `
    <label class="settings__toggle">
      <input type="checkbox" id="${esc(id)}" ${checked ? "checked" : ""}/>
      <span class="settings__toggleUi" aria-hidden="true"></span>
    </label>
  `;
}

function select(id, options, value) {
  const opts = options
    .map(o => `<option value="${esc(o.value)}" ${o.value === value ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("");
  return `<select class="settings__select" id="${esc(id)}">${opts}</select>`;
}

function btn(id, text, variant = "default") {
  return `<button class="settings__btn settings__btn--${variant}" id="${esc(id)}">${esc(text)}</button>`;
}

export async function mount(container) {
  container.innerHTML = `<div class="settings settings__loading">Loading…</div>`;

  const settings = await getSettings();

  const wallpaperOptions = WALLPAPERS.map(w => ({ value: w.id, label: w.name }));
  const scaleOptions = [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "large", label: "Large" },
  ];
  const timeOptions = [
    { value: "12h", label: "12-hour" },
    { value: "24h", label: "24-hour" },
  ];
  const browserOptions = [
    { value: "external", label: "External tabs (recommended)" },
    { value: "embedded", label: "Embedded iframe (limited)" },
  ];

  container.innerHTML = `
    <div class="settings">
      <header class="settings__header">
        <div class="settings__title">Settings</div>
        <div class="settings__sub">Device-friendly • offline • upgrade-safe</div>
      </header>

      ${section("Appearance",
        optionRow({
          label: "Dark Mode",
          hint: "Switch between dark and light UI theme.",
          controlHtml: toggle("set_theme", settings.theme === "dark"),
        }) +
        optionRow({
          label: "Wallpaper",
          hint: "Offline wallpapers (stored locally).",
          controlHtml: select("set_wallpaper", wallpaperOptions, settings.wallpaper),
        })
      )}

      ${section("Interface",
        optionRow({
          label: "UI Size",
          hint: "Controls how compact the shell feels (your shell must honor it).",
          controlHtml: select("set_uiScale", scaleOptions, settings.uiScale),
        }) +
        optionRow({
          label: "Reduce Motion",
          hint: "Prefer fewer animations (helps older phones/tablets).",
          controlHtml: toggle("set_reduceMotion", !!settings.reduceMotion),
        }) +
        optionRow({
          label: "Time Format",
          hint: "Clock display preference.",
          controlHtml: select("set_timeFormat", timeOptions, settings.timeFormat),
        })
      )}

      ${section("Browser",
        optionRow({
          label: "Browser Mode",
          hint: "Many sites block iframe embedding (YouTube/Google/Bing). External is the stable mode.",
          controlHtml: select("set_browserMode", browserOptions, settings.browserMode),
        })
      )}

      ${section("Maintenance (Safe)",
        `<div class="settings__warn">
          These actions do <b>not</b> delete your filesystem (<code>${esc("fs_entries")}</code>).<br/>
          Use them if your layout breaks or settings drift.
        </div>` +
        `<div class="settings__btnRow">
          ${btn("btn_reset_layout", "Reset Layout (safe)", "danger")}
          ${btn("btn_reset_settings", "Reset Settings (safe)", "danger")}
        </div>`
      )}

      <footer class="settings__footer">
        Tip: If your DB is truly corrupted from old mixed builds, you may need a manual “Clear site data” once —
        but this app will never do that automatically.
      </footer>
    </div>
  `;

  // Wire events
  const $ = (id) => container.querySelector(`#${CSS.escape(id)}`);

  $("set_theme")?.addEventListener("change", async (e) => {
    const on = !!e.target.checked;
    await setSetting("theme", on ? "dark" : "light");
  });

  $("set_wallpaper")?.addEventListener("change", async (e) => {
    await setSetting("wallpaper", e.target.value);
  });

  $("set_uiScale")?.addEventListener("change", async (e) => {
    await setSetting("uiScale", e.target.value);
  });

  $("set_reduceMotion")?.addEventListener("change", async (e) => {
    await setSetting("reduceMotion", !!e.target.checked);
  });

  $("set_timeFormat")?.addEventListener("change", async (e) => {
    await setSetting("timeFormat", e.target.value);
  });

  $("set_browserMode")?.addEventListener("change", async (e) => {
    await setSetting("browserMode", e.target.value);
  });

  $("btn_reset_layout")?.addEventListener("click", async () => {
    if (!confirm("Reset layout only? Files are NOT deleted.")) return;
    await resetLayoutOnly();
    alert("Layout reset. Reload the page.");
  });

  $("btn_reset_settings")?.addEventListener("click", async () => {
    if (!confirm("Reset settings to defaults? Files are NOT deleted.")) return;
    await resetSettingsOnly();
    alert("Settings reset. Reload the page.");
  });

  return () => {};
}
