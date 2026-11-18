// Solstice City — the story. Five jobs for the Tide crew, told in order: a first
// run for the fixer, a hot car for the garage, a heat wave to outrun, trouble on
// the docks, and one long sunset getaway. Each job is a chain of steps — go there,
// grab that, survive this — with a marker on the map and a line on the HUD.
import { CFG, MONEY } from './settings.js';
import { makeCar, raiseWanted, spawnPickupSparkle } from './actors.js';
import { PALETTE } from './settings.js';

function stepGoto(label, x, y, radius = 46) {
  return { kind: 'goto', label, x, y, radius, done: false };
}

function stepCollect(label, points, radius = 40) {
  return { kind: 'collect', label, points: points.map((p) => ({ ...p, got: false })), radius, done: false };
}

function stepSurvive(label, seconds) {
  return { kind: 'survive', label, seconds, left: seconds, done: false };
}

function stepFight(label, count) {
  return { kind: 'fight', label, count, left: count, done: false };
}

function stepSteal(label) {
  return { kind: 'steal', label, done: false };
}

export function buildJobs(G) {
  const T = G.town;
  const L = T.lines;
  const jobs = [
    {
      id: 0,
      title: 'First Run',
      giver: 'Marisol — the fixer',
      brief: 'The Tide needs a runner. Meet Marisol’s courier at the east docks, take the case, and drop it at the old pier. Keep it quiet.',
      steps: [
        stepGoto('Meet the courier at the docks', T.docks.x - 60, T.docks.y),
        stepGoto('Drop the case at the old pier', T.pier.x, T.pier.y - 40),
      ],
      reward: MONEY.missionRewards[0],
    },
    {
      id: 1,
      title: 'Hot Wheels',
      giver: 'Dante — the garage',
      brief: 'Dante wants a sportscar, no questions, no receipt. A red one is parked near the park. Take it — the owner will understand eventually — and bring it to the garage.',
      steps: [
        stepSteal('Steal the red sportscar near the park'),
        stepGoto('Deliver it to Dante’s garage', T.garage.x, T.garage.y),
      ],
      reward: MONEY.missionRewards[1],
    },
    {
      id: 2,
      title: 'Heat Wave',
      giver: 'Marisol — the fixer',
      brief: 'Somebody talked. The whole harbour precinct is looking for you. Lose them — stay out of sight until the heat dies down.',
      steps: [stepSurvive('Lose the police — stay clear until the heat fades', 40)],
      reward: MONEY.missionRewards[2],
      onStart(G2) {
        raiseWanted(G2, 3, 'somebody talked');
      },
    },
    {
      id: 3,
      title: 'Dockside Trouble',
      giver: 'The Tide — the crew',
      brief: 'Rival runners are shaking down the docks. Clear them out, then grab the three crates they were guarding before the harbour police arrive.',
      steps: [
        stepFight('Clear out the rival runners', 5),
        stepCollect('Grab the three crates', [
          { x: T.dockLeft + 90, y: L[2] },
          { x: T.dockLeft + 150, y: L[4] },
          { x: T.dockLeft + 70, y: L[5] },
        ]),
      ],
      reward: MONEY.missionRewards[3],
      onStart(G2) {
        spawnRivals(G2, 5);
      },
    },
    {
      id: 4,
      title: 'The Long Sunset',
      giver: 'Marisol — the fixer',
      brief: 'One last run before the sun goes down: three checkpoints across the whole city, then vanish. The precinct will not make it easy.',
      steps: [
        stepGoto('Checkpoint 1 — north gate', L[1], L[1]),
        stepGoto('Checkpoint 2 — the park', L[4], L[4]),
        stepGoto('Checkpoint 3 — south beach road', L[7], T.beachTop - 120),
        stepSurvive('Vanish — lose the heat', 25),
      ],
      reward: MONEY.missionRewards[4],
      onStart(G2) {
        raiseWanted(G2, 4, 'the long sunset');
      },
    },
  ];
  return jobs;
}

function spawnRivals(G, count) {
  const T = G.town;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    G.peds.push({
      x: T.dockLeft + 110 + Math.cos(a) * 90,
      y: T.lines[3] + Math.sin(a) * 90,
      angle: a,
      speed: CFG.pedSpeed * 1.9,
      shirt: '#8e2f2f',
      hp: 100,
      alive: true,
      hostile: true,
      targetX: 0, targetY: 0, wait: 0,
      shootTimer: 0.6 + i * 0.25,
      flee: 0,
      fleeX: 0, fleeY: 0,
    });
  }
}

