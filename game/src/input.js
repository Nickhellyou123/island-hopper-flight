// Input: keyboard (arrows/WASD pitch and bank, W/S throttle, V camera, P pause,
// M mute, R reset, Enter start) plus pointer drag steering for mouse players.
export function createInput() {
  const keys = new Set();
  const handlers = { start: [], camera: [], pause: [], mute: [], reset: [] };
  let drag = null; // { x, y } last pointer position while dragging

  function on(event, fn) { handlers[event].push(fn); }
  function emit(event) { handlers[event].forEach((fn) => fn()); }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter' || e.code === 'Space') emit('start');
    if (e.code === 'KeyV') emit('camera');
    if (e.code === 'KeyP') emit('pause');
    if (e.code === 'KeyM') emit('mute');
    if (e.code === 'KeyR') emit('reset');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
  });
  window.addEventListener('pointerup', () => { drag = null; });

  /** Read the current control state, in -1..1 for pitch/roll, throttle delta. */
  function read() {
    let pitch = 0, roll = 0, throttle = 0;
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    if (keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('ArrowRight')) roll += 1;
    if (keys.has('KeyW')) throttle += 1;
    if (keys.has('KeyS')) throttle -= 1;
    if (drag) { roll += Math.max(-1, Math.min(1, drag.dx / 60)); pitch -= Math.max(-1, Math.min(1, drag.dy / 60)); }
    return { pitch, roll, throttle, anyKey: keys.size > 0 };
  }

  return { on, read };
}
