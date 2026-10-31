import * as THREE from 'three';
import { ARENA, TEAM } from './constants.js';
import { makeCanvas, textureFromCanvas, rand, clamp, TAU } from './utils.js';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function createFieldTexture(renderer) {
  const c = makeCanvas(1024, 1536);
  const g = c.getContext('2d');

  const base = g.createLinearGradient(0, 0, 0, 1536);
  base.addColorStop(0, '#1b5c42');
  base.addColorStop(0.5, '#15503a');
  base.addColorStop(1, '#124633');
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 1536);

  // mowed stripes
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? 'rgba(150,255,200,0.06)' : 'rgba(0,0,0,0.07)';
    g.fillRect(0, i * 128, 1024, 64);
  }

  // team end zones
  const redZone = g.createLinearGradient(0, 0, 0, 250);
  redZone.addColorStop(0, 'rgba(255,40,90,0.3)');
  redZone.addColorStop(1, 'rgba(255,40,90,0)');
  g.fillStyle = redZone;
  g.fillRect(0, 0, 1024, 250);
  const blueZone = g.createLinearGradient(0, 1536, 0, 1286);
  blueZone.addColorStop(0, 'rgba(40,180,255,0.3)');
  blueZone.addColorStop(1, 'rgba(40,180,255,0)');
  g.fillStyle = blueZone;
  g.fillRect(0, 1286, 1024, 250);

  // turf noise
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1536;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(210,255,230,0.035)' : 'rgba(0,0,0,0.05)';
    g.fillRect(x, y, 2, 2);
  }

  g.strokeStyle = 'rgba(225,255,245,0.72)';
  g.lineWidth = 5;
  g.lineJoin = 'round';

  const inset = 42;
  g.strokeRect(inset, inset, 1024 - inset * 2, 1536 - inset * 2);

  // halfway line
  g.beginPath();
  g.moveTo(inset, 768);
  g.lineTo(1024 - inset, 768);
  g.stroke();

  // center circle + emblem
  g.beginPath();
  g.arc(512, 768, 148, 0, TAU);
  g.stroke();
  g.beginPath();
  g.arc(512, 768, 9, 0, TAU);
  g.fillStyle = 'rgba(215,255,240,0.55)';
  g.fill();

  g.save();
  g.translate(512, 768);
  g.globalAlpha = 0.12;
  g.strokeStyle = '#eafff6';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(0, 0, 112, 0, TAU);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
    g.lineTo(Math.cos(a + 0.35) * 112, Math.sin(a + 0.35) * 112);
    g.stroke();
  }
  g.restore();

  // goal boxes
  const boxW = 360;
  const boxD = 190;
  g.strokeRect(512 - boxW / 2, inset, boxW, boxD);
  g.strokeRect(512 - boxW / 2, 1536 - inset - boxD, boxW, boxD);

  // penalty arcs
  g.beginPath();
  g.arc(512, inset + 150, 118, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
  g.beginPath();
  g.arc(512, 1536 - inset - 150, 118, 1.18 * Math.PI, 1.82 * Math.PI);
  g.stroke();

  // penalty spots
  g.beginPath();
  g.arc(512, inset + 150, 7, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(512, 1536 - inset - 150, 7, 0, TAU);
  g.fill();

  // corner arcs
  for (const [x, y, a0] of [
    [inset, inset, 0],
    [1024 - inset, inset, Math.PI / 2],
    [inset, 1536 - inset, -Math.PI / 2],
    [1024 - inset, 1536 - inset, Math.PI],
  ]) {
    g.beginPath();
    g.arc(x, y, 38, a0, a0 + Math.PI / 2);
    g.stroke();
  }

  // subtle branding
  g.save();
  g.globalAlpha = 0.055;
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = '900 54px Chakra, sans-serif';
  g.fillText('SHELL STRIKERS', 512, 650);
  g.fillText('TURBO SOCCER LEAGUE', 512, 900);
  g.restore();

  return textureFromCanvas(c, renderer);
}

function createWallTexture(renderer) {
  const c = makeCanvas(1024, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0a1228');
  grad.addColorStop(0.7, '#0c1a34');
  grad.addColorStop(1, '#050a18');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);

  // panel seams
  for (let x = 0; x <= 1024; x += 128) {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(x, 0, 3, 512);
    g.fillStyle = 'rgba(120,190,255,0.07)';
    g.fillRect(x + 3, 0, 1, 512);
  }
  for (let y = 0; y <= 512; y += 128) {
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fillRect(0, y, 1024, 3);
  }

  // diagonal accents
  g.save();
  g.globalAlpha = 0.12;
  g.fillStyle = '#4fd6ff';
  for (let x = -200; x < 1024; x += 260) {
    g.beginPath();
    g.moveTo(x, 512);
    g.lineTo(x + 70, 512);
    g.lineTo(x + 260, 0);
    g.lineTo(x + 190, 0);
    g.closePath();
    g.fill();
  }
  g.restore();

  // sponsor bands
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 210, 1024, 2);
  g.fillRect(0, 340, 1024, 2);
  g.save();
  g.globalAlpha = 0.3;
  g.fillStyle = '#d9ff45';
  g.font = '700 46px Chakra, sans-serif';
  g.textAlign = 'center';
  g.fillText('TURBO', 210, 300);
  g.fillStyle = '#63d8ff';
  g.fillText('SHELL STRIKERS', 512, 300);
  g.fillStyle = '#ff5c88';
  g.fillText('BOOST', 814, 300);
  g.restore();

  return textureFromCanvas(c, renderer);
}

