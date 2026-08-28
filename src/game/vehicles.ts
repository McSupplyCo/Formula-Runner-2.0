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

function paint(color: number, roughness = 0.26) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.22,
    roughness,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.2,
  });
}

function darkerBody(color: number) {
  const next = new THREE.Color(color);
  next.multiplyScalar(0.68);
  return next.getHex();
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

function rim() {
  return mat("rim", { color: 0xb8c0c8, metalness: 0.92, roughness: 0.18, envMapIntensity: 1.3 });
}

function disc() {
  return mat("disc", { color: 0x4a4540, metalness: 0.7, roughness: 0.35 });
}

function hub() {
  return mat("hub", { color: 0x9aa2aa, metalness: 0.88, roughness: 0.2 });
}

function spoke() {
  return mat("spoke", { color: 0xa8b0b8, metalness: 0.9, roughness: 0.2, envMapIntensity: 1.2 });
}

function caliper() {
  return mat("caliper", { color: 0x6e1c18, metalness: 0.58, roughness: 0.36, envMapIntensity: 0.85 });
}

function wishboneMat() {
  return mat("wishbone", { color: 0x2a323c, metalness: 0.75, roughness: 0.32 });
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
  return mat("headlamp", {
    color: 0xf4fbff,
    emissive: 0xfff6e0,
    emissiveIntensity: 1.35,
    roughness: 0.15,
    metalness: 0.2,
  });
}

function taillamp() {
  return mat("taillamp", {
    color: 0xff2a3a,
    emissive: 0xff1430,
    emissiveIntensity: 1.9,
    roughness: 0.28,
    metalness: 0.15,
  });
}

function accentCoat(color: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.22,
    metalness: 0.4,
    roughness: 0.28,
    clearcoat: 0.45,
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
  const rimBarrel = mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.42, 16),
    rim(),
  );
  rimBarrel.rotation.z = Math.PI / 2;
  const lip = mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, width * 0.08, 18),
    rim(),
  );
  lip.rotation.z = Math.PI / 2;
  const brake = mesh(
    new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, width * 0.18, 18),
    disc(),
  );
  brake.rotation.z = Math.PI / 2;
  const cap = mesh(new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, width * 0.55, 10), hub());
  cap.rotation.z = Math.PI / 2;
  group.add(tire, rimBarrel, lip, brake, cap);

  for (const x of [-width * 0.42, width * 0.42]) {
    const shoulder = mesh(new THREE.TorusGeometry(radius * 0.97, 0.026, 6, 18), rubber());
    shoulder.rotation.y = Math.PI / 2;
    shoulder.position.x = x;
    group.add(shoulder);
  }
  for (const x of [-width * 0.08, width * 0.08]) {
    const groove = mesh(new THREE.TorusGeometry(radius + 0.001, 0.01, 5, 20), rubber());
    groove.rotation.y = Math.PI / 2;
    groove.position.x = x;
    group.add(groove);
  }
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.x = (i / 5) * Math.PI * 2;
    const bar = mesh(new THREE.BoxGeometry(width * 0.06, radius * 0.42, 0.038), spoke());
    bar.position.y = radius * 0.28;
    arm.add(bar);
    group.add(arm);
  }

  group.userData.spin = true;
  group.userData.radius = radius;
  return group;
}

function placeWheel(parent: THREE.Group, x: number, y: number, z: number, front: boolean) {
  const mount = new THREE.Group();
  mount.position.set(x, y, z);
  const wheel = makeWheel(front);
  mount.add(wheel);
  const radius = front ? 0.31 : 0.35;
  const width = front ? 0.32 : 0.4;
  const clamp = mesh(new RoundedBoxGeometry(width * 0.2, 0.085, 0.11, 1, 0.012), caliper());
  clamp.position.set(x < 0 ? 0.055 : -0.055, radius * 0.22, 0.015);
  mount.add(clamp);
  parent.add(mount);
  return wheel;
}

const yAxis = new THREE.Vector3(0, 1, 0);
const wishDir = new THREE.Vector3();

