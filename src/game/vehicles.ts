import * as THREE from "three";
import { BRAND } from "./tuning";

const shared: Record<string, THREE.Material> = {};

function mat(key: string, params: THREE.MeshStandardMaterialParameters) {
  if (!shared[key]) shared[key] = new THREE.MeshStandardMaterial(params);
  return shared[key];
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  return new THREE.Mesh(geometry, material);
}

function paintMat(color: number, extraEmissive = 0.22) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.72,
    roughness: 0.18,
    emissive: color,
    emissiveIntensity: extraEmissive,
  });
}

const carbon = () => mat("carbon", { color: 0x12161c, metalness: 0.55, roughness: 0.38 });
const rubber = () => mat("rubber", { color: 0x0c0c0e, roughness: 0.92, metalness: 0.08 });
const rimMat = () => mat("rim", { color: 0xc5cdd6, metalness: 0.88, roughness: 0.22 });
const glass = () => mat("glass", { color: 0x071018, metalness: 0.9, roughness: 0.08 });

function makeWheel(front: boolean) {
  const group = new THREE.Group();
  const radius = front ? 0.3 : 0.34;
  const width = front ? 0.3 : 0.38;
  const tire = mesh(new THREE.CylinderGeometry(radius, radius, width, 18), rubber());
  tire.rotation.z = Math.PI / 2;
  const rim = mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width * 0.55, 14), rimMat());
  rim.rotation.z = Math.PI / 2;
  const hub = mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width * 0.7, 10),
    mat("hub", { color: 0x889199, metalness: 0.85, roughness: 0.2 }),
  );
  hub.rotation.z = Math.PI / 2;
  const stripe = mesh(
    new THREE.TorusGeometry(radius * 0.97, 0.012, 6, 20),
    mat("tyreStripe", { color: 0x2a3038, roughness: 0.7 }),
  );
  stripe.rotation.y = Math.PI / 2;
  group.add(tire, rim, hub, stripe);
  return group;
}

function placeWheel(parent: THREE.Group, x: number, y: number, z: number, front: boolean) {
  const wheel = makeWheel(front);
  wheel.position.set(x, y, z);
  parent.add(wheel);
  return wheel;
}

const yAxis = new THREE.Vector3(0, 1, 0);
const wishDir = new THREE.Vector3();

function wishbone(parent: THREE.Group, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  wishDir.set(bx - ax, by - ay, bz - az);
  const len = wishDir.length();
  const rod = mesh(
    new THREE.CylinderGeometry(0.018, 0.018, len, 5),
    mat("wishbone", { color: 0x1a222c, metalness: 0.6, roughness: 0.35 }),
  );
  rod.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  rod.quaternion.setFromUnitVectors(yAxis, wishDir.normalize());
  parent.add(rod);
}

