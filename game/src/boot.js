// Solstice City — the boot: builds the world, runs the frame loop, and owns the
// player. On foot the player walks and shoots; in a car the player drives it.
// Everything else (traffic, police, jobs, sound, paint) is a system this file wires.
import { CFG, MONEY } from './settings.js';
import { makeRng, clamp, angleTo, angleDiff } from './rng.js';
import { buildTown } from './town.js';
import { createInput } from './keys.js';
import { loadSave, writeSave } from './store.js';
import { SoundBank } from './sound.js';
import {
  makeCar, spawnTraffic, spawnParked, spawnPeds,
  updateTraffic, updatePeds, updatePolice, updateBullets,
  updateParticles, updateWanted, fireBullet, raiseWanted,
  damageCar, hurtPlayer, spawnSkid,
} from './actors.js';
import { buildJobs, startJob, updateJobs } from './jobs.js';
import { spawnStashes, updatePickups } from './pickups.js';
import { ammoMax, topSpeedMul, updateShop, freshUpgrades } from './shop.js';
import { drawWorld, drawHUD, drawTitle, drawEndCard } from './paint.js';
import { setupShot } from './stage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7) || 7;
const rng = makeRng(seed);
const town = buildTown(rng);
const save = loadSave();
save.gamesPlayed += 1;

const G = {
  town,
  rng,
  save,
  input: createInput(canvas),
  sound: new SoundBank(),
  state: 'title', // title | play | busted | wasted | complete
  viewW: canvas.width,
  viewH: canvas.height,
  time: 0,
  shake: 0,
  flash: '',
  flashTimer: 0,
  hurtFlash: 0,
  stashFound: 0,
  ammoMax: 0,
  wanted: 0,
  wantedTimer: 0,
  lastCrime: '',
  bustTimer: 0,
  godTimer: 0,
  saveDirty: false,
  camera: { x: town.spawn.x, y: town.spawn.y },
  player: {
    x: town.spawn.x, y: town.spawn.y,
    angle: 0, aimAngle: 0,
    hp: CFG.playerHp,
    ammo: CFG.pistolAmmoMax,
    onFoot: true,
    car: null,
    cooldown: 0,
    speed: 0,
  },
  cars: [],
  peds: [],
  cops: [],
  copCars: [],
  bullets: [],
  particles: [],
  pickups: [],
  jobs: null,
  mission: null,
  hotCar: null,
};

G.sound.setMuted(save.muted);
G.ammoMax = ammoMax(G);
G.cars = [...spawnTraffic(town, rng, 20), ...spawnParked(town, rng, 14)];
G.peds = spawnPeds(town, rng, 32);
G.jobs = buildJobs(G);
G.pickups = spawnStashes(G);

// --- player control ----------------------------------------------------------

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (!car.alive || car.driver === 'player') continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  if (car.driver === 'traffic' || car.driver === 'parked') {
    if (car.driver === 'parked' || car.driver === 'traffic') {
      raiseWanted(G, 1, 'car stolen');
      G.flash = 'Car stolen — the heat is on';
      G.flashTimer = 2.5;
    }
  }
  car.driver = 'player';
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = car.x;
  G.player.y = car.y;
  G.sound.pickup();
}

function exitCar() {
  const car = G.player.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  const a = car.angle + Math.PI / 2;
  G.player.x = car.x + Math.cos(a) * 30;
  G.player.y = car.y + Math.sin(a) * 30;
  G.player.car = null;
  G.player.onFoot = true;
}

