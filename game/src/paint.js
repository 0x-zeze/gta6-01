// Solstice City — everything the player sees: the sun-soaked streets, the cars,
// the people, the particles, and the HUD — cash, health, wanted stars, ammo,
// mission objective, speed, and a live minimap that never stops tracking.
import { CFG, PALETTE } from './settings.js';
import { jobMarker, currentStep } from './jobs.js';
import { drawStashes } from './pickups.js';
import { drawShop } from './shop.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, G) {
  const cam = G.camera;
  const vw = G.viewW;
  const vh = G.viewH;
  const z = CFG.cameraZoom;
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);
  if (G.shake > 0.2) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);

  const x0 = cam.x - vw / 2 - 60;
  const y0 = cam.y - vh / 2 - 60;
  const x1 = cam.x + vw / 2 + 60;
  const y1 = cam.y + vh / 2 + 60;

  drawGround(ctx, G, x0, y0, x1, y1);
  drawRoads(ctx, G, x0, y0, x1, y1);
  drawParks(ctx, G);
  drawBuildings(ctx, G, x0, y0, x1, y1);
  drawPickups(ctx, G);
  drawStashes(ctx, G);
  drawMarker(ctx, G);
  drawGarageMarker(ctx, G);
  for (const ped of G.peds) if (ped.alive) drawPed(ctx, ped);
  for (const cop of G.cops) if (cop.alive) drawPed(ctx, cop, true);
  for (const car of G.cars) if (car.alive) drawCar(ctx, car);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  ctx.restore();
}

function drawGround(ctx, G, x0, y0, x1, y1) {
  const T = G.town;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Mown stripes for a little texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 120;
  const startY = Math.floor(y0 / stripe) * stripe;
  for (let y = startY; y < y1; y += stripe * 2) {
    ctx.fillRect(x0, y, x1 - x0, stripe);
  }
  // Beach sand and the sea along the south shore.
  if (y1 > T.beachTop) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, Math.max(y0, T.beachTop), x1 - x0, Math.min(y1, T.size - 60) - Math.max(y0, T.beachTop));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, Math.max(y0, T.size - 60), x1 - x0, y1 - Math.max(y0, T.size - 60));
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = Math.floor(x0 / 180) * 180; x < x1; x += 180) {
      ctx.fillRect(x, Math.max(y0, T.size - 44), 90, 5);
    }
    // Palm trees along the sand, swaying gently.
    const sway = Math.sin(G.time * 0.9) * 2;
    for (let i = 0; i < 12; i++) {
      const px = 150 + i * 300;
      const py = T.beachTop + 70 + (i % 3) * 38;
      if (px < x0 - 40 || px > x1 + 40 || py < y0 - 40 || py > y1 + 40) continue;
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 6, py - 18, px + 10 + sway, py - 30);
      ctx.stroke();
      ctx.fillStyle = '#3f8f3a';
      for (let f = 0; f < 5; f++) {
        const a = -Math.PI / 2 + (f - 2) * 0.5;
        ctx.beginPath();
        ctx.ellipse(px + 10 + sway + Math.cos(a) * 13, py - 30 + Math.sin(a) * 9, 13, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Container docks: concrete yard with stacked boxes.
  if (x1 > T.dockLeft) {
    ctx.fillStyle = '#8d8f96';
    ctx.fillRect(Math.max(x0, T.dockLeft), y0, x1 - Math.max(x0, T.dockLeft), Math.min(y1, T.beachTop) - y0);
    const boxColors = ['#c0392b', '#2980b9', '#f39c12', '#16a085', '#8e44ad'];
    for (let i = 0; i < 14; i++) {
      const bx = T.dockLeft + 30 + (i % 4) * 62;
      const by = 240 + Math.floor(i / 4) * 330;
      if (bx < x0 || bx > x1 || by < y0 || by > y1) continue;
      ctx.fillStyle = boxColors[i % boxColors.length];
      ctx.fillRect(bx, by, 52, 96);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(bx, by, 52, 96);
    }
  }
}

function drawRoads(ctx, G, x0, y0, x1, y1) {
  const T = G.town;
  const half = CFG.roadWidth / 2;
  for (const p of T.lines) {
    if (p > y0 - half && p < y1 + half) {
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(x0, p - half, x1 - x0, CFG.roadWidth);
      ctx.fillStyle = PALETTE.asphaltEdge;
      ctx.fillRect(x0, p - half, x1 - x0, 4);
      ctx.fillRect(x0, p + half - 4, x1 - x0, 4);
    }
    if (p > x0 - half && p < x1 + half) {
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(p - half, y0, CFG.roadWidth, y1 - y0);
      ctx.fillStyle = PALETTE.asphaltEdge;
      ctx.fillRect(p - half, y0, 4, y1 - y0);
      ctx.fillRect(p + half - 4, y0, 4, y1 - y0);
    }
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const p of T.lines) {
    if (p > y0 - half && p < y1 + half) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
        if (Math.abs(x - p) < half + 6) continue;
        ctx.fillRect(x, p - 2, 22, 4);
      }
    }
    if (p > x0 - half && p < x1 + half) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
        if (Math.abs(y - p) < half + 6) continue;
        ctx.fillRect(p - 2, y, 4, 22);
      }
    }
  }
}

