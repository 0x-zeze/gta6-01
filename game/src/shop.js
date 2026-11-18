// Solstice City — Dante's garage: spend job cash on permanent upgrades.
// Engine (top speed), Armor (damage taken) and Ammo (pistol capacity), three
// levels each. Walk up to the garage on foot and press 1 / 2 / 3 to buy the
// next level. Cash finally has somewhere to go besides the bail jar.
import { CFG } from './settings.js';

export const UPGRADES = [
  { key: 'engine', name: 'Engine', desc: '+12% top speed', prices: [400, 700, 1100] },
  { key: 'armor', name: 'Armor', desc: '-12% damage taken', prices: [350, 600, 950] },
  { key: 'ammo', name: 'Ammo', desc: '+40 max ammo', prices: [250, 450, 700] },
];
export const MAX_LEVEL = 3;
const SHOP_RADIUS = 110;

export function freshUpgrades() {
  return { engine: 0, armor: 0, ammo: 0 };
}

export function topSpeedMul(G) {
  return 1 + 0.12 * (G.save.upgrades?.engine || 0);
}

export function damageMul(G) {
  return Math.max(0.64, 1 - 0.12 * (G.save.upgrades?.armor || 0));
}

export function ammoMax(G) {
  return CFG.pistolAmmoMax + 40 * (G.save.upgrades?.ammo || 0);
}

export function nearGarage(G) {
  return G.player.onFoot
    && Math.hypot(G.player.x - G.town.garage.x, G.player.y - G.town.garage.y) < SHOP_RADIUS;
}

export function updateShop(G) {
  if (!nearGarage(G) || G.state !== 'play') return;
  const keys = ['1', '2', '3'];
  for (let i = 0; i < 3; i++) {
    if (!G.input.wasPressed(keys[i])) continue;
    const up = UPGRADES[i];
    const lvl = G.save.upgrades[up.key] || 0;
    if (lvl >= MAX_LEVEL) {
      G.flash = `${up.name} already maxed out`;
    } else if (G.save.cash < up.prices[lvl]) {
      G.flash = `Need $${up.prices[lvl]} for ${up.name} Mk${lvl + 2}`;
    } else {
      G.save.cash -= up.prices[lvl];
      G.save.upgrades[up.key] = lvl + 1;
      G.ammoMax = ammoMax(G);
      G.flash = `${up.name} Mk${lvl + 2} installed — $${up.prices[lvl]}`;
      G.sound.jingle();
      G.saveDirty = true;
    }
    G.flashTimer = 2.5;
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawShop(ctx, G) {
  if (!nearGarage(G) || G.state !== 'play') return;
  const vw = G.viewW;
  const vh = G.viewH;
  const w = 470;
  const h = 118;
  const x = vw / 2 - w / 2;
  const y = vh - 216;
  ctx.fillStyle = 'rgba(8,14,22,0.85)';
  roundRectPath(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = '#2fd673';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2fd673';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText("DANTE'S GARAGE — press 1 / 2 / 3 to buy", x + 16, y + 22);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  UPGRADES.forEach((up, i) => {
    const lvl = G.save.upgrades[up.key] || 0;
    const rowY = y + 46 + i * 24;
    let pips = '';
    for (let p = 0; p < MAX_LEVEL; p++) pips += p < lvl ? '●' : '○';
    const price = lvl >= MAX_LEVEL ? 'MAX' : `$${up.prices[lvl]}`;
    const afford = lvl < MAX_LEVEL && G.save.cash >= up.prices[lvl];
    ctx.fillStyle = lvl >= MAX_LEVEL ? '#888' : afford ? '#fff' : '#ff9d9d';
    ctx.fillText(`[${i + 1}] ${up.name} ${pips}  ${up.desc}`, x + 16, rowY);
    ctx.textAlign = 'right';
    ctx.fillText(price, x + w - 16, rowY);
    ctx.textAlign = 'left';
  });
}
