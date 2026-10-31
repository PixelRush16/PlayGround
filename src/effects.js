import * as THREE from 'three';
import { rand, randInt, clamp, TAU, makeCanvas, textureFromCanvas } from './utils.js';

const MAX_PARTICLES = 2200;
const _color = new THREE.Color();
const _dummy = new THREE.Object3D();

function createParticleSystem(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const sizes = new Float32Array(MAX_PARTICLES);
  const alphas = new Float32Array(MAX_PARTICLES);
  const velocity = new Float32Array(MAX_PARTICLES * 3);
  const life = new Float32Array(MAX_PARTICLES);
  const maxLife = new Float32Array(MAX_PARTICLES);
  const gravity = new Float32Array(MAX_PARTICLES);
  const drag = new Float32Array(MAX_PARTICLES);
  const baseSize = new Float32Array(MAX_PARTICLES);
  const baseAlpha = new Float32Array(MAX_PARTICLES);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float a = smoothstep(0.5, 0.06, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, color, size, lifeSeconds, grav = 0, alpha = 1, dragAmount = 0.6) {
    const i = cursor;
    cursor = (cursor + 1) % MAX_PARTICLES;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    velocity[i * 3] = vx;
    velocity[i * 3 + 1] = vy;
    velocity[i * 3 + 2] = vz;
    _color.set(color);
    colors[i * 3] = _color.r;
    colors[i * 3 + 1] = _color.g;
    colors[i * 3 + 2] = _color.b;
    baseSize[i] = size;
    sizes[i] = size;
    baseAlpha[i] = alpha;
    alphas[i] = alpha;
    life[i] = lifeSeconds;
    maxLife[i] = lifeSeconds;
    gravity[i] = grav;
    drag[i] = dragAmount;
    return i;
  }

  function update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (life[i] <= 0) {
        if (alphas[i] !== 0) alphas[i] = 0;
        continue;
      }
      life[i] -= dt;
      if (life[i] <= 0) {
        alphas[i] = 0;
        continue;
      }
      const dragFactor = Math.exp(-drag[i] * dt);
      velocity[i * 3] *= dragFactor;
      velocity[i * 3 + 1] = velocity[i * 3 + 1] * dragFactor - gravity[i] * dt;
      velocity[i * 3 + 2] *= dragFactor;
      positions[i * 3] += velocity[i * 3] * dt;
      positions[i * 3 + 1] += velocity[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocity[i * 3 + 2] * dt;
      const t = life[i] / maxLife[i];
      alphas[i] = baseAlpha[i] * Math.min(1, t * 2.2);
      sizes[i] = baseSize[i] * (0.45 + 0.55 * t);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  return { spawn, update };
}

function createConfetti(scene) {
  const count = 260;
  const geo = new THREE.PlaneGeometry(0.34, 0.18);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const palette = [0x3dd2ff, 0xff406e, 0xd9ff45, 0xffffff, 0xb47cff, 0xff9a2e, 0x5ce1a8];
  const pos = [];
  const vel = [];
  const rot = [];
  const rotVel = [];
  let active = 0;
  let elapsed = 0;

  for (let i = 0; i < count; i++) {
    pos.push(new THREE.Vector3());
    vel.push(new THREE.Vector3());
    rot.push(new THREE.Euler());
    rotVel.push(new THREE.Vector3());
    _color.setHex(palette[i % palette.length]);
    mesh.setColorAt(i, _color);
    _dummy.position.set(0, -50, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  mesh.instanceColor.needsUpdate = true;

  function trigger(x, y, z, primary, secondary) {
    active = count;
    elapsed = 0;
    for (let i = 0; i < count; i++) {
      pos[i].set(x + rand(-7, 7), y + rand(-1, 5), z + rand(-7, 7));
      const angle = rand(0, TAU);
      const speed = rand(4, 19);
      vel[i].set(Math.cos(angle) * speed, rand(5, 20), Math.sin(angle) * speed);
      rot[i].set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      rotVel[i].set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
      _color.setHex(i % 3 === 0 ? primary : i % 3 === 1 ? secondary : palette[i % palette.length]);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceColor.needsUpdate = true;
  }

  function update(dt) {
    if (active <= 0) return;
    elapsed += dt;
    for (let i = 0; i < count; i++) {
      vel[i].y -= 16 * dt;
      vel[i].multiplyScalar(Math.exp(-0.55 * dt));
      pos[i].addScaledVector(vel[i], dt);
      if (pos[i].y < 0.08) {
        pos[i].y = 0.08;
        vel[i].set(vel[i].x * 0.4, Math.abs(vel[i].y) * 0.22, vel[i].z * 0.4);
      }
      rot[i].x += rotVel[i].x * dt;
      rot[i].y += rotVel[i].y * dt;
      rot[i].z += rotVel[i].z * dt;
      const fade = clamp((3.6 - elapsed) / 1.2, 0, 1);
      _dummy.position.copy(pos[i]);
      _dummy.rotation.copy(rot[i]);
      _dummy.scale.setScalar(fade);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (elapsed > 4.2) {
      active = 0;
      for (let i = 0; i < count; i++) {
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { trigger, update };
}

export class Effects {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.particles = createParticleSystem(scene);
    this.confetti = createConfetti(scene);
    this.rings = [];
    this.bolts = [];
    this.shake = 0;
    this.shakeSeed = rand(0, 100);

    const glowCanvas = makeCanvas(64, 64);
    const g = glowCanvas.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.glowTex = textureFromCanvas(glowCanvas, renderer);
  }

  burst(pos, color, count = 18, { speed = 9, size = 0.8, life = 0.7, gravity = 4, spread = 1, alpha = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const theta = rand(0, TAU);
      const phi = Math.acos(rand(-1, 1));
      const s = rand(speed * 0.25, speed);
      this.particles.spawn(
        pos.x + rand(-0.3, 0.3) * spread,
        pos.y + rand(-0.3, 0.3) * spread,
        pos.z + rand(-0.3, 0.3) * spread,
        Math.sin(phi) * Math.cos(theta) * s,
        Math.cos(phi) * s * 0.7 + speed * 0.25,
        Math.sin(phi) * Math.sin(theta) * s,
        color,
        size * rand(0.6, 1.3),
        life * rand(0.65, 1.25),
        gravity,
        alpha,
        1.4
      );
    }
  }

  sparkle(pos, color, count = 4, size = 0.55, life = 0.5) {
    this.burst(pos, color, count, { speed: 4, size, life, gravity: 2, spread: 0.5 });
  }

  hit(pos, color = 0xfff2a8) {
    this.burst(pos, color, 22, { speed: 12, size: 1.1, life: 0.65, gravity: 6 });
    this.burst(pos, 0xffffff, 8, { speed: 16, size: 0.7, life: 0.35, gravity: 1 });
    this.ring(pos, color, 3, 0.35, 9);
  }

  boostTrail(pos, forward, color, big = false) {
    const count = big ? 3 : 1;
    for (let i = 0; i < count; i++) {
      this.particles.spawn(
        pos.x + rand(-0.35, 0.35),
        pos.y + rand(-0.15, 0.25),
        pos.z + rand(-0.35, 0.35),
        -forward.x * rand(3, 7) + rand(-1.2, 1.2),
        rand(0.3, 2.4),
        -forward.z * rand(3, 7) + rand(-1.2, 1.2),
        i === 0 ? 0xfff0a8 : color,
        big ? rand(1.2, 2.1) : rand(0.7, 1.2),
        rand(0.25, 0.55),
        -1.5,
        0.9,
        1.6
      );
    }
  }

  ballTrail(pos, speed) {
    if (Math.random() > 0.75) return;
    const c = speed > 45 ? 0xfff0a0 : 0x9fe8ff;
    this.particles.spawn(
      pos.x + rand(-0.8, 0.8),
      pos.y + rand(-0.8, 0.8),
      pos.z + rand(-0.8, 0.8),
      rand(-0.8, 0.8),
      rand(-0.4, 0.8),
      rand(-0.8, 0.8),
      c,
      rand(0.6, 1.4),
      rand(0.25, 0.6),
      0,
      0.55,
      0.8
    );
  }

  ring(pos, color, radius = 4, life = 0.6, grow = 16, horizontal = true) {
    const geo = new THREE.TorusGeometry(1, 0.075, 8, 60);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    if (horizontal) mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(radius);
    this.scene.add(mesh);
    this.rings.push({ mesh, life, maxLife: life, grow, start: radius });
  }

  flash(pos, color, size = 10) {
    const mat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.setScalar(size);
    this.scene.add(sprite);
    this.rings.push({ mesh: sprite, life: 0.35, maxLife: 0.35, grow: -size * 0.4, start: size, isSprite: true });
  }

  explosion(pos, color = 0xff9a2e) {
    this.burst(pos, color, 42, { speed: 20, size: 1.8, life: 0.9, gravity: 7 });
    this.burst(pos, 0xfff6c8, 24, { speed: 14, size: 1.2, life: 0.55, gravity: 3 });
    this.burst(pos, 0x20242e, 16, { speed: 8, size: 2.2, life: 1.2, gravity: -1, alpha: 0.5 });
    this.ring(pos, color, 4, 0.55, 20);
    this.flash(pos, color, 15);
    this.addShake(0.65);
  }

  goal(pos, color, secondary) {
    this.burst(pos, color, 70, { speed: 24, size: 2.2, life: 1.4, gravity: 9 });
    this.burst(pos, 0xffffff, 36, { speed: 18, size: 1.4, life: 0.8, gravity: 4 });
    this.ring(pos, color, 6, 0.9, 34);
    this.flash(pos, color, 26);
    this.confetti.trigger(pos.x, pos.y + 3, pos.z, color, secondary);
    this.addShake(0.9);
  }

  lightning(pos) {
    const points = [];
    const start = new THREE.Vector3(pos.x + rand(-3, 3), 34, pos.z + rand(-3, 3));
    const end = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = start.clone().lerp(end, t);
      if (i > 0 && i < steps) {
        p.x += rand(-2.6, 2.6);
        p.z += rand(-2.6, 2.6);
        p.y += rand(-1.2, 1.2);
      }
      points.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xd8e6ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bolts.push({ line, life: 0.42, maxLife: 0.42 });
    this.flash(end.clone().add(new THREE.Vector3(0, 2, 0)), 0xbcd4ff, 12);
    this.burst(pos, 0xcfe0ff, 24, { speed: 13, size: 1, life: 0.7, gravity: 1 });
    this.addShake(0.3);
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  getShake(time) {
    if (this.shake <= 0.001) return { x: 0, y: 0, roll: 0 };
    const s = this.shake * this.shake;
    return {
      x: Math.sin(time * 63 + this.shakeSeed) * s * 0.55,
      y: Math.cos(time * 71 + this.shakeSeed) * s * 0.4,
      roll: Math.sin(time * 47) * s * 0.02,
    };
  }

  update(dt, time) {
    this.particles.update(dt);
    this.confetti.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.6);

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = clamp(r.life / r.maxLife, 0, 1);
      if (r.isSprite) {
        r.mesh.scale.setScalar(r.start + (1 - t) * Math.abs(r.grow));
        r.mesh.material.opacity = t * 0.95;
      } else {
        r.mesh.scale.setScalar(r.start + (1 - t) * r.grow);
        r.mesh.material.opacity = t * 0.9;
      }
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry?.dispose();
        r.mesh.material?.dispose();
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.line.material.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        this.scene.remove(b.line);
        b.line.geometry.dispose();
        b.line.material.dispose();
        this.bolts.splice(i, 1);
      }
    }
  }
}
