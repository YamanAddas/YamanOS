import { kernel } from './kernel.js';
import { VERSION, BUILD, ASSET_VERSION } from './version.js';
import { MobileShell } from './ui/mobileShell.js';
import { initTheme } from './theme/theme.js';
// Note: Desktop mode removed - YamanOS is now mobile-only for all devices


// Apps
import { SettingsApp } from './apps/SettingsApp.js';
import { ClockApp } from './apps/ClockApp.js';
import { SnakeApp } from './apps/SnakeApp.js';
import { WeatherApp } from './apps/WeatherApp.js';
import { MemoryApp } from './apps/MemoryApp.js';
import { NotesApp } from './apps/NotesApp.js';
import { BrowserApp } from './apps/BrowserApp.js';
import { CalculatorApp } from './apps/CalculatorApp.js';
import { FilesApp } from './apps/FilesApp.js';
import { TicTacToeApp } from './apps/TicTacToeApp.js';
import { MinesweeperApp } from './apps/games/MinesweeperApp.js';
import { SolitaireApp } from './apps/games/SolitaireApp.js';
import { SpiderSolitaireApp } from './apps/games/SpiderSolitaireApp.js';
import { MahjongApp } from './apps/games/MahjongApp.js';
import { TarneebApp } from './apps/games/TarneebApp.js';
import { TrixApp } from './apps/games/TrixApp.js';

// Global error handlers to catch any boot-time errors
window.addEventListener('error', (e) => {
  console.error('[Boot] Uncaught Error:', e.error);
  const bootScreen = document.getElementById('boot');
  if (bootScreen) {
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:red;font-size:11px;position:absolute;bottom:40px;width:100%;text-align:center;';
    errEl.textContent = `Error: ${e.message}`;
    bootScreen.appendChild(errEl);
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Boot] Unhandled Promise Rejection:', e.reason);
  const bootScreen = document.getElementById('boot');
  if (bootScreen) {
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:orange;font-size:11px;position:absolute;bottom:55px;width:100%;text-align:center;';
    errEl.textContent = `Promise Error: ${e.reason?.message || e.reason}`;
    bootScreen.appendChild(errEl);
  }
});

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function applyInitialTheme() {
  const mode = localStorage.getItem('yamanos_theme_mode');
  const legacy = localStorage.getItem('yamanos_theme');
  const legacyDark = localStorage.getItem('yamanos_theme_dark');
  const resolved = mode === 'light' || mode === 'dark'
    ? mode
    : legacy === 'light' || legacy === 'dark'
      ? legacy
      : legacyDark === 'false'
        ? 'light'
        : 'dark';
  const isLight = resolved === 'light';
  document.body.classList.toggle('theme-light', isLight);
  document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
}

async function runBootSmokeCheck(shell) {
  const grid = shell?.components?.grid;
  if (!grid) throw new Error('Startup check failed: AppGrid missing');

  const engine = grid.layoutEngine;
  if (!engine || typeof engine.getCellPosition !== 'function') {
    throw new Error('Startup check failed: layoutEngine.getCellPosition missing');
  }
  if (typeof engine.getGridLocationFromPoint !== 'function') {
    throw new Error('Startup check failed: layoutEngine.getGridLocationFromPoint missing');
  }

  await nextFrame();
  const iconCount = grid.pagesContainer?.querySelectorAll('.app-icon').length ?? 0;
  const stateItemCount = grid.state?.items?.size ?? 0;
  if (stateItemCount > 0 && iconCount < 1) {
    throw new Error('Startup check failed: no icons rendered in AppGrid');
  }
}