function wishbone(parent: THREE.Group, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  wishDir.set(bx - ax, by - ay, bz - az);
  const len = wishDir.length();
  const rod = mesh(new THREE.CylinderGeometry(0.016, 0.016, len, 6), wishboneMat());
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

/**
 * body: tub, nose, floor-adjacent body, front/rear wing main planes.
 * secondary: sidepods, engine cover, rear wing flap (darker body if omitted).
 * accent: team strip, tiny details, endplate pinstripe — never tires, wishbones, or halo.
 */
export function createFormulaCar(body: number, accent: number, secondary?: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "formula";

  const coat = paint(body, 0.24);
  const pod = paint(secondary ?? darkerBody(body), 0.3);
  const neon = accentCoat(accent);
  const dark = carbon();

  group.add(contactShadow(1.9, 4.1));

  const floor = mesh(new RoundedBoxGeometry(1.22, 0.05, 3.28, 2, 0.04), dark);
  floor.position.set(0, 0.15, 0.04);
  group.add(floor);
  const edgeL = mesh(new THREE.BoxGeometry(0.08, 0.04, 2.6), coat);
  edgeL.position.set(-0.62, 0.175, 0.08);
  const edgeR = mesh(new THREE.BoxGeometry(0.08, 0.04, 2.6), coat);
  edgeR.position.set(0.62, 0.175, 0.08);
  group.add(edgeL, edgeR);

  const plank = mesh(
    new THREE.BoxGeometry(0.28, 0.03, 2.05),
    mat("plank", { color: 0x6a5420, roughness: 0.62, metalness: 0.25 }),
  );
  plank.position.set(0, 0.115, 0.18);
  group.add(plank);

  const tub = mesh(new RoundedBoxGeometry(0.7, 0.32, 1.65, 3, 0.08), coat);
  tub.position.set(0, 0.4, 0.16);
  group.add(tub);

  const nosePts = [
    new THREE.Vector2(0.025, 0),
    new THREE.Vector2(0.05, 0.14),
    new THREE.Vector2(0.09, 0.42),
    new THREE.Vector2(0.15, 0.92),
    new THREE.Vector2(0.22, 1.42),
    new THREE.Vector2(0.2, 1.68),
  ];
  const nose = mesh(new THREE.LatheGeometry(nosePts, 16), coat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.33, 0.95);
  group.add(nose);

  const tip = mesh(new RoundedBoxGeometry(0.12, 0.07, 0.38, 2, 0.02), dark);
  tip.position.set(0, 0.29, 2.48);
  group.add(tip);
  const camera = mesh(new THREE.BoxGeometry(0.06, 0.045, 0.08), dark);
  camera.position.set(0, 0.36, 2.32);
  group.add(camera);
  const camStripe = mesh(new THREE.BoxGeometry(0.018, 0.012, 0.09), neon);
  camStripe.position.set(0, 0.385, 2.32);
  group.add(camStripe);

  for (const x of [-0.52, 0.52]) {
    const side = mesh(new RoundedBoxGeometry(0.44, 0.22, 1.48, 3, 0.07), pod);
    side.position.set(x, 0.35, -0.1);
    group.add(side);
    const undercut = mesh(new RoundedBoxGeometry(0.3, 0.1, 1.12, 2, 0.04), pod);
    undercut.position.set(x * 0.92, 0.24, -0.18);
    group.add(undercut);
    const inlet = mesh(new RoundedBoxGeometry(0.2, 0.12, 0.16, 2, 0.03), dark);
    inlet.position.set(x, 0.44, 0.58);
    group.add(inlet);
    const gill = mesh(new THREE.BoxGeometry(0.18, 0.03, 0.28), dark);
    gill.position.set(x * 1.12, 0.4, -0.35);
    group.add(gill);
    const barge = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.42), dark);
    barge.position.set(x * 0.72, 0.28, 0.82);
    group.add(barge);
  }

  const cover = mesh(new RoundedBoxGeometry(0.4, 0.2, 1.0, 2, 0.06), pod);
  cover.position.set(0, 0.58, -0.4);
  group.add(cover);
  const coke = mesh(new RoundedBoxGeometry(0.3, 0.16, 0.55, 2, 0.05), pod);
  coke.position.set(0, 0.52, -0.92);
  group.add(coke);

  const airbox = mesh(new RoundedBoxGeometry(0.26, 0.24, 0.36, 2, 0.05), pod);
  airbox.position.set(0, 0.82, -0.26);
  group.add(airbox);
  const scoop = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), dark);
  scoop.position.set(0, 0.96, -0.2);
  group.add(scoop);
  const tcam = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.12), dark);
  tcam.position.set(0, 1.02, -0.18);
  group.add(tcam);
  const tcamStripe = mesh(new THREE.BoxGeometry(0.02, 0.012, 0.13), neon);
  tcamStripe.position.set(0, 1.04, -0.18);
  group.add(tcamStripe);
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

  const strip = mesh(new THREE.BoxGeometry(0.05, 0.022, 2.4), neon);
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
  const flap2 = mesh(new THREE.BoxGeometry(1.42, 0.018, 0.1), coat);
  flap2.position.set(0, 0.3, 2.32);
  flap2.rotation.x = -0.3;
  group.add(flap2);
  const neutral = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), dark);
  neutral.position.set(0, 0.2, 2.5);
  group.add(neutral);
  for (const x of [-0.88, 0.88]) {
    const endplate = mesh(new THREE.BoxGeometry(0.04, 0.3, 0.4), dark);
    endplate.position.set(x, 0.26, 2.48);
    group.add(endplate);
    const foot = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.38), dark);
    foot.position.set(x, 0.12, 2.48);
    group.add(foot);
    const pin = mesh(new THREE.BoxGeometry(0.012, 0.22, 0.36), neon);
    pin.position.set(x + (x < 0 ? -0.028 : 0.028), 0.26, 2.48);
    group.add(pin);
  }

  const rearMain = mesh(new THREE.BoxGeometry(1.72, 0.045, 0.34), coat);
  rearMain.position.set(0, 1.05, -1.5);
  rearMain.rotation.x = 0.08;
  group.add(rearMain);
  const rearFlap = mesh(new THREE.BoxGeometry(1.55, 0.032, 0.16), pod);
  rearFlap.position.set(0, 1.13, -1.4);
  group.add(rearFlap);
  const drs = mesh(new THREE.BoxGeometry(0.14, 0.05, 0.08), dark);
  drs.position.set(0, 1.1, -1.44);
  group.add(drs);
  for (const x of [-0.88, 0.88]) {
    const endplate = mesh(new THREE.BoxGeometry(0.045, 0.5, 0.42), dark);
    endplate.position.set(x, 0.94, -1.48);
    group.add(endplate);
    const pin = mesh(new THREE.BoxGeometry(0.012, 0.36, 0.38), neon);
    pin.position.set(x + (x < 0 ? -0.03 : 0.03), 0.98, -1.48);
    group.add(pin);
  }
  const pylon = mesh(new THREE.BoxGeometry(0.22, 0.5, 0.06), dark);
  pylon.position.set(0, 0.74, -1.36);
  group.add(pylon);
  const beam = mesh(new THREE.BoxGeometry(1.35, 0.025, 0.12), dark);
  beam.position.set(0, 0.52, -1.52);
  group.add(beam);

  const diffuser = mesh(new RoundedBoxGeometry(1.15, 0.14, 0.26, 2, 0.03), dark);
  diffuser.position.set(0, 0.2, -1.6);
  group.add(diffuser);
  for (const x of [-0.32, 0, 0.32]) {
    const strake = mesh(new THREE.BoxGeometry(0.025, 0.12, 0.24), dark);
    strake.position.set(x, 0.2, -1.6);
    group.add(strake);
  }
  const exhaust = mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.12, 10),
    mat("exhaust", { color: 0x6a6e72, metalness: 0.92, roughness: 0.22 }),
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0.42, -1.58);
  group.add(exhaust);

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

  wishbone(group, -0.34, 0.32, 1.12, -0.72, 0.28, 1.38);
  wishbone(group, 0.34, 0.32, 1.12, 0.72, 0.28, 1.38);
  wishbone(group, -0.32, 0.48, 1.08, -0.7, 0.38, 1.38);
  wishbone(group, 0.32, 0.48, 1.08, 0.7, 0.38, 1.38);
  wishbone(group, -0.36, 0.34, -0.82, -0.78, 0.32, -1.18);
  wishbone(group, 0.36, 0.34, -0.82, 0.78, 0.32, -1.18);
  wishbone(group, -0.34, 0.5, -0.78, -0.76, 0.42, -1.18);
  wishbone(group, 0.34, 0.5, -0.78, 0.76, 0.42, -1.18);

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
    const skirt = mesh(new THREE.BoxGeometry(0.08, 0.06, 1.7), dark);
    skirt.position.set(x * 1.12, 0.2, 0.05);
    group.add(skirt);
  }
  const grille = mesh(new THREE.BoxGeometry(0.92, 0.15, 0.05), dark);
  grille.position.set(0, 0.38, 2.0);
  group.add(grille);
  const splitter = mesh(new THREE.BoxGeometry(1.55, 0.03, 0.22), dark);
  splitter.position.set(0, 0.16, 2.05);
  group.add(splitter);
  const under = mesh(new THREE.BoxGeometry(1.48, 0.05, 3.35), dark);
  under.position.set(0, 0.15, 0);
  group.add(under);
  const filler = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), dark);
  filler.position.set(0.42, 0.58, -0.55);
  group.add(filler);
}

