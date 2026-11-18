// Solstice City — stash pickups: cash stashes, medkits and ammo crates hidden
// around Port Aurora. They give exploring a payoff, refill health and ammo
// between jobs, and respawn somewhere new after a while, so the city never
// runs dry and a free-roam session always has something to chase.
import { CFG } from './settings.js';
import { spawnPickupSparkle } from './actors.js';

export const STASH = {
  count: 10,
  cash: 75,
  medkit: 35,
  ammo: 40,
  respawnSeconds: 45,
  collectRadius: 36,
};

// Six cash stashes, two medkits, two ammo crates per city.
const KINDS = ['cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'medkit', 'medkit', 'ammo', 'ammo'];

function stashSpot(G) {
  for (let i = 0; i < 12; i++) {
    const p = G.town.randomSidewalkPoint();
    if (!G.town.inBuilding(p.x, p.y, 10) && !G.town.onSand(p.x, p.y)) return p;
  }
  return G.town.randomSidewalkPoint();
}

export function spawnStashes(G) {
  const stashes = [];
  for (let i = 0; i < STASH.count; i++) {
    const p = stashSpot(G);
    stashes.push({
      kind: KINDS[i],
      x: p.x, y: p.y,
      taken: false,
      respawn: 0,
      bob: Math.random() * Math.PI * 2,
    });
  }
  return stashes;
}

export function updatePickups(G, dt) {
  for (const s of G.pickups) {
    if (s.taken) {
      s.respawn -= dt;
      if (s.respawn <= 0) {
        const p = stashSpot(G);
        s.x = p.x;
        s.y = p.y;
        s.taken = false;
      }
      continue;
    }
    s.bob += dt * 3;
    if (Math.hypot(G.player.x - s.x, G.player.y - s.y) < STASH.collectRadius) {
      s.taken = true;
      s.respawn = STASH.respawnSeconds;
      G.stashFound += 1;
      if (s.kind === 'cash') {
        G.save.cash += STASH.cash;
        G.flash = `Stash found — +$${STASH.cash}`;
      } else if (s.kind === 'medkit') {
        G.player.hp = Math.min(CFG.playerHp, G.player.hp + STASH.medkit);
        G.flash = `Medkit — +${STASH.medkit} HP`;
      } else {
        G.player.ammo = Math.min(G.ammoMax, G.player.ammo + STASH.ammo);
        G.flash = `Ammo crate — +${STASH.ammo} rounds`;
      }
      G.flashTimer = 2;
      G.sound.pickup();
      spawnPickupSparkle(G, s.x, s.y);
      G.saveDirty = true;
    }
  }
}

export function drawStashes(ctx, G) {
  const t = performance.now() / 300;
  for (const s of G.pickups) {
    if (s.taken) continue;
    const pulse = 11 + Math.sin(t + s.bob) * 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
    if (s.kind === 'cash') {
      ctx.fillStyle = '#ffe45e';
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', s.x, s.y + 5);
    } else if (s.kind === 'medkit') {
      ctx.fillStyle = '#2fd673';
      ctx.fill();
      ctx.strokeStyle = '#0d6b34';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - 2, s.y - 7, 4, 14);
      ctx.fillRect(s.x - 7, s.y - 2, 14, 4);
    } else {
      ctx.fillStyle = '#ff9f1c';
      ctx.fill();
      ctx.strokeStyle = '#8a5200';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#5c3600';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', s.x, s.y + 4);
    }
  }
}
