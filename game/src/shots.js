// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (walk to the nearest car, steal it, drive toward the
// mission marker, and — for the chase — with the heat already on), so every
// frame is what real play looks like and the same seed always gives the same
// frame. window.__shotReady is set by main.js once the scene is painted.
import { STEP } from './config.js';
import { LANDMARKS } from './city.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_WASTED } from './world.js';

const START_SECONDS = 8;
const PLAY_SECONDS = 24;
const CHASE_SECONDS = 12;
const END_LIMIT_SECONDS = 600;

function idleControls() {
  return { moveX: 0, moveY: 0, sprint: false, accel: false, brake: false, steer: 0, firing: false, aimX: 0, aimY: 0, enter: false };
}

/** Drive toward a point: throttle on, steer by the angle to the target. */
function driveControls(world, tx, ty) {
  const player = world.state.player;
  const car = player.inCar;
  const target = Math.atan2(ty - player.y, tx - player.x);
  let diff = target - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const ctl = idleControls();
  ctl.accel = true;
  // diff > 0 means the target is clockwise from the heading; steer -1 (the
  // right key) turns clockwise, steer +1 turns counter-clockwise.
  ctl.steer = diff > 0.15 ? -1 : diff < -0.15 ? 1 : 0;
  return ctl;
}

/** Walk toward a point on foot. */
function walkControls(world, tx, ty) {
  const player = world.state.player;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const len = Math.hypot(dx, dy) || 1;
  const ctl = idleControls();
  ctl.moveX = dx / len;
  ctl.moveY = dy / len;
  ctl.aimX = tx;
  ctl.aimY = ty;
  return ctl;
}

function nearestParked(world) {
  const player = world.state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.state.cars) {
    if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
    const d = (car.x - player.x) ** 2 + (car.y - player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/**
 * Steer the world into the named scene and return the screen to draw over it
 * and the best cash to show. The play and chase scenes steal a car first, so
 * the screenshots show driving, traffic, the wanted level and the mission.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleControls(), true);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'chase' ? CHASE_SECONDS : PLAY_SECONDS;
  let stolen = false;
  let over = false;
  for (let i = 0; i < limit / STEP; i += 1) {
    const player = state.player;
    let ctl;
    if (!player.inCar) {
      const car = nearestParked(world);
      if (car && (car.x - player.x) ** 2 + (car.y - player.y) ** 2 < 70 * 70) {
        ctl = idleControls();
        ctl.enter = true;
        stolen = true;
      } else if (car) {
        ctl = walkControls(world, car.x, car.y);
      } else {
        ctl = idleControls();
      }
    } else {
      // The chase scene runs from the hideout toward downtown, not toward the
      // mission marker, so the car keeps moving with the heat on it.
      const tx = name === 'chase' ? LANDMARKS.downtown.x : (world.missionTarget()?.x ?? LANDMARKS.downtown.x);
      const ty = name === 'chase' ? LANDMARKS.downtown.y : (world.missionTarget()?.y ?? LANDMARKS.downtown.y);
      ctl = driveControls(world, tx, ty);
    }
    if (name === 'chase') {
      // Four stars from the first stolen car on, and the getaway car holds
      // together for the length of the shot.
      state.wanted = 4;
      if (state.player.inCar) state.player.inCar.health = Math.max(state.player.inCar.health, 60);
    }
    const events = world.step(STEP, ctl, false);
    if (events & EVENT_WASTED) {
      over = true;
      break;
    }
    if (name === 'end') {
      // The end scene is a player who keeps driving into trouble until the
      // police take them down: keep the heat maxed and ram the traffic.
      state.wanted = 5;
      if (player.inCar) {
        player.inCar.health -= 0.35;
        if (player.health < 40) player.health = 40;
      } else {
        player.health = Math.min(player.health, 30);
      }
    }
  }
  if (name === 'end' && !over) {
    // Force the wasted screen if the autopilot survived the limit.
    state.player.health = 0;
    world.step(STEP, idleControls(), false);
    over = true;
  }
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: state.cash };
}
