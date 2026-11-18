// Solstice City — every moving thing: traffic cars that follow the avenues,
// pedestrians on the sidewalks, police cars and foot cops that hunt the player,
// bullets, smoke and explosions, and the wanted system that ties crime to response.
import { CFG, PALETTE } from './settings.js';
import { angleDiff, angleTo, clamp, dist2 } from './rng.js';
import { damageMul } from './shop.js';

let carId = 1;

export function makeCar(kind, x, y, angle, color) {
  return {
    id: carId++,
    kind, // sedan | taxi | sport | van | cop
    x, y, angle,
    speed: 0,
    color: color || PALETTE.carColors[Math.floor(Math.random() * PALETTE.carColors.length)],
    hp: kind === 'van' ? 160 : 110,
    driver: 'parked', // parked | traffic | player | police
    axis: 'h',
    lane: 1,
    targetSpeed: CFG.trafficSpeed,
    turnAt: null,
    alive: true,
    sirenPhase: Math.random() * Math.PI * 2,
    smoke: 0,
  };
}

export function spawnTraffic(town, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = town.randomRoadPoint();
    const vertical = Math.abs(p.x - town.nearestRoad(p.x, p.y).x) < 1;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (rng.chance(0.5) ? 0 : Math.PI);
    const kind = rng.chance(0.12) ? 'taxi' : rng.chance(0.14) ? 'sport' : rng.chance(0.16) ? 'van' : 'sedan';
    const car = makeCar(kind, p.x, p.y, angle, kind === 'taxi' ? PALETTE.taxi : undefined);
    car.driver = 'traffic';
    car.axis = vertical ? 'v' : 'h';
    car.lane = rng.chance(0.5) ? 1 : -1;
    car.targetSpeed = CFG.trafficSpeed * rng.range(0.75, 1.15);
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(town, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 12) {
    const p = town.randomRoadPoint();
    const vertical = rng.chance(0.5);
    const off = CFG.roadWidth / 2 + 12;
    const x = vertical ? p.x + (rng.chance(0.5) ? off : -off) : p.x;
    const y = vertical ? p.y : p.y + (rng.chance(0.5) ? off : -off);
    if (town.inBuilding(x, y, 6) || town.onSand(x, y)) continue;
    const kind = rng.chance(0.1) ? 'sport' : rng.chance(0.2) ? 'van' : 'sedan';
    const car = makeCar(kind, x, y, vertical ? Math.PI / 2 : 0);
    car.driver = 'parked';
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(town, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = town.randomSidewalkPoint();
    peds.push({
      x: p.x, y: p.y,
      angle: rng.range(0, Math.PI * 2),
      speed: CFG.pedSpeed * rng.range(0.7, 1.3),
      shirt: rng.pick(PALETTE.pedShirts),
      hp: 100,
      alive: true,
      hostile: false,
      targetX: p.x, targetY: p.y,
      wait: rng.range(0, 2),
      shootTimer: rng.range(0.5, 1.5),
      flee: 0,
      fleeX: 0, fleeY: 0,
    });
  }
  return peds;
}

// Gunfire and blasts make nearby pedestrians scatter — they run away from
// the noise, not toward it.
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (!ped.alive || ped.hostile) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.flee = 2.5;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

// --- movement helpers -------------------------------------------------------

function collideBuildings(town, obj, radius) {
  const b = town.inBuilding(obj.x, obj.y, radius);
  if (!b) return;
  const cx = clamp(obj.x, b.x, b.x + b.w);
  const cy = clamp(obj.y, b.y, b.y + b.h);
  const dx = obj.x - cx;
  const dy = obj.y - cy;
  const d = Math.hypot(dx, dy) || 0.001;
  const push = radius - d;
  if (push > 0) {
    obj.x += (dx / d) * push;
    obj.y += (dy / d) * push;
  }
}

function roadCentre(town, v) {
  let best = town.lines[0];
  for (const p of town.lines) if (Math.abs(p - v) < Math.abs(best - v)) best = p;
  return best;
}

// Traffic follows the avenue grid: drive along one avenue, and at each crossing
// roll the dice — straight on, or turn onto the cross avenue.
function driveRoad(town, car, dt) {
  const step = car.speed * dt;
  car.x += Math.cos(car.angle) * step;
  car.y += Math.sin(car.angle) * step;
  const cx = roadCentre(town, car.x);
  const cy = roadCentre(town, car.y);
  const onCrossing = Math.abs(car.x - cx) < 26 && Math.abs(car.y - cy) < 26;
  if (onCrossing && !car.turnAt) {
    car.turnAt = { x: cx, y: cy };
    const r = Math.random();
    const cur = Math.round(((car.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4;
    let next = cur;
    if (r < 0.22) next = (cur + 1) % 4;
    else if (r < 0.44) next = (cur + 3) % 4;
    car.angle = next * Math.PI / 2;
    car.axis = next % 2 === 0 ? 'h' : 'v';
  }
  if (car.turnAt && (Math.abs(car.x - car.turnAt.x) > 40 || Math.abs(car.y - car.turnAt.y) > 40)) {
    car.turnAt = null;
  }
  // Keep the car glued to its lane on its avenue.
  const lane = CFG.laneOffset * car.lane;
  if (car.axis === 'h') {
    const target = cy + lane;
    car.y += (target - car.y) * Math.min(1, dt * 4);
  } else {
    const target = cx + lane;
    car.x += (target - car.x) * Math.min(1, dt * 4);
  }
  const edge = town.clampToWorld(car.x, car.y, 60);
  car.x = edge.x;
  car.y = edge.y;
}

function chaseSteer(car, tx, ty, topSpeed, dt) {
  const want = angleTo(car.x, car.y, tx, ty);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -CFG.carTurn * dt, CFG.carTurn * dt);
  const target = Math.abs(diff) > 1.2 ? topSpeed * 0.35 : topSpeed;
  car.speed += clamp(target - car.speed, -CFG.carBrake * dt, CFG.carAccel * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// --- per-frame updates ------------------------------------------------------

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.alive || car.driver !== 'traffic') continue;
    // Slow for the car ahead on the same avenue.
    let blocked = false;
    for (const other of G.cars) {
      if (other === car || !other.alive) continue;
      if (dist2(car.x, car.y, other.x, other.y) < 55 * 55) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0 && ahead < 70) { blocked = true; break; }
      }
    }
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -CFG.carBrake * dt, CFG.carAccel * 0.5 * dt);
    driveRoad(G.town, car, dt);
    collideBuildings(G.town, car, 20);
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      ped.x += Math.cos(away) * CFG.pedSpeed * 2.1 * dt;
      ped.y += Math.sin(away) * CFG.pedSpeed * 2.1 * dt;
    } else if (ped.hostile) {
      const d = Math.hypot(G.player.x - ped.x, G.player.y - ped.y);
      if (d > 260) {
        const a = angleTo(ped.x, ped.y, G.player.x, G.player.y);
        ped.angle = a;
        ped.x += Math.cos(a) * CFG.pedSpeed * 1.9 * dt;
        ped.y += Math.sin(a) * CFG.pedSpeed * 1.9 * dt;
      } else {
        ped.angle = angleTo(ped.x, ped.y, G.player.x, G.player.y);
        ped.shootTimer -= dt;
        if (ped.shootTimer <= 0 && G.state === 'play') {
          ped.shootTimer = 1.1 + Math.random() * 0.7;
          fireBullet(G, ped.x, ped.y, ped.angle + (Math.random() - 0.5) * 0.22, 430, 'rival');
        }
      }
    } else {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        if (Math.hypot(ped.targetX - ped.x, ped.targetY - ped.y) < 24 || Math.random() < 0.02) {
          const p = G.town.randomSidewalkPoint();
          ped.targetX = p.x;
          ped.targetY = p.y;
          ped.wait = Math.random() < 0.3 ? 2 : 0;
        }
        const a = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
    }
    collideBuildings(G.town, ped, 10);
    const edge = G.town.clampToWorld(ped.x, ped.y, 30);
    ped.x = edge.x;
    ped.y = edge.y;
  }
}

