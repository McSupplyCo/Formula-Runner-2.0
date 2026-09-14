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

/** Player-only rim paint. Unique instance so a repaint never bleeds into traffic. */
function rimPaint(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.92,
    roughness: 0.18,
    envMapIntensity: 1.3,
  });
}

function numberDecal(value: number): THREE.Material | null {
  const label = String(Math.max(0, Math.min(99, Math.floor(value))));
  let el: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  try {
    el = document.createElement("canvas");
    ctx = el.getContext("2d");
  } catch {
    return null;
  }
  if (!ctx) return null;
  el.width = 64;
  el.height = 64;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#f4f8fb";
  ctx.font = "700 46px 'Barlow Condensed', 'Barlow', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 32, 34);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
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

function makeWheel(front: boolean, rimMat?: THREE.Material) {
  const group = new THREE.Group();
  const radius = front ? 0.31 : 0.35;
  const width = front ? 0.32 : 0.4;
  const barrelMat = rimMat ?? rim();
  const tire = mesh(new THREE.CylinderGeometry(radius, radius, width, 28, 1, false), rubber());
  tire.rotation.z = Math.PI / 2;
  const rimBarrel = mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.42, 16),
    barrelMat,
  );
  rimBarrel.rotation.z = Math.PI / 2;
  const lip = mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, width * 0.08, 18),
    barrelMat,
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

