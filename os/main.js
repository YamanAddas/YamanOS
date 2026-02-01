import { NATIVE_APPS, EXTERNAL_APPS, WALLPAPERS, defaultDesktopItems, defaultFolders } from "./registry.js";
import { Settings, ensureSeed, getDesktop, putDesktop, getFolders, putFolders, fsList, fsGet, fsPut, fsDelete, uid, nowISO, addRecent, listRecent } from "./storage.js";
import { WindowManager } from "./windowManager.js";

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

export async function loadIcon(el){
  const name = el.dataset.ico;
  if(!name) return;
  try{
    const res = await fetch(`os/ui/icons/${name}.svg`);
    const svg = await res.text();
    el.innerHTML = svg;
  }catch(e){ el.textContent=""; }
}

function setWallpaper(id){
  const w = WALLPAPERS.find(x=>x.id===id) || WALLPAPERS[0];
  $("#wallpaper").style.backgroundImage = `url(${w.url})`;
  Settings.setWallpaper(w.id);
}

function setTheme(theme){
  Settings.setTheme(theme);
  // Simple: adjust accent a bit
  document.documentElement.style.setProperty("--accent", theme==="dark" ? "#3aa8ff" : "#2a7dff");
}

function fmtClock(d){
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}
function fmtDate(d){
  return d.toLocaleDateString([], {weekday:"long", year:"numeric", month:"long", day:"numeric"});
}

function appById(id){
  return [...NATIVE_APPS, ...EXTERNAL_APPS].find(a=>a.id===id);
}

function iconBadge(iconName){
  const el=document.createElement("span");
  el.className="ico";
  el.dataset.ico=iconName || "file";
  loadIcon(el);
  return el;
}

function toast(wm, msg){ wm.toastMsg(msg); }

function buildDesktopIcon(item){
  const btn=document.createElement("button");
  btn.className="icon";
  const img=document.createElement("div"); img.className="iconImg";
  const lbl=document.createElement("div"); lbl.className="iconLbl";

  if(item.type==="app"){
    const app=appById(item.appId);
    img.appendChild(iconBadge(app?.icon||"file"));
    lbl.textContent=app?.name||item.appId;
    btn.addEventListener("click", ()=>openApp(item.appId, app?.name||item.appId));
  }else if(item.type==="folder"){
    img.appendChild(iconBadge("folder"));
    lbl.textContent=item.name||"Folder";
    btn.addEventListener("click", ()=>openFolder(item.folderId, item.name||"Folder"));
  }else if(item.type==="link"){
    img.appendChild(iconBadge("link"));
    lbl.textContent=item.name||"Link";
    btn.addEventListener("click", ()=>openExternal(item.url, item.name||"Link"));
  }

  btn.appendChild(img); btn.appendChild(lbl);
  return btn;
}

let wm;

async function ensureDefaults(){
  await ensureSeed();
  const d=await getDesktop();
  if(!d){
    await putDesktop(defaultDesktopItems());
  }
  const f=await getFolders();
  if(!f){
    await putFolders(defaultFolders());
  }
}

async function renderDesktop(){
  const desk=$("#desktop"); desk.innerHTML="";
  const d=(await getDesktop())?.items || defaultDesktopItems();
  d.forEach(it=>desk.appendChild(buildDesktopIcon(it)));
}

function closePanels(){
  $("#startPanel").classList.add("hidden");
  $("#notifPanel").classList.add("hidden");
  $("#netPanel").classList.add("hidden");
  $("#clockPanel").classList.add("hidden");
}

function togglePanel(id){
  const p=$(id);
  const willShow=p.classList.contains("hidden");
  closePanels();
  if(willShow) p.classList.remove("hidden");
}