export function createFormulaCar(body: number, accent: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "formula";

  const paint = paintMat(body, 0.26);
  const neon = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.85,
    metalness: 0.25,
    roughness: 0.28,
  });
  const dark = carbon();

  const floor = mesh(new THREE.BoxGeometry(1.28, 0.05, 3.35), dark);
  floor.position.set(0, 0.16, 0.05);
  group.add(floor);

  const plank = mesh(new THREE.BoxGeometry(0.32, 0.04, 2.2), mat("plank", { color: 0x8a6a18, roughness: 0.7, metalness: 0.2 }));
  plank.position.set(0, 0.12, 0.2);
  group.add(plank);

  const tub = mesh(new THREE.BoxGeometry(0.72, 0.34, 1.72), paint);
  tub.position.set(0, 0.42, 0.18);
  group.add(tub);

  const nose = mesh(new THREE.CylinderGeometry(0.055, 0.2, 1.55, 10), paint);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.34, 1.62);
  group.add(nose);

  const tip = mesh(new THREE.BoxGeometry(0.14, 0.08, 0.42), dark);
  tip.position.set(0, 0.3, 2.42);
  group.add(tip);

  for (const x of [-0.56, 0.56]) {
    const pod = mesh(new THREE.BoxGeometry(0.46, 0.28, 1.55), paint);
    pod.position.set(x, 0.38, -0.12);
    group.add(pod);
    const inlet = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.18), dark);
    inlet.position.set(x, 0.48, 0.62);
    group.add(inlet);
  }

  const cover = mesh(new THREE.BoxGeometry(0.42, 0.22, 1.05), paint);
  cover.position.set(0, 0.62, -0.42);
  group.add(cover);

  const airbox = mesh(new THREE.BoxGeometry(0.28, 0.26, 0.38), paint);
  airbox.position.set(0, 0.86, -0.28);
  group.add(airbox);
  const scoop = mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), dark);
  scoop.position.set(0, 1.02, -0.22);
  group.add(scoop);

  const cockpit = mesh(new THREE.BoxGeometry(0.5, 0.16, 0.62), dark);
  cockpit.position.set(0, 0.62, 0.28);
  group.add(cockpit);

  const visor = mesh(new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glass());
  visor.position.set(0, 0.74, 0.26);
  group.add(visor);

  const helmet = mesh(new THREE.SphereGeometry(0.14, 12, 10), neon);
  helmet.position.set(0, 0.7, 0.22);
  group.add(helmet);

  const halo = mesh(new THREE.TorusGeometry(0.3, 0.028, 8, 18, Math.PI), dark);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 0.82, 0.38);
  group.add(halo);
  const stay = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), dark);
  stay.position.set(0, 0.9, 0.12);
  group.add(stay);

  const strip = mesh(new THREE.BoxGeometry(0.07, 0.035, 2.55), neon);
  strip.position.set(0, 0.6, 0.12);
  group.add(strip);

  const frontWing = mesh(new THREE.BoxGeometry(1.72, 0.035, 0.34), paint);
  frontWing.position.set(0, 0.2, 2.48);
  group.add(frontWing);
  const flap = mesh(new THREE.BoxGeometry(1.55, 0.028, 0.16), paint);
  flap.position.set(0, 0.26, 2.38);
  group.add(flap);
  for (const x of [-0.86, 0.86]) {
    const endplate = mesh(new THREE.BoxGeometry(0.05, 0.32, 0.42), dark);
    endplate.position.set(x, 0.28, 2.46);
    group.add(endplate);
  }

  const rearMain = mesh(new THREE.BoxGeometry(1.78, 0.055, 0.38), paint);
  rearMain.position.set(0, 1.08, -1.52);
  group.add(rearMain);
  const rearFlap = mesh(new THREE.BoxGeometry(1.62, 0.04, 0.2), neon);
  rearFlap.position.set(0, 1.16, -1.42);
  group.add(rearFlap);
  for (const x of [-0.9, 0.9]) {
    const endplate = mesh(new THREE.BoxGeometry(0.055, 0.52, 0.46), dark);
    endplate.position.set(x, 0.96, -1.5);
    group.add(endplate);
    const pylon = mesh(new THREE.BoxGeometry(0.045, 0.58, 0.08), dark);
    pylon.position.set(x * 0.22, 0.78, -1.38);
    group.add(pylon);
  }
  const beam = mesh(new THREE.BoxGeometry(1.35, 0.04, 0.14), dark);
  beam.position.set(0, 0.42, -1.55);
  group.add(beam);

  const diffuser = mesh(new THREE.BoxGeometry(1.2, 0.16, 0.28), dark);
  diffuser.position.set(0, 0.22, -1.62);
  group.add(diffuser);
  for (const x of [-0.35, 0, 0.35]) {
    const strake = mesh(new THREE.BoxGeometry(0.03, 0.14, 0.26), dark);
    strake.position.set(x, 0.22, -1.62);
    group.add(strake);
  }

  const rain = mesh(
    new THREE.BoxGeometry(0.14, 0.08, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 3.2 }),
  );
  rain.position.set(0, 0.7, -1.58);
  group.add(rain);

  const head = new THREE.MeshStandardMaterial({ color: 0xf5fbff, emissive: 0xffffff, emissiveIntensity: 3.4 });
  for (const x of [-0.16, 0.16]) {
    const lamp = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), head);
    lamp.position.set(x, 0.36, 2.18);
    group.add(lamp);
  }

  for (const x of [-0.42, 0.42]) {
    const mirror = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), dark);
    mirror.position.set(x, 0.72, 0.55);
    group.add(mirror);
  }

  placeWheel(group, -0.8, 0.3, 1.4, true);
  placeWheel(group, 0.8, 0.3, 1.4, true);
  placeWheel(group, -0.86, 0.34, -1.2, false);
  placeWheel(group, 0.86, 0.34, -1.2, false);

  wishbone(group, -0.36, 0.38, 1.15, -0.72, 0.3, 1.4);
  wishbone(group, 0.36, 0.38, 1.15, 0.72, 0.3, 1.4);
  wishbone(group, -0.38, 0.4, -0.85, -0.78, 0.34, -1.2);
  wishbone(group, 0.38, 0.4, -0.85, 0.78, 0.34, -1.2);

  group.traverse((obj) => {
    obj.castShadow = false;
    obj.receiveShadow = false;
  });
  return group;
}