function placeWheel(parent: THREE.Group, x: number, y: number, z: number, front: boolean, rimMat?: THREE.Material) {
  const mount = new THREE.Group();
  mount.position.set(x, y, z);
  const wheel = makeWheel(front, rimMat);
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
 * opts.rim / opts.number / opts.glow are player cosmetics; traffic keeps the shared materials.
 */
export function createFormulaCar(
  body: number,
  accent: number,
  secondary?: number,
  opts?: { rim?: number; number?: number; glow?: number },
): THREE.Group {
  const group = new THREE.Group();
  group.name = "formula";
  const rimMat = typeof opts?.rim === "number" ? rimPaint(opts.rim >>> 0) : undefined;

  const coat = paint(body, 0.24);
  const pod = paint(secondary ?? darkerBody(body), 0.3);
  const neon = accentCoat(accent);
  const dark = (carbon() as THREE.MeshStandardMaterial).clone();
  dark.envMapIntensity = 1.05;
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0x6a5420,
    roughness: 0.62,
    metalness: 0.25,
  });
  const rainMat = new THREE.MeshStandardMaterial({
    color: 0xff2230,
    emissive: 0xff1020,
    emissiveIntensity: 3.4,
    roughness: 0.22,
    metalness: 0.12,
    envMapIntensity: 0.4,
  });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8eef4,
    metalness: 0.58,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.85,
  });

  group.add(contactShadow(1.9, 4.1));

  const floor = mesh(new RoundedBoxGeometry(1.58, 0.055, 3.42, 2, 0.04), dark);
  floor.position.set(0, 0.145, 0.02);
  group.add(floor);
  const floorLip = mesh(new THREE.BoxGeometry(1.62, 0.018, 3.36), coat);
  floorLip.position.set(0, 0.175, 0.02);
  group.add(floorLip);
  for (const x of [-0.78, 0.78]) {
    const edge = mesh(new THREE.BoxGeometry(0.07, 0.055, 3.05), coat);
    edge.position.set(x, 0.172, 0.06);
    group.add(edge);
  }
  const plank = mesh(new THREE.BoxGeometry(0.3, 0.032, 2.28), plankMat);
  plank.position.set(0, 0.108, 0.12);
  group.add(plank);
  for (const x of [-0.72, 0.72]) {
    for (const z of [0.72, 0.18, -0.38]) {
      const fence = mesh(new THREE.BoxGeometry(0.014, 0.09, 0.32), dark);
      fence.position.set(x, 0.2, z);
      group.add(fence);
    }
  }

  if (typeof opts?.glow === "number" && Number.isFinite(opts.glow) && (opts.glow >>> 0) > 0x222222) {
    const glowMat = new THREE.MeshBasicMaterial({
      color: opts.glow >>> 0,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const underglow = mesh(new RoundedBoxGeometry(1.4, 0.02, 3.0, 1, 0.04), glowMat);
    underglow.position.set(0, 0.08, 0.04);
    group.add(underglow);
    for (const x of [-0.52, 0.52]) {
      const podGlow = mesh(new THREE.BoxGeometry(0.36, 0.018, 1.2), glowMat);
      podGlow.position.set(x, 0.08, -0.1);
      group.add(podGlow);
    }
  }

  const tub = mesh(new RoundedBoxGeometry(0.72, 0.34, 1.68, 3, 0.08), coat);
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

  const tip = mesh(new RoundedBoxGeometry(0.14, 0.075, 0.4, 2, 0.02), dark);
  tip.position.set(0, 0.265, 2.46);
  group.add(tip);
  const camera = mesh(new THREE.BoxGeometry(0.06, 0.045, 0.08), dark);
  camera.position.set(0, 0.36, 2.32);
  group.add(camera);
  const camStripe = mesh(new THREE.BoxGeometry(0.018, 0.012, 0.09), neon);
  camStripe.position.set(0, 0.385, 2.32);
  group.add(camStripe);

  for (const x of [-0.54, 0.54]) {
    const inletShoulder = mesh(new RoundedBoxGeometry(0.5, 0.26, 0.62, 3, 0.08), pod);
    inletShoulder.position.set(x, 0.38, 0.28);
    group.add(inletShoulder);
    const midPod = mesh(new RoundedBoxGeometry(0.42, 0.2, 0.72, 3, 0.07), pod);
    midPod.position.set(x * 0.96, 0.34, -0.28);
    group.add(midPod);
    const coke = mesh(new RoundedBoxGeometry(0.28, 0.16, 0.58, 2, 0.06), pod);
    coke.position.set(x * 0.62, 0.32, -0.88);
    group.add(coke);
    const undercut = mesh(new RoundedBoxGeometry(0.34, 0.1, 1.22, 2, 0.04), pod);
    undercut.position.set(x * 0.88, 0.23, -0.22);
    group.add(undercut);
    const inlet = mesh(new RoundedBoxGeometry(0.24, 0.14, 0.18, 2, 0.03), dark);
    inlet.position.set(x, 0.46, 0.58);
    group.add(inlet);
    for (let i = 0; i < 4; i++) {
      const gill = mesh(new THREE.BoxGeometry(0.2, 0.018, 0.07), dark);
      gill.position.set(x * 1.16, 0.4, -0.18 - i * 0.12);
      group.add(gill);
    }
    const barge = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.52), dark);
    barge.position.set(x * 0.7, 0.28, 0.86);
    group.add(barge);
    const bargeFoot = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.48), dark);
    bargeFoot.position.set(x * 0.7, 0.17, 0.86);
    group.add(bargeFoot);
    const stalk = mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.22, 6), dark);
    stalk.rotation.z = x < 0 ? 0.95 : -0.95;
    stalk.position.set(x * 0.42, 0.64, 0.54);
    group.add(stalk);
    const mirror = mesh(new RoundedBoxGeometry(0.12, 0.055, 0.08, 1, 0.016), dark);
    mirror.position.set(x * 0.52, 0.74, 0.54);
    group.add(mirror);
    const glassPad = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), dark);
    glassPad.position.set(x * 0.58, 0.74, 0.54);
    group.add(glassPad);
  }

  const cover = mesh(new RoundedBoxGeometry(0.42, 0.22, 1.05, 2, 0.06), pod);
  cover.position.set(0, 0.6, -0.38);
  group.add(cover);
  const cokeSpine = mesh(new RoundedBoxGeometry(0.26, 0.16, 0.58, 2, 0.05), pod);
  cokeSpine.position.set(0, 0.52, -0.96);
  group.add(cokeSpine);

  const airbox = mesh(new RoundedBoxGeometry(0.28, 0.28, 0.4, 2, 0.05), pod);
  airbox.position.set(0, 0.86, -0.26);
  group.add(airbox);
  const scoop = mesh(new THREE.BoxGeometry(0.22, 0.07, 0.22), dark);
  scoop.position.set(0, 1.02, -0.2);
  group.add(scoop);
  const tcam = mesh(new THREE.BoxGeometry(0.055, 0.045, 0.14), dark);
  tcam.position.set(0, 1.08, -0.16);
  group.add(tcam);
  const tcamStripe = mesh(new THREE.BoxGeometry(0.02, 0.012, 0.15), neon);
  tcamStripe.position.set(0, 1.105, -0.16);
  group.add(tcamStripe);
  const team = mesh(new THREE.BoxGeometry(0.08, 0.05, 0.22), neon);
  team.position.set(0, 0.94, -0.08);
  group.add(team);

  const cockpit = mesh(new RoundedBoxGeometry(0.48, 0.14, 0.58, 2, 0.04), dark);
  cockpit.position.set(0, 0.58, 0.28);
  group.add(cockpit);

  const helmet = mesh(new THREE.SphereGeometry(0.13, 16, 14), helmetMat);
  helmet.position.set(0, 0.68, 0.22);
  group.add(helmet);
  const visor = mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), glass());
  visor.position.set(0, 0.72, 0.26);
  group.add(visor);

  const halo = mesh(new THREE.TorusGeometry(0.3, 0.042, 10, 24, Math.PI), dark);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 0.82, 0.36);
  group.add(halo);
  const stay = mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.3, 8), dark);
  stay.position.set(0, 0.9, 0.1);
  group.add(stay);
  const stayCap = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.06), dark);
  stayCap.position.set(0, 1.04, 0.12);
  group.add(stayCap);

  const strip = mesh(new THREE.BoxGeometry(0.05, 0.022, 2.4), neon);
  strip.position.set(0, 0.56, 0.1);
  group.add(strip);

  const frontWing = mesh(new THREE.BoxGeometry(1.8, 0.032, 0.38), coat);
  frontWing.position.set(0, 0.185, 2.48);
  frontWing.rotation.x = -0.1;
  group.add(frontWing);
  const flap = mesh(new THREE.BoxGeometry(1.62, 0.024, 0.15), coat);
  flap.position.set(0, 0.255, 2.38);
  flap.rotation.x = -0.2;
  group.add(flap);
  const flap2 = mesh(new THREE.BoxGeometry(1.48, 0.02, 0.11), coat);
  flap2.position.set(0, 0.305, 2.3);
  flap2.rotation.x = -0.28;
  group.add(flap2);
  const flap3 = mesh(new THREE.BoxGeometry(1.32, 0.016, 0.08), coat);
  flap3.position.set(0, 0.345, 2.24);
  flap3.rotation.x = -0.34;
  group.add(flap3);
  const neutral = mesh(new THREE.BoxGeometry(0.46, 0.022, 0.34), dark);
  neutral.position.set(0, 0.2, 2.48);
  group.add(neutral);
  for (const x of [-0.9, 0.9]) {
    const endplate = mesh(new THREE.BoxGeometry(0.045, 0.42, 0.46), dark);
    endplate.position.set(x, 0.3, 2.46);
    group.add(endplate);
    const foot = mesh(new THREE.BoxGeometry(0.14, 0.022, 0.42), dark);
    foot.position.set(x, 0.11, 2.46);
    group.add(foot);
    const pin = mesh(new THREE.BoxGeometry(0.012, 0.3, 0.4), neon);
    pin.position.set(x + (x < 0 ? -0.03 : 0.03), 0.3, 2.46);
    group.add(pin);
    for (let i = 0; i < 3; i++) {
      const strake = mesh(new THREE.BoxGeometry(0.09, 0.012, 0.3), dark);
      strake.position.set(x + (x < 0 ? 0.07 : -0.07), 0.14 + i * 0.045, 2.44);
      group.add(strake);
    }
  }

  const rearMain = mesh(new THREE.BoxGeometry(1.72, 0.048, 0.36), coat);
  rearMain.position.set(0, 1.06, -1.5);
  rearMain.rotation.x = 0.08;
  group.add(rearMain);
  const rearFlap = mesh(new THREE.BoxGeometry(1.55, 0.034, 0.16), pod);
  rearFlap.position.set(0, 1.15, -1.4);
  rearFlap.rotation.x = 0.12;
  group.add(rearFlap);
  const drs = mesh(new THREE.BoxGeometry(0.16, 0.055, 0.09), dark);
  drs.position.set(0, 1.12, -1.44);
  group.add(drs);
  const drsArm = mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), dark);
  drsArm.position.set(0, 1.18, -1.42);
  group.add(drsArm);
  for (const x of [-0.88, 0.88]) {
    const endplate = mesh(new THREE.BoxGeometry(0.048, 0.62, 0.46), dark);
    endplate.position.set(x, 0.92, -1.48);
    group.add(endplate);
    const pin = mesh(new THREE.BoxGeometry(0.012, 0.46, 0.4), neon);
    pin.position.set(x + (x < 0 ? -0.032 : 0.032), 0.96, -1.48);
    group.add(pin);
  }
  const pylon = mesh(new THREE.BoxGeometry(0.2, 0.58, 0.07), dark);
  pylon.position.set(0, 0.72, -1.36);
  group.add(pylon);
  const beam = mesh(new THREE.BoxGeometry(1.42, 0.028, 0.14), dark);
  beam.position.set(0, 0.5, -1.54);
  group.add(beam);

  const diffuser = mesh(new RoundedBoxGeometry(1.28, 0.16, 0.32, 2, 0.03), dark);
  diffuser.position.set(0, 0.2, -1.62);
  group.add(diffuser);
  for (const x of [-0.48, -0.24, 0, 0.24, 0.48]) {
    const strake = mesh(new THREE.BoxGeometry(0.022, 0.14, 0.28), dark);
    strake.position.set(x, 0.2, -1.62);
    group.add(strake);
  }
  const exhaust = mesh(
    new THREE.CylinderGeometry(0.038, 0.044, 0.14, 12),
    mat("exhaust", { color: 0x6a6e72, metalness: 0.92, roughness: 0.22 }),
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0.42, -1.58);
  group.add(exhaust);

  const rain = mesh(new THREE.BoxGeometry(0.14, 0.07, 0.055), rainMat);
  rain.position.set(0, 0.66, -1.55);
  group.add(rain);

  for (const x of [-0.15, 0.15]) {
    const lamp = mesh(new THREE.BoxGeometry(0.09, 0.05, 0.05), headlamp());
    lamp.position.set(x, 0.34, 2.2);
    group.add(lamp);
  }
  addHeadlights(group, 0.34, 2.15, 0.16);

  if (typeof opts?.number === "number") {
    const decal = numberDecal(opts.number);
    if (decal) {
      const plate = mesh(new THREE.PlaneGeometry(0.34, 0.28), decal);
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(0, 0.685, -0.66);
      plate.renderOrder = 2;
      group.add(plate);
      const nosePlate = mesh(new THREE.PlaneGeometry(0.22, 0.18), decal);
      nosePlate.rotation.x = -Math.PI / 2;
      nosePlate.position.set(0, 0.5, 1.72);
      nosePlate.renderOrder = 2;
      group.add(nosePlate);
      for (const x of [-0.72, 0.72]) {
        const side = mesh(new THREE.PlaneGeometry(0.18, 0.14), decal);
        side.position.set(x, 0.55, -0.15);
        side.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
        side.renderOrder = 2;
        group.add(side);
      }
    }
  }

  placeWheel(group, -0.8, 0.31, 1.38, true, rimMat);
  placeWheel(group, 0.8, 0.31, 1.38, true, rimMat);
  placeWheel(group, -0.86, 0.35, -1.18, false, rimMat);
  placeWheel(group, 0.86, 0.35, -1.18, false, rimMat);

  wishbone(group, -0.34, 0.32, 1.12, -0.72, 0.28, 1.38);
  wishbone(group, 0.34, 0.32, 1.12, 0.72, 0.28, 1.38);
  wishbone(group, -0.32, 0.48, 1.08, -0.7, 0.38, 1.38);
  wishbone(group, 0.32, 0.48, 1.08, 0.7, 0.38, 1.38);
  wishbone(group, -0.36, 0.34, -0.82, -0.78, 0.32, -1.18);
  wishbone(group, 0.36, 0.34, -0.82, 0.78, 0.32, -1.18);
  wishbone(group, -0.34, 0.5, -0.78, -0.76, 0.42, -1.18);
  wishbone(group, 0.34, 0.5, -0.78, 0.76, 0.42, -1.18);

  enableCarShadows(group);
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