async function renderStart(){
  const pinned=$("#pinnedGrid"); pinned.innerHTML="";
  const pinnedApps=["files","notes","browser","paint","games","settings","chatgpt","gemini","claude","deepseek"];
  pinnedApps.map(appById).filter(Boolean).forEach(app=>{
    const card=document.createElement("button");
    card.className="pin";
    const left=iconBadge(app.icon||"file");
    const mid=document.createElement("div");
    mid.innerHTML=`<div class="pinName">${app.name}</div><div class="pinSub">${app.kind==="native"?"Built-in":"Website"}</div>`;
    card.appendChild(left); card.appendChild(mid);
    card.addEventListener("click", ()=>{
      closePanels();
      if(app.kind==="native") openApp(app.id, app.name);
      else openExternal(app.url, app.name);
    });
    pinned.appendChild(card);
  });

  const rec=$("#recentList"); rec.innerHTML="";
  const items=await listRecent(10);
  if(!items.length){
    const it=document.createElement("div");
    it.className="item";
    it.textContent="No recent items yet.";
    rec.appendChild(it);
  }else{
    items.forEach(r=>{
      const it=document.createElement("button");
      it.className="item";
      it.appendChild(iconBadge(r.icon||"file"));
      const t=document.createElement("div");
      t.innerHTML=`<div style="font-weight:650">${r.title||"Item"}</div><div style="font-size:12px;color:var(--muted)">${new Date(r.at).toLocaleString()}</div>`;
      it.appendChild(t);
      it.addEventListener("click", ()=>{
        closePanels();
        if(r.kind==="app") openApp(r.targetId, r.title);
        if(r.kind==="url") openExternal(r.targetId, r.title);
        if(r.kind==="file") openFile(r.targetId);
      });
      rec.appendChild(it);
    });
  }
}

function initTopbar(){
  const themeBtn=$("#themeBtn");
  const updateThemeBtn=()=>{
    const t=Settings.getTheme();
    themeBtn.innerHTML="";
    themeBtn.appendChild(iconBadge(t==="dark"?"moon":"sun"));
  };
  updateThemeBtn();
  themeBtn.addEventListener("click", ()=>{
    const next=Settings.getTheme()==="dark"?"light":"dark";
    setTheme(next);
    updateThemeBtn();
    toast(wm, `Theme: ${next}`);
  });

  $("#startBtn").addEventListener("click", async ()=>{
    togglePanel("#startPanel");
    await renderStart();
    $("#search").value="";
    $("#search").focus();
  });
  $("#notifBtn").addEventListener("click", ()=>togglePanel("#notifPanel"));
  $("#netBtn").addEventListener("click", ()=>togglePanel("#netPanel"));
  $("#clockBtn").addEventListener("click", ()=>togglePanel("#clockPanel"));
  $("#clearNotifs").addEventListener("click", ()=>{ $("#notifList").innerHTML=""; toast(wm,"Cleared"); });
  $("#closeNet").addEventListener("click", closePanels);
  $("#closeClock").addEventListener("click", closePanels);
  $("#settingsBtn").addEventListener("click", ()=>{ closePanels(); openApp("settings","Settings"); });

  document.addEventListener("click",(e)=>{
    if(e.target.closest(".panel")||e.target.closest(".tbBtn")||e.target.closest(".dockBtn")) return;
    closePanels();
  });

  // clock ticker
  const tick=()=>{
    const d=new Date();
    $("#clockBtn").textContent=fmtClock(d);
    $("#clockBody").innerHTML=`<div style="font-size:38px;font-weight:800;letter-spacing:-.02em">${fmtClock(d)}</div>
    <div style="margin-top:8px;color:var(--muted)">${fmtDate(d)}</div>`;
  };
  tick(); setInterval(tick, 1000);
}

function initNetworkPanel(){
  const body=$("#netBody");
  const update=()=>{
    const on = navigator.onLine;
    body.innerHTML = `
      <div class="item">${on?"🟢 Online":"🔴 Offline"} <span style="margin-left:8px;color:var(--muted)">${on?"Network available":"Using cached mode"}</span></div>
      <div style="margin-top:10px;color:var(--muted);font-size:13px">This is a launcher shell. External sites open in a new tab.</div>`;
  };
  update();
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
}

