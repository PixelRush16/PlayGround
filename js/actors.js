import * as THREE from '../vendor/three.module.min.js';

export const TRAIN_DEPTH = 18;
export const TRAIN_WIDTH = 2.16;
export const TRAIN_HEIGHT = 3.05;

function box(width, height, depth, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.05,
    ...options,
  });
}

// --------------------------------------------------------------- runner

export function createPlayer() {
  const group = new THREE.Group();
  group.name = 'runner';

  const rig = new THREE.Group();
  group.add(rig);

  const skin = standard(0xe8a87d, { roughness: 0.72 });
  const hoodie = standard(0x19c9b2, { roughness: 0.68 });
  const hoodieDark = standard(0x0e9a8b, { roughness: 0.7 });
  const pants = standard(0x273050, { roughness: 0.85 });
  const shoe = standard(0xfff0d6, { roughness: 0.58 });
  const shoeAccent = standard(0xff5d5c, { roughness: 0.5 });
  const cap = standard(0xff4f67, { roughness: 0.62 });
  const capDark = standard(0xcf2e47, { roughness: 0.62 });
  const pack = standard(0xff9a3c, { roughness: 0.58 });
  const packPocket = standard(0xffc04d, { roughness: 0.62 });
  const strap = standard(0x1a2138, { roughness: 0.8 });
  const dark = standard(0x1c1a2a, { roughness: 0.76 });
  const metal = standard(0xcfd7e5, { roughness: 0.34, metalness: 0.7 });
  const glowTeal = standard(0x31e7c9, { emissive: 0x31e7c9, emissiveIntensity: 1.4, roughness: 0.4 });

  // Legs -----------------------------------------------------------------
  const legL = new THREE.Group();
  legL.position.set(-0.17, 0.98, 0);
  rig.add(legL);
  legL.add(box(0.235, 0.48, 0.27, pants, 0, -0.25, 0));

  const kneeL = new THREE.Group();
  kneeL.position.set(0, -0.48, 0);
  legL.add(kneeL);
  kneeL.add(box(0.2, 0.42, 0.23, pants, 0, -0.2, 0));
  kneeL.add(box(0.265, 0.15, 0.43, shoe, 0, -0.44, 0.08));
  kneeL.add(box(0.27, 0.06, 0.45, shoeAccent, 0, -0.51, 0.08));
  kneeL.add(box(0.24, 0.08, 0.16, shoeAccent, 0, -0.4, -0.11));

  const legR = new THREE.Group();
  legR.position.set(0.17, 0.98, 0);
  rig.add(legR);
  legR.add(box(0.235, 0.48, 0.27, pants, 0, -0.25, 0));

  const kneeR = new THREE.Group();
  kneeR.position.set(0, -0.48, 0);
  legR.add(kneeR);
  kneeR.add(box(0.2, 0.42, 0.23, pants, 0, -0.2, 0));
  kneeR.add(box(0.265, 0.15, 0.43, shoe, 0, -0.44, 0.08));
  kneeR.add(box(0.27, 0.06, 0.45, shoeAccent, 0, -0.51, 0.08));
  kneeR.add(box(0.24, 0.08, 0.16, shoeAccent, 0, -0.4, -0.11));

  rig.add(box(0.56, 0.2, 0.38, pants, 0, 1.0, 0));

  // Upper body group so the runner can lean as one piece.
  const upper = new THREE.Group();
  upper.position.set(0, 1.0, 0);
  rig.add(upper);

  const torso = box(0.66, 0.74, 0.42, hoodie, 0, 0.36, 0);
  upper.add(torso);
  upper.add(box(0.46, 0.2, 0.06, hoodieDark, 0, 0.22, 0.225));
  upper.add(box(0.64, 0.08, 0.44, hoodieDark, 0, 0.02, 0));
  upper.add(box(0.42, 0.14, 0.2, hoodieDark, 0, 0.71, -0.12));
  upper.add(box(0.5, 0.035, 0.02, glowTeal, 0, 0.5, 0.225));

  // Head + headphones.
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0);
  upper.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 16), skin);
  skull.position.set(0, 0.17, 0.005);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.237, 18, 12), standard(0x2a1b2c, { roughness: 0.9 }));
  hair.position.set(0, 0.12, 0.065);
  hair.scale.set(0.98, 0.58, 0.58);
  hair.castShadow = true;
  head.add(hair);
  head.add(box(0.16, 0.12, 0.16, skin, 0, 0.01, 0));
  const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap);
  capDome.position.set(0, 0.21, 0);
  capDome.scale.y = 0.82;
  capDome.castShadow = true;
  head.add(capDome);
  const brim = box(0.44, 0.055, 0.26, capDark, 0, 0.235, 0.21);
  brim.rotation.x = -0.08;
  head.add(brim);
  head.add(box(0.1, 0.08, 0.03, capDark, 0, 0.3, 0.36));

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.026, 6, 24, Math.PI), dark);
  band.position.set(0, 0.16, 0);
  band.castShadow = true;
  head.add(band);
  for (const side of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.075, 14), dark);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 0.242, 0.13, 0);
    cup.castShadow = true;
    head.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 18), glowTeal);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.282, 0.13, 0);
    head.add(ring);
  }

  // Arms.
  const armL = new THREE.Group();
  armL.position.set(-0.43, 0.62, 0);
  armL.rotation.z = 0.15;
  upper.add(armL);
  armL.add(box(0.17, 0.38, 0.2, hoodie, 0, -0.19, 0));
  const forearmL = new THREE.Group();
  forearmL.position.set(0, -0.38, 0);
  armL.add(forearmL);
  forearmL.add(box(0.15, 0.34, 0.17, hoodie, 0, -0.16, 0));
  forearmL.add(box(0.16, 0.05, 0.18, glowTeal, 0, -0.31, 0));
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skin);
  handL.position.set(0, -0.36, 0);
  handL.castShadow = true;
  forearmL.add(handL);

  const armR = new THREE.Group();
  armR.position.set(0.43, 0.62, 0);
  armR.rotation.z = -0.15;
  upper.add(armR);
  armR.add(box(0.17, 0.38, 0.2, hoodie, 0, -0.19, 0));
  const forearmR = new THREE.Group();
  forearmR.position.set(0, -0.38, 0);
  armR.add(forearmR);
  forearmR.add(box(0.15, 0.34, 0.17, hoodie, 0, -0.16, 0));
  forearmR.add(box(0.16, 0.05, 0.18, glowTeal, 0, -0.31, 0));
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skin);
  handR.position.set(0, -0.36, 0);
  handR.castShadow = true;
  forearmR.add(handR);

  // Backpack sits toward the camera, so make it the hero prop.
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.37, 0.33);
  upper.add(backpack);
  backpack.add(box(0.47, 0.58, 0.25, pack, 0, 0, 0));
  backpack.add(box(0.36, 0.28, 0.1, packPocket, 0, -0.1, 0.16));
  backpack.add(box(0.28, 0.05, 0.05, packPocket, 0, -0.1, 0.22));
  backpack.add(box(0.07, 0.55, 0.04, strap, -0.17, 0.02, 0.14));
  backpack.add(box(0.07, 0.55, 0.04, strap, 0.17, 0.02, 0.14));
  backpack.add(box(0.12, 0.12, 0.04, metal, 0, 0.18, 0.15));
  backpack.add(box(0.1, 0.03, 0.02, glowTeal, 0, 0.18, 0.18));

  for (const side of [-1, 1]) {
    upper.add(box(0.07, 0.32, 0.05, strap, side * 0.24, 0.43, 0.23));
  }

  // Fake contact shadow under the feet.
  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 24),
    new THREE.MeshBasicMaterial({ color: 0x05040c, transparent: true, opacity: 0.34, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.012;
  contact.scale.set(1, 1.5, 1);
  group.add(contact);

  return {
    group,
    rig,
    upper,
    head,
    torso,
    backpack,
    contact,
    legL,
    legR,
    kneeL,
    kneeR,
    armL,
    armR,
    forearmL,
    forearmR,
  };
}

// --------------------------------------------------------------- hazards

export function createTrain(textures, glowTexture) {
  const group = new THREE.Group();
  group.name = 'train';

  const sideMaterial = new THREE.MeshStandardMaterial({
    map: textures.side,
    emissiveMap: textures.sideEmissive,
    emissive: 0xffffff,
    emissiveIntensity: 0.8,
    roughness: 0.42,
    metalness: 0.24,
  });
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: textures.front,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
    roughness: 0.4,
    metalness: 0.22,
  });
  const roofMaterial = standard(0x232637, { roughness: 0.6, metalness: 0.35 });
  const underside = standard(0x0c0d17, { roughness: 0.9 });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(TRAIN_WIDTH, 2.5, TRAIN_DEPTH),
    [sideMaterial, sideMaterial, roofMaterial, underside, frontMaterial, underside]
  );
  body.position.y = 1.62;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  group.add(box(2.0, 0.19, 17.2, roofMaterial, 0, 2.95, 0));
  group.add(box(1.0, 0.16, 2.2, roofMaterial, 0, 3.09, -3.4));
  group.add(box(0.8, 0.18, 1.6, roofMaterial, 0, 3.1, 3.6));
  group.add(box(1.86, 0.32, 17.6, underside, 0, 0.42, 0));

  const wheelMat = standard(0x0a0b12, { roughness: 0.85 });
  for (const z of [-6.6, 0, 6.6]) {
    for (const x of [-0.92, 0.92]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.36, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffcf78,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.9,
  });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c2, toneMapped: false });
  for (const x of [-0.64, 0.64]) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), lightMat);
    lamp.position.set(x, 1.13, TRAIN_DEPTH / 2 + 0.02);
    group.add(lamp);
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(x, 1.13, TRAIN_DEPTH / 2 + 0.12);
    glow.scale.set(1.15, 1.15, 1);
    group.add(glow);
  }

  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff394f, toneMapped: false });
  for (const x of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), tailMat);
    tail.position.set(x, 1.3, -TRAIN_DEPTH / 2 - 0.02);
    tail.rotation.y = Math.PI;
    group.add(tail);
  }

  return group;
}