function enableCarShadows(group: THREE.Group) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !obj.userData.ground) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function addBodywork(group: THREE.Group, cabinY: number, cabinZ: number, coat?: THREE.Material) {
  const dark = carbon();
  const shell = coat ?? dark;
  for (const x of [-0.68, 0.68]) {
    const frontArch = mesh(new THREE.BoxGeometry(0.12, 0.2, 0.58), dark);
    frontArch.position.set(x, 0.36, 1.22);
    group.add(frontArch);
    const rearArch = mesh(new THREE.BoxGeometry(0.12, 0.22, 0.58), dark);
    rearArch.position.set(x, 0.38, -1.18);
    group.add(rearArch);
    const aPillar = mesh(new THREE.BoxGeometry(0.055, 0.42, 0.1), shell);
    aPillar.position.set(x * 0.72, cabinY + 0.02, cabinZ + 0.62);
    aPillar.rotation.x = -0.42;
    group.add(aPillar);
    const bPillar = mesh(new THREE.BoxGeometry(0.05, 0.38, 0.08), dark);
    bPillar.position.set(x * 0.74, cabinY, cabinZ - 0.08);
    group.add(bPillar);
    const cPillar = mesh(new THREE.BoxGeometry(0.06, 0.34, 0.14), shell);
    cPillar.position.set(x * 0.7, cabinY - 0.02, cabinZ - 0.62);
    cPillar.rotation.x = 0.28;
    group.add(cPillar);
    const mirrorArm = mesh(new THREE.BoxGeometry(0.08, 0.03, 0.04), dark);
    mirrorArm.position.set(x * 0.92, cabinY - 0.12, cabinZ + 0.5);
    group.add(mirrorArm);
    const mirror = mesh(new RoundedBoxGeometry(0.14, 0.07, 0.08, 1, 0.016), shell);
    mirror.position.set(x * 1.02, cabinY - 0.1, cabinZ + 0.5);
    group.add(mirror);
    const glassPad = mesh(new THREE.BoxGeometry(0.08, 0.045, 0.05), dark);
    glassPad.position.set(x * 1.08, cabinY - 0.1, cabinZ + 0.5);
    group.add(glassPad);
    const skirt = mesh(new THREE.BoxGeometry(0.09, 0.07, 1.85), dark);
    skirt.position.set(x * 1.14, 0.2, 0.02);
    group.add(skirt);
  }
  const grille = mesh(new THREE.BoxGeometry(1.05, 0.18, 0.06), dark);
  grille.position.set(0, 0.36, 2.04);
  group.add(grille);
  const meshBars = mesh(new THREE.BoxGeometry(0.92, 0.1, 0.02), mat("grilleBars", { color: 0x3a424c, metalness: 0.7, roughness: 0.28 }));
  meshBars.position.set(0, 0.36, 2.08);
  group.add(meshBars);
  const splitter = mesh(new THREE.BoxGeometry(1.62, 0.035, 0.26), dark);
  splitter.position.set(0, 0.155, 2.08);
  group.add(splitter);
  const under = mesh(new THREE.BoxGeometry(1.52, 0.05, 3.45), dark);
  under.position.set(0, 0.145, 0);
  group.add(under);
  const filler = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), dark);
  filler.position.set(0.46, 0.6, -0.62);
  group.add(filler);
}

