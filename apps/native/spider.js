window.TabletOSApps = window.TabletOSApps || {};
window.TabletOSApps["spider"] = (root, api) => {
  // Simplified Spider Solitaire (single suit) - click-to-move sequences.
  // Rules: build down by rank. Completed K->A sequences are removed.
  const SUIT="♠";
  function deck(){
    const d=[];
    for(let k=0;k<8;k++){
      for(let v=1;v<=13;v++) d.push({s:SUIT,v,up:false});
    }
    for(let i=d.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }
  function label(c){
    const names={1:"A",11:"J",12:"Q",13:"K"};
    return (names[c.v]||c.v)+c.s;
  }
  function fresh(){
    const d=deck();
    const cols=Array.from({length:10},()=>[]);
    // deal: 54 cards across 10 columns (first 4 get 6, rest 5)
    for(let i=0;i<54;i++){
      cols[i%10].push(d.pop());
    }
    // flip top
    for(const c of cols) c[c.length-1].up=true;
    return { stock:d, cols, sel:null, moves:0, completed:0 };
  }
  let state = api.storage.get("state", null) || fresh();
  function save(){ api.storage.set("state", state); }

  function topSeq(col){
    // return maximal descending face-up sequence ending at top
    const c=state.cols[col];
    let i=c.length-1;
    if(i<0 || !c[i].up) return null;
    let seq=[c[i]];
    while(i-1>=0 && c[i-1].up && c[i-1].v===c[i].v+1){
      i--; seq.unshift(c[i]);
    }
    return { start:i, seq };
  }

  function canPlace(seq, targetCol){
    const tgt=state.cols[targetCol];
    const top=tgt[tgt.length-1];
    if(!top) return seq[0].v===13;
    if(!top.up) return false;
    return top.v === seq[0].v + 1;
  }

  function flip(col){
    const c=state.cols[col];
    if(c.length && !c[c.length-1].up) c[c.length-1].up=true;
  }

  function checkComplete(col){
    const c=state.cols[col];
    if(c.length<13) return false;
    // check last 13 are a full K..A and face-up
    const tail=c.slice(-13);
    for(let i=0;i<13;i++){
      const want=13-i;
      if(!tail[i].up || tail[i].v!==want) return false;
    }
    // remove
    state.cols[col]=c.slice(0,-13);
    state.completed++;
    flip(col);
    api.notify("Spider", "Completed a full sequence.");
    return true;
  }

  function deal(){
    if(state.stock.length < 10){
      api.notify("Spider","No more stock.");
      return;
    }
    // must not deal onto empty columns (classic rule)
    if(state.cols.some(c=>c.length===0)){
      api.notify("Spider","Cannot deal with empty columns.");
      return;
    }
    for(let i=0;i<10;i++){
      const card=state.stock.pop();
      card.up=true;
      state.cols[i].push(card);
    }
    state.moves++;
    save();
    render();
  }

  function clickCol(i){
    const seqInfo = topSeq(i);
    if(!seqInfo) return;

    if(!state.sel){
      state.sel = { col:i, ...seqInfo };
      render();
      return;
    }

    // same col -> deselect
    if(state.sel.col===i){ state.sel=null; render(); return; }

    const ok = canPlace(state.sel.seq, i);
    if(!ok){ api.notify("Spider","Illegal move."); return; }

    // move
    const from = state.cols[state.sel.col];
    const moving = from.splice(state.sel.start);
    state.cols[i].push(...moving);
    flip(state.sel.col);
    state.sel=null;
    state.moves++;
    // check complete
    checkComplete(i);
    save();
    render();
  }

  function reset(){
    state=fresh();
    save();
    render();
  }

  function render(){
    root.innerHTML = `
      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
          <div style="font-weight:900; font-size:18px">Spider Solitaire (1 suit)</div>
          <div class="row" style="align-items:center">
            <button class="pill" id="deal">Deal</button>
            <button class="pill" id="new">New</button>
            <div class="pill">Moves: ${state.moves}</div>
            <div class="pill">Completed: ${state.completed}</div>
            <div class="pill">Stock: ${Math.floor(state.stock.length/10)} deals</div>
          </div>
        </div>
        <div style="height:10px"></div>
        <div class="card">
          <div style="color:var(--muted); font-size:12px">
            Click a column to select the largest descending sequence, then click a target column to move it.
            Complete K→A sequences auto-remove.
          </div>
        </div>
        <div style="height:10px"></div>
        <div id="cols" style="display:grid; grid-template-columns:repeat(10, 1fr); gap:8px"></div>
        <div style="height:10px"></div>
        <div class="card">Selected: ${
          state.sel ? `Col ${state.sel.col+1} (${state.sel.seq.length} cards, top ${label(state.sel.seq[0])})` : "none"
        }</div>
      </div>
    `;

    root.querySelector("#deal").onclick = deal;
    root.querySelector("#new").onclick = reset;

    const cols = root.querySelector("#cols");
    for(let i=0;i<10;i++){
      const c=state.cols[i];
      const top=c[c.length-1];
      const seq = topSeq(i);
      const sel = state.sel && state.sel.col===i;
      const el=document.createElement("div");
      el.className="card";
      el.style.cursor="pointer";
      el.style.minHeight="140px";
      el.style.outline = sel ? "2px solid rgba(58,160,255,.55)" : "none";
      el.innerHTML = `
        <div style="font-weight:800">Col ${i+1}</div>
        <div style="height:6px"></div>
        <div class="row" style="align-items:center; justify-content:space-between">
          <div class="pill">${top ? (top.up ? label(top) : "🂠") : "—"}</div>
          <div style="color:var(--muted); font-size:12px">${c.length} cards</div>
        </div>
        <div style="height:6px"></div>
        <div style="color:var(--muted); font-size:12px">
          ${seq ? `movable seq: ${seq.seq.length}` : "no move"}
        </div>
      `;
      el.onclick = () => clickCol(i);
      cols.appendChild(el);
    }
  }

  render();
};
