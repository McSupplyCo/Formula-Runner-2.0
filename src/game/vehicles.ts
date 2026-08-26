import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeCarbonTexture } from "./textures";

const shared: Record<string, THREE.Material> = {};
let carbonMap: THREE.CanvasTexture | null = null;

function mat(key: string, params: THREE.MeshStandardMaterialParameters) {
  if (!shared[key]) shared[key] = new THREE.MeshStandardMaterial(params);
  return shared[key];
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  return new THREE.Mesh(geometry, material);
}

function paint(color: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.58,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.25,
  });
}

function carbon() {
  if (!carbonMap) carbonMap = makeCarbonTexture();
  return mat("carbon", {
    map: carbonMap,
    color: 0x1a1e24,
    metalness: 0.7,
    roughness: 0.42,
    envMapIntensity: 0.7,
  });
}

function rubber() {
  return mat("rubber", { color: 0x0b0b0d, roughness: 0.94, metalness: 0.04, envMapIntensity: 0.15 });
}

function glass() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0c141c,
    metalness: 0.15,
    roughness: 0.08,
    envMapIntensity: 1.35,
    transparent: true,
    opacity: 0.82,
  });
}

function headlamp() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf4fbff,
    emissive: 0xfff6e0,
    emissiveIntensity: 1.35,
    roughness: 0.15,
    metalness: 0.2,
  });
}

function taillamp() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xff2a3a,
    emissive: 0xff1430,
    emissiveIntensity: 1.9,
    roughness: 0.28,
    metalness: 0.15,
  });
}

function contactShadow(width: number, length: number) {
  const shadow = mesh(
    new THREE.CircleGeometry(1, 20),
    mat("shadow", {
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  shadow.scale.set(width * 0.55, length * 0.52, 1);
  shadow.renderOrder = 1;
  shadow.userData.ground = true;
  shadow.userData.baseScaleY = length * 0.52;
  return shadow;
}

function makeWheel(front: boolean) {
  const group = new THREE.Group();
  const radius = front ? 0.31 : 0.35;
  const width = front ? 0.32 : 0.4;
  const tire = mesh(new THREE.CylinderGeometry(radius, radius, width, 28, 1, false), rubber());
  tire.rotation.z = Math.PI / 2;
  const rim = mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.42, 16),
    mat("rim", { color: 0xb8c0c8, metalness: 0.92, roughness: 0.18, envMapIntensity: 1.3 }),
  );
  rim.rotation.z = Math.PI / 2;
  const disc = mesh(
    new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, width * 0.18, 18),
    mat("disc", { color: 0x4a4540, metalness: 0.7, roughness: 0.35 }),
  );
  disc.rotation.z = Math.PI / 2;
  const hub = mesh(
    new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, width * 0.55, 10),
    mat("hub", { color: 0x9aa2aa, metalness: 0.88, roughness: 0.2 }),
  );
  hub.rotation.z = Math.PI / 2;
  group.add(tire, rim, disc, hub);
  group.userData.spin = true;
  group.userData.radius = radius;
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
    new THREE.CylinderGeometry(0.016, 0.016, len, 6),
    mat("wishbone", { color: 0x2a323c, metalness: 0.75, roughness: 0.32 }),
  );
  rod.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  rod.quaternion.setFromUnitVectors(yAxis, wishDir.normalize());
  parent.add(rod);
}

function addHeadlights(parent: THREE.Group, y: number, z: number, spread = 0.18) {
  for (const x of [-spread, spread]) {
    const light = new THREE.SpotLight(0xfff1d2, 4.8, 28, 0.4, 0.65, 1.7);
    light.position.set(x, y, z);
    light.target.position.set(x * 1.6, -0.55, z + 12);
    parent.add(light, light.target);
  }
}

