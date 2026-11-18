// Solstice City — staged screenshot scenes. A ?shot= query skips the title screen
// and drops the player into a moment that shows several systems at once: the city,
// a car, the police, a live minimap and an active job. The page flags
// window.__shotReady once the scene has settled, so a headless browser can shoot it.
import { makeCar, raiseWanted } from './actors.js';
import { startJob } from './jobs.js';

export function setupShot(G, startGame, params) {
  const shot = params.get('shot');
  if (!shot) return;

  const settle = (ms) => {
    setTimeout(() => { window.__shotReady = true; }, ms);
  };

  if (shot === 'start') {
    // Title screen exactly as a player sees it. No game start.
    settle(600);
    return;
  }

  // Every other scene plays the game, no title.
  G.sound.ensure = () => {};
  startGame(false);

  if (shot === 'drive') {
    // Behind the wheel on a long avenue, traffic ahead, park to the side.
    const car = G.cars.find((c) => c.driver === 'parked' && c.kind === 'sedan')
      || G.cars.find((c) => c.driver === 'parked');
    if (car) {
      car.x = G.town.lines[3];
      car.y = G.town.lines[5] + 200;
      car.angle = -Math.PI / 2;
      car.driver = 'player';
      G.player.car = car;
      G.player.onFoot = false;
      car.speed = 320;
      G.player.x = car.x;
      G.player.y = car.y;
      G.camera.x = car.x;
      G.camera.y = car.y + 120;
    }
    G.flash = '';
    G.flashTimer = 0;
    G.autoDrive = true;
    settle(1800);
    return;
  }

  if (shot === 'chase') {
    // The cover: a police chase at wanted level 4, job 5 active, sirens everywhere.
    const car = G.cars.find((c) => c.driver === 'parked' && c.kind === 'sport')
      || makeCar('sport', G.town.lines[4], G.town.lines[4], 0, '#c0392b');
    if (!G.cars.includes(car)) G.cars.push(car);
    car.x = G.town.lines[4];
    car.y = G.town.lines[4];
    car.angle = Math.PI / 2;
    car.driver = 'player';
    car.speed = 380;
    G.player.car = car;
    G.player.onFoot = false;
    G.player.x = car.x;
    G.player.y = car.y;
    G.camera.x = car.x;
    G.camera.y = car.y;
    G.player.hp = 78;
    raiseWanted(G, 4, 'staged chase');
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i - 1) * 0.7;
      const cop = makeCar('cop', car.x + Math.cos(a + Math.PI) * 190, car.y + Math.sin(a + Math.PI) * 190, a, '#1c3a5e');
      cop.driver = 'police';
      cop.speed = 620;
      G.copCars.push(cop);
      G.cars.push(cop);
    }
    if (G.mission) G.mission = null;
    startJob(G, 4);
    G.flash = 'THE LONG SUNSET — lose the heat!';
    G.flashTimer = 5;
    G.autoDrive = true;
    settle(1400);
    return;
  }

  if (shot === 'mission') {
    // On foot at the docks, job 4 in progress: rivals, crates, and the marker.
    G.player.x = G.town.dockLeft - 160;
    G.player.y = G.town.lines[3];
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    G.player.aimAngle = 0;
    if (G.mission) G.mission = null;
    startJob(G, 3);
    // Rival runners visible right in frame.
    for (const ped of G.peds) {
      if (ped.hostile && ped.alive) {
        ped.x = G.player.x + 180 + Math.random() * 120;
        ped.y = G.player.y - 90 + Math.random() * 180;
      }
    }
    settle(2000);
    return;
  }

  settle(1200);
}
