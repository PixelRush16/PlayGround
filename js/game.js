import * as THREE from '../vendor/three.module.min.js';
import {
  LANE_X,
  START_SPEED,
  clamp,
  damp,
  difficultyAt,
  formatNumber,
  formatScore,
  gapFor,
  obstacleHitsPlayer,
  pickRow,
  scoreFor,
  speedAt,
} from './logic.js';
import { Sfx } from './audio.js';
import { World } from './world.js';
import {
  Particles,
  TRAIN_DEPTH,
  createBarrier,
  createCoin,
  createGate,
  createPlayer,
  createTrain,
} from './actors.js';
import { makeBarrierTexture, makeGateTexture, makeTrainTextures } from './assets.js';

const SPAWN_AHEAD = -168;
const DESPAWN_BEHIND = 24;
const BEST_KEY = 'neon-rails-best';
const BANK_KEY = 'neon-rails-bank';
const COIN_COUNT = 72;
const PORTRAIT_WIDTH = 720;

const $ = (selector) => document.querySelector(selector);

const dom = {
  canvas: $('#scene'),
  score: $('#score'),
  distance: $('#distance'),
  coins: $('#coins'),
  speedfill: $('#speedfill'),
  hud: $('#hud'),
  hint: $('#hint'),
  goBadge: $('#goBadge'),
  combo: $('#combo'),
  flash: $('#flash'),
  speedlines: $('#speedlines'),
  menu: $('#menu'),
  best: $('#best'),
  bank: $('#bank'),
  playBtn: $('#playBtn'),
  soundBtn: $('#soundBtn'),
  pauseBtn: $('#pauseBtn'),
  result: $('#result'),
  resultKicker: $('#resultKicker'),
  resultTitle: $('#resultTitle'),
  resultLine: $('#resultLine'),
  resultScore: $('#resultScore'),
  resultDistance: $('#resultDistance'),
  resultCoins: $('#resultCoins'),
  resultBest: $('#resultBest'),
  newBestTag: $('#newBestTag'),
  replayBtn: $('#replayBtn'),
  homeBtn: $('#homeBtn'),
  pause: $('#pause'),
  resumeBtn: $('#resumeBtn'),
  restartBtn: $('#restartBtn'),
  pauseHomeBtn: $('#pauseHomeBtn'),
  touchControls: $('#touchControls'),
  fallback: $('#fallback'),
};

const CRASH_COPY = {
  train: ['Express wins', 'Wrecked.', 'A train is a wall with a timetable.'],
  barrier: ['Low bridge', 'Tripped.', 'That barrier was definitely there.'],
  gate: ['Too tall', 'Clipped.', 'Should have hit the deck.'],
};

