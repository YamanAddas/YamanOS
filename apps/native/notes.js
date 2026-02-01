window.YamanOSApps = window.YamanOSApps || {};
window.YamanOSApps["notes"] = (root, api) => {
  const fileId = api.extra?.fileId || null;

  const header = document.createElement("div");
  header.className = "notif-item";
  header.innerHTML = `
    <div class="t" style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
      <div>Notes</div>
      <div style="color:var(--muted); font-size:12px; font-weight:700">
        Saved as files • Drag notes on Desktop
      </div>
    </div>
    <div class="b" id="meta"></div>
  `;
  root.appendChild(header);

  const card = document.createElement("div");
  card.className = "notif-item";
  card.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px">
      <button class="pill" id="btnNew">New note</button>
      <button class="pill" id="btnSave">Save</button>
      <button class="pill" id="btnSaveAs">Save as…</button>
      <button class="pill" id="btnOpenDocs">Open Documents</button>
      <button class="pill danger" id="btnDelete">Delete</button>
    </div>
    <input id="title" class="start-search" style="width:100%" placeholder="Filename (e.g., My Note.txt)">
    <div style="height:10px"></div>
    <textarea id="text" placeholder="Write here..."></textarea>
  `;
  root.appendChild(card);

  const meta = header.querySelector("#meta");
  const title = card.querySelector("#title");
  const text = card.querySelector("#text");

  let currentId = fileId;
  function load(id){
    const n = api.fs.get(id);
    if(!n){ api.notify("Notes","File not found."); return; }
    currentId = id;
    title.value = n.name;
    text.value = n.content || "";
    meta.textContent = `Editing: ${n.name}`;
  }

  function newNote(){
    currentId = null;
    title.value = "New Note.txt";
    text.value = "";
    meta.textContent = "New note (not saved yet)";
  }

  function save(){
    const name = (title.value || "Note.txt").trim();
    if(!name){ api.notify("Notes","Missing name."); return; }
    if(currentId){
      api.fs.rename(currentId, name);
      api.fs.updateFile(currentId, text.value);
      meta.textContent = `Saved: ${name}`;
      api.notify("Notes", "Saved.");
      return;
    }
    const parent = api.fs.cwd(); // save in current folder (desktop folder) if possible
    currentId = api.fs.createFile(parent, name, "note", text.value);
    meta.textContent = `Saved: ${name}`;
    api.notify("Notes", "Saved as file on this desktop.");
    // refresh desktop so file appears
    api.fs.setCwd(parent);
  }

  function saveAs(){
    const name = prompt("Save as filename?", title.value || "Note.txt");
    if(!name) return;
    const parent = api.fs.cwd();
    currentId = api.fs.createFile(parent, name.trim(), "note", text.value);
    title.value = name.trim();
    meta.textContent = `Saved: ${name.trim()}`;
    api.notify("Notes","Saved as new file.");
    api.fs.setCwd(parent);
  }

  function del(){
    if(!currentId){ api.notify("Notes","Nothing to delete."); return; }
    if(!confirm("Delete this note file?")) return;
    api.fs.del(currentId);
    api.notify("Notes","Deleted.");
    newNote();
    api.fs.setCwd(api.fs.cwd());
  }

  card.querySelector("#btnNew").addEventListener("click", newNote);
  card.querySelector("#btnSave").addEventListener("click", save);
  card.querySelector("#btnSaveAs").addEventListener("click", saveAs);
  card.querySelector("#btnOpenDocs").addEventListener("click", () => api.fs.setCwd("f_docs"));
  card.querySelector("#btnDelete").addEventListener("click", del);

  // autosave to current file every 1s when editing an existing file
  let autosaveTimer = null;
  text.addEventListener("input", () => {
    if(!currentId) return;
    if(autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      api.fs.updateFile(currentId, text.value);
      meta.textContent = `Autosaved: ${title.value}`;
    }, 700);
  });

  if(currentId) load(currentId);
  else newNote();
};