export function createTrafficCar(kind: "gt" | "support" | "safety"): THREE.Group {
  if (kind === "support") return makeSupport();
  if (kind === "safety") return makeSafety();
  return makeGt();
}

function addTrafficWheels(group: THREE.Group, track = 0.78, wheelbase = 1.35) {
  placeWheel(group, -track, 0.28, wheelbase, true);
  placeWheel(group, track, 0.28, wheelbase, true);
  placeWheel(group, -track, 0.3, -wheelbase, false);
  placeWheel(group, track, 0.3, -wheelbase, false);
}

function makeGt() {
  const group = new THREE.Group();
  group.userData.kind = "gt";
  const body = paintMat(0x2c3544, 0.08);
  const accent = new THREE.MeshStandardMaterial({
    color: 0x6a7c94,
    emissive: 0x243044,
    emissiveIntensity: 0.4,
    metalness: 0.55,
    roughness: 0.3,
  });

  const hull = mesh(new THREE.BoxGeometry(1.78, 0.42, 4.15), body);
  hull.position.set(0, 0.52, 0);
  group.add(hull);
  const shoulder = mesh(new THREE.BoxGeometry(1.86, 0.16, 3.4), accent);
  shoulder.position.set(0, 0.68, -0.1);
  group.add(shoulder);
  const cabin = mesh(new THREE.BoxGeometry(1.35, 0.38, 1.55), glass());
  cabin.position.set(0, 0.92, -0.15);
  group.add(cabin);
  const spoiler = mesh(new THREE.BoxGeometry(1.7, 0.05, 0.28), body);
  spoiler.position.set(0, 0.95, -1.95);
  group.add(spoiler);
  for (const x of [-0.82, 0.82]) {
    const plate = mesh(new THREE.BoxGeometry(0.05, 0.18, 0.28), carbon());
    plate.position.set(x, 0.86, -1.95);
    group.add(plate);
  }

  const head = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0xaad8ff, emissiveIntensity: 2.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.8 });
  for (const x of [-0.55, 0.55]) {
    const lamp = mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), head);
    lamp.position.set(x, 0.5, 2.08);
    group.add(lamp);
    const rear = mesh(new THREE.BoxGeometry(0.46, 0.09, 0.05), tail);
    rear.position.set(x, 0.52, -2.08);
    group.add(rear);
  }
  addTrafficWheels(group, 0.82, 1.28);
  return group;
}