export function updatePolice(G, dt) {
  // How many hunters the current wanted level calls for.
  const wantCars = G.wanted >= 1 ? Math.min(G.wanted, 4) : 0;
  const wantFoot = G.wanted >= 2 ? Math.min(G.wanted - 1, 3) : 0;
  const liveCars = G.copCars.filter((c) => c.alive).length;
  const liveFoot = G.cops.filter((c) => c.alive).length;

  if (G.wanted > 0 && liveCars < wantCars && Math.random() < dt * 1.4) {
    const a = Math.random() * Math.PI * 2;
    const x = G.player.x + Math.cos(a) * 720;
    const y = G.player.y + Math.sin(a) * 720;
    const p = G.town.clampToWorld(x, y, 80);
    const car = makeCar('cop', p.x, p.y, angleTo(p.x, p.y, G.player.x, G.player.y), PALETTE.cop);
    car.driver = 'police';
    car.speed = CFG.copCarSpeed * 0.6;
    G.copCars.push(car);
    G.cars.push(car);
  }
  if (G.wanted > 0 && liveFoot < wantFoot && Math.random() < dt * 1.0) {
    const a = Math.random() * Math.PI * 2;
    const cop = {
      x: G.player.x + Math.cos(a) * 320,
      y: G.player.y + Math.sin(a) * 320,
      angle: 0, speed: CFG.copFootSpeed,
      shirt: '#1c3a5e', hp: 100, alive: true, hostile: true,
      targetX: 0, targetY: 0, wait: 0, shootTimer: 1, flee: 0, isCop: true,
    };
    const edge = G.town.clampToWorld(cop.x, cop.y, 30);
    cop.x = edge.x;
    cop.y = edge.y;
    G.cops.push(cop);
  }

  for (const car of G.copCars) {
    if (!car.alive) continue;
    // At five stars the precinct stops holding back: faster interceptors.
    // A car may carry its own topSpeed (the staged chase interceptors do).
    const top = (car.topSpeed || CFG.copCarSpeed) * (G.wanted >= 5 ? 1.08 : 1);
    chaseSteer(car, G.player.x, G.player.y, top, dt);
    car.sirenPhase += dt * 6;
    collideBuildings(G.town, car, 20);
    // Ramming the player's car hurts; ramming the player on foot hurts more.
    const d = Math.hypot(G.player.x - car.x, G.player.y - car.y);
    if (d < 46 && Math.abs(car.speed) > 60) {
      hurtPlayer(G, 12 * dt * 4, 'rammed');
      if (G.player.car) damageCar(G, G.player.car, 26 * dt * 4);
    }
  }

  for (const cop of G.cops) {
    if (!cop.alive) continue;
    const d = Math.hypot(G.player.x - cop.x, G.player.y - cop.y);
    if (d > 240) {
      const a = angleTo(cop.x, cop.y, G.player.x, G.player.y);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
    } else if (G.player.car) {
      cop.angle = angleTo(cop.x, cop.y, G.player.x, G.player.y);
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 1.4;
        fireBullet(G, cop.x, cop.y, cop.angle + (Math.random() - 0.5) * 0.3, 380, 'cop');
      }
    } else {
      // On foot: close in and make the arrest.
      const a = angleTo(cop.x, cop.y, G.player.x, G.player.y);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      if (d < CFG.bustDistance) {
        G.bustTimer += dt;
        if (G.bustTimer > CFG.bustHold) bustPlayer(G);
      }
    }
    collideBuildings(G.town, cop, 10);
  }
  if (!G.cops.some((c) => c.alive && Math.hypot(G.player.x - c.x, G.player.y - c.y) < CFG.bustDistance)) {
    G.bustTimer = 0;
  }
}