function createNetTexture(renderer) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(220,245,255,0.85)';
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 22) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  return textureFromCanvas(c, renderer);
}

function createGlowTexture(renderer, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace('1)', '0.6)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return textureFromCanvas(c, renderer);
}

function buildSky(scene, renderer) {
  const skyGeo = new THREE.SphereGeometry(460, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x05031a) },
      midColor: { value: new THREE.Color(0x101a44) },
      horizonColor: { value: new THREE.Color(0x14425c) },
      glowColor: { value: new THREE.Color(0x6f3cff) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 glowColor;
      varying vec3 vWorld;
      void main() {
        float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.48, 0.72, h));
        col = mix(col, topColor, smoothstep(0.68, 1.0, h));
        float glow = pow(max(0.0, 1.0 - abs(vWorld.y - 0.12) * 3.2), 3.0);
        col += glowColor * glow * 0.16;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const starCount = 700;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand(0, TAU);
    const phi = Math.acos(rand(0.02, 0.85));
    const r = 430;
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xcfe8ff, size: 1.7, transparent: true, opacity: 0.75, depthWrite: false })
  );
  scene.add(stars);

  const glowTex = createGlowTexture(renderer, 'rgba(150,200,255,1)', 'rgba(80,120,255,0)');
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fd0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  moon.position.set(-160, 190, -300);
  moon.scale.set(120, 120, 1);
  scene.add(moon);
}