export function createBarrier(maps, glowTexture) {
  const group = new THREE.Group();
  group.name = 'barrier';

  const metal = standard(0x3b3a4c, { roughness: 0.55, metalness: 0.55 });
  const boardMat = new THREE.MeshStandardMaterial({
    map: maps.map,
    emissiveMap: maps.emissive,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.55,
  });

  for (const x of [-0.76, 0.76]) {
    group.add(box(0.12, 0.62, 0.12, metal, x, 0.31, 0));
    group.add(box(0.32, 0.08, 0.46, metal, x, 0.04, 0));
    group.add(box(0.2, 0.08, 0.28, metal, x, 0.14, 0));
  }

  const board = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.72, 0.15), [
    metal,
    metal,
    metal,
    metal,
    boardMat,
    boardMat,
  ]);
  board.position.y = 0.78;
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff5d5c, toneMapped: false });
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff5d5c,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.8,
  });
  for (const x of [-0.86, 0.86]) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), beaconMat);
    beacon.position.set(x, 1.2, 0);
    group.add(beacon);
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(x, 1.2, 0.05);
    glow.scale.set(0.52, 0.52, 1);
    group.add(glow);
  }

  return group;
}

export function createGate(maps, glowTexture) {
  const group = new THREE.Group();
  group.name = 'gate';

  const metal = standard(0x343246, { roughness: 0.5, metalness: 0.6 });
  const panelMat = new THREE.MeshStandardMaterial({
    map: maps.map,
    emissiveMap: maps.emissive,
    emissive: 0xffffff,
    emissiveIntensity: 0.62,
    roughness: 0.5,
  });

  for (const side of [-1, 1]) {
    group.add(box(0.13, 2.4, 0.16, metal, side * 1.04, 1.2, 0));
    group.add(box(0.46, 0.1, 0.5, metal, side * 1.04, 0.05, 0));
    group.add(box(0.2, 0.1, 0.24, metal, side * 1.04, 0.2, 0));
  }
  group.add(box(2.32, 0.14, 0.18, metal, 0, 2.44, 0));
  group.add(box(2.32, 0.08, 0.12, metal, 0, 2.52, 0));

  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.92, 0.07), [
    metal,
    metal,
    metal,
    metal,
    panelMat,
    panelMat,
  ]);
  panel.position.set(0, 1.98, 0);
  panel.castShadow = true;
  group.add(panel);

  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffc65c,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.9,
  });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc65c, toneMapped: false });
  for (const side of [-1, 1]) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), beaconMat);
    beacon.position.set(side * 1.04, 2.56, 0);
    group.add(beacon);
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(side * 1.04, 2.56, 0.06);
    glow.scale.set(0.58, 0.58, 1);
    group.add(glow);
  }

  return group;
}