// --- combat -----------------------------------------------------------------

export function fireBullet(G, x, y, angle, speed, from) {
  G.bullets.push({
    x: x + Math.cos(angle) * 18,
    y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: CFG.pistolRange / speed,
    from,
  });
  G.sound.shot();
  spawnMuzzle(G, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
  scarePeds(G, x, y, 260);
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (G.town.inBuilding(b.x, b.y, 2)) {
      b.life = 0;
      spawnSparks(G, b.x, b.y);
      continue;
    }
    const hit = (t, radius, onHit) => {
      if (Math.hypot(t.x - b.x, t.y - b.y) < radius) {
        b.life = 0;
        onHit();
        return true;
      }
      return false;
    };
    if (b.from === 'player') {
      for (const ped of G.peds) {
        if (ped.alive && hit(ped, 14, () => killPed(G, ped))) break;
      }
      if (b.life <= 0) continue;
      for (const cop of G.cops) {
        if (cop.alive && hit(cop, 14, () => killCop(G, cop))) break;
      }
      if (b.life <= 0) continue;
      for (const car of G.cars) {
        if (car.alive && car.driver !== 'player' && hit(car, 24, () => damageCar(G, car, CFG.pistolDamage))) break;
      }
    } else {
      hit(G.player, G.player.car ? 26 : 12, () => hurtPlayer(G, 9, 'shot'));
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function killPed(G, ped) {
  ped.alive = false;
  spawnBlood(G, ped.x, ped.y);
  G.sound.thud();
  raiseWanted(G, 1, 'pedestrian down');
  if (G.mission) G.mission.onKill && G.mission.onKill(G, ped.hostile ? 'rival' : 'ped');
}

export function killCop(G, cop) {
  cop.alive = false;
  spawnBlood(G, cop.x, cop.y);
  G.sound.thud();
  raiseWanted(G, 2, 'officer down');
  if (G.mission) G.mission.onKill && G.mission.onKill(G, 'cop');
}

export function damageCar(G, car, amount) {
  if (car.driver === 'player') amount *= damageMul(G);
  car.hp -= amount;
  car.smoke = Math.min(1, car.smoke + amount / 90);
  if (car.hp <= 0 && car.alive) {
    car.alive = false;
    explodeCar(G, car);
  }
}

export function explodeCar(G, car) {
  spawnExplosion(G, car.x, car.y);
  G.sound.explosion();
  G.shake = 14;
  scarePeds(G, car.x, car.y, 320);
  if (car.driver === 'player') {
    G.player.car = null;
    G.player.onFoot = true;
    hurtPlayer(G, 30, 'blast');
  }
  if (Math.hypot(G.player.x - car.x, G.player.y - car.y) < 120) {
    hurtPlayer(G, 22, 'blast');
  }
  for (const ped of G.peds) {
    if (ped.alive && Math.hypot(ped.x - car.x, ped.y - car.y) < 110) killPed(G, ped);
  }
}

// --- wanted, health, bust ---------------------------------------------------

export function raiseWanted(G, stars, why) {
  if (G.wanted < 5) {
    G.wanted = Math.min(5, G.wanted + stars);
    G.wantedTimer = 0;
    G.lastCrime = why;
    G.sound.sirenBlip();
  }
}

export function updateWanted(G, dt) {
  if (G.wanted === 0) return;
  G.wantedTimer += dt;
  const nearCop = G.copCars.some((c) => c.alive && Math.hypot(G.player.x - c.x, G.player.y - c.y) < 520)
    || G.cops.some((c) => c.alive && Math.hypot(G.player.x - c.x, G.player.y - c.y) < 420);
  if (G.wantedTimer > CFG.wantedDecay && !nearCop) {
    G.wanted -= 1;
    G.wantedTimer = 0;
    G.flash = 'Heat cooling off — one star down';
    G.flashTimer = 2.5;
  }
}

export function hurtPlayer(G, amount, cause) {
  if (G.state !== 'play' || G.godTimer > 0) return;
  amount *= damageMul(G);
  G.player.hp -= amount;
  G.hurtFlash = Math.min(1, (G.hurtFlash || 0) + amount / 25);
  if (G.player.hp <= 0) {
    G.player.hp = 0;
    wastePlayer(G, cause);
  }
}

export function bustPlayer(G) {
  if (G.state !== 'play') return;
  G.state = 'busted';
  G.save.cash = Math.max(0, G.save.cash - 100);
  G.wanted = 0;
  G.bustTimer = 0;
  G.sound.busted();
  writeSaveSoon(G);
}

export function wastePlayer(G, cause) {
  if (G.state !== 'play') return;
  G.state = 'wasted';
  G.save.cash = Math.max(0, G.save.cash - 150);
  G.wanted = 0;
  G.sound.wasted();
  writeSaveSoon(G);
  void cause;
}

function writeSaveSoon(G) {
  G.saveDirty = true;
}

// --- particles ---------------------------------------------------------------

export function spawnMuzzle(G, x, y) {
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.08, max: 0.08, color: PALETTE.muzzle, size: 9, kind: 'flash' });
}

export function spawnSparks(G, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({ x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.3, max: 0.3, color: '#ffd23f', size: 3, kind: 'dot' });
  }
}