function addSedanVolumes(group: THREE.Group, coat: THREE.Material, glassMat: THREE.Material, cabinZ: number) {
  const dark = carbon();
  const hood = mesh(new RoundedBoxGeometry(1.48, 0.045, 1.05, 2, 0.04), coat);
  hood.position.set(0, 0.52, 1.42);
  hood.rotation.x = 0.04;
  group.add(hood);
  const scuttle = mesh(new THREE.BoxGeometry(1.42, 0.04, 0.16), dark);
  scuttle.position.set(0, 0.58, 0.88);
  group.add(scuttle);
  const roof = mesh(new RoundedBoxGeometry(1.18, 0.04, 1.28, 2, 0.03), coat);
  roof.position.set(0, 1.2, cabinZ);
  group.add(roof);
  const trunk = mesh(new RoundedBoxGeometry(1.52, 0.05, 0.78, 2, 0.04), coat);
  trunk.position.set(0, 0.56, -1.52);
  group.add(trunk);
  const windshield = mesh(new RoundedBoxGeometry(1.22, 0.04, 0.72, 1, 0.02), glassMat);
  windshield.position.set(0, 0.92, cabinZ + 0.58);
  windshield.rotation.x = 0.52;
  group.add(windshield);
  const rearGlass = mesh(new RoundedBoxGeometry(1.18, 0.035, 0.52, 1, 0.02), glassMat);
  rearGlass.position.set(0, 0.92, cabinZ - 0.62);
  rearGlass.rotation.x = -0.48;
  group.add(rearGlass);
  for (const x of [-0.66, 0.66]) {
    const side = mesh(new RoundedBoxGeometry(0.04, 0.28, 1.18, 1, 0.02), glassMat);
    side.position.set(x, 0.92, cabinZ);
    group.add(side);
  }
}

