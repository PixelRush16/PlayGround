import * as THREE from "three";
import "./style.css";
import { Environment } from "./environment.js";
import { Player } from "./player.js";
import { Course } from "./obstacles.js";
import { SoundEngine } from "./audio.js";

const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;

const dom = {
  scene: document.querySelector("#scene"),
  hud: document.querySelector("#hud"),
  score: document.querySelector("#score"),
  distance: document.querySelector("#distance"),
  speedMult: document.querySelector("#speedMult"),
  speedFill: document.querySelector("#speedFill"),
  coinCount: document.querySelector("#coinCount"),
  bestScore: document.querySelector("#bestScore"),
  startBest: document.querySelector("#startBest"),
  laneMeter: document.querySelector("#laneMeter"),
  laneDots: [...document.querySelectorAll(".lane-dots i")],
  powerUp: document.querySelector("#powerUp"),
  powerTime: document.querySelector("#powerTime"),
  toast: document.querySelector("#toast"),
  startScreen: document.querySelector("#startScreen"),
  gameOverScreen: document.querySelector("#gameOverScreen"),
  pauseScreen: document.querySelector("#pauseScreen"),
  howScreen: document.querySelector("#howScreen"),
  playButton: document.querySelector("#playButton"),
  howButton: document.querySelector("#howButton"),
  howClose: document.querySelector("#howClose"),
  howPlay: document.querySelector("#howPlay"),
  retryButton: document.querySelector("#retryButton"),
  homeButton: document.querySelector("#homeButton"),
  resumeButton: document.querySelector("#resumeButton"),
  quitButton: document.querySelector("#quitButton"),
  pauseButton: document.querySelector("#pauseButton"),
  soundButton: document.querySelector("#soundButton"),
  finalScore: document.querySelector("#finalScore"),
  finalDistance: document.querySelector("#finalDistance"),
  finalCoins: document.querySelector("#finalCoins"),
  finalBest: document.querySelector("#finalBest"),
  newBest: document.querySelector("#newBest"),
  pauseScore: document.querySelector("#pauseScore"),
  pauseDistance: document.querySelector("#pauseDistance"),
  touchControls: document.querySelector("#touchControls"),
  fallback: document.querySelector("#webglFallback"),
};

const BEST_KEY = "metro-rush-best-v1";
const state = {
  mode: "menu",
  distance: 0,
  score: 0,
  speed: 18,
  best: Number.parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0,
  coins: 0,
  magnet: 0,
  deadTimer: 0,
  elapsed: 0,
  spawnAt: 24,
  tutorialStep: 0,
  gameOverShown: false,
  trauma: 0,
  toastTimer: 0,
  scoreBumpTimer: 0,
  laneBump: 0,
  hudTimer: 0,
  menuRendered: false,
  menuDirty: true,
  hudCache: {},
};

// Probe the driver before building the main renderer so software renderers can
// skip antialiasing, which is disproportionately expensive without a GPU.
function probeSoftwareRenderer() {
  try {
    const probe = document.createElement("canvas");
    const ctx = probe.getContext("webgl2", { powerPreference: "high-performance" });
    if (!ctx) return true;
    const info = ctx.getExtension("WEBGL_debug_renderer_info");
    const name = info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
    const software = /llvmpipe|swiftshader|software|mesa offscreen/i.test(name);
    ctx.getExtension("WEBGL_lose_context")?.loseContext();
    return software;
  } catch {
    return false;
  }
}

const softwareProbe = probeSoftwareRenderer();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.scene,
    antialias: !softwareProbe,
    powerPreference: "high-performance",
    alpha: false,
    stencil: false,
  });
} catch (error) {
  dom.fallback.hidden = false;
  throw error;
}

const gl = renderer.getContext();
const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
const gpuName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "";
const softwareRenderer = softwareProbe || /llvmpipe|swiftshader|software|mesa offscreen/i.test(gpuName);
let renderScale = softwareRenderer ? 0.58 : 1;
const maxRenderWidth = softwareRenderer ? 860 : 1920;

function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, softwareRenderer ? 1 : 1.65);
  const scale = Math.min(renderScale, maxRenderWidth / Math.max(width * dpr, 1));
  renderer.setPixelRatio(dpr);
  renderer.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), false);
  if (camera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, softwareRenderer ? 1 : 1.65));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfa184);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 520);
camera.position.set(-4.7, 3.65, 8.9);
const cameraLook = new THREE.Vector3(0.25, 1.25, -5.2);
camera.lookAt(cameraLook);
resizeRenderer();

const environment = new Environment(scene, renderer);
const player = new Player(scene);
const course = new Course(scene);
const sound = new SoundEngine();

