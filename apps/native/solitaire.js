window.TabletOSApps = window.TabletOSApps || {};
window.TabletOSApps["solitaire"] = (root, api) => {
  // A compact, playable Klondike (click-to-move) implementation.
  // Drag & drop is intentionally avoided for iOS sanity.
  const SUITS = ["♠","♥","♦","♣"];
  const COLORS = { "♠":"B", "♣":"B", "♥":"R", "♦":"R" };

  function newDeck(){
    const d=[];
    for(const s of SUITS) for(let v=1;v<=13;v++) d.push({s,v,up:false});
    // shuffle
    for(let i=d.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }

  const st = api.storage.get("state", null);
  let state = st || fresh();

  function fresh(){
    const deck=newDeck();
    const tableau = Array.from({length:7}, () => []);
    for(let col=0;col<7;col++){
      for(let i=0;i<=col;i++){
        const c=deck.pop();
        tableau[col].push(c);
      }
      tableau[col][tableau[col].length-1].up=true;
    }
    return {
      deck,
      waste: [],
      foundations: { "♠":[], "♥":[], "♦":[], "♣":[] },
      tableau,
      selected: null,
      moves: 0
    };
  }

  function save(){ api.storage.set("state", state); }

  function cardLabel(c){
    const names={1:"A",11:"J",12:"Q",13:"K"};
    const v=names[c.v]||String(c.v);
    return `${v}${c.s}`;
  }

  function canPlaceOnTableau(card, targetTop){
    if(!targetTop) return card.v===13; // king to empty
    const diff = targetTop.v - card.v === 1;
    const colorOk = COLORS[targetTop.s] !== COLORS[card.s];
    return diff && colorOk;
  }

  function canPlaceOnFoundation(card){
    const pile = state.foundations[card.s];
    const top = pile[pile.length-1];
    if(!top) return card.v===1;
    return card.v === top.v + 1;
  }

  function topOf(col){
    const t = state.tableau[col];
    return t.length ? t[t.length-1] : null;
  }

  function flipIfNeeded(col){
    const t=state.tableau[col];
    if(t.length && !t[t.length-1].up) t[t.length-1].up=true;
  }

  function draw(){
    if(state.deck.length){
      const c=state.deck.pop();
      c.up=true;
      state.waste.push(c);
    } else {
      // recycle waste
      state.deck = state.waste.reverse().map(c => ({...c, up:false}));
      state.waste = [];
    }
    state.selected=null;
    state.moves++;
    save(); render();
  }

  function selectFromWaste(){
    const c = state.waste[state.waste.length-1];
    if(!c) return;
    state.selected = {src:"waste", card:c};
    render();
  }

  function selectFromTableau(col){
    const t=state.tableau[col];
    if(!t.length) return;
    const c=t[t.length-1];
    if(!c.up) { c.up=true; state.moves++; save(); render(); return; }
    state.selected = {src:"tableau", col, card:c};
    render();
  }

  function moveSelectedToFoundation(){
    const sel=state.selected;
    if(!sel) return false;
    const c=sel.card;
    if(!canPlaceOnFoundation(c)) return false;
    // remove
    if(sel.src==="waste") state.waste.pop();
    if(sel.src==="tableau"){ state.tableau[sel.col].pop(); flipIfNeeded(sel.col); }
    state.foundations[c.s].push({...c, up:true});
    state.selected=null;
    state.moves++;
    save();
    return true;
  }

  function moveSelectedToTableau(targetCol){
    const sel=state.selected;
    if(!sel) return false;
    const c=sel.card;
    const tgt=topOf(targetCol);
    if(!canPlaceOnTableau(c, tgt)) return false;
    // remove
    if(sel.src==="waste") state.waste.pop();
    if(sel.src==="tableau"){ state.tableau[sel.col].pop(); flipIfNeeded(sel.col); }
    state.tableau[targetCol].push({...c, up:true});
    state.selected=null;
    state.moves++;
    save();
    return true;
  }

  function autoMoves(){
    // keep moving waste/top-tableau to foundations where possible
    let moved=true, count=0;
    while(moved && count<80){
      moved=false; count++;
      const w = state.waste[state.waste.length-1];
      if(w && canPlaceOnFoundation(w)){
        state.selected={src:"waste", card:w};
        moveSelectedToFoundation();
        moved=true; continue;
      }
      for(let i=0;i<7;i++){
        const c=topOf(i);
        if(c && c.up && canPlaceOnFoundation(c)){
          state.selected={src:"tableau", col:i, card:c};
          moveSelectedToFoundation();
          moved=true; break;
        }
      }
    }
    render();
  }

  function reset(){
    state=fresh();
    save();
    render();
    api.notify("Solitaire","New deal.");
  }

  function render(){
    root.innerHTML = `
      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
          <div style="font-weight:900; font-size:18px">Solitaire (Klondike)</div>
          <div class="row" style="align-items:center">
            <button class="pill" id="draw">Draw</button>
            <button class="pill" id="auto">Auto to foundations</button>
            <button class="pill" id="new">New</button>
            <div class="pill">Moves: ${state.moves}</div>
          </div>
        </div>
        <div style="height:10px"></div>

        <div class="row">
          <div class="card" style="min-width:160px; flex:1">
            <div style="font-weight:800; margin-bottom:6px">Deck / Waste</div>
            <div class="row">
              <button class="pill" id="deck" title="Draw a card">${state.deck.length ? "🂠 x"+state.deck.length : "↺"}</button>
              <button class="pill" id="waste">${state.waste.length ? cardLabel(state.waste[state.waste.length-1]) : "—"}</button>
            </div>
            <div style="height:8px"></div>
            <div style="color:var(--muted); font-size:12px">Click Waste to select.</div>
          </div>

          <div class="card" style="min-width:260px; flex:2">
            <div style="font-weight:800; margin-bottom:6px">Foundations</div>
            <div class="row">
              ${SUITS.map(s=>`<button class="pill fnd" data-suit="${s}">${s} ${state.foundations[s].length ? cardLabel(state.foundations[s][state.foundations[s].length-1]) : ""}</button>`).join("")}
            </div>
            <div style="height:8px"></div>
            <div style="color:var(--muted); font-size:12px">With a card selected, tap a foundation to place it.</div>
          </div>
        </div>

        <div style="height:10px"></div>

        <div class="card">
          <div style="font-weight:800; margin-bottom:6px">Tableau</div>
          <div id="tab" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px"></div>
          <div style="height:8px"></div>
          <div style="color:var(--muted); font-size:12px">
            Click a column top-card to select. Then click another column to move. (This version moves top cards only.)
          </div>
        </div>

        <div style="height:10px"></div>
        <div class="card" id="sel">
          Selected: ${state.selected ? cardLabel(state.selected.card) : "none"}
        </div>
      </div>
    `;

    root.querySelector("#deck").onclick = draw;
    root.querySelector("#draw").onclick = draw;
    root.querySelector("#waste").onclick = () => { selectFromWaste(); };
    root.querySelector("#new").onclick = reset;
    root.querySelector("#auto").onclick = autoMoves;

    // foundations click
    root.querySelectorAll(".fnd").forEach(b => {
      b.onclick = () => {
        if(!state.selected) return;
        if(moveSelectedToFoundation()){
          api.notify("Solitaire", "Moved to foundation.");
          render();
        }
      };
    });

    // tableau
    const tab = root.querySelector("#tab");
    for(let i=0;i<7;i++){
      const col = document.createElement("div");
      col.className="card";
      col.style.minHeight="120px";
      col.style.cursor="pointer";
      const t=state.tableau[i];
      const top=t.length ? t[t.length-1] : null;
      const face = top ? (top.up ? cardLabel(top) : "🂠") : "—";
      const count = t.length;
      const hint = top && top.up ? "" : (top ? "tap to flip" : "empty");
      const selMark = state.selected && state.selected.src==="tableau" && state.selected.col===i ? " (selected)" : "";
      col.innerHTML = `
        <div style="font-weight:800">Col ${i+1}${selMark}</div>
        <div style="height:6px"></div>
        <div class="row" style="align-items:center; justify-content:space-between">
          <div class="pill">${face}</div>
          <div style="color:var(--muted); font-size:12px">${count} cards</div>
        </div>
        <div style="height:6px"></div>
        <div style="color:var(--muted); font-size:12px">${hint}</div>
      `;
      col.onclick = () => {
        if(state.selected){
          if(moveSelectedToTableau(i)){
            api.notify("Solitaire","Moved.");
            render();
          }
          return;
        }
        selectFromTableau(i);
      };
      tab.appendChild(col);
    }
    save();
  }

  render();
};
