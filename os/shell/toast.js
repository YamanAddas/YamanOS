// os/shell/toast.js
// v0.4 Compatible - Visual Only (No DB dependency)

export async function toast(title, message) {
  // 1. Try to find the new v0.4 Surface Toast system
  const surfaceToast = document.getElementById('toast');
  if (surfaceToast) {
    surfaceToast.textContent = `${title}: ${message}`;
    surfaceToast.setAttribute("data-show", "true");
    
    // Auto-hide after 2.5 seconds
    setTimeout(() => {
      surfaceToast.setAttribute("data-show", "false");
    }, 2500);
    return;
  }
  // 2. Fallback console log if HUD isn't ready
  console.log(`[TOAST] ${title}: ${message}`);
}

// Compatibility export so old apps don't crash
export function mountToasts() {}