export function createFormulaCar(body: number, accent: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "formula";

  const coat = paint(body);
  const neon = new THREE.MeshPhysicalMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.22,
    metalness: 0.4,
    roughness: 0.28,
    clearcoat: 0.45,
  });
  const dark = carbon();

  group.add(contactShadow(1.9, 4.1));

  const floor = mesh(new RoundedBoxGeometry(1.22, 0.05, 3.28, 2, 0.04), dark);
  floor.position.set(0, 0.15, 0.04);
  group.add(floor);

  const plank = mesh(new THREE.BoxGeometry(0.28, 0.03, 2.05), mat("plank", { color: 0x6a5420, roughness: 0.62, metalness: 0.25 }));
  plank.position.set(0, 0.115, 0.18);
  group.add(plank);

  const tub = mesh(new RoundedBoxGeometry(0.7, 0.32, 1.65, 3, 0.08), coat);
  tub.position.set(0, 0.4, 0.16);
  group.add(tub);

  const nosePts = [new THREE.Vector2(0.03, 0), new THREE.Vector2(0.09, 0.18), new THREE.Vector2(0.17, 0.7), new THREE.Vector2(0.2, 1.35), new THREE.Vector2(0.16, 1.62)];
  const nose = mesh(new THREE.LatheGeometry(nosePts, 14), coat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.33, 0.95);
  group.add(nose);

  const tip = mesh(new RoundedBoxGeometry(0.12, 0.07, 0.38, 2, 0.02), dark);
  tip.position.set(0, 0.29, 2.48);
  group.add(tip);

  for (const x of [-0.52, 0.52]) {
    const pod = mesh(new RoundedBoxGeometry(0.44, 0.24, 1.48, 3, 0.07), coat);
    pod.position.set(x, 0.34, -0.1);
    group.add(pod);
    const inlet = mesh(new RoundedBoxGeometry(0.2, 0.12, 0.16, 2, 0.03), dark);
    inlet.position.set(x, 0.44, 0.58);
    group.add(inlet);
  }

  const cover = mesh(new RoundedBoxGeometry(0.4, 0.2, 1.0, 2, 0.06), coat);
  cover.position.set(0, 0.58, -0.4);
  group.add(cover);

  const airbox = mesh(new RoundedBoxGeometry(0.26, 0.24, 0.36, 2, 0.05), coat);
  airbox.position.set(0, 0.82, -0.26);
  group.add(airbox);
  const scoop = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), dark);
  scoop.position.set(0, 0.96, -0.2);
  group.add(scoop);
  const team = mesh(new THREE.BoxGeometry(0.08, 0.05, 0.22), neon);
  team.position.set(0, 0.9, -0.08);
  group.add(team);

  const cockpit = mesh(new RoundedBoxGeometry(0.48, 0.14, 0.58, 2, 0.04), dark);
  cockpit.position.set(0, 0.58, 0.28);
  group.add(cockpit);

  const helmet = mesh(
    new THREE.SphereGeometry(0.13, 14, 12),
    mat("helmet", { color: 0xd4dae0, metalness: 0.42, roughness: 0.38, envMapIntensity: 0.9 }),
  );
  helmet.position.set(0, 0.68, 0.22);
  group.add(helmet);
  const visor = mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), glass());
  visor.position.set(0, 0.72, 0.26);
  group.add(visor);

  const halo = mesh(new THREE.TorusGeometry(0.29, 0.024, 8, 22, Math.PI), dark);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 0.8, 0.36);
  group.add(halo);
  const stay = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), dark);
  stay.position.set(0, 0.88, 0.12);
  group.add(stay);

  const strip = mesh(new THREE.BoxGeometry(0.05, 0.022, 2.4), dark);
  strip.position.set(0, 0.56, 0.1);
  group.add(strip);

  const frontWing = mesh(new THREE.BoxGeometry(1.78, 0.028, 0.32), coat);
  frontWing.position.set(0, 0.19, 2.5);
  frontWing.rotation.x = -0.12;
  group.add(frontWing);
  const flap = mesh(new THREE.BoxGeometry(1.58, 0.022, 0.14), coat);
  flap.position.set(0, 0.25, 2.4);
  flap.rotation.x = -0.22;
  group.add(flap);
  for (const x of [-0.88, 0.88]) {
    const endplate = mesh(new THREE.BoxGeometry(0.04, 0.3, 0.4), dark);
    endplate.position.set(x, 0.26, 2.48);
    group.add(endplate);
  }

  const rearMain = mesh(new THREE.BoxGeometry(1.72, 0.045, 0.34), coat);
  rearMain.position.set(0, 1.05, -1.5);
  rearMain.rotation.x = 0.08;
  group.add(rearMain);
  const rearFlap = mesh(new THREE.BoxGeometry(1.55, 0.032, 0.16), coat);
  rearFlap.position.set(0, 1.13, -1.4);
  group.add(rearFlap);
  for (const x of [-0.88, 0.88]) {
    const endplate = mesh(new THREE.BoxGeometry(0.045, 0.5, 0.42), dark);
    endplate.position.set(x, 0.94, -1.48);
    group.add(endplate);
  }
  const pylon = mesh(new THREE.BoxGeometry(0.22, 0.5, 0.06), dark);
  pylon.position.set(0, 0.74, -1.36);
  group.add(pylon);

  const diffuser = mesh(new RoundedBoxGeometry(1.15, 0.14, 0.26, 2, 0.03), dark);
  diffuser.position.set(0, 0.2, -1.6);
  group.add(diffuser);
  for (const x of [-0.32, 0, 0.32]) {
    const strake = mesh(new THREE.BoxGeometry(0.025, 0.12, 0.24), dark);
    strake.position.set(x, 0.2, -1.6);
    group.add(strake);
  }

  const rain = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), taillamp());
  rain.position.set(0, 0.66, -1.55);
  group.add(rain);

  for (const x of [-0.15, 0.15]) {
    const lamp = mesh(new THREE.BoxGeometry(0.09, 0.05, 0.05), headlamp());
    lamp.position.set(x, 0.34, 2.2);
    group.add(lamp);
  }
  addHeadlights(group, 0.34, 2.15, 0.16);

  for (const x of [-0.4, 0.4]) {
    const mirror = mesh(new RoundedBoxGeometry(0.1, 0.05, 0.07, 1, 0.015), dark);
    mirror.position.set(x, 0.7, 0.52);
    group.add(mirror);
  }

  placeWheel(group, -0.8, 0.31, 1.38, true);
  placeWheel(group, 0.8, 0.31, 1.38, true);
  placeWheel(group, -0.86, 0.35, -1.18, false);
  placeWheel(group, 0.86, 0.35, -1.18, false);

  wishbone(group, -0.34, 0.36, 1.12, -0.72, 0.31, 1.38);
  wishbone(group, 0.34, 0.36, 1.12, 0.72, 0.31, 1.38);
  wishbone(group, -0.36, 0.38, -0.82, -0.78, 0.35, -1.18);
  wishbone(group, 0.36, 0.38, -0.82, 0.78, 0.35, -1.18);

  return group;
}

