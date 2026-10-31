// Pure game rules shared by the browser build and the Node test suite.

export const LANE_COUNT = 3;
export const LANE_X = [-2.7, 0, 2.7];
export const START_SPEED = 17;
export const MAX_SPEED = 47;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;

// Frame-rate independent exponential smoothing.
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export function speedAt(distance) {
  return Math.min(MAX_SPEED, START_SPEED + Math.max(0, distance) * 0.0175);
}

export function difficultyAt(distance) {
  return clamp(distance / 1100, 0, 1);
}

export function scoreFor(distance, coins) {
  return Math.floor(Math.max(0, distance)) + Math.max(0, coins) * 10;
}

// Distance between obstacle rows. Kept long enough to always give the player
// a readable window to change lanes, even at top speed.
export function gapFor(speed, rng = Math.random) {
  return 25 + speed * 0.34 + rng() * 11;
}

function shuffledLanes(rng) {
  const lanes = [0, 1, 2];
  for (let i = lanes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

function pickHazardType(rng, difficulty) {
  const roll = rng();
  const trainWeight = 0.16 + difficulty * 0.24;
  if (roll < trainWeight) return 'train';
  if (roll < trainWeight + 0.46) return 'barrier';
  return 'gate';
}

/**
 * Produces one readable obstacle row. The contract is simple: at least one
 * lane always stays clear, and hard patterns only appear as difficulty rises.
 * Returns { hazards: [{ lane, type }], freeLane }.
 */
export function pickRow(rng, difficulty = 0) {
  const d = clamp(difficulty, 0, 1);
  const [freeLane, second, third] = shuffledLanes(rng);

  if (d < 0.08) {
    return {
      hazards: [{ lane: second, type: rng() < 0.62 ? 'barrier' : 'gate' }],
      freeLane,
    };
  }

  const roll = rng();
  if (roll < 0.4 - d * 0.12) {
    return { hazards: [{ lane: second, type: pickHazardType(rng, d) }], freeLane };
  }

  if (roll < 0.74) {
    return {
      hazards: [
        { lane: second, type: pickHazardType(rng, d) },
        { lane: third, type: pickHazardType(rng, d) },
      ],
      freeLane,
    };
  }

  if (roll < 0.9) {
    return {
      hazards: [
        { lane: second, type: 'train' },
        { lane: third, type: 'train' },
      ],
      freeLane,
    };
  }

  const mixed = rng() < 0.5 ? ['train', 'barrier'] : ['train', 'gate'];
  return {
    hazards: [
      { lane: second, type: mixed[0] },
      { lane: third, type: mixed[1] },
    ],
    freeLane,
  };
}

/**
 * Player is described by feet height and whether they are sliding.
 * Gate clearance is 1.62m, barrier clearance is 0.98m.
 */
export function obstacleHitsPlayer(hazard, player) {
  if (!hazard || hazard.lane !== player.lane) return false;

  const depth = hazard.depth ?? (hazard.type === 'train' ? 18 : 1.1);
  if (Math.abs(hazard.z) > depth / 2 + 0.48) return false;

  const playerHeight = player.sliding ? 1.08 : 2.08;
  const playerTop = player.y + playerHeight;

  if (hazard.type === 'train') return true;
  if (hazard.type === 'barrier') return player.y < 0.98;
  if (hazard.type === 'gate') {
    return playerTop > 1.62 && player.y < 2.35;
  }
  return false;
}

export function laneIndexForX(x) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < LANE_X.length; i += 1) {
    const distance = Math.abs(LANE_X[i] - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

export function formatNumber(value) {
  return Math.floor(value).toLocaleString('en-US');
}

export function formatScore(value) {
  return Math.floor(value).toString().padStart(6, '0');
}
