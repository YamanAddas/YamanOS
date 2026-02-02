// os/shell/launcherShell.js
import { kvGet, kvSet } from "../storage/db.js";
import { openApp } from "./appRunner.js";
import { executeCommand } from "../core/commander.js";
import { toast } from "./toast.js";

const ICONS = {
  logo: "./assets/icons/yamanos.svg",

  notes: "./assets/icons/icon-notes.svg",
  files: "./assets/icons/icon-files.svg",
  browser: "./assets/icons/icon-browser.svg",
  downloads: "./assets/icons/icon-downloads.svg",

  chat: "./assets/icons/icon-chat.svg",
  gemini: "./assets/icons/icon-gemini.svg",
  deepseek: "./assets/icons/icon-deepseek.svg",

  facebook: "./assets/icons/icon-facebook.svg",
  x: "./assets/icons/icon-x.svg",
  youtube: "./assets/icons/icon-youtube.svg",

  snake: "./assets/icons/icon-snake.svg",
  mines: "./assets/icons/icon-mines.svg",
};

const DEFAULT_PANELS = {
  ai: { collapsed: false },
  social: { collapsed: false },
  games: { collapsed: false },
};

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, String(v));
  }
  for (const c of children) n.append(c);
  return n;
}

function fmtTimeDate(d = new Date()) {
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return { time, date };
}

async function safeOpenExternal(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    await toast("Popup blocked — allow popups to open external sites.", true);
  }
}

export class LauncherShell {
  constructor(root) {
    this.root = root;
    this.state = {
      editMode: false,
      panels: structuredClone(DEFAULT_PANELS),
      startOpen: false,
    };

    this.$startPanel = null;
    this.$clockTime = null;
    this.$clockDate = null;
    this.$search = null;
  }

  async init() {
    const saved = await kvGet("shell.state").catch(() => null);
    if (saved && typeof saved === "object") {
      if (typeof saved.editMode === "boolean") this.state.editMode = saved.editMode;
      if (saved.panels && typeof saved.panels === "object") {
        for (const k of Object.keys(DEFAULT_PANELS)) {
          const c = !!saved.panels?.[k]?.collapsed;
          this.state.panels[k] = { collapsed: c };
        }
      }
    }

    this.render();
    this.bindGlobalClose();
    this.startClock();
  }

  async persist() {
    await kvSet("shell.state", {
      editMode: this.state.editMode,
      panels: this.state.panels,
    }).catch(() => {});
  }

  render() {
    this.root.innerHTML = "";

    const header = this.renderHeader();
    const desktop = this.renderDesktop();
    const dock = this.renderDock();
    const taskbar = this.renderTaskbar();
    const startPanel = this.renderStartPanel();

    const shell = el("div", { class: "shell" }, [header, desktop, dock, taskbar, startPanel]);
    this.root.append(shell);
  }

  renderHeader() {
    const logo = el("img", { class: "shell-logo", src: ICONS.logo, alt: "" });

    const brand = el("div", { class: "shell-brand" }, [
      logo,
      el("div", { class: "shell-title", text: "YamanOS" }),
    ]);

    const subtitle = el("div", { class: "shell-subtitle", text: "Explore, Connect, Create" });

    const editBtn = el("button", {
      class: "shell-edit",
      text: this.state.editMode ? "Edit Mode (On)" : "Edit Mode",
      onclick: async () => {
        this.state.editMode = !this.state.editMode;
        await this.persist();
        this.render();
        await toast(this.state.editMode ? "Edit Mode enabled" : "Edit Mode disabled");
      },
    });

    return el("div", { class: "shell-header" }, [brand, subtitle, editBtn]);
  }

  renderDesktop() {
    const left = el("div", { class: "shell-col left" }, [
      this.panelAI(),
      this.panelSocial(),
    ]);

    const right = el("div", { class: "shell-col right" }, [
      this.panelGames(),
    ]);

    return el("div", { class: "shell-desktop" }, [left, right]);
  }

