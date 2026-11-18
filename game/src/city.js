// Vice Shores' city layout, generated once from the seed: the road grid, the
// buildings inside each block, the beach and water on the west edge, the park,
// the marina and the docks in the south-east, and the named landmarks the
// missions and the minimap point at. Pure data — no drawing, no browser.
import { GRID, ROAD, WORLD, PALETTE } from './config.js';
import { intBetween, pick } from './random.js';

export const LANDMARKS = {
  hideout: { name: 'Hideout — Coral Court', x: 620, y: 620 },
  marina: { name: 'Marina — Sunset Quay', x: 300, y: 1420 },
  bank: { name: 'Shores Bank — Palm Row', x: 2580, y: 620 },
  docks: { name: 'Docks — Cargo Row', x: 3180, y: 2180 },
  downtown: { name: 'Downtown — Neon Mile', x: 2380, y: 1020 },
  park: { name: 'Palm Park', x: 1420, y: 1420 },
  hospital: { name: 'Shores General', x: 1020, y: 2180 },
  garage: { name: 'Rico\'s Garage', x: 1820, y: 620 },
};

/** Road centre lines: vertical avenues and horizontal streets. */
export function roadCentres() {
  const vertical = [];
  const horizontal = [];
  for (let x = GRID; x < WORLD.width; x += GRID) vertical.push(x);
  for (let y = GRID; y < WORLD.height; y += GRID) horizontal.push(y);
  return { vertical, horizontal };
}

/** True when the point is on a road (asphalt), false when it is inside a block. */
export function onRoad(x, y) {
  const { vertical, horizontal } = roadCentres();
  for (const cx of vertical) if (Math.abs(x - cx) <= ROAD / 2) return true;
  for (const cy of horizontal) if (Math.abs(y - cy) <= ROAD / 2) return true;
  return false;
}

/** True when the point is on the beach or in the water (west edge). */
export function beachZone(x) {
  return x < 260;
}

/** True when the point is in the water. */
export function inWater(x) {
  return x < 120;
}

/** Snap a point to the nearest road centre line (used for traffic lanes). */
export function nearestRoad(x, y) {
  const { vertical, horizontal } = roadCentres();
  let best = { axis: 'v', at: vertical[0], dist: Infinity };
  for (const cx of vertical) {
    const d = Math.abs(x - cx);
    if (d < best.dist) best = { axis: 'v', at: cx, dist: d };
  }
  for (const cy of horizontal) {
    const d = Math.abs(y - cy);
    if (d < best.dist) best = { axis: 'h', at: cy, dist: d };
  }
  return best;
}

/**
 * Build the whole city: buildings (rectangles with a colour, height band and
 * windows), trees, the park, the pier and the dock crates. Buildings never
 * cover a road, the beach or a landmark's doorstep.
 */
export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const crates = [];
  const { vertical, horizontal } = roadCentres();

  // One building per block cell, jittered inside its block, taller downtown.
  for (let bx = 0; bx < vertical.length; bx += 1) {
    for (let by = 0; by < horizontal.length; by += 1) {
      const x0 = vertical[bx] + ROAD / 2 + 24;
      const y0 = horizontal[by] + ROAD / 2 + 24;
      const x1 = (vertical[bx + 1] ?? WORLD.width - 40) - ROAD / 2 - 24;
      const y1 = (horizontal[by + 1] ?? WORLD.height - 40) - ROAD / 2 - 24;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The park block stays green; the docks block stays open for crates.
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (Math.abs(cx - LANDMARKS.park.x) < 220 && Math.abs(cy - LANDMARKS.park.y) < 220) continue;
      if (Math.abs(cx - LANDMARKS.docks.x) < 320 && Math.abs(cy - LANDMARKS.docks.y) < 320) continue;
      const downtown = Math.abs(cx - LANDMARKS.downtown.x) < 500 && Math.abs(cy - LANDMARKS.downtown.y) < 500;
      const w = intBetween(random, 90, Math.min(200, x1 - x0));
      const h = intBetween(random, 80, Math.min(180, y1 - y0));
      const x = x0 + random() * Math.max(1, x1 - x0 - w);
      const y = y0 + random() * Math.max(1, y1 - y0 - h);
      buildings.push({
        x, y, w, h,
        color: pick(random, PALETTE.building),
        tall: downtown ? intBetween(random, 2, 4) : intBetween(random, 0, 2),
        seed: random(),
      });
      // A couple of trees on the block's spare ground.
      for (let t = 0; t < 2; t += 1) {
        trees.push({ x: x0 + random() * (x1 - x0), y: y0 + random() * (y1 - y0), r: 10 + random() * 8 });
      }
    }
  }

  // Park trees, in a loose ring around the pond.
  for (let i = 0; i < 26; i += 1) {
    const a = random() * Math.PI * 2;
    const r = 60 + random() * 140;
    trees.push({ x: LANDMARKS.park.x + Math.cos(a) * r, y: LANDMARKS.park.y + Math.sin(a) * r * 0.8, r: 11 + random() * 9 });
  }

  // Dock crates, in rows near the cargo sheds.
  for (let i = 0; i < 18; i += 1) {
    crates.push({
      x: LANDMARKS.docks.x - 260 + (i % 6) * 90,
      y: LANDMARKS.docks.y - 140 + Math.floor(i / 6) * 90,
      w: 56, h: 56,
    });
  }

  return { buildings, trees, crates };
}

/** True when the circle at (x, y) with radius r hits a building or a crate. */
export function hitsSolid(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const c of city.crates) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
  }
  return null;
}

/** Push a circle out of whatever solid it overlaps; returns the solid hit, or null. */
export function resolveSolid(city, body, r) {
  const hit = hitsSolid(city, body.x, body.y, r);
  if (!hit) return null;
  const cx = hit.x + hit.w / 2;
  const cy = hit.y + hit.h / 2;
  const dx = body.x - cx;
  const dy = body.y - cy;
  const overlapX = hit.w / 2 + r - Math.abs(dx);
  const overlapY = hit.h / 2 + r - Math.abs(dy);
  if (overlapX < overlapY) body.x += dx >= 0 ? overlapX : -overlapX;
  else body.y += dy >= 0 ? overlapY : -overlapY;
  return hit;
}

/** A free parking spot on a roadside, for a parked car. */
export function parkingSpot(random) {
  const { vertical, horizontal } = roadCentres();
  if (random() < 0.5) {
    const cx = pick(random, vertical);
    const y = GRID + random() * (WORLD.height - GRID * 2);
    return { x: cx + (random() < 0.5 ? -1 : 1) * (ROAD / 2 - 14), y, angle: 0 };
  }
  const cy = pick(random, horizontal);
  const x = GRID + random() * (WORLD.width - GRID * 2);
  return { x, y: cy + (random() < 0.5 ? -1 : 1) * (ROAD / 2 - 14), angle: Math.PI / 2 };
}
