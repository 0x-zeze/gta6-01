// The game's rules and state, with no drawing and no browser in it: the
// player on foot and in cars, traffic and pedestrians, the police and the
// wanted level, combat, pickups, and the story missions. step() advances one
// fixed step from a controls object and returns what happened as bit flags,
// so the caller can react (sound, announcements) without the world knowing
// about screens. Nothing here allocates after createWorld returns.
import { BULLET, CAR, ENEMY, GRID, MONEY, PEDS, PLAYER, POLICE, ROAD, TRAFFIC, WANTED, WORLD } from './config.js';
import { LANDMARKS, beachZone, buildCity, hitsSolid, inWater, nearestRoad, parkingSpot, resolveSolid } from './city.js';
import { MISSIONS, missionReward } from './missions.js';
import { intBetween, pick } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_SHOT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_STORY = 64;
export const EVENT_CRIME = 128;

const CAR_COLORS = ['#c94a4a', '#4a7ac9', '#4ac97a', '#c9a44a', '#8a4ac9', '#c9c9c9', '#3a3a3a', '#4ac9c9'];
const TAXI_COLOR = '#f2c230';

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > maxStep) return angle + maxStep;
  if (diff < -maxStep) return angle - maxStep;
  return target;
}

export function createWorld(random) {
  const city = buildCity(random);
  const player = {
    x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, angle: 0,
    health: PLAYER.health, armor: PLAYER.armor, inCar: null, speed: 0,
    fireTimer: 0, bustTimer: 0, invulnerable: 0,
  };
  const cars = [];
  const peds = [];
  const bullets = [];
  const particles = [];
  const pickups = [];
  const state = {
    player, cars, peds, bullets, particles, pickups, city,
    cash: MONEY.start, wanted: 0, missionIndex: 0, missionStep: 0,
    missionTime: 0, elapsed: 0, wantedTimer: 0, busts: 0, kills: 0,
    carsStolen: 0, taxi: null, taxiPassenger: null, taxiTimer: 0,
    storyDone: false, message: '', messageTimer: 0, enforcersLeft: 0,
    respect: 0,
  };

  function showMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function addWanted(n, events) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.wantedTimer = 0;
    if (state.wanted > before) return events | EVENT_CRIME;
    return events;
  }

  function makeCar(x, y, angle, kind, color) {
    return {
      x, y, angle, speed: 0, health: CAR.health, kind,
      color: color ?? pick(random, CAR_COLORS),
      driver: kind === 'traffic', wreck: false, horn: 0,
    };
  }

  function makePed(x, y, kind) {
    return {
      x, y, angle: random() * Math.PI * 2, speed: 0,
      health: kind === 'enforcer' ? ENEMY.health : 30,
      kind, color: pick(random, ['#e8e0d0', '#7ab0d8', '#d88ab0', '#a0d88a', '#d8b06a', '#b08ad8']),
      targetX: x, targetY: y, wait: random() * 3, fireTimer: random(),
      flee: false,
    };
  }

  function spawnTrafficCar() {
    const spot = parkingSpot(random);
    const road = nearestRoad(spot.x, spot.y);
    const car = makeCar(spot.x, spot.y, road.axis === 'v' ? 0 : Math.PI / 2, 'traffic');
    car.axis = road.axis;
    car.dir = random() < 0.5 ? 1 : -1;
    car.cruise = TRAFFIC.speed + random() * TRAFFIC.speedJitter;
    car.lane = road.at + (random() < 0.5 ? -1 : 1) * 18;
    cars.push(car);
    return car;
  }

  function spawnParkedCar() {
    const spot = parkingSpot(random);
    const car = makeCar(spot.x, spot.y, spot.angle, 'parked');
    cars.push(car);
    return car;
  }

  function spawnPed() {
    const x = GRID + random() * (WORLD.width - GRID * 2);
    const y = GRID + random() * (WORLD.height - GRID * 2);
    if (hitsSolid(city, x, y, 12) || inWater(x)) return;
    peds.push(makePed(x, y, 'civilian'));
  }

  function spawnPickup(kind, x, y) {
    pickups.push({ kind, x, y, bob: random() * Math.PI * 2 });
  }

  function scatterPickups() {
    for (let i = 0; i < 10; i += 1) {
      const x = GRID + random() * (WORLD.width - GRID * 2);
      const y = GRID + random() * (WORLD.height - GRID * 2);
      if (hitsSolid(city, x, y, 12) || inWater(x)) continue;
      spawnPickup(i % 3 === 0 ? 'health' : i % 3 === 1 ? 'armor' : 'cash', x, y);
    }
  }

  function spawnEnforcers(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const ped = makePed(x + (random() - 0.5) * 260, y + (random() - 0.5) * 260, 'enforcer');
      peds.push(ped);
    }
    state.enforcersLeft = n;
  }

  function spawnPolice() {
    const wantCars = WANTED.cars[state.wanted];
    const wantFoot = WANTED.foot[state.wanted];
    let carsNow = 0;
    let footNow = 0;
    for (const car of cars) if (car.kind === 'police') carsNow += 1;
    for (const ped of peds) if (ped.kind === 'police') footNow += 1;
    const px = player.x;
    const py = player.y;
    while (carsNow < wantCars) {
      const a = random() * Math.PI * 2;
      const car = makeCar(px + Math.cos(a) * 700, py + Math.sin(a) * 700, a, 'police', '#1e3a6e');
      car.cruise = POLICE.carSpeed;
      cars.push(car);
      carsNow += 1;
    }
    while (footNow < wantFoot) {
      const a = random() * Math.PI * 2;
      const ped = makePed(px + Math.cos(a) * 420, py + Math.sin(a) * 420, 'police');
      ped.health = 50;
      peds.push(ped);
      footNow += 1;
    }
  }

  function removePolice() {
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].kind === 'police') cars.splice(i, 1);
    }
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      if (peds[i].kind === 'police') peds.splice(i, 1);
    }
  }

  function explode(x, y, color) {
    for (let i = 0; i < 22; i += 1) {
      const a = random() * Math.PI * 2;
      const s = 60 + random() * 260;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + random() * 0.6, max: 1, color, size: 3 + random() * 5 });
    }
  }

  function shootBullet(x, y, angle, fromPlayer, damage) {
    bullets.push({ x, y, vx: Math.cos(angle) * BULLET.speed, vy: Math.sin(angle) * BULLET.speed, life: BULLET.range / BULLET.speed, fromPlayer, damage });
  }

  function damagePlayer(amount) {
    if (player.invulnerable > 0) return;
    let rest = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, rest);
      player.armor -= absorbed;
      rest -= absorbed;
    }
    player.health -= rest;
    player.invulnerable = 0.25;
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    bullets.length = 0;
    particles.length = 0;
    pickups.length = 0;
    player.x = LANDMARKS.hideout.x;
    player.y = LANDMARKS.hideout.y;
    player.angle = 0;
    player.health = PLAYER.health;
    player.armor = PLAYER.armor;
    player.inCar = null;
    player.speed = 0;
    player.fireTimer = 0;
    player.bustTimer = 0;
    player.invulnerable = 0;
    state.cash = MONEY.start;
    state.wanted = 0;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionTime = 0;
    state.elapsed = 0;
    state.wantedTimer = 0;
    state.busts = 0;
    state.kills = 0;
    state.carsStolen = 0;
    state.taxi = null;
    state.taxiPassenger = null;
    state.taxiTimer = 0;
    state.storyDone = false;
    state.enforcersLeft = 0;
    state.respect = 0;
    showMessage('Mission 1: First Wheels — steal a car for Rico', 6);
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < 8; i += 1) spawnParkedCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed();
    scatterPickups();
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      if (car.wreck) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(events) {
    const car = nearestCar(player.x, player.y, 70);
    if (!car) return events;
    if (car.kind === 'traffic' && car.driver) {
      car.driver = false;
      const driver = makePed(car.x + 40, car.y + 40, 'civilian');
      driver.flee = true;
      peds.push(driver);
      state.carsStolen += 1;
      events = addWanted(1, events);
      showMessage('Car stolen! The heat is on.', 3);
    } else if (car.kind === 'parked') {
      state.carsStolen += 1;
      events = addWanted(1, events);
      showMessage('Car stolen! The heat is on.', 3);
    } else if (car.kind === 'police') {
      events = addWanted(2, events);
    }
    car.kind = 'player';
    player.inCar = car;
    player.speed = 0;
    return events;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    player.inCar = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    resolveSolid(city, player, PLAYER.radius);
  }

  function missionTarget() {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return null;
    return mission.steps[state.missionStep] ?? null;
  }

  function advanceMission(events) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return events;
    state.missionStep += 1;
    if (state.missionStep >= mission.steps.length) {
      const reward = missionReward(state.missionIndex);
      state.cash += reward;
      state.respect += 20;
      events |= EVENT_MISSION;
      state.missionIndex += 1;
      state.missionStep = 0;
      if (state.missionIndex >= MISSIONS.length) {
        state.storyDone = true;
        showMessage('THE BIG SCORE — complete! Vice Shores is yours, Kai.', 8);
        return events | EVENT_STORY;
      }
      const next = MISSIONS[state.missionIndex];
      showMessage(`Mission ${next.id}: ${next.title} — ${next.brief}`, 7);
    } else {
      showMessage(mission.steps[state.missionStep].text, 5);
    }
    return events;
  }

  function stepMission(dt, events) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission || state.storyDone) return events;
    const step = mission.steps[state.missionStep];
    if (!step) return events;
    state.missionTime += dt;
    const d = Math.sqrt(dist2(player.x, player.y, step.x, step.y));
    if (step.kind === 'steal') {
      if (player.inCar) return advanceMission(events);
    } else if (step.kind === 'drive' || step.kind === 'deliver' || step.kind === 'pickup') {
      if (d < 90) {
        if (step.kind === 'pickup') {
          state.cash += 50;
          showMessage('Package grabbed. +$50', 3);
        }
        return advanceMission(events);
      }
    } else if (step.kind === 'fight') {
      if (state.enforcersLeft <= 0) return advanceMission(events);
    } else if (step.kind === 'escape') {
      if (d < 110 && state.wanted >= 2) return advanceMission(events);
      if (d < 110 && state.wanted < 2) showMessage('You need heat on you to finish this — cause some trouble first!', 2);
    }
    return events;
  }

  function stepPlayer(dt, ctl, events) {
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    const car = player.inCar;
    if (car) {
      // Arcade car physics: throttle, steering that bites harder at speed, grip.
      const throttle = ctl.accel ? 1 : ctl.brake ? -1 : 0;
      if (throttle > 0) car.speed += CAR.accel * dt;
      else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.7) * dt;
      else car.speed *= Math.max(0, 1 - 0.9 * dt);
      if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
      if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
      const steerAmount = ctl.steer * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
      // Angles grow clockwise on screen (y grows downward), so the left key
      // (steer +1) turns the car counter-clockwise: subtract while moving forward.
      car.angle += (car.speed >= 0 ? -steerAmount : steerAmount);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = hitsSolid(city, nx, ny, CAR.length / 2);
      if (hit) {
        car.speed *= -0.25;
        car.health -= Math.abs(car.speed) * 0.02 + 2;
        car.x += Math.cos(car.angle) * car.speed * dt * 0.2;
        car.y += Math.sin(car.angle) * car.speed * dt * 0.2;
      } else {
        car.x = nx;
        car.y = ny;
      }
      car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
      car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      // Ramming pedestrians and traffic hurts — and the law notices.
      for (const ped of peds) {
        if (ped.kind === 'civilian' && dist2(car.x, car.y, ped.x, ped.y) < 34 * 34 && Math.abs(car.speed) > 120) {
          ped.health = 0;
          events = addWanted(1, events);
        }
      }
      if (car.health <= 0 && !car.wreck) {
        car.wreck = true;
        explode(car.x, car.y, '#ff7a2a');
        exitCar();
        damagePlayer(25);
        events |= EVENT_HIT;
      }
      return events;
    }

    // On foot: WASD movement, sprint, aim with the mouse, shoot with click/Space.
    const speed = ctl.sprint ? PLAYER.sprint : PLAYER.walk;
    const len = Math.hypot(ctl.moveX, ctl.moveY) || 1;
    const nx = player.x + (ctl.moveX / len) * speed * dt * (ctl.moveX || ctl.moveY ? 1 : 0);
    const ny = player.y + (ctl.moveY / len) * speed * dt * (ctl.moveX || ctl.moveY ? 1 : 0);
    if (!hitsSolid(city, nx, player.y, PLAYER.radius) && !inWater(nx)) player.x = nx;
    if (!hitsSolid(city, player.x, ny, PLAYER.radius) && !inWater(player.x)) player.y = ny;
    player.x = Math.max(30, Math.min(WORLD.width - 30, player.x));
    player.y = Math.max(30, Math.min(WORLD.height - 30, player.y));
    player.angle = angleTo(player.x, player.y, ctl.aimX, ctl.aimY);
    player.speed = (ctl.moveX || ctl.moveY) ? speed : 0;
    if (ctl.firing && player.fireTimer <= 0) {
      player.fireTimer = BULLET.fireRate;
      shootBullet(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20, player.angle, true, BULLET.damage);
      events |= EVENT_SHOT;
      events = addWanted(0, events);
    }
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      // Slow for the car ahead on the same lane.
      let cruise = car.cruise;
      for (const other of cars) {
        if (other === car || other.kind === 'player') continue;
        if (dist2(car.x, car.y, other.x, other.y) < 70 * 70) cruise = Math.min(cruise, 40);
      }
      car.speed += (cruise - car.speed) * Math.min(1, dt * 1.5);
      const laneOffset = car.axis === 'v' ? car.lane - car.x : car.lane - car.y;
      if (car.axis === 'v') {
        car.y += car.dir * car.speed * dt;
        car.x += laneOffset * Math.min(1, dt * 2);
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const nextGrid = Math.round(car.y / GRID) * GRID;
        if (Math.abs(car.y - nextGrid) < car.speed * dt + 2 && Math.abs(car.y - nextGrid) > 1 && random() < 0.3) {
          car.axis = 'h';
          car.dir = random() < 0.5 ? 1 : -1;
          car.lane = nextGrid + (random() < 0.5 ? -1 : 1) * 18;
          car.y = nextGrid;
        }
        if (car.y < 60 || car.y > WORLD.height - 60) {
          car.y = car.y < 60 ? WORLD.height - 80 : 80;
          car.x = parkingSpot(random).x;
          const road = nearestRoad(car.x, car.y);
          car.axis = road.axis;
          car.lane = road.at;
        }
      } else {
        car.x += car.dir * car.speed * dt;
        car.y += laneOffset * Math.min(1, dt * 2);
        car.angle = car.dir > 0 ? 0 : Math.PI;
        const nextGrid = Math.round(car.x / GRID) * GRID;
        if (Math.abs(car.x - nextGrid) < car.speed * dt + 2 && Math.abs(car.x - nextGrid) > 1 && random() < 0.3) {
          car.axis = 'v';
          car.dir = random() < 0.5 ? 1 : -1;
          car.lane = nextGrid + (random() < 0.5 ? -1 : 1) * 18;
          car.x = nextGrid;
        }
        if (car.x < 60 || car.x > WORLD.width - 60) {
          car.x = car.x < 60 ? WORLD.width - 80 : 80;
          car.y = parkingSpot(random).y;
          const road = nearestRoad(car.x, car.y);
          car.axis = road.axis;
          car.lane = road.at;
        }
      }
    }
  }

  function stepPeds(dt, events) {
    for (const ped of peds) {
      if (ped.health <= 0) continue;
      const dPlayer = Math.sqrt(dist2(ped.x, ped.y, player.x, player.y));
      if (ped.kind === 'enforcer') {
        // Enforcers hold the docks and shoot at the player in range.
        ped.angle = angleTo(ped.x, ped.y, player.x, player.y);
        ped.fireTimer -= dt;
        if (dPlayer < ENEMY.range && ped.fireTimer <= 0) {
          ped.fireTimer = ENEMY.fireRate + random() * 0.5;
          shootBullet(ped.x, ped.y, ped.angle + (random() - 0.5) * 0.2, false, ENEMY.damage);
          events |= EVENT_SHOT;
        }
        if (dPlayer < 240) {
          ped.x += Math.cos(ped.angle) * 60 * dt;
          ped.y += Math.sin(ped.angle) * 60 * dt;
          resolveSolid(city, ped, 12);
        }
        continue;
      }
      if (ped.kind === 'police') {
        // Foot officers chase and try to bust the player.
        ped.angle = angleTo(ped.x, ped.y, player.x, player.y);
        if (dPlayer < 700) {
          ped.x += Math.cos(ped.angle) * POLICE.footSpeed * dt;
          ped.y += Math.sin(ped.angle) * POLICE.footSpeed * dt;
          resolveSolid(city, ped, 12);
        }
        continue;
      }
      // Civilians: wander, flee gunfire, wait at the kerb.
      if (ped.flee || (state.wanted > 0 && dPlayer < 260)) {
        const away = angleTo(player.x, player.y, ped.x, ped.y);
        ped.x += Math.cos(away) * 130 * dt;
        ped.y += Math.sin(away) * 130 * dt;
        ped.angle = away;
        resolveSolid(city, ped, 12);
        continue;
      }
      ped.wait -= dt;
      if (ped.wait <= 0) {
        ped.targetX = ped.x + (random() - 0.5) * 320;
        ped.targetY = ped.y + (random() - 0.5) * 320;
        ped.targetX = Math.max(140, Math.min(WORLD.width - 40, ped.targetX));
        ped.targetY = Math.max(40, Math.min(WORLD.height - 40, ped.targetY));
        ped.wait = 2 + random() * 4;
      }
      const dTarget = Math.sqrt(dist2(ped.x, ped.y, ped.targetX, ped.targetY));
      if (dTarget > 12) {
        ped.angle = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
        const sp = PEDS.speed + random() * 4;
        ped.x += Math.cos(ped.angle) * sp * dt;
        ped.y += Math.sin(ped.angle) * sp * dt;
        resolveSolid(city, ped, 12);
      }
    }
    // Remove the dead, count the kill.
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      if (peds[i].health > 0) continue;
      const dead = peds[i];
      if (dead.kind === 'enforcer') state.enforcersLeft = Math.max(0, state.enforcersLeft - 1);
      if (dead.kind === 'civilian') {
        state.kills += 1;
        events = addWanted(1, events);
        if (random() < 0.6) spawnPickup('cash', dead.x, dead.y);
      }
      if (dead.kind === 'police') {
        state.kills += 1;
        events = addWanted(1, events);
      }
      explode(dead.x, dead.y, '#e5534b');
      peds.splice(i, 1);
    }
    return events;
  }

  function stepPolice(dt, events) {
    spawnPolice();
    for (const car of cars) {
      if (car.kind !== 'police') continue;
      const target = angleTo(car.x, car.y, player.x, player.y);
      car.angle = turnToward(car.angle, target, 2.4 * dt);
      car.speed += (POLICE.carSpeed - car.speed) * Math.min(1, dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!hitsSolid(city, nx, ny, CAR.length / 2)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.angle += 0.6;
        car.speed *= 0.5;
      }
      // Ramming the player's car damages it; ramming the player on foot busts them.
      if (player.inCar && dist2(car.x, car.y, player.x, player.y) < 60 * 60) {
        player.inCar.health -= 30 * dt;
        car.speed *= 0.98;
      }
    }
    if (state.wanted > 0 && !player.inCar) {
      let near = false;
      for (const ped of peds) {
        if (ped.kind === 'police' && dist2(ped.x, ped.y, player.x, player.y) < 46 * 46) near = true;
      }
      for (const car of cars) {
        if (car.kind === 'police' && dist2(car.x, car.y, player.x, player.y) < 60 * 60) near = true;
      }
      if (near) {
        player.bustTimer += dt;
        if (player.bustTimer > POLICE.bustTime) {
          state.busts += 1;
          state.wanted = 0;
          state.cash = Math.max(0, state.cash - 150);
          player.bustTimer = 0;
          removePolice();
          player.x = LANDMARKS.hideout.x;
          player.y = LANDMARKS.hideout.y;
          if (player.inCar) {
            player.inCar.kind = 'parked';
            player.inCar = null;
          }
          showMessage('BUSTED! The precinct took $150. Back at the hideout.', 5);
          return events | EVENT_BUSTED;
        }
      } else {
        player.bustTimer = Math.max(0, player.bustTimer - dt * 2);
      }
    }
    return events;
  }

  function stepBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!dead && hitsSolid(city, b.x, b.y, 2)) dead = true;
      if (!dead) {
        for (const ped of peds) {
          if (ped.health <= 0) continue;
          if (b.fromPlayer && dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
            ped.health -= b.damage;
            dead = true;
            break;
          }
          if (!b.fromPlayer && dist2(b.x, b.y, player.x, player.y) < 16 * 16 && !player.inCar) {
            damagePlayer(b.damage);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.fromPlayer) {
        for (const car of cars) {
          if (car.kind === 'player' || car.wreck) continue;
          if (dist2(b.x, b.y, car.x, car.y) < 30 * 30) {
            car.health -= b.damage;
            if (car.health <= 0) {
              car.wreck = true;
              explode(car.x, car.y, '#ff7a2a');
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead && !b.fromPlayer && player.inCar) {
        const car = player.inCar;
        if (dist2(b.x, b.y, car.x, car.y) < 30 * 30) {
          car.health -= b.damage * 0.5;
          dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function stepPickups(dt, events) {
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      pk.bob += dt * 3;
      if (dist2(player.x, player.y, pk.x, pk.y) < 34 * 34) {
        if (pk.kind === 'cash') {
          state.cash += MONEY.pickup;
          showMessage(`+$${MONEY.pickup} cash`, 2);
        } else if (pk.kind === 'health') {
          player.health = Math.min(PLAYER.health, player.health + 40);
          showMessage('Health +40', 2);
        } else {
          player.armor = Math.min(PLAYER.armor, player.armor + 25);
          showMessage('Armor +25', 2);
        }
        pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepTaxi(dt, events) {
    // A taxi fare appears once the first mission is done; a flagged pedestrian
    // waits by the road until the player drives up in a car.
    if (!state.taxi && state.missionIndex >= 1 && !state.storyDone) {
      if (random() < dt * 0.02) {
        const spot = parkingSpot(random);
        const dest = parkingSpot(random);
        state.taxi = { x: spot.x, y: spot.y, dx: dest.x, dy: dest.y, fare: MONEY.taxiFare };
        const ped = makePed(spot.x, spot.y, 'civilian');
        ped.wait = 999;
        ped.targetX = spot.x;
        ped.targetY = spot.y;
        state.taxiPassenger = ped;
        peds.push(ped);
        showMessage('Taxi fare waiting — drive up to the passenger.', 4);
      }
      return events;
    }
    if (!state.taxi) return events;
    const taxi = state.taxi;
    if (state.taxiPassenger) {
      if (player.inCar && dist2(player.x, player.y, taxi.x, taxi.y) < 80 * 80) {
        state.taxiPassenger = null;
        for (let i = peds.length - 1; i >= 0; i -= 1) {
          if (peds[i].wait === 999) peds.splice(i, 1);
        }
        state.taxiTimer = 0;
        showMessage('Passenger aboard — get them to the marker, fast.', 4);
      }
      return events;
    }
    state.taxiTimer += dt;
    if (dist2(player.x, player.y, taxi.dx, taxi.dy) < 90 * 90) {
      state.cash += taxi.fare;
      showMessage(`Taxi fare paid: +$${taxi.fare}`, 4);
      state.taxi = null;
      events |= EVENT_PICKUP;
    } else if (state.taxiTimer > 90) {
      showMessage('Taxi fare gave up waiting.', 3);
      state.taxi = null;
    }
    return events;
  }

  /**
   * One fixed step. `ctl` carries the player's input; with `harmless` set the
   * title screen's backdrop runs (traffic and pedestrians move, nobody shoots
   * and nothing scores). Returns EVENT_* flags.
   */
  function step(dt, ctl, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    if (ctl.enter) {
      if (player.inCar) exitCar();
      else events = enterCar(events);
    }
    events = stepPlayer(dt, ctl, events);
    stepTraffic(dt);
    events = stepPeds(dt, events);
    if (!harmless) {
      events = stepPolice(dt, events);
      events = stepPickups(dt, events);
      events = stepTaxi(dt, events);
      // Mission 3's enforcers appear when the player reaches the docks.
      const mission = MISSIONS[state.missionIndex];
      if (mission && mission.id === 3 && state.missionStep === 1) {
        let anyEnforcer = false;
        for (const ped of peds) if (ped.kind === 'enforcer' && ped.health > 0) anyEnforcer = true;
        if (!anyEnforcer && state.enforcersLeft === 0) spawnEnforcers(LANDMARKS.docks.x, LANDMARKS.docks.y, 4);
      }
      // Mission 4 starts with the heat already on.
      if (mission && mission.id === 4 && state.missionStep === 0 && state.wanted < 3) {
        state.wanted = 3;
        showMessage('Three stars! Lose them at the hideout — or just get there.', 5);
      }
      events = stepMission(dt, events);
      // Wanted heat cools off when the player stays clean and out of sight.
      if (state.wanted > 0) {
        let seen = false;
        for (const car of cars) if (car.kind === 'police' && dist2(car.x, car.y, player.x, player.y) < 500 * 500) seen = true;
        for (const ped of peds) if (ped.kind === 'police' && dist2(ped.x, ped.y, player.x, player.y) < 400 * 400) seen = true;
        if (!seen) {
          state.wantedTimer += dt;
          if (state.wantedTimer > WANTED.decaySeconds) {
            state.wanted -= 1;
            state.wantedTimer = 0;
            if (state.wanted === 0) removePolice();
          }
        } else {
          state.wantedTimer = 0;
        }
      }
      if (player.health <= 0) {
        state.busts += 1;
        player.health = PLAYER.health;
        player.armor = PLAYER.armor;
        state.wanted = 0;
        removePolice();
        if (player.inCar) {
          player.inCar.kind = 'parked';
          player.inCar = null;
        }
        player.x = LANDMARKS.hospital.x;
        player.y = LANDMARKS.hospital.y;
        showMessage('WASTED! You wake up at Shores General. The story goes on.', 5);
        return events | EVENT_WASTED;
      }
    }
    stepBullets(dt);
    return events;
  }

  /** A snapshot for the save file: cash, story progress, position, health. */
  function getSave() {
    return {
      cash: state.cash,
      missionIndex: state.missionIndex,
      missionStep: state.missionStep,
      x: player.x,
      y: player.y,
      health: player.health,
      armor: player.armor,
      wanted: state.wanted,
      carsStolen: state.carsStolen,
      kills: state.kills,
      respect: state.respect,
    };
  }

  function applySave(save) {
    reset();
    state.cash = save.cash ?? MONEY.start;
    state.missionIndex = Math.min(save.missionIndex ?? 0, MISSIONS.length - 1);
    state.missionStep = save.missionStep ?? 0;
    player.x = save.x ?? LANDMARKS.hideout.x;
    player.y = save.y ?? LANDMARKS.hideout.y;
    player.health = save.health ?? PLAYER.health;
    player.armor = save.armor ?? PLAYER.armor;
    state.wanted = save.wanted ?? 0;
    state.carsStolen = save.carsStolen ?? 0;
    state.kills = save.kills ?? 0;
    state.respect = save.respect ?? 0;
    const mission = MISSIONS[state.missionIndex];
    if (mission) showMessage(`Mission ${mission.id}: ${mission.title} — ${mission.brief}`, 7);
  }

  reset();
  return { state, reset, step, missionTarget, getSave, applySave, showMessage };
}
