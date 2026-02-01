export const WALLPAPERS = [
  { id: "abstract", name: "Abstract", url: "os/assets/wallpapers/abstract.png" },
  { id: "nature", name: "Nature", url: "os/assets/wallpapers/nature.png" },
  { id: "horror", name: "Horror (original)", url: "os/assets/wallpapers/horror.png" },
];
export const EXTERNAL_APPS = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com", icon: "globe" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com", icon: "globe" },
  { id: "claude", name: "Claude", url: "https://claude.ai", icon: "globe" },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com", icon: "globe" },
  { id: "youtube", name: "YouTube", url: "https://youtube.com", icon: "globe" },
  { id: "facebook", name: "Facebook", url: "https://facebook.com", icon: "globe" },
];
export const NATIVE_APPS = [
  { id: "files", name: "Files", icon: "folder", kind: "native" },
  { id: "notes", name: "Notes", icon: "note", kind: "native" },
  { id: "browser", name: "Browser", icon: "globe", kind: "native" },
  { id: "paint", name: "Paint", icon: "paint", kind: "native" },
  { id: "settings", name: "Settings", icon: "gear", kind: "native" },
  { id: "games", name: "Games", icon: "gamepad", kind: "native" },
];
export function defaultDesktopItems(){
  return [
    { type: "app", appId: "files" },
    { type: "app", appId: "notes" },
    { type: "app", appId: "browser" },
    { type: "app", appId: "paint" },
    { type: "folder", folderId: "ai", name: "AI" },
    { type: "folder", folderId: "social", name: "Social" },
    { type: "app", appId: "games" },
    { type: "app", appId: "settings" },
  ];
}
export function defaultFolders(){
  return {
    ai: { id:"ai", name:"AI", items:[
      {type:"link", name:"ChatGPT", url:"https://chatgpt.com"},
      {type:"link", name:"Gemini", url:"https://gemini.google.com"},
      {type:"link", name:"Claude", url:"https://claude.ai"},
      {type:"link", name:"DeepSeek", url:"https://chat.deepseek.com"},
    ]},
    social: { id:"social", name:"Social", items:[
      {type:"link", name:"YouTube", url:"https://youtube.com"},
      {type:"link", name:"Facebook", url:"https://facebook.com"},
    ]},
  };
}
