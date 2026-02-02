import { toast } from '../../os/shell/toast.js';

export async function mount(root) {
  root.innerHTML = '';
  // UI
  const wrapper = document.createElement('div');
  wrapper.style.cssText = "display:flex; flex-direction:column; align-items:center; height:100%; color:white; padding:10px;";
  wrapper.innerHTML = `
    <div style="margin-bottom:10px; font-weight:bold;">SNAKE v0.4</div>
    <canvas id="snakeCanvas" width="400" height="300" style="background:rgba(0,0,0,0.5); border-radius:8px; border:1px solid rgba(255,255,255,0.2); max-width:100%;"></canvas>
    <div style="margin-top:10px; font-size:12px; opacity:0.7;">Use Arrow Keys</div>
  `;
  root.appendChild(wrapper);

  const canvas = wrapper.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const grid = 20;
  let snake = [{x:10, y:10}, {x:9, y:10}];
  let food = {x:15, y:10};
  let dx = 1, dy = 0;
  let running = true;
  let interval = null;

  function loop() {
    if (!running) return;
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Wrap
    if(head.x < 0) head.x = (canvas.width/grid)-1;
    if(head.x >= canvas.width/grid) head.x = 0;
    if(head.y < 0) head.y = (canvas.height/grid)-1;
    if(head.y >= canvas.height/grid) head.y = 0;

    // Self hit
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      running = false;
      toast('Game Over', 'Score: ' + (snake.length-2));
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      food = {
        x: Math.floor(Math.random() * (canvas.width/grid)),
        y: Math.floor(Math.random() * (canvas.height/grid))
      };
    } else {
      snake.pop();
    }

    // Draw
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(food.x*grid, food.y*grid, grid-1, grid-1);
    ctx.fillStyle = '#2ecc71';
    snake.forEach(s => ctx.fillRect(s.x*grid, s.y*grid, grid-1, grid-1));
  }

  const onKey = (e) => {
    if (e.key === 'ArrowUp' && dy === 0) { dx=0; dy=-1; }
    if (e.key === 'ArrowDown' && dy === 0) { dx=0; dy=1; }
    if (e.key === 'ArrowLeft' && dx === 0) { dx=-1; dy=0; }
    if (e.key === 'ArrowRight' && dx === 0) { dx=1; dy=0; }
  };
  window.addEventListener('keydown', onKey);
  interval = setInterval(loop, 100);

  return () => {
    clearInterval(interval);
    window.removeEventListener('keydown', onKey);
  };
}