# YamanOS v1.0.0

YamanOS is a mobile-first, browser-based operating system simulation focused on touch interaction, responsive layout, and app-style workflows.

## What Is Stable in v1.0.0

- Mobile-first shell with portrait/landscape behavior.
- Unified version/build/asset token strategy via `os/version.js`.
- Settings, Notes, Files, Calculator, Browser, Clock, Weather, and game apps wired into the process manager.
- Browser v2 UI with always-open-in-new-tab policy for external sites.
- Files app with long-press actions and drag-and-drop move support.

## Browser Runtime Limits (Important)

YamanOS runs inside a web browser, so behavior follows browser sandbox rules:

- Data persistence uses browser storage (`localStorage`), not your real device filesystem.
- Storage capacity is quota-limited and can be cleared by browser/site-data reset.
- Popups/new tabs can be blocked by browser settings.
- Native OS file permissions and background services are not available.

## Data Model Summary

- Virtual filesystem content is stored in browser storage through the YamanOS filesystem service.
- Notes are saved as text files in the virtual filesystem.
- Uploaded files are stored as text or data URLs depending on type.
- App preferences (including Browser/Settings choices) are persisted in browser storage.

## Project Structure

```text
YamanOS/
├── index.html
├── css/
│   ├── main.css
│   ├── trix.css
│   └── tarneeb.css
├── os/
│   ├── apps/
│   ├── core/
│   ├── services/
│   ├── ui/
│   ├── utils/
│   ├── boot.js
│   ├── kernel.js
│   └── version.js
└── assets/
```

## Local Run

Use a local static server (ES modules require HTTP):

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages Run

1. Push this repo to GitHub.
2. In repository settings, enable **Pages** from the default branch root.
3. Open the published URL:

```text
https://<your-user>.github.io/<your-repo>/
```

Note: All asset paths in this project are relative, so it works on GitHub Pages subpaths.

## Release Validation (v1.0.0)

Run these checks before uploading:

```bash
while IFS= read -r f; do node --check "$f"; done < <(find os -name '*.js' | sort)
```

```bash
node -e "const fs=require('fs');const p='index.html';const t=fs.readFileSync(p,'utf8');console.log(/YamanOS v1\\.0\\.0/.test(t)?'index version OK':'index version MISMATCH')"
```

```bash
node -e "const fs=require('fs');const t=fs.readFileSync('os/version.js','utf8');console.log(/VERSION = 'v1\\.0\\.0'/.test(t)&&/BUILD = 'v1\\.0\\.0'/.test(t)&&/ASSET_VERSION = 'v1\\.0\\.0'/.test(t)?'version constants OK':'version constants MISMATCH')"
```

Recommended manual smoke test (browser):
1. Open `http://localhost:8000`.
2. Launch `Tarneeb` and `Trix` in portrait and landscape.
3. Verify no overlap/cutoff in table + hand areas.
4. Verify app open/close, Settings, Files, and Browser launch.
