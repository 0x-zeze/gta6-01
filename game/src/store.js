// Solstice City — save slot. One JSON blob in localStorage: cash, mission progress,
// best getaway time and the mute flag. Loading never throws: a bad blob is a fresh game.
import { CFG, MONEY } from './settings.js';

export function freshSave() {
  return {
    cash: MONEY.startCash,
    missionIndex: 0,
    missionsDone: [],
    upgrades: { engine: 0, armor: 0, ammo: 0 },
    bestEscape: null,
    muted: false,
    gamesPlayed: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return freshSave();
    const data = JSON.parse(raw);
    const save = freshSave();
    if (typeof data.cash === 'number') save.cash = Math.max(0, Math.floor(data.cash));
    if (typeof data.missionIndex === 'number') save.missionIndex = data.missionIndex;
    if (Array.isArray(data.missionsDone)) save.missionsDone = data.missionsDone;
    if (data.upgrades && typeof data.upgrades === 'object') {
      for (const k of ['engine', 'armor', 'ammo']) {
        if (typeof data.upgrades[k] === 'number') {
          save.upgrades[k] = Math.max(0, Math.min(3, Math.floor(data.upgrades[k])));
        }
      }
    }
    if (typeof data.bestEscape === 'number') save.bestEscape = data.bestEscape;
    if (typeof data.muted === 'boolean') save.muted = data.muted;
    if (typeof data.gamesPlayed === 'number') save.gamesPlayed = data.gamesPlayed;
    return save;
  } catch (_err) {
    return freshSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(save));
  } catch (_err) {
    // Storage full or blocked (private mode): the game still plays, it just forgets.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CFG.saveKey);
  } catch (_err) {
    /* ignore */
  }
}
