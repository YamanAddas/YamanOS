import { loadIcon } from "./main.js";
let z=50, winCount=0;
export class WindowManager{
  constructor(layer,dockRun,toast){this.layer=layer;this.dockRun=dockRun;this.toast=toast;this.windows=new Map();}
  toastMsg(msg){if(!this.toast)return;this.toast.textContent=msg;this.toast.classList.add("show");clearTimeout(this._t);this._t=setTimeout(()=>this.toast.classList.remove("show"),1800);}
  createWindow({appId,title,icon,width=520,height=520,x=20,y=80,contentNode,noPad=false}){
    const id=`win_${appId}_${Date.now()}_${(++winCount)}`;
    const w=document.createElement("div");w.className="window";w.dataset.winId=id;w.style.zIndex=String(++z);
    const vw=window.innerWidth,vh=window.innerHeight,off=(this.windows.size%6)*14;
    w.style.left=Math.min(vw-30,x+off)+"px";w.style.top=Math.min(vh-120,y+off)+"px";
    w.style.width=Math.min(width,vw-22)+"px";w.style.height=Math.min(height,vh-170)+"px";
    const bar=document.createElement("div");bar.className="winBar";
    const titleEl=document.createElement("div");titleEl.className="winTitle";
    const ico=document.createElement("span");ico.className="ico";ico.dataset.ico=icon||"file";
    const txt=document.createElement("div");txt.textContent=title;
    titleEl.appendChild(ico);titleEl.appendChild(txt);
    const btns=document.createElement("div");btns.className="winBtns";
    const mk=(label,tt,fn)=>{const b=document.createElement("button");b.className="winBtn";b.title=tt;b.textContent=label;b.addEventListener("click",(e)=>{e.stopPropagation();fn();});return b;};
    const body=document.createElement("div");body.className="winBody";if(noPad)body.classList.add("nopad");body.appendChild(contentNode);
    const state={id,appId,el:w,body,minimized:false,maximized:false,restore:null,title,icon};
    btns.appendChild(mk("—","Minimize",()=>this.minimize(id)));
    btns.appendChild(mk("▢","Maximize",()=>this.toggleMax(id)));
    btns.appendChild(mk("✕","Close",()=>this.close(id)));
    bar.appendChild(titleEl);bar.appendChild(btns);
    w.appendChild(bar);w.appendChild(body);
    w.addEventListener("pointerdown",()=>{w.style.zIndex=String(++z);});
    this.makeDraggable(w,bar);
    this.layer.appendChild(w);
    loadIcon(ico);
    this.windows.set(id,state);
    this.addChip(state);
    return {id,el:w,body};
  }
  addChip(state){
    const chip=document.createElement("button");
    chip.className="runChip";chip.dataset.winId=state.id;
    chip.innerHTML=`<span class="runDot"></span><span>${state.title}</span>`;
    chip.addEventListener("click",()=>{const st=this.windows.get(state.id);if(!st)return; if(st.minimized)this.restore(state.id); else this.focus(state.id);});
    this.dockRun.appendChild(chip);
  }
  focus(id){const st=this.windows.get(id);if(!st)return;st.el.style.display="";st.minimized=false;st.el.style.zIndex=String(++z);}
  close(id){const st=this.windows.get(id);if(!st)return;st.el.remove();[...this.dockRun.querySelectorAll(".runChip")].forEach(c=>{if(c.dataset.winId===id)c.remove();});this.windows.delete(id);}
  minimize(id){const st=this.windows.get(id);if(!st)return;st.el.style.display="none";st.minimized=true;this.toastMsg(`${st.title} minimized`);}
  restore(id){const st=this.windows.get(id);if(!st)return;st.el.style.display="";st.minimized=false;st.el.style.zIndex=String(++z);}
  toggleMax(id){
    const st=this.windows.get(id);if(!st)return;const w=st.el;
    if(!st.maximized){
      st.restore={left:w.style.left,top:w.style.top,width:w.style.width,height:w.style.height};
      w.style.left="10px";
      w.style.top="calc(var(--safeTop) + var(--topbarH) + 10px)";
      w.style.width="calc(100vw - 20px)";
      w.style.height="calc(100vh - var(--safeTop) - var(--taskbarH) - var(--topbarH) - 30px)";
      st.maximized=true;
    }else{
      const r=st.restore;if(r){w.style.left=r.left;w.style.top=r.top;w.style.width=r.width;w.style.height=r.height;}
      st.maximized=false;
    }
    w.style.zIndex=String(++z);
  }
  makeDraggable(winEl,handleEl){
    let dragging=false,sx=0,sy=0,ox=0,oy=0;
    const down=(e)=>{if(e.target.closest(".winBtns"))return;dragging=true;winEl.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;ox=parseFloat(winEl.style.left||"0");oy=parseFloat(winEl.style.top||"0");winEl.style.zIndex=String(++z);};
    const move=(e)=>{if(!dragging)return;const dx=e.clientX-sx,dy=e.clientY-sy;const vw=window.innerWidth,vh=window.innerHeight;
      let nx=Math.max(6,Math.min(ox+dx,vw-80));let ny=Math.max(6,Math.min(oy+dy,vh-90));
      winEl.style.left=nx+"px";winEl.style.top=ny+"px";};
    const up=()=>{dragging=false;};
    handleEl.addEventListener("pointerdown",down);
    handleEl.addEventListener("pointermove",move);
    handleEl.addEventListener("pointerup",up);
    handleEl.addEventListener("pointercancel",up);
  }
}