function extrudeBody(points: Array<[number, number]>, width: number) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

function addBodywork(group: THREE.Group, cabinY: number, cabinZ: number) {
  const dark = carbon();
  for (const x of [-0.62, 0.62]) {
    const frontArch = mesh(new THREE.BoxGeometry(0.1, 0.16, 0.5), dark);
    frontArch.position.set(x, 0.36, 1.18);
    group.add(frontArch);
    const rearArch = mesh(new THREE.BoxGeometry(0.1, 0.16, 0.5), dark);
    rearArch.position.set(x, 0.38, -1.12);
    group.add(rearArch);
    const pillar = mesh(new THREE.BoxGeometry(0.045, 0.26, 0.08), dark);
    pillar.position.set(x * 0.7, cabinY, cabinZ + 0.52);
    group.add(pillar);
    const mirror = mesh(new RoundedBoxGeometry(0.1, 0.045, 0.07, 1, 0.012), dark);
    mirror.position.set(x, cabinY - 0.08, 0.48);
    group.add(mirror);
  }
  const grille = mesh(new THREE.BoxGeometry(0.92, 0.15, 0.05), dark);
  grille.position.set(0, 0.38, 2.0);
  group.add(grille);
  const under = mesh(new THREE.BoxGeometry(1.48, 0.05, 3.35), dark);
  under.position.set(0, 0.15, 0);
  group.add(under);
}

