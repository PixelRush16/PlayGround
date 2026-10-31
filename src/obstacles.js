import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const LANE_X = [-2.4, 0, 2.4];

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function geometryAt(geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  copy.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    ),
  );
  return copy;
}

function addMerged(group, parts, material) {
  if (!parts.length) return null;
  const geometry = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return mesh;
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.28, "rgba(255,245,205,.95)");
  grad.addColorStop(1, "rgba(255,220,130,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeHazardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffc23c";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#1b2433";
  for (let x = -64; x < 320; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 27, 0);
    ctx.lineTo(x + 54, 0);
    ctx.lineTo(x + 27, 64);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.14)";
  ctx.fillRect(0, 0, 256, 6);
  ctx.fillStyle = "rgba(0,0,0,.19)";
  ctx.fillRect(0, 56, 256, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeTextTexture(text, bg, fg) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = "rgba(255,255,255,.24)";
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, 246, 86);
  ctx.fillStyle = fg;
  ctx.font = "700 46px Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 51);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const shared = {
  glow: makeGlowTexture(),
  hazard: makeHazardTexture(),
  wheel: new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.5, metalness: 0.55 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1d2634, roughness: 0.55, metalness: 0.35 }),
  undercarriage: new THREE.MeshStandardMaterial({ color: 0x252930, roughness: 0.72, metalness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x203742, roughness: 0.18, metalness: 0.65, emissive: 0x1a3135, emissiveIntensity: 0.35 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xb7c0c8, roughness: 0.2, metalness: 0.9 }),
  warmLight: new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffbe5a, emissiveIntensity: 3.4 }),
  warningLight: new THREE.MeshStandardMaterial({ color: 0xffca5b, emissive: 0xff8a21, emissiveIntensity: 2.2 }),
  coin: new THREE.MeshStandardMaterial({
    color: 0xffd34d,
    roughness: 0.25,
    metalness: 0.76,
    emissive: 0x7a4500,
    emissiveIntensity: 0.62,
  }),
  coinRim: new THREE.MeshStandardMaterial({ color: 0xfff0a1, roughness: 0.2, metalness: 0.8, emissive: 0x8f5e00, emissiveIntensity: 0.3 }),
  magnet: new THREE.MeshStandardMaterial({ color: 0x84ffdd, emissive: 0x36dcb7, emissiveIntensity: 2.5, roughness: 0.22, metalness: 0.3 }),
  gatePost: new THREE.MeshStandardMaterial({ color: 0x2b3544, roughness: 0.48, metalness: 0.62 }),
  verticalPost: new THREE.MeshStandardMaterial({ color: 0x39404b, roughness: 0.56, metalness: 0.45 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x222b38, roughness: 0.7 }),
  trainBase: [
    new THREE.MeshStandardMaterial({ color: 0xe6b13f, roughness: 0.42, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0x278f93, roughness: 0.42, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0xd65d45, roughness: 0.42, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0xf0d9b6, roughness: 0.46, metalness: 0.18 }),
  ],
  trainAccent: [
    new THREE.MeshStandardMaterial({ color: 0x22354d, roughness: 0.55, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0xffc73d, roughness: 0.5, metalness: 0.16 }),
    new THREE.MeshStandardMaterial({ color: 0xffc08b, roughness: 0.55, metalness: 0.14 }),
    new THREE.MeshStandardMaterial({ color: 0x2c5963, roughness: 0.5, metalness: 0.2 }),
  ],
};

const trainNumberMats = [
  new THREE.MeshBasicMaterial({ map: makeTextTexture("M2", "#1a2a3c", "#ffc53d"), toneMapped: false }),
  new THREE.MeshBasicMaterial({ map: makeTextTexture("M1", "#1a2a3c", "#ffc53d"), toneMapped: false }),
];
const barrierSignMats = [
  new THREE.MeshBasicMaterial({ map: makeTextTexture("STOP", "#253445", "#ffd05b"), toneMapped: false, side: THREE.DoubleSide }),
  new THREE.MeshBasicMaterial({ map: makeTextTexture("NO ENTRY", "#253445", "#ffd05b"), toneMapped: false, side: THREE.DoubleSide }),
];

