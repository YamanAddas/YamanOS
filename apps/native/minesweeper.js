window.TabletOSApps = window.TabletOSApps || {};
window.TabletOSApps["minesweeper"] = (root, api) => {
  const sizes = {
    Easy: {w:9,h:9,m:10},
    Medium: {w:16,h:16,m:40},
    Hard: {w:24,h:16,m:70}
  };
  let cfg = api.storage.get("cfg", sizes.Easy);
  let grid = [];
  let started = false;
  let over = false;
  let flags = 0;
  let t0 = 0;
  let timer = null;

  root.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
        <div style="font-weight:900; font-size:18px">Minesweeper</div>
        <div class="row" style="align-items:center">
          <select id="mode" class="pill" style="padding:10px 12px">
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
          <button class="pill" id="new">New</button>
          <div class="pill" id="stat">⏱ 0s • 🚩 0</div>
        </div>
      </div>
      <div style="height:10px"></div>
      <div id="board" style="display:grid; gap:4px; justify-content:start"></div>
      <div style="height:10px"></div>
      <div style="color:var(--muted); font-size:12px">
        Tap/click: reveal • Right-click or long-press: flag.
      </div>
    </div>
  `;

  const mode = root.querySelector("#mode");
  const board = root.querySelector("#board");
  const stat = root.querySelector("#stat");

  const modeName = api.storage.get("mode","Easy");
  mode.value = modeName;

  function updateStat(){
    const s = started ? Math.floor((Date.now()-t0)/1000) : 0;
    stat.textContent = `⏱ ${s}s • 🚩 ${flags}/${cfg.m}`;
  }

  function stopTimer(){ if(timer){ clearInterval(timer); timer=null; } }
  function startTimer(){ t0 = Date.now(); stopTimer(); timer = setInterval(updateStat, 250); }

  function newGame(){
    const name = mode.value;
    cfg = sizes[name];
    api.storage.set("cfg", cfg);
    api.storage.set("mode", name);

    started = false; over = false; flags = 0;
    stopTimer();
    updateStat();

    grid = Array.from({length: cfg.h}, () =>
      Array.from({length: cfg.w}, () => ({mine:false, n:0, open:false, flag:false}))
    );

    board.style.gridTemplateColumns = `repeat(${cfg.w}, 28px)`;
    render();
  }

  function placeMines(safeX, safeY){
    const forbidden = new Set();
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        const nx=safeX+dx, ny=safeY+dy;
        if(nx>=0 && nx<cfg.w && ny>=0 && ny<cfg.h) forbidden.add(`${nx},${ny}`);
      }
    }
    let placed=0;
    while(placed<cfg.m){
      const x = Math.floor(Math.random()*cfg.w);
      const y = Math.floor(Math.random()*cfg.h);
      if(forbidden.has(`${x},${y}`)) continue;
      const c = grid[y][x];
      if(c.mine) continue;
      c.mine=true;
      placed++;
    }
    for(let y=0;y<cfg.h;y++){
      for(let x=0;x<cfg.w;x++){
        const c=grid[y][x];
        if(c.mine){ c.n=-1; continue; }
        let n=0;
        for(let dy=-1;dy<=1;dy++){
          for(let dx=-1;dx<=1;dx++){
            if(!dx && !dy) continue;
            const nx=x+dx, ny=y+dy;
            if(nx>=0 && nx<cfg.w && ny>=0 && ny<cfg.h && grid[ny][nx].mine) n++;
          }
        }
        c.n=n;
      }
    }
  }

  function flood(x,y){
    const stack=[[x,y]];
    const seen=new Set();
    while(stack.length){
      const [cx,cy]=stack.pop();
      const key=`${cx},${cy}`;
      if(seen.has(key)) continue;
      seen.add(key);
      const c=grid[cy][cx];
      if(c.open || c.flag) continue;
      c.open=true;
      if(c.n===0){
        for(let dy=-1;dy<=1;dy++){
          for(let dx=-1;dx<=1;dx++){
            const nx=cx+dx, ny=cy+dy;
            if(nx>=0 && nx<cfg.w && ny>=0 && ny<cfg.h){
              const nc=grid[ny][nx];
              if(!nc.open && !nc.mine) stack.push([nx,ny]);
            }
          }
        }
      }
    }
  }

  function checkWin(){
    let closed=0;
    for(let y=0;y<cfg.h;y++){
      for(let x=0;x<cfg.w;x++){
        const c=grid[y][x];
        if(!c.open && !c.mine) closed++;
      }
    }
    if(closed===0){
      over=true; stopTimer();
      api.notify("Minesweeper", "You win.");
    }
  }

  function revealAll(){
    for(let y=0;y<cfg.h;y++) for(let x=0;x<cfg.w;x++){
      const c=grid[y][x];
      if(c.mine) c.open=true;
    }
  }

  function onReveal(x,y){
    if(over) return;
    const c=grid[y][x];
    if(c.open || c.flag) return;

    if(!started){
      placeMines(x,y);
      started=true;
      startTimer();
    }

    if(c.mine){
      c.open=true;
      over=true;
      revealAll();
      stopTimer();
      api.notify("Minesweeper", "Boom.");
      render();
      return;
    }

    if(c.n===0) flood(x,y);
    else c.open=true;

    render();
    checkWin();
  }

  function onFlag(x,y){
    if(over) return;
    const c=grid[y][x];
    if(c.open) return;
    c.flag = !c.flag;
    flags += c.flag ? 1 : -1;
    updateStat();
    render();
  }

  function render(){
    board.innerHTML="";
    for(let y=0;y<cfg.h;y++){
      for(let x=0;x<cfg.w;x++){
        const c=grid[y][x];
        const b=document.createElement("button");
        b.style.width="28px";
        b.style.height="28px";
        b.style.borderRadius="8px";
        b.style.border="1px solid var(--border)";
        b.style.background = c.open ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)";
        b.style.color="var(--fg)";
        b.style.cursor="pointer";
        b.style.fontWeight="900";
        b.style.fontSize="14px";
        b.style.userSelect="none";

        let label="";
        if(c.open){
          if(c.mine) label="💥";
          else if(c.n>0) label=String(c.n);
        } else if(c.flag){
          label="🚩";
        }
        b.textContent=label;

        b.addEventListener("click", () => onReveal(x,y));
        b.addEventListener("contextmenu", (e) => { e.preventDefault(); onFlag(x,y); });

        // long-press flag for iOS
        let lp=null;
        b.addEventListener("pointerdown", () => { lp=setTimeout(()=>{ onFlag(x,y); }, 420); });
        b.addEventListener("pointerup", () => { if(lp) clearTimeout(lp); lp=null; });
        b.addEventListener("pointercancel", () => { if(lp) clearTimeout(lp); lp=null; });

        board.appendChild(b);
      }
    }
  }

  root.querySelector("#new").addEventListener("click", newGame);
  mode.addEventListener("change", newGame);

  newGame();
};