class NeonRails {
  constructor() {
    this.canvas = dom.canvas;
    this.state = 'menu';
    this.time = 0;
    this.last = performance.now();
    this.distance = 0;
    this.coins = 0;
    this.score = 0;
    this.speed = 7;
    this.lane = 1;
    this.targetLane = 1;
    this.playerY = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.slideTimer = 0;
    this.slideBuffer = 0;
    this.jumpBuffer = 0;
    this.crouch = 0;
    this.runPhase = 0;
    this.runBlend = 1;
    this.crashT = 0;
    this.crashType = 'train';
    this.shake = 0;
    this.resultShown = false;
    this.hintTimer = 0;
    this.sinceSpawn = 0;
    this.nextGap = 42;
    this.menuCoinTimer = 0.8;
    this.coinStreak = 0;
    this.coinStreakTimer = 0;
    this.hudCache = {};
    this.autoplay = false;
    this.pointer = null;
    this.intensityTimer = 0;
    this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    this.bank = Number(localStorage.getItem(BANK_KEY)) || 0;
    this.bestAtStart = this.best;
    this.sfx = new Sfx();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x120e1e, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x6b4a6c, 70, 285);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 620);
    this.camera.position.set(0, 4.5, 9.2);

    this.world = new World(this.scene);
    this.player = createPlayer();
    this.player.group.scale.setScalar(1.08);
    this.scene.add(this.player.group);
    this.scene.add(this.player.contact);

    this.particles = new Particles(this.scene, this.world.glowTexture, 380);

    this.trainTextures = [
      makeTrainTextures('#12c7bd', '#ffd166', Math.random),
      makeTrainTextures('#ff7a45', '#35e6c7', Math.random),
      makeTrainTextures('#7864ff', '#ffd166', Math.random),
      makeTrainTextures('#e1b62f', '#ff5d63', Math.random),
    ];
    this.barrierTextures = makeBarrierTexture();
    this.gateTextures = makeGateTexture();

    this.coinPrototype = createCoin(this.world.glowTexture);
    this.coinPool = [];
    for (let i = 0; i < COIN_COUNT; i += 1) {
      this.coinPool.push(this.coinPrototype.clone(true));
    }

    this.trainPool = [];
    this.barrierPool = [];
    this.gatePool = [];
    this.obstacles = [];
    this.coinItems = [];

    this.bindUI();
    this.resize();
    this.updateSoundButton();
    this.updateMenuStats();
    this.enterMenu();

    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------- asset pools

  acquireTrain() {
    if (this.trainPool.length) return this.trainPool.pop();
    const textures = this.trainTextures[Math.floor(Math.random() * this.trainTextures.length)];
    return createTrain(textures, this.world.glowTexture);
  }

  acquireBarrier() {
    if (this.barrierPool.length) return this.barrierPool.pop();
    return createBarrier(this.barrierTextures, this.world.glowTexture);
  }

  acquireGate() {
    if (this.gatePool.length) return this.gatePool.pop();
    return createGate(this.gateTextures, this.world.glowTexture);
  }

  addHazard(type, lane, z) {
    let group;
    let depth = 1.5;
    if (type === 'train') {
      group = this.acquireTrain();
      depth = TRAIN_DEPTH;
    } else if (type === 'barrier') {
      group = this.acquireBarrier();
    } else {
      group = this.acquireGate();
    }
    group.visible = true;
    group.position.set(LANE_X[lane], 0, z);
    group.rotation.set(0, 0, 0);
    this.scene.add(group);
    const obstacle = { group, type, lane, depth };
    this.obstacles.push(obstacle);
    return obstacle;
  }

  recycleObstacle(obstacle) {
    obstacle.group.visible = false;
    if (obstacle.type === 'train') this.trainPool.push(obstacle.group);
    else if (obstacle.type === 'barrier') this.barrierPool.push(obstacle.group);
    else this.gatePool.push(obstacle.group);
  }

  clearObstacles() {
    for (const obstacle of this.obstacles) this.recycleObstacle(obstacle);
    this.obstacles = [];
  }

  spawnCoin(lane, y, z) {
    const group = this.coinPool.pop() || this.coinPrototype.clone(true);
    group.visible = true;
    group.position.set(LANE_X[lane], y, z);
    group.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.scene.add(group);
    this.coinItems.push({ group, lane, baseY: y, phase: Math.random() * Math.PI * 2 });
  }

  spawnCoinLine(lane, centerZ, count, spacing, mode = 'flat') {
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spacing;
      let y = 1.12;
      if (mode === 'arc') {
        y = 1.1 + Math.sin(((i + 0.5) / count) * Math.PI) * 1.45;
      } else if (mode === 'low') {
        y = 0.66;
      }
      this.spawnCoin(lane, y, centerZ + offset);
    }
  }

  clearCoins() {
    for (const coin of this.coinItems) {
      coin.group.visible = false;
      this.coinPool.push(coin.group);
    }
    this.coinItems = [];
  }
  // ------------------------------------------------------------- UI + flow

  bindUI() {
    dom.playBtn.addEventListener('click', () => this.startGame());
    dom.replayBtn.addEventListener('click', () => this.startGame());
    dom.homeBtn.addEventListener('click', () => this.enterMenu());
    dom.pauseBtn.addEventListener('click', () => this.pauseGame());
    dom.resumeBtn.addEventListener('click', () => this.resumeGame());
    dom.restartBtn.addEventListener('click', () => this.startGame());
    dom.pauseHomeBtn.addEventListener('click', () => this.enterMenu());
    dom.soundBtn.addEventListener('click', () => this.toggleSound());

    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });

    window.addEventListener('pointerdown', (event) => this.onPointerDown(event), { passive: true });
    window.addEventListener('pointerup', (event) => this.onPointerUp(event), { passive: true });
    window.addEventListener('pointercancel', () => {
      this.pointer = null;
    });
    window.addEventListener('touchmove', (event) => {
      if (this.state === 'playing') event.preventDefault();
    }, { passive: false });

    for (const button of document.querySelectorAll('[data-action]')) {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.state !== 'playing') return;
        const action = button.dataset.action;
        if (action === 'left') this.moveLane(-1);
        else if (action === 'right') this.moveLane(1);
        else if (action === 'jump') this.requestJump();
        else if (action === 'slide') this.requestSlide();
      });
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.portrait = height > width;
    this.aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.portrait ? 1.6 : 1.75));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = this.aspect;
    this.camera.fov = this.portrait ? 70 : this.aspect > 2.1 ? 62 : 55;
    this.camera.updateProjectionMatrix();
  }

  updateSoundButton() {
    document.body.classList.toggle('is-muted', this.sfx.muted);
    dom.soundBtn.setAttribute('aria-pressed', String(!this.sfx.muted));
    dom.soundBtn.setAttribute('aria-label', this.sfx.muted ? 'Unmute sound' : 'Mute sound');
  }

  toggleSound() {
    this.sfx.init();
    this.sfx.setMuted(!this.sfx.muted);
    this.updateSoundButton();
    if (!this.sfx.muted) {
      this.sfx.click();
      if (this.state === 'playing') this.sfx.startWind();
    }
  }

  updateMenuStats() {
    dom.best.textContent = formatNumber(this.best);
    dom.bank.textContent = formatNumber(this.bank);
  }

  flashEffect() {
    dom.flash.classList.remove('is-on');
    void dom.flash.offsetWidth;
    dom.flash.classList.add('is-on');
  }

  showGo() {
    dom.goBadge.classList.remove('is-on');
    void dom.goBadge.offsetWidth;
    dom.goBadge.classList.add('is-on');
  }

  pulseCombo(text) {
    dom.combo.textContent = text;
    dom.combo.classList.remove('is-on');
    void dom.combo.offsetWidth;
    dom.combo.classList.add('is-on');
  }

  setBodyState(state) {
    document.body.dataset.state = state;
  }

  resetRunner() {
    this.player.group.position.set(0, 0, 0);
    this.player.group.rotation.set(0, 0, 0);
    this.player.rig.position.set(0, 0, 0);
    this.player.rig.rotation.set(0, 0, 0);
    this.player.rig.scale.set(1, 1, 1);
    this.player.upper.rotation.set(0, 0, 0);
    this.player.contact.visible = true;
    this.player.contact.material.opacity = 0.34;
    this.lane = 1;
    this.targetLane = 1;
    this.playerY = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.slideTimer = 0;
    this.slideBuffer = 0;
    this.jumpBuffer = 0;
    this.crouch = 0;
    this.runBlend = 1;
    this.crashT = 0;
    this.shake = 0;
    this.coinStreak = 0;
    this.coinStreakTimer = 0;
  }

  enterMenu() {
    this.state = 'menu';
    this.setBodyState('menu');
    this.sfx.stopWind();
    this.clearObstacles();
    this.clearCoins();
    this.resetRunner();
    this.speed = 7;
    this.distance = 0;
    this.coins = 0;
    this.score = 0;
    this.resultShown = false;
    this.menuCoinTimer = 0.9;
    this.hintTimer = 0;
    dom.menu.hidden = false;
    dom.result.hidden = true;
    dom.pause.hidden = true;
    dom.hud.setAttribute('aria-hidden', 'true');
    dom.hint.classList.remove('is-visible');
    dom.speedlines.style.setProperty('--rush', '0');
    this.updateMenuStats();
    this.updateHUD(true);
  }

  resetRun() {
    this.clearObstacles();
    this.clearCoins();
    this.resetRunner();
    this.distance = 0;
    this.coins = 0;
    this.score = 0;
    this.speed = START_SPEED;
    this.bestAtStart = this.best;
    this.resultShown = false;
    this.sinceSpawn = 0;
    this.nextGap = gapFor(this.speed, Math.random);
    this.hintTimer = 6.5;
    this.prefill();
    this.updateHUD(true);
  }

  startGame() {
    if (this.state === 'playing' || this.state === 'crashing') return;
    this.sfx.init();
    this.sfx.start();
    this.resetRun();
    this.state = 'playing';
    this.setBodyState('playing');
    dom.menu.hidden = true;
    dom.result.hidden = true;
    dom.pause.hidden = true;
    dom.hud.setAttribute('aria-hidden', 'false');
    dom.hint.classList.add('is-visible');
    this.showGo();
    this.updateHUD(true);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.setBodyState('paused');
    this.sfx.stopWind();
    dom.pause.hidden = false;
    dom.hint.classList.remove('is-visible');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.setBodyState('playing');
    this.sfx.startWind();
    dom.pause.hidden = true;
  }

  showResults() {
    if (this.resultShown) return;
    this.resultShown = true;
    this.state = 'gameover';
    this.setBodyState('gameover');
    this.sfx.stopWind();

    const isNewBest = this.score > this.best;
    if (isNewBest) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    this.bank += this.coins;
    localStorage.setItem(BANK_KEY, String(this.bank));

    const [kicker, title, line] = CRASH_COPY[this.crashType] || CRASH_COPY.train;
    dom.resultKicker.textContent = kicker;
    dom.resultTitle.textContent = title;
    dom.resultLine.textContent = line;
    dom.resultScore.textContent = formatNumber(this.score);
    dom.resultDistance.textContent = `${formatNumber(this.distance)} m`;
    dom.resultCoins.textContent = formatNumber(this.coins);
    dom.resultBest.textContent = formatNumber(this.best);
    dom.newBestTag.hidden = !isNewBest;
    dom.result.hidden = false;
    dom.hint.classList.remove('is-visible');
    this.updateMenuStats();
    this.updateHUD(true);
  }

  onKeyDown(event) {
    const code = event.code;
    const isGameKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code);
    if (isGameKey && this.state === 'playing') event.preventDefault();

    if (this.state === 'menu' || this.state === 'gameover') {
      if (code === 'Enter' || code === 'Space') {
        event.preventDefault();
        this.startGame();
      }
      return;
    }

    if (this.state === 'paused') {
      if (code === 'Escape' || code === 'KeyP' || code === 'Enter' || code === 'Space') {
        event.preventDefault();
        this.resumeGame();
      }
      return;
    }

    if (this.state !== 'playing') return;

    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLane(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveLane(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        this.requestJump();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.requestSlide();
        break;
      case 'Escape':
      case 'KeyP':
        this.pauseGame();
        break;
      default:
        break;
    }
  }

  onPointerDown(event) {
    if (this.state !== 'playing') return;
    if (event.target.closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  onPointerUp(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    this.pointer = null;
    if (this.state !== 'playing') return;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) this.moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) this.requestJump();
    else this.requestSlide();
  }

  moveLane(direction) {
    if (this.state !== 'playing') return;
    const next = clamp(this.targetLane + direction, 0, 2);
    if (next === this.targetLane) return;
    this.targetLane = next;
    this.sfx.swap();
  }

  requestJump() {
    if (this.state !== 'playing') return;
    if (this.grounded) {
      this.velocityY = 13.4;
      this.grounded = false;
      this.slideTimer = 0;
      this.crouch = 0;
      this.sfx.jump();
      this.particles.spawn(
        new THREE.Vector3(this.player.group.position.x, 0.16, 0.1),
        { count: 7, color: 0xd7c4ae, speed: 1.3, spread: 0.35, gravity: 2.6, life: 0.34 }
      );
    } else {
      this.jumpBuffer = 0.14;
    }
  }

  requestSlide() {
    if (this.state !== 'playing') return;
    if (this.grounded) {
      this.slideTimer = 0.74;
      this.sfx.slide();
      this.particles.spawn(
        new THREE.Vector3(this.player.group.position.x, 0.18, 0.3),
        { count: 8, color: 0xb7a692, speed: 1.8, spread: 0.4, gravity: 2.2, life: 0.4 }
      );
    } else {
      this.velocityY = Math.min(this.velocityY, -19);
      this.slideBuffer = 0.22;
    }
  }

  updateHUD(force = false) {
    const scoreText = formatScore(this.score);
    const distanceText = formatNumber(this.distance);
    const coinsText = formatNumber(this.coins);
    if (force || this.hudCache.score !== scoreText) {
      dom.score.textContent = scoreText;
      this.hudCache.score = scoreText;
    }
    if (force || this.hudCache.distance !== distanceText) {
      dom.distance.textContent = distanceText;
      this.hudCache.distance = distanceText;
    }
    if (force || this.hudCache.coins !== coinsText) {
      dom.coins.textContent = coinsText;
      this.hudCache.coins = coinsText;
    }
    const speedRatio = clamp((this.speed - START_SPEED) / (47 - START_SPEED), 0, 1);
    dom.speedfill.style.width = `${13 + speedRatio * 87}%`;
    const rush = clamp((this.speed - 24) / 30, 0, 0.52);
    if (force || Math.abs((this.hudCache.rush || 0) - rush) > 0.02) {
      dom.speedlines.style.setProperty('--rush', rush.toFixed(2));
      this.hudCache.rush = rush;
    }
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------- simulation

  update(dt) {
    switch (this.state) {
      case 'menu':
        this.updateMenu(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'crashing':
        this.updateCrashing(dt);
        break;
      case 'gameover':
        this.updateGameOver(dt);
        break;
      default:
        break;
    }
  }

  updateMenu(dt) {
    this.speed = damp(this.speed, 7, 1.6, dt);
    this.world.update(dt, this.speed);
    this.updateCoins(dt, this.speed, false);
    this.animatePlayer(dt);
    this.updateCamera(dt);
    this.particles.update(dt);

    this.menuCoinTimer -= dt;
    if (this.menuCoinTimer <= 0) {
      const lane = Math.random() < 0.5 ? 0 : 2;
      this.spawnCoinLine(lane, -150, 5, 2.15, 'flat');
      this.menuCoinTimer = 2.4 + Math.random() * 1.8;
    }
  }

  updatePlaying(dt) {
    this.autopilotUpdate();

    this.speed = speedAt(this.distance);
    this.distance += this.speed * dt;
    this.updatePlayer(dt);

    this.world.update(dt, this.speed);
    this.updateObstacles(dt);
    this.updateCoins(dt, this.speed, this.state === 'playing');
    this.animatePlayer(dt);
    this.updateCamera(dt);
    this.particles.update(dt);

    this.score = scoreFor(this.distance, this.coins);
    this.updateHUD();

    this.sinceSpawn += this.speed * dt;
    if (this.sinceSpawn >= this.nextGap) {
      this.spawnRow(SPAWN_AHEAD, difficultyAt(this.distance));
      this.sinceSpawn = 0;
      this.nextGap = gapFor(this.speed, Math.random);
    }

    if (this.coinStreakTimer > 0) {
      this.coinStreakTimer -= dt;
      if (this.coinStreakTimer <= 0) this.coinStreak = 0;
    }

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) dom.hint.classList.remove('is-visible');
    }

    this.intensityTimer -= dt;
    if (this.intensityTimer <= 0) {
      this.sfx.setIntensity(clamp((this.speed - START_SPEED) / 30, 0, 1));
      this.intensityTimer = 0.6;
    }
  }

  updateCrashing(dt) {
    this.crashT += dt;
    this.speed = damp(this.speed, 0, 3.4, dt);
    this.world.update(dt, this.speed);
    this.updateObstacles(dt);
    this.updateCoins(dt, this.speed, false);
    this.animatePlayer(dt);
    this.updateCamera(dt);
    this.particles.update(dt);
    this.updateHUD();

    this.player.group.rotation.z = damp(this.player.group.rotation.z, -1.25, 6, dt);
    this.player.group.rotation.x = damp(this.player.group.rotation.x, -0.52, 6, dt);
    this.player.group.position.y = damp(this.player.group.position.y, 0.18, 5, dt);

    if (this.crashT > 0.95) this.showResults();
  }

  updateGameOver(dt) {
    this.speed = damp(this.speed, 0, 5, dt);
    this.world.update(dt, this.speed);
    this.updateObstacles(dt);
    this.updateCoins(dt, this.speed, false);
    this.animatePlayer(dt);
    this.updateCamera(dt);
    this.particles.update(dt);
  }

  updatePlayer(dt) {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.slideBuffer = Math.max(0, this.slideBuffer - dt);
    this.slideTimer = Math.max(0, this.slideTimer - dt);

    const previousX = this.player.group.position.x;
    const targetX = LANE_X[this.targetLane];
    this.player.group.position.x = damp(this.player.group.position.x, targetX, 14, dt);
    const velocityX = dt > 0 ? (this.player.group.position.x - previousX) / dt : 0;
    this.laneLean = damp(this.laneLean || 0, clamp(-velocityX * 0.014, -0.2, 0.2), 10, dt);

    if (!this.grounded) {
      this.velocityY -= 36 * dt;
      this.playerY += this.velocityY * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.velocityY = 0;
        this.grounded = true;
        if (this.slideBuffer > 0) {
          this.slideBuffer = 0;
          this.slideTimer = 0.74;
          this.sfx.slide();
        } else if (this.jumpBuffer > 0) {
          this.jumpBuffer = 0;
          this.velocityY = 13.4;
          this.grounded = false;
          this.sfx.jump();
        }
      }
    }

    this.player.group.position.y = this.playerY;
  }

  animatePlayer(dt) {
    if (this.state !== 'paused' && this.state !== 'gameover') {
      this.runPhase += dt * (6.2 + this.speed * 0.42);
    }

    const airborne = !this.grounded;
    const sliding = this.slideTimer > 0;
    const running = this.state === 'playing' || this.state === 'menu';
    this.runBlend = damp(this.runBlend, running && !airborne && !sliding ? 1 : 0, 11, dt);
    this.crouch = damp(this.crouch, sliding && this.grounded ? 1 : 0, 17, dt);

    const rig = this.player.rig;
    rig.scale.y = 1 - 0.45 * this.crouch;
    rig.rotation.z = (this.laneLean || 0) + Math.sin(this.runPhase * 2) * 0.012 * this.runBlend;
    rig.rotation.y = (this.laneLean || 0) * 0.4;
    rig.position.y = this.grounded && !sliding ? Math.abs(Math.sin(this.runPhase)) * 0.055 * this.runBlend : 0;

    let legL = 0;
    let legR = 0;
    let kneeL = 0;
    let kneeR = 0;
    let armL = 0;
    let armR = 0;
    let foreL = -0.2;
    let foreR = -0.2;
    let lean = 0.06;
    let headTilt = 0;

    if (this.state === 'crashing') {
      const flail = Math.sin(this.crashT * 18) * 0.4;
      legL = -0.9 + flail;
      legR = 0.6 - flail;
      kneeL = -0.5;
      kneeR = -0.9;
      armL = 2.1 + flail;
      armR = 1.4 - flail;
      foreL = -0.4;
      foreR = -0.7;
      lean = -0.2;
      headTilt = 0.4;
    } else if (airborne) {
      legL = 0.95;
      legR = -0.45;
      kneeL = -1.0;
      kneeR = -0.45;
      armL = 1.9;
      armR = 2.15;
      foreL = -0.35;
      foreR = -0.4;
      lean = 0.14;
      headTilt = -0.12;
    } else if (sliding) {
      legL = 1.0;
      legR = 0.82;
      kneeL = -0.55;
      kneeR = -0.5;
      armL = -0.95;
      armR = -0.8;
      foreL = -0.5;
      foreR = -0.55;
      lean = 0.5;
      headTilt = -0.28;
    } else {
      const swing = Math.sin(this.runPhase) * 0.92 * this.runBlend;
      legL = swing;
      legR = -swing;
      kneeL = -Math.max(0, -Math.sin(this.runPhase)) * 0.95 * this.runBlend;
      kneeR = -Math.max(0, Math.sin(this.runPhase)) * 0.95 * this.runBlend;
      armL = -swing * 0.78;
      armR = swing * 0.78;
      foreL = -0.4 - Math.max(0, -swing) * 0.28;
      foreR = -0.4 - Math.max(0, swing) * 0.28;
      lean = 0.075 + Math.sin(this.runPhase * 2) * 0.012 * this.runBlend;
      headTilt = -0.04;
    }

    const lambda = 18;
    this.player.legL.rotation.x = damp(this.player.legL.rotation.x, legL, lambda, dt);
    this.player.legR.rotation.x = damp(this.player.legR.rotation.x, legR, lambda, dt);
    this.player.kneeL.rotation.x = damp(this.player.kneeL.rotation.x, kneeL, lambda, dt);
    this.player.kneeR.rotation.x = damp(this.player.kneeR.rotation.x, kneeR, lambda, dt);
    this.player.armL.rotation.x = damp(this.player.armL.rotation.x, armL, lambda, dt);
    this.player.armR.rotation.x = damp(this.player.armR.rotation.x, armR, lambda, dt);
    this.player.forearmL.rotation.x = damp(this.player.forearmL.rotation.x, foreL, lambda, dt);
    this.player.forearmR.rotation.x = damp(this.player.forearmR.rotation.x, foreR, lambda, dt);
    this.player.upper.rotation.x = damp(this.player.upper.rotation.x, lean, 14, dt);
    this.player.head.rotation.x = damp(this.player.head.rotation.x, headTilt, 14, dt);
    this.player.backpack.rotation.x = damp(
      this.player.backpack.rotation.x,
      Math.sin(this.runPhase * 2) * 0.045 * this.runBlend,
      12,
      dt
    );

    const contact = this.player.contact;
    contact.position.set(this.player.group.position.x, 0.018, 0.1);
    contact.scale.set(1 + this.playerY * 0.06, 1.4 + this.playerY * 0.12, 1);
    contact.material.opacity = clamp(0.35 - this.playerY * 0.07, 0.08, 0.35);
    contact.visible = this.state !== 'crashing';
  }

  updateCamera(dt) {
    const portrait = this.portrait;
    const menu = this.state === 'menu';
    const t = this.time;
    const px = this.player.group.position.x;

    let targetX;
    let targetY;
    let targetZ;
    let lookX;
    let lookY;
    let lookZ;

    if (menu) {
      targetX = (portrait ? -2.9 : -1.35) + Math.sin(t * 0.2) * (portrait ? 0.22 : 0.45);
      targetY = (portrait ? 5.15 : 4.62) + Math.sin(t * 0.31) * 0.1;
      targetZ = portrait ? 12.0 : 9.8;
      lookX = portrait ? -1.15 : -0.25;
      lookY = portrait ? 4.25 : 1.78;
      lookZ = -6.5;
    } else {
      targetX = px * 0.26;
      targetY = (portrait ? 5.35 : 4.55) + this.playerY * 0.12 + Math.sin(t * 9) * 0.018;
      targetZ = portrait ? 12.2 : 9.2;
      lookX = px * 0.1;
      lookY = (portrait ? 1.95 : 1.72) + this.playerY * 0.18;
      lookZ = -9;
    }

    this.camera.position.x = damp(this.camera.position.x, targetX, menu ? 1.8 : 6.5, dt);
    this.camera.position.y = damp(this.camera.position.y, targetY, menu ? 1.8 : 5, dt);
    this.camera.position.z = damp(this.camera.position.z, targetZ, menu ? 1.8 : 4, dt);
    this.camera.lookAt(lookX, lookY, lookZ);

    if (this.shake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.55;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.38;
      this.camera.rotation.z += (Math.random() - 0.5) * this.shake * 0.045;
      this.shake = damp(this.shake, 0, 5.6, dt);
    }
  }

  // ------------------------------------------------------------- world state

  prefill() {
    const introLane = Math.random() < 0.5 ? 0 : 2;
    this.addHazard('barrier', introLane, -64);
    this.spawnCoinLine(introLane, -64, 7, 1.9, 'arc');

    for (let i = 0; i < 3; i += 1) {
      this.spawnRow(-96 - i * 30, i * 0.05);
    }
    this.sinceSpawn = 0;
  }

  spawnRow(z = SPAWN_AHEAD, difficulty = 0) {
    const row = pickRow(Math.random, difficulty);
    for (const hazard of row.hazards) {
      this.addHazard(hazard.type, hazard.lane, z);
    }

    const single = row.hazards.length === 1;
    const hazard = row.hazards[0];

    if (single && hazard.type === 'barrier' && Math.random() < 0.68) {
      this.spawnCoinLine(hazard.lane, z, 7, 1.9, 'arc');
    } else if (single && hazard.type === 'gate' && Math.random() < 0.64) {
      this.spawnCoinLine(hazard.lane, z, 6, 1.75, 'low');
    } else {
      const count = single && hazard.type === 'train' ? 9 : 7;
      this.spawnCoinLine(row.freeLane, z, count, 2.05, 'flat');
    }
  }

  updateObstacles(dt) {
    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i];
      obstacle.group.position.z += this.speed * dt;
      const z = obstacle.group.position.z;

      if (z > DESPAWN_BEHIND) {
        this.obstacles.splice(i, 1);
        this.recycleObstacle(obstacle);
        continue;
      }

      if (this.state === 'playing') {
        const hit = obstacleHitsPlayer(
          { lane: obstacle.lane, type: obstacle.type, z, depth: obstacle.depth },
          {
            lane: this.targetLane,
            y: this.playerY,
            sliding: this.slideTimer > 0,
          }
        );
        if (hit) {
          this.triggerCrash(obstacle.type);
          return;
        }
      }
    }
  }

  updateCoins(dt, speed, collect) {
    for (let i = this.coinItems.length - 1; i >= 0; i -= 1) {
      const coin = this.coinItems[i];
      const group = coin.group;
      group.position.z += speed * dt;
      group.rotation.y += dt * 4.2;
      group.position.y = coin.baseY + Math.sin(this.time * 4 + coin.phase) * 0.075;

      if (group.position.z > DESPAWN_BEHIND) {
        group.visible = false;
        this.coinPool.push(group);
        this.coinItems.splice(i, 1);
        continue;
      }

      if (!collect) continue;

      const dz = Math.abs(group.position.z);
      const dx = Math.abs(group.position.x - this.player.group.position.x);
      const playerCenterY = this.playerY + (this.crouch > 0.5 ? 0.6 : 1.08);
      const dy = Math.abs(group.position.y - playerCenterY);
      if (dz < 0.92 && dx < 0.9 && dy < 1.22) {
        this.collectCoin(coin, i);
      }
    }
  }

  collectCoin(coin, index) {
    this.coinItems.splice(index, 1);
    const position = coin.group.position.clone();
    coin.group.visible = false;
    this.coinPool.push(coin.group);

    this.coins += 1;
    this.coinStreak += 1;
    this.coinStreakTimer = 1.8;
    this.sfx.coin(this.coinStreak - 1);
    this.particles.spawn(position, {
      count: 13,
      color: 0xffc83d,
      speed: 3.4,
      spread: 0.24,
      gravity: 3.2,
      life: 0.62,
    });

    if (this.coinStreak > 0 && this.coinStreak % 5 === 0) {
      this.pulseCombo(`${this.coinStreak} coin streak`);
    }
    this.score = scoreFor(this.distance, this.coins);
    this.updateHUD(true);
  }

  triggerCrash(type) {
    if (this.state !== 'playing') return;
    this.state = 'crashing';
    this.setBodyState('crashing');
    this.crashType = type;
    this.crashT = 0;
    this.shake = 1.15;
    this.sfx.crash();
    this.sfx.stopWind();
    this.flashEffect();
    dom.hint.classList.remove('is-visible');

    const origin = new THREE.Vector3(this.player.group.position.x, 1.2, 0);
    this.particles.spawn(origin, {
      count: 34,
      color: 0xff8a3d,
      speed: 7.2,
      spread: 0.7,
      gravity: 9,
      life: 0.9,
    });
    this.particles.spawn(origin, {
      count: 18,
      color: 0xff394f,
      speed: 5.4,
      spread: 0.55,
      gravity: 7,
      life: 0.75,
    });
  }

  autopilotUpdate() {
    if (!this.autoplay || this.state !== 'playing') return;
    const lane = this.targetLane;
    const ahead = this.obstacles
      .filter((obstacle) => obstacle.lane === lane && obstacle.group.position.z > -58 && obstacle.group.position.z < 1)
      .sort((a, b) => b.group.position.z - a.group.position.z);
    const closest = ahead[0];
    if (!closest) return;
    const z = closest.group.position.z;

    if (closest.type === 'train') {
      if (z < -40) return;
      let bestLane = -1;
      let bestDistance = 9;
      for (let candidate = 0; candidate < 3; candidate += 1) {
        if (candidate === lane) continue;
        const blocked = this.obstacles.some(
          (obstacle) =>
            obstacle.lane === candidate &&
            obstacle.group.position.z > -62 &&
            obstacle.group.position.z < 5
        );
        const distance = Math.abs(candidate - lane);
        if (!blocked && distance < bestDistance) {
          bestDistance = distance;
          bestLane = candidate;
        }
      }
      if (bestLane >= 0) this.moveLane(bestLane - lane);
    } else if (closest.type === 'barrier') {
      if (z > -12 && z < 1.5) this.requestJump();
    } else if (closest.type === 'gate') {
      if (z > -11 && z < 1.5) this.requestSlide();
    }
  }

  debugState() {
    return {
      state: this.state,
      score: this.score,
      distance: Math.round(this.distance),
      coins: this.coins,
      speed: Number(this.speed.toFixed(2)),
      lane: this.targetLane,
      playerY: Number(this.playerY.toFixed(2)),
      sliding: this.slideTimer > 0,
      obstacles: this.obstacles.length,
      activeCoins: this.coinItems.length,
      best: this.best,
      bank: this.bank,
      autoplay: this.autoplay,
    };
  }

  // ------------------------------------------------------------- debug hooks

  debug() {
    return {
      game: this,
      start: () => this.startGame(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
      menu: () => this.enterMenu(),
      state: () => this.debugState(),
      setAutoplay: (enabled) => {
        this.autoplay = Boolean(enabled);
      },
      crash: () => this.triggerCrash('train'),
      warp: (meters = 320) => {
        if (this.state !== 'playing') return;
        this.distance = meters;
        this.speed = speedAt(meters);
        this.score = scoreFor(meters, this.coins);
        this.clearObstacles();
        for (let i = 0; i < 3; i += 1) this.spawnRow(-56 - i * 30, difficultyAt(meters));
        this.updateHUD(true);
      },
    };
  }
}

async function boot() {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {
    /* fonts are cosmetic; keep going */
  }

  try {
    const game = new NeonRails();
    window.__neonRails = game.debug();
    window.__neonRailsGame = game;
  } catch (error) {
    console.error('Neon Rails failed to start', error);
    dom.fallback.hidden = false;
  }
}

boot();

export { NeonRails };