function drawParks(ctx, G) {
  for (const park of G.town.parks) {
    ctx.fillStyle = '#5d8f43';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#7fbf5f';
    for (let i = 0; i < 7; i++) {
      const tx = park.x + 30 + ((i * 53) % (park.w - 50));
      const ty = park.y + 30 + ((i * 37) % (park.h - 50));
      ctx.beginPath();
      ctx.arc(tx, ty, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(park.x + park.w / 2 - 4, park.y, 8, park.h);
  }
  for (const plaza of G.town.plazas) {
    ctx.fillStyle = PALETTE.plaza;
    ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.strokeRect(plaza.x + 6, plaza.y + 6, plaza.w - 12, plaza.h - 12);
  }
}

function drawBuildings(ctx, G, x0, y0, x1, y1) {
  for (const b of G.town.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    // Drop shadow, then the roof.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    }
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,244,180,0.75)';
    for (const w of b.windows) ctx.fillRect(w[0], w[1], 9, 9);
  }
}

function drawPickups(ctx, G) {
  const step = currentStep(G);
  if (step && step.kind === 'collect') {
    const t = performance.now() / 300;
    for (const p of step.points) {
      if (p.got) continue;
      const pulse = 12 + Math.sin(t) * 3;
      ctx.fillStyle = '#ffe45e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 5);
    }
  }
}

function drawMarker(ctx, G) {
  const m = jobMarker(G);
  if (!m) return;
  const t = performance.now() / 350;
  const pulse = 26 + Math.sin(t) * 5;
  ctx.strokeStyle = '#ffe45e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe45e';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 34 - Math.sin(t) * 4);
  ctx.lineTo(m.x - 9, m.y - 52 - Math.sin(t) * 4);
  ctx.lineTo(m.x + 9, m.y - 52 - Math.sin(t) * 4);
  ctx.closePath();
  ctx.fill();
}

function drawGarageMarker(ctx, G) {
  const gx = G.town.garage.x;
  const gy = G.town.garage.y;
  const t = performance.now() / 350;
  const pulse = 14 + Math.sin(t) * 3;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(47,214,115,0.9)';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();
  ctx.strokeStyle = 'rgba(47,214,115,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(gx, gy, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#2fd673';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GARAGE', gx, gy - 24);
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -19, -9, 44, 22, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -21, -11, 44, 22, 6);
  ctx.fill();
  // Windshield + roof.
  ctx.fillStyle = '#20262e';
  roundRect(ctx, -4, -9, 10, 18, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, -16, -9, 6, 18, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(21, -9, 2, 4);
  ctx.fillRect(21, 5, 2, 4);
  if (car.kind === 'cop') {
    const on = Math.sin(car.sirenPhase) > 0;
    ctx.fillStyle = on ? PALETTE.copLight : PALETTE.copLight2;
    ctx.beginPath();
    ctx.arc(-2, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? PALETTE.copLight2 : PALETTE.copLight;
    ctx.beginPath();
    ctx.arc(-2, 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 8, 3);
  }
  ctx.restore();
  if (car.smoke > 0.3) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 6 + car.smoke * 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPed(ctx, ped, isCop = false) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#0e2a4a';
    ctx.fillRect(-4, -8, 9, 4);
  }
  if (ped.hostile && !isCop) {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 10, 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.car) {
    // The driven car is drawn in the cars pass; draw a soft ring under it.
    ctx.restore();
    return;
  }
  ctx.rotate(p.aimAngle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand.
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -2, 11, 4);
  ctx.restore();
}

