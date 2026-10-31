import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANE_X,
  MAX_SPEED,
  START_SPEED,
  difficultyAt,
  formatScore,
  gapFor,
  obstacleHitsPlayer,
  pickRow,
  scoreFor,
  speedAt,
} from '../js/logic.js';

function seededRng(seed = 7) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test('speed ramps up and caps', () => {
  assert.equal(speedAt(0), START_SPEED);
  assert.ok(speedAt(200) > START_SPEED);
  assert.equal(speedAt(999999), MAX_SPEED);
});

test('difficulty stays in range', () => {
  assert.equal(difficultyAt(-50), 0);
  assert.equal(difficultyAt(4000), 1);
  assert.ok(difficultyAt(500) > 0.4);
});

test('row gaps grow with speed and stay fair', () => {
  const slow = gapFor(17, () => 0.5);
  const fast = gapFor(47, () => 0.5);
  assert.ok(fast > slow);
  assert.ok(slow >= 25);
});

test('every generated row leaves at least one clear lane', () => {
  const rng = seededRng(123);
  for (let i = 0; i < 3000; i += 1) {
    const difficulty = rng();
    const row = pickRow(rng, difficulty);
    const lanes = row.hazards.map((hazard) => hazard.lane);
    assert.equal(new Set(lanes).size, lanes.length, 'no stacked hazards in one lane');
    assert.ok(row.freeLane >= 0 && row.freeLane <= 2);
    assert.ok(!lanes.includes(row.freeLane), 'free lane is actually free');
    assert.ok(row.hazards.length >= 1 && row.hazards.length <= 2);
    for (const hazard of row.hazards) {
      assert.ok(['train', 'barrier', 'gate'].includes(hazard.type));
      assert.ok(LANE_X[hazard.lane] !== undefined);
    }
  }
});

test('opening difficulty only uses one hazard', () => {
  const rng = seededRng(99);
  for (let i = 0; i < 200; i += 1) {
    assert.equal(pickRow(rng, 0).hazards.length, 1);
  }
});

test('barrier must be jumped', () => {
  const hazard = { lane: 1, type: 'barrier', z: 0 };
  assert.equal(obstacleHitsPlayer(hazard, { lane: 1, y: 0, sliding: false }), true);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 1, y: 0, sliding: true }), true);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 1, y: 1.2, sliding: false }), false);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 0, y: 0, sliding: false }), false);
});

test('overhead gate must be rolled under', () => {
  const hazard = { lane: 2, type: 'gate', z: 0 };
  assert.equal(obstacleHitsPlayer(hazard, { lane: 2, y: 0, sliding: false }), true);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 2, y: 0, sliding: true }), false);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 2, y: 1, sliding: false }), true);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 1, y: 0, sliding: false }), false);
});

test('trains are lethal across their whole length', () => {
  const hazard = { lane: 0, type: 'train', z: -7, depth: 18 };
  assert.equal(obstacleHitsPlayer(hazard, { lane: 0, y: 0, sliding: false }), true);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 0, y: 2, sliding: false }), true);
  assert.equal(obstacleHitsPlayer(hazard, { lane: 1, y: 0, sliding: false }), false);
  assert.equal(
    obstacleHitsPlayer({ ...hazard, z: 15 }, { lane: 0, y: 0, sliding: false }),
    false
  );
});

test('score and formatting are stable', () => {
  assert.equal(scoreFor(100.9, 3), 130);
  assert.equal(scoreFor(-4, -2), 0);
  assert.equal(formatScore(42), '000042');
});
