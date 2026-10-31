import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ARENA, ITEMS, ITEM_TABLE, TEAM } from './constants.js';
import { collideArena } from './physics.js';
import { clamp, rand, chance, weightedChoice, makeCanvas, textureFromCanvas, TAU } from './utils.js';

const _v = new THREE.Vector3();

function createQuestionTexture(renderer) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#8ef4ff');
  grad.addColorStop(0.4, '#6ea8ff');
  grad.addColorStop(0.7, '#c78bff');
  grad.addColorStop(1, '#ff8ad0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 240, 240);
  g.fillStyle = '#ffffff';
  g.font = '400 190px Bungee, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#3d7dff';
  g.shadowBlur = 26;
  g.fillText('?', 128, 140);
  return textureFromCanvas(c, renderer);
}

function createShellMesh(color, effects) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.45,
    metalness: 0.35,
    roughness: 0.32,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.68, 22, 14, 0, TAU, 0, Math.PI * 0.62), mat);
  dome.rotation.x = Math.PI;
  dome.position.y = 0.22;
  group.add(dome);
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.66, 20, 10, 0, TAU, Math.PI * 0.52, Math.PI * 0.48),
    new THREE.MeshStandardMaterial({ color: 0xfff3d6, roughness: 0.5, metalness: 0.1 })
  );
  belly.position.y = 0.2;
  group.add(belly);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.09, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  group.add(rim);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: effects.glowTex,
    color,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.scale.set(2.8, 2.8, 1);
  group.add(glow);
  return group;
}

function createBombMesh(effects) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0x151822, metalness: 0.55, roughness: 0.35 })
  );
  group.add(body);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b2f3d, metalness: 0.7, roughness: 0.3 })
  );
  cap.position.y = 0.72;
  group.add(cap);
  const fuse = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.045, 6, 14, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({ color: 0xd7b98b })
  );
  fuse.position.set(0.1, 0.92, 0);
  group.add(fuse);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({
    map: effects.glowTex,
    color: 0xffd36e,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  spark.position.set(0.26, 1.02, 0);
  spark.scale.set(1.1, 1.1, 1);
  group.add(spark);
  group.userData.spark = spark;
  return group;
}

function createBananaMesh(effects) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffe14a,
    emissive: 0xd6a600,
    emissiveIntensity: 0.5,
    metalness: 0.1,
    roughness: 0.45,
  });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.22, 10, 22, Math.PI * 1.05), mat);
  arc.rotation.x = Math.PI / 2;
  arc.rotation.z = Math.PI * 0.5;
  arc.position.y = 0.42;
  group.add(arc);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x8a6b28, roughness: 0.7 }));
  stem.position.set(0.7, 0.52, 0);
  stem.rotation.z = 0.6;
  group.add(stem);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: effects.glowTex,
    color: 0xffe14a,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.position.y = 0.5;
  glow.scale.set(3.2, 3.2, 1);
  group.add(glow);
  return group;
}