function buildGoals(scene, renderer, netTexture, team) {
  const group = new THREE.Group();
  const dir = Math.sign(team.goalZ);
  const z = team.goalZ;
  const color = new THREE.Color(team.color);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xeaf6ff,
    emissive: color,
    emissiveIntensity: 1.4,
    metalness: 0.65,
    roughness: 0.22,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x081226, metalness: 0.5, roughness: 0.55 });

  const postGeo = new THREE.CylinderGeometry(0.34, 0.34, ARENA.goalH, 12);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(sx * ARENA.goalHalfW, ARENA.goalH / 2, z);
    post.castShadow = true;
    group.add(post);
  }
  const barGeo = new THREE.CylinderGeometry(0.34, 0.34, ARENA.goalHalfW * 2 + 0.6, 12);
  const bar = new THREE.Mesh(barGeo, frameMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, ARENA.goalH, z);
  group.add(bar);

  const backZ = z + dir * ARENA.goalDepth;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, darkMat);
    post.position.set(sx * ARENA.goalHalfW, ARENA.goalH / 2, backZ);
    group.add(post);
  }
  const backBar = new THREE.Mesh(barGeo, darkMat);
  backBar.rotation.z = Math.PI / 2;
  backBar.position.set(0, ARENA.goalH, backZ);
  group.add(backBar);

  const netMat = new THREE.MeshBasicMaterial({
    map: netTexture,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const backNet = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.goalHalfW * 2, ARENA.goalH), netMat);
  backNet.position.set(0, ARENA.goalH / 2, backZ - dir * 0.12);
  if (dir < 0) backNet.rotation.y = Math.PI;
  group.add(backNet);

  const sideNetGeo = new THREE.PlaneGeometry(ARENA.goalDepth, ARENA.goalH);
  for (const sx of [-1, 1]) {
    const net = new THREE.Mesh(sideNetGeo, netMat);
    net.rotation.y = Math.PI / 2;
    net.position.set(sx * ARENA.goalHalfW, ARENA.goalH / 2, z + dir * ARENA.goalDepth / 2);
    group.add(net);
  }

  const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.goalHalfW * 2, ARENA.goalDepth), netMat);
  roofNet.rotation.x = Math.PI / 2;
  roofNet.position.set(0, ARENA.goalH, z + dir * ARENA.goalDepth / 2);
  group.add(roofNet);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(ARENA.goalHalfW * 2 + 2, ARENA.goalH + 2, 0.6), darkMat);
  backWall.position.set(0, (ARENA.goalH + 2) / 2, backZ + dir * 0.45);
  group.add(backWall);

  // glowing goal floor
  const floorMat = new THREE.MeshBasicMaterial({ color: team.color, transparent: true, opacity: 0.2, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.goalHalfW * 2 - 0.6, ARENA.goalDepth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.035, z + dir * ARENA.goalDepth / 2);
  group.add(floor);

  // emblem on back wall
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 36), frameMat);
  ring.position.set(0, 4.4, backZ + dir * 0.05);
  group.add(ring);
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ color: team.color, transparent: true, opacity: 0.55 }));
  core.position.set(0, 4.4, backZ + dir * 0.08);
  if (dir < 0) core.rotation.y = Math.PI;
  group.add(core);

  // giant end-wall banner above the goal
  const bannerCanvas = makeCanvas(1024, 512);
  const bg = bannerCanvas.getContext('2d');
  const bgrad = bg.createLinearGradient(0, 0, 0, 512);
  bgrad.addColorStop(0, '#0a1730');
  bgrad.addColorStop(0.55, '#071022');
  bgrad.addColorStop(1, '#040a16');
  bg.fillStyle = bgrad;
  bg.fillRect(0, 0, 1024, 512);
  bg.save();
  bg.globalAlpha = 0.2;
  bg.fillStyle = team.css;
  for (let x = -200; x < 1100; x += 150) {
    bg.beginPath();
    bg.moveTo(x, 512);
    bg.lineTo(x + 38, 512);
    bg.lineTo(x + 180, 0);
    bg.lineTo(x + 142, 0);
    bg.closePath();
    bg.fill();
  }
  bg.restore();
  bg.strokeStyle = team.css;
  bg.lineWidth = 6;
  bg.globalAlpha = 0.7;
  bg.strokeRect(16, 16, 992, 480);
  bg.globalAlpha = 1;
  bg.fillStyle = '#9fc8e8';
  bg.font = '700 30px Chakra, sans-serif';
  bg.textAlign = 'center';
  bg.fillText('SHELL STRIKERS', 512, 82);
  bg.font = '400 176px Bungee, sans-serif';
  bg.fillStyle = team.css;
  bg.shadowColor = team.css;
  bg.shadowBlur = 40;
  bg.fillText(team.name, 512, 300);
  bg.shadowBlur = 0;
  bg.fillStyle = 'rgba(220,240,255,0.72)';
  bg.font = '700 28px Chakra, sans-serif';
  bg.fillText('TURBO SOCCER LEAGUE', 512, 412);
  bg.fillStyle = team.css;
  bg.globalAlpha = 0.5;
  for (const x of [110, 914]) {
    bg.fillRect(x - 3, 200, 6, 130);
  }
  bg.globalAlpha = 1;
  const bannerTex = textureFromCanvas(bannerCanvas, renderer);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(21.4, 10.7),
    new THREE.MeshBasicMaterial({ map: bannerTex, toneMapped: false })
  );
  banner.position.set(0, (ARENA.goalH + ARENA.wallH) / 2, z - dir * 0.4);
  if (dir > 0) banner.rotation.y = Math.PI;
  group.add(banner);

  const light = new THREE.PointLight(team.color, 90, 48, 1.7);
  light.position.set(0, 4.5, z + dir * 3.4);
  group.add(light);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createGlowTexture(renderer, `rgba(${team.color >> 16 & 255},${team.color >> 8 & 255},${team.color & 255},1)`, 'rgba(0,0,0,0)'),
    color: team.color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.position.set(0, 4.5, z + dir * 1.2);
  glow.scale.set(18, 12, 1);
  group.add(glow);

  scene.add(group);
  return group;
}