export function spawnBlood(G, x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.5, max: 0.5, color: '#a01818', size: 4, kind: 'dot' });
  }
}

export function spawnExplosion(G, x, y) {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 260;
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5, max: 1,
      color: Math.random() < 0.5 ? PALETTE.explosion : '#ffd23f',
      size: 5 + Math.random() * 8, kind: 'dot',
    });
  }
  G.particles.push({ x, y, vx: 0, vy: -14, life: 1.2, max: 1.2, color: PALETTE.smoke, size: 42, kind: 'smoke' });
}

export function spawnSkid(G, x, y) {
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.7, max: 0.7, color: 'rgba(22,22,22,0.5)', size: 5, kind: 'skid' });
}

export function spawnPickupSparkle(G, x, y) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    G.particles.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.4, max: 0.4, color: '#ffe45e', size: 4, kind: 'dot' });
  }
}

export function updateParticles(G, dt) {
  for (const p of G.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
    p.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  // Exhaust smoke from battered cars.
  for (const car of G.cars) {
    if (car.alive && car.smoke > 0.25 && Math.random() < dt * 8) {
      G.particles.push({
        x: car.x - Math.cos(car.angle) * 16, y: car.y - Math.sin(car.angle) * 16,
        vx: 0, vy: -22, life: 0.9, max: 0.9, color: PALETTE.smoke, size: 10 + car.smoke * 10, kind: 'smoke',
      });
    }
  }
}