function initNotifications(){
  const list=$("#notifList");
  const push=(title,sub)=>{
    const it=document.createElement("div");
    it.className="item";
    it.appendChild(iconBadge("bell"));
    const t=document.createElement("div");
    t.innerHTML=`<div style="font-weight:650">${title}</div><div style="font-size:12px;color:var(--muted)">${sub||""}</div>`;
    it.appendChild(t);
    list.prepend(it);
  };
  push("Welcome to YamanOS", "Tip: Add to Home Screen for full-screen mode.");
}

function initDock(){
  $$(".dockBtn").forEach(b=>{
    const open=b.dataset.open;
    const act=b.dataset.action;
    if(open){
      b.addEventListener("click", ()=>{
        const app=appById(open);
        if(app?.kind==="native") openApp(open, app.name);
        else openExternal(app?.url||"https://example.com", app?.name||open);
      });
    }
    if(act==="start"){
      b.addEventListener("click", async ()=>{
        togglePanel("#startPanel");
        await renderStart();
      });
    }
    // icons inside dock
    $$(".ico", b).forEach(loadIcon);
  });
}

async function openExternal(url, title){
  window.open(url, "_blank", "noopener,noreferrer");
  await addRecent({kind:"url", targetId:url, title, icon:"globe", at: nowISO()});
  toast(wm, `Opened ${title}`);
}

async function openFolder(folderId, name){
  const folders=(await getFolders()) || defaultFolders();
  const folder=folders[folderId];
  const node=document.createElement("div");
  if(!folder){
    node.innerHTML=`<div class="item">Folder not found.</div>`;
  }else{
    node.innerHTML=`<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
      <div style="font-size:18px;font-weight:800">${folder.name}</div>
      <div style="color:var(--muted);font-size:12px">${folder.items.length} items</div>
    </div>`;
    folder.items.forEach(it=>{
      const b=document.createElement("button"); b.className="item";
      b.appendChild(iconBadge(it.type==="link"?"link":"file"));
      const t=document.createElement("div"); t.innerHTML=`<div style="font-weight:650">${it.name}</div><div style="font-size:12px;color:var(--muted)">${it.type}</div>`;
      b.appendChild(t);
      b.addEventListener("click", ()=>{ if(it.type==="link") openExternal(it.url, it.name); });
      node.appendChild(b);
    });
  }
  wm.createWindow({appId:"folder", title:name, icon:"folder", width:560, height:520, contentNode:node});
  await addRecent({kind:"app", targetId:"folder", title:`Folder: ${name}`, icon:"folder", at: nowISO()});
}