function addTrafficWheels(group: THREE.Group, track = 0.78, wheelbase = 1.32) {
  placeWheel(group, -track, 0.29, wheelbase, true);
  placeWheel(group, track, 0.29, wheelbase, true);
  placeWheel(group, -track, 0.31, -wheelbase, false);
  placeWheel(group, track, 0.31, -wheelbase, false);
}

export function createTrafficCar(kind: "gt" | "support" | "safety"): THREE.Group {
  if (kind === "support") return makeSupport();
  if (kind === "safety") return makeSafety();
  return makeGt();
}

function makeGt() {
  const group = new THREE.Group();
  group.userData.kind = "gt";
  const body = paint(0x2a3340);
  group.add(contactShadow(1.85, 4.2));
  const hull = mesh(
    extrudeBody(
      [
        [2.12, 0.12],
        [2.08, 0.4],
        [1.35, 0.52],
        [0.55, 0.55],
        [0.18, 1.05],
        [-0.7, 1.08],
        [-1.2, 0.7],
        [-2.05, 0.5],
        [-2.12, 0.18],
        [-2.12, 0.12],
      ],
      1.72,
    ),
    body,
  );
  group.add(hull);
  const cabin = mesh(new RoundedBoxGeometry(1.28, 0.32, 1.42, 2, 0.08), glass());
  cabin.position.set(0, 0.92, -0.12);
  group.add(cabin);
  addBodywork(group, 0.92, -0.12);
  const spoiler = mesh(new THREE.BoxGeometry(1.62, 0.04, 0.24), body);
  spoiler.position.set(0, 0.98, -1.92);
  group.add(spoiler);
  for (const x of [-0.55, 0.55]) {
    const lamp = mesh(new RoundedBoxGeometry(0.4, 0.08, 0.06, 1, 0.02), headlamp());
    lamp.position.set(x, 0.48, 2.05);
    group.add(lamp);
    const rear = mesh(new RoundedBoxGeometry(0.42, 0.08, 0.05, 1, 0.02), taillamp());
    rear.position.set(x, 0.5, -2.05);
    group.add(rear);
  }
  addTrafficWheels(group, 0.82, 1.28);
  return group;
}

function makeSupport() {
  const group = new THREE.Group();
  group.userData.kind = "support";
  const body = paint(0x1a2430);
  group.add(contactShadow(1.9, 4.25));
  const hull = mesh(
    extrudeBody(
      [
        [2.15, 0.12],
        [2.1, 0.48],
        [1.2, 0.72],
        [0.85, 1.22],
        [-0.2, 1.28],
        [-1.55, 1.18],
        [-2.1, 0.7],
        [-2.15, 0.18],
        [-2.15, 0.12],
      ],
      1.78,
    ),
    body,
  );
  group.add(hull);
  const cabin = mesh(new RoundedBoxGeometry(1.55, 0.38, 1.05, 2, 0.06), glass());
  cabin.position.set(0, 1.12, 0.85);
  group.add(cabin);
  addBodywork(group, 1.12, 0.85);
  const bar = mesh(
    new THREE.BoxGeometry(1.05, 0.08, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xffc56a, emissive: 0xffc56a, emissiveIntensity: 0.45 }),
  );
  bar.position.set(0, 1.38, 0.15);
  group.add(bar);
  for (const x of [-0.52, 0.52]) {
    const lamp = mesh(new RoundedBoxGeometry(0.38, 0.14, 0.07, 1, 0.02), headlamp());
    lamp.position.set(x, 0.52, 2.08);
    group.add(lamp);
  }
  addTrafficWheels(group, 0.84, 1.3);
  return group;
}