export function startJob(G, index) {
  const jobs = G.jobs;
  if (index >= jobs.length) return null;
  const job = jobs[index];
  job.steps.forEach((s) => {
    s.done = false;
    if (s.kind === 'survive') s.left = s.seconds;
    if (s.kind === 'fight') s.left = s.count;
    if (s.kind === 'collect') s.points.forEach((p) => { p.got = false; });
  });
  job.stepIndex = 0;
  job.active = true;
  G.mission = {
    job,
    onKill(G2, who) {
      const step = job.steps[job.stepIndex];
      if (step && step.kind === 'fight' && (who === 'rival' || who === 'cop')) {
        step.left -= 1;
        if (step.left <= 0) step.done = true;
      }
    },
  };
  if (job.id === 1) spawnHotCar(G);
  if (job.onStart) job.onStart(G);
  G.flash = `New job: ${job.title} — ${job.giver}`;
  G.flashTimer = 4;
  G.sound.jingle();
  return job;
}

function spawnHotCar(G) {
  const T = G.town;
  const car = makeCar('sport', T.lines[4] + 130, T.lines[4] - 60, 0, '#c0392b');
  car.driver = 'parked';
  G.cars.push(car);
  G.hotCar = car;
}

export function currentStep(G) {
  const job = G.mission && G.mission.job;
  if (!job || !job.active) return null;
  return job.steps[job.stepIndex] || null;
}

export function updateJobs(G, dt) {
  const job = G.mission && G.mission.job;
  if (!job || !job.active) return;
  const step = job.steps[job.stepIndex];
  if (!step) return;
  const px = G.player.x;
  const py = G.player.y;

  if (step.kind === 'goto') {
    if (Math.hypot(px - step.x, py - step.y) < step.radius) {
      step.done = true;
      G.sound.pickup();
      spawnPickupSparkle(G, step.x, step.y);
    }
  } else if (step.kind === 'collect') {
    for (const p of step.points) {
      if (!p.got && Math.hypot(px - p.x, py - p.y) < step.radius) {
        p.got = true;
        G.sound.pickup();
        spawnPickupSparkle(G, p.x, p.y);
        G.save.cash += 50;
      }
    }
    if (step.points.every((p) => p.got)) step.done = true;
  } else if (step.kind === 'survive') {
    step.left -= dt;
    if (G.wanted === 0 && step.left > 0) step.left -= dt * 2; // hiding pays off faster
    if (step.left <= 0) step.done = true;
  } else if (step.kind === 'fight') {
    if (step.left <= 0) step.done = true;
  } else if (step.kind === 'steal') {
    if (G.player.car === G.hotCar) {
      step.done = true;
      G.sound.jingle();
    }
  }

  if (step.done) {
    job.stepIndex += 1;
    if (job.stepIndex >= job.steps.length) {
      finishJob(G, job);
    } else {
      G.flash = `Next: ${job.steps[job.stepIndex].label}`;
      G.flashTimer = 3;
      G.sound.pickup();
    }
  }
}

function finishJob(G, job) {
  job.active = false;
  G.save.cash += job.reward;
  if (!G.save.missionsDone.includes(job.id)) G.save.missionsDone.push(job.id);
  G.save.missionIndex = Math.min(job.id + 1, G.jobs.length);
  G.saveDirty = true;
  G.flash = `Job complete: ${job.title} — +$${job.reward}`;
  G.flashTimer = 4;
  G.sound.jingle();
  G.wanted = Math.max(0, G.wanted - 1);
  if (job.id === G.jobs.length - 1) {
    G.state = 'complete';
    G.sound.fanfare();
    G.mission = null;
  } else {
    // Chain straight into the next job — the Tide always has more work.
    startJob(G, job.id + 1);
    G.flash = `Job complete: ${job.title} — +$${job.reward}`;
    G.flashTimer = 4;
  }
}

export function jobMarker(G) {
  const step = currentStep(G);
  if (!step) return null;
  if (step.kind === 'goto') return { x: step.x, y: step.y, label: step.label };
  if (step.kind === 'collect') {
    const next = step.points.find((p) => !p.got);
    return next ? { x: next.x, y: next.y, label: step.label } : null;
  }
  if (step.kind === 'steal' && G.hotCar) {
    return { x: G.hotCar.x, y: G.hotCar.y, label: step.label };
  }
  return null;
}
