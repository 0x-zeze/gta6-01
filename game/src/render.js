// Drawing only: the world's state and the current screen in, pixels out. A
// camera follows the player across the 3600 x 2600 city and shows a 1280 x 720
// window of it, scaled to the browser window. Flat shapes and canvas text:
// the HUD (cash, health, armor, wanted stars, mission objective), the live
// minimap, the title / pause / busted / wasted panels, and the crosshair.
import { FONT, GRID, PALETTE, ROAD, VIEW, WORLD } from './config.js';
import { LANDMARKS, roadCentres } from './city.js';
import { MISSIONS, STORY } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_STORY = 'story';

const MINIMAP = { width: 230, height: 166, margin: 16 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, camX: 0, camY: 0 };
  const cashLabel = cachedLabel('$');
  const speedLabel = cachedLabel('');
  const fonts = new Map();

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    const key = `${size}|${baseline ?? 'alphabetic'}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function worldToScreen(x, y) {
    return {
      x: view.x + (x - view.camX) * view.scale,
      y: view.y + (y - view.camY) * view.scale,
    };
  }

  function inView(x, y, margin) {
    return x > view.camX - margin && x < view.camX + VIEW.width + margin
      && y > view.camY - margin && y < view.camY + VIEW.height + margin;
  }

  function drawGround(state) {
    const { camX, camY } = view;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(view.x, view.y, VIEW.width * view.scale, VIEW.height * view.scale);
    // Water and beach on the west edge.
    if (camX < 260) {
      context.fillStyle = PALETTE.waterDeep;
      context.fillRect(view.x + (0 - camX) * view.scale, view.y, 120 * view.scale, VIEW.height * view.scale);
      context.fillStyle = PALETTE.water;
      context.fillRect(view.x + (60 - camX) * view.scale, view.y, 60 * view.scale, VIEW.height * view.scale);
      context.fillStyle = PALETTE.sand;
      context.fillRect(view.x + (120 - camX) * view.scale, view.y, 140 * view.scale, VIEW.height * view.scale);
    }
    // Park lawn.
    const park = worldToScreen(LANDMARKS.park.x, LANDMARKS.park.y);
    context.fillStyle = PALETTE.park;
    context.beginPath();
    context.arc(park.x, park.y, 190 * view.scale, 0, Math.PI * 2);
    context.fill();
    // Docks apron.
    const docks = worldToScreen(LANDMARKS.docks.x, LANDMARKS.docks.y);
    context.fillStyle = PALETTE.dock;
    context.fillRect(docks.x - 320 * view.scale, docks.y - 200 * view.scale, 640 * view.scale, 400 * view.scale);
    // Roads: asphalt bands, then centre dashes.
    const { vertical, horizontal } = roadCentres();
    context.fillStyle = PALETTE.road;
    for (const cx of vertical) {
      if (!inView(cx, camY + VIEW.height / 2, ROAD)) continue;
      context.fillRect(view.x + (cx - ROAD / 2 - camX) * view.scale, view.y, ROAD * view.scale, VIEW.height * view.scale);
    }
    for (const cy of horizontal) {
      if (!inView(camX + VIEW.width / 2, cy, ROAD)) continue;
      context.fillRect(view.x, view.y + (cy - ROAD / 2 - camY) * view.scale, VIEW.width * view.scale, ROAD * view.scale);
    }
    context.fillStyle = PALETTE.lane;
    for (const cx of vertical) {
      if (!inView(cx, camY + VIEW.height / 2, ROAD)) continue;
      for (let y = Math.floor(camY / 60) * 60; y < camY + VIEW.height; y += 60) {
        context.fillRect(view.x + (cx - 2 - camX) * view.scale, view.y + (y - camY) * view.scale, 4 * view.scale, 28 * view.scale);
      }
    }
    for (const cy of horizontal) {
      if (!inView(camX + VIEW.width / 2, cy, ROAD)) continue;
      for (let x = Math.floor(camX / 60) * 60; x < camX + VIEW.width; x += 60) {
        context.fillRect(view.x + (x - camX) * view.scale, view.y + (cy - 2 - camY) * view.scale, 28 * view.scale, 4 * view.scale);
      }
    }
    // Sidewalk edging where a road meets a block.
    context.fillStyle = PALETTE.sidewalk;
    for (const cx of vertical) {
      if (!inView(cx, camY + VIEW.height / 2, ROAD + 30)) continue;
      context.fillRect(view.x + (cx - ROAD / 2 - 8 - camX) * view.scale, view.y, 8 * view.scale, VIEW.height * view.scale);
      context.fillRect(view.x + (cx + ROAD / 2 - camX) * view.scale, view.y, 8 * view.scale, VIEW.height * view.scale);
    }
    for (const cy of horizontal) {
      if (!inView(camX + VIEW.width / 2, cy, ROAD + 30)) continue;
      context.fillRect(view.x, view.y + (cy - ROAD / 2 - 8 - camY) * view.scale, VIEW.width * view.scale, 8 * view.scale);
      context.fillRect(view.x, view.y + (cy + ROAD / 2 - camY) * view.scale, VIEW.width * view.scale, 8 * view.scale);
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      const p = worldToScreen(b.x, b.y);
      const w = b.w * view.scale;
      const h = b.h * view.scale;
      // Tall buildings throw a soft shadow to the south-east.
      if (b.tall > 0) {
        context.fillStyle = 'rgba(0, 0, 0, 0.25)';
        context.fillRect(p.x + 10 * view.scale, p.y + 10 * view.scale, w, h);
      }
      context.fillStyle = b.color;
      context.fillRect(p.x, p.y, w, h);
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(p.x + 4 * view.scale, p.y + 4 * view.scale, w - 8 * view.scale, h - 8 * view.scale);
      // Windows: a grid of lit panes, seeded per building.
      context.fillStyle = PALETTE.glass;
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 30));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (((c * 7 + r * 13 + Math.floor(b.seed * 100)) % 5) < 2) continue;
          context.fillRect(
            p.x + (10 + c * ((b.w - 20) / cols)) * view.scale,
            p.y + (10 + r * ((b.h - 20) / rows)) * view.scale,
            12 * view.scale, 10 * view.scale,
          );
        }
      }
    }
    for (const t of state.city.trees) {
      if (!inView(t.x, t.y, 40)) continue;
      const p = worldToScreen(t.x, t.y);
      context.fillStyle = PALETTE.treeDark;
      context.beginPath();
      context.arc(p.x + 3 * view.scale, p.y + 3 * view.scale, t.r * view.scale, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(p.x, p.y, t.r * view.scale, 0, Math.PI * 2);
      context.fill();
    }
    for (const c of state.city.crates) {
      if (!inView(c.x + c.w / 2, c.y + c.h / 2, 80)) continue;
      const p = worldToScreen(c.x, c.y);
      context.fillStyle = '#a8845a';
      context.fillRect(p.x, p.y, c.w * view.scale, c.h * view.scale);
      context.strokeStyle = '#6a5232';
      context.lineWidth = 2 * view.scale;
      context.strokeRect(p.x, p.y, c.w * view.scale, c.h * view.scale);
    }
    // Marina pier, jutting into the water.
    const marina = worldToScreen(LANDMARKS.marina.x, LANDMARKS.marina.y);
    context.fillStyle = PALETTE.pier;
    context.fillRect(marina.x - 170 * view.scale, marina.y - 10 * view.scale, 170 * view.scale, 20 * view.scale);
    context.fillStyle = PALETTE.water;
    context.beginPath();
    context.arc(marina.x - 40 * view.scale, marina.y + 40 * view.scale, 26 * view.scale, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(marina.x - 90 * view.scale, marina.y - 44 * view.scale, 20 * view.scale, 0, Math.PI * 2);
    context.fill();
  }

  function drawMarker(x, y, color, pulse) {
    const p = worldToScreen(x, y);
    const r = (26 + Math.sin(pulse * 4) * 6) * view.scale;
    context.strokeStyle = color;
    context.lineWidth = 4 * view.scale;
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.arc(p.x, p.y, 7 * view.scale, 0, Math.PI * 2);
    context.fill();
    // A light beacon so the marker reads from far away.
    context.fillStyle = color;
    context.globalAlpha = 0.16;
    context.fillRect(p.x - 4 * view.scale, view.y, 8 * view.scale, (p.y - view.y));
    context.globalAlpha = 1;
  }

  function drawCar(car) {
    if (!inView(car.x, car.y, 80)) return;
    const p = worldToScreen(car.x, car.y);
    context.save();
    context.translate(p.x, p.y);
    context.rotate(car.angle);
    const L = 54 * view.scale;
    const W = 26 * view.scale;
    if (car.wreck) {
      context.fillStyle = '#1c1c1c';
      context.fillRect(-L / 2, -W / 2, L, W);
      context.fillStyle = 'rgba(120,120,120,0.5)';
      context.beginPath();
      context.arc(-L / 4, -W / 3, 10 * view.scale, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-L / 2 + 3 * view.scale, -W / 2 + 3 * view.scale, L, W);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-L / 2, -W / 2, L, W, 8 * view.scale);
    context.fill();
    context.fillStyle = '#20262e';
    context.fillRect(-L * 0.18, -W * 0.38, L * 0.32, W * 0.76);
    context.fillStyle = '#9fd8e8';
    context.fillRect(-L * 0.12, -W * 0.34, L * 0.2, W * 0.68);
    context.fillStyle = '#fff8c0';
    context.fillRect(L / 2 - 4 * view.scale, -W / 2 + 3 * view.scale, 3 * view.scale, 5 * view.scale);
    context.fillRect(L / 2 - 4 * view.scale, W / 2 - 8 * view.scale, 3 * view.scale, 5 * view.scale);
    if (car.kind === 'police') {
      const flash = Math.floor(performance.now() / 300) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#2f6bff';
      context.fillRect(-6 * view.scale, -W / 2 + 2 * view.scale, 12 * view.scale, 6 * view.scale);
      context.fillStyle = flash ? '#2f6bff' : '#ff3b30';
      context.fillRect(-6 * view.scale, W / 2 - 8 * view.scale, 12 * view.scale, 6 * view.scale);
      context.fillStyle = '#eef1f5';
      text('PD', 0, 4 * view.scale, 11, '#eef1f5', 'center', 'middle');
    } else if (car.kind === 'player') {
      context.fillStyle = '#f2c94c';
      context.fillRect(-L / 2 + 4 * view.scale, -2 * view.scale, 8 * view.scale, 4 * view.scale);
    }
    context.restore();
  }

  function drawPed(ped) {
    if (!inView(ped.x, ped.y, 40)) return;
    const p = worldToScreen(ped.x, ped.y);
    const r = 11 * view.scale;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(p.x, p.y + r * 0.7, r, r * 0.45, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.kind === 'police' ? '#2a4a8a' : ped.kind === 'enforcer' ? '#8a2a2a' : ped.color;
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(p.x + Math.cos(ped.angle) * 4 * view.scale, p.y + Math.sin(ped.angle) * 4 * view.scale, r * 0.45, 0, Math.PI * 2);
    context.fill();
    if (ped.kind === 'police') {
      context.fillStyle = '#d8e2f2';
      context.fillRect(p.x - r, p.y - r - 4 * view.scale, r * 2, 3 * view.scale);
    }
    if (ped.kind === 'enforcer') {
      context.strokeStyle = '#1c1c1c';
      context.lineWidth = 3 * view.scale;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(ped.angle) * 20 * view.scale, p.y + Math.sin(ped.angle) * 20 * view.scale);
      context.stroke();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    const p = worldToScreen(player.x, player.y);
    if (player.inCar) {
      drawCar(player.inCar);
      return;
    }
    const r = 13 * view.scale;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) return;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(p.x, p.y + r * 0.8, r, r * 0.45, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerShirt;
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(p.x + Math.cos(player.angle) * 5 * view.scale, p.y + Math.sin(player.angle) * 5 * view.scale, r * 0.5, 0, Math.PI * 2);
    context.fill();
    // The gun points where the mouse aims.
    context.strokeStyle = '#22262c';
    context.lineWidth = 4 * view.scale;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(player.angle) * 24 * view.scale, p.y + Math.sin(player.angle) * 24 * view.scale);
    context.stroke();
  }

  function drawBullets(state) {
    context.strokeStyle = '#ffe08a';
    context.lineWidth = 3 * view.scale;
    for (const b of state.bullets) {
      if (!inView(b.x, b.y, 40)) continue;
      const p = worldToScreen(b.x, b.y);
      const len = Math.hypot(b.vx, b.vy) || 1;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x - (b.vx / len) * 14 * view.scale, p.y - (b.vy / len) * 14 * view.scale);
      context.stroke();
    }
    for (const pt of state.particles) {
      if (!inView(pt.x, pt.y, 40)) continue;
      const p = worldToScreen(pt.x, pt.y);
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(p.x, p.y, pt.size * view.scale, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (!inView(pk.x, pk.y, 40)) continue;
      const p = worldToScreen(pk.x, pk.y);
      const bob = Math.sin(pk.bob) * 3 * view.scale;
      context.fillStyle = pk.kind === 'cash' ? '#f2c94c' : pk.kind === 'health' ? '#4ade80' : '#60a5fa';
      context.beginPath();
      context.arc(p.x, p.y + bob, 11 * view.scale, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#10202e';
      text(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', p.x, p.y + bob + 4 * view.scale, 13, '#10202e', 'center', 'middle');
    }
  }

  function bar(x, y, w, h, ratio, color, bg) {
    context.fillStyle = bg;
    context.fillRect(x, y, w, h);
    context.fillStyle = color;
    context.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  }

  function drawHud(state, mouse) {
    const player = state.player;
    const mission = MISSIONS[state.missionIndex];
    // Top-left: cash, health, armor.
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(14, 12, 250, 86);
    text(cashLabel(state.cash), 26, 40, 26, PALETTE.hudAccent, 'left', 'top');
    text('VICE SHORES', 170, 20, 13, PALETTE.muted, 'left', 'top');
    bar(26, 52, 150, 10, player.health / 100, PALETTE.health, '#233026');
    bar(26, 68, 150, 10, player.armor / 50, PALETTE.armor, '#1e2636');
    text('HP', 184, 52, 12, PALETTE.muted, 'left', 'top');
    text('ARMOR', 184, 68, 12, PALETTE.muted, 'left', 'top');
    if (player.inCar) {
      text(speedLabel(Math.round(Math.abs(player.inCar.speed) * 0.18)), 26, 92, 15, PALETTE.hud, 'left', 'top');
      text('km/h', 76, 92, 13, PALETTE.muted, 'left', 'top');
    }
    // Top-right: wanted stars.
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(VIEW.width - 214, 12, 200, 44);
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 196 + i * 36, 44, 26, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left', 'middle');
    }
    // Top-centre: current mission objective.
    if (mission && !state.storyDone) {
      const step = mission.steps[state.missionStep];
      const label = step ? step.text : mission.title;
      context.fillStyle = PALETTE.hudPanel;
      const w = Math.min(760, 40 + (label.length + 13) * 8);
      context.fillRect((VIEW.width - w) / 2, 12, w, 34);
      text(`MISSION ${mission.id} — ${label}`, VIEW.width / 2, 34, 14, PALETTE.mission, 'center', 'middle');
    } else if (state.storyDone) {
      context.fillStyle = PALETTE.hudPanel;
      context.fillRect((VIEW.width - 420) / 2, 12, 420, 34);
      text('★ THE BIG SCORE — COMPLETE ★', VIEW.width / 2, 34, 15, PALETTE.mission, 'center', 'middle');
    }
    // Message banner under the mission line.
    if (state.messageTimer > 0 && state.message) {
      context.globalAlpha = Math.min(1, state.messageTimer);
      text(state.message, VIEW.width / 2, 68, 18, PALETTE.hud, 'center', 'top');
      context.globalAlpha = 1;
    }
    // Bottom-left: controls.
    text('WASD move / drive   E steal car   Mouse aim, Click shoot   Shift sprint   P pause   M mute', 16, VIEW.height - 14, 13, 'rgba(238,241,245,0.75)', 'left', 'bottom');
    // Crosshair on foot.
    if (!player.inCar && mouse) {
      context.strokeStyle = 'rgba(242,201,76,0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(mouse.x - 14, mouse.y);
      context.lineTo(mouse.x + 14, mouse.y);
      context.moveTo(mouse.x, mouse.y - 14);
      context.lineTo(mouse.x, mouse.y + 14);
      context.stroke();
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const x0 = VIEW.width - MINIMAP.width - MINIMAP.margin;
    const y0 = VIEW.height - MINIMAP.height - MINIMAP.margin;
    const sx = MINIMAP.width / WORLD.width;
    const sy = MINIMAP.height / WORLD.height;
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(x0 - 4, y0 - 4, MINIMAP.width + 8, MINIMAP.height + 8);
    context.fillStyle = '#1d3a24';
    context.fillRect(x0, y0, MINIMAP.width, MINIMAP.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, y0, 120 * sx, MINIMAP.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(x0 + 120 * sx, y0, 140 * sx, MINIMAP.height);
    context.fillStyle = '#3a3f47';
    const { vertical, horizontal } = roadCentres();
    for (const cx of vertical) context.fillRect(x0 + cx * sx - 1, y0, 2, MINIMAP.height);
    for (const cy of horizontal) context.fillRect(x0, y0 + cy * sy - 1, MINIMAP.width, 2);
    context.fillStyle = '#5a6a7a';
    for (const b of state.city.buildings) {
      context.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    const mission = MISSIONS[state.missionIndex];
    if (mission && !state.storyDone) {
      const step = mission.steps[state.missionStep];
      if (step) {
        context.fillStyle = PALETTE.mission;
        context.beginPath();
        context.arc(x0 + step.x * sx, y0 + step.y * sy, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (state.taxi) {
      context.fillStyle = '#f2c230';
      context.beginPath();
      context.arc(x0 + state.taxi.x * sx, y0 + state.taxi.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#2f6bff';
      context.beginPath();
      context.arc(x0 + car.x * sx, y0 + car.y * sy, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    // The player: a gold dot with a white ring.
    context.fillStyle = '#f2c94c';
    context.beginPath();
    context.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 7, 0, Math.PI * 2);
    context.stroke();
    text('VICE SHORES', x0 + MINIMAP.width / 2, y0 - 8, 11, PALETTE.muted, 'center', 'bottom');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30 + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(8, 12, 20, 0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent ?? PALETTE.hudAccent;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.text, 'center', 'alphabetic');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 116 + i * 30, 19, PALETTE.muted, 'center', 'alphabetic');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 21, PALETTE.hudAccent, 'center', 'alphabetic');
  }

  function drawTitle(state, hasSave) {
    drawPanel('VICE SHORES', [
      'A sun-soaked open-world crime story — original, made for this bounty.',
      'Steal cars. Outrun the police. Run five jobs for Rico and Mara.',
      'WASD move / drive · E steal a car · Mouse aim, Click to shoot',
      'Shift sprint / boost · P pause · M mute · progress saves automatically',
      '',
      ...(hasSave ? ['A saved game is waiting — press Enter to continue it.'] : ['No save yet — press Enter to start a new story.']),
    ], 'Press Enter or click to play', PALETTE.hudAccent);
    // The story beats sit under the panel, small.
    text(STORY[0], VIEW.width / 2, VIEW.height - 96, 15, 'rgba(238,241,245,0.8)', 'center', 'alphabetic');
    text(STORY[3], VIEW.width / 2, VIEW.height - 70, 15, 'rgba(238,241,245,0.8)', 'center', 'alphabetic');
  }

  function drawOver(state, best) {
    const lines = [
      `Cash $${state.cash} · Cars stolen ${state.carsStolen} · Missions done ${state.missionIndex} / ${MISSIONS.length}`,
      `Best cash banked: $${best}`,
      'The city keeps moving. Kai keeps moving with it.',
    ];
    drawPanel('BUSTED — or WASTED', lines, 'Press Enter or click to play again', PALETTE.danger);
  }

  function drawStory(state) {
    drawPanel('THE BIG SCORE — COMPLETE', [
      'Five jobs. One bank. Zero handcuffs.',
      `Final cash $${state.cash} · Cars stolen ${state.carsStolen} · Respect ${state.respect}`,
      'Vice Shores is yours, Kai. Thanks for playing.',
    ], 'Press Enter to keep roaming the city', PALETTE.mission);
  }

  /** Paint one frame: the city under the camera, then the HUD or a panel. */
  function draw(state, screen, opts) {
    const player = state.player;
    view.camX = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2));
    view.camY = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height / 2));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawGround(state);
    drawBuildings(state);
    // Mission and taxi markers sit on the ground, under the cars.
    const mission = MISSIONS[state.missionIndex];
    if (mission && !state.storyDone) {
      const step = mission.steps[state.missionStep];
      if (step) drawMarker(step.x, step.y, PALETTE.mission, state.elapsed);
    }
    if (state.taxi) drawMarker(state.taxi.x, state.taxi.y, '#f2c230', state.elapsed + 2);
    if (state.taxi && !state.taxiPassenger) drawMarker(state.taxi.dx, state.taxi.dy, '#f2c230', state.elapsed + 4);
    drawPickups(state);
    for (const car of state.cars) {
      if (car === player.inCar) continue;
      drawCar(car);
    }
    for (const ped of state.peds) drawPed(ped);
    drawPlayer(state);
    drawBullets(state);
    // The HUD is drawn in screen space, over the world.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawHud(state, null);
      drawTitle(state, opts.hasSave);
      return;
    }
    drawHud(state, opts.mouse);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except right now.', `Cash $${state.cash} · Mission ${Math.min(state.missionIndex + 1, MISSIONS.length)} of ${MISSIONS.length}`], 'Press P to resume', PALETTE.hudAccent);
    } else if (screen === SCREEN_OVER) {
      drawOver(state, opts.best);
    } else if (screen === SCREEN_STORY) {
      drawStory(state);
    }
  }

  /** Convert a pointer's client (CSS pixel) position to world coordinates. */
  function screenToWorld(clientX, clientY) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    return {
      x: view.camX + (clientX * ratio - view.x) / view.scale,
      y: view.camY + (clientY * ratio - view.y) / view.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, worldToScreen, screenToWorld };
}
