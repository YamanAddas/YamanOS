import { el, clamp } from '../utils/dom.js';

let ctx=null;
let onHide=null;

export function mountContextMenu(root){
  ctx = el('div', { class:'ctx', id:'ctx' });
  root.append(ctx);

  document.addEventListener('pointerdown', (e)=>{
    if(!ctx || ctx.style.display==='none') return;
    if(ctx.contains(e.target)) return;
    hide();
  }, {capture:true});
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, true);
}

export function show(x,y, items=[]){
  if(!ctx) return;
  ctx.innerHTML='';
  for(const it of items){
    const row = el('div', { class:'ctx-item', role:'button' }, [
      el('div', { text: it.label }),
      el('div', { class:'hint', text: it.hint || '' }),
    ]);
    row.addEventListener('click', ()=>{ hide(); it.on?.(); });
    ctx.append(row);
  }
  ctx.style.display='block';
  const rect = ctx.getBoundingClientRect();
  const vx = clamp(x, 12, window.innerWidth - rect.width - 12);
  const vy = clamp(y, 12, window.innerHeight - rect.height - 12);
  ctx.style.left = vx + 'px';
  ctx.style.top = vy + 'px';
}

export function hide(){
  if(!ctx) return;
  ctx.style.display='none';
  ctx.innerHTML='';
  onHide?.();
}

export function setOnHide(fn){ onHide = fn; }
