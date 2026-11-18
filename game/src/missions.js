// Vice Shores' story: five chained missions plus the side jobs that pay
// between them. Each mission is a small state machine over waypoints — go
// somewhere, do something, go somewhere else — with the briefing the HUD
// shows and the cash the player earns for finishing it.
import { LANDMARKS } from './city.js';
import { MONEY } from './config.js';

export const MISSION_COUNT = 5;

/**
 * The mission list, in story order. `steps` are waypoints: {kind, x, y, text}.
 * kinds: drive (reach the point), steal (be in any car), pickup (grab the
 * package), fight (defeat every enforcer at the point), escape (reach the
 * point while wanted), deliver (reach each drop point in turn).
 */
export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Rico',
    brief: 'Rico needs wheels. Steal any car on the street, then bring it to his garage.',
    steps: [
      { kind: 'steal', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, text: 'Steal a car — press E next to one' },
      { kind: 'drive', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, text: 'Drive the car to Rico\'s Garage' },
    ],
  },
  {
    id: 2,
    title: 'Courier Run',
    giver: 'Rico',
    brief: 'Three parcels, three drop-offs, one clock. The marina, the park and the hospital — go.',
    steps: [
      { kind: 'pickup', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, text: 'Pick up the parcels at Rico\'s Garage' },
      { kind: 'deliver', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, text: 'Drop-off 1 of 3: Sunset Quay marina' },
      { kind: 'deliver', x: LANDMARKS.park.x, y: LANDMARKS.park.y, text: 'Drop-off 2 of 3: Palm Park' },
      { kind: 'deliver', x: LANDMARKS.hospital.x, y: LANDMARKS.hospital.y, text: 'Drop-off 3 of 3: Shores General' },
    ],
  },
  {
    id: 3,
    title: 'Dockside Trouble',
    giver: 'Mara',
    brief: 'Mara\'s crew is pinned down at the docks. Clear the enforcers off Cargo Row — all of them.',
    steps: [
      { kind: 'drive', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, text: 'Get to the docks — Cargo Row' },
      { kind: 'fight', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, text: 'Clear the enforcers at the docks' },
    ],
  },
  {
    id: 4,
    title: 'Getaway',
    giver: 'Mara',
    brief: 'The job went loud. The whole precinct is coming. Lose the heat and make it to the hideout.',
    steps: [
      { kind: 'escape', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, text: 'Reach the hideout with the heat on you' },
    ],
  },
  {
    id: 5,
    title: 'The Big Score',
    giver: 'Rico & Mara',
    brief: 'One bank, one bag, one way out. Hit Shores Bank, grab the cash, and vanish into the hideout.',
    steps: [
      { kind: 'drive', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, text: 'Get to Shores Bank on Palm Row' },
      { kind: 'pickup', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, text: 'Grab the cash from the bank' },
      { kind: 'escape', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, text: 'Escape to the hideout — do not get caught' },
    ],
  },
];

/** The story beats shown on the title screen and between missions. */
export const STORY = [
  'Vice Shores — a sun-soaked coastal city where everybody owes somebody.',
  'You are Kai, fresh out of the marina flats, with $120 and a borrowed name.',
  'Rico runs the garage on Palm Row. Mara runs the docks. The police run everything else.',
  'Five jobs stand between you and the big score. Drive fast. Stay free.',
];

/** A taxi side job: a pedestrian flags you down; drive them to their marker. */
export function taxiJob(random, citySpots) {
  const spot = citySpots[Math.floor(random() * citySpots.length)];
  return { x: spot.x, y: spot.y, text: 'Taxi fare — drive the passenger to the marker', fare: MONEY.taxiFare };
}

/** Cash earned for finishing mission `index` (0-based). */
export function missionReward(index) {
  return MONEY.missionBonus[index] ?? 500;
}