function drawBullets(ctx, G) {
  ctx.strokeStyle = '#ffe45e';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const p of G.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = p.kind === 'smoke' ? a * 0.5 : a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - a) : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- HUD ----------------------------------------------------------------------

export function drawHUD(ctx, G) {
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash, health, wanted stars.
  ctx.fillStyle = 'rgba(8,14,22,0.72)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`$${G.save.cash.toLocaleString('en-US')}`, 24, 42);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('CASH', 150, 30);
  // Health bar.
  ctx.fillStyle = '#222';
  roundRect(ctx, 24, 52, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = G.player.hp > 30 ? '#39d353' : '#ff4444';
  roundRect(ctx, 24, 52, 150 * Math.max(0, G.player.hp / CFG.playerHp), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText(`HP ${Math.ceil(G.player.hp)}`, 182, 63);
  // Wanted stars.
  ctx.font = '20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.55)';
  ctx.fillText(stars, 24, 92);
  // Stash haul this session.
  ctx.fillStyle = '#ffe45e';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`STASH ×${G.stashFound}`, 250, 92);
  ctx.textAlign = 'left';
  if (G.bustTimer > 0) {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('THEY ARE GRABBING YOU — RUN!', 24, 108);
  }

  // Mission objective panel (top centre).
  const step = currentStep(G);
  const job = G.mission && G.mission.job;
  if (job && step) {
    const label = `JOB ${job.id + 1}/5 — ${job.title}: ${step.label}`;
    ctx.font = 'bold 14px sans-serif';
    const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(8,14,22,0.72)';
    roundRect(ctx, vw / 2 - w / 2, 12, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe45e';
    ctx.textAlign = 'center';
    ctx.fillText(label, vw / 2, 34);
    if (step.kind === 'survive') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${Math.ceil(step.left)}s`, vw / 2, 62);
    }
    if (step.kind === 'fight') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${step.left} rivals left`, vw / 2, 62);
    }
  } else if (G.save.missionIndex >= G.jobs.length) {
    ctx.fillStyle = 'rgba(8,14,22,0.72)';
    roundRect(ctx, vw / 2 - 110, 12, 220, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#7CFC9A';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FREE ROAM — all jobs done', vw / 2, 34);
  }

  // Minimap (top-right, live).
  drawMinimap(ctx, G, vw - CFG.minimapSize - 12, 12);

  // Bottom-left: contextual hint.
  ctx.textAlign = 'left';
  ctx.font = '12px sans-serif';
  const hint = G.player.car
    ? 'W/S drive · A/D steer · Space brake · E exit car · Click shoot · M mute'
    : 'WASD move · Shift run · E enter car · Click shoot · M mute';
  ctx.fillStyle = 'rgba(8,14,22,0.66)';
  const hw = ctx.measureText(hint).width + 20;
  roundRect(ctx, 12, vh - 32, hw, 22, 8);
  ctx.fill();
  ctx.fillStyle = '#ddd';
  ctx.fillText(hint, 22, vh - 17);

  // Bottom-right: speed + ammo.
  if (G.player.car) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(G.player.car.speed) * 0.18)} km/h`, vw - 16, vh - 44);
  }
  ctx.fillStyle = '#ffe45e';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`AMMO ${G.player.ammo}`, vw - 16, vh - 16);

  // Flash banner (job started / completed).
  if (G.flashTimer > 0 && G.flash) {
    ctx.globalAlpha = Math.min(1, G.flashTimer);
    ctx.fillStyle = 'rgba(8,14,22,0.8)';
    const w = ctx.measureText(G.flash).width + 36;
    ctx.font = 'bold 15px sans-serif';
    const fw = ctx.measureText(G.flash).width + 36;
    roundRect(ctx, vw / 2 - fw / 2, vh - 92, fw, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe45e';
    ctx.textAlign = 'center';
    ctx.fillText(G.flash, vw / 2, vh - 70);
    ctx.globalAlpha = 1;
    void w;
  }

  // Off-screen marker arrow pointing at the job.
  const m = jobMarker(G);
  if (m) {
    const sx = vw / 2 + (m.x - G.camera.x);
    const sy = vh / 2 + (m.y - G.camera.y);
    if (sx < 40 || sx > vw - 40 || sy < 40 || sy > vh - 40) {
      let cx = Math.max(50, Math.min(vw - 50, sx));
      let cy = Math.max(70, Math.min(vh - 70, sy));
      // Keep the arrow clear of the cash panel (top-left) and the minimap (top-right).
      if (cy < 140) {
        cy = 140;
        cx = Math.max(290, Math.min(vw - 220, cx));
      }
      const a = Math.atan2(sy - vh / 2, sx - vw / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffe45e';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe45e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(Math.hypot(m.x - G.player.x, m.y - G.player.y))}m`, cx, cy + 26);
    }
  }

  // Red hurt vignette: the screen bleeds at the edges when you take damage.
  if (G.hurtFlash > 0) {
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    vg.addColorStop(0, 'rgba(255,30,30,0)');
    vg.addColorStop(1, `rgba(255,30,30,${0.45 * G.hurtFlash})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);
  }

  // Speed lines at the screen edges when the car is flat out.
  if (G.player.car && Math.abs(G.player.car.speed) > 420) {
    const ratio = (Math.abs(G.player.car.speed) - 420) / 220;
    ctx.strokeStyle = `rgba(255,255,255,${0.28 * ratio})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const yy = ((i * 173 + Math.floor(G.time * 900)) % (vh - 40)) + 20;
      const len = 40 + ratio * 70;
      const left = (i % 2 === 0);
      const xx = left ? 6 : vw - 6 - len;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + len, yy);
      ctx.stroke();
    }
  }

  // Garage shop panel when parked on foot at Dante's.
  drawShop(ctx, G);

  // Crosshair.
  if (G.state === 'play') {
    const mx = G.input.mouseX;
    const my = G.input.mouseY;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 13);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(ctx, G, x, y) {
  const size = CFG.minimapSize;
  const scale = size / G.town.size;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,22,0.78)';
  roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Water + sand.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + G.town.beachTop * scale, size, size);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x, y + G.town.beachTop * scale, size, (G.town.size - 60 - G.town.beachTop) * scale);
  ctx.fillStyle = '#5d7a45';
  ctx.fillRect(x, y, size, G.town.beachTop * scale);
  // Roads.
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 1.5;
  for (const p of G.town.lines) {
    ctx.beginPath();
    ctx.moveTo(x + p * scale, y);
    ctx.lineTo(x + p * scale, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + p * scale);
    ctx.lineTo(x + size, y + p * scale);
    ctx.stroke();
  }
  // Park.
  ctx.fillStyle = '#3f7a35';
  for (const park of G.town.parks) ctx.fillRect(x + park.x * scale, y + park.y * scale, park.w * scale, park.h * scale);
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * scale, y + wy * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const m = jobMarker(G);
  if (m) dot(m.x, m.y, '#ffe45e', 5);
  // Unclaimed cash stashes glow gold on the map.
  for (const s of G.pickups) {
    if (!s.taken && s.kind === 'cash') dot(s.x, s.y, '#ffe45e', 2.5);
  }
  // Dante's garage, always marked.
  ctx.fillStyle = '#2fd673';
  ctx.save();
  ctx.translate(x + G.town.garage.x * scale, y + G.town.garage.y * scale);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
  for (const car of G.copCars) if (car.alive) dot(car.x, car.y, Math.sin(car.sirenPhase) > 0 ? '#ff3b30' : '#2f7bff', 3.5);
  for (const cop of G.cops) if (cop.alive) dot(cop.x, cop.y, '#7fb3ff', 2.5);
  // Player: white triangle, always on top.
  ctx.save();
  ctx.translate(x + G.player.x * scale, y + G.player.y * scale);
  ctx.rotate(G.player.car ? G.player.car.angle : G.player.aimAngle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 10);
  ctx.stroke();
}

