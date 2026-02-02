import { el } from '../utils/dom.js';
import { registry } from '../registry.js';
import { attachPressHandlers } from './press.js';

export class StartMenu{
  constructor({root, onOpenApp, onOpenFolder, onOpenPortal}){
    this.root=root;
    this.onOpenApp=onOpenApp;
    this.onOpenFolder=onOpenFolder;
    this.onOpenPortal=onOpenPortal;

    this.el = el('div',{class:'start-menu', id:'startMenu'});
    this.searchInput = el('input',{placeholder:'Search apps, portals…', 'aria-label':'Search'});
    const top = el('div',{class:'start-top'},[
      el('div',{class:'start-search'},[
        el('span',{text:'🔎'}),
        this.searchInput
      ]),
      el('button',{class:'btn', text:'Close', onclick: ()=>this.hide()})
    ]);
    this.body = el('div',{class:'start-body'});
    this.el.append(top, this.body);
    this.root.append(this.el);

    this.searchInput.addEventListener('input', ()=>this.render(this.searchInput.value));
    this.render('');
  }

  focusSearch(){
    try{ this.searchInput?.focus(); }catch(e){}
  }

  show(){ this.el.style.display='flex'; this.searchInput.focus(); }
  hide(){ this.el.style.display='none'; this.searchInput.value=''; this.render(''); }

  render(query=''){
    const q=query.trim().toLowerCase();
    this.body.innerHTML='';

    const apps = Object.values(registry.apps).filter(a=>a.module); // real apps
    const folders = Object.values(registry.folders);
    const portals = folders.flatMap(f=>f.children.filter(x=>x.type==='portal').map(x=>({...x, _folder:f.id})));

    const match=(t)=> !q || t.toLowerCase().includes(q);

    const appItems=apps.filter(a=>match(a.title));
    const folderItems=folders.filter(f=>match(f.title));
    const portalItems=portals.filter(p=>match(p.title));

    if(appItems.length){
      this.body.append(el('div',{class:'section-title', text:'Apps'}));
      this.body.append(this._grid(appItems.map(a=>({
        title:a.title, icon:a.icon, onTap:()=>this.onOpenApp(a.id)
      }))));
    }

    if(folderItems.length){
      this.body.append(el('div',{class:'section-title', text:'Folders'}));
      this.body.append(this._grid(folderItems.map(f=>({
        title:f.title, icon:f.icon, onTap:()=>this.onOpenFolder(f.id)
      }))));
    }

    if(portalItems.length){
      this.body.append(el('div',{class:'section-title', text:'Portals (open in new tab)'}));
      this.body.append(this._grid(portalItems.map(p=>({
        title:p.title, icon:p.icon, onTap:()=>this.onOpenPortal(p.url, p.title)
      }))));
    }

    if(!appItems.length && !folderItems.length && !portalItems.length){
      this.body.append(el('div',{class:'row'},[
        el('div',{class:'l'},[
          el('div',{class:'a', text:'No results'}),
          el('div',{class:'b', text:'Try a different search.'}),
        ])
      ]));
    }
  }

  _grid(items){
    const g = el('div',{class:'grid-sm'});
    for(const it of items){
      const n = el('div',{class:'item-sm'});
      n.append(el('img',{src: it.icon, alt:''}), el('div',{class:'label', text: it.title}));
      attachPressHandlers(n, { onTap: it.onTap, onLongPress: ()=>{} });
      g.append(n);
    }
    return g;
  }
}
