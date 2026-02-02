import { el } from '../utils/dom.js';
import { attachPressHandlers } from './press.js';
import { kvGet, kvSet } from '../storage/db.js';
import { toast } from './toast.js';

const DEFAULT_DESKTOP = [
  { kind:'app', id:'files', title:'Files', icon:'./assets/icons/app_files.png' },
  { kind:'app', id:'notes', title:'Notes', icon:'./assets/icons/app_notes.png' },
  { kind:'folder', id:'ai', title:'AI', icon:'./assets/icons/folder_ai.png' },
  { kind:'folder', id:'social', title:'Social', icon:'./assets/icons/folder_social.png' },
  { kind:'folder', id:'games', title:'Games', icon:'./assets/icons/folder_games.png' },
  { kind:'app', id:'paint', title:'Paint', icon:'./assets/icons/app_paint.png' },
  { kind:'app', id:'settings', title:'Settings', icon:'./assets/icons/app_settings.png' },
];

export class Desktop{
  constructor({root, registry, onOpenEntry, contextMenu}){
    this.root=root;
    this.registry=registry;
    this.onOpenEntry=onOpenEntry;
    this.contextMenu=contextMenu;
    this.editMode=false;

    this.el = el('div',{class:'desktop'});
    this.grid = el('div',{class:'desktop-grid'});
    this.el.append(this.grid);
    this.root.append(this.el);
  }

  async init(){
    let stored=null;
    try{ stored = await kvGet('desktop.items'); }catch(e){ stored=null; }
    const layout = (Array.isArray(stored) && stored.length>0) ? stored : DEFAULT_DESKTOP;
    this.items = Array.isArray(layout) ? layout.slice() : DEFAULT_DESKTOP.slice();

    // Save only if we healed or first-run
    if(!(Array.isArray(stored) && stored.length>0)){
      try{ await kvSet('desktop.items', this.items); }catch(e){ /* ignore */ }
    }

    const edit = await kvGet('desktop.editMode');
    this.editMode = !!edit;
    this.render();
  }

  async setEditMode(on){
    this.editMode = !!on;
    await kvSet('desktop.editMode', this.editMode);
    this.render();
    await toast(this.editMode ? 'Edit Mode' : 'Edit Mode Off', this.editMode ? 'Drag icons to reorder.' : 'Desktop locked.');
  }

  render(){
    if(!Array.isArray(this.items) || this.items.length===0){
      this.items = DEFAULT_DESKTOP.slice();
      this._save().catch(()=>{});
    }
    this.grid.innerHTML='';
    this.grid.dataset.edit = this.editMode ? '1' : '0';
    for(let idx=0; idx<this.items.length; idx++){
      const it=this.items[idx];
      const icon = el('div',{class:'icon' + (this.editMode ? ' editable':''), 'data-idx': String(idx)});
      const imgWrap = el('div',{class:'icon-img'},[
        el('img',{src: it.icon, alt:''})
      ]);
      const label = el('div',{class:'icon-label', text: it.title});
      icon.append(imgWrap, label);

      attachPressHandlers(icon, {
        onTap: ()=> { if(!this.editMode) this.onOpenEntry(it); },
        onLongPress: (e)=> this._openContextForIcon(e, idx),
      });

      if(this.editMode){
        this._attachDrag(icon);
      }
      this.grid.append(icon);
    }

    // last-resort recovery tile if rendering produced nothing
    if(this.grid.children.length===0){
      const tile = el('div',{class:'icon recovery-tile'});
      tile.append(
        el('div',{class:'icon-img'},[el('div',{class:'recovery-dot'})]),
        el('div',{class:'icon-label', text:'Restore Apps'})
      );
      attachPressHandlers(tile, {
        onTap: async()=>{
          this.items = DEFAULT_DESKTOP.slice();
          await this._save().catch(()=>{});
          this.render();
          toast('Desktop restored');
        },
        onLongPress: async(e)=>{
          this.items = DEFAULT_DESKTOP.slice();
          await this._save().catch(()=>{});
          this.render();
          toast('Desktop restored');
        }
      });
      this.grid.append(tile);
    }
  }

  _openContextForIcon(e, idx){
    const it=this.items[idx];
    const items=[];
    if(it.kind==='file'){
      items.push({label:'Open', on:()=>this.onOpenEntry(it)});
    } else {
      items.push({label:'Open', on:()=>this.onOpenEntry(it)});
    }
    items.push({label:this.editMode ? 'Disable Edit Mode' : 'Enable Edit Mode', on:()=>this.setEditMode(!this.editMode)});
    if(it.kind==='file'){
      items.push({label:'Rename', on:async()=>{
        const name=prompt('Rename to:', it.title);
        if(!name) return;
        it.title=name;
        await this._save();
        this.render();
      }});
      items.push({label:'Delete', hint:'Remove from desktop', on:async()=>{
        this.items.splice(idx,1);
        await this._save();
        this.render();
      }});
    }
    this.contextMenu.show(e.clientX, e.clientY, items);
  }


  _openContextForEntry(pos, entry){
    const items = [
      { label:'Open', on: ()=>this.onOpenEntry(entry) },
      { label:'Remove from Desktop', on: async()=>{
        this.items = this.items.filter(x=>x!==entry);
        await this._save().catch(()=>{});
        this.render();
      }}
    ];
    this.contextMenu.show(pos, items);
  }

  _attachDrag(node){
    let startIdx=null;
    node.draggable=true;
    node.addEventListener('dragstart',(e)=>{
      startIdx = Number(node.dataset.idx);
      e.dataTransfer.setData('text/plain', String(startIdx));
      e.dataTransfer.effectAllowed='move';
    });
    node.addEventListener('dragover',(e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
    });
    node.addEventListener('drop', async(e)=>{
      e.preventDefault();
      const from=Number(e.dataTransfer.getData('text/plain'));
      const to=Number(node.dataset.idx);
      if(Number.isNaN(from)||Number.isNaN(to)||from===to) return;
      const moved=this.items.splice(from,1)[0];
      this.items.splice(to,0,moved);
      await this._save();
      this.render();
    });
  }

  async _save(){
    await kvSet('desktop.items', this.items);
  }
}
