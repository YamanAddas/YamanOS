/* TabletOS - GitHub Pages ready PWA
   Cache: tabletos-20260201111047

   Reality check:
   - Many major sites (ChatGPT, YouTube, Instagram) block iframe embedding.
   - We try to embed in a modal overlay; if blocked, show a fallback with "Open" button.
*/
(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const state = {
    apps: [],
    windows: new Map(),
    z: 1,
    theme: 'dark',
    deferredInstallPrompt: null,
    notifs: []
  };

  const store = {
    get(k, fallback=null){
      try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
    del(k){ localStorage.removeItem(k); },
  };

  function nowClock(){
    const d = new Date();
    const h = d.getHours().toString().padStart(2,'0');
    const m = d.getMinutes().toString().padStart(2,'0');
    return `${h}:${m}`;
  }

  function escapeHtml(str){
    return (str ?? "").toString()
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function notify(title, body){
    const item = { id: crypto.randomUUID(), t: title, b: body, d: new Date().toISOString() };
    const items = store.get('notifs', []);
    items.unshift(item);
    store.set('notifs', items.slice(0, 60));
    renderNotifs();
  }

  function renderNotifs(){
    const box = $("#notifBody");
    if(!box) return;
    const items = store.get('notifs', []);
    box.innerHTML = items.length ? "" : `<div class="card">No notifications.</div>`;
    for(const n of items){
      const el = document.createElement('div');
      el.className = 'notif-item';
      el.innerHTML = `
        <div class="t">${escapeHtml(n.t)}</div>
        <div class="d">${new Date(n.d).toLocaleString()}</div>
        <div class="b">${escapeHtml(n.b)}</div>
      `;
      box.appendChild(el);
    }
  }

  function setTheme(theme){
    state.theme = theme;
    document.documentElement.dataset.theme = (theme === 'light') ? 'light' : '';
    store.set('theme', theme);
    $("#btnTheme").textContent = theme === 'light' ? '☀️' : '🌙';
  }

  // ===== Apps registry =====
  const APP = (id, name, icon, type, payload) => ({ id, name, icon, type, ...payload });

  function loadApps(){
    state.apps = [
      // Web wrappers
      APP('chatgpt', 'ChatGPT', '🤖', 'web', { url: 'https://chatgpt.com/' }),
      APP('youtube', 'YouTube', '▶️', 'web', { url: 'https://m.youtube.com/' }),
      APP('gmail', 'Gmail', '✉️', 'web', { url: 'https://mail.google.com/' }),
      APP('x', 'X', '𝕏', 'web', { url: 'https://x.com/' }),
      APP('instagram', 'Instagram', '📷', 'web', { url: 'https://www.instagram.com/' }),
      APP('reddit', 'Reddit', '👽', 'web', { url: 'https://www.reddit.com/' }),

      // Native utilities
      APP('notes', 'Notes', '📝', 'native', { entry: 'apps/native/notes.js' }),
      APP('calculator', 'Calculator', '🧮', 'native', { entry: 'apps/native/calculator.js' }),

      // Native games
      APP('minesweeper', 'Minesweeper', '💣', 'native', { entry: 'apps/native/minesweeper.js' }),
      APP('solitaire', 'Solitaire', '🂡', 'native', { entry: 'apps/native/solitaire.js' }),
      APP('spider', 'Spider Solitaire', '🕷️', 'native', { entry: 'apps/native/spider.js' }),
      APP('mahjong', 'Mahjong', '🀄', 'native', { entry: 'apps/native/mahjong.js' }),
    ];
  }

  // ===== Desktop + Start =====
  function renderDesktop(){
    const desktop = $("#desktop");
    desktop.innerHTML = "";
    for(const app of state.apps){
      const wrap = document.createElement('div');
      wrap.className = 'icon';
      wrap.innerHTML = `
        <button class="icon-btn" data-app="${app.id}" title="${escapeHtml(app.name)}">${app.icon}</button>
        <div class="icon-label">${escapeHtml(app.name)}</div>
      `;
      desktop.appendChild(wrap);
    }
  }

  function renderStart(filter=""){
    const grid = $("#startGrid");
    grid.innerHTML = "";
    const q = filter.trim().toLowerCase();
    const apps = q ? state.apps.filter(a => a.name.toLowerCase().includes(q)) : state.apps;
    for(const app of apps){
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.app = app.id;
      tile.innerHTML = `
        <div class="tile-ico">${app.icon}</div>
        <div>
          <div class="tile-name">${escapeHtml(app.name)}</div>
          <div class="tile-sub">${app.type === 'web' ? 'Web app' : 'Built-in app'}</div>
        </div>
      `;
      grid.appendChild(tile);
    }
  }

  function togglePanel(panelEl){
    const panels = [$("#startMenu"), $("#notifPanel")];
    for(const p of panels) if(p !== panelEl) p.classList.add('hidden');
    panelEl.classList.toggle('hidden');
  }

  // ===== Taskbar pinned =====
  function taskbarButton(app){
    const btn = document.createElement('button');
    btn.className = 'taskbtn small';
    btn.dataset.app = app.id;
    btn.textContent = `${app.icon} ${app.name}`;
    btn.addEventListener('click', () => openApp(app.id));
    return btn;
  }

  function renderTaskbarPinned(){
    const bar = $("#taskbarApps");
    bar.innerHTML = "";
    const pinnedDefault = ['chatgpt','youtube','notes','minesweeper'];
    const pinned = store.get('pinned', pinnedDefault);
    const dedup = Array.from(new Set(pinned)).filter(id => state.apps.some(a => a.id===id));
    store.set('pinned', dedup);
    for(const id of dedup){
      const app = state.apps.find(a => a.id===id);
      if(app) bar.appendChild(taskbarButton(app));
    }
  }

  // ===== Web overlay =====
  function openWebOverlay(app){
    $("#overlayTitle").textContent = app.name;
    $("#overlayNote").textContent = `Opening ${app.url}...`;
    const body = $("#overlayBody");
    body.innerHTML = "";

    const iframe = document.createElement('iframe');
    iframe.src = app.url;
    iframe.loading = "eager";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    body.appendChild(iframe);

    $("#overlay").classList.remove('hidden');
    $("#overlayBottom").classList.add('hidden');

    // If embedding is blocked, we usually can't access contentWindow due to cross-origin.
    // So we use a pragmatic timer approach:
    const timeoutMs = 1500;
    const t = setTimeout(() => {
      // If site blocks framing, many browsers will show a blank/blocked frame.
      // We can't reliably detect it across browsers, so we provide a fallback anyway.
      showOverlayFallback(app);
    }, timeoutMs);

    iframe.addEventListener('load', () => {
      // Some sites will load fine; keep it. But still allow user to pop out.
      clearTimeout(t);
      $("#overlayNote").textContent = `If this stays blank, the site is blocking embed. Use ↗ to open.`;
      $("#overlayBottom").classList.remove('hidden');
    });

    $("#overlayPop").onclick = () => window.open(app.url, "_blank", "noopener,noreferrer");
    $("#overlayOpen").onclick = () => window.open(app.url, "_blank", "noopener,noreferrer");
    $("#overlayBack").onclick = closeOverlay;
    $("#overlayClose").onclick = closeOverlay;
    $("#overlayBackdrop").onclick = closeOverlay;
  }

  function showOverlayFallback(app){
    const body = $("#overlayBody");
    // If iframe exists, keep it (sometimes it loads late). But overlay a message.
    const fb = document.createElement('div');
    fb.className = 'overlay-fallback';
    fb.innerHTML = `
      <h3>Web embed may be blocked</h3>
      <p>
        Many big sites refuse to run inside an in-app frame (security policy).
        Tap <b>Open</b> or ↗ to launch in Safari, then return here.
      </p>
      <div style="height:14px"></div>
      <div class="card" style="max-width:720px">
        <div style="font-weight:900; margin-bottom:6px">${escapeHtml(app.name)}</div>
        <div style="color:var(--muted); font-size:13px">${escapeHtml(app.url)}</div>
      </div>
    `;
    body.appendChild(fb);
    $("#overlayNote").textContent = `Fallback ready.`;
    $("#overlayBottom").classList.remove('hidden');
  }

  function closeOverlay(){
    $("#overlay").classList.add('hidden');
    $("#overlayBody").innerHTML = "";
    $("#overlayBottom").classList.remove('hidden');
  }

  // ===== Windows for native apps =====
  function bringToFront(win){ win.style.zIndex = (++state.z).toString(); }

  function clampToLayer(win){
    const layer = $("#windowLayer");
    const rect = layer.getBoundingClientRect();
    const w = win.getBoundingClientRect();
    let left = parseFloat(win.style.left);
    let top = parseFloat(win.style.top);

    const minLeft = 6;
    const minTop = 6;
    const maxLeft = rect.width - w.width - 6;
    const maxTop = rect.height - w.height - 6;

    if(!Number.isFinite(left)) left = 20;
    if(!Number.isFinite(top)) top = 20;
    left = Math.max(minLeft, Math.min(maxLeft, left));
    top = Math.max(minTop, Math.min(maxTop, top));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  function toggleMaximize(win){
    const max = win.dataset.max === "1";
    if(!max){
      win.dataset.prev = JSON.stringify({ left: win.style.left, top: win.style.top, w: win.style.width, h: win.style.height });
      win.style.left = "10px";
      win.style.top = "10px";
      win.style.width = "calc(100% - 20px)";
      win.style.height = "calc(100% - 20px)";
      win.dataset.max = "1";
    } else {
      try{
        const prev = JSON.parse(win.dataset.prev || "{}");
        if(prev.left) win.style.left = prev.left;
        if(prev.top) win.style.top = prev.top;
        if(prev.w) win.style.width = prev.w;
        if(prev.h) win.style.height = prev.h;
      }catch{}
      win.dataset.max = "0";
      clampToLayer(win);
    }
  }

  function closeWindow(appId){
    const win = state.windows.get(appId);
    if(win){ win.remove(); state.windows.delete(appId); updateTaskView(); }
  }

  function updateTaskView(){
    $$("#taskbarApps .taskbtn").forEach(btn => btn.classList.remove('active'));
    for(const [id] of state.windows){
      const btn = $(`#taskbarApps .taskbtn[data-app="${id}"]`);
      if(btn) btn.classList.add('active');
    }
  }

  function createWindow(app){
    const layer = $("#windowLayer");
    const win = document.createElement('div');
    win.className = 'window';
    win.style.left = `${Math.round(18 + Math.random()*110)}px`;
    win.style.top = `${Math.round(18 + Math.random()*80)}px`;
    win.style.zIndex = (++state.z).toString();

    win.innerHTML = `
      <div class="win-top" data-drag="1">
        <div class="win-title">
          <div class="win-ico">${app.icon}</div>
          <div class="win-name">${escapeHtml(app.name)}</div>
        </div>
        <div class="win-actions">
          <button class="iconbtn" data-act="min" title="Minimize">—</button>
          <button class="iconbtn" data-act="max" title="Maximize">▢</button>
          <button class="iconbtn" data-act="close" title="Close">✕</button>
        </div>
      </div>
      <div class="win-body"><div class="appwrap" data-apphost="1">Loading...</div></div>
    `;

    layer.appendChild(win);
    clampToLayer(win);
    bringToFront(win);

    // Touch-first drag using Pointer Events
    let dragging = false, sx=0, sy=0, sl=0, st=0;
    const bar = $(".win-top", win);

    bar.addEventListener('pointerdown', (e) => {
      if(e.target && e.target.dataset && e.target.dataset.act) return;
      dragging = true;
      bar.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      sl = parseFloat(win.style.left) || 0;
      st = parseFloat(win.style.top) || 0;
      bar.style.cursor = 'grabbing';
      bringToFront(win);
      e.preventDefault();
    });

    bar.addEventListener('pointermove', (e) => {
      if(!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      win.style.left = `${sl + dx}px`;
      win.style.top = `${st + dy}px`;
      clampToLayer(win);
      e.preventDefault();
    });

    bar.addEventListener('pointerup', (e) => {
      dragging = false;
      bar.style.cursor = 'grab';
    });

    // Actions
    win.addEventListener('pointerdown', () => bringToFront(win));
    $$(".iconbtn", $(".win-actions", win)).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const act = e.currentTarget.dataset.act;
        if(act === 'close') closeWindow(app.id);
        if(act === 'min') win.classList.add('hidden');
        if(act === 'max') toggleMaximize(win);
        updateTaskView();
      });
    });

    state.windows.set(app.id, win);
    updateTaskView();
    return win;
  }

  async function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src + "?v=20260201111047";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("script load failed: " + src));
      document.head.appendChild(s);
    });
  }

  async function mountNativeApp(app, win){
    const host = $('[data-apphost="1"]', win);
    host.innerHTML = "";
    window.TabletOSApps = window.TabletOSApps || {};
    if(!window.TabletOSApps[app.id]) await loadScript(app.entry);
    const factory = window.TabletOSApps[app.id];
    if(!factory){
      host.innerHTML = `<div class="card">Failed to load app module: ${escapeHtml(app.entry)}</div>`;
      return;
    }
    const api = {
      app,
      notify,
      storage: {
        get: (k, fb=null) => store.get(`app:${app.id}:${k}`, fb),
        set: (k, v) => store.set(`app:${app.id}:${k}`, v),
        del: (k) => store.del(`app:${app.id}:${k}`)
      },
      theme: () => state.theme
    };
    factory(host, api);
  }

  async function openApp(appId){
    const app = state.apps.find(a => a.id === appId);
    if(!app) return;
    $("#breadcrumbs").textContent = app.name;

    if(app.type === 'web'){
      openWebOverlay(app);
      notify("Launched web app", app.name);
      return;
    }

    let win = state.windows.get(app.id);
    if(!win){
      win = createWindow(app);
      await mountNativeApp(app, win);
      notify("Launched app", app.name);
    } else {
      win.classList.remove('hidden');
      bringToFront(win);
    }
  }

  function setupInstall(){
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      $("#btnInstall").disabled = false;
    });
    $("#btnInstall").addEventListener('click', async () => {
      if(!state.deferredInstallPrompt){
        notify("Install on iOS", "Safari → Share → Add to Home Screen.");
        return;
      }
      state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      notify("Install", `Result: ${choice.outcome}`);
      state.deferredInstallPrompt = null;
    });
  }

  function exportData(){
    const payload = {
      theme: store.get('theme','dark'),
      pinned: store.get('pinned', []),
      notifs: store.get('notifs', []),
      localStorage: {}
    };
    for(let i=0;i<localStorage.length;i++) {
      const k = localStorage.key(i);
      if(k && (k.startsWith('app:') || ['theme','pinned','notifs'].includes(k))) {
        payload.localStorage[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabletos-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Export", "Backup saved.");
  }

  async function importData(file){
    const txt = await file.text();
    const payload = JSON.parse(txt);
    if(payload.localStorage){
      for(const [k,v] of Object.entries(payload.localStorage)) localStorage.setItem(k, v);
    }
    setTheme(store.get('theme','dark'));
    renderTaskbarPinned();
    renderNotifs();
    notify("Import", "Data imported.");
  }

  function resetData(){
    const keys = [];
    for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    for(const k of keys){
      if(k && (k.startsWith('app:') || ['theme','pinned','notifs'].includes(k))) localStorage.removeItem(k);
    }
    setTheme('dark');
    store.set('pinned', ['chatgpt','youtube','notes','minesweeper']);
    store.set('notifs', []);
    renderTaskbarPinned();
    renderNotifs();
    notify("Reset", "TabletOS data cleared.");
  }

  function wireUI(){
    $("#desktop").addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-btn');
      if(!btn) return;
      openApp(btn.dataset.app);
    });

    $("#btnStart").addEventListener('click', () => togglePanel($("#startMenu")));
    $("#taskStart").addEventListener('click', () => togglePanel($("#startMenu")));
    $("#taskNotif").addEventListener('click', () => togglePanel($("#notifPanel")));

    $("#startSearch").addEventListener('input', (e) => renderStart(e.target.value));
    $("#startGrid").addEventListener('click', (e) => {
      const tile = e.target.closest('.tile');
      if(!tile) return;
      openApp(tile.dataset.app);
      $("#startMenu").classList.add('hidden');
    });

    $("#btnTheme").addEventListener('click', () => setTheme(state.theme === 'light' ? 'dark' : 'light'));

    $("#taskTaskView").addEventListener('click', () => {
      const openIds = Array.from(state.windows.keys());
      notify("Task View", openIds.length ? `Open: ${openIds.join(', ')}` : "No windows open.");
    });

    function wifi(){
      const online = navigator.onLine;
      $("#taskWifi").textContent = online ? "📶" : "📴";
      $("#taskWifi").title = online ? "Online" : "Offline";
    }
    window.addEventListener('online', () => { wifi(); notify("Network", "Back online."); });
    window.addEventListener('offline', () => { wifi(); notify("Network", "Offline. Built-in apps still work."); });
    $("#taskWifi").addEventListener('click', wifi);
    wifi();

    $("#btnExport").addEventListener('click', exportData);
    $("#btnImport").addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if(f) importData(f);
      e.target.value = "";
    });
    $("#btnReset").addEventListener('click', () => {
      if(confirm("Reset TabletOS data (notes, saves, settings)?")) resetData();
    });
    $("#btnClearNotif").addEventListener('click', () => {
      store.set('notifs', []);
      renderNotifs();
      notify("Notifications", "Cleared.");
    });

    // Close panels when tapping desktop area
    $("#desktop").addEventListener('pointerdown', (e) => {
      const start = $("#startMenu");
      const notif = $("#notifPanel");
      if(!start.classList.contains('hidden') && !start.contains(e.target) && e.target.id!=="taskStart" && e.target.id!=="btnStart") start.classList.add('hidden');
      if(!notif.classList.contains('hidden') && !notif.contains(e.target) && e.target.id!=="taskNotif") notif.classList.add('hidden');
    });
  }

  function tick(){ $("#clock").textContent = nowClock(); }

  function boot(){
    loadApps();
    setTheme(store.get('theme','dark'));
    store.set('pinned', store.get('pinned', ['chatgpt','youtube','notes','minesweeper']));
    store.set('notifs', store.get('notifs', []));
    renderDesktop();
    renderStart();
    renderTaskbarPinned();
    renderNotifs();
    setupInstall();
    wireUI();
    tick();
    setInterval(tick, 1000);

    setTimeout(() => {
      $("#boot").classList.add('hidden');
      $("#os").classList.remove('hidden');
      notify("Welcome", "TabletOS is running.");
    }, 750);
  }

  window.addEventListener('load', boot);
})();
