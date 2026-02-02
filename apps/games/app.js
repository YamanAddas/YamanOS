// apps/games/app.js
export async function mount(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:white;">
      <div style="font-size:40px; margin-bottom:20px;">🎮</div>
      <div style="font-size:18px;">Games Library</div>
      <div style="opacity:0.6; margin-top:10px;">Coming Soon in Phase 6</div>
    </div>
  `;
}