  panelBase({ key, title, badge, tiles }) {
    const collapsed = this.state.panels[key]?.collapsed ? "1" : "0";

    const header = el("div", { class: "panel-header" }, [
      el("div", { class: "panel-left" }, [
        el("div", { class: "panel-badge", text: badge }),
        el("div", { text: title }),
      ]),
      el("button", {
        class: "panel-toggle",
        text: collapsed === "1" ? "▾" : "▴",
        onclick: async () => {
          this.state.panels[key].collapsed = !this.state.panels[key].collapsed;
          await this.persist();
          this.render();
        },
      }),
    ]);

    const body = el("div", { class: "panel-body" }, [
      el("div", { class: "tile-grid" }, tiles.map(t => this.tile(t))),
    ]);

    const p = el("div", { class: "panel" }, [header, body]);
    p.dataset.collapsed = collapsed;
    p.dataset.key = key; // IMPORTANT: lets CSS target panels reliably
    return p;
  }

  tile({ icon, label, onClick }) {
    const img = el("img", { src: icon, alt: "" });
    const ico = el("div", { class: "tile-icon" }, [img]);
    const lbl = el("div", { class: "tile-label", text: label });

    const t = el("div", { class: "tile" }, [ico, lbl]);
    t.addEventListener("click", onClick);
    return t;
  }

  panelAI() {
    return this.panelBase({
      key: "ai",
      title: "AI Apps",
      badge: "✦",
      tiles: [
        { icon: ICONS.chat, label: "ChatGPT", onClick: () => safeOpenExternal("https://chatgpt.com") },
        { icon: ICONS.gemini, label: "Gemini", onClick: () => safeOpenExternal("https://gemini.google.com") },
        { icon: ICONS.deepseek, label: "DeepSeek", onClick: () => safeOpenExternal("https://www.deepseek.com") },
      ],
    });
  }

  panelSocial() {
    return this.panelBase({
      key: "social",
      title: "Social Apps",
      badge: "⌁",
      tiles: [
        { icon: ICONS.facebook, label: "Facebook", onClick: () => safeOpenExternal("https://facebook.com") },
        { icon: ICONS.x, label: "X", onClick: () => safeOpenExternal("https://x.com") },
        { icon: ICONS.youtube, label: "YouTube", onClick: () => safeOpenExternal("https://youtube.com") },
      ],
    });
  }

  panelGames() {
    // Only two games. No placeholder tile.
    return this.panelBase({
      key: "games",
      title: "Games",
      badge: "★",
      tiles: [
        { icon: ICONS.mines, label: "Mines", onClick: (e) => openApp("minesweeper", { nodeEl: e.currentTarget }) },
        { icon: ICONS.snake, label: "Snake", onClick: (e) => openApp("snake", { nodeEl: e.currentTarget }) },
      ],
    });
  }

  renderDock() {
    const items = [
      { label: "Notes", icon: ICONS.notes, on: (e) => openApp("notes", { nodeEl: e.currentTarget }) },
      { label: "Files", icon: ICONS.files, on: (e) => openApp("files", { nodeEl: e.currentTarget }) },
      { label: "Browser", icon: ICONS.browser, on: (e) => openApp("browser", { nodeEl: e.currentTarget }) },
      { label: "Downloads", icon: ICONS.downloads, on: async () => {
          await toast("Downloads opens in Files (folder support coming soon).");
          await openApp("files", {});
        } },
    ];

    const inner = el("div", { class: "dock-inner" }, items.map(it => {
      const img = el("img", { src: it.icon, alt: "" });
      const icon = el("div", { class: "dock-icon" }, [img]);
      const label = el("div", { class: "dock-label", text: it.label });
      const wrap = el("div", { class: "dock-item" }, [icon, label]);
      wrap.addEventListener("click", it.on);
      return wrap;
    }));

    return el("div", { class: "dock" }, [inner]);
  }

