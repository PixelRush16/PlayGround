import { ARENA } from './constants.js';
import { clamp } from './utils.js';

/**
 * Resolve a moving sphere/point against the arena shell.
 * Mutates pos and vel. Returns true when a collision happened.
 */
export function collideArena(pos, vel, radius, restitution = 0.58, allowGoals = true) {
  let hit = false;

  const limitX = ARENA.halfW - radius;
  if (pos.x > limitX) {
    pos.x = limitX;
    if (vel.x > 0) vel.x *= -restitution;
    hit = true;
  } else if (pos.x < -limitX) {
    pos.x = -limitX;
    if (vel.x < 0) vel.x *= -restitution;
    hit = true;
  }

  const inGoalMouth =
    allowGoals &&
    Math.abs(pos.x) < ARENA.goalHalfW - radius * 0.2 &&
    pos.y < ARENA.goalH - radius * 0.2;
  const limitZ = ARENA.halfL - radius;

  if (Math.abs(pos.z) > limitZ) {
    if (!inGoalMouth) {
      pos.z = Math.sign(pos.z) * limitZ;
      if (Math.sign(vel.z) === Math.sign(pos.z)) vel.z *= -restitution;
      hit = true;
    } else {
      const dir = Math.sign(pos.z);
      const back = ARENA.halfL + ARENA.goalDepth - radius;
      if (Math.abs(pos.z) > back) {
        pos.z = dir * back;
        if (Math.sign(vel.z) === dir) vel.z *= -restitution * 0.6;
        hit = true;
      }
      const limitGX = ARENA.goalHalfW - radius;
      if (Math.abs(pos.x) > limitGX) {
        pos.x = Math.sign(pos.x) * limitGX;
        if (Math.sign(vel.x) === Math.sign(pos.x)) vel.x *= -restitution * 0.7;
        hit = true;
      }
      const limitGY = ARENA.goalH - radius;
      if (pos.y > limitGY) {
        pos.y = limitGY;
        if (vel.y > 0) vel.y *= -restitution * 0.7;
        hit = true;
      }
    }
  }

  if (pos.y > ARENA.ceiling - radius) {
    pos.y = ARENA.ceiling - radius;
    if (vel.y > 0) vel.y *= -restitution;
    hit = true;
  }

  return hit;
}

/**
 * Sphere against an oriented car box. Returns a world-space contact normal
 * and the penetration depth, or null.
 */
export function sphereBoxContact(ballPos, carPos, yaw, half, radius) {
  const cy = carPos.y + ARENA.carCenterY;
  const rx = ballPos.x - carPos.x;
  const ry = ballPos.y - cy;
  const rz = ballPos.z - carPos.z;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const lx = rx * cos - rz * sin;
  const lz = rx * sin + rz * cos;

  const px = clamp(lx, -half.x, half.x);
  const py = clamp(ry, -half.y, half.y);
  const pz = clamp(lz, -half.z, half.z);
  let dx = lx - px;
  let dy = ry - py;
  let dz = lz - pz;
  let dist = Math.hypot(dx, dy, dz);
  if (dist >= radius) return null;

  if (dist < 1e-5) {
    dx = 0;
    dy = 1;
    dz = 0;
    dist = 1;
  }
  const nlx = dx / dist;
  const nly = dy / dist;
  const nlz = dz / dist;
  return {
    nx: nlx * cos + nlz * sin,
    ny: nly,
    nz: -nlx * sin + nlz * cos,
    penetration: radius - dist,
  };
}

/** Vertical goal post collision. */
export function collideSpherePost(pos, vel, radius, cx, cz, postR, top, restitution = 0.72) {
  if (pos.y - radius > top) return false;
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const minDist = radius + postR;
  const dist = Math.hypot(dx, dz);
  if (dist >= minDist || dist < 1e-5) return false;
  const nx = dx / dist;
  const nz = dz / dist;
  pos.x = cx + nx * minDist;
  pos.z = cz + nz * minDist;
  const vn = vel.x * nx + vel.z * nz;
  if (vn < 0) {
    vel.x -= nx * vn * (1 + restitution);
    vel.z -= nz * vn * (1 + restitution);
  }
  return true;
}

/** Horizontal crossbar collision (bar runs along X). */
export function collideSphereBar(pos, vel, radius, barY, barZ, barR, restitution = 0.72) {
  if (Math.abs(pos.x) > ARENA.goalHalfW + barR) return false;
  const dy = pos.y - barY;
  const dz = pos.z - barZ;
  const minDist = radius + barR;
  const dist = Math.hypot(dy, dz);
  if (dist >= minDist || dist < 1e-5) return false;
  const ny = dy / dist;
  const nz = dz / dist;
  pos.y = barY + ny * minDist;
  pos.z = barZ + nz * minDist;
  const vn = vel.y * ny + vel.z * nz;
  if (vn < 0) {
    vel.y -= ny * vn * (1 + restitution);
    vel.z -= nz * vn * (1 + restitution);
  }
  return true;
}

/** 2D circle separation for cars. */
export function separateCars(a, b, minDist = 2.7) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > minDist * minDist || d2 < 1e-6) return null;
  const dist = Math.sqrt(d2);
  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  a.pos.x -= nx * overlap * 0.5;
  a.pos.z -= nz * overlap * 0.5;
  b.pos.x += nx * overlap * 0.5;
  b.pos.z += nz * overlap * 0.5;

  const rvx = b.vel.x - a.vel.x;
  const rvz = b.vel.z - a.vel.z;
  const vn = rvx * nx + rvz * nz;
  if (vn < 0) {
    const j = -vn * 0.62;
    a.vel.x -= nx * j;
    a.vel.z -= nz * j;
    b.vel.x += nx * j;
    b.vel.z += nz * j;
  }
  return { nx, nz, dist };
}

export function isBallInGoal(ball) {
  const { x, y, z } = ball.pos;
  if (y > ARENA.goalH - 0.3) return 0;
  if (Math.abs(x) > ARENA.goalHalfW - 0.35) return 0;
  if (z > ARENA.halfL + ARENA.ballR * 0.7) return 1;
  if (z < -ARENA.halfL - ARENA.ballR * 0.7) return -1;
  return 0;
}