function buildStands(scene, renderer) {
  const crowdGeo = new THREE.BoxGeometry(0.58, 0.72, 0.58);
  const crowdMat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const total = 1260;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, total);
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const palette = [0x35c8ff, 0xff406e, 0xd9ff45, 0xffffff, 0xb47cff, 0xff9a2e, 0x5ce1a8];
  const seats = [];
  let index = 0;

  const standMat = new THREE.MeshStandardMaterial({ color: 0x0a1226, metalness: 0.35, roughness: 0.68 });
  const edgeMatBlue = new THREE.MeshBasicMaterial({ color: TEAM.blue.color });
  const edgeMatRed = new THREE.MeshBasicMaterial({ color: TEAM.red.color });

  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 6; tier++) {
      const x = side * (ARENA.halfW + 7.5 + tier * 3.1);
      const y = 2.2 + tier * 2.0;
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.0, ARENA.halfL * 2 + 6), standMat);
      base.position.set(x, y - 1.0, 0);
      base.receiveShadow = true;
      scene.add(base);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, ARENA.halfL * 2 + 6), tier % 2 ? edgeMatRed : edgeMatBlue);
      edge.position.set(x - side * 1.56, y + 0.02, 0);
      scene.add(edge);

      const count = 70;
      for (let i = 0; i < count && index < total; i++) {
        const z = -ARENA.halfL + 2 + (i / (count - 1)) * (ARENA.halfL * 2 - 4) + rand(-0.8, 0.8);
        seats.push({
          x: x + rand(-0.7, 0.7),
          y: y + 0.36,
          z,
          phase: rand(0, TAU),
          color: palette[Math.floor(Math.random() * palette.length)],
        });
        index++;
      }
    }
  }

  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 5; tier++) {
      const z = side * (ARENA.halfL + 10.5 + tier * 3.1);
      const y = 2.2 + tier * 2.0;
      const base = new THREE.Mesh(new THREE.BoxGeometry(ARENA.halfW * 2 + 8, 2.0, 3.1), standMat);
      base.position.set(0, y - 1.0, z);
      base.receiveShadow = true;
      scene.add(base);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(ARENA.halfW * 2 + 8, 0.16, 0.12), tier % 2 ? edgeMatRed : edgeMatBlue);
      edge.position.set(0, y + 0.02, z - side * 1.56);
      scene.add(edge);

      const count = 56;
      for (let i = 0; i < count && index < total; i++) {
        const x = -ARENA.halfW + 2 + (i / (count - 1)) * (ARENA.halfW * 2 - 4) + rand(-0.7, 0.7);
        seats.push({
          x,
          y: y + 0.36,
          z: z + rand(-0.7, 0.7),
          phase: rand(0, TAU),
          color: palette[Math.floor(Math.random() * palette.length)],
        });
        index++;
      }
    }
  }

  for (let i = 0; i < total; i++) {
    const s = seats[i % seats.length];
    _dummy.position.set(s.x, s.y, s.z);
    _dummy.scale.setScalar(rand(0.8, 1.15));
    _dummy.rotation.y = rand(0, TAU);
    _dummy.updateMatrix();
    crowd.setMatrixAt(i, _dummy.matrix);
    _color.setHex(s.color);
    crowd.setColorAt(i, _color);
  }
  crowd.instanceColor.needsUpdate = true;
  crowd.castShadow = false;
  scene.add(crowd);

  return { crowd, seats, total };
}

