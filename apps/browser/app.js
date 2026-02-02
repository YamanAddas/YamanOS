// apps/browser/app.js
// YamanOS v0.4 — Browser (Offline-first shell, iframe-based renderer)
//
// IMPORTANT REALITY:
// Many modern sites (Google, Bing, DuckDuckGo, etc.) block embedding via
// X-Frame-Options and/or Content-Security-Policy (frame-ancestors).
// We MUST respect that: show a clean "Protected Site" UI + Open External.
// We do not bypass headers. No hacks.

import { upsertNode, getCamera } from "../../os/core/state.js";

const NAV_EVENT = "yamanos:browser:navigate";
const HOME = "about:newtab";

// Sites that are known to block iframe embedding.
// (We intentionally include Bing/DDG now because your console confirms they block.)
const KNOWN_BLOCKED_HOSTS = new Set([
  // Google ecosystem
  "google.com", "www.google.com",
  "accounts.google.com",
  "mail.google.com",
  "drive.google.com",
  "docs.google.com",

  // Search engines that block framing
  "bing.com", "www.bing.com",
  "duckduckgo.com", "www.duckduckgo.com",
  "html.duckduckgo.com",

  // Common social / dev platforms that block framing
  "github.com", "www.github.com",
  "facebook.com", "www.facebook.com",
  "instagram.com", "www.instagram.com",
  "twitter.com", "www.twitter.com",
  "x.com", "www.x.com",
  "linkedin.com", "www.linkedin.com",
  "reddit.com", "www.reddit.com",
]);

