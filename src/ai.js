import * as THREE from 'three';
import { ARENA } from './constants.js';
import { clamp, normalizeAngle, rand, chance } from './utils.js';

const _target = new THREE.Vector3();
const _ballPred = new THREE.Vector3();

export class AIController {
  constructor(car, game, skill = 0.8, seed = Math.random() * 100) {
    this.car = car;
    this.game = game;
    this.skill = skill;
    this.seed = seed;
    this.role = 'attack';
    this.jumpCooldown = 0;
    this.itemDelay = 0;
    this.boostSeekTimer = 0;
    this.thinkTimer = 0;
    this.noise = 0;
  }

  update(dt, time) {
    const car = this.car;
    const game = this.game;
    const controls = car.controls;
    controls.throttle = 0;
    controls.steer = 0;
    controls.boost = false;
    controls.jump = false;
    controls.item = false;
    controls.drift = false;

    if (game.state !== 'playing' || !car.root.visible) return;
    if (car.spinoutTime > 0) return;

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    this.itemDelay = Math.max(0, this.itemDelay - dt);
    this.boostSeekTimer = Math.max(0, this.boostSeekTimer - dt);
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.15 + rand(0, 0.2);
      this.noise = (1 - this.skill) * rand(-0.55, 0.55);
    }

    const ball = game.ball;
    const teammates = game.cars.filter((c) => c.team === car.team);
    const opponents = game.cars.filter((c) => c.team !== car.team);
    const myGoalZ = car.team === 'blue' ? ARENA.halfL : -ARENA.halfL;
    const enemyGoalZ = -myGoalZ;

    let closest = null;
    let closestDist = Infinity;
    for (const c of teammates) {
      const d = c.pos.distanceToSquared(ball.pos);
      if (d < closestDist) { closestDist = d; closest = c; }
    }
    this.role = closest === car ? 'attack' : 'support';

    _ballPred.copy(ball.pos).addScaledVector(ball.vel, 0.28);
    _ballPred.x = clamp(_ballPred.x, -ARENA.halfW + 2, ARENA.halfW - 2);
    _ballPred.z = clamp(_ballPred.z, -ARENA.halfL + 2, ARENA.halfL - 2);

    let targetZ;
    let targetX;
    if (this.role === 'attack') {
      const goalToBallX = _ballPred.x - 0;
      const goalToBallZ = _ballPred.z - enemyGoalZ;
      const len = Math.hypot(goalToBallX, goalToBallZ) || 1;
      const behindX = _ballPred.x + (goalToBallX / len) * 4.4;
      const behindZ = _ballPred.z + (goalToBallZ / len) * 4.4;
      targetX = behindX + this.noise * 5;
      targetZ = behindZ;
      // if we're already goal-side of the ball, still approach from behind
      if (Math.abs(ball.pos.z - car.pos.z) < 5 && Math.abs(ball.pos.x - car.pos.x) < 4) {
        targetX = ball.pos.x;
        targetZ = ball.pos.z;
      }
    } else {
      const defendX = _ballPred.x * 0.32;
      const defendZ = _ballPred.z + (myGoalZ - _ballPred.z) * 0.3;
      targetX = defendX + this.noise * 4;
      targetZ = defendZ;
      if (Math.abs(_ballPred.z - myGoalZ) < 20) {
        targetX = _ballPred.x * 0.55;
        targetZ = myGoalZ - Math.sign(myGoalZ) * 10;
      }
    }

    targetX = clamp(targetX, -ARENA.halfW + 3, ARENA.halfW - 3);
    targetZ = clamp(targetZ, -ARENA.halfL + 3, ARENA.halfL - 3);

    // grab boost when low and the ball is not urgent
    if (car.boost < 26 && this.role === 'support' && this.boostSeekTimer <= 0) {
      let bestPad = null;
      let bestDist = Infinity;
      for (const pad of game.world.pads) {
        if (!pad.active) continue;
        const d = Math.hypot(pad.pos.x - car.pos.x, pad.pos.z - car.pos.z);
        if (d < bestDist && d < 34) { bestDist = d; bestPad = pad; }
      }
      if (bestPad && bestDist < 30) {
        targetX = bestPad.pos.x;
        targetZ = bestPad.pos.z;
        this.boostSeekTimer = 2.5;
      }
    }

