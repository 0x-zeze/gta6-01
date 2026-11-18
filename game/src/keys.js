// Solstice City — keyboard + mouse. Tracks held keys, the mouse position in screen
// space, clicks, and edge-triggered presses (used once, then cleared each frame).
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
  };

  const keyName = (e) => e.key.toLowerCase();

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
      const r = canvas.getBoundingClientRect();
      input.mouseX = e.clientX - r.left;
      input.mouseY = e.clientY - r.top;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.down = (k) => input.keys.has(k);
  input.wasPressed = (k) => input.pressed.has(k);
  input.endFrame = () => {
    input.pressed.clear();
    input.clicked = false;
  };
  return input;
}
