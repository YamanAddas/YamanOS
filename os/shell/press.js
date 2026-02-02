// Touch-first: single tap opens. Long-press opens context.
export function attachPressHandlers(node, {onTap, onLongPress, delay=550}){
  let timer=null;
  let start=null;
  let moved=false;

  const clear=()=>{ if(timer){ clearTimeout(timer); timer=null; } };

  node.addEventListener('pointerdown', (e)=>{
    if(e.button!==0 && e.pointerType==='mouse') return; // only primary
    moved=false;
    start={x:e.clientX,y:e.clientY};
    clear();
    timer=setTimeout(()=>{
      timer=null;
      onLongPress?.(e);
    }, delay);
  });

  node.addEventListener('pointermove', (e)=>{
    if(!start) return;
    const dx=Math.abs(e.clientX-start.x), dy=Math.abs(e.clientY-start.y);
    if(dx>10 || dy>10){
      moved=true;
      clear();
    }
  });

  node.addEventListener('pointerup', (e)=>{
    const wasLong = timer===null; // if long press fired, timer cleared by itself
    clear();
    if(!wasLong && !moved){
      onTap?.(e);
    }
    start=null;
  });

  node.addEventListener('pointercancel', ()=>{ clear(); start=null; });
}