    // avoid parking in our own net
    if (Math.abs(car.pos.z - myGoalZ) < 9 && Math.abs(car.pos.x) < ARENA.goalHalfW + 2) {
      targetZ = myGoalZ - Math.sign(myGoalZ) * 14;
    }

    _target.set(targetX, 0, targetZ);
    const dx = _target.x - car.pos.x;
    const dz = _target.z - car.pos.z;
    const distance = Math.hypot(dx, dz);
    const desiredYaw = Math.atan2(dx, dz);
    const diff = normalizeAngle(desiredYaw - car.yaw);

    const aggression = this.role === 'attack' ? 1 : 0.75;
    let steer = clamp(diff * 2.2 + this.noise * 0.8, -1, 1);
    let throttle = distance > 4 ? 1 : 0.25;

    if (Math.abs(diff) > 1.75 && distance < 10) {
      throttle = -0.7;
      steer = clamp(-diff * 1.5, -1, 1);
    }

    if (Math.abs(diff) < 0.32 && distance > 15 && car.boost > 12 && this.role === 'attack') {
      controls.boost = true;
    }
    if (Math.abs(diff) > 0.65 && car.speed > 18) controls.drift = true;

    // ball attack: charge when lined up with the goal
    const distToBall = car.pos.distanceTo(ball.pos);
    if (this.role === 'attack' && distToBall < 14) {
      const goalDir = new THREE.Vector3(0, 0, enemyGoalZ).sub(ball.pos).normalize();
      const carToBall = new THREE.Vector3().subVectors(ball.pos, car.pos).normalize();
      const alignment = goalDir.dot(carToBall);
      if (alignment > 0.25 && car.boost > 8) controls.boost = true;
      if (Math.abs(diff) < 0.5) throttle = 1;
    }

    // jumping for aerial balls
    if (this.jumpCooldown <= 0 && distToBall < 7.5 && ball.pos.y > 3.6 && car.grounded) {
      if (chance(0.35 + this.skill * 0.4)) {
        controls.jump = true;
        this.jumpCooldown = 0.7;
      }
    }
    if (!car.grounded && this.jumpCooldown <= 0 && distToBall < 5.5 && ball.pos.y > car.pos.y + 1.6 && car.jumps < 2) {
      controls.jump = true;
      this.jumpCooldown = 0.9;
    }

    // items
    if (car.item && this.itemDelay <= 0) {
      const type = car.item;
      const nearestEnemy = opponents.reduce((best, o) => {
        const d = o.pos.distanceToSquared(car.pos);
        return d < best.d ? { o, d } : best;
      }, { o: null, d: Infinity }).o;

      let use = false;
      if (type === 'mushroom' || type === 'star') {
        use = distToBall > 10 || car.boost < 35;
      } else if (type === 'green' || type === 'red') {
        if (nearestEnemy) {
          const toEnemy = new THREE.Vector3().subVectors(nearestEnemy.pos, car.pos);
          const dist = toEnemy.length();
          const fwd = car.forward;
          const dot = toEnemy.normalize().dot(fwd);
          use = dist < 42 && dot > 0.45;
        }
      } else if (type === 'banana') {
        const chaser = opponents.find((o) => {
          const rel = new THREE.Vector3().subVectors(o.pos, car.pos);
          return rel.length() < 16 && rel.normalize().dot(car.forward) < -0.2;
        });
        use = !!chaser || chance(0.25);
      } else if (type === 'bomb') {
        use = distToBall < 26 || (nearestEnemy && nearestEnemy.pos.distanceTo(car.pos) < 18);
      } else if (type === 'lightning') {
        use = true;
      }

      if (use) {
        game.items.useItem(car, game.cars);
        this.itemDelay = 0.8 + rand(0, 0.8);
      } else {
        this.itemDelay = 0.35;
      }
    }

    controls.steer = steer;
    controls.throttle = throttle * aggression;
    if (car.spinoutTime > 0) {
      controls.throttle = 0;
      controls.steer = 0;
      controls.boost = false;
    }
  }
}