const clock = new THREE.Clock();
let toastTimeout = 0;
let bumpedTimeout = 0;
let gameAccumulator = 0;
const FIXED_STEP = 1 / 60;
const MAX_STEPS = 16;

function formatScore(value) {
  return Math.floor(Math.max(0, value)).toString().padStart(6, "0");
}

function refreshBest() {
  dom.bestScore.textContent = formatScore(state.best);
  dom.startBest.textContent = formatScore(state.best);
}

function showToast(message, duration = 1500) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => dom.toast.classList.remove("show"), duration);
}

function flashScore() {
  dom.score.classList.add("bump");
  window.clearTimeout(bumpedTimeout);
  bumpedTimeout = window.setTimeout(() => dom.score.classList.remove("bump"), 180);
}

function updateHud(force = false) {
  const cache = state.hudCache;
  const score = Math.floor(state.score);
  if (force || cache.score !== score) {
    dom.score.textContent = formatScore(score);
    cache.score = score;
  }
  const meters = Math.floor(state.distance);
  if (force || cache.distance !== meters) {
    dom.distance.textContent = String(meters);
    cache.distance = meters;
  }
  if (force || cache.coins !== state.coins) {
    dom.coinCount.textContent = String(state.coins);
    cache.coins = state.coins;
  }
  const speedNorm = clamp((state.speed - 18) / 20, 0, 1);
  const speedLabel = `x${(1 + speedNorm * 1.1).toFixed(1)}`;
  if (force || cache.speedLabel !== speedLabel) {
    dom.speedMult.textContent = speedLabel;
    cache.speedLabel = speedLabel;
  }
  const fill = `${Math.round(8 + speedNorm * 92)}%`;
  if (force || cache.fill !== fill) {
    dom.speedFill.style.width = fill;
    cache.fill = fill;
  }
  const magnetOn = state.magnet > 0;
  if (force || cache.magnetOn !== magnetOn) {
    dom.powerUp.hidden = !magnetOn;
    cache.magnetOn = magnetOn;
  }
  if (magnetOn) {
    const seconds = `${Math.ceil(state.magnet)}s`;
    if (force || cache.powerTime !== seconds) {
      dom.powerTime.textContent = seconds;
      cache.powerTime = seconds;
    }
  }
}

function updateLaneMeter() {
  for (let i = 0; i < dom.laneDots.length; i++) {
    dom.laneDots[i].classList.toggle("active", i === player.targetLane);
  }
}

function setMutedUi(muted) {
  dom.soundButton.classList.toggle("muted", muted);
  dom.soundButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  dom.soundButton.title = muted ? "Unmute sound" : "Mute sound";
}

function startGame() {
  sound.init();
  sound.startMusic();
  sound.click();
  state.mode = "playing";
  state.distance = 0;
  state.score = 0;
  state.speed = 18;
  state.coins = 0;
  state.magnet = 0;
  state.deadTimer = 0;
  state.elapsed = 0;
  state.spawnAt = 24;
  state.tutorialStep = 0;
  state.gameOverShown = false;
  state.trauma = 0;
  state.laneBump = 0;
  state.hudTimer = 1;
  state.hudCache = {};
  gameAccumulator = 0;
  course.reset();
  course.prefill();
  course.magnetTimer = 0;
  player.reset();
  updateHud(true);
  updateLaneMeter();

  dom.startScreen.classList.add("is-leaving");
  window.setTimeout(() => {
    if (state.mode !== "menu") dom.startScreen.hidden = true;
  }, 460);
  dom.gameOverScreen.hidden = true;
  dom.pauseScreen.hidden = true;
  dom.howScreen.hidden = true;
  dom.hud.hidden = false;
  dom.laneMeter.hidden = false;
  dom.touchControls.hidden = false;
  dom.toast.classList.remove("show");
  showToast("RUN!", 850);
  window.setTimeout(() => {
    if (state.mode === "playing" && state.tutorialStep === 0) {
      showToast("←  →  SWITCH LANES", 1700);
      state.tutorialStep = 1;
    }
  }, 950);
}

function goHome() {
  sound.stopMusic();
  state.mode = "menu";
  state.distance = 0;
  state.score = 0;
  state.speed = 18;
  state.coins = 0;
  state.magnet = 0;
  course.reset();
  player.reset();
  camera.position.set(-4.7, 3.65, 8.9);
  cameraLook.set(0.25, 1.25, -5.2);
  dom.startScreen.hidden = false;
  dom.startScreen.classList.remove("is-leaving");
  dom.gameOverScreen.hidden = true;
  dom.pauseScreen.hidden = true;
  dom.howScreen.hidden = true;
  dom.hud.hidden = true;
  dom.laneMeter.hidden = true;
  dom.touchControls.hidden = true;
  dom.powerUp.hidden = true;
  dom.toast.classList.remove("show");
  refreshBest();
  state.menuRendered = false;
  state.menuDirty = true;
}

