// Boot and the one loop for Vice Shores: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted/wasted and story-complete. Progress
// (cash, mission, position) saves to localStorage every few seconds and on
// pause, and the title screen offers to continue it.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_STORY, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds between automatic saves while playing. */
const SAVE_EVERY = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best cash then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, hasSave: false, mouse: null });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let wasInCar = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh || !save) {
      world.reset();
      save = null;
    } else {
      world.applySave(save);
    }
    accumulator = 0;
    saveTimer = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Vice Shores. Steal a car for Rico.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    writeSave();
    audio.busted();
    announce(`Busted or wasted. Cash $${world.state.cash}. Best $${best}.`);
  }

  function buildControls() {
    const move = input.move();
    const drive = input.drive();
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x, mouse.y);
    const inCar = !!world.state.player.inCar;
    return {
      moveX: move.x,
      moveY: move.y,
      sprint: input.sprint(),
      accel: drive.accel || (inCar && move.y < 0),
      brake: drive.brake || (inCar && move.y > 0),
      steer: drive.steer,
      firing: input.isFiring() && !inCar,
      aimX: aim.x,
      aimY: aim.y,
      enter: false,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) startGame(screen === SCREEN_OVER ? false : !save);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        writeSave();
        announce('Paused. Progress saved.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (events & (EVENT_BUSTED | EVENT_WASTED)) endGame();
    else if (events & EVENT_STORY) screen = SCREEN_STORY;
  }

  function step() {
    const actions = handleActions();
    const ctl = buildControls();
    if (actions & ACTION_ENTER) ctl.enter = true;
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { ...ctl, firing: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const inCar = !!world.state.player.inCar;
    if (inCar && !wasInCar) audio.enterCar();
    wasInCar = inCar;
    const events = world.step(STEP, ctl, false);
    handleEvents(events);
    audio.engine(inCar ? Math.abs(world.state.player.inCar.speed) / 560 : 0, inCar);
    audio.siren(world.state.wanted > 0);
    saveTimer += STEP;
    if (saveTimer >= SAVE_EVERY) {
      saveTimer = 0;
      writeSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
      if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) {
        accumulator = 0;
        break;
      }
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) {
      handleActions();
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      hasSave: !!save,
      mouse: screen === SCREEN_PLAY ? input.mouse() : null,
    });
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused. Progress saved.');
    }
  });

  announce('Vice Shores. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