const coinGeometry = new THREE.CylinderGeometry(0.245, 0.245, 0.06, 22);
coinGeometry.rotateX(Math.PI / 2);
const coinRimGeometry = new THREE.TorusGeometry(0.245, 0.035, 7, 22);
const coinCoreGeometry = new THREE.BoxGeometry(0.055, 0.22, 0.035);
const coinMergedGeometry = mergeGeometries(
  [
    geometryAt(coinGeometry, [0, 0, 0]),
    geometryAt(coinRimGeometry, [0, 0, 0.04]),
    geometryAt(coinCoreGeometry, [0, 0, -0.035]),
    geometryAt(coinCoreGeometry, [0, 0, 0.035]),
  ],
  false,
);
const trainBodyGeometry = new RoundedBoxGeometry(2.08, 2.42, 5.8, 4, 0.2);
const trainBumperGeometry = new RoundedBoxGeometry(2.04, 0.7, 0.2, 3, 0.08);
const windowGeometry = new THREE.BoxGeometry(0.035, 0.64, 0.72);
const barrierPanelGeometry = new THREE.BoxGeometry(2.02, 0.54, 0.16);
const barrierLegGeometry = new THREE.BoxGeometry(0.15, 0.8, 0.46);

class ParticleBurst {
  constructor(scene, { color, size, count = 120, gravity = 12, life = 0.7 }) {
    this.count = count;
    this.gravity = gravity;
    this.life = life;
    this.particles = [];
    const positions = new Float32Array(count * 3);
    positions.fill(-999);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      map: shared.glow,
      size,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < count; i++) this.particles.push({ active: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, age: 0 });
    this.cursor = 0;
  }

  spawn(position, amount = 6, power = 1) {
    const array = this.points.geometry.attributes.position.array;
    for (let i = 0; i < amount; i++) {
      const index = this.cursor++ % this.count;
      const particle = this.particles[index];
      particle.active = true;
      particle.age = 0;
      particle.x = position.x + rand(-0.13, 0.13);
      particle.y = position.y + rand(-0.16, 0.16);
      particle.z = position.z + rand(-0.13, 0.13);
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(1.2, 4) * power;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = rand(1.4, 5.5) * power;
      particle.vz = Math.sin(angle) * speed * 0.7;
      array[index * 3] = particle.x;
      array[index * 3 + 1] = particle.y;
      array[index * 3 + 2] = particle.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    const array = this.points.geometry.attributes.position.array;
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age > this.life) {
        p.active = false;
        p.y = -999;
        array[i * 3 + 1] = -999;
        dirty = true;
        continue;
      }
      p.vy -= this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      array[i * 3] = p.x;
      array[i * 3 + 1] = p.y;
      array[i * 3 + 2] = p.z;
      dirty = true;
    }
    if (dirty) this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export class Course {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.debris = [];
    this.bonus = 0;
    this.coinsCollected = 0;
    this.coinStreak = 0;
    this.lastCoinAt = -10;
    this.magnetTimer = 0;
    this.goldBurst = new ParticleBurst(scene, { color: 0xffd45c, size: 0.18, count: 150, gravity: 11, life: 0.75 });
    this.crashBurst = new ParticleBurst(scene, { color: 0xff8d55, size: 0.28, count: 100, gravity: 18, life: 1.1 });
    this.sparkBurst = new ParticleBurst(scene, { color: 0x96ffe1, size: 0.26, count: 90, gravity: 6, life: 1.2 });
    this.onCoin = null;
    this.onPower = null;
    this.warningPhase = 0;
    this.powerupMileage = 260;
    this.trainSigns = [
      new THREE.MeshBasicMaterial({ map: makeTextTexture("EXPRESS 07", "#1b3c56", "#ffcf48"), toneMapped: false, transparent: true, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: makeTextTexture("CITY LOOP", "#a83d24", "#fff2dc"), toneMapped: false, transparent: true, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: makeTextTexture("NIGHT LINE", "#21463d", "#8af0ce"), toneMapped: false, transparent: true, side: THREE.DoubleSide }),
    ];
    this.gateSign = new THREE.MeshBasicMaterial({ map: makeTextTexture("DUCK!", "#d56a20", "#fff4e2"), toneMapped: false, transparent: true, side: THREE.DoubleSide });

    this.coinCapacity = 280;
    this.coinMesh = new THREE.InstancedMesh(coinMergedGeometry, shared.coin, this.coinCapacity);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.castShadow = false;
    this.scene.add(this.coinMesh);
    this.coinDummy = new THREE.Object3D();
    this.coinPosition = new THREE.Vector3();
    this.hiddenCoinMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    this.resetCoinPool();
  }

  resetCoinPool() {
    this.freeCoinIndices = Array.from({ length: this.coinCapacity }, (_, index) => index);
    for (let i = 0; i < this.coinCapacity; i++) this.coinMesh.setMatrixAt(i, this.hiddenCoinMatrix);
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    for (const obstacle of this.obstacles) this.scene.remove(obstacle.group);
    for (const powerup of this.powerups) this.scene.remove(powerup.group);
    this.obstacles.length = 0;
    this.coins.length = 0;
    this.powerups.length = 0;
    this.resetCoinPool();
    this.bonus = 0;
    this.coinsCollected = 0;
    this.coinStreak = 0;
    this.lastCoinAt = -10;
    this.magnetTimer = 0;
    this.powerupMileage = 260;
  }

  createTrain(lane, z, variant = 0) {
    const group = new THREE.Group();
    const bodyMat = shared.trainBase[variant % shared.trainBase.length];
    const accentMat = shared.trainAccent[variant % shared.trainAccent.length];
    const cars = Math.random() > 0.52 ? 2 : 1;
    const carDepth = 5.8;
    const gap = 0.26;
    const totalDepth = cars * carDepth + (cars - 1) * gap;
    const front = totalDepth / 2;

    const bodyParts = [];
    const accentParts = [];
    const glassParts = [];
    const darkParts = [];
    const chromeParts = [];
    const wheelParts = [];
    const warmParts = [];

    for (let c = 0; c < cars; c++) {
      const carZ = front - carDepth / 2 - c * (carDepth + gap);
      bodyParts.push(geometryAt(trainBodyGeometry, [0, 1.46, carZ]));
      chromeParts.push(geometryAt(new RoundedBoxGeometry(1.9, 0.2, 5.35, 3, 0.06), [0, 2.77, carZ]));
      darkParts.push(geometryAt(new THREE.BoxGeometry(1.72, 0.38, 4.5), [0, 0.38, carZ]));
      accentParts.push(geometryAt(new THREE.BoxGeometry(2.105, 0.22, 4.9), [0, 1.08, carZ]));
      darkParts.push(geometryAt(new THREE.BoxGeometry(2.0, 0.25, 4.45), [0, 0.55, carZ]));

      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          glassParts.push(geometryAt(windowGeometry, [side * 1.045, 1.92, carZ + 1.92 - i * 1.24]));
        }
        warmParts.push(geometryAt(new THREE.BoxGeometry(0.03, 0.075, 4.6), [side * 1.05, 0.93, carZ]));

        const bogieZ = carZ + (c === 0 ? 1.6 : -1.5);
        darkParts.push(geometryAt(new THREE.BoxGeometry(0.3, 0.36, 1.15), [side * 0.82, 0.28, bogieZ]));
        for (const wheelSide of [-1, 1]) {
          wheelParts.push(
            geometryAt(
              new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12),
              [side * (0.94 + wheelSide * 0.07), 0.2, bogieZ],
              [0, 0, Math.PI / 2],
            ),
          );
        }
      }

      darkParts.push(geometryAt(new THREE.BoxGeometry(0.9, 0.15, 1.7), [0, 2.89, carZ + 0.4]));
    }

    const frontZ = front + 0.02;
    glassParts.push(geometryAt(new THREE.BoxGeometry(1.48, 0.74, 0.05), [0, 2.08, frontZ]));
    chromeParts.push(geometryAt(new THREE.BoxGeometry(1.5, 0.1, 0.08), [0, 2.48, frontZ]));
    darkParts.push(geometryAt(trainBumperGeometry, [0, 0.66, frontZ + 0.02]));
    for (const side of [-1, 1]) {
      warmParts.push(geometryAt(new THREE.CircleGeometry(0.12, 12), [side * 0.7, 1.14, frontZ + 0.04]));
    }

    addMerged(group, bodyParts, bodyMat);
    addMerged(group, accentParts, accentMat);
    addMerged(group, glassParts, shared.glass);
    addMerged(group, darkParts, shared.dark);
    addMerged(group, chromeParts, shared.chrome);
    addMerged(group, wheelParts, shared.wheel);
    addMerged(group, warmParts, shared.warmLight);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), this.trainSigns[variant % this.trainSigns.length]);
    sign.position.set(0, 2.68, frontZ + 0.03);
    group.add(sign);

    const frontNumber = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), trainNumberMats[cars === 2 ? 0 : 1]);
    frontNumber.position.set(0.72, 0.71, frontZ + 0.09);
    group.add(frontNumber);

    for (const side of [-1, 1]) {
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: shared.glow,
          color: 0xffc36a,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.position.set(side * 0.7, 1.14, frontZ + 0.12);
      glow.scale.setScalar(0.8);
      group.add(glow);
    }

    group.position.set(LANE_X[lane], 0, z - totalDepth / 2);
    group.userData.train = true;
    this.scene.add(group);
    this.obstacles.push({
      group,
      type: "train",
      lane,
      x: LANE_X[lane],
      halfWidth: 1.07,
      halfDepth: totalDepth / 2,
      height: 2.9,
    });
  }

  spawnObstacleGlow(group, x, y, z, color) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: shared.glow,
        color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.position.set(x - group.position.x, y, z - group.position.z);
    sprite.scale.set(2.2, 2.2, 2.2);
    group.add(sprite);
  }

  createBarrier(lane, z, variant = 0) {
    const group = new THREE.Group();
    const hazardMat = new THREE.MeshLambertMaterial({ map: shared.hazard });
    const panel = new THREE.Mesh(barrierPanelGeometry, hazardMat);
    panel.position.y = 0.69;
    group.add(panel);

    const steelParts = [];
    steelParts.push(geometryAt(new THREE.BoxGeometry(2.12, 0.1, 0.2), [0, 1.01, 0]));
    const lamps = [];
    for (const side of [-1, 1]) {
      steelParts.push(geometryAt(barrierLegGeometry, [side * 0.76, 0.4, 0]));
      steelParts.push(geometryAt(new THREE.BoxGeometry(0.3, 0.1, 0.62), [side * 0.76, 0.05, 0]));
      lamps.push(geometryAt(new THREE.SphereGeometry(0.09, 7, 5), [side * 0.84, 1.1, 0.07]));
    }
    addMerged(group, steelParts, shared.dark);
    addMerged(group, lamps, shared.warningLight);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), barrierSignMats[variant % 2]);
    sign.position.set(0, 0.71, 0.1);
    group.add(sign);

    group.position.set(LANE_X[lane], 0, z);
    group.userData.barrier = true;
    this.scene.add(group);
    this.obstacles.push({
      group,
      type: "barrier",
      lane,
      x: LANE_X[lane],
      halfWidth: 1.03,
      halfDepth: 0.48,
      height: 1.05,
    });
  }

  createGate(lane, z) {
    const group = new THREE.Group();
    const steelParts = [];
    for (const side of [-1, 1]) {
      steelParts.push(geometryAt(new THREE.BoxGeometry(0.22, 2.85, 0.24), [side * 1.12, 1.42, 0]));
      steelParts.push(geometryAt(new THREE.BoxGeometry(0.55, 0.16, 0.7), [side * 1.12, 0.08, 0]));
    }
    steelParts.push(geometryAt(new THREE.BoxGeometry(2.38, 0.48, 0.38), [0, 2.12, 0]));
    addMerged(group, steelParts, shared.gatePost);

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(2.18, 0.38, 0.26),
      new THREE.MeshLambertMaterial({ map: shared.hazard }),
    );
    beam.position.y = 1.55;
    group.add(beam);

    const darkParts = [geometryAt(new THREE.BoxGeometry(2.06, 0.16, 0.3), [0, 1.32, 0])];
    addMerged(group, darkParts, shared.pad);

    const glowParts = [
      geometryAt(new THREE.BoxGeometry(1.6, 0.035, 0.11), [0, 1.42, 0.15]),
      geometryAt(new THREE.SphereGeometry(0.075, 7, 5), [-1.12, 2.64, 0.12]),
      geometryAt(new THREE.SphereGeometry(0.075, 7, 5), [1.12, 2.64, 0.12]),
    ];
    addMerged(group, glowParts, shared.warmLight);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.54), this.gateSign);
    sign.position.set(0, 2.13, 0.21);
    group.add(sign);

    group.position.set(LANE_X[lane], 0, z);
    group.userData.gate = true;
    this.scene.add(group);
    this.obstacles.push({
      group,
      type: "gate",
      lane,
      x: LANE_X[lane],
      halfWidth: 1.16,
      halfDepth: 0.42,
      height: 2.4,
    });
  }

  spawnCoin(lane, z, y = 1.05) {
    const index = this.freeCoinIndices.pop();
    if (index === undefined) return;
    const coin = {
      index,
      lane,
      x: LANE_X[lane],
      y,
      z,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
      spin: Math.random() * Math.PI * 2,
      magnetized: false,
    };
    this.coins.push(coin);
    this.writeCoin(coin);
  }

  writeCoin(coin) {
    const dummy = this.coinDummy;
    dummy.position.set(coin.x, coin.y, coin.z);
    dummy.rotation.set(0, coin.spin, 0);
    dummy.scale.setScalar(0.9);
    dummy.updateMatrix();
    this.coinMesh.setMatrixAt(coin.index, dummy.matrix);
  }

  hideCoin(coin) {
    this.coinMesh.setMatrixAt(coin.index, this.hiddenCoinMatrix);
    this.freeCoinIndices.push(coin.index);
  }

  spawnCoinLine(lane, z, count = 6, spacing = 2.2, arc = false) {
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const y = arc ? 1.02 + Math.sin((i / (count - 1)) * Math.PI) * 0.82 : 1.05;
      this.spawnCoin(lane, z + offset, y);
    }
  }

  spawnPowerup(lane, z) {
    const group = new THREE.Group();
    const orbMat = shared.magnet;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), orbMat);
    group.add(orb);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color: 0x8affdf, wireframe: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    group.add(shell);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.025, 5, 32),
      new THREE.MeshBasicMaterial({ color: 0x9affea, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: shared.glow, color: 0x61ffdd, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.scale.set(2.4, 2.4, 2.4);
    group.add(glow);
    group.position.set(LANE_X[lane], 1.15, z);
    group.userData.shell = shell;
    group.userData.ring = ring;
    this.scene.add(group);
    this.powerups.push({ group, lane, x: LANE_X[lane], collected: false, phase: Math.random() * 6 });
  }

  spawnPattern(z, difficulty = 0) {
    const lanes = [0, 1, 2];
    const shuffled = [...lanes].sort(() => Math.random() - 0.5);
    let blockedCount = 1;
    if (difficulty > 120 && Math.random() < 0.48) blockedCount = 2;
    if (difficulty > 420 && Math.random() < 0.17) blockedCount = 2;
    const blocked = shuffled.slice(0, blockedCount);
    const safe = shuffled.slice(blockedCount);
    const safeLane = safe[Math.floor(Math.random() * safe.length)];

    for (let i = 0; i < blocked.length; i++) {
      const lane = blocked[i];
      const roll = Math.random();
      if (roll < 0.44) this.createTrain(lane, z, Math.floor(Math.random() * 4));
      else if (roll < 0.76) this.createBarrier(lane, z, i);
      else this.createGate(lane, z);
    }

    if (difficulty > 35) {
      const coinCount = difficulty > 180 ? 8 : 6;
      const arc = Math.random() > 0.55;
      this.spawnCoinLine(safeLane, z + 1, coinCount, 2.15, arc);
    } else {
      this.spawnCoinLine(safeLane, z + 2, 4, 2.1, false);
    }

    if (difficulty > this.powerupMileage) {
      this.powerupMileage += 330;
      this.spawnPowerup(safeLane, z - 10);
    }
  }

  prefill() {
    // Give the runner a few beats to settle in before the first hazard arrives.
    this.spawnPattern(-92, 0);
    this.spawnPattern(-128, 30);
    this.spawnPattern(-164, 70);
    this.spawnPattern(-202, 110);
    this.spawnPattern(-240, 150);
    this.spawnPattern(-274, 190);
  }

  update(dt, speed, distance, magnetActive = false) {
    this.warningPhase += dt;
    shared.warningLight.emissiveIntensity = 1.8 + Math.sin(this.warningPhase * 8) * 1.5;
    const move = speed * dt;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.group.position.z += move;
      if (obstacle.group.position.z > 26) {
        this.scene.remove(obstacle.group);
        this.obstacles.splice(i, 1);
      }
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.z += move;
      coin.spin += dt * 3.4;
      coin.y = coin.baseY + Math.sin(this.warningPhase * 2.7 + coin.phase) * 0.08;
      if (magnetActive) {
        const dx = -coin.x;
        const dz = -coin.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 13) {
          coin.magnetized = true;
          const pull = 1 - Math.exp(-8 * dt);
          coin.x += dx * pull;
          coin.z += dz * pull;
          coin.y += (1.1 - coin.y) * pull;
        }
      }
      if (coin.z > 22) {
        this.hideCoin(coin);
        this.coins.splice(i, 1);
      } else {
        this.writeCoin(coin);
      }
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      powerup.phase += dt;
      powerup.group.position.z += move;
      powerup.group.rotation.y += dt * 1.1;
      powerup.group.position.y = 1.15 + Math.sin(powerup.phase * 2) * 0.11;
      powerup.group.userData.ring.rotation.z += dt * 1.4;
      powerup.group.userData.shell.rotation.y -= dt * 0.8;
      if (powerup.group.position.z > 22) {
        this.scene.remove(powerup.group);
        this.powerups.splice(i, 1);
      }
    }

    this.goldBurst.update(dt);
    this.crashBurst.update(dt);
    this.sparkBurst.update(dt);
    if (this.lastCoinAt > 0) this.lastCoinAt -= dt;
    if (this.lastCoinAt <= 0) this.coinStreak = 0;
  }

  checkCollisions(player) {
    for (const obstacle of this.obstacles) {
      const dz = Math.abs(obstacle.group.position.z);
      if (dz > obstacle.halfDepth + 0.5) continue;
      if (Math.abs(player.x - obstacle.x) > obstacle.halfWidth + 0.28) continue;
      if (obstacle.type === "train") {
        if (player.y < obstacle.height - 0.12) return obstacle;
      } else if (obstacle.type === "barrier") {
        if (player.y < obstacle.height - 0.08) return obstacle;
      } else if (obstacle.type === "gate") {
        if (!player.sliding || player.y > 0.9) return obstacle;
      }
    }
    return null;
  }

  collectCoins(player, magnetActive = false) {
    let gained = 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      const closeZ = Math.abs(coin.z) < (coin.magnetized ? 2 : 1.15);
      const closeX = Math.abs(coin.x - player.x) < (coin.magnetized ? 1.6 : 0.95);
      const closeY = Math.abs(coin.y - (player.y + 1.02)) < 1.45;
      if (closeZ && closeX && closeY) {
        this.coinPosition.set(coin.x, coin.y, coin.z);
        this.goldBurst.spawn(this.coinPosition, 6, 1);
        this.hideCoin(coin);
        this.coins.splice(i, 1);
        gained += 1;
        this.coinsCollected += 1;
        this.coinStreak += 1;
        this.lastCoinAt = 1.2;
        this.bonus += 10;
        this.onCoin?.(this.coinStreak);
      }
    }
    if (gained) this.coinMesh.instanceMatrix.needsUpdate = true;
    return gained;
  }

  collectPowerups(player) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      if (Math.abs(powerup.group.position.z) < 1.2 && Math.abs(powerup.group.position.x - player.x) < 1.0) {
        this.sparkBurst.spawn(powerup.group.position, 20, 1.3);
        this.scene.remove(powerup.group);
        this.powerups.splice(i, 1);
        this.magnetTimer = 8;
        this.onPower?.();
        return true;
      }
    }
    return false;
  }

  crash(position) {
    this.crashBurst.spawn(position, 26, 1.5);
  }

  setMagnet(active) {
    this.magnetTimer = active ? Math.max(this.magnetTimer, 8) : 0;
  }
}