function plateCanvas(label: string, w: number, h: number): THREE.CanvasTexture | null {
  let el: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  try {
    el = document.createElement("canvas");
    ctx = el.getContext("2d");
  } catch {
    return null;
  }
  if (!ctx) return null;
  el.width = w;
  el.height = h;
  const r = Math.min(h * 0.18, 12);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#d8dde4";
  ctx.beginPath();
  ctx.moveTo(r, 4);
  ctx.arcTo(w - 4, 4, w - 4, h - 4, r);
  ctx.arcTo(w - 4, h - 4, 4, h - 4, r);
  ctx.arcTo(4, h - 4, 4, 4, r);
  ctx.arcTo(4, 4, w - 4, 4, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#1c222a";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#2a3340";
  ctx.fillRect(10, 8, w - 20, 6);
  ctx.fillStyle = "#12161c";
  ctx.font = `800 ${Math.floor(h * 0.55)}px 'Barlow Condensed', 'Barlow', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h * 0.58);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function plateMaterial(label: string): THREE.MeshBasicMaterial | null {
  const tex = plateCanvas(label.slice(0, 3), 256, 96);
  if (!tex) return null;
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function addRearPlate(group: THREE.Group, label: string, z = -2.1, y = 0.36) {
  const face = plateMaterial(label);
  if (!face) return;
  const dark = carbon();
  const frame = mesh(new THREE.BoxGeometry(0.42, 0.15, 0.03), dark);
  frame.position.set(0, y, z);
  group.add(frame);
  const plate = mesh(new THREE.PlaneGeometry(0.38, 0.12), face);
  plate.position.set(0, y, z - 0.018);
  plate.rotation.y = Math.PI;
  plate.renderOrder = 2;
  group.add(plate);
}

function trafficLamp() {
  return mat("trafficHeadlamp", {
    color: 0xe8eef2,
    emissive: 0xfff1d6,
    emissiveIntensity: 0.2,
    roughness: 0.22,
    metalness: 0.18,
  });
}

function trafficTail() {
  return mat("trafficTail", {
    color: 0x9a1820,
    emissive: 0x6a1016,
    emissiveIntensity: 0.24,
    roughness: 0.38,
    metalness: 0.12,
  });
}

function addTrafficLamps(group: THREE.Group, z = 2.08, y = 0.46, spread = 0.58) {
  for (const x of [-spread, spread]) {
    const lamp = mesh(new RoundedBoxGeometry(0.36, 0.1, 0.08, 1, 0.025), trafficLamp());
    lamp.position.set(x, y, z);
    group.add(lamp);
    const lens = mesh(
      new THREE.BoxGeometry(0.28, 0.055, 0.02),
      mat("trafficLens", {
        color: 0xd4e0ea,
        roughness: 0.12,
        metalness: 0.22,
        transparent: true,
        opacity: 0.42,
      }),
    );
    lens.position.set(x, y, z + 0.042);
    group.add(lens);
  }
}

function addTrafficTails(group: THREE.Group, z = -2.08, y = 0.5, width = 1.46) {
  const bar = mesh(new RoundedBoxGeometry(width, 0.1, 0.055, 1, 0.02), trafficTail());
  bar.position.set(0, y, z);
  group.add(bar);
  for (const x of [-width * 0.3, width * 0.3]) {
    const lens = mesh(new THREE.BoxGeometry(width * 0.26, 0.055, 0.028), trafficTail());
    lens.position.set(x, y, z - 0.018);
    group.add(lens);
  }
}

function makeRoadWheel() {
  const group = new THREE.Group();
  const radius = 0.325;
  const width = 0.215;
  const tire = mesh(new THREE.CylinderGeometry(radius, radius, width, 20), rubber());
  tire.rotation.z = Math.PI / 2;
  const barrel = mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, width * 0.36, 16), rim());
  barrel.rotation.z = Math.PI / 2;
  const lip = mesh(new THREE.CylinderGeometry(radius * 0.76, radius * 0.76, width * 0.055, 16), rim());
  lip.rotation.z = Math.PI / 2;
  const face = mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.08, 16),
    mat("roadDisc", { color: 0x8a929a, metalness: 0.82, roughness: 0.28 }),
  );
  face.rotation.z = Math.PI / 2;
  const cap = mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 0.48, 10), hub());
  cap.rotation.z = Math.PI / 2;
  group.add(tire, barrel, lip, face, cap);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.x = (i / 5) * Math.PI * 2;
    const bar = mesh(new THREE.BoxGeometry(width * 0.05, radius * 0.38, 0.03), spoke());
    bar.position.y = radius * 0.28;
    arm.add(bar);
    group.add(arm);
  }
  group.userData.spin = true;
  group.userData.radius = radius;
  return group;
}

function addTrafficWheels(group: THREE.Group, track = 0.78, wheelbase = 1.32) {
  const y = 0.325;
  for (const x of [-track, track]) {
    for (const z of [wheelbase, -wheelbase]) {
      const mount = new THREE.Group();
      mount.position.set(x, y, z);
      mount.add(makeRoadWheel());
      group.add(mount);
    }
  }
}

function addQuadExhaust(group: THREE.Group, z = -2.06) {
  const metal = mat("exhaust", { color: 0x6a6e72, metalness: 0.92, roughness: 0.22 });
  for (const x of [-0.4, -0.24, 0.24, 0.4]) {
    const sleeve = mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.11, 10), metal);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(x, 0.26, z);
    group.add(sleeve);
    const core = mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.04, 8),
      mat("exhaustCore", { color: 0x1a1c20, metalness: 0.4, roughness: 0.55 }),
    );
    core.rotation.x = Math.PI / 2;
    core.position.set(x, 0.26, z - 0.04);
    group.add(core);
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
  const body = paint(GT_PAINT[index] ?? 0x1a222c, 0.26);
  const stripe = paint(GT_STRIPE[index] ?? 0x8a929a, 0.3);
  const glassMat = glass();
  group.add(contactShadow(1.85, 4.2));
  const hull = mesh(
    extrudeBody(
      [
        [2.12, 0.11],
        [2.1, 0.38],
        [1.92, 0.52],
        [1.15, 0.56],
        [-1.55, 0.56],
        [-1.98, 0.5],
        [-2.12, 0.38],
        [-2.14, 0.16],
        [-2.14, 0.11],
      ],
      1.8,
    ),
    body,
  );
  group.add(hull);
  addSedanVolumes(group, body, glassMat, -0.14);
  const belt = mesh(new THREE.BoxGeometry(1.78, 0.03, 0.06), stripe);
  belt.position.set(0, 0.56, 0.04);
  group.add(belt);
  addBodywork(group, 0.96, -0.14, body);
  for (const x of [-0.22, 0.22]) {
    const vent = mesh(new THREE.BoxGeometry(0.16, 0.018, 0.28), carbon());
    vent.position.set(x, 0.545, 1.12);
    group.add(vent);
  }
  const spoiler = mesh(new RoundedBoxGeometry(1.48, 0.032, 0.2, 1, 0.02), body);
  spoiler.position.set(0, 0.72, -1.98);
  group.add(spoiler);
  addTrafficLamps(group, 2.1, 0.46, 0.56);
  addTrafficTails(group, -2.1, 0.5, 1.48);
  addQuadExhaust(group, -2.06);
  addRearPlate(group, String(Math.floor(Math.random() * 100)).padStart(2, "0"));
  addTrafficWheels(group, 0.82, 1.32);
  enableCarShadows(group);
  return group;
}

function makeSupport() {
  const group = new THREE.Group();
  group.userData.kind = "support";
  const body = paint(SUPPORT_PAINT[supportTint++ % SUPPORT_PAINT.length] ?? 0x1a222c, 0.3);
  const glassMat = glass();
  const dark = carbon();
  group.add(contactShadow(1.92, 4.3));
  const hull = mesh(
    extrudeBody(
      [
        [2.16, 0.11],
        [2.12, 0.4],
        [1.95, 0.58],
        [1.2, 0.64],
        [-1.7, 0.64],
        [-2.05, 0.52],
        [-2.16, 0.36],
        [-2.18, 0.16],
        [-2.18, 0.11],
      ],
      1.84,
    ),
    body,
  );
  group.add(hull);
  const hood = mesh(new RoundedBoxGeometry(1.58, 0.05, 1.02, 2, 0.04), body);
  hood.position.set(0, 0.66, 1.42);
  hood.rotation.x = 0.03;
  group.add(hood);
  const roof = mesh(new RoundedBoxGeometry(1.42, 0.045, 1.92, 2, 0.03), body);
  roof.position.set(0, 1.42, -0.08);
  group.add(roof);
  const windshield = mesh(new RoundedBoxGeometry(1.36, 0.035, 0.72, 1, 0.02), glassMat);
  windshield.position.set(0, 1.06, 0.78);
  windshield.rotation.x = 0.46;
  group.add(windshield);
  const rearGlass = mesh(new RoundedBoxGeometry(1.32, 0.032, 0.58, 1, 0.02), glassMat);
  rearGlass.position.set(0, 1.12, -1.02);
  rearGlass.rotation.x = -0.28;
  group.add(rearGlass);
  for (const x of [-0.72, 0.72]) {
    const side = mesh(new RoundedBoxGeometry(0.035, 0.34, 1.55, 1, 0.015), glassMat);
    side.position.set(x, 1.08, -0.06);
    group.add(side);
  }
  addBodywork(group, 1.14, 0.08, body);
  const vis = paint(0xc4a24a, 0.32);
  const stripe = mesh(new THREE.BoxGeometry(1.86, 0.05, 0.1), vis);
  stripe.position.set(0, 0.66, 0.08);
  group.add(stripe);
  for (let i = 0; i < 5; i++) {
    const chev = mesh(new THREE.BoxGeometry(0.72 - i * 0.08, 0.04, 0.055), vis);
    chev.position.set(0, 0.56, -1.58 - i * 0.08);
    group.add(chev);
  }
  const bar = mesh(
    new THREE.BoxGeometry(1.08, 0.08, 0.18),
    mat("supportBar", { color: 0xe8b45a, emissive: 0xffc56a, emissiveIntensity: 0.16 }),
  );
  bar.position.set(0, 1.5, -0.02);
  group.add(bar);
  const bumper = mesh(new THREE.BoxGeometry(1.7, 0.12, 0.16), dark);
  bumper.position.set(0, 0.28, -2.12);
  group.add(bumper);
  addTrafficLamps(group, 2.14, 0.5, 0.56);
  addTrafficTails(group, -2.14, 0.52, 1.5);
  addRearPlate(group, String(Math.floor(Math.random() * 100)).padStart(2, "0"), -2.16, 0.34);
  addTrafficWheels(group, 0.84, 1.34);
  enableCarShadows(group);
  return group;
}

function makeSafety() {
  const group = new THREE.Group();
  group.userData.kind = "safety";
  const body = paint(SAFETY_PAINT[safetyTint++ % SAFETY_PAINT.length] ?? 0xc9a227, 0.24);
  const glassMat = glass();
  group.add(contactShadow(1.85, 4.2));
  const hull = mesh(
    extrudeBody(
      [
        [2.12, 0.11],
        [2.1, 0.38],
        [1.9, 0.52],
        [1.12, 0.56],
        [-1.52, 0.56],
        [-1.98, 0.48],
        [-2.12, 0.36],
        [-2.14, 0.16],
        [-2.14, 0.11],
      ],
      1.76,
    ),
    body,
  );
  group.add(hull);
  addSedanVolumes(group, body, glassMat, -0.1);
  addBodywork(group, 0.96, -0.1, body);
  const belt = mesh(new THREE.BoxGeometry(1.72, 0.035, 0.07), carbon());
  belt.position.set(0, 0.54, 0.02);
  group.add(belt);
  const lightbar = mesh(
    new THREE.BoxGeometry(1.1, 0.09, 0.22),
    mat("safetyBar", { color: 0xc49218, emissive: 0xd4a017, emissiveIntensity: 0.18 }),
  );
  lightbar.position.set(0, 1.28, -0.02);
  group.add(lightbar);
  addTrafficLamps(group, 2.1, 0.46, 0.54);
  addTrafficTails(group, -2.1, 0.5, 1.44);
  addQuadExhaust(group, -2.06);
  addRearPlate(group, String(Math.floor(Math.random() * 100)).padStart(2, "0"));
  addTrafficWheels(group, 0.8, 1.32);
  enableCarShadows(group);
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
  for (const material of drop) {
    const map = (material as THREE.MeshBasicMaterial).map;
    if (map && map !== carbonMap) map.dispose();
    material.dispose();
  }
}

export function createLightPole(): THREE.Group {
  const group = new THREE.Group();
  const steel = mat("pole", {
    color: 0x4a545e,
    roughness: 0.46,
    metalness: 0.64,
    envMapIntensity: 0.75,
  });
  const steelDark = mat("poleArm", { color: 0x343c46, metalness: 0.6, roughness: 0.4 });
  const house = mat("lampHouse", { color: 0x1c222a, metalness: 0.55, roughness: 0.36 });
  const shaftH = 8.35;

  const base = mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 10), steel);
  base.position.y = 0.11;
  const collar = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), steelDark);
  collar.position.y = 0.26;
  const shaft = mesh(new THREE.CylinderGeometry(0.05, 0.092, shaftH, 10), steel);
  shaft.position.y = shaftH * 0.5;

  const rise = mesh(new THREE.CylinderGeometry(0.038, 0.048, 1.05, 8), steelDark);
  rise.position.set(0.36, shaftH + 0.12, 0);
  rise.rotation.z = -1.05;

  const arm = mesh(new THREE.CylinderGeometry(0.034, 0.04, 2.05, 8), steelDark);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(1.52, shaftH + 0.58, 0);

  const tenon = mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.14, 6), steelDark);
  tenon.position.set(2.52, shaftH + 0.5, 0);

  const housing = mesh(new RoundedBoxGeometry(0.92, 0.13, 0.38, 1, 0.045), house);
  housing.position.set(2.58, shaftH + 0.4, 0);
  housing.rotation.z = 0.1;
  const visor = mesh(new THREE.BoxGeometry(0.86, 0.02, 0.34), house);
  visor.position.set(2.6, shaftH + 0.32, 0);
  visor.rotation.z = 0.08;
  const lens = mesh(
    new THREE.BoxGeometry(0.74, 0.03, 0.28),
    mat("lampLens", {
      color: 0xc4b090,
      emissive: 0xffe6b8,
      emissiveIntensity: 0.95,
      roughness: 0.28,
      metalness: 0.08,
    }),
  );
  lens.position.set(2.6, shaftH + 0.29, 0);

  group.add(base, collar, shaft, rise, arm, tenon, housing, visor, lens);
  return group;
}

let treeSeq = 0;

function colorizeFoliage(geo: THREE.BufferGeometry, hex: number) {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < pos.count; i++) {
    const t = 0.86 + ((i * 17) % 11) * 0.014;
    colors[i * 3] = c.r * t;
    colors[i * 3 + 1] = c.g * t;
    colors[i * 3 + 2] = c.b * t;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

export function createTree(): THREE.Group {
  const group = new THREE.Group();
  const n = treeSeq++;
  const bark = mat("trunk", { color: 0x3a2c1e, roughness: 0.94, metalness: 0.04 });
  const leaves = mat("foliageVC", {
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    vertexColors: true,
    envMapIntensity: 0.22,
  });
  const palettes = [0x2f4a32, 0x3a5234, 0x274028, 0x355838, 0x2c4630];
  const trunkH = 2.2 + (n % 5) * 0.1;
  const trunk = mesh(new THREE.CylinderGeometry(0.065, 0.125, trunkH, 7), bark);
  trunk.position.y = trunkH * 0.5;
  const branch = mesh(new THREE.CylinderGeometry(0.032, 0.048, 0.72, 5), bark);
  branch.position.set(n % 2 === 0 ? 0.18 : -0.16, trunkH * 0.7, 0.05);
  branch.rotation.z = n % 2 === 0 ? -0.72 : 0.68;
  branch.rotation.x = 0.1;
  group.add(trunk, branch);

  const clumps: Array<[number, number, number, number, number, number, number]> = [
    [0.92, 0.02, trunkH + 0.88, 0, 1.18, 1.02, 1.12],
    [0.58, 0.46, trunkH + 0.52, -0.16, 1.05, 0.88, 1],
    [0.55, -0.48, trunkH + 0.48, 0.14, 1, 0.9, 1.06],
    [0.48, 0.06, trunkH + 1.38, 0.06, 1.08, 0.82, 1],
    [0.46, -0.08, trunkH + 0.22, 0.3, 0.95, 0.78, 1],
    [0.4, 0.22, trunkH + 0.68, 0.36, 0.9, 0.84, 0.92],
  ];
  for (let i = 0; i < clumps.length; i++) {
    const [r, x, y, z, sx, sy, sz] = clumps[i]!;
    const geo = new THREE.IcosahedronGeometry(r, 0);
    colorizeFoliage(geo, palettes[(n + i) % palettes.length]!);
    const clump = mesh(geo, leaves);
    clump.position.set(x, y, z);
    clump.scale.set(sx, sy, sz);
    clump.rotation.y = (n + i) * 0.65;
    group.add(clump);
  }
  return group;
}
