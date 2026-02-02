import { fileAll, filePut, kvGet, kvSet } from '../../os/storage/db.js';

function now(){ return Date.now(); }

export async function ensureFileSystem(){
  const seeded = await kvGet('fs.seeded.v1');
  if(seeded) return;

  // Root folders
  const root = { id:'root', type:'folder', name:'', parent:null, created:now(), modified:now() };
  const desktop = { id:'fld_desktop', type:'folder', name:'Desktop', parent:'root', created:now(), modified:now() };
  const docs = { id:'fld_docs', type:'folder', name:'Documents', parent:'root', created:now(), modified:now() };
  const notes = { id:'fld_notes', type:'folder', name:'Notes', parent:'root', created:now(), modified:now() };

  // Sample note
  const sampleNote = { id:'note_welcome', type:'file', fileType:'note', name:'Welcome Note', parent:'fld_notes',
    content:`Welcome to YamanOS v0.3.0\n\n• Tap to open\n• Long-press for actions\n• Use Settings for export/import/reset\n\nPortals always open in a new tab.`, created:now(), modified:now() };

  // Sample shortcut on desktop
  const sampleShortcut = { id:'sc_chatgpt', type:'file', fileType:'shortcut', name:'ChatGPT', parent:'fld_desktop',
    url:'https://chatgpt.com', icon:null, created:now(), modified:now() };

  for(const o of [root, desktop, docs, notes, sampleNote, sampleShortcut]){
    await filePut(o);
  }

  // Ensure desktop has a shortcut icon entry for sample shortcut file (kind:file)
  const d = await kvGet('desktop.items');
  if(Array.isArray(d)){
    d.push({ kind:'file', id:'sc_chatgpt', fileType:'shortcut', title:'ChatGPT', url:'https://chatgpt.com', icon:'./assets/icons/app_browser.png' });
    await kvSet('desktop.items', d);
  }

  await kvSet('fs.seeded.v1', true);
}