function makeSafety() {
  const group = new THREE.Group();
  group.userData.kind = "safety";
  const body = paint(0xc9a227);
  group.add(contactShadow(1.85, 4.2));
  const hull = mesh(
    extrudeBody(
      [
        [2.12, 0.12],
        [2.08, 0.42],
        [1.25, 0.55],
        [0.5, 0.58],
        [0.12, 1.02],
        [-0.75, 1.05],
        [-1.25, 0.68],
        [-2.08, 0.5],
        [-2.12, 0.18],
        [-2.12, 0.12],
      ],
      1.7,
    ),
    body,
  );
  group.add(hull);
  const cabin = mesh(new RoundedBoxGeometry(1.32, 0.34, 1.5, 2, 0.07), glass());
  cabin.position.set(0, 0.9, -0.08);
  group.add(cabin);
  addBodywork(group, 0.9, -0.08);
  const lightbar = mesh(
    new THREE.BoxGeometry(1.1, 0.1, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xd4a017, emissive: 0xd4a017, emissiveIntensity: 0.55 }),
  );
  lightbar.position.set(0, 1.16, 0.02);
  group.add(lightbar);
  for (const x of [-0.5, 0.5]) {
    const lamp = mesh(new RoundedBoxGeometry(0.36, 0.09, 0.06, 1, 0.02), headlamp());
    lamp.position.set(x, 0.48, 2.06);
    group.add(lamp);
    const rear = mesh(new RoundedBoxGeometry(0.38, 0.09, 0.05, 1, 0.02), taillamp());
    rear.position.set(x, 0.5, -2.06);
    group.add(rear);
  }
  addTrafficWheels(group, 0.8, 1.28);
  return group;
}

export function createLightPole(): THREE.Group {
  const group = new THREE.Group();
  const pole = mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 6.5, 10),
    mat("pole", { color: 0x2a323c, roughness: 0.55, metalness: 0.55, envMapIntensity: 0.6 }),
  );
  pole.position.y = 3.25;
  const arm = mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8),
    mat("poleArm", { color: 0x1c242e, metalness: 0.6, roughness: 0.4 }),
  );
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-0.55, 6.32, 0);
  const housing = mesh(
    new RoundedBoxGeometry(0.95, 0.12, 0.32, 1, 0.04),
    mat("lampHouse", { color: 0x1a2028, metalness: 0.5, roughness: 0.4 }),
  );
  housing.position.set(-0.95, 6.22, 0);
  const glow = mesh(
    new THREE.BoxGeometry(0.82, 0.03, 0.24),
    new THREE.MeshStandardMaterial({
      color: 0xfff0d4,
      emissive: 0xffe6b8,
      emissiveIntensity: 1.15,
    }),
  );
  glow.position.set(-0.95, 6.14, 0);
  const pool = mesh(
    new THREE.CircleGeometry(2.6, 14),
    mat("lampPool", {
      color: 0xffe4bc,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-1.15, 0.03, 0.6);
  group.add(pole, arm, housing, glow, pool);
  return group;
}

export function createTree(): THREE.Group {
  const group = new THREE.Group();
  const bark = mat("trunk", { color: 0x2a2218, roughness: 0.92, metalness: 0.05 });
    const leaf = mat("foliage", { color: 0x2c3d32, roughness: 0.9, metalness: 0.02 });
  const trunk = mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.15, 6), bark);
  trunk.position.y = 0.55;
  const crown = mesh(new THREE.IcosahedronGeometry(0.62, 0), leaf);
  crown.position.set(0, 1.85, 0);
  crown.scale.set(1.05, 1.35, 1.05);
  const lower = mesh(new THREE.IcosahedronGeometry(0.48, 0), leaf);
  lower.position.set(0.18, 1.42, -0.08);
  lower.scale.set(1.15, 0.9, 1.1);
  group.add(trunk, crown, lower);
  return group;
}
