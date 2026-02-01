window.TabletOSApps = window.TabletOSApps || {};
window.TabletOSApps["notes"] = (root, api) => {
  const saved = api.storage.get("text", "");
  root.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
        <div style="font-weight:900; font-size:18px">Notes</div>
        <div style="color:var(--muted); font-size:12px">Autosaves locally • Export via Start menu</div>
      </div>
      <div style="height:10px"></div>
      <textarea id="noteBox" placeholder="Write anything..."></textarea>
      <div style="height:10px"></div>
      <div class="row">
        <button class="pill" id="btnClear">Clear</button>
        <button class="pill" id="btnDemo">Insert demo</button>
      </div>
    </div>
  `;
  const box = root.querySelector("#noteBox");
  box.value = saved;
  const save = () => api.storage.set("text", box.value);
  box.addEventListener("input", save);
  root.querySelector("#btnClear").addEventListener("click", () => { box.value=""; save(); api.notify("Notes","Cleared."); });
  root.querySelector("#btnDemo").addEventListener("click", () => {
    box.value = `TabletOS Notes\n\n- Works offline (for built-in apps)\n- Autosaves\n- Export/Import in Start menu\n\nNext upgrades: pin apps, rearrange icons, better games.`;
    save(); api.notify("Notes","Demo inserted.");
  });
};
