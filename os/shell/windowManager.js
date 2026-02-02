// os/shell/windowManager.js

export class WindowManager {
  constructor({ root } = {}) {
    this.root = root || document.body;
    this.desktopEl = document.getElementById("desktop") || this.root;
    this._topZ = 1;
  }

  init() {
    return Promise.resolve();
  }

  open(appId, title = "") {
    const frame = document.createElement("div");
    frame.className = "window-frame";
    frame.dataset.appId = String(appId || "");

    const header = document.createElement("div");
    header.className = "window-header";
    header.textContent = title || String(appId || "Window");

    frame.appendChild(header);
    this.desktopEl.appendChild(frame);

    this._bringToFront(frame);

    frame.addEventListener("mousedown", () => this._bringToFront(frame));

    this._centerWindow(frame);

    return frame;
  }

  _bringToFront(frame) {
    this._topZ += 1;
    frame.style.zIndex = String(this._topZ);
  }

  _centerWindow(frame) {
    const rect = frame.getBoundingClientRect();
    const width = rect.width || 320;
    const height = rect.height || 200;
    const left = Math.max(0, (window.innerWidth - width) / 2);
    const top = Math.max(0, (window.innerHeight - height) / 2);
    frame.style.left = `${left}px`;
    frame.style.top = `${top}px`;
  }
}
