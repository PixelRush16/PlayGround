import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const LANE_X = [-2.4, 0, 2.4];

const MAT = {
  jacket: new THREE.MeshStandardMaterial({ color: 0xff5e36, roughness: 0.7 }),
  jacketDark: new THREE.MeshStandardMaterial({ color: 0xd94420, roughness: 0.72 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xffe6c7, roughness: 0.72 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x1c2b49, roughness: 0.78 }),
  pantsLight: new THREE.MeshStandardMaterial({ color: 0x263b61, roughness: 0.76 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xc9865b, roughness: 0.68 }),
  skinDark: new THREE.MeshStandardMaterial({ color: 0x9f6442, roughness: 0.7 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x241b1a, roughness: 0.9 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x28bda3, roughness: 0.63 }),
  tealDark: new THREE.MeshStandardMaterial({ color: 0x158a78, roughness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc53d, roughness: 0.48, metalness: 0.06 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111a2a, roughness: 0.55 }),
  white: new THREE.MeshStandardMaterial({ color: 0xfffbef, roughness: 0.5 }),
  sole: new THREE.MeshStandardMaterial({ color: 0xfff1dc, roughness: 0.45 }),
  soleAccent: new THREE.MeshStandardMaterial({ color: 0xff6a3b, roughness: 0.6 }),
};

function capsule(radius, length, material, segments = 8) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, segments), material);
  mesh.castShadow = true;
  return mesh;
}