function pauseGame() {
  if (state.mode !== "playing") return;
  state.mode = "paused";
  dom.pauseScreen.hidden = false;
  dom.touchControls.hidden = true;
  dom.pauseScore.textContent = formatScore(state.score);
  dom.pauseDistance.textContent = `${Math.floor(state.distance)}m`;
  dom.toast.classList.remove("show");
  sound.stopMusic();
  sound.click();
}

function resumeGame() {
  if (state.mode !== "paused") return;
  state.mode = "playing";
  dom.pauseScreen.hidden = true;
  dom.touchControls.hidden = false;
  sound.startMusic();
  sound.click();
  gameAccumulator = 0;
  clock.getDelta();
}

function endRun() {
  if (state.gameOverShown) return;
  state.gameOverShown = true;
  state.mode = "over";
  const finalScore = Math.floor(state.score);
  const isNewBest = finalScore > state.best;
  if (isNewBest) {
    state.best = finalScore;
    localStorage.setItem(BEST_KEY, String(state.best));
  }
  refreshBest();
  dom.finalScore.textContent = formatScore(finalScore);
  dom.finalDistance.textContent = `${Math.floor(state.distance)}m`;
  dom.finalCoins.textContent = String(state.coins);
  dom.finalBest.textContent = formatScore(state.best);
  dom.newBest.hidden = !isNewBest;
  dom.gameOverScreen.hidden = false;
  dom.touchControls.hidden = true;
  dom.gameOverScreen.querySelector(".modal-card").animate(
    [
      { transform: "translateY(22px) scale(.97)", opacity: 0 },
      { transform: "translateY(0) scale(1)", opacity: 1 },
    ],
    { duration: 380, easing: "cubic-bezier(.18,1.25,.3,1)" },
  );
}

function crash(obstacle) {
  if (state.mode !== "playing") return;
  state.mode = "dead";
  state.deadTimer = 0;
  state.trauma = 1;
  player.die();
  sound.crash();
  sound.stopMusic();
  course.crash(new THREE.Vector3(player.x, 1.1 + player.y, 0));
  dom.toast.classList.remove("show");
  dom.touchControls.hidden = true;
  document.body.classList.add("impact");
  window.setTimeout(() => document.body.classList.remove("impact"), 240);
  if (navigator.vibrate) navigator.vibrate([35, 35, 65]);
  state.lastObstacle = obstacle;
}

function laneLeft() {
  if (state.mode !== "playing") return;
  if (player.moveLeft()) {
    sound.swipe(-1);
    state.laneBump = 1;
    updateLaneMeter();
  }
}

function laneRight() {
  if (state.mode !== "playing") return;
  if (player.moveRight()) {
    sound.swipe(1);
    state.laneBump = 1;
    updateLaneMeter();
  }
}

function doJump() {
  if (state.mode !== "playing") return;
  if (player.jump()) sound.jump();
}

function doSlide() {
  if (state.mode !== "playing") return;
  if (player.slide()) sound.slide();
}

function handleSpawn(dt) {
  if (state.distance >= state.spawnAt) {
    course.spawnPattern(-270, state.distance);
    const gap = 29 + Math.min(13, state.speed * 0.28) + Math.random() * 5;
    state.spawnAt += gap;
  }
  // Keep the queue fed if a frame stalls.
  let safety = 0;
  while (state.distance > state.spawnAt && safety++ < 3) {
    course.spawnPattern(-270, state.distance);
    state.spawnAt += 33;
  }
}

function updateGame(dt) {
  state.elapsed += dt;
  state.speed = 18 + Math.min(state.distance * 0.026, 20);
  state.distance += state.speed * dt;
  state.score = state.distance * 10 + state.coins * 50;

  if (state.magnet > 0) {
    state.magnet = Math.max(0, state.magnet - dt);
    course.magnetTimer = state.magnet;
  }

  const magnetActive = state.magnet > 0;
  handleSpawn(dt);
  environment.update(dt, state.speed, state.distance);
  player.update(dt, state.speed);
  course.update(dt, state.speed, state.distance, magnetActive);
  const gained = course.collectCoins(player, magnetActive);
  if (gained > 0) {
    state.coins += gained;
    state.score = state.distance * 10 + state.coins * 50;
    flashScore();
  }
  if (course.collectPowerups(player)) {
    state.magnet = 8;
    sound.power();
    showToast("COIN MAGNET · 8 SECONDS", 1800);
  }

  const hit = course.checkCollisions(player);
  if (hit) crash(hit);

  if (state.distance > 55 && state.tutorialStep === 1) {
    state.tutorialStep = 2;
    showToast("JUMP THE LOW BARRIERS", 1600);
  } else if (state.distance > 150 && state.tutorialStep === 2) {
    state.tutorialStep = 3;
    showToast("ROLL UNDER THE SIGNS", 1600);
  }

  state.hudTimer += dt;
  if (state.hudTimer >= 0.1) {
    state.hudTimer = 0;
    updateHud();
  }
}

