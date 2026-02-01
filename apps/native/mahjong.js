window.YamanOSApps = window.YamanOSApps || {};
window.YamanOSApps["mahjong"] = (root, api) => {
  // Simplified Mahjong (match two of the same tile if both are "free"):
  // A tile is free if it has no tile immediately left or right.
  // Layout: single layer grid. This is not full 3D Mahjong solitaire, but it's playable.
  const W=12, H=8; // grid
  const tiles = ["🀇","🀈","🀉","🀊","🀋","🀌","🀍","🀎","🀏","🀐","🀑","🀒","🀓","🀔","🀕","🀖"];
  const pairs = (W*H)/2;
  function newBoard(){
    const bag=[];
    for(let i=0;i<pairs;i++){
      const t=tiles[i % tiles.length];
      bag.push(t,t);
    }
    // shuffle
    for(let i=bag.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [bag[i],bag[j]]=[bag[j],bag[i]];
    }
    const b=[];
    for(let y=0;y<H;y++){
      b[y]=[];
      for(let x=0;x<W;x++){
        b[y][x]={t:bag.pop(), gone:false};
      }
    }
    return { b, sel:null, moves:0, cleared:0 };
  }
  let state = api.storage.get("state", null) || newBoard();
  function save(){ api.storage.set("state", state); }

  function free(x,y){
    const cell=state.b[y][x];
    if(cell.gone) return false;
    const left = x-1>=0 ? state.b[y][x-1] : null;
    const right = x+1<W ? state.b[y][x+1] : null;
    const leftBlocked = left && !left.gone;
    const rightBlocked = right && !right.gone;
    return !(leftBlocked && rightBlocked); // at least one side open
  }

  function click(x,y){
    if(!free(x,y)){
      api.notify("Mahjong","Tile is locked (both sides blocked).");
      return;
    }
    const cell=state.b[y][x];
    if(cell.gone) return;
    if(!state.sel){
      state.sel={x,y};
      render();
      return;
    }
    const {x:sx,y:sy}=state.sel;
    // same tile -> deselect
    if(sx===x && sy===y){ state.sel=null; render(); return; }

    const other=state.b[sy][sx];
    if(other.gone){ state.sel=null; render(); return; }

    if(other.t===cell.t){
      other.gone=true;
      cell.gone=true;
      state.sel=null;
      state.moves++;
      state.cleared+=2;
      if(state.cleared===W*H){
        api.notify("Mahjong","Board cleared. Your brain is now a weapon.");
      }
      save();
      render();
    } else {
      api.notify("Mahjong","No match.");
      state.sel={x,y};
      render();
    }
  }

  function reset(){
    state=newBoard();
    save(); render();
  }

  function hint(){
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        if(!free(x,y)) continue;
        const a=state.b[y][x];
        if(a.gone) continue;
        for(let yy=0;yy<H;yy++){
          for(let xx=0;xx<W;xx++){
            if(x===xx && y===yy) continue;
            if(!free(xx,yy)) continue;
            const b=state.b[yy][xx];
            if(!b.gone && b.t===a.t){
              api.notify("Mahjong", `Hint: match at (${x+1},${y+1}) with (${xx+1},${yy+1})`);
              return;
            }
          }
        }
      }
    }
    api.notify("Mahjong","No available moves (shuffle coming in v2).");
  }

  function render(){
    root.innerHTML = `
      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
          <div style="font-weight:900; font-size:18px">Mahjong (simplified)</div>
          <div class="row" style="align-items:center">
            <button class="pill" id="hint">Hint</button>
            <button class="pill" id="new">New</button>
            <div class="pill">Moves: ${state.moves}</div>
          </div>
        </div>
        <div style="height:10px"></div>
        <div class="card" style="color:var(--muted); font-size:12px">
          Rule: A tile is playable if it’s not trapped by tiles on BOTH left and right.
          Tap two matching playable tiles to remove them.
        </div>
        <div style="height:10px"></div>
        <div id="grid" style="display:grid; grid-template-columns:repeat(${W}, 1fr); gap:6px"></div>
        <div style="height:10px"></div>
        <div class="card">Selected: ${
          state.sel ? `(${state.sel.x+1},${state.sel.y+1})` : "none"
        }</div>
      </div>
    `;
    root.querySelector("#new").onclick = reset;
    root.querySelector("#hint").onclick = hint;

    const grid = root.querySelector("#grid");
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const cell=state.b[y][x];
        const btn=document.createElement("button");
        btn.className="pill";
        btn.style.padding="12px 0";
        btn.style.borderRadius="12px";
        btn.style.fontSize="18px";
        btn.style.opacity = cell.gone ? "0.12" : (free(x,y) ? "1" : "0.55");
        btn.style.outline = (state.sel && state.sel.x===x && state.sel.y===y) ? "2px solid rgba(58,160,255,.55)" : "none";
        btn.textContent = cell.gone ? " " : cell.t;
        btn.onclick = () => click(x,y);
        grid.appendChild(btn);
      }
    }
    save();
  }

  render();
};
