export function el(tag, attrs={}, children=[]){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className=v;
    else if(k==='text') n.textContent=v;
    else if(k==='html') n.innerHTML=v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2), v);
    else if(v!==undefined && v!==null) n.setAttribute(k, v);
  }
  for(const c of (children||[])) n.append(c);
  return n;
}
export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
export function clamp(n, a, b){ return Math.max(a, Math.min(b,n)); }