function buildFloodlights(scene, renderer) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x0b1224, metalness: 0.7, roughness: 0.4 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff });
  const glowTex = createGlowTexture(renderer, 'rgba(220,245,255,1)', 'rgba(120,180,255,0)');
  const corners = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  const beams = [];
  for (const [sx, sz] of corners) {
    const x = sx * (ARENA.halfW + 17);
    const z = sz * (ARENA.halfL + 15);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 32, 8), poleMat);
    pole.position.set(x, 16, z);
    scene.add(pole);

    const head = new THREE.Group();
    head.position.set(x, 32, z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.4, 1.2), poleMat);
    head.add(frame);
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -0.5; iy <= 0.5; iy += 1) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.2), lampMat);
        lamp.position.set(ix * 2.2, iy, 0.7);
        head.add(lamp);
      }
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xbfe6ff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(14, 9, 1);
    glow.position.z = 1.2;
    head.add(glow);
    head.lookAt(0, 0, 0);
    scene.add(head);

    const spot = new THREE.SpotLight(0xd8ecff, 260, 150, 0.62, 0.85, 1.4);
    spot.position.set(x, 32, z);
    spot.target.position.set(0, 0, 0);
    scene.add(spot);
    scene.add(spot.target);

    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(16, 42, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.028, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    const dir = new THREE.Vector3(0, 0, 0).sub(new THREE.Vector3(x, 32, z)).normalize();
    beam.position.copy(new THREE.Vector3(x, 32, z).add(dir.clone().multiplyScalar(21)));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    scene.add(beam);
    beams.push(beam);
  }
  return beams;
}

function drawJumbotron(canvas, state) {
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);

  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a1634');
  bg.addColorStop(1, '#03070f');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  g.strokeStyle = 'rgba(140,210,255,0.35)';
  g.lineWidth = 4;
  g.strokeRect(6, 6, w - 12, h - 12);

  g.fillStyle = '#8fb9dd';
  g.font = '700 26px Chakra, sans-serif';
  g.textAlign = 'center';
  g.fillText('SHELL STRIKERS', w / 2, 46);

  g.fillStyle = 'rgba(61,210,255,0.18)';
  g.fillRect(26, 72, 250, 150);
  g.fillStyle = 'rgba(255,64,110,0.18)';
  g.fillRect(w - 276, 72, 250, 150);

  g.fillStyle = '#3dd2ff';
  g.font = '400 92px Bungee, sans-serif';
  g.fillText(String(state.blue), 151, 192);
  g.fillStyle = '#ff406e';
  g.fillText(String(state.red), w - 151, 192);

  g.fillStyle = '#ffffff';
  g.font = '400 84px Bungee, sans-serif';
  g.fillText(state.time, w / 2, 185);

  g.fillStyle = '#8fb9dd';
  g.font = '700 24px Chakra, sans-serif';
  g.fillText('BLUE', 151, 240);
  g.fillText('RED', w - 151, 240);
  g.fillStyle = '#d9ff45';
  g.fillText(state.label, w / 2, 246);
}