function makeSupport() {
  const group = new THREE.Group();
  group.userData.kind = "support";
  const body = paintMat(0x1c2836, 0.1);
  const hull = mesh(new THREE.BoxGeometry(1.88, 0.78, 4.25), body);
  hull.position.set(0, 0.72, 0);
  group.add(hull);
  const cabin = mesh(new THREE.BoxGeometry(1.7, 0.48, 1.2), glass());
  cabin.position.set(0, 1.22, 1.05);
  group.add(cabin);
  const roof = mesh(new THREE.BoxGeometry(1.82, 0.12, 2.4), body);
  roof.position.set(0, 1.18, -0.55);
  group.add(roof);
  const bar = mesh(
    new THREE.BoxGeometry(1.1, 0.1, 0.18),
    new THREE.MeshStandardMaterial({ color: BRAND.cyan, emissive: BRAND.cyan, emissiveIntensity: 2.1 }),
  );
  bar.position.set(0, 1.42, 0.2);
  group.add(bar);
  const stripe = mesh(
    new THREE.BoxGeometry(1.9, 0.12, 4.26),
    new THREE.MeshStandardMaterial({ color: BRAND.cyan, emissive: BRAND.cyan, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.4 }),
  );
  stripe.position.set(0, 0.72, 0);
  group.add(stripe);
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4 });
  for (const x of [-0.55, 0.55]) {
    const lamp = mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), head);
    lamp.position.set(x, 0.55, 2.14);
    group.add(lamp);
  }
  addTrafficWheels(group, 0.84, 1.32);
  return group;
}

function makeSafety() {
  const group = new THREE.Group();
  group.userData.kind = "safety";
  const body = paintMat(0xc9a227, 0.18);
  const hull = mesh(new THREE.BoxGeometry(1.82, 0.48, 4.2), body);
  hull.position.set(0, 0.54, 0);
  group.add(hull);
  const cabin = mesh(new THREE.BoxGeometry(1.42, 0.4, 1.7), glass());
  cabin.position.set(0, 0.94, -0.05);
  group.add(cabin);
  const hood = mesh(new THREE.BoxGeometry(1.7, 0.12, 1.15), body);
  hood.position.set(0, 0.72, 1.28);
  group.add(hood);
  const lightbar = mesh(
    new THREE.BoxGeometry(1.15, 0.12, 0.28),
    new THREE.MeshStandardMaterial({ color: BRAND.gold, emissive: BRAND.gold, emissiveIntensity: 2.4 }),
  );
  lightbar.position.set(0, 1.2, 0.05);
  group.add(lightbar);
  const belt = mesh(
    new THREE.BoxGeometry(1.84, 0.1, 4.22),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.2 }),
  );
  belt.position.set(0, 0.54, 0);
  group.add(belt);
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4cc, emissiveIntensity: 2.6 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff2233, emissiveIntensity: 1.6 });
  for (const x of [-0.52, 0.52]) {
    const lamp = mesh(new THREE.BoxGeometry(0.38, 0.1, 0.06), head);
    lamp.position.set(x, 0.5, 2.12);
    group.add(lamp);
    const rear = mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), tail);
    rear.position.set(x, 0.52, -2.12);
    group.add(rear);
  }
  addTrafficWheels(group, 0.8, 1.3);
  return group;
}

export function createLightPole(): THREE.Group {
  const group = new THREE.Group();
  const pole = mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 6.4, 8),
    mat("pole", { color: 0x1c2430, roughness: 0.7, metalness: 0.45 }),
  );
  pole.position.y = 3.2;
  const arm = mesh(new THREE.BoxGeometry(1.55, 0.07, 0.12), mat("poleArm", { color: 0x151c26, metalness: 0.5, roughness: 0.4 }));
  arm.position.set(-0.55, 6.28, 0);
  const lamp = mesh(
    new THREE.BoxGeometry(1.15, 0.1, 0.38),
    new THREE.MeshStandardMaterial({ color: BRAND.cyan, emissive: BRAND.cyan, emissiveIntensity: 2.2 }),
  );
  lamp.position.set(-0.85, 6.18, 0);
  const glow = mesh(
    new THREE.BoxGeometry(1.05, 0.04, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0xe8fbff,
      emissive: 0xe8fbff,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.85,
    }),
  );
  glow.position.set(-0.85, 6.1, 0);
  group.add(pole, arm, lamp, glow);
  return group;
}
