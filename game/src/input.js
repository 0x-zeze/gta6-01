// Keyboard and pointer input for Vice Shores. Held keys give movement and
// driving; one-shot presses (enter a car, start, pause, mute) are queued as
// bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse aims on foot; its screen position
// is converted to world coordinates by the caller.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || SPRINT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    firing = false;
  });
  window.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  function has(keys) {
    for (const code of keys) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector, -1..1 on each axis, from WASD / arrows. */
    move() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    /** Driving: throttle from W/S, steering from A/D, sprint/boost from Shift. */
    drive() {
      return {
        accel: has(UP),
        brake: has(DOWN),
        steer: (has(LEFT) ? 1 : 0) - (has(RIGHT) ? 1 : 0),
        boost: has(SPRINT),
      };
    },
    sprint() {
      return has(SPRINT);
    },
    /** True while the mouse button or Space is held (shooting on foot). */
    isFiring() {
      return firing || has(CONFIRM);
    },
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
