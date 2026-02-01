# YamanOS v0.3.0 — Checkpoint

This folder is a complete, offline-capable iOS-friendly **PWA launcher** (“mini OS” UI) with:
- Desktop icons + Start menu
- Window manager (move, minimize, maximize, close)
- Apps: Files (IndexedDB), Notes (autosave), Browser (opens external sites), Paint (canvas), Games (2 mini-games), Settings (theme + wallpaper)
- Offline cache via Service Worker
- **Original** wallpapers (no copyrighted characters)

## What you do
1) Unzip
2) Host the folder (any static server)  
   - easiest: `python -m http.server 8000` inside the folder
3) On iPhone/iPad: open in Safari → Share → **Add to Home Screen**
4) Launch from your Home Screen icon.

## Reset (if something breaks)
- iOS Settings → Safari → Advanced → Website Data → remove your host domain
- Or in Safari: clear site data for that host (clears IndexedDB + localStorage)

## Safety / limits
- External sites open in a NEW TAB (no iframes).
- Files are local only (IndexedDB). Nothing is uploaded anywhere.

## Structure
- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `os/main.js` (UI wiring + apps)
- `os/windowManager.js`
- `os/storage.js` (IndexedDB + settings)
- `os/registry.js` (apps + wallpapers)
- `os/ui/shell.css`
- `os/assets/*`