async function boot() {
  initTheme();
  // SINGLETON GUARD: Prevent multiple boots
  if (window.__YAMANOS_BOOTED__) {
    console.warn('[Boot] Prevented duplicate boot!');
    return;
  }
  window.__YAMANOS_BOOTED__ = true;
  window.__YAMANOS_VERSION__ = VERSION;
  window.__YAMANOS_BUILD__ = BUILD;
  window.__YAMANOS_ASSET_VERSION__ = ASSET_VERSION;
  applyInitialTheme();
  document.title = `YamanOS ${VERSION}`;

  const bootAssetToken = new URL(import.meta.url).searchParams.get('v');
  if (bootAssetToken && bootAssetToken !== ASSET_VERSION) {
    console.warn(`[Boot] Asset token mismatch: boot.js?v=${bootAssetToken}, expected ${ASSET_VERSION}`);
  }

  const appShell = document.getElementById("app-shell");
  const bootScreen = document.getElementById("boot");

  // Boot sequence uses logStatus() to update status messages on the boot screen.
  // Additional debug modifications should be removed for production.

  const logStatus = (msg) => {
    console.log(`[Boot] ${msg}`);
    if (bootScreen) {
      const statusEl = bootScreen.querySelector('.boot-status') || document.createElement('div');
      statusEl.className = 'boot-status';
      statusEl.style.position = 'absolute';
      statusEl.style.bottom = '20px';
      statusEl.style.width = '100%';
      statusEl.style.textAlign = 'center';
      statusEl.style.color = 'rgba(255,255,255,0.7)';
      statusEl.style.fontSize = '12px';
      statusEl.textContent = msg;
      if (!bootScreen.contains(statusEl)) bootScreen.appendChild(statusEl);
    }
  };

  logStatus(`Starting YamanOS ${VERSION}...`);

  // --- iOS Zoom Block ---
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });

  try {
    // 1. Initialize Kernel
    logStatus("Initializing Kernel...");
    await kernel.boot();
    logStatus("Kernel Booted.");

    // 2. Register Apps
    logStatus("Registering Apps...");
    kernel.processManager.register('settings', SettingsApp);
    kernel.processManager.register('clock', ClockApp);
    kernel.processManager.register('snake', SnakeApp);
    kernel.processManager.register('weather', WeatherApp);
    kernel.processManager.register('memory', MemoryApp);
    kernel.processManager.register('notes', NotesApp);
    kernel.processManager.register('browser', BrowserApp);
    kernel.processManager.register('calculator', CalculatorApp);
    kernel.processManager.register('files', FilesApp);
    kernel.processManager.register('tictactoe', TicTacToeApp);
    kernel.processManager.register('minesweeper', MinesweeperApp);
    kernel.processManager.register('solitaire', SolitaireApp);
    kernel.processManager.register('spider-solitaire', SpiderSolitaireApp);
    kernel.processManager.register('mahjong', MahjongApp);
    kernel.processManager.register('tarneeb', TarneebApp);
    kernel.processManager.register('trix', TrixApp);

    // 3. Mount Shell (Mobile-Only Mode - Works on all devices)
    if (appShell) {
      logStatus("Mounting Shell...");
      // Force mobile mode for consistent experience across all devices
      kernel.state.isMobile = true;
      document.body.classList.add('is-mobile');

      console.log('[Boot] Using MobileShell (mobile-only mode)');
      logStatus("Creating MobileShell...");
      const shell = new MobileShell(appShell);
      logStatus("Initializing MobileShell...");
      try {
        shell.init();
        logStatus("Running startup checks...");
        await runBootSmokeCheck(shell);
      } catch (e) {
        console.error('[Boot] MobileShell.init() failed:', e);
        logStatus(`Shell Error: ${e.message}`);
        throw e;
      }
      logStatus(`MobileShell OK (${BUILD})`);
      window.yamanos = { kernel, shell };
    } else {
      console.error('[Boot] Fatal: #app-shell not found');
      throw new Error("#app-shell not found");
    }

    // 4. Reveal App
    logStatus("Revealing App...");
    const appContainer = document.getElementById("app");
    if (appContainer) {
      appContainer.hidden = false;
    }

    // 5. Cleanup Boot Screen
    logStatus("Done.");
    if (bootScreen) {
      bootScreen.style.transition = 'opacity 0.8s ease-out';
      bootScreen.style.opacity = '0';
      setTimeout(() => bootScreen.remove(), 800);
    }

  } catch (e) {
    console.error('[Boot] Fatal Error:', e);
    if (bootScreen) {
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bootScreen.innerHTML = `<div style="color:red; padding:20px; text-align:center; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.8); border-radius:8px;">
                <h2>System Failure</h2>
                <p>${esc(e.message)}</p>
                <small>${esc(e.stack)}</small>
            </div>`;
    }
  }
}

// Start the engine
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}