function updateDead(dt) {
  state.deadTimer += dt;
  state.speed = damp(state.speed, 0, 2.8, dt);
  state.trauma = Math.max(0, state.trauma - dt * 1.8);
  environment.update(dt, state.speed, state.distance);
  course.update(dt, state.speed, state.distance, false);
  player.update(dt, state.speed);
  state.hudTimer += dt;
  if (state.hudTimer >= 0.1) {
    state.hudTimer = 0;
    updateHud();
  }
  if (state.deadTimer > 0.9 && !state.gameOverShown) endRun();
}

function updateMenu(dt) {
  state.elapsed += dt;
  if (!state.menuDirty && state.menuRendered) return;
  const menuSpeed = 5.6;
  environment.update(dt, menuSpeed, 12);
  player.update(dt, menuSpeed, { menu: true });
  state.menuRendered = true;
  state.menuDirty = false;
}

function updateCamera(dt) {
  const inChase = state.mode !== "menu";
  if (inChase) {
    const speedNorm = clamp((state.speed - 18) / 20, 0, 1);
    const slideDip = player.sliding ? 0.3 : 0;
    const targetX = player.x * 0.56;
    const targetY = 4.15 + player.y * 0.11 - slideDip + Math.sin(state.elapsed * 1.35) * 0.018;
    const targetZ = 7.85 + speedNorm * 0.55;
    const lambda = state.mode === "dead" ? 2.4 : 3.8;
    camera.position.x = damp(camera.position.x, targetX, lambda, dt);
    camera.position.y = damp(camera.position.y, targetY, lambda, dt);
    camera.position.z = damp(camera.position.z, targetZ, lambda, dt);
    const lookX = player.x * 0.72;
    const lookY = 1.25 + player.y * 0.18 - slideDip * 0.14;
    const lookZ = -8.8 - speedNorm * 2.2;
    cameraLook.x = damp(cameraLook.x, lookX, 4, dt);
    cameraLook.y = damp(cameraLook.y, lookY, 4, dt);
    cameraLook.z = damp(cameraLook.z, lookZ, 3, dt);
    const targetFov = 56 + speedNorm * 9;
    camera.fov = damp(camera.fov, targetFov, 3, dt);
  } else {
    const t = state.elapsed;
    const targetX = -4.7 + Math.sin(t * 0.22) * 0.22;
    const targetY = 3.65 + Math.sin(t * 0.35) * 0.06;
    const targetZ = 8.9 + Math.sin(t * 0.18) * 0.12;
    camera.position.x = damp(camera.position.x, targetX, 1.7, dt);
    camera.position.y = damp(camera.position.y, targetY, 1.7, dt);
    camera.position.z = damp(camera.position.z, targetZ, 1.7, dt);
    cameraLook.x = damp(cameraLook.x, 0.25, 2, dt);
    cameraLook.y = damp(cameraLook.y, 1.25, 2, dt);
    cameraLook.z = damp(cameraLook.z, -5.2, 2, dt);
    camera.fov = damp(camera.fov, 50, 2, dt);
  }

  if (state.trauma > 0) {
    const shake = state.trauma * state.trauma;
    camera.position.x += (Math.random() - 0.5) * shake * 0.8;
    camera.position.y += (Math.random() - 0.5) * shake * 0.55;
    cameraLook.x += (Math.random() - 0.5) * shake * 0.25;
    cameraLook.y += (Math.random() - 0.5) * shake * 0.25;
  }

  camera.lookAt(cameraLook);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.25);

  if (state.mode === "menu") {
    if (!state.menuRendered || state.menuDirty) {
      updateMenu(Math.min(rawDt, 0.05));
      updateCamera(Math.min(rawDt, 0.05));
      renderer.render(scene, camera);
    }
    return;
  }

  if (state.mode === "paused") {
    return;
  }

  // Advance the simulation in fixed steps so low frame rates do not slow the
  // run down or let obstacles tunnel through the player.
  gameAccumulator = Math.min(gameAccumulator + rawDt, 0.25);
  let steps = 0;
  while (gameAccumulator >= FIXED_STEP && steps < MAX_STEPS) {
    if (state.mode === "playing") updateGame(FIXED_STEP);
    else if (state.mode === "dead") updateDead(FIXED_STEP);
    else if (state.mode === "over") {
      state.trauma = Math.max(0, state.trauma - FIXED_STEP * 2);
      const speed = damp(state.speed, 0, 4, FIXED_STEP);
      state.speed = speed;
      environment.update(FIXED_STEP, speed, state.distance);
      course.update(FIXED_STEP, speed, state.distance, false);
      player.update(FIXED_STEP, speed);
    }
    gameAccumulator -= FIXED_STEP;
    steps += 1;
  }

  updateCamera(rawDt);
  renderer.render(scene, camera);
}