function addTrafficWheels(group: THREE.Group, track = 0.78, wheelbase = 1.32) {
  placeWheel(group, -track, 0.29, wheelbase, true);
  placeWheel(group, track, 0.29, wheelbase, true);
  placeWheel(group, -track, 0.31, -wheelbase, false);
  placeWheel(group, track, 0.31, -wheelbase, false);
}

function addExhaustPair(group: THREE.Group, z = -2.02) {
  const metal = mat("exhaust", { color: 0x6a6e72, metalness: 0.92, roughness: 0.22 });
  for (const x of [-0.22, 0.22]) {
    const tip = mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.1, 8), metal);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, 0.28, z);
    group.add(tip);
  }
}

const GT_PAINT = [0x1a222c, 0x2a1618, 0x152018, 0x3a3e46, 0xc5cad1, 0x1a2436, 0x2a2418, 0x241c28];
const GT_STRIPE = [0x8a929a, 0x8a6a3a, 0x6a8a78, 0x1a1c20, 0x2a3038, 0xb89640, 0x5a4030, 0x7a6878];
const SUPPORT_PAINT = [0x1a222c, 0x22282e, 0x161c24];
const SAFETY_PAINT = [0xc9a227, 0xd4b03a, 0xb89220];
let gtTint = 0;
let supportTint = 0;
let safetyTint = 0;

