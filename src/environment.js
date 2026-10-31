import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const LANE_X = [-2.4, 0, 2.4];
export const TRACK_AHEAD = 300;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function transformed(geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const copy = geometry.clone();
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  copy.applyMatrix4(matrix);
  return copy;
}

function mergedMesh(parts, material) {
  const geometry = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeBallastTexture() {
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#34343a";
    ctx.fillRect(0, 0, w, h);
    const shades = ["#292a2f", "#414147", "#4d4b4d", "#24252a", "#595552", "#3b3c42"];
    for (let i = 0; i < 7000; i++) {
      ctx.fillStyle = pick(shades);
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = Math.random() * 4 + 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "rgba(0,0,0,.18)");
    grad.addColorStop(0.2, "rgba(255,255,255,.03)");
    grad.addColorStop(0.5, "rgba(255,255,255,.06)");
    grad.addColorStop(0.8, "rgba(255,255,255,.03)");
    grad.addColorStop(1, "rgba(0,0,0,.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  texture.repeat.set(1.2, 56);
  return texture;
}

function makeConcreteTexture() {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#9a8d80";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${rand(50, 110) | 0},${rand(50, 100) | 0},${rand(50, 95) | 0},${rand(0.03, 0.13)})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, rand(1, 5), rand(1, 4));
    }
    ctx.strokeStyle = "rgba(65,58,54,.16)";
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
  texture.repeat.set(1, 50);
  return texture;
}

function makeFacadeTexture(variant) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const bases = ["#202d43", "#27354b", "#1d293d", "#2d374a"];
    ctx.fillStyle = bases[variant % bases.length];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.035)";
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 1);
    const cols = 6;
    const rows = 13;
    const padX = 14;
    const padY = 13;
    const cellW = (w - padX * 2) / cols;
    const cellH = (h - padY * 2) / rows;
    for (let yy = 0; yy < rows; yy++) {
      for (let xx = 0; xx < cols; xx++) {
        const lit = Math.random();
        let color = "rgba(12,20,33,.9)";
        if (lit > 0.67) color = pick(["#ffd18a", "#ffb35c", "#ffe1a6", "#a8d7cc", "#f5a066"]);
        else if (lit > 0.47) color = pick(["#5f7892", "#4d647d", "#89938f"]);
        ctx.fillStyle = color;
        ctx.fillRect(padX + xx * cellW + 3, padY + yy * cellH + 3, cellW - 7, cellH - 7);
        if (lit > 0.67) {
          ctx.fillStyle = "rgba(255,214,140,.18)";
          ctx.fillRect(padX + xx * cellW + 1, padY + yy * cellH + 1, cellW - 3, cellH - 3);
        }
        ctx.strokeStyle = "rgba(6,11,20,.34)";
        ctx.strokeRect(padX + xx * cellW + 3, padY + yy * cellH + 3, cellW - 7, cellH - 7);
      }
    }
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,160,110,.08)");
    grad.addColorStop(1, "rgba(0,0,0,.26)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeSignTexture(text, bg = "#ff6738", fg = "#fff4e3") {
  return canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg;
    ctx.font = "700 63px Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function makeCloudTexture() {
  const texture = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 15; i++) {
      const x = rand(20, w - 20);
      const y = rand(30, h - 25);
      const r = rand(14, 42);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,247,231,.18)");
      grad.addColorStop(1, "rgba(255,247,231,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  return texture;
}

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.trackChunks = [];
    this.buildings = [];
    this.gantries = [];
    this.clouds = [];
    this.dust = null;
    this.ballastTexture = makeBallastTexture();
    this.concreteTexture = makeConcreteTexture();
    this.clock = 0;
    this.build();
  }

  build() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(0xe3a789, 72, 300);

    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildRail();
    this.buildTrackChunks();
    this.buildCity();
    this.buildGantries();
    this.buildCatenary();
    this.buildClouds();
    this.buildDust();
  }

  buildSky() {
    const skyGeo = new THREE.SphereGeometry(420, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color("#526d9e") },
        midColor: { value: new THREE.Color("#dc8768") },
        horizonColor: { value: new THREE.Color("#ffc39b") },
        sunColor: { value: new THREE.Color("#fff2c7") },
        sunDirection: { value: new THREE.Vector3(0.34, 0.19, -0.92).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = clamp(dir.y, -0.1, 1.0);
          vec3 color = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
          color = mix(color, topColor, smoothstep(0.18, 0.72, h));
          float sunDot = max(dot(dir, sunDirection), 0.0);
          float sun = pow(sunDot, 420.0);
          float glow = pow(sunDot, 12.0);
          color += sunColor * sun * 1.5 + sunColor * glow * 0.22;
          float haze = smoothstep(0.11, -0.02, h) * 0.18;
          color = mix(color, horizonColor, haze);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.sky = sky;

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: canvasTexture(128, 128, (ctx, w, h) => {
          const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
          grad.addColorStop(0, "rgba(255,250,225,1)");
          grad.addColorStop(0.28, "rgba(255,238,176,.95)");
          grad.addColorStop(1, "rgba(255,206,132,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    sun.scale.set(50, 50, 1);
    sun.position.set(118, 62, -310);
    this.scene.add(sun);
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xffe4c1, 0x3a4a60, 2.15);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffbd8b, 3.35);
    key.position.set(-22, 36, 18);
    key.target.position.set(2, 0, -30);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -28;
    key.shadow.camera.right = 28;
    key.shadow.camera.top = 28;
    key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 100;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.035;
    this.scene.add(key, key.target);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0x88b9d8, 1.15);
    rim.position.set(24, 16, -45);
    rim.target.position.set(0, 1, 0);
    this.scene.add(rim, rim.target);


  }

  buildGround() {
    const groundMat = new THREE.MeshLambertMaterial({
      map: this.ballastTexture,
      color: 0xb3aaa1,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14.8, TRACK_AHEAD + 50), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.015, -TRACK_AHEAD / 2 + 24);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    const walkMat = new THREE.MeshLambertMaterial({
      map: this.concreteTexture,
      color: 0xc1ad99,
    });
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.22, TRACK_AHEAD + 40), walkMat);
      walk.position.set(side * 6.9, 0.1, -TRACK_AHEAD / 2 + 20);
      walk.receiveShadow = true;
      this.scene.add(walk);

      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, TRACK_AHEAD + 40), new THREE.MeshLambertMaterial({ color: 0xd8c3ab }));
      curb.position.set(side * 5.36, 0.12, -TRACK_AHEAD / 2 + 20);
      curb.receiveShadow = true;
      this.scene.add(curb);

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.92, TRACK_AHEAD + 40),
        new THREE.MeshLambertMaterial({ map: this.concreteTexture, color: 0xa58f7e }),
      );
      wall.position.set(side * 8.55, 0.44, -TRACK_AHEAD / 2 + 20);
      this.scene.add(wall);
    }

    // A wide, dark city floor grounds the skyline and hides the horizon gap.
    const cityGround = new THREE.Mesh(
      new THREE.PlaneGeometry(180, TRACK_AHEAD + 80),
      new THREE.MeshLambertMaterial({ color: 0x2d2b32 }),
    );
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.set(0, -0.04, -TRACK_AHEAD / 2 + 10);
    this.scene.add(cityGround);
  }

  buildRail() {
    const railMat = new THREE.MeshPhongMaterial({ color: 0x737b83, shininess: 90, specular: 0xbfc9d4 });
    const railGeo = new THREE.BoxGeometry(0.085, 0.11, TRACK_AHEAD + 44);
    const railParts = [];
    for (const lane of LANE_X) {
      for (const offset of [-0.62, 0.62]) {
        railParts.push(transformed(railGeo, [lane + offset, 0.16, -TRACK_AHEAD / 2 + 20]));
      }
    }
    const rails = new THREE.Mesh(mergeGeometries(railParts, false), railMat);
    rails.receiveShadow = true;
    this.scene.add(rails);

    const thirdRailMat = new THREE.MeshPhongMaterial({ color: 0x8f5c42, shininess: 40, specular: 0x9c755f });
    const thirdParts = LANE_X.map((lane) =>
      transformed(new THREE.BoxGeometry(0.1, 0.08, TRACK_AHEAD + 44), [lane + 0.26, 0.23, -TRACK_AHEAD / 2 + 20]),
    );
    this.scene.add(new THREE.Mesh(mergeGeometries(thirdParts, false), thirdRailMat));
    this.railMeshes = [rails];
  }

  buildTrackChunks() {
    const sleeperGeo = new THREE.BoxGeometry(1.95, 0.1, 0.34);
    const sleeperMat = new THREE.MeshLambertMaterial({ color: 0x6c5543 });
    const boltGeo = new THREE.BoxGeometry(0.1, 0.12, 0.1);
    const boltMat = new THREE.MeshLambertMaterial({ color: 0x41454a });
    const lampPostMat = new THREE.MeshLambertMaterial({ color: 0x253044 });
    const lampGlowMat = new THREE.MeshLambertMaterial({ color: 0xffe9bd, emissive: 0xffb864, emissiveIntensity: 2.6 });
    const cabinetMat = new THREE.MeshLambertMaterial({ color: 0x687072 });

    const chunkLength = 34;
    const total = 9;
    const sleeperCount = 14;
    const stemGeo = new THREE.CylinderGeometry(0.06, 0.095, 3.6, 6);
    const armGeo = new THREE.BoxGeometry(0.9, 0.07, 0.08);
    const shadeGeo = new THREE.ConeGeometry(0.25, 0.22, 10, 1, true);
    const bulbGeo = new THREE.SphereGeometry(0.095, 7, 5);
    const cabinetGeo = new THREE.BoxGeometry(0.7, 1.05, 0.5);

    for (let i = 0; i < total; i++) {
      const chunk = new THREE.Group();
      chunk.position.z = 24 - i * chunkLength;

      const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount * LANE_X.length);
      sleepers.receiveShadow = true;
      const dummy = new THREE.Object3D();
      let n = 0;
      for (let s = 0; s < sleeperCount; s++) {
        for (const lane of LANE_X) {
          dummy.position.set(lane, 0.075, -s * 2.4);
          dummy.rotation.y = rand(-0.012, 0.012);
          dummy.updateMatrix();
          sleepers.setMatrixAt(n++, dummy.matrix);
        }
      }
      sleepers.instanceMatrix.needsUpdate = true;
      chunk.add(sleepers);

      const bolts = new THREE.InstancedMesh(boltGeo, boltMat, sleeperCount * 6);
      n = 0;
      for (let s = 0; s < sleeperCount; s++) {
        for (const lane of LANE_X) {
          for (const offset of [-0.62, 0.62]) {
            dummy.position.set(lane + offset, 0.16, -s * 2.4);
            dummy.updateMatrix();
            bolts.setMatrixAt(n++, dummy.matrix);
          }
        }
      }
      bolts.instanceMatrix.needsUpdate = true;
      chunk.add(bolts);

      const steelParts = [];
      const bulbParts = [];
      for (const side of [-1, 1]) {
        const px = side * 7.1;
        const pz = -5;
        steelParts.push(transformed(stemGeo, [px, 1.95, pz]));
        steelParts.push(transformed(armGeo, [px - side * 0.4, 3.67, pz]));
        steelParts.push(transformed(shadeGeo, [px - side * 0.82, 3.57, pz], [0, 0, Math.PI]));
        bulbParts.push(transformed(bulbGeo, [px - side * 0.82, 3.45, pz]));
      }
      steelParts.push(transformed(cabinetGeo, [i % 2 ? 6.15 : -6.15, 0.64, -21]));
      const poleMesh = mergedMesh(steelParts, lampPostMat);
      poleMesh.userData.isDecoration = true;
      chunk.add(poleMesh);
      chunk.add(mergedMesh(bulbParts, lampGlowMat));

      this.scene.add(chunk);
      this.trackChunks.push(chunk);
    }
    this.chunkSpan = total * chunkLength;
  }

  buildCity() {
    const facadeMaps = [];
    for (let i = 0; i < 4; i++) facadeMaps.push(makeFacadeTexture(i));
    const tints = [0xffffff, 0xe3c5ad, 0xb9c6cf, 0xffd9bd, 0xb4aeb5, 0xd8b9aa];
    const signTexture = makeSignTexture("HOTEL 07", "#c84c2b", "#fff4e3");
    const signTextureB = makeSignTexture("NOODLES", "#1d5b59", "#ffe3a8");
    const countPerSide = 16;
    const spacing = 22;
    const span = countPerSide * spacing;
    this.buildingData = [];
    this.buildingSpan = span;

    for (const side of [-1, 1]) {
      for (let i = 0; i < countPerSide; i++) {
        this.buildingData.push({
          side,
          width: rand(5.8, 10.5),
          depth: rand(7, 14),
          height: rand(9, 30),
          x: side * rand(10.8, 21),
          z: 17 - i * spacing + rand(-5, 5),
          tint: pick(tints),
          variant: (i + (side > 0 ? 2 : 0)) % 4,
          sign: Math.random() > 0.55,
          signY: rand(3.6, 6.2),
          signTexture: Math.random() > 0.5 ? 0 : 1,
          signWidth: rand(2.6, 4.0),
        });
      }

      // A looser back row broadens the skyline and closes the bright horizon
      // gap that otherwise opens up beyond the front row of buildings.
      for (let i = 0; i < 10; i++) {
        this.buildingData.push({
          side,
          width: rand(8, 15),
          depth: rand(9, 18),
          height: rand(12, 38),
          x: side * rand(24, 43),
          z: 17 - i * (span / 10) + rand(-8, 8),
          tint: pick(tints),
          variant: (i + (side > 0 ? 1 : 3)) % 4,
          sign: false,
          signY: 0,
          signTexture: 0,
          signWidth: 0,
        });
      }
    }

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.buildingData.forEach((building, index) => { building.roofIndex = index; });
    this.buildingMeshes = [];
    for (let variant = 0; variant < 4; variant++) {
      const data = this.buildingData.filter((b) => b.variant === variant);
      const material = new THREE.MeshLambertMaterial({
        map: facadeMaps[variant],
        color: 0xffffff,
        emissive: 0xff9e5f,
        emissiveMap: facadeMaps[variant],
        emissiveIntensity: 0.17,
      });
      const mesh = new THREE.InstancedMesh(boxGeo, material, data.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      data.forEach((building, index) => {
        building.body = mesh;
        building.bodyIndex = index;
        mesh.setColorAt(index, new THREE.Color(building.tint));
      });
      mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
      this.buildingMeshes.push(mesh);
    }

    this.roofMesh = new THREE.InstancedMesh(
      boxGeo,
      new THREE.MeshLambertMaterial({ color: 0x605954 }),
      this.buildingData.length,
    );
    this.roofMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.roofMesh.frustumCulled = false;
    this.scene.add(this.roofMesh);

    const signsA = this.buildingData.filter((b) => b.sign && b.signTexture === 0);
    const signsB = this.buildingData.filter((b) => b.sign && b.signTexture === 1);
    this.signMeshes = [];
    for (const [data, texture] of [[signsA, signTexture], [signsB, signTextureB]]) {
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
        data.length,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      data.forEach((building, index) => {
        building.signMesh = mesh;
        building.signIndex = index;
      });
      this.scene.add(mesh);
      this.signMeshes.push(mesh);
    }

    this.dummy = new THREE.Object3D();
    this.writeBuildingMatrices();
  }

  writeBuildingMatrices() {
    const dummy = this.dummy;
    for (const building of this.buildingData) {
      dummy.position.set(building.x, building.height / 2, building.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      building.body.setMatrixAt(building.bodyIndex, dummy.matrix);

      dummy.position.set(building.x, building.height + 0.2, building.z);
      dummy.scale.set(building.width + 0.55, 0.45, building.depth + 0.55);
      dummy.updateMatrix();
      this.roofMesh.setMatrixAt(building.roofIndex, dummy.matrix);

      if (building.signMesh) {
        dummy.position.set(
          building.x - building.side * (building.width / 2 + 0.06),
          building.signY,
          building.z - 0.2,
        );
        dummy.rotation.set(0, building.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
        dummy.scale.set(building.signWidth, 1.25, 1);
        dummy.updateMatrix();
        building.signMesh.setMatrixAt(building.signIndex, dummy.matrix);
      }
    }
    for (const mesh of this.buildingMeshes) mesh.instanceMatrix.needsUpdate = true;
    this.roofMesh.instanceMatrix.needsUpdate = true;
    for (const mesh of this.signMeshes) mesh.instanceMatrix.needsUpdate = true;
  }

  updateBuildings(move) {
    for (const building of this.buildingData) {
      building.z += move;
      if (building.z > 38) {
        building.z -= this.buildingSpan;
        building.x = building.side * rand(10.8, 21);
        building.height = rand(9, 30);
        building.signY = rand(3.6, Math.min(6.2, building.height - 2));
      }
    }
    this.writeBuildingMatrices();
  }

  buildGantries() {
    const steel = new THREE.MeshLambertMaterial({ color: 0x334154 });
    const glow = new THREE.MeshLambertMaterial({ color: 0xd4fff2, emissive: 0x8ff7d7, emissiveIntensity: 3.2 });
    const signMats = [
      new THREE.MeshBasicMaterial({ map: makeSignTexture("METRO", "#173b53", "#7ce3c4"), transparent: true, toneMapped: false, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: makeSignTexture("CITY 07", "#a53920", "#fff4e3"), transparent: true, toneMapped: false, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: makeSignTexture("EXPRESS", "#233f66", "#ffc83e"), transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    ];
    const positions = [-34, -116, -198, -282];
    const span = 14.2;

    for (let i = 0; i < positions.length; i++) {
      const group = new THREE.Group();
      const steelParts = [];
      const glowParts = [];
      for (const side of [-1, 1]) {
        steelParts.push(transformed(new THREE.BoxGeometry(0.32, 6.6, 0.32), [side * 6.7, 3.3, 0]));
        steelParts.push(transformed(new THREE.BoxGeometry(0.8, 0.25, 0.8), [side * 6.7, 0.12, 0]));
        steelParts.push(transformed(new THREE.BoxGeometry(0.34, 0.72, 0.28), [side * 4.4, 4.95, 0]));
      }
      steelParts.push(transformed(new THREE.BoxGeometry(span, 0.28, 0.34), [0, 6.55, 0]));
      steelParts.push(transformed(new THREE.BoxGeometry(span - 1, 0.12, 0.2), [0, 5.92, 0]));
      group.add(mergedMesh(steelParts, steel));

      glowParts.push(transformed(new THREE.BoxGeometry(5.5, 0.07, 0.08), [0, 6.32, 0.2]));
      for (const side of [-1, 1]) {
        glowParts.push(transformed(new THREE.SphereGeometry(0.11, 7, 5), [side * 4.4, 5.08, 0.16]));
      }
      group.add(mergedMesh(glowParts, glow));

      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.84), signMats[i % signMats.length]);
      sign.position.set(0, 6.45, 0.2);
      group.add(sign);

      group.position.z = positions[i];
      this.scene.add(group);
      this.gantries.push(group);
    }
    this.gantrySpan = 82;
  }

  buildCatenary() {
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x252c34, transparent: true, opacity: 0.72 });
    const parts = [];
    for (const lane of LANE_X) {
      for (let i = 0; i < 3; i++) {
        parts.push(
          transformed(
            new THREE.CylinderGeometry(0.012, 0.012, TRACK_AHEAD + 50, 3),
            [lane + (i - 1) * 0.15, 5.3 + i * 0.16, -TRACK_AHEAD / 2 + 20],
            [Math.PI / 2, 0, 0],
          ),
        );
      }
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(parts, false), wireMat));
  }

  buildClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({
      map: makeCloudTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(rand(38, 90), rand(11, 23)), cloudMat);
      cloud.position.set(rand(-150, 150), rand(45, 88), -rand(210, 350));
      cloud.userData.speed = rand(0.2, 0.6);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildDust() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand(-9, 9);
      positions[i * 3 + 1] = rand(0.4, 6.5);
      positions[i * 3 + 2] = rand(-TRACK_AHEAD, 14);
      sizes[i] = rand(0.4, 1.1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd6ac,
      size: 0.045,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
    this.dustCount = count;
  }

  update(dt, speed, distance) {
    this.clock += dt;
    const move = speed * dt;
    this.ballastTexture.offset.y -= move * 0.018;

    for (const chunk of this.trackChunks) {
      chunk.position.z += move;
      if (chunk.position.z > 42) chunk.position.z -= this.chunkSpan;
    }

    this.updateBuildings(move);

    for (const gantry of this.gantries) {
      gantry.position.z += move;
      if (gantry.position.z > 34) gantry.position.z -= this.gantrySpan * 4;
    }

    for (const cloud of this.clouds) {
      cloud.position.z += move * 0.012 * cloud.userData.speed;
      cloud.position.x += Math.sin(this.clock * 0.04 + cloud.position.z) * dt * 0.08;
      if (cloud.position.z > -190) {
        cloud.position.z -= 170;
        cloud.position.x = rand(-150, 150);
      }
    }

    if (this.dust) {
      const positions = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < this.dustCount; i++) {
        positions[i * 3 + 2] += move * 0.7;
        positions[i * 3 + 1] += Math.sin(this.clock * 1.3 + i) * dt * 0.06;
        if (positions[i * 3 + 2] > 14) {
          positions[i * 3 + 2] -= TRACK_AHEAD + 14;
          positions[i * 3] = rand(-9, 9);
          positions[i * 3 + 1] = rand(0.4, 6.5);
        }
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    const speedNorm = THREE.MathUtils.clamp((speed - 16) / 24, 0, 1);
    this.keyLight.intensity = 3.35 - speedNorm * 0.25;
    this.renderer.toneMappingExposure = 1.05 + Math.sin(distance * 0.01) * 0.01;
  }
}