function handleKeyDown(event) {
  const key = event.key;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar"].includes(key)) {
    event.preventDefault();
  }
  if (event.repeat) return;

  if (state.mode === "menu") {
    if (key === "Enter" || key === " " || key === "Spacebar") startGame();
    return;
  }
  if (state.mode === "paused") {
    if (key === "Escape" || key === "p" || key === "P") resumeGame();
    return;
  }
  if (state.mode === "over") {
    if (key === "Enter" || key === "r" || key === "R") startGame();
    return;
  }
  if (state.mode !== "playing") return;

  switch (key) {
    case "ArrowLeft":
    case "a":
    case "A":
      laneLeft();
      break;
    case "ArrowRight":
    case "d":
    case "D":
      laneRight();
      break;
    case "ArrowUp":
    case "w":
    case "W":
    case " ":
    case "Spacebar":
      doJump();
      break;
    case "ArrowDown":
    case "s":
    case "S":
      doSlide();
      break;
    case "Escape":
    case "p":
    case "P":
      pauseGame();
      break;
    default:
      break;
  }
}

let pointerStart = null;
function onPointerDown(event) {
  if (state.mode !== "playing") return;
  pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  dom.scene.setPointerCapture?.(event.pointerId);
}

function onPointerUp(event) {
  if (!pointerStart || state.mode !== "playing") {
    pointerStart = null;
    return;
  }
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  const elapsed = performance.now() - pointerStart.time;
  const distance = Math.hypot(dx, dy);
  pointerStart = null;

  if (distance < 16 && elapsed < 420) {
    doJump();
    return;
  }
  if (distance < 24) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) laneLeft();
    else laneRight();
  } else if (dy < 0) {
    doJump();
  } else {
    doSlide();
  }
}

function bindTouchButtons() {
  for (const button of dom.touchControls.querySelectorAll("[data-action]")) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.add("pressed");
      window.setTimeout(() => button.classList.remove("pressed"), 120);
      const action = button.dataset.action;
      if (action === "left") laneLeft();
      else if (action === "right") laneRight();
      else if (action === "jump") doJump();
      else if (action === "slide") doSlide();
    });
  }
}

dom.playButton.addEventListener("click", startGame);
dom.howButton.addEventListener("click", () => {
  sound.init();
  sound.click();
  dom.howScreen.hidden = false;
});
dom.howClose.addEventListener("click", () => {
  sound.click();
  dom.howScreen.hidden = true;
});
dom.howPlay.addEventListener("click", () => {
  dom.howScreen.hidden = true;
  startGame();
});
dom.retryButton.addEventListener("click", () => {
  dom.gameOverScreen.hidden = true;
  startGame();
});
dom.homeButton.addEventListener("click", goHome);
dom.resumeButton.addEventListener("click", resumeGame);
dom.pauseButton.addEventListener("click", pauseGame);
dom.quitButton.addEventListener("click", goHome);
dom.soundButton.addEventListener("click", () => {
  sound.init();
  const muted = sound.toggleMuted();
  setMutedUi(muted);
  if (!muted) sound.click();
});
dom.scene.addEventListener("pointerdown", onPointerDown);
dom.scene.addEventListener("pointerup", onPointerUp);
dom.scene.addEventListener("pointercancel", () => (pointerStart = null));
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("blur", () => {
  if (state.mode === "playing") pauseGame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.mode === "playing") pauseGame();
});

window.addEventListener("resize", () => {
  resizeRenderer();
  state.menuDirty = true;
});

course.onCoin = (streak) => {
  sound.coin(streak);
  flashScore();
};
course.onPower = () => {};

window.__metro = { renderer, scene, camera, player, course, environment, state, gl, gpuName, softwareRenderer, dom };

bindTouchButtons();
refreshBest();
setMutedUi(false);
updateHud(true);
animate();
