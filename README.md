# Solstice City — an open-world crime game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0x-zeze/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0x-zeze/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

**Port Aurora** is a sun-soaked harbour city, and you are its newest runner.
Steal cars off the avenues, outrun the harbour police, and run five jobs for
the Tide crew — from a first quiet delivery at the docks to one long sunset
getaway across the whole city.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no
network: the game is plain static files under `game/`.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk (Shift to sprint) |
| E | Enter / steal the nearest car, exit a car |
| W/S + A/D | Drive, steer — Space brakes |
| Mouse | Aim, click to shoot |
| M | Mute |
| Enter / click | Start, or keep playing after Busted / Wasted |

## What is in the game

- **A city to explore** — Port Aurora: a road-grid harbour city with towers,
  a central park, plazas, a beach strip and container docks, all generated
  from a seed so every street is the same every run.
- **Traffic and pedestrians** — cars follow the avenues and turn at crossings,
  parked cars wait to be stolen, pedestrians stroll the sidewalks (and flee
  when things get loud).
- **Cars to steal and drive** — sedans, taxis, vans and sportscars, each with
  its own handling; stealing one raises the heat.
- **Wanted level 0–5** — crime brings police cars and foot cops. Stars cool
  off when you stay out of sight; get caught on foot and you are Busted.
- **Five story jobs** — *First Run*, *Hot Wheels*, *Heat Wave*,
  *Dockside Trouble* and *The Long Sunset*, with markers, a waypoint arrow,
  objective text and cash rewards. Finish them all for free roam.
- **Combat** — a pistol with ammo, hostile rivals who shoot back, battered
  cars that smoke and explode.
- **HUD with a live minimap** — cash, health, wanted stars, ammo, speed,
  objective panel, and a minimap tracking you, the police and the job marker.
- **Start screen, save, sound** — progress (cash, jobs) saves to localStorage
  automatically; every sound is synthesized live with WebAudio.

## Files

- `game/index.html` — the page, one canvas.
- `game/src/boot.js` — builds the world, runs the loop, owns the player.
- `game/src/town.js` — Port Aurora: avenues, blocks, park, beach, docks.
- `game/src/actors.js` — traffic, pedestrians, police, bullets, wanted system.
- `game/src/jobs.js` — the five Tide jobs and their steps.
- `game/src/paint.js` — world rendering, HUD, live minimap, title/end cards.
- `game/src/sound.js` — WebAudio synth: engine, sirens, shots, jingles.
- `game/src/settings.js` — tuning numbers and the city palette.
- `game/src/rng.js` — the seeded generator behind the city.
- `game/src/keys.js` — keyboard + mouse input.
- `game/src/store.js` — the localStorage save slot.
- `game/src/stage.js` — staged screenshot scenes (`?shot=start|drive|chase|mission`).
- `main.ts` — hands the entry in: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `shots.json` — the four screenshot scenes and their seeds.

## Screenshots

Four real renders of the game in a headless browser: the title screen, driving
down an avenue, a four-star police chase (the cover), and the dockside job.

## Originality

Everything here is invented: Port Aurora, the Tide crew, Marisol, Dante, the
streets and the story. Nothing is taken from any commercial game.