export function createTrafficCar(kind: "gt" | "support" | "safety"): THREE.Group {
  if (kind === "support") return makeSupport();
  if (kind === "safety") return makeSafety();
  return makeGt();
}

function makeGt() {
  const group = new THREE.Group();
  group.userData.kind = "gt";
  const index = gtTint++ % GT_PAINT.length;
  const body = paint(GT_PAINT[index] ?? 0x1a222c, 0.32);
  const stripe = paint(GT_STRIPE[index] ?? 0x8a929a, 0.4);
  group.add(contactShadow(1.85, 4.2));
  const hull = mesh(
    extrudeBody(
      [
        [2.12, 0.12],
        [2.08, 0.38],
        [1.42, 0.5],
        [0.62, 0.52],
        [0.22, 1.02],
        [-0.72, 1.06],
        [-1.28, 0.68],
        [-2.08, 0.48],
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
  const belt = mesh(new THREE.BoxGeometry(1.68, 0.035, 0.08), stripe);
  belt.position.set(0, 0.55, 0.05);
  group.add(belt);
  addBodywork(group, 0.92, -0.12);
  for (const x of [-0.2, 0.2]) {
    const vent = mesh(new THREE.BoxGeometry(0.16, 0.02, 0.26), carbon());
    vent.position.set(x, 0.51, 1.12);
    group.add(vent);
  }
  const spoiler = mesh(new THREE.BoxGeometry(1.62, 0.04, 0.24), body);
  spoiler.position.set(0, 0.98, -1.92);
  group.add(spoiler);
  for (const x of [-0.8, 0.8]) {
    const plate = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.26), carbon());
    plate.position.set(x, 0.92, -1.92);
    group.add(plate);
  }
  for (const x of [-0.55, 0.55]) {
    const lamp = mesh(new RoundedBoxGeometry(0.4, 0.08, 0.06, 1, 0.02), headlamp());
    lamp.position.set(x, 0.48, 2.05);
    group.add(lamp);
    const rear = mesh(new RoundedBoxGeometry(0.42, 0.08, 0.05, 1, 0.02), taillamp());
    rear.position.set(x, 0.5, -2.05);
    group.add(rear);
  }
  addExhaustPair(group);
  addTrafficWheels(group, 0.82, 1.28);
  return group;
}

function makeSupport() {
  const group = new THREE.Group();
  group.userData.kind = "support";
  const body = paint(SUPPORT_PAINT[supportTint++ % SUPPORT_PAINT.length] ?? 0x1a222c, 0.38);
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
  const vis = paint(0xc4a24a, 0.45);
  const stripe = mesh(new THREE.BoxGeometry(1.82, 0.06, 0.12), vis);
  stripe.position.set(0, 0.62, 0.1);
  group.add(stripe);
  for (let i = 0; i < 5; i++) {
    const chev = mesh(new THREE.BoxGeometry(0.7 - i * 0.08, 0.04, 0.06), vis);
    chev.position.set(0, 0.55, -1.55 - i * 0.08);
    group.add(chev);
  }
  const bar = mesh(
    new THREE.BoxGeometry(1.05, 0.08, 0.16),
    mat("supportBar", { color: 0xffc56a, emissive: 0xffc56a, emissiveIntensity: 0.45 }),
  );
  bar.position.set(0, 1.38, 0.15);
  group.add(bar);
  for (const x of [-0.52, 0.52]) {
    const lamp = mesh(new RoundedBoxGeometry(0.38, 0.14, 0.07, 1, 0.02), headlamp());
    lamp.position.set(x, 0.52, 2.08);
    group.add(lamp);
  }
  const rear = mesh(new RoundedBoxGeometry(0.9, 0.12, 0.05, 1, 0.02), taillamp());
  rear.position.set(0, 0.52, -2.1);
  group.add(rear);
  addTrafficWheels(group, 0.84, 1.3);
  return group;
}

function makeSafety() {
  const group = new THREE.Group();
  group.userData.kind = "safety";
  const body = paint(SAFETY_PAINT[safetyTint++ % SAFETY_PAINT.length] ?? 0xc9a227, 0.28);
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
  const roof = mesh(new THREE.BoxGeometry(1.2, 0.03, 1.35), carbon());
  roof.position.set(0, 1.08, -0.08);
  group.add(roof);
  const belt = mesh(new THREE.BoxGeometry(1.66, 0.04, 0.1), carbon());
  belt.position.set(0, 0.52, 0.02);
  group.add(belt);
  const lightbar = mesh(
    new THREE.BoxGeometry(1.1, 0.1, 0.24),
    mat("safetyBar", { color: 0xd4a017, emissive: 0xd4a017, emissiveIntensity: 0.55 }),
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
  addExhaustPair(group, -2.04);
  addTrafficWheels(group, 0.8, 1.28);
  return group;
}

export function disposeCar(group: THREE.Group): void {
  const keep = new Set<THREE.Material>(Object.values(shared));
  const drop = new Set<THREE.Material>();
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material && !keep.has(material)) drop.add(material);
      }
    } else if (obj instanceof THREE.Light) {
      obj.dispose();
    }
  });
  for (const material of drop) material.dispose();
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
