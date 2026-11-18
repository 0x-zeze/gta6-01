// Vice Shores — every tuning number and colour in one place.
// The world is a fixed 3600 x 2600 open city; the camera shows a 1280 x 720
// window of it, scaled to the browser window, so no rule depends on screen size.

export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Streets run on this grid pitch; blocks sit between the roads. */
export const GRID = 400;
export const ROAD = 96;

export const PLAYER = {
  radius: 13,
  walk: 230,
  sprint: 350,
  health: 100,
  armor: 50,
  punchDamage: 12,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 2.2,
  health: 100,
};

export const TRAFFIC = { count: 26, speed: 150, speedJitter: 60 };
export const PEDS = { count: 34, speed: 55, speedJitter: 30 };
export const POLICE = { carSpeed: 520, footSpeed: 250, bustTime: 1.4 };

export const WANTED = {
  max: 5,
  decaySeconds: 14,
  // Police units on the street at each wanted level (cars, then foot officers).
  cars: [0, 1, 2, 3, 4, 5],
  foot: [0, 0, 1, 2, 3, 4],
};

export const BULLET = { speed: 900, damage: 34, range: 520, fireRate: 0.22 };
export const ENEMY = { health: 60, damage: 9, fireRate: 1.1, range: 420 };

export const MONEY = { start: 120, taxiFare: 180, pickup: 60, missionBonus: [400, 600, 900, 1200, 2500] };

export const PALETTE = {
  backdrop: '#0d1520',
  grass: '#3f7d4a',
  grassDark: '#356b3f',
  sand: '#d9c27a',
  water: '#1d6f8e',
  waterDeep: '#155a75',
  road: '#2b2f36',
  roadEdge: '#3a3f47',
  lane: '#d8c95a',
  sidewalk: '#8d9299',
  building: ['#c96f4a', '#4a7a96', '#8a6fb0', '#b0a05a', '#5a9a7a', '#96505a', '#6a7a8a', '#c98a4a'],
  buildingRoof: '#2e3440',
  glass: '#9fd8e8',
  tree: '#2c6b34',
  treeDark: '#235a2b',
  park: '#4a8a52',
  dock: '#7a6a52',
  pier: '#8a7a5e',
  player: '#f2c94c',
  playerShirt: '#e5534b',
  ped: ['#e8e0d0', '#7ab0d8', '#d88ab0', '#a0d88a', '#d8b06a', '#b08ad8'],
  police: '#2a4a8a',
  policeCar: '#1e3a6e',
  taxi: '#f2c230',
  hud: '#eef1f5',
  hudPanel: 'rgba(10, 16, 26, 0.72)',
  hudAccent: '#f2c94c',
  star: '#ffd94a',
  starEmpty: '#5a6270',
  health: '#4ade80',
  armor: '#60a5fa',
  danger: '#ef4444',
  mission: '#f2c94c',
  text: '#eef1f5',
  muted: '#9aa3b0',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash, mission, position) is kept between visits (this browser only). */
export const SAVE_KEY = 'vice-shores.save.v1';
export const BEST_KEY = 'vice-shores.best.v1';
