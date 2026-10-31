import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { ARENA, TEAM, MATCH, ITEMS } from './constants.js';
import { clamp, damp, formatTime, rand } from './utils.js';
import { buildWorld } from './world.js';
import { Ball } from './ball.js';
import { Car } from './car.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { ItemSystem } from './items.js';
import { AIController } from './ai.js';
import { isBallInGoal } from './physics.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 700);
    this.camera.position.set(0, 24, 58);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,
      0.65,
      0.78
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.effects = new Effects(this.scene, this.renderer);
    this.world = buildWorld(this.scene, this.renderer);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.input = new Input();

    this.ball = new Ball(this.scene, this.renderer, this.effects, this.audio);
    this.items = new ItemSystem(this.scene, this.renderer, this.effects, this.audio, this.ball);

    this.player = new Car(this.scene, { team: 'blue', index: 0, name: 'YOU', isPlayer: true, effects: this.effects, audio: this.audio });
    this.teammate = new Car(this.scene, { team: 'blue', index: 1, name: 'BOLT', effects: this.effects, audio: this.audio });
    this.redA = new Car(this.scene, { team: 'red', index: 0, name: 'RAZOR', effects: this.effects, audio: this.audio });
    this.redB = new Car(this.scene, { team: 'red', index: 1, name: 'NOVA', effects: this.effects, audio: this.audio });
    this.cars = [this.player, this.teammate, this.redA, this.redB];

    this.player.onHit = () => this.hud.flashHit();

    this.state = 'menu';
    this.paused = false;
    this.score = { blue: 0, red: 0 };
    this.timeLeft = MATCH.duration;
    this.overtime = false;
    this.pendingEnd = false;
    this.countdown = 0;
    this.lastCount = 4;
    this.goalTimer = 0;
    this.goalTeam = null;
    this.goalPosition = new THREE.Vector3();
    this.matchTime = 0;
    this.accumulator = 0;
    this.step = 1 / 90;
    this.cameraSnap = true;
    this.lookTarget = new THREE.Vector3(0, 2, 0);
    this.jumboTimer = 0;
    this.firstFrame = true;
    this.fpsTime = 0;
    this.fpsFrames = 0;
    this.lowQuality = false;
    this.isCoarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

    this.ai = [
      new AIController(this.teammate, this, 0.84, 12),
      new AIController(this.redA, this, 0.8, 31),
      new AIController(this.redB, this, 0.86, 57),
    ];

    this.items.on('pickup', (car, type) => {
      if (car === this.player) {
        const meta = ITEMS[type];
        this.hud.message(`${meta.icon}  ${meta.name}`, 'ITEM ACQUIRED', 'lime', 0.9);
      }
    });
    this.items.on('use', (car, type) => {
      if (car === this.player && type === 'lightning') {
        this.hud.flashGoal();
        this.effects.addShake(0.4);
      }
    });

    this.hud.on('play', () => this.startMatch());
    this.hud.on('sound', () => {
      this.audio.init();
      const muted = this.audio.toggleMuted();
      this.hud.setSoundLabel(muted);
      if (!muted) this.audio.click();
    });
    this.hud.on('resume', () => this.togglePause(false));
    this.hud.on('restart', () => {
      this.paused = false;
      this.hud.showPause(false);
      this.startMatch();
    });
    this.hud.on('quit', () => this.toMenu());
    this.hud.on('rematch', () => this.startMatch());

    this.input.on('pause', () => this.togglePause());
    this.input.on('ballcam', (on) => {
      if (this.state === 'playing' || this.state === 'countdown') {
        this.hud.message(on ? 'BALL CAM ON' : 'BALL CAM OFF', '', '', 0.7);
      }
    });
    this.input.on('confirm', () => {
      if (this.state === 'menu') this.startMatch();
      else if (this.state === 'ended') this.startMatch();
    });

    this.setupFormation();
    this.hud.showHUD(false);
    this.hud.showMenu(true);
    this.hud.showTouch(false);
    this.hud.setSoundLabel(this.audio.muted);

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.paused) this.togglePause(true);
    });

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.__game = this;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  setupFormation() {
    this.ball.reset();
    this.player.reset(-5, 29, Math.PI);
    this.teammate.reset(6.5, 33, Math.PI);
    this.redA.reset(5, -29, 0);
    this.redB.reset(-6.5, -33, 0);
    this.items.reset();
    this.items.enabled = false;
    this.cameraSnap = true;
  }

  startMatch() {
    this.audio.init();
    this.audio.click();
    this.score.blue = 0;
    this.score.red = 0;
    this.timeLeft = MATCH.duration;
    this.overtime = false;
    this.pendingEnd = false;
    this.paused = false;
    this.hud.showMenu(false);
    this.hud.showEndScreen(false);
    this.hud.showPause(false);
    this.hud.showHUD(true);
    this.syncTouch();
    this.setupFormation();
    this.beginKickoff();
    this.hud.setScore(0, 0);
  }

  beginKickoff() {
    this.state = 'countdown';
    this.countdown = 3.2;
    this.lastCount = 4;
    this.items.enabled = false;
    this.cameraSnap = true;
    this.syncTouch();
  }

  startOvertime() {
    this.overtime = true;
    this.timeLeft = 0;
    this.pendingEnd = false;
    this.setupFormation();
    this.state = 'countdown';
    this.countdown = 3.2;
    this.lastCount = 4;
    this.items.enabled = false;
    this.cameraSnap = true;
    this.audio.whistle();
    this.hud.message('OVERTIME', 'NEXT GOAL WINS', 'lime', 2.2);
    this.syncTouch();
  }

  endMatch() {
    this.state = 'ended';
    this.paused = false;
    this.items.enabled = false;
    this.hud.showTouch(false);
    const winner = this.score.blue > this.score.red ? 'blue' : 'red';
    this.hud.overtime = this.overtime;
    this.hud.showEnd(winner, this.score);
    this.audio.whistle();
    this.audio.cheer(1.1);
    this.cameraSnap = true;
  }

  toMenu() {
    this.state = 'menu';
    this.paused = false;
    this.score.blue = 0;
    this.score.red = 0;
    this.timeLeft = MATCH.duration;
    this.overtime = false;
    this.pendingEnd = false;
    this.hud.showHUD(false);
    this.hud.showMenu(true);
    this.hud.showPause(false);
    this.hud.showEndScreen(false);
    this.hud.showTouch(false);
    this.audio.setEngine(0, false, 0, false);
    this.setupFormation();
    this.cameraSnap = true;
  }

  togglePause(force) {
    if (this.state === 'menu' || this.state === 'ended') return;
    const next = typeof force === 'boolean' ? force : !this.paused;
    this.paused = next;
    this.hud.showPause(next);
    this.syncTouch();
    if (next) this.audio.setEngine(0, false, 0, false);
    this.audio.click();
  }

  syncTouch() {
    const show = this.isCoarse && !this.paused && (this.state === 'playing' || this.state === 'countdown' || this.state === 'goal');
    this.hud.showTouch(show);
  }

  scoreGoal(side) {
    const scorer = side === 1 ? 'red' : 'blue';
    const team = TEAM[scorer];
    const other = TEAM[scorer === 'blue' ? 'red' : 'blue'];
    this.score[scorer] += 1;
    this.state = 'goal';
    this.goalTeam = scorer;
    this.goalTimer = MATCH.goalCelebration;
    this.goalPosition.copy(this.ball.pos);
    this.items.enabled = false;
    this.pendingEnd = this.timeLeft <= 2.2 || this.overtime;
    this.hud.message(`${team.name} GOAL!`, `${this.score.blue} — ${this.score.red}`, scorer, 3);
    this.hud.flashGoal();
    this.hud.setScore(this.score.blue, this.score.red);
    this.effects.goal(this.goalPosition.clone().add(new THREE.Vector3(0, 1, 0)), team.color, other.color);
    this.audio.goal();
    this.effects.addShake(0.7);
    this.syncTouch();
    if (this.overtime) this.hud.message(`${team.name} WINS!`, 'GOLDEN GOAL', scorer, 3);
  }

  updateCountdown(dt) {
    this.countdown -= dt;
    const n = Math.ceil(this.countdown);
    if (n !== this.lastCount && n > 0 && n <= 3) {
      this.lastCount = n;
      this.hud.message(String(n), this.overtime ? 'OVERTIME' : 'KICKOFF', 'lime', 0.95);
      this.audio.countdown(n === 1);
    }
    if (this.countdown <= 0) {
      this.state = 'playing';
      this.items.enabled = true;
      this.hud.message('GO!', '', 'lime', 0.8);
      this.audio.go();
      this.syncTouch();
      this.cameraSnap = false;
    }
  }

  updateGoal(dt) {
    this.goalTimer -= dt;
    // let the ball settle and cars coast for a lively celebration
    for (const car of this.cars) {
      car.controls.throttle = 0;
      car.controls.steer = 0;
      car.controls.boost = false;
      car.controls.jump = false;
      car.controls.item = false;
      car.update(dt, this.matchTime);
    }
    this.ball.update(dt, this.cars);
    this.effects.addShake(0);
    if (this.goalTimer <= 0) {
      if (this.pendingEnd) {
        if (this.score.blue === this.score.red) this.startOvertime();
        else this.endMatch();
      } else {
        this.setupFormation();
        this.beginKickoff();
      }
    }
  }

  updateGameplay(dt) {
    const controls = this.input.getControls();
    Object.assign(this.player.controls, controls);

    for (const ai of this.ai) ai.update(dt, this.matchTime);

    this.items.update(dt, this.matchTime, this.cars);

    for (const car of this.cars) car.update(dt, this.matchTime);

    // car-car collisions and star ramming
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > 3.1 * 3.1) continue;
        if (a.starTime > 0 || b.starTime > 0) {
          if (a.starTime > 0 && b.starTime <= 0) {
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            if (b.takeHit(dir, 1.4)) {
              this.effects.hit(b.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffe14a);
              if (b.isPlayer) this.hud.flashHit();
            }
          } else if (b.starTime > 0 && a.starTime <= 0) {
            const dir = new THREE.Vector3(-dx, 0, -dz).normalize();
            if (a.takeHit(dir, 1.4)) {
              this.effects.hit(a.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffe14a);
              if (a.isPlayer) this.hud.flashHit();
            }
          }
        }
        if (dist2 > 0.0001) {
          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = 3.1 - dist;
          a.pos.x -= nx * overlap * 0.5;
          a.pos.z -= nz * overlap * 0.5;
          b.pos.x += nx * overlap * 0.5;
          b.pos.z += nz * overlap * 0.5;
          const rvx = b.vel.x - a.vel.x;
          const rvz = b.vel.z - a.vel.z;
          const vn = rvx * nx + rvz * nz;
          if (vn < 0) {
            a.vel.x -= nx * vn * 0.35;
            a.vel.z -= nz * vn * 0.35;
            b.vel.x += nx * vn * 0.35;
            b.vel.z += nz * vn * 0.35;
            if ((a.isPlayer || b.isPlayer) && Math.abs(vn) > 7) this.effects.addShake(0.2);
          }
        }
      }
    }

    // boost pads
    for (const car of this.cars) {
      if (car.pos.y > 2.4) continue;
      for (const pad of this.world.pads) {
        if (!pad.active) continue;
        const dx = car.pos.x - pad.pos.x;
        const dz = car.pos.z - pad.pos.z;
        if (dx * dx + dz * dz < (pad.radius + 1.5) ** 2) {
          if (pad.collect()) {
            car.boost = Math.min(100, car.boost + (pad.big ? 100 : 12));
            this.effects.burst(new THREE.Vector3(pad.pos.x, 0.6, pad.pos.z), pad.big ? 0xffd24a : 0xff9a2e, pad.big ? 18 : 8, { speed: 5, size: 0.7, life: 0.4, gravity: 0 });
            if (car.isPlayer) this.audio.pickup();
          }
        }
      }
    }

    this.ball.update(dt, this.cars);

    if (this.player.itemPressed && this.player.item) {
      this.items.useItem(this.player, this.cars);
    }

    const side = isBallInGoal(this.ball);
    if (side !== 0 && this.state === 'playing') {
      this.scoreGoal(side);
      return;
    }
  }

  updateCamera(dt) {
    const time = this.matchTime;
    let desired = new THREE.Vector3();
    let look = new THREE.Vector3();
    let snap = this.cameraSnap;

    if (this.state === 'menu') {
      const angle = time * 0.11;
      desired.set(Math.cos(angle) * 48, 23 + Math.sin(time * 0.25) * 2, Math.sin(angle) * 48);
      look.set(0, 3, 0);
      this.camera.fov = damp(this.camera.fov, 54, 2, dt);
    } else if (this.state === 'ended') {
      const angle = time * 0.2;
      desired.set(Math.cos(angle) * 38, 18, Math.sin(angle) * 38);
      look.copy(this.ball.pos).setY(3);
      this.camera.fov = damp(this.camera.fov, 56, 2, dt);
    } else if (this.state === 'goal') {
      const sign = Math.sign(this.goalPosition.z) || 1;
      desired.set(
        this.goalPosition.x + Math.sin(time * 0.55) * 11,
        10 + Math.sin(time * 0.9) * 1.5,
        sign * (ARENA.halfL - 20)
      );
      look.copy(this.goalPosition).add(new THREE.Vector3(0, 2.2, 0));
      this.camera.fov = damp(this.camera.fov, 64, 3, dt);
      snap = true;
    } else {
      const player = this.player;
      const forward = player.forward;
      const speed = player.speed;
      const portrait = this.camera.aspect < 0.9;
      const back = (13.6 + speed * 0.055) * (portrait ? 1.24 : 1);

      // Ball cam orbits the rig toward the ball instead of staring past the
      // car, so the player car never slides out of frame when the ball is wide.
      let viewDir = forward;
      if (this.input.ballCam) {
        const toBall = new THREE.Vector3(
          this.ball.pos.x - player.pos.x,
          0,
          this.ball.pos.z - player.pos.z
        );
        const ballDist = toBall.length();
        if (ballDist > 3) {
          const ballDir = toBall.normalize();
          const dot = forward.dot(ballDir);
          if (dot > -0.35) {
            const blend = clamp(0.62 + (1 - Math.max(0, dot)) * 0.2, 0.62, 0.88);
            viewDir = forward.clone().lerp(ballDir, blend).normalize();
          }
        }
      }

      desired.set(
        player.pos.x - viewDir.x * back,
        7.1 + speed * 0.02 + (portrait ? 2.5 : 0),
        player.pos.z - viewDir.z * back
      );
      const lookAhead = this.input.ballCam ? 6.5 : 5.5;
      const ballLift = this.input.ballCam ? clamp(this.ball.pos.y - 2, -0.6, 2.4) * 0.35 : 0;
      look.set(
        player.pos.x + viewDir.x * lookAhead,
        player.pos.y + 2.4 + ballLift,
        player.pos.z + viewDir.z * lookAhead
      );

      const boosting = player.boosting || player.boostTime > 0 || player.starTime > 0;
      const targetFov = 66 + (portrait ? 5 : 0) + Math.min(16, speed * 0.28) + (boosting ? 5 : 0);
      this.camera.fov = damp(this.camera.fov, targetFov, 3.5, dt);
    }

    this.camera.updateProjectionMatrix();

    if (snap) {
      this.camera.position.copy(desired);
      this.lookTarget.copy(look);
      this.cameraSnap = false;
    } else {
      this.camera.position.lerp(desired, 1 - Math.exp(-5.2 * dt));
      this.lookTarget.lerp(look, 1 - Math.exp(-7 * dt));
    }

    const shake = this.effects.getShake(time);
    this.camera.position.x += shake.x;
    this.camera.position.y += shake.y;
    this.camera.lookAt(this.lookTarget);
    this.camera.rotation.z += shake.roll;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const rawDt = this.clock.getDelta();
    const dt = clamp(rawDt, 0.001, 0.05);
    const realDt = clamp(rawDt, 0.001, 0.25);
    if (!this.paused) {
      this.matchTime += dt;
      this.world.update(dt, this.matchTime);

      if (this.state === 'countdown') {
        this.updateCountdown(realDt);
      } else if (this.state === 'playing') {
        if (!this.overtime) {
          this.timeLeft = Math.max(0, this.timeLeft - realDt);
        }
        this.accumulator += Math.min(rawDt, 0.1);
        let steps = 0;
        while (this.accumulator >= this.step && steps < 8) {
          this.updateGameplay(this.step);
          this.accumulator -= this.step;
          steps++;
          if (this.state !== 'playing') break;
        }
        if (this.state === 'playing' && this.timeLeft <= 0 && !this.overtime) {
          if (this.score.blue === this.score.red) this.startOvertime();
          else this.endMatch();
        }
      } else if (this.state === 'goal') {
        this.updateGoal(realDt);
      }

      this.effects.update(dt, this.matchTime);
    }

    if (this.state === 'menu' || this.state === 'ended') {
      // subtle ball idle animation
      this.ball.mesh.rotation.y += dt * 0.15;
      this.ball.glow.material.opacity = 0.2 + Math.sin(this.matchTime * 2) * 0.05;
    }

    this.updateCamera(dt);

    this.hud.update(this);
    this.jumboTimer -= dt;
    if (this.jumboTimer <= 0) {
      this.jumboTimer = 0.4;
      let label = 'READY';
      if (this.state === 'countdown') label = this.overtime ? 'OVERTIME' : 'KICKOFF';
      else if (this.state === 'playing') label = this.overtime ? 'OVERTIME' : 'LIVE';
      else if (this.state === 'goal') label = 'GOAL!';
      else if (this.state === 'ended') label = 'FULL TIME';
      else if (this.state === 'menu') label = 'WARM UP';
      this.world.setScore(this.score.blue, this.score.red, formatTime(this.timeLeft), label);
    }

    const active = this.state === 'playing' && !this.paused;
    this.audio.setEngine(this.player.speed, this.player.boosting || this.player.boostTime > 0, this.player.controls.throttle, active);

    this.composer.render();

    if (this.firstFrame) {
      this.firstFrame = false;
      this.hud.showLoading(false);
    }

    // adaptive quality for weaker phones / very slow software renderers
    this.fpsTime += dt;
    this.fpsFrames++;
    if (this.fpsTime > 3.5) {
      const fps = this.fpsFrames / this.fpsTime;
      if (fps < 45 && !this.lowQuality) {
        this.lowQuality = true;
        this.renderer.setPixelRatio(1);
        this.composer.setPixelRatio(1);
        if (this.isCoarse) this.bloom.enabled = false;
        this.resize();
      }
      if (fps < 20 && this.lowQuality && !this.isCoarse && !this.bloomDisabled) {
        this.bloomDisabled = true;
        this.bloom.enabled = false;
      }
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
  }
}

async function boot() {
  try {
    await document.fonts.ready;
    new Game();
  } catch (error) {
    console.error(error);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `<div class="loader-logo">SHELL<span>STRIKERS</span></div><div class="loader-text">COULD NOT START: ${String(error.message || error)}</div>`;
    }
  }
}

boot();