async function openFile(fileId){
  const rec=await fsGet(fileId);
  const node=document.createElement("div");
  if(!rec){ node.innerHTML=`<div class="item">File not found.</div>`; }
  else{
    node.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div>
        <div style="font-weight:800">${rec.name}</div>
        <div style="color:var(--muted);font-size:12px">${rec.type} • updated ${new Date(rec.updatedAt).toLocaleString()}</div>
      </div>
      <button class="pill" id="dlBtn">Download</button>
    </div>
    <div style="margin-top:12px"></div>`;
    const pre=document.createElement("pre");
    pre.style.whiteSpace="pre-wrap";
    pre.style.userSelect="text";
    pre.textContent=rec.content||"";
    node.appendChild(pre);
    node.querySelector("#dlBtn").addEventListener("click", ()=>{
      const blob=new Blob([rec.content||""], {type:"text/plain"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=rec.name||"file.txt"; a.click();
      URL.revokeObjectURL(a.href);
    });
  }
  wm.createWindow({appId:"file", title:rec?.name||"File", icon:"file", width:640, height:520, contentNode:node});
  await addRecent({kind:"file", targetId:fileId, title:rec?.name||"File", icon:"file", at: nowISO()});
}

async function app_files(){
  const node=document.createElement("div");
  const header=document.createElement("div");
  header.style.display="flex";header.style.gap="10px";header.style.alignItems="center";header.style.justifyContent="space-between";
  header.innerHTML=`<div><div style="font-size:18px;font-weight:800">Files</div><div style="color:var(--muted);font-size:12px">Local sandbox (IndexedDB)</div></div>
    <div style="display:flex;gap:8px">
      <button class="pill" id="newFolder"><span class="ico" data-ico="folder"></span> New folder</button>
      <button class="pill" id="newFile"><span class="ico" data-ico="file"></span> New note</button>
    </div>`;
  node.appendChild(header);
  const list=document.createElement("div"); list.style.marginTop="12px";
  node.appendChild(list);

  $$(".ico", header).forEach(loadIcon);

  const {rootId}=await ensureSeed();
  let cwd=rootId;

  async function render(){
    const items=await fsList(cwd);
    list.innerHTML="";
    const row=document.createElement("div");
    row.className="item"; row.style.justifyContent="space-between";
    row.innerHTML=`<div style="font-weight:650">Current: ${cwd}</div><button class="pill" id="upBtn"><span class="ico" data-ico="back"></span> Up</button>`;
    list.appendChild(row); loadIcon($("#upBtn .ico",row));
    $("#upBtn",row).addEventListener("click", async ()=>{
      const cur=await fsGet(cwd);
      if(cur?.parentId){ cwd=cur.parentId; render(); }
    });

    if(!items.length){
      const empty=document.createElement("div"); empty.className="item"; empty.textContent="Empty folder.";
      list.appendChild(empty); return;
    }
    items.sort((a,b)=> (a.type===b.type? a.name.localeCompare(b.name) : (a.type==="folder"?-1:1)));
    for(const it of items){
      const b=document.createElement("button"); b.className="item";
      b.appendChild(iconBadge(it.type==="folder"?"folder":"file"));
      const t=document.createElement("div");
      t.innerHTML=`<div style="font-weight:650">${it.name}</div><div style="font-size:12px;color:var(--muted)">${it.type}</div>`;
      b.appendChild(t);
      const del=document.createElement("button"); del.className="pill"; del.innerHTML=`<span class="ico" data-ico="trash"></span>`;
      loadIcon($(".ico",del));
      del.addEventListener("click", async (e)=>{
        e.stopPropagation();
        if(confirm(`Delete ${it.name}?`)){ await fsDelete(it.id); render(); toast(wm,"Deleted"); }
      });
      b.appendChild(del);
      b.addEventListener("click", async ()=>{
        if(it.type==="folder"){ cwd=it.id; render(); }
        else openFile(it.id);
      });
      list.appendChild(b);
    }
  }

  header.querySelector("#newFolder").addEventListener("click", async ()=>{
    const name=prompt("Folder name:","New Folder");
    if(!name) return;
    const t=nowISO();
    await fsPut({id:uid("folder"), parentId:cwd, type:"folder", name, createdAt:t, updatedAt:t});
    render(); toast(wm,"Folder created");
  });
  header.querySelector("#newFile").addEventListener("click", async ()=>{
    const name=prompt("File name:","note.txt");
    if(!name) return;
    const t=nowISO();
    await fsPut({id:uid("file"), parentId:cwd, type:"file", name, content:"", createdAt:t, updatedAt:t});
    render(); toast(wm,"File created");
  });

  await render();
  return {node, width:720, height:560, noPad:false};
}

async function app_notes(){
  const node=document.createElement("div");
  node.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div><div style="font-size:18px;font-weight:800">Notes</div><div style="color:var(--muted);font-size:12px">Autosaves locally</div></div>
      <button class="pill" id="saveBtn">Save</button>
    </div>
    <div style="margin-top:12px"><textarea id="ta" placeholder="Write here…"></textarea></div>`;
  const ta=$("#ta",node);
  ta.value = localStorage.getItem("yamanos_notes") || "";
  const save=()=>{
    localStorage.setItem("yamanos_notes", ta.value);
    toast(wm,"Saved");
  };
  $("#saveBtn",node).addEventListener("click", save);
  ta.addEventListener("input", ()=>{
    clearTimeout(ta._deb);
    ta._deb=setTimeout(save, 600);
  });
  return {node, width:720, height:560};
}

async function app_browser(){
  const node=document.createElement("div");
  node.innerHTML=`<div style="display:flex;gap:10px;align-items:center">
      <input class="search" id="url" placeholder="Type a URL (https://…)" />
      <button class="pill" id="go">Go</button>
    </div>
    <div style="margin-top:12px;color:var(--muted);font-size:13px">For security and iOS restrictions, websites open in a new tab (no embedded iframes).</div>
    <div style="margin-top:12px" id="quick"></div>`;
  const quick=$("#quick",node);
  EXTERNAL_APPS.forEach(a=>{
    const b=document.createElement("button"); b.className="item";
    b.appendChild(iconBadge(a.icon||"globe"));
    const t=document.createElement("div"); t.innerHTML=`<div style="font-weight:650">${a.name}</div><div style="font-size:12px;color:var(--muted)">${a.url}</div>`;
    b.appendChild(t);
    b.addEventListener("click", ()=>openExternal(a.url, a.name));
    quick.appendChild(b);
  });
  $("#go",node).addEventListener("click", ()=>{
    const u=$("#url",node).value.trim();
    if(!u) return;
    const url = u.startsWith("http") ? u : ("https://" + u);
    openExternal(url, url);
  });
  return {node, width:760, height:560};
}

async function app_settings(){
  const node=document.createElement("div");
  const t=Settings.getTheme();
  const wp=Settings.getWallpaper();
  node.innerHTML=`<div style="font-size:18px;font-weight:800">Settings</div>
  <div style="margin-top:10px" class="item"><div style="flex:1">
    <div style="font-weight:650">Theme</div><div style="font-size:12px;color:var(--muted)">Dark / Light</div>
  </div><button class="pill" id="toggleTheme">Toggle</button></div>
  <div style="margin-top:10px" class="item"><div style="flex:1">
    <div style="font-weight:650">Wallpaper</div><div style="font-size:12px;color:var(--muted)">Choose background</div>
  </div></div>
  <div id="wps" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px"></div>
  <div style="margin-top:12px;color:var(--muted);font-size:12px">YamanOS v0.3.0 • local-only • no trackers.</div>`;
  $("#toggleTheme",node).addEventListener("click", ()=>{
    const next=Settings.getTheme()==="dark"?"light":"dark";
    setTheme(next);
    $("#themeBtn").click(); // update icon via click toggler (safe)
    toast(wm, `Theme: ${next}`);
  });
  const wps=$("#wps",node);
  WALLPAPERS.forEach(wpItem=>{
    const b=document.createElement("button"); b.className="pin";
    b.style.justifyContent="space-between";
    const left=document.createElement("div");
    left.innerHTML=`<div class="pinName">${wpItem.name}</div><div class="pinSub">${wpItem.id===wp?"current":"tap to apply"}</div>`;
    const img=document.createElement("div");
    img.style.width="44px";img.style.height="44px";img.style.borderRadius="14px";
    img.style.backgroundImage=`url(${wpItem.url})`;img.style.backgroundSize="cover";img.style.border="1px solid rgba(255,255,255,.10)";
    b.appendChild(left); b.appendChild(img);
    b.addEventListener("click", ()=>{
      setWallpaper(wpItem.id);
      toast(wm, `Wallpaper: ${wpItem.name}`);
      // rerender labels
      $$(".pinSub", wps).forEach((s,i)=>{ s.textContent = (WALLPAPERS[i].id===wpItem.id) ? "current" : "tap to apply"; });
    });
    wps.appendChild(b);
  });
  return {node, width:720, height:560};
}

async function app_paint(){
  const node=document.createElement("div");
  node.style.height="100%";
  node.innerHTML=`<div style="display:flex;gap:10px;align-items:center;padding:10px">
    <button class="pill" id="clear">Clear</button>
    <button class="pill" id="save">Save PNG</button>
    <div style="color:var(--muted);font-size:12px">Finger draw</div>
  </div>
  <canvas id="c" style="width:100%;height:calc(100% - 64px);display:block"></canvas>`;
  const c=$("#c",node);
  const ctx=c.getContext("2d");
  function resize(){
    const rect=c.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    c.width=Math.floor(rect.width*dpr);
    c.height=Math.floor(rect.height*dpr);
    ctx.scale(dpr,dpr);
    ctx.lineWidth=3;
    ctx.lineCap="round";
    ctx.strokeStyle="white";
  }
  setTimeout(resize, 0);
  let drawing=false,px=0,py=0;
  const pos=(e)=>{const r=c.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  c.addEventListener("pointerdown",(e)=>{drawing=true;const p=pos(e);px=p.x;py=p.y;});
  c.addEventListener("pointermove",(e)=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(p.x,p.y);ctx.stroke();px=p.x;py=p.y;});
  c.addEventListener("pointerup",()=>drawing=false);
  c.addEventListener("pointercancel",()=>drawing=false);
  $("#clear",node).addEventListener("click",()=>{ctx.clearRect(0,0,c.width,c.height);});
  $("#save",node).addEventListener("click",()=>{
    const a=document.createElement("a");
    a.download="drawing.png";
    a.href=c.toDataURL("image/png");
    a.click();
  });
  return {node, width:820, height:560, noPad:true};
}

async function app_games(){
  const node=document.createElement("div");
  node.innerHTML=`<div style="font-size:18px;font-weight:800">Games</div>
  <div style="margin-top:10px;color:var(--muted);font-size:13px">Lightweight offline mini-games.</div>
  <div style="margin-top:12px" id="glist"></div>`;
  const gl=$("#glist",node);
  const mk=(name,desc,fn)=>{
    const b=document.createElement("button"); b.className="item";
    b.appendChild(iconBadge("gamepad"));
    const t=document.createElement("div"); t.innerHTML=`<div style="font-weight:650">${name}</div><div style="font-size:12px;color:var(--muted)">${desc}</div>`;
    b.appendChild(t); b.addEventListener("click", fn); gl.appendChild(b);
  };
  mk("Guess the Number","Classic 1–100, 7 tries.", ()=>openGuessGame());
  mk("Reflex Tap","Tap as fast as possible for 5 seconds.", ()=>openReflexGame());
  return {node, width:640, height:520};
}

function openGuessGame(){
  let target=Math.floor(Math.random()*100)+1, tries=7;
  const node=document.createElement("div");
  node.innerHTML=`<div style="font-size:18px;font-weight:800">Guess the Number</div>
  <div style="margin-top:8px;color:var(--muted);font-size:13px">I picked 1–100. You have <b id="tries">${tries}</b> tries.</div>
  <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
    <input class="search" id="inp" placeholder="Enter a number" />
    <button class="pill" id="go">Guess</button>
    <button class="pill" id="reset">Reset</button>
  </div>
  <div id="out" style="margin-top:12px"></div>`;
  const out=$("#out",node);
  const upd=()=>$("#tries",node).textContent=String(tries);
  const guess=()=>{
    const v=parseInt($("#inp",node).value,10);
    if(!Number.isFinite(v)){ out.textContent="Enter a valid number."; return; }
    tries--; upd();
    if(v===target){ out.textContent=`✅ Correct. The number was ${target}.`; }
    else if(tries<=0){ out.textContent=`❌ Out of tries. It was ${target}.`; }
    else out.textContent = v<target ? "Too low." : "Too high.";
  };
  $("#go",node).addEventListener("click",guess);
  $("#reset",node).addEventListener("click",()=>{
    target=Math.floor(Math.random()*100)+1;tries=7;upd();out.textContent="Reset.";
  });
  wm.createWindow({appId:"guess", title:"Guess", icon:"gamepad", width:560, height:420, contentNode:node});
}

function openReflexGame(){
  const node=document.createElement("div");
  node.innerHTML=`<div style="font-size:18px;font-weight:800">Reflex Tap</div>
  <div style="margin-top:8px;color:var(--muted);font-size:13px">Tap the button as many times as possible in 5 seconds.</div>
  <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
    <button class="pill" id="start">Start</button>
    <div>Score: <b id="score">0</b></div>
    <div>Time: <b id="time">0.0</b>s</div>
  </div>
  <div style="margin-top:12px">
    <button id="tap" class="pin" style="width:100%;height:120px;font-size:20px;font-weight:800">Tap</button>
  </div>`;
  let running=false,score=0,deadline=0,timer=null;
  const tap=$("#tap",node);
  tap.addEventListener("click",()=>{
    if(!running) return;
    score++; $("#score",node).textContent=String(score);
  });
  $("#start",node).addEventListener("click",()=>{
    running=true;score=0;$("#score",node).textContent="0";
    const start=performance.now(); deadline=start+5000;
    clearInterval(timer);
    timer=setInterval(()=>{
      const now=performance.now();
      const left=Math.max(0,(deadline-now)/1000);
      $("#time",node).textContent=left.toFixed(1);
      if(left<=0){ running=false; clearInterval(timer); $("#time",node).textContent="0.0"; }
    },50);
  });
  wm.createWindow({appId:"reflex", title:"Reflex", icon:"gamepad", width:560, height:420, contentNode:node});
}

async function openApp(appId, title){
  const app=appById(appId);
  if(!app) return;
  if(app.kind!=="native") return openExternal(app.url, app.name);

  let built=null;
  if(appId==="files") built=await app_files();
  else if(appId==="notes") built=await app_notes();
  else if(appId==="browser") built=await app_browser();
  else if(appId==="settings") built=await app_settings();
  else if(appId==="paint") built=await app_paint();
  else if(appId==="games") built=await app_games();
  else built={node:document.createElement("div"), width:520,height:420};

  wm.createWindow({appId, title:app.name, icon:app.icon, width:built.width||520, height:built.height||520, contentNode:built.node, noPad:built.noPad||false});
  await addRecent({kind:"app", targetId:appId, title:app.name, icon:app.icon, at: nowISO()});
}

async function boot(){
  await ensureDefaults();
  setTheme(Settings.getTheme());
  setWallpaper(Settings.getWallpaper());

  // icon hydration
  $$(".ico").forEach(loadIcon);

  wm=new WindowManager($("#wmLayer"), $("#dockRun"), $("#toast"));

  initTopbar();
  initDock();
  initNetworkPanel();
  initNotifications();

  await renderDesktop();

  // search in start
  $("#search").addEventListener("input",(e)=>{
    const q=e.target.value.toLowerCase();
    $$(".pin", $("#pinnedGrid")).forEach(card=>{
      const name=$(".pinName",card)?.textContent?.toLowerCase()||"";
      card.style.display = name.includes(q) ? "" : "none";
    });
  });

  // Boot screen
  setTimeout(()=>{
    $("#boot").classList.add("hidden");
    $("#os").classList.remove("hidden");
  }, 650);
}

(async ()=>{try{await boot();}catch(err){console.error(err);
const bootEl=document.getElementById('boot');
if(bootEl){const sub=bootEl.querySelector('.bootSub'); if(sub) sub.textContent='Startup error (see console)';
const hint=bootEl.querySelector('.bootHint'); if(hint) hint.textContent=String(err&&err.message?err.message:err);
}
setTimeout(()=>{const b=document.getElementById('boot'); const o=document.getElementById('os'); if(b) b.classList.add('hidden'); if(o) o.classList.remove('hidden');},800);
}})();
