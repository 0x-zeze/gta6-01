# Solstice City — an open-world crime game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0x-zeze/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0x-zeze/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

**Solstice City** takes place in **Port Aurora**, a sun-soaked harbour city —
and you are its newest runner. Lift cars off the avenues, outrun the harbour
police, and work five jobs for the Tide crew: a quiet first delivery at the
docks, a hot-car pickup, a heat-wave chase, trouble at the container yard,
and one long sunset getaway across the whole city.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no
network dependency — the game is plain static files under `game/`.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk (hold Shift to sprint) |
| E | Enter or steal the nearest car; exit the car you are driving |
| W / S + A / D | Accelerate, brake/reverse, steer — Space is the handbrake |
| Mouse | Aim, click to shoot |
| M | Mute / unmute |
| Enter / click | Start the game, or keep playing after Busted / Wasted |

## Features

- **A city to explore** — Port Aurora: a road-grid harbour city with towers,
  a central park, plazas, a beach strip and container docks. The whole city
  is generated from a seed, so every street is identical on every run.
- **Traffic and pedestrians** — cars follow the avenues and turn at crossings,
  parked cars wait to be stolen, and pedestrians stroll the sidewalks (and
  scatter when things get loud).
- **Cars to steal and drive** — sedans, taxis, vans and sportscars, each with
  its own handling. Stealing one raises the heat.
- **Wanted level 0–5** — crime brings police cars and foot cops. Stars cool
  off when you stay out of sight; get caught on foot and you are Busted.
- **Five story jobs** — *First Run*, *Hot Wheels*, *Heat Wave*,
  *Dockside Trouble* and *The Long Sunset*, with markers, a waypoint arrow,
  objective text and cash rewards. Finish them all for free roam.
- **Combat** — a pistol with ammo, hostile rivals who shoot back, and
  battered cars that smoke and explode.
- **HUD with a live minimap** — cash, health, wanted stars, ammo, speed, an
  objective panel, and a minimap tracking you, the police and the job marker.
- **Save and sound** — progress (cash, jobs) saves to localStorage
  automatically; every sound is synthesized live with WebAudio. There is a
  start screen, plus Busted / Wasted end cards.

## Tips bermain

- **Kejar bintang rendah, bukan nol.** One star is enough for the cops to
  notice you — but a short chase earns you a faster getaway car for free.
- **Parked sportscars are the prize.** Sedans are everywhere; a sportscar
  turns the sunset getaway from a crawl into a clean escape.
- **Hilang dari radar dulu.** When the stars are high, break line of sight
  and stay quiet — the wanted level cools off once the police lose you.
- **Ikuti panah waypoint.** Every job has a marker on the minimap and an
  arrow at the edge of the screen pointing to the objective.
- **Hemat peluru.** Ammo is limited and rivals shoot back — drive past a
  fight you do not need instead of standing in it.

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
