(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  const store = {
    get(k, fb=null){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
    del(k){ localStorage.removeItem(k); },
  };

  const state = {
    theme: store.get("theme","dark"),
    deferredInstallPrompt: null,
    z: 1,
    windows: new Map(),
    cwd: "root", // folder id
    drag: null
  };

  // ===== Filesystem (virtual) =====
  // Node: {id,type:'folder'|'file', name, parent, kind, content?, updatedAt}
  function fsInitIfNeeded(){
    let fs = store.get("fs");
    if(fs && fs.nodes) return;

    const now = new Date().toISOString();
    const nodes = {
      root: {id:"root", type:"folder", name:"Desktop", parent:null, updatedAt: now},
      f_ai: {id:"f_ai", type:"folder", name:"AI", parent:"root", updatedAt: now},
      f_social: {id:"f_social", type:"folder", name:"Social", parent:"root", updatedAt: now},
      f_games: {id:"f_games", type:"folder", name:"Games", parent:"root", updatedAt: now},
      f_docs: {id:"f_docs", type:"folder", name:"Documents", parent:"root", updatedAt: now},
    };
    store.set("fs", {nodes});
    // default positions
    const pos = {
      root: {
        "f_ai": {x:18,y:20},
        "f_social": {x:130,y:20},
        "f_games": {x:242,y:20},
        "f_docs": {x:354,y:20},
      },
      f_ai: {}, f_social: {}, f_games: {}, f_docs: {}
    };
    store.set("pos", pos);
  }

  function fs(){
    fsInitIfNeeded();
    return store.get("fs");
  }
  function fsSave(fsobj){ store.set("fs", fsobj); }
  function fsChildren(folderId){
    const f = fs();
    return Object.values(f.nodes).filter(n => n.parent === folderId).sort((a,b)=>a.name.localeCompare(b.name));
  }
  function fsGet(id){ return fs().nodes[id]; }
  function fsNewId(prefix){ return prefix + "_" + crypto.randomUUID().slice(0,8); }

  function fsCreateFile(parent, name, kind, content){
    const f = fs();
    const id = fsNewId("file");
    f.nodes[id] = {id, type:"file", name, parent, kind, content: content ?? "", updatedAt: new Date().toISOString()};
    fsSave(f);
    ensurePos(parent, id);
    return id;
  }
  function fsUpdateFile(id, content){
    const f = fs();
    const n = f.nodes[id];
    if(!n || n.type!=="file") return;
    n.content = content;
    n.updatedAt = new Date().toISOString();
    fsSave(f);
  }
  function fsRename(id, newName){
    const f=fs();
    if(!f.nodes[id]) return;
    f.nodes[id].name = newName;
    f.nodes[id].updatedAt = new Date().toISOString();
    fsSave(f);
  }
  function fsMove(id, newParent){
    const f=fs();
    if(!f.nodes[id]) return;
    f.nodes[id].parent = newParent;
    f.nodes[id].updatedAt = new Date().toISOString();
    fsSave(f);
    ensurePos(newParent, id);
  }
  function fsDelete(id){
    const f=fs();
    const n=f.nodes[id];
    if(!n) return;
    if(n.type==="folder"){
      // delete children recursively
      const kids = fsChildren(id);
      for(const k of kids) fsDelete(k.id);
    }
    delete f.nodes[id];
    fsSave(f);
    // remove positions
    const pos = store.get("pos", {});
    for(const [fid, mp] of Object.entries(pos)){ if(mp && mp[id]) delete mp[id]; }
    store.set("pos", pos);
  }

  // ===== Layout positions & dragging =====
  function getPosMap(){
    return store.get("pos", {}); // pos[folderId][nodeOrAppId] = {x,y}
  }
  function setPosMap(pos){ store.set("pos", pos); }
  function ensurePos(folderId, itemId){
    const pos = getPosMap();
    pos[folderId] = pos[folderId] || {};
    if(!pos[folderId][itemId]) {
      // find free-ish spot
      const existing = Object.values(pos[folderId]);
      const x = 18 + (existing.length % 5) * 112;
      const y = 20 + Math.floor(existing.length / 5) * 118;
      pos[folderId][itemId] = {x,y};
      setPosMap(pos);
    }
  }
  function setItemPos(folderId, itemId, x, y){
    const pos = getPosMap();
    pos[folderId] = pos[folderId] || {};
    pos[folderId][itemId] = {x, y};
    setPosMap(pos);
  }

  // ===== Notifications =====
  function notify(title, body){
    const item = { id: crypto.randomUUID(), t:title, b:body, d:new Date().toISOString() };
    const items = store.get("notifs", []);
    items.unshift(item);
    store.set("notifs", items.slice(0,60));
    renderNotifs();
  }
  function renderNotifs(){
    const box = $("#notifBody");
    if(!box) return;
    const items = store.get("notifs", []);
    box.innerHTML = items.length ? "" : `<div class="notif-item"><div class="t">No notifications.</div></div>`;
    for(const n of items){
      const el = document.createElement("div");
      el.className = "notif-item";
      el.innerHTML = `<div class="t">${escapeHtml(n.t)}</div><div class="d">${new Date(n.d).toLocaleString()}</div><div class="b">${escapeHtml(n.b)}</div>`;
      box.appendChild(el);
    }
  }

  // ===== Theme =====
  function setTheme(theme){
    state.theme = theme;
    document.documentElement.dataset.theme = theme==="light" ? "light" : "";
    store.set("theme", theme);
    $("#btnTheme").textContent = theme==="light" ? "☀️" : "🌙";
  }

  // ===== Apps (web opens new tab automatically) =====
  const apps = [
    // native
    {id:"fileExplorer", name:"Files", icon:"📁", type:"native", entry:"apps/native/fileExplorer.js"},
    {id:"browser", name:"Browser", icon:"🌐", type:"native", entry:"apps/native/browser.js"},
    {id:"notes", name:"Notes", icon:"📝", type:"native", entry:"apps/native/notes.js"},
    {id:"calculator", name:"Calculator", icon:"🧮", type:"native", entry:"apps/native/calculator.js"},
    {id:"minesweeper", name:"Minesweeper", icon:"💣", type:"native", entry:"apps/native/minesweeper.js"},
    {id:"solitaire", name:"Solitaire", icon:"🂡", type:"native", entry:"apps/native/solitaire.js"},
    {id:"spider", name:"Spider Solitaire", icon:"🕷️", type:"native", entry:"apps/native/spider.js"},
    {id:"mahjong", name:"Mahjong", icon:"🀄", type:"native", entry:"apps/native/mahjong.js"},

    // web (open new tab)
    {id:"chatgpt", name:"ChatGPT", icon:"🤖", type:"web", url:"https://chatgpt.com/"},
    {id:"gemini", name:"Gemini", icon:"✨", type:"web", url:"https://gemini.google.com/"},
    {id:"claude", name:"Claude", icon:"🧠", type:"web", url:"https://claude.ai/"},
    {id:"deepseek", name:"DeepSeek", icon:"🔎", type:"web", url:"https://chat.deepseek.com/"},
    {id:"youtube", name:"YouTube", icon:"▶️", type:"web", url:"https://m.youtube.com/"},
    {id:"gmail", name:"Gmail", icon:"✉️", type:"web", url:"https://mail.google.com/"},
    {id:"facebook", name:"Facebook", icon:"📘", type:"web", url:"https://m.facebook.com/"},
    {id:"x", name:"X", icon:"𝕏", type:"web", url:"https://x.com/"},
    {id:"instagram", name:"Instagram", icon:"📷", type:"web", url:"https://www.instagram.com/"},
    {id:"reddit", name:"Reddit", icon:"👽", type:"web", url:"https://www.reddit.com/"},
  ];

  const appFolders = {
    f_ai: ["chatgpt","gemini","claude","deepseek"],
    f_social: ["facebook","x","instagram","reddit","gmail","youtube"],
    f_games: ["minesweeper","solitaire","spider","mahjong"],
  };

  function getApp(id){ return apps.find(a=>a.id===id); }

  // ===== Rendering desktop =====
  function escapeHtml(str){
    return (str ?? "").toString()
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function crumbsFor(folderId){
    const f=fs();
    const parts=[];
    let cur = f.nodes[folderId];
    while(cur){
      parts.push(cur.name);
      cur = cur.parent ? f.nodes[cur.parent] : null;
    }
    return parts.reverse();
  }

  function renderDesktop(){
    const desktop = $("#desktop");
    desktop.innerHTML = `<div class="desktop-grid" id="grid"></div>`;
    const grid = $("#grid");

    const folder = fsGet(state.cwd);
    $("#crumbs").textContent = crumbsFor(state.cwd).join("  ›  ");

    // Items: folders/files from FS + (if in special folders, show app shortcuts)
    const nodes = fsChildren(state.cwd);

    // Add app shortcuts inside AI/Social/Games folders
    const appIds = appFolders[state.cwd] || [];
    const shortcuts = appIds.map(id => ({ id, kind:"app" }));

    const items = [
      ...nodes.map(n => ({ id:n.id, kind:n.type })),
      ...shortcuts
    ];

    // ensure positions exist
    for(const it of items){
      ensurePos(state.cwd, it.id);
    }

    const pos = getPosMap()[state.cwd] || {};

    for(const it of items){
      const p = pos[it.id] || {x:18,y:20};
      const el = document.createElement("div");
      el.className = "desktop-item";
      el.style.left = p.x + "px";
      el.style.top = p.y + "px";
      el.dataset.kind = it.kind;
      el.dataset.id = it.id;

      let icon="📄", label="Item";
      if(it.kind==="folder"){
        const n=fsGet(it.id);
        icon="📁"; label=n.name;
      } else if(it.kind==="file"){
        const n=fsGet(it.id);
        icon = n.kind==="note" ? "📝" : "📄";
        label=n.name;
      } else if(it.kind==="app"){
        const a=getApp(it.id);
        icon=a?.icon ?? "⬜";
        label=a?.name ?? it.id;
      }

      el.innerHTML = `
        <button class="desktop-btn" title="${escapeHtml(label)}">${icon}</button>
        <div class="desktop-label">${escapeHtml(label)}</div>
      `;
      grid.appendChild(el);
      wireDesktopItem(el);
    }

    // Desktop background right-click / long-press context
    wireDesktopContext(grid);
  }

  function wireDesktopContext(grid){
    const ctx = $("#ctx");

    const closeCtx = () => ctx.classList.add("hidden");
    document.addEventListener("pointerdown", (e)=>{
      if(!ctx.contains(e.target)) closeCtx();
    }, {capture:true});

    const openCtx = (x,y, items) => {
      ctx.innerHTML = "";
      for(const item of items){
        const row=document.createElement("div");
        row.className="ctx-item";
        row.innerHTML = `<div>${item.label}</div><div class="k">${item.k||""}</div>`;
        row.addEventListener("click", ()=>{ closeCtx(); item.on(); });
        ctx.appendChild(row);
      }
      ctx.style.left = x+"px";
      ctx.style.top = y+"px";
      ctx.classList.remove("hidden");
    };

    // Long-press on empty desktop
    let lp=null;
    grid.addEventListener("pointerdown", (e)=>{
      if(e.target.closest(".desktop-item")) return;
      lp = setTimeout(()=>{
        const x = clamp(e.clientX, 8, window.innerWidth-240);
        const y = clamp(e.clientY, 8, window.innerHeight-260);
        openCtx(x,y,[
          {label:"New note", k:"N", on: ()=> createNoteOnDesktop() },
          {label:"New folder", k:"F", on: ()=> createFolder() },
          {label:"Open Files", k:"", on: ()=> openApp("fileExplorer") },
        ]);
      }, 520);
    });
    grid.addEventListener("pointerup", ()=>{ if(lp) clearTimeout(lp); lp=null; });
    grid.addEventListener("pointercancel", ()=>{ if(lp) clearTimeout(lp); lp=null; });

    grid.addEventListener("contextmenu", (e)=>{
      e.preventDefault();
      if(e.target.closest(".desktop-item")) return;
      const x = clamp(e.clientX, 8, window.innerWidth-240);
      const y = clamp(e.clientY, 8, window.innerHeight-260);
      openCtx(x,y,[
        {label:"New note", k:"", on: ()=> createNoteOnDesktop() },
        {label:"New folder", k:"", on: ()=> createFolder() },
        {label:"Open Files", k:"", on: ()=> openApp("fileExplorer") },
      ]);
    });
  }

  function createFolder(){
    const name = prompt("Folder name?");
    if(!name) return;
    const f=fs();
    const id = fsNewId("folder");
    f.nodes[id] = {id, type:"folder", name, parent: state.cwd, updatedAt:new Date().toISOString()};
    fsSave(f);
    ensurePos(state.cwd, id);
    renderDesktop();
    notify("Folder created", name);
  }

  function createNoteOnDesktop(){
    const name = prompt("Note name?", "New Note.txt");
    if(!name) return;
    const id = fsCreateFile(state.cwd, name, "note", "");
    renderDesktop();
    openFile(id);
  }

  function wireDesktopItem(el){
    const id = el.dataset.id;
    const kind = el.dataset.kind;

    const btn = el.querySelector(".desktop-btn");
    btn.addEventListener("click", () => {
      if(kind==="folder") {
        state.cwd = id;
        renderDesktop();
      } else if(kind==="file") {
        openFile(id);
      } else if(kind==="app") {
        openApp(id);
      }
    });

    // context menu
    el.addEventListener("contextmenu", (e)=>{
      e.preventDefault();
      openItemMenu(e.clientX, e.clientY, kind, id);
    });

    // long press context on iOS
    let lp=null;
    el.addEventListener("pointerdown", (e)=>{
      if(e.pointerType==="mouse" && e.button!==0) return;
      lp = setTimeout(()=> openItemMenu(e.clientX, e.clientY, kind, id), 520);
    });
    el.addEventListener("pointerup", ()=>{ if(lp) clearTimeout(lp); lp=null; });
    el.addEventListener("pointercancel", ()=>{ if(lp) clearTimeout(lp); lp=null; });

    // drag
    makeDraggable(el);
  }

  function openItemMenu(x,y, kind, id){
    const ctx = $("#ctx");
    const closeCtx = () => ctx.classList.add("hidden");
    const openCtx = (items) => {
      ctx.innerHTML="";
      for(const it of items){
        const row=document.createElement("div");
        row.className="ctx-item";
        row.innerHTML = `<div>${it.label}</div><div class="k">${it.k||""}</div>`;
        row.addEventListener("click", ()=>{ closeCtx(); it.on(); });
        ctx.appendChild(row);
      }
      ctx.style.left = clamp(x, 8, window.innerWidth-240)+"px";
      ctx.style.top = clamp(y, 8, window.innerHeight-260)+"px";
      ctx.classList.remove("hidden");
    };

    const items=[];
    if(kind==="file"){
      items.push({label:"Open", on: ()=> openFile(id)});
      items.push({label:"Rename", on: ()=> {
        const n=fsGet(id); const nn=prompt("Rename to:", n.name);
        if(nn){ fsRename(id, nn); renderDesktop(); }
      }});
      items.push({label:"Delete", on: ()=> {
        if(confirm("Delete file?")){ fsDelete(id); renderDesktop(); }
      }});
    } else if(kind==="folder"){
      items.push({label:"Open", on: ()=> { state.cwd=id; renderDesktop(); } });
      items.push({label:"Rename", on: ()=> {
        const n=fsGet(id); const nn=prompt("Rename to:", n.name);
        if(nn){ fsRename(id, nn); renderDesktop(); }
      }});
      items.push({label:"Delete", on: ()=> {
        if(confirm("Delete folder and its contents?")){ fsDelete(id); renderDesktop(); }
      }});
    } else if(kind==="app"){
      const a=getApp(id);
      items.push({label:"Open", on: ()=> openApp(id)});
      if(a?.type==="web") items.push({label:"Open in new tab", on: ()=> openWeb(a) });
    }
    openCtx(items);
  }

  function makeDraggable(el){
    let dragging=false, sx=0, sy=0, ox=0, oy=0;
    el.addEventListener("pointerdown", (e)=>{
      if(e.target.closest(".desktop-btn")===null) return;
      // start drag after small hold for touch
      const start = () => {
        dragging=true;
        el.setPointerCapture(e.pointerId);
        sx=e.clientX; sy=e.clientY;
        ox=parseFloat(el.style.left)||0;
        oy=parseFloat(el.style.top)||0;
        el.style.opacity="0.92";
      };
      if(e.pointerType==="touch") {
        state.drag = {timer: setTimeout(start, 170), started:false};
      } else {
        start();
      }
    });

    el.addEventListener("pointermove", (e)=>{
      if(state.drag?.timer && !dragging && e.pointerType==="touch") {
        const dx=Math.abs(e.clientX-sx), dy=Math.abs(e.clientY-sy);
      }
      if(!dragging) {
        // if touch move quickly, cancel drag
        if(state.drag?.timer) {
          // if moved more than 6px, cancel
          // (we can't rely on sx/sy; use current el position)
        }
        return;
      }
      const grid = $("#grid").getBoundingClientRect();
      const nx = clamp(ox + (e.clientX - sx), 0, grid.width-92);
      const ny = clamp(oy + (e.clientY - sy), 0, grid.height-110);
      el.style.left = nx+"px";
      el.style.top = ny+"px";
      e.preventDefault();
    });

    el.addEventListener("pointerup", (e)=>{
      if(state.drag?.timer) { clearTimeout(state.drag.timer); state.drag=null; }
      if(!dragging) return;
      dragging=false;
      el.style.opacity="1";
      // snap
      const nx = Math.round((parseFloat(el.style.left)||0)/8)*8;
      const ny = Math.round((parseFloat(el.style.top)||0)/8)*8;
      el.style.left = nx+"px";
      el.style.top = ny+"px";
      setItemPos(state.cwd, el.dataset.id, nx, ny);

      // drop into folder if overlapping a folder icon
      const dropTarget = findFolderUnderPointer(e.clientX, e.clientY, el.dataset.id);
      if(dropTarget) {
        const movingId = el.dataset.id;
        const movingKind = el.dataset.kind;
        if(movingKind === "file" || movingKind === "folder") {
          fsMove(movingId, dropTarget);
          state.cwd = state.cwd; // keep
          renderDesktop();
          notify("Moved", "Item moved into folder.");
        }
      }
    });

    el.addEventListener("pointercancel", ()=>{
      if(state.drag?.timer) { clearTimeout(state.drag.timer); state.drag=null; }
      dragging=false;
      el.style.opacity="1";
    });
  }

  function findFolderUnderPointer(x,y, ignoreId){
    const els = $$(".desktop-item");
    for(const el of els){
      if(el.dataset.id===ignoreId) continue;
      if(el.dataset.kind!=="folder") continue;
      const r = el.getBoundingClientRect();
      if(x>=r.left && x<=r.right && y>=r.top && y<=r.bottom) return el.dataset.id;
    }
    return null;
  }

  // ===== Start Menu =====
  function renderStart(filter=""){
    const grid = $("#startGrid");
    grid.innerHTML="";
    const q = filter.trim().toLowerCase();
    const results = [];

    // apps
    for(const a of apps){
      if(q && !a.name.toLowerCase().includes(q)) continue;
      results.push({kind:"app", id:a.id, name:a.name, sub:a.type==="web" ? "Web (opens new tab)" : "Built-in", icon:a.icon});
    }
    // files in Documents
    const docKids = fsChildren("f_docs").filter(n=>n.type==="file");
    for(const n of docKids){
      if(q && !n.name.toLowerCase().includes(q)) continue;
      results.push({kind:"file", id:n.id, name:n.name, sub:"Document", icon:"📝"});
    }

    for(const r of results.slice(0,60)){
      const tile = document.createElement("div");
      tile.className="tile";
      tile.dataset.kind=r.kind;
      tile.dataset.id=r.id;
      tile.innerHTML = `<div class="tile-ico">${r.icon}</div><div><div class="tile-name">${escapeHtml(r.name)}</div><div class="tile-sub">${escapeHtml(r.sub)}</div></div>`;
      grid.appendChild(tile);
    }
  }

  // ===== Windows + Native apps =====
  function bringToFront(win){ win.style.zIndex = (++state.z).toString(); }
  function clampToLayer(win){
    const layer = $("#windowLayer");
    const rect = layer.getBoundingClientRect();
    const w = win.getBoundingClientRect();
    let left = parseFloat(win.style.left)||20;
    let top = parseFloat(win.style.top)||20;
    left = clamp(left, 8, rect.width - w.width - 8);
    top = clamp(top, 8, rect.height - w.height - 8);
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }
  function closeWindow(key){ const win=state.windows.get(key); if(win){ win.remove(); state.windows.delete(key); } }

  function createWindow(title, icon, key){
    const layer=$("#windowLayer");
    const win=document.createElement("div");
    win.className="window";
    win.style.left = `${Math.round(18 + Math.random()*120)}px`;
    win.style.top = `${Math.round(18 + Math.random()*80)}px`;
    win.style.zIndex = (++state.z).toString();

    win.innerHTML = `
      <div class="win-top">
        <div class="win-title"><div class="win-ico">${icon}</div><div class="win-name">${escapeHtml(title)}</div></div>
        <div class="win-actions">
          <button class="iconbtn" data-act="min" title="Minimize">—</button>
          <button class="iconbtn" data-act="max" title="Maximize">▢</button>
          <button class="iconbtn" data-act="close" title="Close">✕</button>
        </div>
      </div>
      <div class="win-body"><div class="appwrap" data-host="1"></div></div>
    `;
    layer.appendChild(win);
    clampToLayer(win);
    bringToFront(win);

    // drag
    let dragging=false, sx=0, sy=0, sl=0, st=0;
    const bar = $(".win-top", win);
    bar.addEventListener("pointerdown", (e)=>{
      if(e.target.closest(".win-actions")) return;
      dragging=true;
      bar.setPointerCapture(e.pointerId);
      sx=e.clientX; sy=e.clientY;
      sl=parseFloat(win.style.left)||0; st=parseFloat(win.style.top)||0;
      bar.style.cursor="grabbing";
      bringToFront(win);
      e.preventDefault();
    });
    bar.addEventListener("pointermove", (e)=>{
      if(!dragging) return;
      win.style.left = (sl + (e.clientX-sx))+"px";
      win.style.top = (st + (e.clientY-sy))+"px";
      clampToLayer(win);
      e.preventDefault();
    });
    bar.addEventListener("pointerup", ()=>{ dragging=false; bar.style.cursor="grab"; });

    win.addEventListener("pointerdown", ()=> bringToFront(win));
    $$(".iconbtn", $(".win-actions", win)).forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        const act = e.currentTarget.dataset.act;
        if(act==="close") closeWindow(key);
        if(act==="min") win.classList.add("hidden");
        if(act==="max") {
          const max = win.dataset.max==="1";
          if(!max) {
            win.dataset.prev = JSON.stringify({l:win.style.left,t:win.style.top,w:win.style.width,h:win.style.height});
            win.style.left="10px"; win.style.top="10px";
            win.style.width="calc(100% - 20px)"; win.style.height="calc(100% - 20px)";
            win.dataset.max="1";
          } else {
            try{ const p=JSON.parse(win.dataset.prev||"{}");
              if(p.l) win.style.left=p.l; if(p.t) win.style.top=p.t;
              if(p.w) win.style.width=p.w; if(p.h) win.style.height=p.h;
            }catch{}
            win.dataset.max="0";
            clampToLayer(win);
          }
        }
      });
    });
    state.windows.set(key, win);
    return win;
  }

  async function loadScript(src){
    return new Promise((res, rej)=>{
      const s=document.createElement("script");
      s.src = src + "?v=20260201113923";
      s.onload = ()=>res();
      s.onerror = ()=>rej(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }

  async function mountNative(app, win, extra){
    const host = $('[data-host="1"]', win);
    host.innerHTML="Loading…";
    window.YamanOSApps = window.YamanOSApps || {};
    if(!window.YamanOSApps[app.id]) await loadScript(app.entry);
    const factory = window.YamanOSApps[app.id];
    if(!factory) {
      host.innerHTML = `<div class="notif-item"><div class="t">Module missing</div><div class="b">${escapeHtml(app.entry)}</div></div>`;
      return;
    }
    const api = {
      app,
      notify,
      theme: ()=>state.theme,
      fs: {
        get: fsGet,
        children: fsChildren,
        createFile: fsCreateFile,
        updateFile: fsUpdateFile,
        rename: fsRename,
        move: fsMove,
        del: fsDelete,
        cwd: ()=>state.cwd,
        setCwd: (id)=>{ state.cwd=id; renderDesktop(); },
      },
      openFile,
      openApp,
      extra: extra||{},
    };
    host.innerHTML="";
    factory(host, api);
  }

  async function openApp(appId){
    const app = getApp(appId);
    if(!app) return;
    if(app.type==="web") return openWeb(app);

    const key = "app:"+app.id;
    let win = state.windows.get(key);
    if(!win) {
      win = createWindow(app.name, app.icon, key);
      await mountNative(app, win, {});
      notify("Opened", app.name);
    } else {
      win.classList.remove("hidden");
      bringToFront(win);
    }
  }

  function openWeb(app){
    // auto-open in new tab (your requirement)
    window.open(app.url, "_blank", "noopener,noreferrer");
    notify("Opened in browser", app.name);
  }

  function openFile(fileId){
    const n = fsGet(fileId);
    if(!n || n.type!=="file") return;
    if(n.kind==="note") {
      // open Notes app with this file
      const app = getApp("notes");
      const key = "file:"+fileId;
      let win = state.windows.get(key);
      if(!win) {
        win = createWindow(n.name, "📝", key);
        mountNative(app, win, {fileId});
      } else {
        win.classList.remove("hidden");
        bringToFront(win);
      }
    } else {
      notify("Open", "Unsupported file type.");
    }
  }

  // ===== Install / export / import / reset =====
  function setupInstall(){
    window.addEventListener("beforeinstallprompt", (e)=>{
      e.preventDefault();
      state.deferredInstallPrompt = e;
      $("#btnInstall").disabled = false;
    });
    $("#btnInstall").addEventListener("click", async ()=>{
      if(!state.deferredInstallPrompt){
        notify("Install on iPad", "Safari → Share → Add to Home Screen.");
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
      theme: store.get("theme","dark"),
      notifs: store.get("notifs", []),
      fs: store.get("fs"),
      pos: store.get("pos"),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yamanos-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Export", "Backup saved.");
  }

  async function importData(file){
    const txt = await file.text();
    const payload = JSON.parse(txt);
    if(payload.theme) store.set("theme", payload.theme);
    if(payload.notifs) store.set("notifs", payload.notifs);
    if(payload.fs) store.set("fs", payload.fs);
    if(payload.pos) store.set("pos", payload.pos);
    setTheme(store.get("theme","dark"));
    renderNotifs();
    renderDesktop();
    notify("Import", "Data imported.");
  }

  function resetData(){
    store.del("theme");
    store.del("notifs");
    store.del("fs");
    store.del("pos");
    setTheme("dark");
    store.set("notifs", []);
    fsInitIfNeeded();
    renderNotifs();
    state.cwd="root";
    renderDesktop();
    notify("Reset", "YamanOS data cleared.");
  }

  // ===== UI wiring =====
  function togglePanel(panelEl){
    const panels = [$("#startMenu"), $("#notifPanel")];
    for(const p of panels) if(p!==panelEl) p.classList.add("hidden");
    panelEl.classList.toggle("hidden");
  }

  function tickClock(){
    const d=new Date();
    const h=String(d.getHours()).padStart(2,"0");
    const m=String(d.getMinutes()).padStart(2,"0");
    $("#clock").textContent = `${h}:${m}`;
  }

  function wireUI(){
    $("#btnTheme").addEventListener("click", ()=> setTheme(state.theme==="light" ? "dark" : "light"));
    $("#btnStart").addEventListener("click", ()=> togglePanel($("#startMenu")));
    $("#taskStart").addEventListener("click", ()=> togglePanel($("#startMenu")));
    $("#taskNotif").addEventListener("click", ()=> togglePanel($("#notifPanel")));

    $("#startSearch").addEventListener("input", (e)=> renderStart(e.target.value));
    $("#startGrid").addEventListener("click", (e)=>{
      const tile = e.target.closest(".tile");
      if(!tile) return;
      const kind = tile.dataset.kind;
      const id = tile.dataset.id;
      $("#startMenu").classList.add("hidden");
      if(kind==="app") openApp(id);
      if(kind==="file") openFile(id);
    });

    $("#btnExport").addEventListener("click", exportData);
    $("#btnImport").addEventListener("change", (e)=>{
      const f=e.target.files && e.target.files[0];
      if(f) importData(f);
      e.target.value="";
    });
    $("#btnReset").addEventListener("click", ()=>{
      if(confirm("Reset YamanOS (files, layout, settings)?")) resetData();
    });
    $("#btnClearNotif").addEventListener("click", ()=>{
      store.set("notifs", []);
      renderNotifs();
      notify("Notifications","Cleared.");
    });

    // Dock app buttons
    $$(".dockbtn[data-app]").forEach(btn=>{
      btn.addEventListener("click", ()=> openApp(btn.dataset.app));
    });

    // Network indicator
    function wifi(){
      const online = navigator.onLine;
      $("#taskWifi").textContent = online ? "📶" : "📴";
      $("#taskWifi").title = online ? "Online" : "Offline";
    }
    window.addEventListener("online", ()=>{ wifi(); notify("Network","Back online."); });
    window.addEventListener("offline", ()=>{ wifi(); notify("Network","Offline. Built-in apps still work."); });
    $("#taskWifi").addEventListener("click", wifi);
    wifi();

    // Tap background closes panels
    $("#desktop").addEventListener("pointerdown", (e)=>{
      const start=$("#startMenu"), notif=$("#notifPanel");
      if(!start.classList.contains("hidden") && !start.contains(e.target) && !e.target.closest("#btnStart") && !e.target.closest("#taskStart")) start.classList.add("hidden");
      if(!notif.classList.contains("hidden") && !notif.contains(e.target) && !e.target.closest("#taskNotif")) notif.classList.add("hidden");
      $("#ctx").classList.add("hidden");
    });
  }

  // ===== Boot =====
  function boot(){
    fsInitIfNeeded();
    setTheme(state.theme);
    store.set("notifs", store.get("notifs", []));
    renderNotifs();
    renderStart();
    state.cwd = "root";
    renderDesktop();
    setupInstall();
    wireUI();
    tickClock();
    setInterval(tickClock, 1000);

    setTimeout(()=>{
      $("#boot").classList.add("hidden");
      $("#os").classList.remove("hidden");
      notify("Welcome", "YamanOS is running.");
    }, 650);
  }

  window.addEventListener("load", boot);
})();
