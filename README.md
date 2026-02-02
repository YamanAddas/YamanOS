# YamanOS v0.3.0 (Static PWA Shell — No Service Worker)

This build is intentionally **service-worker free** to avoid cache/version mix issues during early boot stability.

## File tree (top level)
- `index.html` — bootstraps the shell
- `manifest.json` — PWA manifest (no SW)
- `assets/` — CSS, wallpapers, icons
- `os/` — core OS (registry, window manager, shell, storage, theme)
- `apps/` — native apps (Files, Notes, Browser, Settings, Paint, Minesweeper, Snake)

## How to test locally (must use a local server)
From the project folder:

### Option A: Python
```bash
python -m http.server 8080
```
Open: http://localhost:8080

### Option B: Node
```bash
npx serve . -l 8080
```
Open: http://localhost:8080

> Do **not** open `index.html` via `file://` or IndexedDB may fail.

## How to upload to GitHub Pages
1. Create a new GitHub repo (public or private).
2. Upload the **contents** of this folder to the repo root (or push via git).
3. In GitHub repo settings:
   - **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` (or `master`) and folder `/ (root)`
4. Save. Wait for GitHub Pages to publish.
5. Open the provided Pages URL.

## Future updates: adding an app without rewrites
1. Create a new module at `apps/<yourapp>/app.js` exporting:
   - `export async function mount(root, { shell, winId, params }) { ... }`
2. Add an entry in `os/registry.js` under `apps`:
   - `{ id:'yourapp', title:'Your App', icon:'...', module:'./apps/yourapp/app.js' }`
3. Add a desktop icon entry via Settings or seed script (later), or pin it in the taskbar.

## Data model (IndexedDB)
- `kv` store: settings and small structured state (`desktop.items`, etc.)
- `files` store: folder + file records (notes + shortcuts)
- `history` store: browser launcher history
- `recents` store: notifications log

## Known intentional limitations (v0.3.0)
- Files app Move uses a simple prompt-based folder id picker (fast + reliable). A richer picker can come later.
- No service worker yet (by design).


## Hotfix note
If you previously saw the boot screen stuck, this hotfix fixes an invalid viewport meta string and a transaction-promise bug in the IndexedDB wrapper.
