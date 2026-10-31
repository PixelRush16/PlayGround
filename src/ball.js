import * as THREE from 'three';
import { ARENA } from './constants.js';
import { collideArena, collideSpherePost, collideSphereBar, sphereBoxContact } from './physics.js';
import { clamp, makeCanvas, textureFromCanvas, rand } from './utils.js';

function createBallTexture(renderer) {
  const c = makeCanvas(1024, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#f2f6fa';
  g.fillRect(0, 0, 1024, 512);

  const shade = g.createRadialGradient(512, 256, 80, 512, 256, 560);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(70,100,130,0.28)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 1024, 512);

  function pentagon(cx, cy, r, rotation = 0, color = '#111820') {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rotation + (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  // pentagon panels, wrapped across the equator
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = (col / 5) * 1024 + (row % 2 ? 102 : 0) + 60;
      const cy = 90 + row * 165;
      pentagon(cx, cy, 54, rand(0, 1));
    }
  }
  // extra polar panels
  pentagon(512, 8, 62, 0.2);
  pentagon(512, 504, 62, 0.8);

  // seams
  g.strokeStyle = 'rgba(70,90,110,0.4)';
  g.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.arc(512 + rand(-380, 380), 256 + rand(-160, 160), rand(90, 220), 0, Math.PI * 2);
    g.stroke();
  }

  // brand dots
  g.fillStyle = 'rgba(40,150,200,0.6)';
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    g.arc(rand(0, 1024), rand(0, 512), 5, 0, Math.PI * 2);
    g.fill();
  }

  return textureFromCanvas(c, renderer);
}

export class Ball {
  constructor(scene, renderer, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.radius = ARENA.ballR;
    this.pos = new THREE.Vector3(0, this.radius, 0);
    this.vel = new THREE.Vector3();
    this.prevPos = this.pos.clone();
    this.lastHitBy = null;
    this.hitCooldown = 0;

    const tex = createBallTexture(renderer);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.42,
      metalness: 0.12,
      emissive: 0x1a2836,
      emissiveIntensity: 0.55,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 40, 28), mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    const glowTex = effects.glowTex;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.glow.scale.set(7.5, 7.5, 1);
    scene.add(this.glow);

    this.spinAxis = new THREE.Vector3(1, 0, 0);
    this.reset();
  }

  reset() {
    this.pos.set(0, this.radius, 0);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.lastHitBy = null;
    this.hitCooldown = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.identity();
    this.glow.position.copy(this.pos);
  }

  get speed() {
    return this.vel.length();
  }

  predict(seconds, out = new THREE.Vector3()) {
    out.copy(this.pos).addScaledVector(this.vel, seconds);
    out.y = Math.max(this.radius, out.y - 0.5 * ARENA.gravity * seconds * seconds * 0.35);
    return out;
  }

  update(dt, cars) {
    this.prevPos.copy(this.pos);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    const grounded = this.pos.y <= this.radius + 0.05;
    this.vel.y -= ARENA.gravity * dt;
    if (grounded) {
      const friction = Math.exp(-0.55 * dt);
      this.vel.x *= friction;
      this.vel.z *= friction;
    } else {
      this.vel.multiplyScalar(Math.exp(-0.045 * dt));
    }

    this.pos.addScaledVector(this.vel, dt);

    // floor
    if (this.pos.y < this.radius) {
      this.pos.y = this.radius;
      if (this.vel.y < -1.5) {
        this.vel.y = -this.vel.y * 0.72;
        if (this.vel.y < 3.5) this.vel.y = 0;
        if (Math.abs(this.vel.y) > 3) this.effects.sparkle(this.pos, 0xcfe8ff, 3, 0.6, 0.35);
      } else {
        this.vel.y = 0;
      }
    }

    collideArena(this.pos, this.vel, this.radius, 0.72, true);

    // goal posts and crossbars
    for (const sz of [-1, 1]) {
      const z = sz * ARENA.halfL;
      for (const sx of [-1, 1]) {
        collideSpherePost(this.pos, this.vel, this.radius, sx * ARENA.goalHalfW, z, 0.34, ARENA.goalH, 0.74);
      }
      collideSphereBar(this.pos, this.vel, this.radius, ARENA.goalH, z, 0.34, 0.74);
    }

    // cars
    for (const car of cars) {
      const contact = sphereBoxContact(this.pos, car.pos, car.yaw, ARENA.carHalf, this.radius + 0.1);
      if (!contact) continue;

      this.pos.x += contact.nx * (contact.penetration + 0.02);
      this.pos.y += contact.ny * (contact.penetration + 0.02);
      this.pos.z += contact.nz * (contact.penetration + 0.02);

      const carSpeed = car.vel.length();
      const relX = this.vel.x - car.vel.x;
      const relY = this.vel.y - car.vel.y;
      const relZ = this.vel.z - car.vel.z;
      const vn = relX * contact.nx + relY * contact.ny + relZ * contact.nz;
      if (vn < 0) {
        const restitution = car.starTime > 0 ? 1.75 : 1.35;
        this.vel.x -= contact.nx * vn * restitution;
        this.vel.y -= contact.ny * vn * restitution;
        this.vel.z -= contact.nz * vn * restitution;
      }

      const punch = 2.4 + carSpeed * 0.3 + (car.boostTime > 0 ? 6 : 0) + (car.starTime > 0 ? 9 : 0);
      this.vel.x += contact.nx * punch + car.vel.x * 0.14;
      this.vel.z += contact.nz * punch + car.vel.z * 0.14;
      this.vel.y += Math.max(0.6, contact.ny * punch * 0.6) + carSpeed * 0.055;

      const speedCap = 96;
      if (this.vel.length() > speedCap) this.vel.setLength(speedCap);

      this.lastHitBy = car;
      this.hitCooldown = 0.18;
      car.hitCooldown = 0.18;
      car.vel.multiplyScalar(0.965);

      const impact = clamp(carSpeed / 38, 0.25, 1.6);
      const contactPoint = this.pos.clone().addScaledVector(new THREE.Vector3(contact.nx, contact.ny, contact.nz), -this.radius);
      this.effects.hit(contactPoint, car.team === 'blue' ? 0xa8ecff : 0xffc0cf);
      this.effects.addShake(0.16 * impact);
      this.audio.hit(impact);
    }

    // keep the ball out of the goal mouth net interior bounds
    this.mesh.position.copy(this.pos);
    this.glow.position.copy(this.pos);
    const glowScale = 7.5 + Math.min(4, this.speed * 0.12);
    this.glow.scale.set(glowScale, glowScale, 1);
    this.glow.material.opacity = 0.16 + Math.min(0.4, this.speed / 160);
    this.glow.material.color.setHex(this.speed > 55 ? 0xffe08a : 0x9fe8ff);

    const speed = this.speed;
    if (speed > 0.4) {
      this.spinAxis.set(this.vel.z, 0, -this.vel.x).normalize();
      const angle = (speed * dt) / this.radius;
      this.mesh.rotateOnWorldAxis(this.spinAxis, angle);
    }
    if (speed > 12) this.effects.ballTrail(this.pos, speed);
  }
}
