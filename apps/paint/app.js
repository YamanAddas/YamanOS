import { el } from '../../os/utils/dom.js';
import { toast } from '../../os/shell/toast.js';

export async function mount(root){
  root.innerHTML='';
  const wrap = el('div',{class:'canvas-wrap'});

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 520;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.borderRadius = '16px';
  canvas.style.border = '1px solid rgba(255,255,255,0.14)';
  canvas.style.background = 'rgba(255,255,255,0.06)';

  const ctx = canvas.getContext('2d');
  ctx.lineCap='round';
  ctx.lineJoin='round';

  let color='#ffffff';
  let size=6;
  let drawing=false;
  let last=null;

  const toolbar = el('div',{class:'canvas-toolbar'});
  const colors = ['#ffffff','#4c8bff','#3cffc4','#ffd36a','#ff6a88','#111111'];
  const swatches = colors.map(c=>{
    const s = el('button',{class:'swatch', title:c});
    s.style.background = c;
    s.addEventListener('click', ()=>{ color=c; updateSel(); });
    return s;
  });
  const sizeInput = document.createElement('input');
  sizeInput.type='range';
  sizeInput.min='1';
  sizeInput.max='30';
  sizeInput.value=String(size);
  sizeInput.className='slider';
  sizeInput.addEventListener('input', ()=>{ size=Number(sizeInput.value); });

  const clearBtn = el('button',{class:'btn danger', text:'Clear'});
  clearBtn.addEventListener('click', ()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    toast('Paint', 'Canvas cleared.');
  });

  toolbar.append(...swatches, sizeInput, clearBtn);
  wrap.append(toolbar, canvas);
  root.append(el('div',{class:'row'},[
    el('div',{class:'l'},[
      el('div',{class:'a', text:'Paint'}),
      el('div',{class:'b', text:'Simple offline canvas.'})
    ])
  ]), wrap);

  function updateSel(){
    for(const s of swatches){
      s.classList.toggle('sel', s.style.background===color);
    }
  }
  updateSel();

  function pos(e){
    const r=canvas.getBoundingClientRect();
    const x=(e.clientX - r.left) * (canvas.width / r.width);
    const y=(e.clientY - r.top) * (canvas.height / r.height);
    return {x,y};
  }

  canvas.addEventListener('pointerdown',(e)=>{
    drawing=true;
    last=pos(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',(e)=>{
    if(!drawing) return;
    const p=pos(e);
    ctx.strokeStyle=color;
    ctx.lineWidth=size;
    ctx.beginPath();
    ctx.moveTo(last.x,last.y);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
    last=p;
  });
  canvas.addEventListener('pointerup',()=>{ drawing=false; last=null; });
  canvas.addEventListener('pointercancel',()=>{ drawing=false; last=null; });
}
