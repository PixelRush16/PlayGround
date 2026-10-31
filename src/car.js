import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ARENA, TEAM } from './constants.js';
import { collideArena } from './physics.js';
import { clamp, damp, lerp, makeCanvas, textureFromCanvas, rand, chance, TAU } from './utils.js';

function makeNameTexture(name, color, isPlayer) {
  const c = makeCanvas(384, 96);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 384, 96);
  g.fillStyle = 'rgba(4,9,22,0.72)';
  g.beginPath();
  g.roundRect(8, 12, 368, 64, 16);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.stroke();
  g.font = '400 34px Bungee, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = isPlayer ? '#d9ff45' : '#eaf6ff';
  g.fillText(name, 192, 46);
  return c;
}

function buildCarModel(team, index, isPlayer, effects) {
  const palette = team === 'blue'
    ? [0x2fc9ff, 0x7b8cff]
    : [0xff406e, 0xff8a3d];
  const color = palette[index % palette.length];
  const teamData = TEAM[team];

  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  const paintMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.62,
    roughness: 0.26,
    emissive: color,
    emissiveIntensity: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: team === 'blue' ? 0xd9fbff : 0xffe3e9,
    metalness: 0.35,
    roughness: 0.32,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a1020, metalness: 0.7, roughness: 0.32 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1628,
    metalness: 0.95,
    roughness: 0.08,
    transparent: true,
    opacity: 0.92,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0e16, roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshBasicMaterial({ color: teamData.color });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d4f });
  const neonMat = new THREE.MeshBasicMaterial({ color: teamData.color });
  const paintMats = [paintMat, accentMat];

  const body = new THREE.Mesh(new RoundedBoxGeometry(2.12, 0.66, 4.25, 4, 0.24), paintMat);
  body.position.y = 0.78;
  body.castShadow = true;
  visual.add(body);

  const nose = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.32, 1.25, 3, 0.12), paintMat);
  nose.position.set(0, 0.6, 1.82);
  nose.castShadow = true;
  visual.add(nose);

  const splitter = new THREE.Mesh(new RoundedBoxGeometry(2.05, 0.12, 0.55, 2, 0.05), darkMat);
  splitter.position.set(0, 0.42, 2.15);
  visual.add(splitter);

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.58, 0.64, 1.85, 4, 0.24), glassMat);
  cabin.position.set(0, 1.2, -0.18);
  cabin.castShadow = true;
  visual.add(cabin);

  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.1, 1.5, 2, 0.04), accentMat);
  roof.position.set(0, 1.51, -0.2);
  visual.add(roof);

  // racing stripes
  for (const sx of [-0.3, 0.3]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 3.1), accentMat);
    stripe.position.set(sx, 1.12, 0.35);
    visual.add(stripe);
  }

  const spoiler = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.1, 0.62, 2, 0.04), accentMat);
  spoiler.position.set(0, 1.38, -1.95);
  visual.add(spoiler);
  for (const sx of [-0.72, 0.72]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.14), darkMat);
    support.position.set(sx, 1.12, -1.95);
    visual.add(support);
  }

  // side skirts / neon
  for (const sx of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 3.1), neonMat);
    skirt.position.set(sx * 1.07, 0.5, 0);
    visual.add(skirt);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.7), darkMat);
    vent.position.set(sx * 1.07, 0.86, -0.75);
    visual.add(vent);
  }

  // headlights
  for (const sx of [-0.62, 0.62]) {
    const light = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.18, 0.1, 2, 0.04), lightMat);
    light.position.set(sx, 0.72, 2.23);
    visual.add(light);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.13, 0.08), tailMat);
    tail.position.set(sx, 0.78, -2.16);
    visual.add(tail);
  }

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.44, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.46, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const frontWheels = [];
  for (const sz of [1.36, -1.4]) {
    for (const sx of [-1, 1]) {
      const group = new THREE.Group();
      group.position.set(sx * 1.04, 0.52, sz);
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheel.add(rim);
      group.add(wheel);
      visual.add(group);
      wheels.push(wheel);
      if (sz > 0) frontWheels.push(group);
    }
  }

  // exhausts + flames
  const exhausts = [];
  const flames = [];
  const flameGeo = new THREE.ConeGeometry(0.25, 1.5, 8, 1, true);
  flameGeo.translate(0, 0.75, 0);
  flameGeo.rotateX(-Math.PI / 2);
  for (const sx of [-0.48, 0.48]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.5, 10), darkMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx, 0.66, -2.18);
    visual.add(pipe);
    exhausts.push(pipe);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffb23e,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(sx, 0.66, -2.45);
    flame.visible = false;
    visual.add(flame);
    flames.push(flame);
  }

  // driver helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), paintMat);
  helmet.position.set(0, 1.53, 0.18);
  visual.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0.7, 0.8), glassMat);
  visor.position.set(0, 1.55, 0.38);
  visor.rotation.x = 0.1;
  visual.add(visor);

  // underglow
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 6.6),
    new THREE.MeshBasicMaterial({
      map: effects.glowTex,
      color: teamData.color,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.035;
  visual.add(glow);

  // star aura
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: effects.glowTex,
    color: 0xffe14a,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  aura.position.y = 1.1;
  aura.scale.set(7, 5, 1);
  aura.visible = false;
  visual.add(aura);

  return { root, visual, paintMats, wheels, frontWheels, flames, aura, glow, color, teamData };
}

export class Car {
  constructor(scene, { team, index, name, isPlayer = false, effects, audio }) {
    this.scene = scene;
    this.team = team;
    this.index = index;
    this.name = name;
    this.isPlayer = isPlayer;
    this.effects = effects;
    this.audio = audio;

    const model = buildCarModel(team, index, isPlayer, effects);
    this.root = model.root;
    this.visual = model.visual;
    this.paintMats = model.paintMats;
    this.wheels = model.wheels;
    this.frontWheels = model.frontWheels;
    this.flames = model.flames;
    this.aura = model.aura;
    this.glow = model.glow;
    this.color = model.color;
    this.teamData = model.teamData;
    scene.add(this.root);

    const nameCanvas = makeNameTexture(name, isPlayer ? '#d9ff45' : this.teamData.glow, isPlayer);
    const nameTex = textureFromCanvas(nameCanvas);
    this.nameTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthWrite: false, depthTest: true }));
    this.nameTag.position.y = 3.25;
    this.nameTag.scale.set(4.1, 1.03, 1);
    this.nameTag.renderOrder = 20;
    this.root.add(this.nameTag);

    if (isPlayer) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.055, 6, 40),
        new THREE.MeshBasicMaterial({ color: 0xd9ff45, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.playerRing = ring;
      this.root.add(ring);
    }

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.controls = { throttle: 0, steer: 0, boost: false, jump: false, item: false, drift: false };
    this.prevJump = false;
    this.prevItem = false;
    this.itemPressed = false;
    this.boost = 50;
    this.boosting = false;
    this.grounded = true;
    this.jumps = 0;
    this.boostTime = 0;
    this.starTime = 0;
    this.shrinkTime = 0;
    this.slowTime = 0;
    this.spinoutTime = 0;
    this.spinDir = 1;
    this.hitCooldown = 0;
    this.wallHitCooldown = 0;
    this.flipTime = 0;
    this.flipDir = 1;
    this.squash = 0;
    this.visualScale = 1;
    this.item = null;
    this.itemAge = 0;
    this.onHit = null;
    this.speedMultiplier = 1;
    this.wheelSpin = 0;
    this.trailTimer = 0;
    this.starSparkTimer = 0;
    this.reset(0, 0, 0);
  }

  reset(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.boost = 50;
    this.boosting = false;
    this.grounded = true;
    this.jumps = 0;
    this.boostTime = 0;
    this.starTime = 0;
    this.shrinkTime = 0;
    this.slowTime = 0;
    this.spinoutTime = 0;
    this.hitCooldown = 0;
    this.flipTime = 0;
    this.squash = 0;
    this.visualScale = 1;
    this.item = null;
    this.itemAge = 0;
    this.controls.throttle = 0;
    this.controls.steer = 0;
    this.controls.boost = false;
    this.controls.jump = false;
    this.controls.item = false;
    this.prevJump = false;
    this.prevItem = false;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    this.visual.rotation.set(0, 0, 0);
    this.visual.scale.setScalar(1);
    this.aura.visible = false;
    this.root.visible = true;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get maxSpeed() {
    let cap = 36;
    if (this.boostTime > 0) cap = 58;
    else if (this.boosting) cap = 52;
    if (this.starTime > 0) cap = Math.max(cap, 60);
    if (this.shrinkTime > 0) cap *= 0.62;
    if (this.spinoutTime > 0) cap *= 0.45;
    return cap * this.speedMultiplier;
  }

  jump() {
    if (this.grounded) {
      this.vel.y = 13.2;
      this.grounded = false;
      this.jumps = 1;
      this.flipTime = 0;
      this.effects.sparkle(new THREE.Vector3(this.pos.x, this.pos.y + 0.3, this.pos.z), 0xbfeaff, 6, 0.7, 0.4);
      if (this.isPlayer) this.audio.jump();
      return;
    }
    if (this.jumps < 2) {
      this.jumps = 2;
      this.vel.y = 9.4;
      const forward = this.forward;
      this.vel.x += forward.x * 7.5;
      this.vel.z += forward.z * 7.5;
      this.flipTime = 0.52;
      this.flipDir = chance(0.5) ? 1 : -1;
      this.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z), this.teamData.color, 12, { speed: 7, size: 0.8, life: 0.45, gravity: 2 });
      if (this.isPlayer) this.audio.flip();
    }
  }

  takeHit(direction, power = 1) {
    if (this.starTime > 0) return false;
    if (this.hitCooldown > 0) return false;
    this.hitCooldown = 0.75;
    this.spinoutTime = Math.max(this.spinoutTime, 1.25 + rand(0, 0.45));
    this.spinDir = chance(0.5) ? 1 : -1;
    this.vel.x += direction.x * 13 * power;
    this.vel.z += direction.z * 13 * power;
    this.vel.y = Math.max(this.vel.y, 4.5);
    this.grounded = false;
    this.jumps = 2;
    this.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z), 0xfff0a0, 26, { speed: 13, size: 1.1, life: 0.7, gravity: 6 });
    this.effects.ring(new THREE.Vector3(this.pos.x, this.pos.y + 1, this.pos.z), 0xffd84a, 2, 0.35, 7);
    if (this.isPlayer) {
      this.effects.addShake(0.55);
      this.audio.hurt();
      this.onHit?.();
    } else {
      this.audio.botHit();
    }
    return true;
  }

  applyLightning() {
    if (this.starTime > 0) return false;
    this.shrinkTime = 4.4;
    this.slowTime = 4.4;
    this.spinoutTime = Math.max(this.spinoutTime, 0.6);
    this.effects.lightning(new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z));
    if (this.isPlayer) {
      this.effects.addShake(0.4);
      this.audio.hurt();
      this.onHit?.();
    }
    return true;
  }

  applyStar() {
    this.starTime = 7;
    this.boost = 100;
    this.aura.visible = true;
    this.effects.flash(new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z), 0xffe14a, 10);
    this.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z), 0xffe14a, 30, { speed: 12, size: 1.2, life: 0.8, gravity: 2 });
    if (this.isPlayer) this.audio.star();
  }

  update(dt, time) {
    const c = this.controls;
    this.itemPressed = c.item && !this.prevItem;
    this.prevItem = c.item;

    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.wallHitCooldown = Math.max(0, this.wallHitCooldown - dt);
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.starTime = Math.max(0, this.starTime - dt);
    this.shrinkTime = Math.max(0, this.shrinkTime - dt);
    this.slowTime = Math.max(0, this.slowTime - dt);
    this.spinoutTime = Math.max(0, this.spinoutTime - dt);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.flipTime = Math.max(0, this.flipTime - dt);
    if (this.item) this.itemAge += dt;

    const spinning = this.spinoutTime > 0;
    const forward = this.forward;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let vF = this.vel.dot(forward);
    let vR = this.vel.dot(right);

    if (this.grounded) {
      if (!spinning) {
        if (c.throttle > 0.05) {
          vF += 38 * c.throttle * dt;
        } else if (c.throttle < -0.05) {
          if (vF > 2) vF -= 58 * dt;
          else vF += 24 * c.throttle * dt;
        } else {
          vF *= Math.exp(-1.3 * dt);
        }

        this.boosting = c.boost && this.boost > 0.4;
        if (this.boosting) {
          vF += 64 * dt;
          this.boost = Math.max(0, this.boost - 32 * dt);
        }
        if (this.boostTime > 0) {
          vF += 44 * dt;
          this.boosting = true;
        }
        if (this.starTime > 0) {
          vF += 22 * dt;
        }

        const speedFactor = clamp(Math.abs(vF) / 7, 0.2, 1);
        const reverseSign = vF < -0.4 ? -1 : 1;
        this.yaw += c.steer * 2.45 * speedFactor * reverseSign * (c.drift ? 1.28 : 1) * dt;
        vR *= Math.exp(-(c.drift ? 2.6 : 10.5) * dt);
        vF *= Math.exp(-0.26 * dt);
      } else {
        this.boosting = false;
        this.yaw += this.spinDir * 10 * dt;
        vF *= Math.exp(-2.4 * dt);
        vR *= Math.exp(-4 * dt);
      }
    } else {
      this.boosting = false;
      if (!spinning) {
        vF += c.throttle * 9 * dt;
        vR += c.steer * 7 * dt;
        this.yaw += c.steer * 1.25 * dt;
      } else {
        this.yaw += this.spinDir * 9 * dt;
      }
      vF *= Math.exp(-0.08 * dt);
      vR *= Math.exp(-0.55 * dt);
    }

    if (this.slowTime > 0) {
      vF *= Math.exp(-1.6 * dt);
      vR *= Math.exp(-1.6 * dt);
    }

    const cap = this.maxSpeed;
    if (vF > cap) vF = damp(vF, cap, 4.5, dt);
    if (vF < -20) vF = -20;

    this.vel.x = forward.x * vF + right.x * vR;
    this.vel.z = forward.z * vF + right.z * vR;

    if (!this.grounded) this.vel.y -= ARENA.gravity * dt;

    this.pos.addScaledVector(this.vel, dt);

    if (this.pos.y <= 0) {
      if (!this.grounded && this.vel.y < -7) {
        this.squash = 1;
        this.effects.sparkle(new THREE.Vector3(this.pos.x, 0.2, this.pos.z), 0xbfeaff, 7, 0.6, 0.4);
        if (this.isPlayer) {
          this.effects.addShake(Math.min(0.35, -this.vel.y * 0.015));
          this.audio.land();
        }
      }
      this.pos.y = 0;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
      this.jumps = 0;
    } else {
      this.grounded = false;
    }

    const hitWall = collideArena(this.pos, this.vel, 1.62, 0.32, true);
    if (hitWall && this.speed > 16 && this.wallHitCooldown <= 0) {
      this.wallHitCooldown = 0.4;
      this.vel.multiplyScalar(0.72);
      const point = new THREE.Vector3(this.pos.x, 1, this.pos.z);
      this.effects.burst(point, 0xffd9a0, 12, { speed: 8, size: 0.7, life: 0.45, gravity: 5 });
      if (this.isPlayer) this.effects.addShake(0.22);
    }

    if (this.boost < 100 && !this.boosting) {
      this.boost = Math.min(100, this.boost + 3.1 * dt);
    }

    const jump = c.jump;
    if (jump && !this.prevJump) this.jump();
    this.prevJump = jump;

    this.updateVisual(dt, time, forward, vR);
  }

  updateVisual(dt, time, forward, lateral) {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;

    const targetScale = this.shrinkTime > 0 ? 0.62 : 1;
    this.visualScale = damp(this.visualScale, targetScale, 9, dt);
    const squashX = 1 + this.squash * 0.12;
    const squashY = 1 - this.squash * 0.16;
    this.visual.scale.set(this.visualScale * squashX, this.visualScale * squashY, this.visualScale * squashX);

    const speed = this.speed;
    const steer = this.controls.steer;
    const rollTarget = -steer * clamp(speed / 34, 0, 1) * 0.085;
    const pitchTarget = clamp(-this.vel.y * 0.012, -0.12, 0.12);
    this.visual.rotation.z = damp(this.visual.rotation.z, rollTarget, 7, dt);
    if (this.flipTime > 0) {
      const t = 1 - this.flipTime / 0.52;
      this.visual.rotation.x = t * TAU * this.flipDir;
    } else {
      this.visual.rotation.x = damp(this.visual.rotation.x, pitchTarget, 8, dt);
    }

    this.wheelSpin += speed * dt / 0.52;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    const steerAngle = steer * 0.42;
    for (const g of this.frontWheels) g.rotation.y = damp(g.rotation.y, steerAngle, 12, dt);

    const boosting = this.boosting || this.boostTime > 0 || this.starTime > 0;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      f.visible = boosting;
      if (boosting) {
        const flicker = 0.7 + Math.random() * 0.8;
        f.scale.set(0.8 + Math.random() * 0.35, flicker, 0.8 + Math.random() * 0.35);
        f.material.color.setHex(this.starTime > 0 ? 0xffe14a : 0xffa63e);
      }
    }

    this.trailTimer -= dt;
    if (boosting && this.trailTimer <= 0) {
      this.trailTimer = 0.02;
      const rear = new THREE.Vector3(this.pos.x - forward.x * 2.25, this.pos.y + 0.7, this.pos.z - forward.z * 2.25);
      this.effects.boostTrail(rear, forward, this.teamData.color, this.boostTime > 0 || this.starTime > 0);
    }

    if (this.starTime > 0) {
      const hue = (time * 0.42) % 1;
      this.aura.visible = true;
      this.aura.material.color.setHSL(hue, 1, 0.62);
      this.aura.material.opacity = 0.45 + Math.sin(time * 9) * 0.15;
      for (const mat of this.paintMats) {
        mat.emissive.setHSL(hue, 1, 0.5);
        mat.emissiveIntensity = 0.9 + Math.sin(time * 7) * 0.25;
      }
      this.starSparkTimer -= dt;
      if (this.starSparkTimer <= 0) {
        this.starSparkTimer = 0.08;
        this.effects.sparkle(new THREE.Vector3(this.pos.x + rand(-1.5, 1.5), this.pos.y + rand(0.3, 2), this.pos.z + rand(-2, 2)), new THREE.Color().setHSL(hue, 1, 0.65), 2, 0.7, 0.5);
      }
    } else if (this.aura.visible) {
      this.aura.visible = false;
      for (const mat of this.paintMats) {
        mat.emissive.setHex(this.teamData.color);
        mat.emissiveIntensity = 0.08;
      }
    }

    this.glow.material.opacity = 0.3 + Math.sin(time * 4 + this.index) * 0.1 + (this.boosting ? 0.2 : 0);
    if (this.playerRing) {
      this.playerRing.material.opacity = 0.4 + Math.sin(time * 5) * 0.16;
      this.playerRing.rotation.z = time * 0.8;
    }
    this.nameTag.visible = !this.isPlayer || this.nameTag.material.opacity > 0;
  }
}
