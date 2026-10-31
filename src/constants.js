export const ARENA = {
  halfW: 34,
  halfL: 52,
  wallH: 20,
  goalHalfW: 11,
  goalH: 8.6,
  goalDepth: 7,
  ballR: 2.05,
  carHalf: { x: 1.16, y: 0.72, z: 2.2 },
  carCenterY: 0.95,
  gravity: 24,
  ceiling: 30,
};

export const TEAM = {
  blue: {
    name: 'BLUE',
    color: 0x35c8ff,
    deep: 0x0a5bff,
    glow: '#3dd2ff',
    css: '#3dd2ff',
    goalZ: ARENA.halfL,
    enemyGoalZ: -ARENA.halfL,
  },
  red: {
    name: 'RED',
    color: 0xff406e,
    deep: 0xd40f3e,
    glow: '#ff406e',
    css: '#ff406e',
    goalZ: -ARENA.halfL,
    enemyGoalZ: ARENA.halfL,
  },
};

export const ITEMS = {
  mushroom: { name: 'MUSHROOM', icon: '🍄', color: '#ff5b4d', desc: 'Speed burst' },
  green: { name: 'GREEN SHELL', icon: '🐢', color: '#4ade80', desc: 'Bounce shot' },
  red: { name: 'RED SHELL', icon: '🎯', color: '#ff406e', desc: 'Homing shot' },
  banana: { name: 'BANANA', icon: '🍌', color: '#ffe14a', desc: 'Drop trap' },
  star: { name: 'STAR', icon: '⭐', color: '#ffd93d', desc: 'Invincibility' },
  lightning: { name: 'LIGHTNING', icon: '⚡', color: '#a78bfa', desc: 'Shrink rivals' },
  bomb: { name: 'BOB-OMB', icon: '💣', color: '#f97316', desc: 'Blast zone' },
};

export const ITEM_TABLE = [
  { value: 'mushroom', weight: 19 },
  { value: 'green', weight: 20 },
  { value: 'red', weight: 16 },
  { value: 'banana', weight: 19 },
  { value: 'star', weight: 10 },
  { value: 'bomb', weight: 10 },
  { value: 'lightning', weight: 6 },
];

export const MATCH = {
  duration: 180,
  overtime: 60,
  goalCelebration: 3.4,
  countdown: 3.2,
};
