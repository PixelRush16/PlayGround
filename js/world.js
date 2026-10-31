import * as THREE from '../vendor/three.module.min.js';
import { LANE_X } from './logic.js';
import {
  makeBannerTexture,
  makeBuildingTexture,
  makeGlowTexture,
  makeGraffitiTexture,
  makeSignTexture,
} from './assets.js';

const SEGMENT_LENGTH = 30;
const SEGMENT_COUNT = 10;
const BUILDING_SPACING = 22;
const BUILDING_COUNT = 17;
const SIGN_SPACING = 46;
const SIGN_COUNT = 8;
const GANTRY_SPACING = 62;
const GANTRY_COUNT = 5;

const SIGN_COPY = [
  ['Neon', 'Line 03 · after dark', '#31e7c9'],
  ['Metro', 'Ride the night', '#ffcc4d'],
  ['Run', 'No brakes · no regrets', '#ff5d63'],
  ['Downtown', 'Two stops to glory', '#8a6bff'],
  ['Subway', 'Mind the gap', '#ff9a3c'],
  ['Sprint', 'Catch the last train', '#31e7c9'],
];

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.08,
    ...options,
  });
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function meshBox(width, height, depth, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.trackSegments = [];
    this.buildings = [];
    this.signs = [];
    this.gantries = [];
    this.glowTexture = makeGlowTexture();
    this.graffitiTextures = Array.from({ length: 5 }, () => makeGraffitiTexture(Math.random));
    this.signMaterials = SIGN_COPY.map(([text, subtitle, accent]) =>
      new THREE.MeshBasicMaterial({
        map: makeSignTexture(text, subtitle, accent),
        transparent: true,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    );
    this.bannerMaterials = [
      makeBannerTexture('Neon Rails', 'Line 03 · night service', '#ffcc4d'),
      makeBannerTexture('No brakes', 'Keep your head down', '#31e7c9'),
      makeBannerTexture('Last train', 'Downtown express', '#ff5d63'),
    ].map(
      (texture) =>
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          toneMapped: false,
          side: THREE.DoubleSide,
        })
    );

    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildTrack();
    this.buildCity();
    this.buildSigns();
    this.buildGantries();
    this.buildSkyline();
  }

  buildSky() {
    const geometry = new THREE.SphereGeometry(460, 40, 24);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPosition;
        uniform float uTime;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vPosition);
          float h = clamp(dir.y, -0.25, 1.0);

          vec3 top = vec3(0.045, 0.055, 0.16);
          vec3 mid = vec3(0.31, 0.18, 0.42);
          vec3 horizon = vec3(1.0, 0.47, 0.29);
          vec3 ground = vec3(0.06, 0.045, 0.09);

          vec3 color = mix(horizon, mid, smoothstep(-0.02, 0.24, h));
          color = mix(color, top, smoothstep(0.2, 0.82, h));
          color = mix(ground, color, smoothstep(-0.22, 0.015, h));

          vec3 sunDir = normalize(vec3(-0.58, 0.15, -0.8));
          float sunDot = max(dot(dir, sunDir), 0.0);
          color += vec3(1.0, 0.55, 0.25) * pow(sunDot, 900.0) * 2.2;
          color += vec3(1.0, 0.38, 0.18) * pow(sunDot, 14.0) * 0.28;
          color += vec3(0.95, 0.35, 0.16) * pow(sunDot, 3.0) * 0.06;

          float star = step(0.9975, hash(floor(dir * 340.0)));
          color += vec3(0.78, 0.86, 1.0) * star * smoothstep(0.18, 0.65, dir.y) * 0.55;

          float streak = sin(dir.x * 26.0 + dir.z * 12.0) * 0.5 + 0.5;
          color += vec3(0.8, 0.36, 0.22) * pow(sunDot, 6.0) * streak * 0.035;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geometry, material);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  buildLights() {
    this.hemisphere = new THREE.HemisphereLight(0xa8c0ff, 0x4d3039, 1.45);
    this.scene.add(this.hemisphere);

    // Key light comes from behind the runner so the facades facing the camera
    // read clearly while still casting long, cinematic shadows down the line.
    this.sun = new THREE.DirectionalLight(0xffc48f, 3.1);
    this.sun.position.set(-22, 30, 24);
    this.sun.target.position.set(0, 0, -6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -32;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const fill = new THREE.DirectionalLight(0x7e8cff, 0.9);
    fill.position.set(18, 12, 20);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff865c, 1.0);
    rim.position.set(-4, 9, -30);
    this.scene.add(rim);
  }

  buildGround() {
    const groundMat = material(0x141020, { roughness: 0.96, metalness: 0.12 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 760), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.48, -180);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x28203a });
    for (let i = 0; i < 22; i += 1) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(420, 0.45), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, -0.465, 30 - i * 24);
      this.scene.add(stripe);
    }
  }

  buildTrack() {
    const ballastMat = material(0x27212f, { roughness: 1, metalness: 0 });
    const sleeperMat = material(0x483528, { roughness: 0.94 });
    const railMat = material(0xb6c1d2, { roughness: 0.25, metalness: 0.95 });
    const railBaseMat = material(0x343845, { roughness: 0.7, metalness: 0.5 });
    const concreteMat = material(0x4f475c, { roughness: 0.92 });
    const edgeMat = material(0xffc547, { roughness: 0.8 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x31e7c9, toneMapped: false });
    const poleMat = material(0x252433, { roughness: 0.58, metalness: 0.55 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdf9e, toneMapped: false });

    const sleeperGeometry = new THREE.BoxGeometry(9.85, 0.1, 0.56);
    const dummy = new THREE.Object3D();
    const glowMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffc777,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.62,
    });

    for (let i = 0; i < SEGMENT_COUNT; i += 1) {
      const group = new THREE.Group();
      group.position.z = 15 - i * SEGMENT_LENGTH;
      this.scene.add(group);
      this.trackSegments.push(group);

      group.add(meshBox(10.7, 0.46, SEGMENT_LENGTH, ballastMat, 0, -0.28, 0));

      const sleepers = new THREE.InstancedMesh(sleeperGeometry, sleeperMat, 24);
      for (let s = 0; s < 24; s += 1) {
        dummy.position.set(0, -0.045, -SEGMENT_LENGTH / 2 + 0.8 + s * 1.23);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        sleepers.setMatrixAt(s, dummy.matrix);
      }
      sleepers.receiveShadow = true;
      sleepers.instanceMatrix.needsUpdate = true;
      group.add(sleepers);

      for (const lane of LANE_X) {
        for (const offset of [-0.84, 0.84]) {
          const x = lane + offset;
          group.add(meshBox(0.2, 0.09, SEGMENT_LENGTH, railBaseMat, x, 0.0, 0));
          group.add(meshBox(0.105, 0.13, SEGMENT_LENGTH, railMat, x, 0.11, 0));
        }
      }

      for (const side of [-1, 1]) {
        group.add(meshBox(1.6, 0.42, SEGMENT_LENGTH, concreteMat, side * 6.0, 0.02, 0));
        group.add(meshBox(0.15, 0.055, SEGMENT_LENGTH, edgeMat, side * 5.31, 0.245, 0));
        group.add(meshBox(0.035, 0.035, SEGMENT_LENGTH, neonMat, side * 5.02, 0.03, 0));

        // Low tagged wall behind each platform.
        const graffiti =
          this.graffitiTextures[Math.floor(Math.random() * this.graffitiTextures.length)].clone();
        graffiti.needsUpdate = true;
        graffiti.wrapS = THREE.RepeatWrapping;
        graffiti.repeat.set(2.4, 1);
        const wallMat = new THREE.MeshStandardMaterial({
          map: graffiti,
          roughness: 0.9,
          metalness: 0.04,
        });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, SEGMENT_LENGTH), [
          wallMat,
          wallMat,
          concreteMat,
          concreteMat,
          wallMat,
          wallMat,
        ]);
        wall.position.set(side * 7.3, 0.62, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        for (const z of [-7.5, 7.5]) {
          group.add(meshBox(0.28, 0.22, 0.28, poleMat, side * 6.32, 0.33, z));
          group.add(meshBox(0.13, 5.3, 0.13, poleMat, side * 6.32, 2.9, z));
          group.add(meshBox(1.28, 0.09, 0.12, poleMat, side * 5.7, 5.46, z));
          group.add(meshBox(0.62, 0.14, 0.28, poleMat, side * 5.16, 5.36, z));
          group.add(meshBox(0.48, 0.035, 0.18, lampMat, side * 5.16, 5.28, z));
          const glow = new THREE.Sprite(glowMat);
          glow.position.set(side * 5.16, 5.22, z);
          glow.scale.set(2.1, 2.1, 1);
          group.add(glow);
        }

        // Platform clutter: vending machine, bins, cones, utility boxes.
        if (i % 2 === 0 && side > 0) {
          const vendorMat = material(0x1c2a3d, { roughness: 0.5, metalness: 0.3 });
          group.add(meshBox(1.0, 1.8, 0.65, vendorMat, side * 6.38, 1.15, -3.4));
          const screenMat = new THREE.MeshBasicMaterial({ color: 0x5ce7ff, toneMapped: false });
          group.add(meshBox(0.72, 1.1, 0.04, screenMat, side * 5.99, 1.25, -3.4));
          group.add(meshBox(0.72, 0.16, 0.05, new THREE.MeshBasicMaterial({ color: 0xffcc4d }), side * 5.98, 1.92, -3.4));
        }
        if (i % 2 === 1 && side < 0) {
          group.add(meshBox(0.9, 0.55, 0.62, material(0x5c4636), side * 6.35, 0.52, 4.2));
          group.add(meshBox(0.55, 0.7, 0.55, material(0x2c4a48), side * 6.25, 0.6, -5.4));
        }
        const coneMat = material(0xff7a33, { roughness: 0.7 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), coneMat);
        cone.position.set(side * 5.62, 0.48, (i % 3) * 5 - 5);
        cone.castShadow = true;
        group.add(cone);
        group.add(meshBox(0.36, 0.04, 0.36, material(0x1f1e2b), side * 5.62, 0.25, (i % 3) * 5 - 5));
      }
    }
  }

  buildCity() {
    const palette = [0x28243d, 0x1e2c3a, 0x342941, 0x252a3d, 0x2d2338];
    for (const side of [-1, 1]) {
      for (let i = 0; i < BUILDING_COUNT; i += 1) {
        const width = 9 + Math.random() * 8;
        const depth = 10 + Math.random() * 7;
        const height = 12 + Math.random() * 34;
        const cols = Math.max(3, Math.round(width / 2.4));
        const rows = Math.max(5, Math.round(height / 3));
        const texture = makeBuildingTexture(Math.random, cols, rows);
        const sideMat = new THREE.MeshStandardMaterial({
          map: texture,
          emissiveMap: texture,
          emissive: 0xffffff,
          emissiveIntensity: 0.32,
          roughness: 0.88,
          metalness: 0.02,
        });
        const roofMat = material(palette[Math.floor(Math.random() * palette.length)], {
          roughness: 0.96,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
          sideMat,
          sideMat,
          roofMat,
          roofMat,
          sideMat,
          sideMat,
        ]);
        building.scale.set(width, height, depth);
        building.position.set(side * (19 + Math.random() * 14), height / 2 - 0.4, 20 - i * BUILDING_SPACING);
        building.castShadow = false;
        building.receiveShadow = true;
        this.scene.add(building);
        this.buildings.push({
          mesh: building,
          side,
          height,
          width,
          depth,
          baseZ: building.position.z,
        });
      }
    }
  }

  buildSigns() {
    for (let i = 0; i < SIGN_COUNT; i += 1) {
      const side = i % 2 === 0 ? 1 : -1;
      const group = new THREE.Group();
      group.position.set(side * 8.8, 0, 18 - i * SIGN_SPACING);
      group.rotation.y = side * -0.28;
      this.scene.add(group);

      const metal = material(0x252333, { roughness: 0.6, metalness: 0.6 });
      group.add(meshBox(0.2, 4.6, 0.2, metal, -1.9, 2.3, -0.16));
      group.add(meshBox(0.2, 4.6, 0.2, metal, 1.9, 2.3, -0.16));
      group.add(meshBox(4.55, 2.38, 0.16, metal, 0, 4.55, -0.04));

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.15), this.signMaterials[i % this.signMaterials.length]);
      plane.position.set(0, 4.55, 0.06);
      group.add(plane);

      this.signs.push({ group, side, plane });
    }
  }

  buildGantries() {
    const metal = material(0x2a293d, { roughness: 0.55, metalness: 0.62 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe0a3, toneMapped: false });
    const glowMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffcf86,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
    });

    for (let i = 0; i < GANTRY_COUNT; i += 1) {
      const group = new THREE.Group();
      group.position.set(0, 0, 12 - i * GANTRY_SPACING);
      this.scene.add(group);

      for (const side of [-1, 1]) {
        group.add(meshBox(0.26, 6.3, 0.26, metal, side * 5.85, 3.15, 0));
        group.add(meshBox(0.7, 0.16, 0.7, metal, side * 5.85, 0.08, 0));
        group.add(meshBox(0.5, 0.16, 0.3, metal, side * 4.1, 6.06, 0));
        group.add(meshBox(0.42, 0.04, 0.24, lightMat, side * 4.1, 5.97, 0));
        const glow = new THREE.Sprite(glowMat);
        glow.position.set(side * 4.1, 5.92, 0);
        glow.scale.set(1.8, 1.8, 1);
        group.add(glow);
      }
      group.add(meshBox(12.0, 0.32, 0.34, metal, 0, 6.25, 0));
      group.add(meshBox(11.3, 0.1, 0.12, metal, 0, 5.9, 0));

      const bannerMaterial = this.bannerMaterials[i % this.bannerMaterials.length].clone();
      bannerMaterial.transparent = true;
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.25), bannerMaterial);
      banner.position.set(0, 5.62, 0.18);
      group.add(banner);
      group.userData.banner = banner;
      group.userData.bannerMaterial = bannerMaterial;

      this.gantries.push(group);
    }
  }

  buildSkyline() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c1833, roughness: 0.98, metalness: 0 });
    for (let i = 0; i < 34; i += 1) {
      const width = 8 + Math.random() * 22;
      const height = 14 + Math.random() * 52;
      const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, 10), mat);
      box.position.set((Math.random() - 0.5) * 260, height / 2 - 0.5, -270 - Math.random() * 50);
      this.scene.add(box);
    }
    const moonMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffd7a8,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.45,
    });
    const moon = new THREE.Sprite(moonMat);
    moon.position.set(-95, 52, -300);
    moon.scale.set(38, 38, 1);
    this.scene.add(moon);
  }

  update(dt, speed) {
    const delta = speed * dt;
    this.time += dt;

    for (const segment of this.trackSegments) {
      segment.position.z += delta;
      if (segment.position.z > 45) segment.position.z -= SEGMENT_LENGTH * SEGMENT_COUNT;
    }

    for (const building of this.buildings) {
      building.mesh.position.z += delta;
      if (building.mesh.position.z > 60) {
        building.mesh.position.z -= BUILDING_SPACING * BUILDING_COUNT;
        building.mesh.position.x = building.side * (19 + Math.random() * 14);
      }
    }

    for (const sign of this.signs) {
      sign.group.position.z += delta;
      if (sign.group.position.z > 50) {
        sign.group.position.z -= SIGN_SPACING * SIGN_COUNT;
        const material = this.signMaterials[Math.floor(Math.random() * this.signMaterials.length)];
        sign.plane.material = material;
      }
    }

    for (const gantry of this.gantries) {
      gantry.position.z += delta;
      if (gantry.position.z > 45) gantry.position.z -= GANTRY_SPACING * GANTRY_COUNT;
      const banner = gantry.userData.banner;
      const bannerMaterial = gantry.userData.bannerMaterial;
      if (banner && bannerMaterial) {
        const opacity = clamp01((-gantry.position.z - 4) / 22);
        bannerMaterial.opacity = opacity;
        banner.visible = opacity > 0.02;
      }
    }
  }
}

// Small helper keeps the sign hierarchy readable.
