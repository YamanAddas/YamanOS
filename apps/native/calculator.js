window.TabletOSApps = window.TabletOSApps || {};
window.TabletOSApps["calculator"] = (root, api) => {
  const layout = [
    ["C","(",")","⌫"],
    ["7","8","9","/"],
    ["4","5","6","*"],
    ["1","2","3","-"],
    ["0",".","=","+"],
  ];
  root.innerHTML = `
    <div class="card" style="max-width:420px">
      <div style="font-weight:900; font-size:18px">Calculator</div>
      <div style="height:10px"></div>
      <input id="disp" inputmode="none"
        style="width:100%; padding:12px 12px; border-radius:12px; border:1px solid var(--border);
        background:var(--panel); color:var(--fg); font-size:20px" placeholder="0">
      <div style="height:10px"></div>
      <div id="grid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px"></div>
      <div style="height:8px"></div>
      <div style="color:var(--muted); font-size:12px">Basic arithmetic only.</div>
    </div>
  `;
  const disp = root.querySelector("#disp");
  const grid = root.querySelector("#grid");

  function safeEval(expr){
    if(!/^[0-9+\-*/().\s]+$/.test(expr)) throw new Error("Invalid characters");
    if(/(\*\*|\/\/)/.test(expr)) throw new Error("Unsupported operator");
    // eslint-disable-next-line no-new-func
    const f = new Function(`return (${expr});`);
    const v = f();
    if(!Number.isFinite(v)) throw new Error("Non-finite result");
    return v;
  }

  const press = (k) => {
    if(k === "C"){ disp.value=""; return; }
    if(k === "⌫"){ disp.value = disp.value.slice(0,-1); return; }
    if(k === "="){
      try{
        const v = safeEval(disp.value || "0");
        disp.value = String(v);
      }catch(e){ api.notify("Calculator", e.message); }
      return;
    }
    disp.value += k;
  };

  for(const row of layout){
    for(const k of row){
      const b = document.createElement("button");
      b.className = "pill";
      b.textContent = k;
      b.addEventListener("click", () => press(k));
      grid.appendChild(b);
    }
  }
};