function box(width, height, depth, material, radius = 0.055) {
  const geometry =
    radius > 0
      ? new RoundedBoxGeometry(width, height, depth, 3, radius)
      : new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.visual = new THREE.Group();
    this.root.add(this.visual);
    scene.add(this.root);

    this.lane = 1;
    this.targetLane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.jumpHeld = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.slideQueued = false;
    this.runPhase = 0;
    this.grounded = true;
    this.dead = false;
    this.deadTime = 0;
    this.laneVelocity = 0;

    this.buildCharacter();
    this.buildShadow();
    this.root.position.set(0, 0, 0);
  }

  buildCharacter() {
    const v = this.visual;

    // Hips and a little sag of the pants.
    const hips = box(0.63, 0.32, 0.43, MAT.pants, 0.12);
    hips.position.y = 0.99;
    v.add(hips);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.47, 18, 14), MAT.jacket);
    torso.scale.set(1.02, 1.28, 0.77);
    torso.position.y = 1.46;
    torso.castShadow = true;
    v.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), MAT.jacket);
    belly.scale.set(1.02, 0.86, 0.86);
    belly.position.set(0, 1.24, -0.03);
    belly.castShadow = true;
    v.add(belly);

    // Zipper and drawstrings.
    const zipper = box(0.035, 0.75, 0.025, MAT.jacketDark, 0.01);
    zipper.position.set(0, 1.46, -0.368);
    zipper.rotation.x = 0.05;
    v.add(zipper);
    for (const side of [-1, 1]) {
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 5), MAT.cream);
      string.position.set(side * 0.1, 1.71, -0.34);
      string.rotation.z = side * 0.18;
      v.add(string);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), MAT.gold);
      tip.position.set(side * 0.123, 1.59, -0.34);
      v.add(tip);
    }

    // Hood bunched behind the neck.
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.1, 8, 18, Math.PI), MAT.jacketDark);
    hood.position.set(0, 1.76, 0.2);
    hood.rotation.x = 1.18;
    hood.rotation.z = Math.PI;
    hood.castShadow = true;
    v.add(hood);
    const hoodInner = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 7, 16, Math.PI), MAT.cream);
    hoodInner.position.set(0, 1.78, 0.14);
    hoodInner.rotation.x = 1.18;
    hoodInner.rotation.z = Math.PI;
    v.add(hoodInner);

    // Head.
    const head = new THREE.Group();
    head.position.y = 2.02;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.275, 18, 14), MAT.skin);
    face.scale.set(0.94, 1.05, 0.96);
    face.castShadow = true;
    head.add(face);

    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), MAT.skinDark);
    earL.position.set(-0.26, -0.01, 0);
    earL.scale.set(0.55, 1, 0.8);
    head.add(earL);
    const earR = earL.clone();
    earR.position.x = 0.26;
    head.add(earR);

    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, MAT.black);
      eye.position.set(side * 0.093, 0.025, -0.252);
      eye.scale.set(0.85, 1.25, 0.45);
      head.add(eye);
    }
    const browGeo = new THREE.BoxGeometry(0.09, 0.018, 0.02);
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(browGeo, MAT.hair);
      brow.position.set(side * 0.095, 0.092, -0.26);
      brow.rotation.z = side * -0.12;
      head.add(brow);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), MAT.skinDark);
    nose.position.set(0, -0.02, -0.274);
    nose.scale.set(0.8, 0.7, 0.7);
    head.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 5, 10, Math.PI), MAT.skinDark);
    smile.position.set(0, -0.09, -0.263);
    smile.rotation.z = Math.PI;
    head.add(smile);

    // Beanie.
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.292, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.teal);
    beanie.position.y = 0.06;
    beanie.scale.set(1.02, 1.12, 1.02);
    beanie.castShadow = true;
    head.add(beanie);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.296, 0.296, 0.11, 18), MAT.tealDark);
    brim.position.y = 0.06;
    head.add(brim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), MAT.gold);
    pom.position.y = 0.39;
    head.add(pom);

    // Headphones: band and ear cups.
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 18, Math.PI), MAT.cream);
    band.position.y = 0.03;
    band.rotation.z = Math.PI;
    head.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.075, 10), MAT.cream);
      cup.position.set(side * 0.292, -0.01, 0);
      cup.rotation.z = Math.PI / 2;
      head.add(cup);
      const cupDark = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10), MAT.jacketDark);
      cupDark.position.set(side * 0.307, -0.01, 0);
      cupDark.rotation.z = Math.PI / 2;
      head.add(cupDark);
    }

    v.add(head);
    this.head = head;

    // Arms with pivots at the shoulders.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.47, 1.63, 0);
      arm.rotation.z = side * 0.17;
      const sleeve = capsule(0.115, 0.36, MAT.jacket, 7);
      sleeve.position.y = -0.21;
      arm.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.09, 8), MAT.cream);
      cuff.position.y = -0.46;
      arm.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 7), MAT.skin);
      hand.position.y = -0.55;
      hand.castShadow = true;
      arm.add(hand);
      v.add(arm);
      this.arms.push(arm);
    }

    // Legs with hip pivots.
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.19, 0.92, 0);
      const thigh = capsule(0.125, 0.3, MAT.pants, 7);
      thigh.position.y = -0.24;
      leg.add(thigh);
      const shin = capsule(0.102, 0.3, MAT.pantsLight, 7);
      shin.position.y = -0.55;
      leg.add(shin);
      const shoe = box(0.25, 0.16, 0.43, MAT.sole, 0.07);
      shoe.position.set(0, -0.78, -0.1);
      leg.add(shoe);
      const toe = box(0.23, 0.08, 0.15, MAT.soleAccent, 0.04);
      toe.position.set(0, -0.82, -0.33);
      leg.add(toe);
      v.add(leg);
      this.legs.push(leg);
    }

    // Backpack — the hero detail from the default chase camera.
    const pack = new THREE.Group();
    pack.position.set(0, 1.35, 0.46);
    const packBody = box(0.56, 0.7, 0.28, MAT.teal, 0.12);
    pack.add(packBody);
    const packFlap = box(0.5, 0.26, 0.31, MAT.tealDark, 0.07);
    packFlap.position.set(0, 0.24, 0.01);
    pack.add(packFlap);
    const packPocket = box(0.34, 0.27, 0.08, MAT.cream, 0.04);
    packPocket.position.set(0, -0.16, 0.17);
    pack.add(packPocket);
    const packPatch = new THREE.Mesh(new THREE.CircleGeometry(0.085, 12), MAT.gold);
    packPatch.position.set(0.16, 0.04, 0.173);
    pack.add(packPatch);
    const packPatchStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.01), MAT.jacketDark);
    packPatchStripe.position.set(0.16, 0.04, 0.181);
    pack.add(packPatchStripe);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 5, 10, Math.PI), MAT.cream);
    handle.position.set(0, 0.39, 0.02);
    pack.add(handle);
    for (const side of [-1, 1]) {
      const strap = box(0.08, 0.72, 0.075, MAT.gold, 0.03);
      strap.position.set(side * 0.29, 0.03, -0.32);
      strap.rotation.x = -0.1;
      pack.add(strap);
    }
    v.add(pack);
    this.backpack = pack;
  }

  buildShadow() {
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.27, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.018;
    this.shadow.renderOrder = 2;
    this.scene.add(this.shadow);
  }

  reset() {
    this.lane = 1;
    this.targetLane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.sliding = false;
    this.slideTimer = 0;
    this.slideQueued = false;
    this.grounded = true;
    this.dead = false;
    this.deadTime = 0;
    this.runPhase = 0;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
    this.shadow.visible = true;
    this.shadow.scale.setScalar(1);
    this.shadow.material.opacity = 0.27;
  }

  moveLeft() {
    if (this.dead) return false;
    if (this.targetLane > 0) {
      this.targetLane -= 1;
      this.lane = this.targetLane;
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.dead) return false;
    if (this.targetLane < 2) {
      this.targetLane += 1;
      this.lane = this.targetLane;
      return true;
    }
    return false;
  }

  jump() {
    if (this.dead) return false;
    if (this.grounded) {
      this.vy = 8.6;
      this.grounded = false;
      this.sliding = false;
      this.slideTimer = 0;
      return true;
    }
    return false;
  }

  slide() {
    if (this.dead) return false;
    if (!this.grounded) {
      this.vy = Math.min(this.vy, -18);
      this.slideQueued = true;
      return true;
    }
    if (!this.sliding) {
      this.sliding = true;
      this.slideTimer = 0.68;
      return true;
    }
    this.slideTimer = Math.max(this.slideTimer, 0.45);
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deadTime = 0;
    this.sliding = false;
    this.slideTimer = 0;
    this.vy = 3.4;
    this.grounded = false;
  }

  update(dt, speed, { menu = false } = {}) {
    const targetX = LANE_X[this.targetLane];
    const previousX = this.x;
    const lambda = this.dead ? 4 : 15;
    this.x = THREE.MathUtils.damp(this.x, targetX, lambda, dt);
    this.laneVelocity = (this.x - previousX) / Math.max(dt, 0.001);

    if (!this.dead) {
      this.vy -= 24 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        if (!this.grounded) {
          this.grounded = true;
          if (this.slideQueued) {
            this.slideQueued = false;
            this.sliding = true;
            this.slideTimer = 0.5;
          }
        }
        this.vy = 0;
      } else {
        this.grounded = false;
      }

      if (this.sliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) this.sliding = false;
      }
    } else {
      this.deadTime += dt;
      this.vy -= 18 * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
    }

    this.runPhase += dt * (menu ? 6.4 : 8.5 + speed * 0.24);
    this.root.position.x = this.x;
    this.root.position.y = this.y;

    const run = Math.sin(this.runPhase);
    const runAlt = Math.sin(this.runPhase + Math.PI);
    const bob = this.grounded && !this.sliding ? Math.abs(Math.sin(this.runPhase)) * 0.035 : 0;

    this.visual.position.y = bob;
    this.visual.position.z = 0;
    this.visual.rotation.set(0, 0, 0);
    this.visual.scale.set(1, 1, 1);

    if (this.dead) {
      const fall = Math.min(this.deadTime / 0.8, 1);
      this.visual.rotation.x = -fall * 1.4;
      this.visual.rotation.z = fall * 0.7;
      this.visual.rotation.y = this.deadTime * 1.3;
      this.visual.position.y = 0.12 - fall * 0.05;
      this.arms[0].rotation.x = -1.1 - fall * 1.5;
      this.arms[1].rotation.x = 0.7 + fall * 1.6;
      this.arms[0].rotation.z = -0.6;
      this.arms[1].rotation.z = 0.6;
      this.legs[0].rotation.x = -0.9 * fall;
      this.legs[1].rotation.x = 0.8 * fall;
      this.head.rotation.z = fall * 0.25;
    } else if (this.sliding) {
      const t = Math.min(1, (0.68 - this.slideTimer) / 0.12);
      this.visual.rotation.x = -1.33 * t;
      this.visual.position.y = 0.54 * t;
      this.visual.position.z = 0.26 * t;
      this.legs[0].rotation.x = -0.4;
      this.legs[1].rotation.x = 0.25;
      this.arms[0].rotation.x = -0.55;
      this.arms[1].rotation.x = -0.2;
      this.arms[0].rotation.z = -0.42;
      this.arms[1].rotation.z = 0.42;
      this.head.rotation.x = 0.36;
    } else if (!this.grounded) {
      this.visual.position.y += 0.02;
      this.legs[0].rotation.x = -0.68 + run * 0.1;
      this.legs[1].rotation.x = 0.55 - run * 0.1;
      this.arms[0].rotation.x = -1.8 + run * 0.08;
      this.arms[1].rotation.x = -1.8 - run * 0.08;
      this.arms[0].rotation.z = -0.42;
      this.arms[1].rotation.z = 0.42;
      this.head.rotation.x = -0.08;
    } else {
      this.legs[0].rotation.x = run * 0.82;
      this.legs[1].rotation.x = runAlt * 0.82;
      this.arms[0].rotation.x = runAlt * 0.78;
      this.arms[1].rotation.x = run * 0.78;
      this.arms[0].rotation.z = -0.17;
      this.arms[1].rotation.z = 0.17;
      this.head.rotation.x = 0;
      this.head.rotation.z = Math.sin(this.runPhase * 0.5) * 0.03;
    }

    const laneOffset = this.x / 2.4;
    this.visual.rotation.z += laneOffset * 0.13;
    this.visual.rotation.y += -this.laneVelocity * 0.008;
    if (!this.dead) {
      this.backpack.rotation.z = Math.sin(this.runPhase * 0.5) * 0.02 - laneOffset * 0.035;
    }

    this.shadow.position.x = this.x;
    const shadowScale = THREE.MathUtils.clamp(1 - this.y * 0.16, 0.62, 1);
    this.shadow.scale.setScalar(shadowScale);
    this.shadow.material.opacity = 0.27 * shadowScale;
    this.shadow.position.z = 0;
  }
}
