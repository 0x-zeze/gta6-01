// Solstice City — Port Aurora, a sun-soaked harbour city built on a road grid.
// The builder lays out avenues, blocks, towers, a central park, a beach strip on
// the south shore and container docks on the east edge, then answers the questions
// the rest of the game asks: is this point on a road, inside a building, on sand?
import { CFG, PALETTE } from './settings.js';
import { clamp } from './rng.js';

export function buildTown(rng) {
  const size = CFG.worldSize;
  const gap = CFG.roadGap;
  const half = CFG.roadWidth / 2;

  // Avenues run both ways; the first and last ring the city.
  const lines = [];
  for (let p = gap / 2; p < size; p += gap) lines.push(p);

  const buildings = [];
  const parks = [];
  const plazas = [];
  const roofColors = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

  const beachTop = size - 260; // everything south of here is sand, then water
  const dockLeft = size - 300; // east strip is the container docks

  for (let ix = 0; ix < lines.length - 1; ix++) {
    for (let iy = 0; iy < lines.length - 1; iy++) {
      const x0 = lines[ix] + half + 14;
      const x1 = lines[ix + 1] - half - 14;
      const y0 = lines[iy] + half + 14;
      const y1 = lines[iy + 1] - half - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const blockW = x1 - x0;
      const blockH = y1 - y0;

      // South row is beach; east column is docks; centre block is the park.
      if (y0 >= beachTop) continue;
      if (x0 >= dockLeft) continue;
      if (ix === 4 && iy === 4) {
        parks.push({ x: x0, y: y0, w: blockW, h: blockH });
        continue;
      }
      if (rng.chance(0.12)) {
        plazas.push({ x: x0, y: y0, w: blockW, h: blockH });
        continue;
      }

      // 1–4 towers per block, each with pre-rolled window dots.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.5) ? 2 : 1;
      const cw = blockW / cols;
      const ch = blockH / rows;
      for (let a = 0; a < cols; a++) {
        for (let b = 0; b < rows; b++) {
          if (rng.chance(0.14)) continue; // empty lot / garden
          const w = cw * rng.range(0.62, 0.86);
          const h = ch * rng.range(0.62, 0.86);
          const x = x0 + a * cw + (cw - w) / 2;
          const y = y0 + b * ch + (ch - h) / 2;
          const windows = [];
          const nx = Math.max(1, Math.floor(w / 26));
          const ny = Math.max(1, Math.floor(h / 26));
          for (let wx = 0; wx < nx; wx++) {
            for (let wy = 0; wy < ny; wy++) {
              if (rng.chance(0.55)) windows.push([x + 8 + wx * 24, y + 8 + wy * 24]);
            }
          }
          buildings.push({
            x, y, w, h,
            color: rng.pick(roofColors),
            tall: rng.chance(0.3),
            windows,
          });
        }
      }
      void cx; void cy;
    }
  }

  const town = {
    size,
    lines,
    buildings,
    parks,
    plazas,
    beachTop,
    dockLeft,
    spawn: { x: lines[2], y: lines[6] },
    garage: { x: lines[1], y: lines[1] },
    docks: { x: dockLeft + 120, y: lines[3] },
    hospital: { x: lines[6], y: lines[2] },
    pier: { x: lines[4], y: beachTop + 130 },
  };

  town.onRoad = (x, y) => {
    if (x < 0 || y < 0 || x > size || y > size) return false;
    for (const p of lines) {
      if (Math.abs(x - p) <= half) return true;
      if (Math.abs(y - p) <= half) return true;
    }
    return false;
  };

  town.inBuilding = (x, y, pad = 0) => {
    for (const b of buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  };

  town.onSand = (x, y) => y >= beachTop && y < size - 60;
  town.inWater = (x, y) => y >= size - 60;
  town.inDocks = (x, y) => x >= dockLeft && y < beachTop;

  // Snap a point onto the nearest avenue centreline (traffic spawns here).
  town.nearestRoad = (x, y) => {
    let bx = lines[0];
    let by = lines[0];
    for (const p of lines) {
      if (Math.abs(p - x) < Math.abs(bx - x)) bx = p;
      if (Math.abs(p - y) < Math.abs(by - y)) by = p;
    }
    return Math.abs(bx - x) < Math.abs(by - y) ? { x: bx, y } : { x, y: by };
  };

  town.randomRoadPoint = () => {
    const vertical = rng.chance(0.5);
    const line = rng.pick(lines);
    const along = rng.range(gap, size - gap);
    return vertical ? { x: line, y: along } : { x: along, y: line };
  };

  town.randomSidewalkPoint = () => {
    const p = town.randomRoadPoint();
    const off = half + 14;
    if (rng.chance(0.5)) p.x = clamp(p.x + (rng.chance(0.5) ? off : -off), 40, size - 40);
    else p.y = clamp(p.y + (rng.chance(0.5) ? off : -off), 40, size - 40);
    return p;
  };

  town.clampToWorld = (x, y, m = 24) => ({
    x: clamp(x, m, size - m),
    y: clamp(y, m, size - m),
  });

  return town;
}