// --------------------------------------------------------------- pickups

export function createCoin(glowTexture) {
  const group = new THREE.Group();
  group.name = 'coin';

  const gold = new THREE.MeshStandardMaterial({
    color: 0xffc23d,
    emissive: 0xff9f1a,
    emissiveIntensity: 0.46,
    metalness: 0.88,
    roughness: 0.24,
  });
  const darkGold = new THREE.MeshStandardMaterial({
    color: 0xd98213,
    emissive: 0xa85a00,
    emissiveIntensity: 0.2,
    metalness: 0.8,
    roughness: 0.36,
  });

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), gold);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  group.add(disc);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.035, 8, 24), darkGold);
  group.add(rim);

  const star = new THREE.Mesh(new THREE.CircleGeometry(0.13, 5), darkGold);
  star.position.z = 0.036;
  group.add(star);
  const starBack = star.clone();
  starBack.rotation.y = Math.PI;
  starBack.position.z = -0.036;
  group.add(starBack);

  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffbd3d,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.55,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(0.95, 0.95, 1);
  group.add(glow);

  return group;
}

// --------------------------------------------------------------- particles

export class Particles {
  constructor(scene, glowTexture, count = 320) {
    this.count = count;
    this.cursor = 0;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.baseColors = new Float32Array(count * 3);
    this.gravity = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      this.positions[i * 3 + 1] = -999;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.24,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      opacity: 0.95,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(origin, { count = 12, color = 0xffc23d, speed = 4, spread = 1, gravity = 9, life = 0.7 } = {}) {
    const tint = new THREE.Color(color);
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const magnitude = speed * (0.35 + Math.random() * 0.85);
      this.positions[i * 3] = origin.x + (Math.random() - 0.5) * spread;
      this.positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread;
      this.positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
      this.velocities[i * 3] = Math.cos(theta) * Math.sin(phi) * magnitude;
      this.velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * magnitude * 0.9 + 0.8;
      this.velocities[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * magnitude;
      this.baseColors[i * 3] = tint.r;
      this.baseColors[i * 3 + 1] = tint.g;
      this.baseColors[i * 3 + 2] = tint.b;
      this.colors[i * 3] = tint.r;
      this.colors[i * 3 + 1] = tint.g;
      this.colors[i * 3 + 2] = tint.b;
      this.life[i] = life;
      this.maxLife[i] = life;
      this.gravity[i] = gravity;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.count; i += 1) {
      if (this.life[i] <= 0) continue;
      dirty = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        continue;
      }
      this.velocities[i * 3 + 1] -= this.gravity[i] * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      const fade = Math.max(0, this.life[i] / this.maxLife[i]);
      this.colors[i * 3] = this.baseColors[i * 3] * fade;
      this.colors[i * 3 + 1] = this.baseColors[i * 3 + 1] * fade;
      this.colors[i * 3 + 2] = this.baseColors[i * 3 + 2] * fade;
    }
    if (dirty) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