function buildJumbotron(scene, renderer) {
  const canvas = makeCanvas(1024, 300);
  const texture = textureFromCanvas(canvas, renderer);
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x070d1e, metalness: 0.75, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(27, 10.5, 2.6), frameMat);
  group.add(body);

  const screenMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  for (const side of [-1, 1]) {
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 7.6), screenMat);
    screen.position.z = side * 1.32;
    if (side < 0) screen.rotation.y = Math.PI;
    group.add(screen);
  }

  const trimMat = new THREE.MeshBasicMaterial({ color: 0x3dd2ff });
  for (const side of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(27.4, 0.18, 0.18), trimMat);
    trim.position.set(0, 5.3, side * 1.34);
    group.add(trim);
  }

  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.8, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), cableMat);
    cable.position.set(sx * 10, 9.5, 0);
    group.add(cable);
  }
  const truss = new THREE.Mesh(new THREE.BoxGeometry(23, 0.4, 0.4), cableMat);
  truss.position.y = 13.8;
  group.add(truss);

  group.position.set(0, 33, 0);
  scene.add(group);

  const state = { blue: 0, red: 0, time: '3:00', label: 'WARM UP' };
  drawJumbotron(canvas, state);
  texture.needsUpdate = true;

  return {
    set(blue, red, time, label) {
      state.blue = blue;
      state.red = red;
      state.time = time;
      state.label = label;
      drawJumbotron(canvas, state);
      texture.needsUpdate = true;
    },
  };
}

function buildPads(scene) {
  const defs = [
    { x: -24, z: -42, big: true },
    { x: 24, z: 42, big: true },
    { x: 0, z: -34, big: false },
    { x: 0, z: 34, big: false },
    { x: -22, z: -14, big: false },
    { x: 22, z: 14, big: false },
    { x: -16, z: 40, big: false },
    { x: 16, z: -40, big: false },
  ];
  const pads = [];
  for (const def of defs) {
    const radius = def.big ? 2.1 : 1.35;
    const group = new THREE.Group();
    group.position.set(def.x, 0.03, def.z);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.1, 8, 40),
      new THREE.MeshBasicMaterial({ color: def.big ? 0xffd24a : 0xff9a2e, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.1, 6),
      new THREE.MeshStandardMaterial({
        color: def.big ? 0xffc93c : 0xff8a1f,
        emissive: def.big ? 0xffb300 : 0xff6a00,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.85,
        roughness: 0.35,
        metalness: 0.2,
      })
    );
    disc.position.y = 0.08;
    group.add(disc);

    const icon = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.34, radius * 0.5, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0 })
    );
    icon.rotation.x = -Math.PI / 2;
    icon.position.y = 0.18;
    group.add(icon);

    let beam = null;
    if (def.big) {
      beam = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.75, radius * 1.1, 5.5, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      beam.position.y = 2.8;
      group.add(beam);
    }

    scene.add(group);
    pads.push({
      pos: new THREE.Vector3(def.x, 0, def.z),
      big: def.big,
      radius,
      active: true,
      timer: 0,
      respawn: def.big ? 10 : 6,
      group,
      disc,
      ring,
      icon,
      beam,
      collect() {
        if (!this.active) return false;
        this.active = false;
        this.timer = this.respawn;
        this.disc.visible = false;
        this.icon.visible = false;
        if (this.beam) this.beam.visible = false;
        this.ring.material.opacity = 0.2;
        return true;
      },
    });
  }
  return pads;
}

