const DB_NAME="yamanos_v0_3";
const DB_VER=1;
const STORES={fs:"fs",desktop:"desktop",folders:"folders",recent:"recent"};
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VER);req.onupgradeneeded=()=>{const db=req.result;Object.values(STORES).forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:"id"});});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function tx(store,mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode);const s=t.objectStore(store);const out=fn(s);t.oncomplete=()=>resolve(out);t.onerror=()=>reject(t.error);});}
export function nowISO(){return new Date().toISOString();}
export function uid(prefix="id"){return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;}
export const Settings={getTheme(){return localStorage.getItem("yamanos_theme")||"dark";},setTheme(v){localStorage.setItem("yamanos_theme",v);},getWallpaper(){return localStorage.getItem("yamanos_wallpaper")||"abstract";},setWallpaper(id){localStorage.setItem("yamanos_wallpaper",id);}};
export async function getDesktop(){const req=await tx(STORES.desktop,"readonly",s=>s.get("desktop"));return new Promise(res=>{req.onsuccess=()=>res(req.result||null);req.onerror=()=>res(null);});}
export async function putDesktop(items){return tx(STORES.desktop,"readwrite",s=>s.put({id:"desktop",items}));}
export async function getFolders(){const req=await tx(STORES.folders,"readonly",s=>s.get("folders"));return new Promise(res=>{req.onsuccess=()=>res(req.result?.data||null);req.onerror=()=>res(null);});}
export async function putFolders(data){return tx(STORES.folders,"readwrite",s=>s.put({id:"folders",data}));}
export async function fsList(parentId){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(STORES.fs,"readonly");const s=t.objectStore(STORES.fs);const items=[];const c=s.openCursor();c.onsuccess=()=>{const cur=c.result;if(!cur)return resolve(items.filter(x=>x.parentId===parentId));items.push(cur.value);cur.continue();};c.onerror=()=>reject(c.error);});}
export async function fsGet(id){const req=await tx(STORES.fs,"readonly",s=>s.get(id));return new Promise(res=>{req.onsuccess=()=>res(req.result||null);req.onerror=()=>res(null);});}
export async function fsPut(rec){return tx(STORES.fs,"readwrite",s=>s.put(rec));}
export async function fsDelete(id){return tx(STORES.fs,"readwrite",s=>s.delete(id));}
export async function ensureSeed(){const rootId="root",desktopId="desktopFolder",notesId="notesFolder",drawingsId="drawingsFolder";const rootRec=await fsGet(rootId);if(!rootRec){const t=nowISO();await fsPut({id:rootId,parentId:null,type:"folder",name:"Root",createdAt:t,updatedAt:t});await fsPut({id:desktopId,parentId:rootId,type:"folder",name:"Desktop",createdAt:t,updatedAt:t});await fsPut({id:notesId,parentId:rootId,type:"folder",name:"Notes",createdAt:t,updatedAt:t});await fsPut({id:drawingsId,parentId:rootId,type:"folder",name:"Drawings",createdAt:t,updatedAt:t});}return {rootId,desktopId,notesId,drawingsId};}
export async function addRecent(entry){const id=uid("recent");return tx(STORES.recent,"readwrite",s=>s.put({id,...entry}));}
export async function listRecent(limit=12){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(STORES.recent,"readonly");const s=t.objectStore(STORES.recent);const items=[];const c=s.openCursor();c.onsuccess=()=>{const cur=c.result;if(!cur){items.sort((a,b)=>(b.at||"").localeCompare(a.at||""));return resolve(items.slice(0,limit));}items.push(cur.value);cur.continue();};c.onerror=()=>reject(c.error);});}
