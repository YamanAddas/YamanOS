// Registry is the single place to add/remove apps & folders.
// Each entry: {id, type:'app'|'folder'|'portal', title, icon, module?, children?[], url?}

export const registry = {
  apps: {
    start:    { id:'start', type:'app', title:'Start', icon:'./assets/icons/start.png' },
    files:    { id:'files', type:'app', title:'Files', icon:'./assets/icons/app_files.png', module:'../../apps/files/app.js' },
    notes:    { id:'notes', type:'app', title:'Notes', icon:'./assets/icons/app_notes.png', module:'../../apps/notes/app.js' },
    browser:  { id:'browser', type:'app', title:'Browser', icon:'./assets/icons/app_browser.png', module:'../../apps/browser/app.js' },
    settings: { id:'settings', type:'app', title:'Settings', icon:'./assets/icons/app_settings.png', module:'../../apps/settings/app.js' },
    paint:    { id:'paint', type:'app', title:'Paint', icon:'./assets/icons/app_paint.png', module:'../../apps/paint/app.js' },
    mines:    { id:'mines', type:'app', title:'Minesweeper', icon:'./assets/icons/app_mines.png', module:'../../apps/minesweeper/app.js' },
    snake:    { id:'snake', type:'app', title:'Snake', icon:'./assets/icons/app_snake.png', module:'../../apps/snake/app.js' },
  },
  folders: {
    ai: { id:'ai', type:'folder', title:'AI', icon:'./assets/icons/folder_ai.png', children:[
      { id:'portal_chatgpt', type:'portal', title:'ChatGPT', icon:'./assets/icons/app_browser.png', url:'https://chatgpt.com' },
      { id:'portal_gemini', type:'portal', title:'Gemini', icon:'./assets/icons/app_browser.png', url:'https://gemini.google.com' },
      { id:'portal_claude', type:'portal', title:'Claude', icon:'./assets/icons/app_browser.png', url:'https://claude.ai' },
      { id:'portal_deepseek', type:'portal', title:'DeepSeek', icon:'./assets/icons/app_browser.png', url:'https://www.deepseek.com' },
    ]},
    social: { id:'social', type:'folder', title:'Social', icon:'./assets/icons/folder_social.png', children:[
      { id:'portal_facebook', type:'portal', title:'Facebook', icon:'./assets/icons/app_browser.png', url:'https://facebook.com' },
    ]},
    games: { id:'games', type:'folder', title:'Games', icon:'./assets/icons/folder_games.png', children:[
      { id:'mines', type:'appref', ref:'mines' },
      { id:'snake', type:'appref', ref:'snake' },
    ]},
  },
  taskbarPinned: ['start','files','notes','browser','games'],
};
