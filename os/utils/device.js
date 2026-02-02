export function getDeviceInfo(){
  const w=window.innerWidth, h=window.innerHeight;
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const isPortrait = matchMedia('(orientation: portrait)').matches;
  const isPhone = Math.min(w,h) <= 520; // pragmatic
  const mode = (isTouch && isPhone && isPortrait) ? 'card' : 'window';
  return { w,h,isTouch,isPortrait,isPhone,mode };
}