function updatePlayer(dt) {
  const p = G.player;
  const input = G.input;
  p.cooldown -= dt;
  G.godTimer -= dt;

  // Aim follows the mouse, always.
  const wx = G.camera.x + (input.mouseX - G.viewW / 2);
  const wy = G.camera.y + (input.mouseY - G.viewH / 2);
  p.aimAngle = angleTo(p.x, p.y, wx, wy);

  if (p.car) {
    const car = p.car;
    const auto = G.autoDrive === true;
    const fwd = auto ? 1 : (input.down('w') || input.down('arrowup') ? 1 : 0)
      - (input.down('s') || input.down('arrowdown') ? 0.7 : 0);
    const steer = (input.down('a') || input.down('arrowleft') ? -1 : 0)
      + (input.down('d') || input.down('arrowright') ? 1 : 0);
    const braking = input.down(' ');
    if (fwd > 0) car.speed += CFG.carAccel * fwd * dt;
    else if (fwd < 0) car.speed -= CFG.carReverse * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    if (braking) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CFG.carBrake * dt);
    car.speed = clamp(car.speed, -180, CFG.carTopSpeed * (car.kind === 'sport' ? 1.18 : 1) * topSpeedMul(G));
    const turnRate = CFG.carTurn * (0.4 + 0.6 * Math.min(1, Math.abs(car.speed) / 240));
    car.angle += steer * turnRate * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = town.inBuilding(nx, ny, 20);
    if (hit) {
      if (Math.abs(car.speed) > 200) {
        damageCar(G, car, 18);
        G.sound.crash();
        G.shake = 8;
        hurtPlayer(G, 6, 'crash');
      }
      car.speed *= -0.25;
    } else {
      car.x = nx;
      car.y = ny;
    }
    const edge = town.clampToWorld(car.x, car.y, 30);
    car.x = edge.x;
    car.y = edge.y;
    // Handbrake at speed leaves skid marks on the asphalt.
    if (braking && Math.abs(car.speed) > 200) {
      const bx = car.x - Math.cos(car.angle) * 18;
      const by = car.y - Math.sin(car.angle) * 18;
      const px = Math.cos(car.angle + Math.PI / 2);
      const py = Math.sin(car.angle + Math.PI / 2);
      spawnSkid(G, bx + px * 9, by + py * 9);
      spawnSkid(G, bx - px * 9, by - py * 9);
    }
    // Running over pedestrians is a crime, and it shows.
    for (const ped of G.peds) {
      if (ped.alive && Math.hypot(ped.x - car.x, ped.y - car.y) < 24 && Math.abs(car.speed) > 120) {
        ped.alive = false;
        raiseWanted(G, 1, 'pedestrian hit');
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.speed = car.speed;
    G.sound.engine(true, Math.abs(car.speed) / CFG.carTopSpeed);
    if (input.wasPressed('e')) exitCar();
  } else {
    let mx = (input.down('d') || input.down('arrowright') ? 1 : 0)
      - (input.down('a') || input.down('arrowleft') ? 1 : 0);
    let my = (input.down('s') || input.down('arrowdown') ? 1 : 0)
      - (input.down('w') || input.down('arrowup') ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const sprint = input.down('shift') ? CFG.sprintMul : 1;
    const speed = CFG.walkSpeed * sprint;
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    if (!town.inBuilding(nx, p.y, 11)) p.x = nx;
    if (!town.inBuilding(p.x, ny, 11)) p.y = ny;
    const edge = town.clampToWorld(p.x, p.y, 24);
    p.x = edge.x;
    p.y = edge.y;
    if (len > 0) p.angle = Math.atan2(my, mx);
    p.speed = len * speed;
    G.sound.engine(false, 0);
    if (input.wasPressed('e')) {
      const car = nearestCar(52);
      if (car) enterCar(car);
    }
  }

  // Shooting: mouse held, pistol cooldown, ammo that refills slowly.
  if (input.mouseDown && p.cooldown <= 0 && p.ammo > 0) {
    p.cooldown = CFG.pistolCooldown;
    p.ammo -= 1;
    fireBullet(G, p.x, p.y, p.aimAngle, 780, 'player');
  }
  if (p.ammo < G.ammoMax && Math.random() < dt * 2) p.ammo += 1;

  if (input.wasPressed('m')) {
    save.muted = !save.muted;
    G.sound.setMuted(save.muted);
    G.saveDirty = true;
    G.flash = save.muted ? 'Sound muted' : 'Sound on';
    G.flashTimer = 1.5;
  }
}

// --- camera -------------------------------------------------------------------

function updateCamera(dt) {
  const p = G.player;
  const lookX = p.car ? p.x + Math.cos(p.car.angle) * Math.abs(p.car.speed) * 0.22 : p.x;
  const lookY = p.car ? p.y + Math.sin(p.car.angle) * Math.abs(p.car.speed) * 0.22 : p.y;
  const k = Math.min(1, dt * 4);
  G.camera.x += (lookX - G.camera.x) * k;
  G.camera.y += (lookY - G.camera.y) * k;
}

// --- state flow -----------------------------------------------------------------

function startGame(fresh) {
  if (fresh) {
    save.cash = MONEY.startCash;
    save.missionIndex = 0;
    save.missionsDone = [];
    save.upgrades = freshUpgrades();
    G.ammoMax = ammoMax(G);
    G.pickups = spawnStashes(G);
    G.stashFound = 0;
    G.wanted = 0;
  }
  G.player.hp = CFG.playerHp;
  G.player.ammo = G.ammoMax;
  G.player.x = town.spawn.x;
  G.player.y = town.spawn.y;
  if (G.player.car) {
    G.player.car.driver = 'parked';
    G.player.car = null;
  }
  G.player.onFoot = true;
  G.godTimer = 2;
  G.state = 'play';
  G.sound.ensure();
  if (G.save.missionIndex < G.jobs.length) {
    startJob(G, G.save.missionIndex);
  } else {
    G.flash = 'Free roam — all jobs done';
    G.flashTimer = 3;
  }
  G.saveDirty = true;
}

function resumeAfterEnd() {
  G.player.hp = CFG.playerHp;
  G.player.ammo = G.ammoMax;
  G.player.x = town.hospital.x;
  G.player.y = town.hospital.y;
  if (G.player.car) {
    G.player.car.driver = 'parked';
    G.player.car = null;
  }
  G.player.onFoot = true;
  G.godTimer = 3;
  G.cops = G.cops.filter((c) => !c.alive);
  G.copCars = G.copCars.filter((c) => !c.alive);
  G.cars = G.cars.filter((c) => c.alive);
  G.state = 'play';
  if (G.save.missionIndex < G.jobs.length && !G.mission) startJob(G, G.save.missionIndex);
  G.saveDirty = true;
}

function update(dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 30);
  G.flashTimer = Math.max(0, G.flashTimer - dt);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.2);

  if (G.state === 'title') {
    if (G.input.wasPressed('enter') || G.input.clicked) {
      const fresh = !(save.missionIndex > 0 || save.cash > MONEY.startCash);
      startGame(fresh);
    }
    return;
  }
  if (G.state === 'busted' || G.state === 'wasted' || G.state === 'complete') {
    if (G.input.wasPressed('enter') || G.input.clicked) resumeAfterEnd();
    return;
  }

  updatePlayer(dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);
  updateWanted(G, dt);
  updateJobs(G, dt);
  updatePickups(G, dt);
  updateShop(G);
  updateCamera(dt);

  // Health creeps back when the player is calm and out of trouble.
  if (G.wanted === 0 && G.player.hp < CFG.playerHp && G.player.hp > 0) {
    G.player.hp = Math.min(CFG.playerHp, G.player.hp + dt * 2.5);
  }

  const nearestCop = Math.min(
    ...G.copCars.filter((c) => c.alive).map((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y)),
    9999,
  );
  G.sound.updateSiren(dt, G.wanted, nearestCop);

  if (G.saveDirty) {
    writeSave(save);
    G.saveDirty = false;
  }
  G.input.endFrame();
}

function render() {
  G.viewW = canvas.width;
  G.viewH = canvas.height;
  ctx.clearRect(0, 0, G.viewW, G.viewH);
  if (G.state === 'title') {
    drawTitle(ctx, G);
  } else {
    drawWorld(ctx, G);
    drawHUD(ctx, G);
    if (G.state !== 'play') drawEndCard(ctx, G, G.state);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// Screenshot scenes (?shot=…) set up a staged moment, then flag readiness.
setupShot(G, startGame, params);
window.SOLSTICE = G;
document.getElementById('status').textContent =
  'Solstice City: an open-world crime game. Walk Port Aurora, steal cars, outrun the harbour police and run jobs for the Tide.';
requestAnimationFrame(frame);