export function buildWorld(scene, renderer) {
  scene.background = new THREE.Color(0x050817);
  scene.fog = new THREE.Fog(0x081226, 110, 320);

  buildSky(scene, renderer);

  const hemi = new THREE.HemisphereLight(0xa8d4ff, 0x123a26, 1.02);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff3dd, 2.9);
  key.position.set(34, 62, 24);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -62;
  key.shadow.camera.right = 62;
  key.shadow.camera.top = 78;
  key.shadow.camera.bottom = -78;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 180;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6f8dff, 1.0);
  rim.position.set(-40, 28, -34);
  scene.add(rim);

  // outer floor
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 190),
    new THREE.MeshStandardMaterial({ color: 0x050b16, roughness: 0.95, metalness: 0.05 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.03;
  outer.receiveShadow = true;
  scene.add(outer);

  // field
  const fieldTex = createFieldTexture(renderer);
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.halfW * 2, ARENA.halfL * 2),
    new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 0.88, metalness: 0.04 })
  );
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  scene.add(field);

  // glowing touchline border
  const borderMat = new THREE.MeshBasicMaterial({ color: 0x4fe6ff, transparent: true, opacity: 0.35 });
  for (const [w, h, x, z] of [
    [ARENA.halfW * 2 + 1.2, 0.14, 0, -ARENA.halfL],
    [ARENA.halfW * 2 + 1.2, 0.14, 0, ARENA.halfL],
    [0.14, ARENA.halfL * 2 + 1.2, -ARENA.halfW, 0],
    [0.14, ARENA.halfL * 2 + 1.2, ARENA.halfW, 0],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, h), borderMat);
    bar.position.set(x, 0.02, z);
    scene.add(bar);
  }

  const wallTex = createWallTexture(renderer);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x070e1e, metalness: 0.55, roughness: 0.5 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false });
  const trimBlue = new THREE.MeshBasicMaterial({ color: TEAM.blue.color });
  const trimRed = new THREE.MeshBasicMaterial({ color: TEAM.red.color });

  const addWallRun = (x, z, width, rotY, accent) => {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(width, 4.4, 0.8), wallMat);
    lower.position.set(x, 2.2, z);
    lower.rotation.y = rotY;
    lower.receiveShadow = true;
    scene.add(lower);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, 10.4), glassMat);
    glass.position.set(x, 9.8, z);
    glass.rotation.y = rotY;
    scene.add(glass);

    const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, 1.1), darkMat);
    top.position.set(x, 15.2, z);
    top.rotation.y = rotY;
    scene.add(top);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, 0.2), accent);
    strip.position.set(x, 4.62, z);
    strip.rotation.y = rotY;
    strip.translateZ(0.45);
    scene.add(strip);

    // vertical mullions
    const count = Math.max(2, Math.round(width / 13));
    for (let i = 0; i <= count; i++) {
      const t = -width / 2 + (i / count) * width;
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.35, 10.4, 0.35), darkMat);
      mullion.position.set(x, 9.8, z);
      mullion.rotation.y = rotY;
      mullion.translateX(t);
      scene.add(mullion);
    }
  };

  // long walls, split into team-colored halves
  for (const sz of [-1, 1]) {
    const accent = sz > 0 ? trimBlue : trimRed;
    addWallRun(-ARENA.halfW, sz * ARENA.halfL / 2, ARENA.halfL, Math.PI / 2, accent);
    addWallRun(ARENA.halfW, sz * ARENA.halfL / 2, ARENA.halfL, Math.PI / 2, accent);
  }

  // end walls split around the goal mouth
  const endSegmentW = ARENA.halfW - ARENA.goalHalfW;
  for (const sz of [-1, 1]) {
    const z = sz * ARENA.halfL;
    const accent = sz > 0 ? trimBlue : trimRed;
    for (const sx of [-1, 1]) {
      const x = sx * (ARENA.goalHalfW + endSegmentW / 2);
      addWallRun(x, z, endSegmentW, 0, accent);
    }
    // above the goal
    const upper = new THREE.Mesh(new THREE.BoxGeometry(ARENA.goalHalfW * 2, ARENA.wallH - ARENA.goalH, 0.8), wallMat);
    upper.position.set(0, ARENA.goalH + (ARENA.wallH - ARENA.goalH) / 2, z);
    scene.add(upper);
    const upperGlass = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.goalHalfW * 2, ARENA.wallH - ARENA.goalH - 1), glassMat);
    upperGlass.position.set(0, ARENA.goalH + (ARENA.wallH - ARENA.goalH) / 2, z);
    scene.add(upperGlass);
  }

  // corner pylons
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(2.2, 16.5, 2.2), darkMat);
      pylon.position.set(sx * (ARENA.halfW - 0.4), 8.25, sz * (ARENA.halfL - 0.4));
      scene.add(pylon);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.2, 2.35), sz > 0 ? trimBlue : trimRed);
      strip.position.set(sx * (ARENA.halfW - 0.4), 4.6, sz * (ARENA.halfL - 0.4));
      scene.add(strip);
    }
  }

  const netTex = createNetTexture(renderer);
  buildGoals(scene, renderer, netTex, TEAM.blue);
  buildGoals(scene, renderer, netTex, TEAM.red);

  const stands = buildStands(scene, renderer);
  const beams = buildFloodlights(scene, renderer);
  const jumbotron = buildJumbotron(scene, renderer);
  const pads = buildPads(scene);

  // floating dust
  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSpeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = rand(-ARENA.halfW, ARENA.halfW);
    dustPos[i * 3 + 1] = rand(0.5, 18);
    dustPos[i * 3 + 2] = rand(-ARENA.halfL, ARENA.halfL);
    dustSpeed[i] = rand(0.2, 0.9);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0x9fe8ff, size: 0.13, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(dust);

  let crowdFrame = 0;
  let jumboTimer = 0;

  const world = {
    pads,
    jumbotron,
    key,
    crowd: stands.crowd,
    update(dt, time) {
      // pads
      for (const pad of pads) {
        if (!pad.active) {
          pad.timer -= dt;
          if (pad.timer <= 0) {
            pad.active = true;
            pad.disc.visible = true;
            pad.icon.visible = true;
            if (pad.beam) pad.beam.visible = true;
            pad.ring.material.opacity = 0.85;
          }
        } else {
          const pulse = 0.5 + Math.sin(time * 3 + pad.pos.x) * 0.5;
          pad.disc.material.emissiveIntensity = 1.1 + pulse * 0.9;
          pad.disc.rotation.y = time * 1.2;
          pad.ring.material.opacity = 0.6 + pulse * 0.3;
          if (pad.beam) pad.beam.material.opacity = 0.05 + pulse * 0.07;
          pad.group.position.y = 0.03 + pulse * 0.05;
        }
      }

      // crowd bob at a lower update rate
      crowdFrame++;
      if (crowdFrame % 3 === 0) {
        for (let i = 0; i < stands.total; i++) {
          const s = stands.seats[i % stands.seats.length];
          _dummy.position.set(s.x, s.y + Math.sin(time * 2.2 + s.phase) * 0.11, s.z);
          _dummy.rotation.set(0, Math.sin(time * 0.4 + s.phase) * 0.25, 0);
          _dummy.scale.setScalar(0.92);
          _dummy.updateMatrix();
          stands.crowd.setMatrixAt(i, _dummy.matrix);
        }
        stands.crowd.instanceMatrix.needsUpdate = true;
      }

      // dust drift
      const pos = dust.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        pos.array[i * 3 + 1] += dustSpeed[i] * dt;
        if (pos.array[i * 3 + 1] > 19) {
          pos.array[i * 3 + 1] = 0.4;
          pos.array[i * 3] = rand(-ARENA.halfW, ARENA.halfW);
          pos.array[i * 3 + 2] = rand(-ARENA.halfL, ARENA.halfL);
        }
      }
      pos.needsUpdate = true;

      for (const beam of beams) beam.material.opacity = 0.024 + Math.sin(time * 0.7) * 0.006;
    },
    setScore(blue, red, time, label) {
      jumboTimer += 1;
      jumbotron.set(blue, red, time, label);
    },
  };

  return world;
}
