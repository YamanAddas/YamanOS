// os/main.js
import { boot } from "./shell/boot.js";

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await boot();
  } catch (err) {
    console.error("BOOT ERROR:", err);

    const bootEl = document.getElementById("boot");
    if (bootEl) {
      bootEl.innerHTML = `
        <div class="boot-card">
          <div class="boot-logo">!</div>
          <div class="boot-title">Boot Failed</div>
          <div class="boot-sub" style="max-width:600px; white-space:pre-wrap; opacity:0.9;">
            ${String(err?.stack || err)}
          </div>
        </div>
      `;
    }
  }
});