// --- full-screen states -------------------------------------------------------

export function drawTitle(ctx, G) {
  const vw = G.viewW;
  const vh = G.viewH;
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#1b2a4a');
  grad.addColorStop(0.55, '#c65d3a');
  grad.addColorStop(1, '#f2a541');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  // Sun + skyline silhouette.
  ctx.fillStyle = '#ffdf8a';
  ctx.beginPath();
  ctx.arc(vw * 0.88, vh * 0.16, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,16,32,0.9)';
  const base = vh * 0.78;
  for (let i = 0; i < 14; i++) {
    const bw = 40 + ((i * 37) % 50);
    const bh = 90 + ((i * 53) % 190);
    ctx.fillRect(30 + i * ((vw - 60) / 14), base - bh, bw, bh);
  }
  ctx.fillStyle = '#141020';
  ctx.fillRect(0, base, vw, vh - base);
  // Two cars cruise the avenue below the skyline, headlights on.
  const roadY = base + (vh - base) * 0.45;
  const carAt = (speed, offset, color, flip) => {
    const span = vw + 240;
    let cx = ((G.time * speed + offset) % span) - 120;
    if (flip) cx = span - 120 - ((G.time * speed + offset) % span);
    ctx.fillStyle = color;
    roundRect(ctx, cx - 26, roadY + (flip ? 26 : -8), 52, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#20262e';
    roundRect(ctx, cx - 8, roadY + (flip ? 30 : -4), 14, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(flip ? cx - 28 : cx + 24, roadY + (flip ? 30 : -4), 3, 4);
    ctx.fillRect(flip ? cx - 28 : cx + 24, roadY + (flip ? 42 : 8), 3, 4);
  };
  carAt(90, 0, '#c0392b', false);
  carAt(64, 500, '#2980b9', true);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe45e';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('PORT AURORA  •  A SUN-SOAKED HARBOUR CITY', vw / 2, vh * 0.2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLSTICE CITY', vw / 2, vh * 0.2 + 92);
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '20px sans-serif';
  ctx.fillText('Steal cars. Outrun the harbour police. Run jobs for the Tide.', vw / 2, vh * 0.2 + 132);

  const save = G.save;
  const lines = [
    save.missionIndex > 0 || save.cash > 250
      ? `CONTINUE — $${save.cash} · Job ${Math.min(save.missionIndex + 1, 5)} of 5`
      : 'NEW GAME — your first job is waiting at the docks',
    'WASD move · Shift sprint · E enter / steal car · Mouse aim · Click shoot',
    'W/S drive · A/D steer · Space brake · Lose the stars to lose the heat',
    '',
    'Click or press ENTER to start  •  M mute  •  Progress saves automatically',
  ];
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#7CFC9A' : 'rgba(255,255,255,0.88)';
    if (i === 0) ctx.font = 'bold 19px sans-serif';
    else ctx.font = '16px sans-serif';
    ctx.fillText(line, vw / 2, vh * 0.52 + i * 30);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('An original game. No real city, crew or brand — every name, street and story is invented.', vw / 2, vh - 22);
}

export function drawEndCard(ctx, G, kind) {
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.fillStyle = 'rgba(6,10,18,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  const title = kind === 'busted' ? 'BUSTED' : kind === 'wasted' ? 'WASTED' : 'THE LONG SUNSET';
  ctx.fillStyle = kind === 'complete' ? '#7CFC9A' : '#ff5252';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(title, vw / 2, vh * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  const sub = kind === 'busted'
    ? 'The harbour police took you in. $100 bail — the Tide posted it.'
    : kind === 'wasted'
      ? 'You went down hard. The crew patched you up — $150 for the trouble.'
      : 'All five jobs done. Marisol wires your cut as the sun sets over Port Aurora.';
  ctx.fillText(sub, vw / 2, vh * 0.38 + 44);
  ctx.fillStyle = '#ffe45e';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Cash: $${G.save.cash}  •  Jobs done: ${G.save.missionsDone.length} / 5`, vw / 2, vh * 0.38 + 84);
  ctx.fillStyle = '#ddd';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press ENTER to keep playing in free roam', vw / 2, vh * 0.38 + 124);
}
