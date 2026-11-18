[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/0x-zeze/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/0x-zeze/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

# Vice Shores — an open-world crime game

A complete open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01): a sun-soaked coastal
city to explore on foot and by car, with traffic and pedestrians, cars to
steal, a wanted level and police who respond to it, missions and a story,
combat, a HUD with a minimap, a start screen and a save — all running offline
from static files in a desktop browser. No build step, no network request,
no library: plain canvas 2D and WebAudio, everything original.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

- **W A S D / arrows** — move on foot, drive in a car
- **E** — enter / exit a car (steal parked and traffic cars)
- **Mouse** — aim, **Click / Space** — shoot
- **Shift** — sprint on foot
- **P** — pause, **M** — mute

## The story

You are Kai, fresh out of the marina flats, with $120 and a borrowed name.
Rico runs the garage on Palm Row. Mara runs the docks. The police run
everything else. Five jobs stand between you and the big score:

1. **First Wheels** — steal a car and bring it to Rico's Garage.
2. **Courier Run** — three parcels, three drop-offs, one clock.
3. **Dockside Trouble** — clear the enforcers off Cargo Row.
4. **Getaway** — the whole precinct is coming; reach the hideout.
5. **The Big Score** — hit Shores Bank, grab the cash, and vanish.

Between jobs, taxi fares pay the bills, and cash, health and armor pickups
are scattered across the city. Progress saves automatically every few
seconds and on pause — continue it from the title screen.

## What is in the city

- A procedural coastal city: streets, blocks, beach, marina pier, docks,
  Palm Park, neon downtown, hospital and hideout.
- Traffic cars that follow the roads and turn at intersections, plus
  pedestrians with their own routines who flee gunfire.
- A wanted system (0–5 stars): stealing, hitting pedestrians and shooting
  raise the heat; police cars chase and ram you, foot officers try to bust
  you, and the heat cools off when you stay clean and out of sight.
- Combat on foot with mouse aim, armed dock enforcers who shoot back,
  car damage and explosions, health and armor.
- A HUD with cash, health and armor bars, wanted stars, the mission
  objective, a message banner, a speed readout — and a live minimap with
  the mission marker, the police and the player.
- Synthesized sound: engine hum, police sirens, gunshots, pickups and a
  bass-line music loop — all generated live with WebAudio, no audio files.

## Structure

```
game/
  index.html        page shell, canvas only
  src/
    main.js         boot, fixed-step loop, screens, save / continue
    world.js        simulation: player, cars, traffic, peds, police,
                    wanted, combat, pickups, missions, taxi jobs
    city.js         the generated city: roads, buildings, beach, docks
    missions.js     the five story missions and the side jobs
    render.js       camera, city drawing, HUD, minimap, menus
    input.js        keyboard + mouse
    audio.js        WebAudio synth: engine, siren, shots, music
    shots.js        the staged ?shot= scenes for the screenshots
    config.js       every tuning number and colour
    random.js       seeded RNG (mulberry32)
```

Everything in the game — the city, characters, vehicles, names, story, art
and sound — is original work made for this entry. No Rockstar Games name,
logo, character, map or asset is used.

## License

MIT — see [LICENSE](LICENSE).
