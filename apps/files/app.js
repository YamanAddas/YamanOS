// apps/files/app.js
// v0.4 Compatible - Uses new 'withTx' API
import { withTx, STORES } from '../../os/storage/db.js';
import { executeCommand } from '../../os/core/commander.js';

export async function mount(container) {
  container.innerHTML = '<div style="padding:20px; color:white;">Loading files...</div>';
  
  try {
    // NEW v0.4 DATA FETCHING
    const files = await withTx(STORES.FS_ENTRIES, 'readonly', async (tx, stores) => {
      return new Promise((resolve) => {
        const req = stores[STORES.FS_ENTRIES].getAll();
        req.onsuccess = () => resolve(req.result);
      });
    });

    if (!files || files.length === 0) {
      container.innerHTML = '<div style="padding:20px; opacity:0.6; color:white;">Disk is empty.</div>';
      return;
    }

    container.innerHTML = `
      <div style="padding:20px; display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:15px;">
        ${files.map(f => `
          <div class="file-item" data-name="${f.name}" style="text-align:center; cursor:pointer;">
            <div style="font-size:32px; margin-bottom:8px;">${f.kind === 'folder' ? '📁' : '📄'}</div>
            <div style="font-size:12px; opacity:0.8; word-break:break-word;">${f.name}</div>
          </div>
        `).join('')}
      </div>
    `;

    // Add click listeners to open files via the Command System
    container.querySelectorAll('.file-item').forEach(el => {
      el.onclick = () => executeCommand(`open ${el.dataset.name}`);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div style="padding:20px; color:#ff6b6b;">Error loading files:<br>${err.message}</div>`;
  }
}