export class ItemSystem {
  constructor(scene, renderer, effects, audio, ball) {
    this.scene = scene;
    this.renderer = renderer;
    this.effects = effects;
    this.audio = audio;
    this.ball = ball;
    this.enabled = false;
    this.boxes = [];
    this.projectiles = [];
    this.bananas = [];
    this.callbacks = {};
    this.questionTex = createQuestionTexture(renderer);

    const spawns = [
      [-16, 0], [16, 0],
      [0, -26], [0, 26],
      [-16, -38], [16, 38], [-16, 38], [16, -38],
    ];
    for (const [x, z] of spawns) {
      const group = new THREE.Group();
      group.position.set(x, 2.5, z);

      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x9fe8ff,
        emissive: 0x2f8bff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.26,
        metalness: 0.4,
        roughness: 0.15,
        depthWrite: false,
      });
      const cube = new THREE.Mesh(new RoundedBoxGeometry(2.25, 2.25, 2.25, 3, 0.28), boxMat);
      group.add(cube);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new RoundedBoxGeometry(2.3, 2.3, 2.3, 2, 0.26)),
        new THREE.LineBasicMaterial({ color: 0xbdf3ff, transparent: true, opacity: 0.9 })
      );
      group.add(edges);

      const question = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.questionTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }));
      question.scale.set(1.4, 1.4, 1);
      group.add(question);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: effects.glowTex,
        color: 0x6fb8ff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      glow.scale.set(5.2, 5.2, 1);
      group.add(glow);

      scene.add(group);
      this.boxes.push({
        group,
        cube,
        question,
        glow,
        base: new THREE.Vector3(x, 2.5, z),
        active: true,
        timer: 0,
        phase: rand(0, TAU),
      });
    }
  }

  on(name, fn) {
    this.callbacks[name] = fn;
  }

  reset() {
    for (const box of this.boxes) {
      box.active = true;
      box.timer = 0;
      box.group.visible = true;
    }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const b of this.bananas) this.scene.remove(b.mesh);
    this.projectiles.length = 0;
    this.bananas.length = 0;
  }

  update(dt, time, cars) {
    for (const box of this.boxes) {
      if (!box.active) {
        box.timer -= dt;
        if (box.timer <= 0) {
          box.active = true;
          box.group.visible = true;
          this.effects.burst(box.base, 0x8fe8ff, 10, { speed: 5, size: 0.8, life: 0.5, gravity: 0 });
        }
        continue;
      }
      box.group.position.y = box.base.y + Math.sin(time * 2 + box.phase) * 0.35;
      box.group.rotation.y = time * 0.8 + box.phase;
      box.group.rotation.x = Math.sin(time * 0.7 + box.phase) * 0.18;
      box.question.material.rotation = Math.sin(time * 2) * 0.1;
      box.cube.material.emissiveIntensity = 0.55 + Math.sin(time * 3 + box.phase) * 0.3;
      box.glow.material.opacity = 0.3 + Math.sin(time * 2.5 + box.phase) * 0.15;

      if (!this.enabled) continue;
      for (const car of cars) {
        if (car.item) continue;
        const dx = car.pos.x - box.base.x;
        const dz = car.pos.z - box.base.z;
        if (dx * dx + dz * dz < 3.6 * 3.6 && car.pos.y < 4) {
          this.giveItem(car, weightedChoice(ITEM_TABLE));
          box.active = false;
          box.timer = 8;
          box.group.visible = false;
          this.effects.burst(box.base, 0x8fe8ff, 22, { speed: 8, size: 1, life: 0.6, gravity: 1 });
          this.audio.pickup();
          break;
        }
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.age += dt;

      if (p.type === 'red' && p.target && p.target.root.visible) {
        _v.copy(p.target.pos).add(new THREE.Vector3(0, 1, 0));
        _v.sub(p.pos);
        const desired = Math.atan2(_v.x, _v.z);
        const current = Math.atan2(p.vel.x, p.vel.z);
        let diff = desired - current;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const turn = clamp(diff, -3.4 * dt, 3.4 * dt);
        const speed = Math.hypot(p.vel.x, p.vel.z);
        const angle = current + turn;
        p.vel.x = Math.sin(angle) * speed;
        p.vel.z = Math.cos(angle) * speed;
      }

      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);

      if (p.type === 'bomb') {
        if (p.pos.y < 0.7) {
          p.pos.y = 0.7;
          p.vel.y = Math.abs(p.vel.y) * 0.35;
          p.vel.x *= 0.7;
          p.vel.z *= 0.7;
        }
        p.mesh.userData.spark.scale.setScalar(0.8 + Math.sin(p.age * 30) * 0.25);
        if (p.age > p.fuse) {
          this.explode(p.pos, p.owner, cars);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
        // bomb proximity detonation
        let detonated = false;
        for (const car of cars) {
          if (car === p.owner) continue;
          const dx = car.pos.x - p.pos.x;
          const dz = car.pos.z - p.pos.z;
          if (dx * dx + dz * dz < 2.4 * 2.4) { detonated = true; break; }
        }
        if (detonated) {
          this.explode(p.pos, p.owner, cars);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        const bounced = collideArena(p.pos, p.vel, 0.62, 0.92, true);
        if (bounced) {
          p.bounces++;
          this.effects.sparkle(p.pos, p.type === 'red' ? 0xff8fa8 : 0x8fffba, 4, 0.6, 0.35);
          this.audio.wallHit();
        }
        if (p.pos.y < 0.62) {
          p.pos.y = 0.62;
          p.vel.y = Math.abs(p.vel.y) * 0.6 + 1;
        }
      }

      // ball interaction
      if (this.ball) {
        const dx = this.ball.pos.x - p.pos.x;
        const dy = this.ball.pos.y - p.pos.y;
        const dz = this.ball.pos.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < (ARENA.ballR + 0.7) ** 2 && p.ballCooldown <= 0) {
          p.ballCooldown = 0.25;
          this.ball.vel.addScaledVector(p.vel, 0.22);
          this.ball.vel.y += 2.5;
          this.effects.hit(p.pos, p.type === 'red' ? 0xff6a8c : 0x6aff9a);
        }
      }
      p.ballCooldown = Math.max(0, (p.ballCooldown || 0) - dt);

      // car hits
      let removed = false;
      for (const car of cars) {
        if (car === p.owner || car.team === p.owner.team) continue;
        const dx = car.pos.x - p.pos.x;
        const dy = car.pos.y + 1 - p.pos.y;
        const dz = car.pos.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < 2.6 * 2.6) {
          const dir = new THREE.Vector3(p.vel.x, 0, p.vel.z).normalize();
          car.takeHit(dir, p.type === 'red' ? 1.25 : 1);
          this.effects.hit(p.pos, p.type === 'red' ? 0xff406e : 0x35ff88);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (removed) continue;

      if (p.life <= 0) {
        this.effects.sparkle(p.pos, p.type === 'red' ? 0xff6a8c : 0x6aff9a, 8, 0.8, 0.5);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y += dt * 12;
      if (Math.random() < 0.6) {
        this.effects.sparkle(p.pos, p.type === 'red' ? 0xff8fa8 : 0x8fffba, 1, 0.65, 0.3);
      }
    }

    // bananas
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const b = this.bananas[i];
      b.life -= dt;
      b.armTime -= dt;
      b.mesh.rotation.y += dt * 1.5;
      b.mesh.position.y = 0.05 + Math.sin(time * 2 + i) * 0.04;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bananas.splice(i, 1);
        continue;
      }
      if (!this.enabled) continue;
      for (const car of cars) {
        if (car === b.owner || car.team === b.owner.team) continue;
        const dx = car.pos.x - b.pos.x;
        const dz = car.pos.z - b.pos.z;
        if (dx * dx + dz * dz < 2.4 * 2.4 && car.pos.y < 2.2) {
          const dir = new THREE.Vector3(dx, 0, dz).normalize();
          car.takeHit(dir, 0.8);
          this.effects.burst(new THREE.Vector3(b.pos.x, 0.8, b.pos.z), 0xffe14a, 18, { speed: 9, size: 0.9, life: 0.6, gravity: 5 });
          this.audio.itemUse('banana');
          this.scene.remove(b.mesh);
          this.bananas.splice(i, 1);
          break;
        }
      }
    }
  }

  giveItem(car, type) {
    car.item = type;
    car.itemAge = 0;
    this.callbacks.pickup?.(car, type);
  }

  useItem(car, cars) {
    if (!car.item) return false;
    const type = car.item;
    car.item = null;
    const forward = car.forward;
    this.callbacks.use?.(car, type);
    this.audio.itemUse(type);

    if (type === 'mushroom') {
      car.boostTime = Math.max(car.boostTime, 2.8);
      car.boost = Math.min(100, car.boost + 45);
      const rear = new THREE.Vector3(car.pos.x - forward.x * 2, car.pos.y + 0.8, car.pos.z - forward.z * 2);
      this.effects.burst(rear, 0xffb23e, 22, { speed: 11, size: 1.2, life: 0.6, gravity: 0 });
      this.effects.ring(new THREE.Vector3(car.pos.x, car.pos.y + 1, car.pos.z), 0xffb23e, 2, 0.3, 7);
    } else if (type === 'star') {
      car.applyStar();
    } else if (type === 'lightning') {
      for (const other of cars) {
        if (other.team !== car.team) other.applyLightning();
      }
      this.callbacks.lightning?.(car);
    } else if (type === 'banana') {
      const pos = new THREE.Vector3(car.pos.x - forward.x * 3.4, 0.05, car.pos.z - forward.z * 3.4);
      const mesh = createBananaMesh(this.effects);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.bananas.push({ mesh, pos, owner: car, life: 22, armTime: 0.5 });
    } else if (type === 'bomb') {
      const mesh = createBombMesh(this.effects);
      const pos = new THREE.Vector3(car.pos.x + forward.x * 2.8, 1.1, car.pos.z + forward.z * 2.8);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.projectiles.push({
        type: 'bomb',
        mesh,
        pos,
        vel: new THREE.Vector3(forward.x * 28, 10, forward.z * 28),
        life: 4,
        age: 0,
        fuse: 1.5,
        gravity: 22,
        owner: car,
        radius: 0.7,
        bounces: 0,
        ballCooldown: 0,
      });
    } else if (type === 'green' || type === 'red') {
      const color = type === 'green' ? 0x35d96b : 0xff406e;
      const mesh = createShellMesh(color, this.effects);
      const pos = new THREE.Vector3(car.pos.x + forward.x * 2.8, 1, car.pos.z + forward.z * 2.8);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      let target = null;
      if (type === 'red') {
        let best = Infinity;
        for (const other of cars) {
          if (other.team === car.team) continue;
          const dist = other.pos.distanceToSquared(car.pos);
          if (dist < best) { best = dist; target = other; }
        }
      }
      const speed = type === 'green' ? 52 : 44;
      this.projectiles.push({
        type,
        mesh,
        pos,
        vel: new THREE.Vector3(forward.x * speed, 0, forward.z * speed),
        life: type === 'green' ? 6 : 8,
        age: 0,
        gravity: 0,
        owner: car,
        target,
        radius: 0.7,
        bounces: 0,
        ballCooldown: 0,
      });
      this.effects.burst(pos, color, 12, { speed: 6, size: 0.8, life: 0.4, gravity: 0 });
    }
    return true;
  }

  explode(pos, owner, cars) {
    this.effects.explosion(pos, 0xff8a2e);
    this.audio.explosion();
    for (const car of cars) {
      if (car === owner) continue;
      const dx = car.pos.x - pos.x;
      const dy = car.pos.y + 1 - pos.y;
      const dz = car.pos.z - pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 10.5) {
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        const power = 1 + (1 - dist / 10.5) * 1.2;
        car.takeHit(dir, power);
      }
    }
    if (this.ball) {
      const dx = this.ball.pos.x - pos.x;
      const dy = this.ball.pos.y - pos.y;
      const dz = this.ball.pos.z - pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 13) {
        const dir = new THREE.Vector3(dx, Math.max(0.4, dy), dz).normalize();
        this.ball.vel.addScaledVector(dir, (1 - dist / 13) * 46 + 12);
      }
    }
    this.callbacks.explosion?.(pos, owner);
  }
}