  renderTaskbar() {
    const startBtn = el("button", {
      class: "start-btn",
      onclick: () => this.toggleStart(),
    }, [
      el("img", { src: ICONS.logo, alt: "" }),
      el("span", { text: "Start" }),
    ]);

    this.$search = el("input", {
      placeholder: "Search… (or type a command: NEW NOTE, OPEN FILES, OPEN SNAKE)",
      "aria-label": "Search or command",
    });

    this.$search.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const v = this.$search.value.trim();
      if (!v) return;

      this.closeStart();

      const res = await executeCommand(v).catch(err => ({ success: false, error: err?.message || String(err) }));
      if (res?.success) await toast(res.message || "Done");
      else await toast(res?.error || "Command failed", true);

      this.$search.value = "";
    });

    const searchWrap = el("div", { class: "search" }, [
      el("span", { text: "🔍" }),
      this.$search,
    ]);

    this.$clockTime = el("div", { class: "time", text: "--:--" });
    this.$clockDate = el("div", { class: "date", text: "---" });

    const status = el("div", { class: "status" }, [
      el("div", { class: "ico", title: "Wi-Fi", text: "📶" }),
      el("div", { class: "ico", title: "Notifications", text: "🔔" }),
      el("div", { class: "clock" }, [this.$clockTime, this.$clockDate]),
    ]);

    return el("div", { class: "taskbar" }, [
      el("div", { class: "taskbar-inner" }, [startBtn, searchWrap, status]),
    ]);
  }

  renderStartPanel() {
    const apps = [
      { title: "Files", icon: ICONS.files, action: () => openApp("files", {}) },
      { title: "Notes", icon: ICONS.notes, action: () => openApp("notes", {}) },
      { title: "Browser", icon: ICONS.browser, action: () => openApp("browser", {}) },
      { title: "Settings", icon: "./assets/icons/icon-settings.svg", action: () => openApp("settings", {}) },
      { title: "Paint", icon: "./assets/icons/icon-paint.svg", action: () => openApp("paint", {}) },
      { title: "Minesweeper", icon: ICONS.mines, action: () => openApp("minesweeper", {}) },
      { title: "Snake", icon: ICONS.snake, action: () => openApp("snake", {}) },
    ];

    const portals = [
      { title: "ChatGPT", icon: ICONS.chat, url: "https://chatgpt.com" },
      { title: "Gemini", icon: ICONS.gemini, url: "https://gemini.google.com" },
      { title: "DeepSeek", icon: ICONS.deepseek, url: "https://www.deepseek.com" },
      { title: "Facebook", icon: ICONS.facebook, url: "https://facebook.com" },
      { title: "X", icon: ICONS.x, url: "https://x.com" },
      { title: "YouTube", icon: ICONS.youtube, url: "https://youtube.com" },
    ];

    const appList = el("div", { class: "list" }, apps.map(a => {
      const r = el("div", { class: "row" }, [
        el("img", { src: a.icon, alt: "" }),
        el("div", { class: "t", text: a.title }),
        el("div", { class: "s", text: "App" }),
      ]);
      r.addEventListener("click", () => { this.closeStart(); a.action(); });
      return r;
    }));

    const portalList = el("div", { class: "list" }, portals.map(p => {
      const r = el("div", { class: "row" }, [
        el("img", { src: p.icon, alt: "" }),
        el("div", { class: "t", text: p.title }),
        el("div", { class: "s", text: "External" }),
      ]);
      r.addEventListener("click", () => { this.closeStart(); safeOpenExternal(p.url); });
      return r;
    }));

    const body = el("div", { class: "start-panel-body" }, [
      el("div", {}, [
        el("div", { class: "group-title", text: "Apps" }),
        appList,
      ]),
      el("div", {}, [
        el("div", { class: "group-title", text: "Portals" }),
        portalList,
      ]),
    ]);

    const head = el("div", { class: "start-panel-head" }, [
      el("div", { class: "start-panel-title", text: "Start" }),
      el("button", { class: "start-panel-close", text: "✕", onclick: () => this.closeStart() }),
    ]);

    this.$startPanel = el("div", { class: "start-panel" }, [head, body]);
    this.$startPanel.dataset.open = this.state.startOpen ? "1" : "0";
    return this.$startPanel;
  }

  toggleStart() {
    this.state.startOpen = !this.state.startOpen;
    if (this.$startPanel) this.$startPanel.dataset.open = this.state.startOpen ? "1" : "0";
  }

  closeStart() {
    this.state.startOpen = false;
    if (this.$startPanel) this.$startPanel.dataset.open = "0";
  }

  bindGlobalClose() {
    window.addEventListener("mousedown", (e) => {
      if (!this.state.startOpen) return;
      const t = e.target;
      if (this.$startPanel && this.$startPanel.contains(t)) return;
      if (t?.closest?.(".start-btn")) return;
      this.closeStart();
    });
  }

  startClock() {
    const tick = () => {
      const { time, date } = fmtTimeDate(new Date());
      if (this.$clockTime) this.$clockTime.textContent = time;
      if (this.$clockDate) this.$clockDate.textContent = date;
    };
    tick();
    setInterval(tick, 1000 * 15);
  }
}

export async function initLauncherShell() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Shell: #app root not found");

  const shell = new LauncherShell(root);
  await shell.init();
  return shell;
}
