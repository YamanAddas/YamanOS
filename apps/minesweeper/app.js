import { el } from '../../os/utils/dom.js';
import { toast } from '../../os/shell/toast.js';

export async function mount(root){
  root.innerHTML='';
  const header = el('div',{class:'row'},[
    el('div',{class:'l'},[
      el('div',{class:'a', text:'Minesweeper'}),
      el('div',{class:'b', text:'Tap = reveal • Long-press = flag' })
    ]),
    el('button',{class:'btn primary', text:'New', onclick: ()=>start()})
  ]);

  const boardEl = el('div',{class:'ms-board'});
  root.append(header, boardEl);

  let W=9,H=9,M=10;
  let cells=[];
  let started=false;
  let gameOver=false;

  function start(){
    started=true; gameOver=false;
    cells = Array.from({length: W*H}, (_,i)=>({
      i, mine:false, n:0, open:false, flag:false
    }));
    // mines
    const idxs=[...Array(W*H).keys()];
    shuffle(idxs);
    for(let k=0;k<M;k++) cells[idxs[k]].mine=true;
    // numbers
    for(const c of cells){
      c.n = neighbors(c.i).reduce((acc,j)=>acc + (cells[j].mine?1:0), 0);
    }
    render();
  }

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
  }

  function neighbors(i){
    const x=i%W, y=Math.floor(i/W);
    const out=[];
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        if(dx===0&&dy===0) continue;
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        out.push(ny*W+nx);
      }
    }
    return out;
  }

  function reveal(i){
    const c=cells[i];
    if(c.open||c.flag||gameOver) return;
    c.open=true;
    if(c.mine){
      gameOver=true;
      for(const cc of cells) if(cc.mine) cc.open=true;
      toast('Boom', 'Game over.');
      render();
      return;
    }
    if(c.n===0){
      for(const j of neighbors(i)){
        if(!cells[j].open) reveal(j);
      }
    }
    checkWin();
    render();
  }

  function toggleFlag(i){
    const c=cells[i];
    if(c.open||gameOver) return;
    c.flag=!c.flag;
    render();
    checkWin();
  }

  function checkWin(){
    if(gameOver) return;
    const unopened = cells.filter(c=>!c.open).length;
    const flags = cells.filter(c=>c.flag).length;
    // win if all non-mines opened
    const ok = cells.every(c=> c.mine ? !c.open : c.open );
    if(ok){
      gameOver=true;
      toast('Win', 'All safe tiles revealed.');
    }
  }

  function computeSize(){
    const max = Math.min(window.innerWidth*0.92, 520);
    const gap = 6;
    const size = Math.floor((max - gap*(W-1)) / W);
    return Math.max(26, Math.min(56, size));
  }

  function render(){
    boardEl.innerHTML='';
    boardEl.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
    for(const c of cells){
      const size = computeSize();
      const b = el('button',{class:'btn', style:`height: ${size}px; width:${size}px; padding:0; border-radius:14px; font-weight:800;`});
      let txt='';
      if(c.open){
        if(c.mine) txt='💣';
        else txt = c.n===0 ? '' : String(c.n);
        b.style.background='rgba(255,255,255,0.10)';
      } else {
        txt = c.flag ? '🚩' : '';
      }
      b.textContent=txt;
      // tap vs long press
      let timer=null;
      b.addEventListener('pointerdown',(e)=>{
        timer=setTimeout(()=>{ toggleFlag(c.i); timer=null; }, 520);
      });
      b.addEventListener('pointerup',()=>{
        if(timer){ clearTimeout(timer); timer=null; reveal(c.i); }
      });
      b.addEventListener('pointercancel',()=>{ if(timer){ clearTimeout(timer); timer=null; } });
      boardEl.append(b);
    }
  }

  start();
}
