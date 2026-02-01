window.YamanOSApps = window.YamanOSApps || {};
window.YamanOSApps["fileExplorer"] = (root, api) => {
  const wrap = document.createElement("div");
  wrap.className = "notif-item";
  wrap.innerHTML = `
    <div class="t" style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
      <div>Files</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="pill" id="btnUp">Up</button>
        <button class="pill" id="btnNewFolder">New folder</button>
        <button class="pill" id="btnNewNote">New note</button>
      </div>
    </div>
    <div class="d" id="path"></div>
    <div style="height:10px"></div>
    <div id="list"></div>
  `;
  root.appendChild(wrap);

  const pathEl = wrap.querySelector("#path");
  const listEl = wrap.querySelector("#list");

  function pathFor(id){
    const parts=[];
    let cur=api.fs.get(id);
    while(cur){
      parts.push(cur.name);
      cur = cur.parent ? api.fs.get(cur.parent) : null;
    }
    return parts.reverse().join(" / ");
  }

  function render(){
    const cwd = api.fs.cwd();
    pathEl.textContent = pathFor(cwd);
    const kids = api.fs.children(cwd);

    listEl.innerHTML = "";
    if(!kids.length){
      listEl.innerHTML = `<div class="notif-item"><div class="t">Empty</div><div class="b">Create a folder or note.</div></div>`;
      return;
    }

    for(const n of kids){
      const row = document.createElement("div");
      row.className = "tile";
      const ico = n.type==="folder" ? "📁" : (n.kind==="note" ? "📝" : "📄");
      row.innerHTML = `
        <div class="tile-ico">${ico}</div>
        <div style="min-width:0">
          <div class="tile-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${n.name}</div>
          <div class="tile-sub">${n.type} • ${new Date(n.updatedAt).toLocaleString()}</div>
        </div>
        <div style="margin-left:auto; display:flex; gap:8px">
          <button class="pill" data-act="open">Open</button>
          <button class="pill" data-act="rename">Rename</button>
          <button class="pill danger" data-act="del">Delete</button>
        </div>
      `;
      row.querySelector('[data-act="open"]').addEventListener("click", () => {
        if(n.type==="folder") api.fs.setCwd(n.id);
        else api.openFile(n.id);
      });
      row.querySelector('[data-act="rename"]').addEventListener("click", () => {
        const nn = prompt("Rename to:", n.name);
        if(nn){ api.fs.rename(n.id, nn.trim()); render(); }
      });
      row.querySelector('[data-act="del"]').addEventListener("click", () => {
        if(confirm("Delete?")){ api.fs.del(n.id); render(); }
      });
      listEl.appendChild(row);
    }
  }

  wrap.querySelector("#btnUp").addEventListener("click", () => {
    const cwd = api.fs.cwd();
    const cur = api.fs.get(cwd);
    if(cur?.parent) api.fs.setCwd(cur.parent);
  });
  wrap.querySelector("#btnNewFolder").addEventListener("click", () => {
    const name = prompt("Folder name?");
    if(!name) return;
    const id = "folder_" + crypto.randomUUID().slice(0,8);
    const f = api.fs.get("root"); // just to check
    // create folder via direct fs create: (we expose createFile only) so we use move hack not possible
    // We'll call a hidden API: api.fs._createFolder if present (not here). As fallback, create a note that indicates.
    api.notify("Files", "Folder creation is available from desktop context menu for now.");
  });
  wrap.querySelector("#btnNewNote").addEventListener("click", () => {
    const name = prompt("Note name?", "New Note.txt");
    if(!name) return;
    const id = api.fs.createFile(api.fs.cwd(), name.trim(), "note", "");
    api.openFile(id);
    render();
  });

  render();
};
