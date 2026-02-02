import { el } from '../../os/utils/dom.js';
import { fileGet, filePut, fileAll } from '../../os/storage/db.js';
import { toast } from '../../os/shell/toast.js';

function now(){ return Date.now(); }
let saveTimer=null;

export async function mount(root, { shell, params }){
  root.innerHTML='';
  const fileId = params?.fileId || null;

  if(fileId){
    return mountEditor(root, { shell, fileId });
  }
  return mountHome(root, { shell });
}

async function mountHome(root, { shell }){
  const top = el('div',{class:'row'},[
    el('div',{class:'l'},[
      el('div',{class:'a', text:'Notes'}),
      el('div',{class:'b', text:'Notes are stored as files.'})
    ]),
    el('div',{style:'display:flex; gap:8px;'},[
      el('button',{class:'btn primary', text:'New Note', onclick: async()=>{
        const name=prompt('Note title:');
        if(!name) return;
        const id='note_'+crypto.randomUUID();
        await filePut({ id, type:'file', fileType:'note', name, parent:'fld_notes', content:'', created:now(), modified:now() });
        await toast('Created', `Note "${name}" created.`);
        shell.openEntry({kind:'app', id:'notes', params:{ fileId: id }});
      }}),
    ])
  ]);

  const list = el('div',{class:'list'});
  root.append(top, list);

  const all = await fileAll();
  const notes = all.filter(x=>x.type==='file' && x.fileType==='note').sort((a,b)=>b.modified-a.modified);
  for(const n of notes){
    const cell = el('div',{class:'cell'});
    cell.append(
      el('div',{class:'left'},[
        el('img',{src:'./assets/icons/app_notes.png',alt:''}),
        el('div',{class:'name', text:n.name})
      ]),
      el('div',{class:'meta', text:new Date(n.modified||n.created).toLocaleDateString()})
    );
    cell.addEventListener('click', ()=>shell.openEntry({kind:'app', id:'notes', params:{ fileId: n.id }}));
    list.append(cell);
  }
  if(notes.length===0){
    list.append(el('div',{class:'row'},[
      el('div',{class:'l'},[
        el('div',{class:'a', text:'No notes yet'}),
        el('div',{class:'b', text:'Create your first note.'})
      ])
    ]));
  }
}

async function mountEditor(root, { shell, fileId }){
  const note = await fileGet(fileId);
  if(!note){
    root.append(el('div',{class:'row'},[
      el('div',{class:'l'},[
        el('div',{class:'a', text:'Not found'}),
        el('div',{class:'b', text:'This note file does not exist.'})
      ])
    ]));
    return;
  }

  const title = el('input',{class:'input', value: note.name, 'aria-label':'Title'});
  const area = el('textarea',{},[]);
  area.value = note.content || '';

  const top = el('div',{class:'row'},[
    el('div',{class:'l'},[
      el('div',{class:'a', text:'Note'}),
      el('div',{class:'b', text:'Autosaves as you type.'})
    ]),
    el('div',{style:'display:flex; gap:8px;'},[
      el('button',{class:'btn', text:'Back', onclick: ()=>shell.openEntry({kind:'app', id:'notes'})}),
      el('button',{class:'btn danger', text:'Delete', onclick: async()=>{
        if(!confirm(`Delete "${note.name}"?`)) return;
        const db = await import('../../os/storage/db.js');
        await db.fileDel(note.id);
        await toast('Deleted', note.name);
        shell.openEntry({kind:'app', id:'notes'});
      }}),
    ])
  ]);

  const field1 = el('div',{class:'field'},[ el('label',{text:'Title'}), title ]);
  const field2 = el('div',{class:'field'},[ el('label',{text:'Content'}), area ]);
  root.append(top, field1, field2);

  const scheduleSave = ()=>{
    if(saveTimer) clearTimeout(saveTimer);
    saveTimer=setTimeout(async()=>{
      note.name = title.value.trim() || 'Untitled';
      note.content = area.value;
      note.modified = now();
      await filePut(note);
      await toast('Saved', note.name);
    }, 650);
  };

  title.addEventListener('input', scheduleSave);
  area.addEventListener('input', scheduleSave);
}