// Speed Dial — choose sites that *tend* to embed cleanly.
// (Anything blocked will still show the Protected UI with Open External.)
const SPEED_DIAL = [
  { name: "New Tab", url: "about:newtab", icon: "✦" },
  { name: "Wikipedia (Mobile)", url: "https://en.m.wikipedia.org/", icon: "W" },
  { name: "YouTube (Embed)", url: "https://www.youtube.com/embed/jfKfPfyJRdk", icon: "▶", note: "Embed player" },
  { name: "Google", url: "https://www.google.com/", icon: "G", note: "Protected" },
  { name: "Bing", url: "https://www.bing.com/", icon: "B", note: "Protected" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com/", icon: "D", note: "Protected" },
];

const BOOKMARKS = [
  { name: "New Tab", url: "about:newtab", icon: "✦" },
  { name: "Wiki", url: "https://en.m.wikipedia.org/", icon: "W" },
  { name: "LoFi", url: "https://www.youtube.com/embed/jfKfPfyJRdk", icon: "♫" },
  { name: "Google", url: "https://www.google.com/", icon: "G" },
  { name: "Bing", url: "https://www.bing.com/", icon: "B" },
  { name: "DDG", url: "https://duckduckgo.com/", icon: "D" },
];

export function mount(container) {
  container.innerHTML = `
    <div class="ybrowser">
      <div class="ybrowser-toolbar">
        <div class="nav-controls">
          <button class="ybtn" data-act="back" title="Back">←</button>
          <button class="ybtn" data-act="forward" title="Forward">→</button>
          <button class="ybtn" data-act="reload" title="Reload">⟳</button>
          <button class="ybtn" data-act="home" title="Home">⌂</button>
        </div>

        <form class="yaddr-form" autocomplete="off">
          <input class="yaddr" type="text" spellcheck="false" inputmode="url"
                 placeholder="Search or type URL…" />
        </form>

        <div class="nav-controls">
          <button class="ybtn" data-act="pin" title="Pin to Canvas">📌</button>
          <button class="ybtn ybtn-quiet" data-act="openExternal" title="Open External">↗</button>
        </div>
      </div>

      <div class="bookmarks-bar" data-role="bookmarks"></div>

      <div class="ytabs">
        <div class="ytabs-list" data-role="tabs"></div>
        <button class="ybtn" data-act="addTab" title="New Tab">＋</button>
      </div>

      <div class="ybrowser-viewport" data-guard="false" data-ntp="false" data-loading="false">
        <iframe class="yframe"
          referrerpolicy="no-referrer"
          allowfullscreen
          sandbox="
            allow-forms
            allow-modals
            allow-pointer-lock
            allow-popups
            allow-presentation
            allow-scripts
            allow-top-navigation-by-user-activation
          "></iframe>

        <!-- Native New Tab Page -->
        <div class="ntp-container">
          <div class="ntp-card">
            <div class="ntp-title"><span class="dot"></span> Speed Dial</div>
            <div class="ntp-grid" data-role="ntpGrid"></div>
          </div>
        </div>

        <!-- Protected Site Guard -->
        <div class="yguard">
          <div class="yguard-card">
            <div class="yguard-top">
              <div class="yguard-badge">🛡️</div>
              <div>
                <p class="yguard-title">Protected Site</p>
              </div>
            </div>
            <div class="yguard-sub">
              This website blocks iframe embedding (X-Frame-Options / CSP frame-ancestors).
              You can open it in a new tab.
            </div>
            <div class="yguard-url" data-role="guardUrl"></div>
            <div class="yguard-actions">
              <button class="ybtn ybtn-primary" data-act="guardOpenExternal">Open Externally</button>
              <button class="ybtn" data-act="goNewTab">Back to Start</button>
              <button class="ybtn" data-act="copyUrl">Copy Link</button>
              <button class="ybtn" data-act="markProtected" title="Add this host to Protected list (session)">Mark Protected</button>
            </div>
          </div>
        </div>

        <!-- Loading veil -->
        <div class="yloading">
          <div class="yloading-card">
            <div class="spinner"></div>
            <div class="yloading-text">Loading…</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const $viewport = container.querySelector(".ybrowser-viewport");
  const $frame = container.querySelector(".yframe");
  const $guardUrl = container.querySelector('[data-role="guardUrl"]');
  const $addr = container.querySelector(".yaddr");
  const $tabsList = container.querySelector('[data-role="tabs"]');
  const $bookmarks = container.querySelector('[data-role="bookmarks"]');
  const $ntpGrid = container.querySelector('[data-role="ntpGrid"]');

  const tabs = [];
  let activeTabId = null;

  let loadTimer = null;
  let lastNavToken = 0;

  let lastRealUrl = "";
  const sessionBlockedHosts = new Set();

  function mkId(prefix = "tab") {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
  }

  function activeUrl() {
    const t = getActiveTab();
    return t ? (t.history[t.idx] || "") : "";
  }

  function canBack() {
    const t = getActiveTab();
    return !!t && t.idx > 0;
  }

  function canForward() {
    const t = getActiveTab();
    return !!t && t.idx < t.history.length - 1;
  }

  function updateNavButtons() {
    const backBtn = container.querySelector('[data-act="back"]');
    const fwdBtn = container.querySelector('[data-act="forward"]');
    backBtn.disabled = !canBack();
    fwdBtn.disabled = !canForward();
  }

  function safeTitle(url) {
    if (url === "about:newtab") return "New Tab";
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "tab";
    }
  }

  function normalizeInputToUrl(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";

    if (s.toLowerCase() === "newtab" || s.toLowerCase() === "about:newtab") return "about:newtab";
    if (/^https?:\/\//i.test(s)) return s;

    const hasSpace = /\s/.test(s);
    const looksLikeDomain = /\.[a-z]{2,}([/:?#]|$)/i.test(s);

    if (!hasSpace && looksLikeDomain) return `https://${s}`;

    // Search fallback (may become Protected; that's OK—Open External works)
    return `https://www.bing.com/search?q=${encodeURIComponent(s)}`;
  }

  function getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function isBlockedHost(host) {
    if (!host) return false;

    const allBlocked = new Set([...KNOWN_BLOCKED_HOSTS, ...sessionBlockedHosts]);
    for (const b of allBlocked) {
      if (host === b) return true;
      if (host.endsWith("." + b)) return true;
    }
    return false;
  }

  function clearLoadTimer() {
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
  }

  function setGuard(on, url = "") {
    $viewport.setAttribute("data-guard", on ? "true" : "false");
    if (on) {
      $guardUrl.textContent = url;
      // Remove iframe content to avoid gray/refused boxes behind the guard.
      $frame.src = "about:blank";
    }
  }

  function setNTP(on) {
    $viewport.setAttribute("data-ntp", on ? "true" : "false");
    if (on) {
      setGuard(false, "");
      clearLoadTimer();
      $frame.src = "about:blank";
    }
  }

  function setLoading(on) {
    $viewport.setAttribute("data-loading", on ? "true" : "false");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function transformUrl(inputUrl) {
    if (inputUrl === "about:newtab") {
      return { kind: "native", url: "about:newtab", displayUrl: "about:newtab" };
    }

    try {
      const u = new URL(inputUrl);
      const host = u.hostname.toLowerCase();
      const path = u.pathname;

      // YouTube watch -> embed
      if ((host === "youtube.com" || host === "www.youtube.com") && path === "/watch") {
        const v = u.searchParams.get("v");
        if (v) {
          const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
          return { kind: "iframe", url: embedUrl, displayUrl: inputUrl };
        }
      }

      // youtu.be -> embed
      if (host === "youtu.be") {
        const v = path.slice(1);
        if (v) {
          const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
          return { kind: "iframe", url: embedUrl, displayUrl: inputUrl };
        }
      }

      // Vimeo
      if (host === "vimeo.com") {
        const id = path.slice(1);
        if (id && /^\d+$/.test(id)) {
          const embedUrl = `https://player.vimeo.com/video/${id}`;
          return { kind: "iframe", url: embedUrl, displayUrl: inputUrl };
        }
      }

      // Wikipedia: enforce mobile
      if (host.endsWith("wikipedia.org") && !host.includes(".m.wikipedia.org")) {
        const parts = host.split(".");
        if (parts.length >= 2) {
          const lang = parts[0];
          const mobileHost = `${lang}.m.wikipedia.org`;
          const rewritten = inputUrl.replace(host, mobileHost);
          return { kind: "iframe", url: rewritten, displayUrl: rewritten };
        }
      }

      // Protected list enforcement (after transforms)
      const finalHost = getHost(inputUrl);
      if (isBlockedHost(finalHost)) {
        return { kind: "guard", url: "about:blank", displayUrl: inputUrl, reason: "protected" };
      }

      return { kind: "iframe", url: inputUrl, displayUrl: inputUrl };

    } catch {
      const fixed = normalizeInputToUrl(inputUrl);
      if (!fixed) return { kind: "native", url: "about:newtab", displayUrl: "about:newtab" };
      return transformUrl(fixed);
    }
  }

  function renderBookmarks() {
    $bookmarks.innerHTML = "";
    for (const b of BOOKMARKS) {
      const el = document.createElement("div");
      el.className = "bookmark-item";
      el.title = b.url;
      el.innerHTML = `
        <div class="bookmark-ico">${escapeHtml(b.icon || "★")}</div>
        <div class="bookmark-text">${escapeHtml(b.name)}</div>
      `;
      el.addEventListener("click", () => navigate(b.url, { push: true }));
      $bookmarks.appendChild(el);
    }
  }

  function renderNewTabPage() {
    $ntpGrid.innerHTML = "";
    for (const item of SPEED_DIAL) {
      const el = document.createElement("div");
      el.className = "ntp-tile";
      el.title = item.url;
      el.innerHTML = `
        <div class="ntp-ico">${escapeHtml(item.icon || "✦")}</div>
        <div class="ntp-text">
          <div class="ntp-name">${escapeHtml(item.name)}</div>
          <div class="ntp-url">${escapeHtml(item.note || item.url)}</div>
        </div>
      `;
      el.addEventListener("click", () => navigate(item.url, { push: true }));
      $ntpGrid.appendChild(el);
    }
  }

  function renderTabs() {
    $tabsList.innerHTML = "";
    for (const t of tabs) {
      const el = document.createElement("div");
      el.className = "ytab";
      el.setAttribute("data-tab-id", t.id);
      el.setAttribute("data-active", t.id === activeTabId ? "true" : "false");
      el.innerHTML = `
        <div class="ytab-title">${escapeHtml(t.title)}</div>
        <div class="ytab-x" data-act="closeTab" title="Close">×</div>
      `;
      el.addEventListener("click", (e) => {
        const close = e.target.closest('[data-act="closeTab"]');
        if (close) {
          e.stopPropagation();
          closeTab(t.id);
          return;
        }
        switchTab(t.id);
      });
      $tabsList.appendChild(el);
    }
  }

  function createTab(url = HOME) {
    const id = mkId();
    const tab = { id, title: safeTitle(url), history: [url], idx: 0 };
    tabs.push(tab);
    return tab;
  }

  function pushUrlToActive(url) {
    const t = getActiveTab();
    if (!t) return;

    if (t.idx < t.history.length - 1) t.history.splice(t.idx + 1);
    t.history.push(url);
    t.idx = t.history.length - 1;
    t.title = safeTitle(url);
  }

  function switchTab(id) {
    if (activeTabId === id) return;
    activeTabId = id;
    const url = activeUrl();
    $addr.value = url === "about:newtab" ? "" : url;
    navigate(url, { push: false });
    renderTabs();
    updateNavButtons();
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx < 0) return;

    const wasActive = (activeTabId === id);
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
      const t = createTab(HOME);
      activeTabId = t.id;
    } else if (wasActive) {
      const next = tabs[Math.min(idx, tabs.length - 1)];
      activeTabId = next.id;
    }

    renderTabs();
    switchTab(activeTabId);
  }

  function startBlockHeuristic(displayUrl, token) {
    clearLoadTimer();
    // Heuristic: if nothing meaningful happens quickly, show Protected UI.
    // We cannot reliably detect all XFO/CSP blocks via JS.
    loadTimer = setTimeout(() => {
      if (token !== lastNavToken) return;
      setLoading(false);
      setNTP(false);
      setGuard(true, displayUrl);
    }, 1600);
  }

  function openExternal(url) {
    if (!url || url === "about:newtab") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function navigate(raw, { push = true } = {}) {
    const normalized = normalizeInputToUrl(raw);
    if (!normalized) return;

    if (normalized === "about:newtab") {
      if (push) pushUrlToActive("about:newtab");
      $addr.value = "";
      setLoading(false);
      setGuard(false, "");
      setNTP(true);
      renderNewTabPage();
      renderTabs();
      updateNavButtons();
      return;
    }

    lastRealUrl = normalized;

    const token = ++lastNavToken;
    const t = transformUrl(normalized);

    if (push) pushUrlToActive(normalized);
    renderTabs();
    updateNavButtons();

    // Protected site
    if (t.kind === "guard") {
      setLoading(false);
      setNTP(false);
      setGuard(true, t.displayUrl);
      return;
    }

    // Native
    if (t.kind === "native") {
      setLoading(false);
      setGuard(false, "");
      setNTP(true);
      renderNewTabPage();
      return;
    }

    // Iframe attempt
    setGuard(false, "");
    setNTP(false);
    setLoading(true);

    // Start heuristic fallback
    startBlockHeuristic(t.displayUrl, token);

    // Navigate iframe
    $frame.src = t.url;
    // Set address bar to displayUrl
    $addr.value = t.displayUrl;
  }

  // Iframe load event: when it loads *something*, we stop loading.
  // Note: for blocked sites, this may never fire or may fire too quickly with about:blank;
  // heuristic covers that.
  $frame.addEventListener("load", () => {
    clearLoadTimer();
    setLoading(false);
  });

  // Toolbar actions
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const t = getActiveTab();

    if (act === "back" && t && canBack()) {
      t.idx--;
      navigate(activeUrl(), { push: false });
      renderTabs();
      updateNavButtons();
    }

    if (act === "forward" && t && canForward()) {
      t.idx++;
      navigate(activeUrl(), { push: false });
      renderTabs();
      updateNavButtons();
    }

    if (act === "reload") {
      const url = activeUrl();
      navigate(url, { push: false });
    }

    if (act === "home") {
      navigate("about:newtab", { push: true });
    }

    if (act === "addTab") {
      const nt = createTab(HOME);
      activeTabId = nt.id;
      renderTabs();
      switchTab(activeTabId);
    }

    if (act === "openExternal") {
      openExternal(lastRealUrl);
    }

    if (act === "guardOpenExternal") {
      openExternal(lastRealUrl);
    }

    if (act === "goNewTab") {
      navigate("about:newtab", { push: true });
    }

    if (act === "copyUrl") {
      if (!lastRealUrl) return;
      navigator.clipboard?.writeText(lastRealUrl).catch(() => {});
    }

    if (act === "markProtected") {
      const host = getHost(lastRealUrl);
      if (host) sessionBlockedHosts.add(host);
      setGuard(true, lastRealUrl);
    }

    if (act === "pin") {
      pinToCanvas(lastRealUrl).catch(() => {});
    }
  });

  // Address bar submit
  container.querySelector(".yaddr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    navigate($addr.value, { push: true });
  });

  // OS navigation events (from pinned URL nodes)
  window.addEventListener(NAV_EVENT, (ev) => {
    const url = ev?.detail?.url;
    if (url) navigate(url, { push: true });
  });

  async function pinToCanvas(url) {
    if (!url || url === "about:newtab") return;

    const cam = await getCamera();
    const id = `url:${fnv1a32(url)}`;

    // Place it near camera center
    const x = (cam?.x || 0) + 40;
    const y = (cam?.y || 0) + 40;

    await upsertNode({
      nodeId: id,
      entityType: "url",
      entityId: url,
      x, y,
      scale: 1,
      z: 2,
      flags: {},
      data: { title: safeTitle(url), url },
    });
  }

  // Init
  renderBookmarks();

  // Create first tab and activate
  const t0 = createTab(HOME);
  activeTabId = t0.id;
  renderTabs();
  updateNavButtons();
  navigate("about:newtab", { push: false });
}
