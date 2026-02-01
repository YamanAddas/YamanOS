window.YamanOSApps = window.YamanOSApps || {};
window.YamanOSApps["browser"] = (root, api) => {
  root.innerHTML = `
    <div class="notif-item">
      <div class="t">Browser</div>
      <div class="b" style="color:var(--muted)">Built-in simple browser. Some sites block embedding; use Open when needed.</div>
      <div style="height:10px"></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <input id="url" class="start-search" style="flex:1; min-width:220px" placeholder="Enter URL (https://...)">
        <button class="pill" id="go">Go</button>
        <button class="pill" id="open">Open</button>
      </div>
      <div style="height:10px"></div>
      <div style="height:58vh; border:1px solid var(--border); border-radius:16px; overflow:hidden">
        <iframe id="frame" title="Browser frame"></iframe>
      </div>
    </div>
  `;
  const url = root.querySelector("#url");
  const frame = root.querySelector("#frame");
  const go = () => {
    let u = (url.value || "").trim();
    if(!u) return;
    if(!/^https?:\/\//i.test(u)) u = "https://" + u;
    url.value = u;
    frame.src = u;
    api.notify("Browser", "Loading…");
  };
  root.querySelector("#go").addEventListener("click", go);
  root.querySelector("#open").addEventListener("click", () => {
    const u = (url.value || "").trim();
    if(u) window.open(u, "_blank", "noopener,noreferrer");
  });
  // default
  url.value = "https://duckduckgo.com";
  go();
};
