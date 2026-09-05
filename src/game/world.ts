import * as THREE from "three";
import { ROAD } from "./tuning";
import { WORLDS, zoneInWorld } from "./circuits";
import type { CityStyle, WeatherKind, WorldDef, Zone } from "./circuits";
import { createLightPole, createTree } from "./vehicles";
import {
  makeBarrierTexture,
  makeBillboardTexture,
  makeBuildingTexture,
  makeDistanceBoard,
  makeGantrySign,
  makeGravelTexture,
  makeKerbTexture,
  makeMarshalBoard,
  makeRoadRoughness,
  makeRoadTexture,
  makeShedTexture,
  makeSlabFacade,
} from "./textures";

export type { CityStyle, WeatherKind, WorldDef, WorldId, Zone } from "./circuits";
export { WORLDS, worldById, zoneInWorld } from "./circuits";

export const ZONES: Zone[] = WORLDS[0].zones;

export function zoneAt(distance: number, world: WorldDef = WORLDS[0]): Zone {
  return zoneInWorld(distance, world);
}

export const CITY_SPAN = 720;
export const CITY_BEHIND = 90;

/** Keep a building in the sliding window ahead of the player. Never wrap backwards. */
export function recycleCityZ(z: number, playerZ: number, span = CITY_SPAN, behind = CITY_BEHIND): number {
  let next = z;
  const floor = playerZ - behind;
  while (next < floor) next += span;
  return next;
}

const DIST_LABELS = ["50", "100", "200"];
const WEATHER_HEIGHT = 18;
const WEATHER_WIDTH = 54;
const WEATHER_SPAN = 160;
const WEATHER_BACK = 30;

/** Short signage tag, e.g. "HARBOR GP" from "HARBOR GP  ·  MIDNIGHT CUP". */
function circuitTag(world: WorldDef) {
  return world.event.split("·")[0].trim();
}

const HORIZON_MATS: Record<CityStyle, THREE.MeshStandardMaterialParameters> = {
  towers: { color: 0x0a121c, roughness: 0.92, metalness: 0.08, emissive: 0x152030, emissiveIntensity: 0.22 },
  docks: { color: 0x140c08, roughness: 0.95, metalness: 0.05, emissive: 0x2a1206, emissiveIntensity: 0.2 },
  glass: { color: 0x0a1420, roughness: 0.7, metalness: 0.24, emissive: 0x14283c, emissiveIntensity: 0.26 },
  ridge: { color: 0x0e0b08, roughness: 1, metalness: 0.02, emissive: 0x1a1208, emissiveIntensity: 0.14 },
  works: { color: 0x081410, roughness: 0.9, metalness: 0.12, emissive: 0x0c2a22, emissiveIntensity: 0.22 },
  sprawl: { color: 0x140814, roughness: 0.88, metalness: 0.1, emissive: 0x2a1020, emissiveIntensity: 0.28 },
  frost: { color: 0x0c141c, roughness: 0.75, metalness: 0.18, emissive: 0x1a2834, emissiveIntensity: 0.2 },
  kiln: { color: 0x180a08, roughness: 0.95, metalness: 0.04, emissive: 0x2a1008, emissiveIntensity: 0.24 },
};

type CitySlot = {
  mesh: THREE.InstancedMesh;
  index: number;
  x: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  y: number;
};

export class TrackWorld {
  readonly group = new THREE.Group();
  circuit: WorldDef;
  private segments: THREE.Group[] = [];
  private segmentMats = new Map<THREE.Group, THREE.MeshStandardMaterial[]>();
  private sharedGeo = new Set<THREE.BufferGeometry>();
  private roadMat: THREE.MeshPhysicalMaterial;
  private edgeMat: THREE.MeshStandardMaterial;
  private kerbMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private gravelMat: THREE.MeshStandardMaterial;
  private fog: THREE.FogExp2;
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private cityLayers: THREE.InstancedMesh[] = [];
  private cityMats: THREE.MeshStandardMaterial[] = [];
  private citySlots: CitySlot[] = [];
  private cityDummy = new THREE.Object3D();
  private stars: THREE.Points;
  private ground: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private streetLights: THREE.SpotLight[] = [];
  private lightTint = new THREE.Color(0xffe4bc);
  private hemi: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;
  private towerMat: THREE.MeshStandardMaterial;
  private slabMat: THREE.MeshStandardMaterial;
  private horizonMat!: THREE.MeshStandardMaterial;
  private eyeMat: THREE.MeshStandardMaterial;
  private starMat!: THREE.PointsMaterial;
  private zoneTint = new THREE.Color();
  private postGeo: THREE.BoxGeometry;
  private signPostGeo: THREE.BoxGeometry;
  private marshalGeo: THREE.PlaneGeometry;
  private distGeo: THREE.PlaneGeometry;
  private postMat: THREE.MeshStandardMaterial;
  private marshalMats: THREE.MeshStandardMaterial[] = [];
  private distMats: THREE.MeshStandardMaterial[] = [];
  private coneGeo: THREE.BoxGeometry;
  private barrelGeo: THREE.BoxGeometry;
  private camPoleGeo: THREE.BoxGeometry;
  private camHeadGeo: THREE.BoxGeometry;
  private crateGeo: THREE.BoxGeometry;
  private rockGeo: THREE.IcosahedronGeometry;
  private coneMat: THREE.MeshStandardMaterial;
  private barrelMat: THREE.MeshStandardMaterial;
  private camMat: THREE.MeshStandardMaterial;
  private propMat: THREE.MeshStandardMaterial;
  private weatherField: THREE.Points;
  private weatherMat!: THREE.PointsMaterial;
  private weatherPos!: Float32Array;
  private weatherAttr!: THREE.BufferAttribute;
  private weatherKind: WeatherKind = "clear";
  private lastTime = 0;
  private lastPlayerZ = 0;

  constructor(
    private scene: THREE.Scene,
    circuit: WorldDef = WORLDS[0],
  ) {
    this.circuit = circuit;
    const zone = circuit.zones[0];
    this.fog = new THREE.FogExp2(zone.fog, zone.fogDensity);
    scene.fog = this.fog;
    scene.background = this.fog.color;

    this.roadMat = new THREE.MeshPhysicalMaterial({
      map: makeRoadTexture(),
      roughnessMap: makeRoadRoughness(),
      color: circuit.roadTint,
      roughness: 0.42,
      metalness: 0,
      envMapIntensity: 0.78,
      clearcoat: 0.28,
      clearcoatRoughness: 0.45,
    });
    this.edgeMat = new THREE.MeshStandardMaterial({
      color: 0xe4ddd0,
      emissive: 0x6a5e48,
      emissiveIntensity: 0.08,
      roughness: 0.45,
    });
    this.kerbMat = new THREE.MeshStandardMaterial({
      map: makeKerbTexture(),
      roughness: 0.5,
      metalness: 0.08,
    });
    this.wallMat = new THREE.MeshStandardMaterial({
      map: makeBarrierTexture(circuitTag(circuit)),
      color: circuit.wall,
      roughness: 0.38,
      metalness: 0.72,
      envMapIntensity: 0.85,
    });
    this.gravelMat = new THREE.MeshStandardMaterial({
      map: makeGravelTexture(),
      color: circuit.gravel,
      roughness: 1,
      metalness: 0,
    });
    this.towerMat = new THREE.MeshStandardMaterial({
      map: makeBuildingTexture(zone.window),
      roughness: 0.8,
      metalness: 0.14,
      envMapIntensity: 0.3,
      emissive: new THREE.Color(0x101820),
      emissiveIntensity: 0.28,
    });
    this.slabMat = new THREE.MeshStandardMaterial({
      map: makeSlabFacade(zone.window),
      roughness: 0.76,
      metalness: 0.16,
      envMapIntensity: 0.28,
      emissive: new THREE.Color(0x101820),
      emissiveIntensity: 0.16,
    });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf0e6c8,
      emissive: 0xffe7b0,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.2,
    });

    this.hemi = new THREE.HemisphereLight(0x7a96b4, 0x080c12, 0.55);
    this.moon = new THREE.DirectionalLight(0xc8d8ee, 0.68);
    this.moon.position.set(-18, 42, 10);
    const fill = new THREE.DirectionalLight(0x1a3040, 0.16);
    fill.position.set(14, 8, -10);
    scene.add(this.hemi, this.moon, fill);

    this.postGeo = new THREE.BoxGeometry(0.08, 0.62, 0.08);
    this.signPostGeo = new THREE.BoxGeometry(0.06, 1.2, 0.06);
    this.marshalGeo = new THREE.PlaneGeometry(0.9, 0.72);
    this.distGeo = new THREE.PlaneGeometry(1.05, 0.78);
    this.coneGeo = new THREE.BoxGeometry(0.26, 0.46, 0.26);
    this.barrelGeo = new THREE.BoxGeometry(0.52, 0.78, 0.52);
    this.camPoleGeo = new THREE.BoxGeometry(0.07, 2.1, 0.07);
    this.camHeadGeo = new THREE.BoxGeometry(0.24, 0.18, 0.4);
    this.crateGeo = new THREE.BoxGeometry(1, 1, 1);
    this.rockGeo = new THREE.IcosahedronGeometry(0.7, 0);
    for (const geo of [
      this.postGeo,
      this.signPostGeo,
      this.marshalGeo,
      this.distGeo,
      this.coneGeo,
      this.barrelGeo,
      this.camPoleGeo,
      this.camHeadGeo,
      this.crateGeo,
      this.rockGeo,
    ]) {
      this.sharedGeo.add(geo);
    }

    this.postMat = new THREE.MeshStandardMaterial({
      color: 0x1c222c,
      roughness: 0.48,
      metalness: 0.35,
      emissive: 0xc8d2dc,
      emissiveIntensity: 0.18,
    });
    this.coneMat = new THREE.MeshStandardMaterial({
      color: 0xff7a2a,
      emissive: 0xff8a3a,
      emissiveIntensity: 0.28,
      roughness: 0.62,
      metalness: 0.05,
    });
    this.barrelMat = new THREE.MeshStandardMaterial({
      color: 0xd8452a,
      emissive: 0x3a0c04,
      emissiveIntensity: 0.2,
      roughness: 0.7,
      metalness: 0.08,
    });
    this.camMat = new THREE.MeshStandardMaterial({
      color: 0x10161e,
      roughness: 0.42,
      metalness: 0.55,
    });
    this.propMat = new THREE.MeshStandardMaterial({
      color: circuit.gravel,
      roughness: 0.95,
      metalness: 0.04,
      flatShading: true,
    });
    const marshalSub = circuit.name.toUpperCase();
    this.marshalMats = [
      new THREE.MeshStandardMaterial({
        map: makeMarshalBoard("clear", marshalSub),
        roughness: 0.55,
        metalness: 0.06,
        side: THREE.DoubleSide,
        emissive: 0x0a2014,
        emissiveIntensity: 0.22,
      }),
      new THREE.MeshStandardMaterial({
        map: makeMarshalBoard("hold", marshalSub),
        roughness: 0.55,
        metalness: 0.06,
        side: THREE.DoubleSide,
        emissive: 0x201408,
        emissiveIntensity: 0.22,
      }),
    ];
    this.distMats = DIST_LABELS.map(
      (label) =>
        new THREE.MeshStandardMaterial({
          map: makeDistanceBoard(label, circuitTag(circuit)),
          roughness: 0.52,
          metalness: 0.05,
          side: THREE.DoubleSide,
        }),
    );

    for (let i = 0; i < 5; i++) {
      const lamp = new THREE.SpotLight(0xffe4bc, 10.5, 34, 0.55, 0.78, 1.45);
      this.streetLights.push(lamp);
      scene.add(lamp, lamp.target);
    }

    this.skyMat = this.makeSky();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 20), this.skyMat);
    this.sky.scale.y = 0.62;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.stars = this.makeStars();
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.weatherField = this.makeWeatherField();
    scene.add(this.weatherField);

    this.makeCity();

    this.groundMat = new THREE.MeshStandardMaterial({ color: circuit.ground, roughness: 1, metalness: 0 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 1400), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.22;
    scene.add(this.ground);

    this.applyPalette(circuit);
    this.applyWeather(zone.weather ?? "clear");
    this.rebuildSegments();
    scene.add(this.group);
  }

  /** Swap the whole dressing set: palettes, skyline, roadside props and sign copy. */
  setCircuit(world: WorldDef) {
    if (world.id === this.circuit.id) return;
    this.circuit = world;
    const zone = world.zones[0];
    this.applyPalette(world);

    this.towerMat.map?.dispose();
    this.towerMat.map = makeBuildingTexture(zone.window);
    this.towerMat.needsUpdate = true;
    this.slabMat.map?.dispose();
    this.slabMat.map = makeSlabFacade(zone.window);
    this.slabMat.needsUpdate = true;
    this.retintSignage(world);

    this.rebuildCity();
    this.rebuildSegments();
    this.applyZone(zone);
    this.applyWeather(zone.weather ?? "clear");
  }

  update(playerZ: number, distance: number) {
    const zone = zoneInWorld(distance, this.circuit);
    this.applyZone(zone);

    const start = Math.floor((playerZ - ROAD.segmentLength) / ROAD.segmentLength);
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].position.z = (start + i) * ROAD.segmentLength;
    }

    this.ground.position.z = playerZ + 180;
    this.stars.position.z = playerZ;
    this.sky.position.z = playerZ;

    for (const slot of this.citySlots) {
      slot.z = recycleCityZ(slot.z, playerZ);
      this.cityDummy.position.set(slot.x, slot.y, slot.z);
      this.cityDummy.scale.set(slot.sx, slot.sy, slot.sz);
      this.cityDummy.rotation.set(0, slot.yaw, 0);
      this.cityDummy.updateMatrix();
      slot.mesh.setMatrixAt(slot.index, this.cityDummy.matrix);
    }
    for (const layer of this.cityLayers) {
      layer.instanceMatrix.needsUpdate = true;
      layer.computeBoundingSphere();
    }
    this.placeStreetLights(playerZ);
    this.updateWeather(playerZ, zone.weather ?? "clear");
  }

  /** Signage baked into shared maps: barrier stencil, marshal and distance boards. */
  private retintSignage(world: WorldDef) {
    const tag = circuitTag(world);
    this.wallMat.map?.dispose();
    this.wallMat.map = makeBarrierTexture(tag);
    this.wallMat.needsUpdate = true;
    const marshalSub = world.name.toUpperCase();
    for (let i = 0; i < this.marshalMats.length; i++) {
      this.marshalMats[i].map?.dispose();
      this.marshalMats[i].map = makeMarshalBoard(i === 0 ? "clear" : "hold", marshalSub);
      this.marshalMats[i].needsUpdate = true;
    }
    for (let i = 0; i < this.distMats.length; i++) {
      this.distMats[i].map?.dispose();
      this.distMats[i].map = makeDistanceBoard(DIST_LABELS[i], tag);
      this.distMats[i].needsUpdate = true;
    }
  }

  private applyPalette(world: WorldDef) {
    this.roadMat.color.setHex(world.roadTint);
    this.gravelMat.color.setHex(world.gravel);
    this.wallMat.color.setHex(world.wall);
    this.groundMat.color.setHex(world.ground);
    this.propMat.color.setHex(world.gravel);
    this.kerbMat.color.setHex(0xffffff).lerp(this.zoneTint.setHex(world.neon), 0.14);
  }

  private applyZone(zone: Zone) {
    this.fog.color.setHex(zone.fog);
    this.fog.density = zone.fogDensity;
    this.skyMat.uniforms.horizon.value.setHex(zone.horizon);
    this.skyMat.uniforms.neon.value.setHex(zone.neon);
    this.skyMat.uniforms.top.value.setHex(zone.top);
    this.skyMat.uniforms.glow.value = zone.glow;
    this.zoneTint.set(zone.window);
    this.towerMat.emissive.copy(this.zoneTint).multiplyScalar(zone.cityEmit);
    this.slabMat.emissive.copy(this.zoneTint).multiplyScalar(zone.cityEmit * 0.82);
    this.towerMat.emissiveIntensity = zone.cityBoost;
    this.slabMat.emissiveIntensity = zone.cityBoost * 0.7;
    this.horizonMat.emissive.copy(this.zoneTint).multiplyScalar(0.16);
    this.horizonMat.emissiveIntensity = zone.cityBoost * 0.8;
    this.lightTint.setHex(zone.lamp);
    this.hemi.color.setHex(zone.horizon);
    this.moon.color.setHex(zone.lamp).lerp(this.zoneTint, 0.18);
    this.starMat.opacity = zone.star * (zone.weather && zone.weather !== "clear" ? 0.38 : 1);
  }

  private placeStreetLights(playerZ: number) {
    const poles: Array<{ x: number; z: number; d: number }> = [];
    for (const segment of this.segments) {
      const z = segment.position.z;
      for (const side of [-1, 1] as const) {
        poles.push({
          x: side * (ROAD.halfWidth + 2.55),
          z,
          d: Math.abs(z - (playerZ + 14)),
        });
      }
    }
    poles.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.streetLights.length; i++) {
      const pole = poles[i];
      const lamp = this.streetLights[i];
      if (!pole) continue;
      lamp.color.copy(this.lightTint);
      lamp.position.set(pole.x * 0.82, 6.05, pole.z);
      lamp.target.position.set(pole.x * 0.22, 0.04, pole.z + 7);
    }
  }

  private makeSky() {
    const zone = this.circuit.zones[0];
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(zone.top) },
        horizon: { value: new THREE.Color(zone.horizon) },
        neon: { value: new THREE.Color(zone.neon) },
        glow: { value: zone.glow },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 neon;
        uniform float glow;
        void main() {
          float h = clamp(vPos.y / 180.0, -0.22, 1.0);
          float dome = 1.0 - smoothstep(-0.06, 0.36, h);
          vec3 col = mix(horizon, top, smoothstep(0.0, 0.82, h));
          col = mix(col, neon, glow * dome);
          col += neon * (glow * 1.35) * dome * dome;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  private makeStars() {
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 720;
      pos[i * 3 + 1] = 48 + Math.random() * 180;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 900;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xcfe8ff,
      size: 0.22,
      transparent: true,
      opacity: this.circuit.zones[0].star,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return new THREE.Points(geo, this.starMat);
  }

  private makeWeatherField() {
    const count = 280;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * WEATHER_WIDTH;
      pos[i * 3 + 1] = Math.random() * WEATHER_HEIGHT;
      pos[i * 3 + 2] = -WEATHER_BACK + Math.random() * WEATHER_SPAN;
    }
    this.weatherPos = pos;
    this.weatherAttr = new THREE.BufferAttribute(pos, 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", this.weatherAttr);
    this.weatherMat = new THREE.PointsMaterial({
      color: 0xbfd6e8,
      size: 0.4,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const field = new THREE.Points(geo, this.weatherMat);
    field.frustumCulled = false;
    field.visible = false;
    return field;
  }

  private applyWeather(kind: WeatherKind) {
    this.weatherKind = kind;
    this.weatherField.visible = kind !== "clear";
    if (kind === "rain") {
      this.weatherMat.color.setHex(0xc4dcf0);
      this.weatherMat.size = 0.42;
      this.weatherMat.opacity = 0.5;
      this.roadMat.roughness = 0.3;
      this.roadMat.clearcoat = 0.58;
      this.roadMat.clearcoatRoughness = 0.28;
    } else if (kind === "dust") {
      this.weatherMat.color.setHex(0xd8bb92);
      this.weatherMat.size = 0.3;
      this.weatherMat.opacity = 0.3;
      this.roadMat.roughness = 0.52;
      this.roadMat.clearcoat = 0.18;
      this.roadMat.clearcoatRoughness = 0.6;
    } else if (kind === "snow") {
      this.weatherMat.color.setHex(0xe8f2f8);
      this.weatherMat.size = 0.55;
      this.weatherMat.opacity = 0.7;
      this.roadMat.roughness = 0.22;
      this.roadMat.clearcoat = 0.7;
      this.roadMat.clearcoatRoughness = 0.18;
    } else {
      this.roadMat.roughness = 0.42;
      this.roadMat.clearcoat = 0.28;
      this.roadMat.clearcoatRoughness = 0.45;
    }
  }

  private updateWeather(playerZ: number, kind: WeatherKind) {
    if (kind !== this.weatherKind) this.applyWeather(kind);
    if (kind === "clear") {
      this.lastPlayerZ = playerZ;
      return;
    }
    const now = performance.now();
    const dt = this.lastTime === 0 ? 1 / 60 : Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dz = Math.max(-80, Math.min(80, playerZ - this.lastPlayerZ));
    this.lastPlayerZ = playerZ;
    this.weatherField.position.z = playerZ;

    const fall = kind === "rain" ? 52 : kind === "snow" ? 14 : 6;
    const sway = kind === "rain" ? 0 : kind === "snow" ? 0.9 : 1.8;
    const pos = this.weatherPos;
    for (let i = 0; i < pos.length; i += 3) {
      let y = pos[i + 1] - fall * dt;
      let z = pos[i + 2] - dz;
      if (y < 0) y += WEATHER_HEIGHT;
      if (z < -WEATHER_BACK) z += WEATHER_SPAN;
      else if (z > WEATHER_SPAN - WEATHER_BACK) z -= WEATHER_SPAN;
      if (sway > 0) {
        const x = pos[i] + Math.sin(now * 0.0009 + i) * sway * dt;
        pos[i] = x > WEATHER_WIDTH / 2 ? -WEATHER_WIDTH / 2 : x < -WEATHER_WIDTH / 2 ? WEATHER_WIDTH / 2 : x;
      }
      pos[i + 1] = y;
      pos[i + 2] = z;
    }
    this.weatherAttr.needsUpdate = true;
  }

  private ownMat(params: THREE.MeshStandardMaterialParameters) {
    const material = new THREE.MeshStandardMaterial(params);
    this.cityMats.push(material);
    return material;
  }

  private addLayer(material: THREE.MeshStandardMaterial, count: number) {
    const layer = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count);
    layer.frustumCulled = false;
    this.cityLayers.push(layer);
    this.scene.add(layer);
    return layer;
  }

  private rebuildCity() {
    for (const layer of this.cityLayers) {
      this.scene.remove(layer);
      layer.geometry.dispose();
      layer.dispose();
    }
    for (const material of this.cityMats) {
      material.map?.dispose();
      material.dispose();
    }
    this.cityLayers = [];
    this.cityMats = [];
    this.citySlots = [];
    this.makeCity();
  }

  private makeCity() {
    this.horizonMat = this.ownMat(HORIZON_MATS[this.circuit.cityStyle]);
    if (this.circuit.cityStyle === "docks") this.buildDocks();
    else if (this.circuit.cityStyle === "glass") this.buildGlass();
    else if (this.circuit.cityStyle === "ridge") this.buildRidge();
    else if (this.circuit.cityStyle === "works") this.buildWorks();
    else if (this.circuit.cityStyle === "sprawl") this.buildSprawl();
    else if (this.circuit.cityStyle === "frost") this.buildFrost();
    else if (this.circuit.cityStyle === "kiln") this.buildKiln();
    else this.buildTowers();
    for (const layer of this.cityLayers) {
      if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
      layer.instanceMatrix.needsUpdate = true;
      layer.computeBoundingSphere();
    }
  }

  private buildTowers() {
    const towers = this.addLayer(this.towerMat, 72);
    const crowns = this.addLayer(this.ownMat({ color: 0x0c1016, roughness: 0.85, metalness: 0.2 }), 72);
    const slabs = this.addLayer(this.slabMat, 56);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.9, metalness: 0.08 }), 40);
    const antennas = this.addLayer(this.ownMat({ color: 0x1a222c, roughness: 0.45, metalness: 0.55 }), 36);
    const horizon = this.addLayer(this.horizonMat, 48);

    const tint = new THREE.Color();
    for (let i = 0; i < 72; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const sy = 16 + ring * 14 + (i % 9) * 2.8 + (i % 5) * 3;
      const sx = 4 + (i % 4) * 1.2 + ring * 0.8;
      const sz = 5 + (i % 5) * 1.1;
      const x = side * (20 + ring * 13 + (i % 6) * 2.4);
      const z = ((i + 0.5) / 72) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.03;
      this.pushSlot(towers, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(crowns, i, x, sy + 0.7, z, sx * 0.55, 1.4, sz * 0.55, yaw);
      tint.setHSL(0.55 + (i % 6) * 0.04, 0.1, 0.78 + (i % 5) * 0.04);
      towers.setColorAt(i, tint);
      tint.setRGB(0.55, 0.58, 0.62);
      crowns.setColorAt(i, tint);
      if (i < 36) {
        this.pushSlot(antennas, i, x, sy + 3.1, z, 0.18, 4.2 + (i % 3), 0.18, yaw);
      }
    }
    for (let i = 0; i < 56; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 7 + (i % 7) * 1.5;
      this.pushSlot(
        slabs,
        i,
        side * (16 + (i % 5) * 3.4),
        sy / 2,
        ((i + 0.2) / 56) * CITY_SPAN,
        6.5 + (i % 4) * 1.6,
        sy,
        4 + (i % 3),
        ((i % 5) - 2) * 0.04,
      );
      tint.setHSL(0.08 + (i % 4) * 0.03, 0.1, 0.74 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (12.2 + (i % 4) * 1.5),
        1.15,
        ((i + 0.6) / 40) * CITY_SPAN,
        3.2 + (i % 3) * 0.6,
        2.3,
        4.4 + (i % 2),
        0,
      );
      tint.setHSL(0.08, 0.08, 0.7 + (i % 4) * 0.05);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 38 + (i % 8) * 7;
      this.pushSlot(
        horizon,
        i,
        side * (54 + (i % 6) * 9),
        sy / 2,
        ((i + 0.15) / 48) * CITY_SPAN,
        9 + (i % 4) * 3,
        sy,
        8 + (i % 3) * 2,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.58, 0.08, 0.22 + (i % 4) * 0.05);
      horizon.setColorAt(i, tint);
    }
  }

  private buildDocks() {
    const towers = this.addLayer(this.towerMat, 24);
    const slabs = this.addLayer(this.slabMat, 60);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.92, metalness: 0.06 }), 46);
    const steel = this.ownMat({
      color: 0x2e1e12,
      roughness: 0.5,
      metalness: 0.5,
      emissive: 0x180a02,
      emissiveIntensity: 0.35,
    });
    const masts = this.addLayer(steel, 20);
    const jibs = this.addLayer(steel, 20);
    const horizon = this.addLayer(this.horizonMat, 40);

    const tint = new THREE.Color();
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 12 + (i % 5) * 4.5 + (i % 3) * 2;
      this.pushSlot(
        towers,
        i,
        side * (30 + (i % 5) * 7),
        sy / 2,
        ((i + 0.5) / 24) * CITY_SPAN,
        5 + (i % 4) * 1.6,
        sy,
        6 + (i % 3) * 1.4,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.08 + (i % 4) * 0.02, 0.22, 0.7 + (i % 3) * 0.05);
      towers.setColorAt(i, tint);
    }
    for (let i = 0; i < 60; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 4.5 + (i % 5) * 1.4;
      this.pushSlot(
        slabs,
        i,
        side * (14 + (i % 5) * 4.2),
        sy / 2,
        ((i + 0.2) / 60) * CITY_SPAN,
        10 + (i % 4) * 2.6,
        sy,
        6 + (i % 3) * 1.8,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.07 + (i % 4) * 0.02, 0.18, 0.66 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 46; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (10.8 + (i % 4) * 1.3),
        1.35,
        ((i + 0.6) / 46) * CITY_SPAN,
        3.6 + (i % 3) * 0.8,
        2.7,
        5 + (i % 2) * 1.6,
        0,
      );
      tint.setHSL(0.07, 0.16, 0.66 + (i % 4) * 0.05);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 17 + (i % 3) * 5;
      const x = side * (24 + (i % 4) * 5);
      const z = ((i + 0.35) / 20) * CITY_SPAN;
      this.pushSlot(masts, i, x, h / 2, z, 0.5, h, 0.5, 0);
      this.pushSlot(jibs, i, x - side * 4.5, h - 1.2, z, 11, 0.4, 0.4, 0);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 20 + (i % 6) * 6;
      this.pushSlot(
        horizon,
        i,
        side * (56 + (i % 5) * 11),
        sy / 2,
        ((i + 0.15) / 40) * CITY_SPAN,
        16 + (i % 4) * 5,
        sy,
        12 + (i % 3) * 4,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.07, 0.12, 0.2 + (i % 4) * 0.04);
      horizon.setColorAt(i, tint);
    }
  }

  private buildGlass() {
    const towers = this.addLayer(this.towerMat, 84);
    const crowns = this.addLayer(this.ownMat({ color: 0x0e161e, roughness: 0.6, metalness: 0.35 }), 84);
    const slabs = this.addLayer(this.slabMat, 24);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.85, metalness: 0.12 }), 10);
    const antennas = this.addLayer(this.ownMat({ color: 0x243240, roughness: 0.4, metalness: 0.6 }), 40);
    const horizon = this.addLayer(this.horizonMat, 44);

    const tint = new THREE.Color();
    for (let i = 0; i < 84; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const sy = 34 + ring * 18 + (i % 9) * 3.4;
      const sx = 2.4 + (i % 4) * 0.7 + ring * 0.5;
      const sz = 3 + (i % 5) * 0.7;
      const x = side * (12.5 + ring * 10 + (i % 6) * 1.6);
      const z = ((i + 0.5) / 84) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.02;
      this.pushSlot(towers, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(crowns, i, x, sy + 1.1, z, sx * 0.42, 2.2, sz * 0.42, yaw);
      tint.setHSL(0.54 + (i % 6) * 0.02, 0.16, 0.8 + (i % 5) * 0.03);
      towers.setColorAt(i, tint);
      tint.setRGB(0.6, 0.68, 0.74);
      crowns.setColorAt(i, tint);
      if (i < 40) {
        this.pushSlot(antennas, i, x, sy + 3.4, z, 0.14, 5 + (i % 3), 0.14, yaw);
      }
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 9 + (i % 5) * 2;
      this.pushSlot(
        slabs,
        i,
        side * (15 + (i % 4) * 3),
        sy / 2,
        ((i + 0.2) / 24) * CITY_SPAN,
        5 + (i % 3) * 1.5,
        sy,
        4 + (i % 2),
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.55 + (i % 4) * 0.02, 0.14, 0.78 + (i % 3) * 0.04);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (11.5 + (i % 3) * 1.2),
        1.1,
        ((i + 0.6) / 10) * CITY_SPAN,
        3,
        2.2,
        4,
        0,
      );
      tint.setHSL(0.56, 0.1, 0.72);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 44; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 60 + (i % 8) * 11;
      this.pushSlot(
        horizon,
        i,
        side * (48 + (i % 6) * 9),
        sy / 2,
        ((i + 0.15) / 44) * CITY_SPAN,
        8 + (i % 4) * 2.6,
        sy,
        8 + (i % 3) * 2,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.56, 0.12, 0.26 + (i % 4) * 0.05);
      horizon.setColorAt(i, tint);
    }
  }

  private buildRidge() {
    const cliffs = this.addLayer(this.horizonMat, 44);
    const rocks = this.addLayer(
      this.ownMat({ color: 0x3a2e22, roughness: 1, metalness: 0.02, flatShading: true }),
      44,
    );
    const towers = this.addLayer(this.towerMat, 10);
    const slabs = this.addLayer(this.slabMat, 12);
    const antennas = this.addLayer(this.ownMat({ color: 0x241c14, roughness: 0.5, metalness: 0.45 }), 6);

    const tint = new THREE.Color();
    for (let i = 0; i < 44; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 28 + (i % 7) * 11;
      this.pushSlot(
        cliffs,
        i,
        side * (40 + (i % 5) * 15),
        sy / 2,
        ((i + 0.15) / 44) * CITY_SPAN,
        24 + (i % 4) * 9,
        sy,
        20 + (i % 3) * 9,
        ((i % 5) - 2) * 0.05,
      );
      tint.setHSL(0.09, 0.14, 0.16 + (i % 4) * 0.04);
      cliffs.setColorAt(i, tint);
    }
    for (let i = 0; i < 44; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 1.4 + (i % 4) * 0.9;
      this.pushSlot(
        rocks,
        i,
        side * (10.4 + (i % 5) * 2.4),
        sy / 2,
        ((i + 0.6) / 44) * CITY_SPAN,
        2.2 + (i % 3) * 1.2,
        sy,
        2.4 + (i % 2) * 1.3,
        ((i % 5) - 2) * 0.24,
      );
      tint.setHSL(0.08, 0.12, 0.3 + (i % 4) * 0.06);
      rocks.setColorAt(i, tint);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 14 + (i % 4) * 6;
      const x = side * (30 + (i % 3) * 9);
      const z = ((i + 0.5) / 10) * CITY_SPAN;
      this.pushSlot(towers, i, x, sy / 2, z, 4 + (i % 3), sy, 4 + (i % 2), 0);
      tint.setHSL(0.09 + (i % 4) * 0.02, 0.2, 0.68 + (i % 3) * 0.05);
      towers.setColorAt(i, tint);
      if (i < 6) {
        this.pushSlot(antennas, i, x, sy + 3.6, z, 0.16, 7 + (i % 3), 0.16, 0);
      }
    }
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 4 + (i % 3) * 1.2;
      this.pushSlot(
        slabs,
        i,
        side * (18 + (i % 4) * 4),
        sy / 2,
        ((i + 0.2) / 12) * CITY_SPAN,
        6 + (i % 3) * 1.5,
        sy,
        5,
        ((i % 5) - 2) * 0.04,
      );
      tint.setHSL(0.09, 0.16, 0.62 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
  }

  private buildWorks() {
    const towers = this.addLayer(this.towerMat, 16);
    const slabs = this.addLayer(this.slabMat, 56);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.92, metalness: 0.06 }), 22);
    const steel = this.ownMat({
      color: 0x1a2e28,
      roughness: 0.48,
      metalness: 0.55,
      emissive: 0x062418,
      emissiveIntensity: 0.32,
    });
    const masts = this.addLayer(steel, 16);
    const jibs = this.addLayer(steel, 16);
    const horizon = this.addLayer(this.horizonMat, 40);

    const tint = new THREE.Color();
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 10 + (i % 5) * 3.5 + (i % 3) * 1.8;
      this.pushSlot(
        towers,
        i,
        side * (32 + (i % 5) * 6),
        sy / 2,
        ((i + 0.5) / 16) * CITY_SPAN,
        4.5 + (i % 4) * 1.2,
        sy,
        5 + (i % 3) * 1.2,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.46 + (i % 4) * 0.02, 0.18, 0.68 + (i % 3) * 0.05);
      towers.setColorAt(i, tint);
    }
    for (let i = 0; i < 56; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 3 + (i % 6) * 1;
      this.pushSlot(
        slabs,
        i,
        side * (12 + (i % 5) * 2),
        sy / 2,
        ((i + 0.2) / 56) * CITY_SPAN,
        12 + (i % 4) * 2.4,
        sy,
        5 + (i % 3) * 1.4,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.45 + (i % 4) * 0.015, 0.16, 0.62 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (16 + (i % 4) * 2.2),
        1.2,
        ((i + 0.6) / 22) * CITY_SPAN,
        4 + (i % 3) * 0.8,
        2.4,
        5.2 + (i % 2) * 1.4,
        0,
      );
      tint.setHSL(0.47, 0.14, 0.64 + (i % 4) * 0.05);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 22 + (i % 3) * 6;
      const x = side * (26 + (i % 4) * 5);
      const z = ((i + 0.35) / 16) * CITY_SPAN;
      this.pushSlot(masts, i, x, h / 2, z, 0.35, h, 0.35, 0);
      this.pushSlot(jibs, i, x, h - 0.5, z, 5.4, 0.28, 5.4, 0);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 14 + (i % 6) * 4;
      this.pushSlot(
        horizon,
        i,
        side * (58 + (i % 5) * 10),
        sy / 2,
        ((i + 0.15) / 40) * CITY_SPAN,
        18 + (i % 4) * 6,
        sy,
        14 + (i % 3) * 4,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.48, 0.1, 0.16 + (i % 4) * 0.04);
      horizon.setColorAt(i, tint);
    }
  }

  private buildSprawl() {
    const towers = this.addLayer(this.towerMat, 96);
    const crowns = this.addLayer(
      this.ownMat({
        color: 0x1a1018,
        roughness: 0.7,
        metalness: 0.28,
        emissive: 0x2a1020,
        emissiveIntensity: 0.22,
      }),
      96,
    );
    const slabs = this.addLayer(this.slabMat, 48);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.88, metalness: 0.1 }), 18);
    const antennas = this.addLayer(this.ownMat({ color: 0x2a1824, roughness: 0.42, metalness: 0.58 }), 64);
    const horizon = this.addLayer(this.horizonMat, 64);

    const tint = new THREE.Color();
    for (let i = 0; i < 96; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 4;
      const sy = 18 + ring * 12 + (i % 9) * 2.4 + (i % 5) * 2.2;
      const sx = 3.2 + (i % 4) * 0.9 + ring * 0.4;
      const sz = 3.6 + (i % 5) * 0.8;
      const x = side * (11 + ring * 8 + (i % 6) * 1.4);
      const z = ((i + 0.5) / 96) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.025;
      this.pushSlot(towers, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(crowns, i, x, sy + 0.8, z, sx * 0.5, 1.6, sz * 0.5, yaw);
      tint.setHSL(0.85 + (i % 6) * 0.018, 0.22, 0.72 + (i % 5) * 0.04);
      towers.setColorAt(i, tint);
      tint.setRGB(0.72, 0.58, 0.68);
      crowns.setColorAt(i, tint);
      if (i < 64) {
        this.pushSlot(antennas, i, x, sy + 3.4, z, 0.16, 4.8 + (i % 4), 0.16, yaw);
      }
    }
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 8 + (i % 6) * 1.8;
      this.pushSlot(
        slabs,
        i,
        side * (13 + (i % 4) * 2.6),
        sy / 2,
        ((i + 0.2) / 48) * CITY_SPAN,
        10 + (i % 4) * 2.8,
        sy,
        1.4 + (i % 3) * 0.4,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.88 + (i % 4) * 0.02, 0.2, 0.7 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (11.4 + (i % 3) * 1.1),
        1.05,
        ((i + 0.6) / 18) * CITY_SPAN,
        2.8 + (i % 3) * 0.5,
        2.1,
        3.6,
        0,
      );
      tint.setHSL(0.9, 0.12, 0.66 + (i % 3) * 0.04);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 64; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 48 + (i % 8) * 9;
      this.pushSlot(
        horizon,
        i,
        side * (42 + (i % 6) * 6),
        sy / 2,
        ((i + 0.15) / 64) * CITY_SPAN,
        12 + (i % 4) * 2.4,
        sy,
        10 + (i % 3) * 2,
        ((i % 5) - 2) * 0.015,
      );
      tint.setHSL(0.9, 0.14, 0.2 + (i % 4) * 0.05);
      horizon.setColorAt(i, tint);
    }
  }

  private buildFrost() {
    const slabs = this.addLayer(this.slabMat, 48);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.88, metalness: 0.1 }), 12);
    const towers = this.addLayer(this.towerMat, 10);
    const crowns = this.addLayer(this.ownMat({ color: 0x0e161c, roughness: 0.7, metalness: 0.22 }), 10);
    const horizon = this.addLayer(this.horizonMat, 40);

    const tint = new THREE.Color();
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 4 + (i % 7);
      this.pushSlot(
        slabs,
        i,
        side * (12 + (i % 5) * 2.5),
        sy / 2,
        ((i + 0.2) / 48) * CITY_SPAN,
        10 + (i % 4) * 2.4,
        sy,
        5 + (i % 3) * 1.2,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.55 + (i % 4) * 0.015, 0.08, 0.74 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (16 + (i % 3) * 2.4),
        1.05,
        ((i + 0.6) / 12) * CITY_SPAN,
        4.2 + (i % 3) * 0.8,
        2.1,
        5 + (i % 2) * 1.2,
        0,
      );
      tint.setHSL(0.56, 0.08, 0.68 + (i % 3) * 0.04);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 16 + (i % 4) * 6;
      const sx = 3.5 + (i % 3);
      const sz = 4 + (i % 2);
      const x = side * (32 + (i % 3) * 8);
      const z = ((i + 0.5) / 10) * CITY_SPAN;
      this.pushSlot(towers, i, x, sy / 2, z, sx, sy, sz, 0);
      this.pushSlot(crowns, i, x, sy + 0.7, z, sx * 0.5, 1.4, sz * 0.5, 0);
      tint.setHSL(0.55 + (i % 4) * 0.02, 0.1, 0.76 + (i % 3) * 0.04);
      towers.setColorAt(i, tint);
      tint.setRGB(0.62, 0.7, 0.76);
      crowns.setColorAt(i, tint);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 22 + (i % 6) * 8;
      this.pushSlot(
        horizon,
        i,
        side * (52 + (i % 5) * 12),
        sy / 2,
        ((i + 0.15) / 40) * CITY_SPAN,
        20 + (i % 4) * 8,
        sy,
        16 + (i % 3) * 6,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.55, 0.08, 0.18 + (i % 4) * 0.04);
      horizon.setColorAt(i, tint);
    }
  }

  private buildKiln() {
    const brick = this.ownMat({
      color: 0x3a2218,
      roughness: 0.92,
      metalness: 0.08,
      emissive: 0x2a1008,
      emissiveIntensity: 0.28,
    });
    const stacks = this.addLayer(brick, 18);
    const crowns = this.addLayer(this.ownMat({ color: 0x1a0c08, roughness: 0.85, metalness: 0.12 }), 18);
    const slabs = this.addLayer(this.slabMat, 52);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.94, metalness: 0.05 }), 14);
    const horizon = this.addLayer(this.horizonMat, 40);

    const tint = new THREE.Color();
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 18 + (i % 9) * 2;
      const x = side * (22 + (i % 4) * 6);
      const z = ((i + 0.35) / 18) * CITY_SPAN;
      this.pushSlot(stacks, i, x, sy / 2, z, 0.7, sy, 0.7, 0);
      this.pushSlot(crowns, i, x, sy + 0.45, z, 1.15, 0.9, 1.15, 0);
      tint.setHSL(0.04 + (i % 3) * 0.015, 0.22, 0.42 + (i % 3) * 0.06);
      stacks.setColorAt(i, tint);
      tint.setRGB(0.35, 0.18, 0.12);
      crowns.setColorAt(i, tint);
    }
    for (let i = 0; i < 52; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 4 + (i % 5) * 1.3;
      this.pushSlot(
        slabs,
        i,
        side * (14 + (i % 5) * 3.6),
        sy / 2,
        ((i + 0.2) / 52) * CITY_SPAN,
        10 + (i % 4) * 2.8,
        sy,
        6 + (i % 3) * 1.6,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.05 + (i % 4) * 0.012, 0.2, 0.58 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (12 + (i % 4) * 1.8),
        1.2,
        ((i + 0.6) / 14) * CITY_SPAN,
        3.8 + (i % 3) * 0.7,
        2.4,
        4.8 + (i % 2) * 1.2,
        0,
      );
      tint.setHSL(0.05, 0.18, 0.56 + (i % 4) * 0.05);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 18 + (i % 6) * 5;
      this.pushSlot(
        horizon,
        i,
        side * (54 + (i % 5) * 10),
        sy / 2,
        ((i + 0.15) / 40) * CITY_SPAN,
        16 + (i % 4) * 5,
        sy,
        12 + (i % 3) * 4,
        ((i % 5) - 2) * 0.02,
      );
      tint.setHSL(0.04, 0.14, 0.16 + (i % 4) * 0.04);
      horizon.setColorAt(i, tint);
    }
  }

  private pushSlot(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
  ) {
    const slot: CitySlot = { mesh, index, x, y, z, sx, sy, sz, yaw };
    this.citySlots.push(slot);
    this.cityDummy.position.set(x, y, z);
    this.cityDummy.scale.set(sx, sy, sz);
    this.cityDummy.rotation.set(0, yaw, 0);
    this.cityDummy.updateMatrix();
    mesh.setMatrixAt(index, this.cityDummy.matrix);
  }

  private rebuildSegments() {
    for (const segment of this.segments) {
      this.group.remove(segment);
      this.disposeSegment(segment);
    }
    this.segments = [];
    for (let i = 0; i < ROAD.segmentCount; i++) {
      const segment = this.makeSegment(i);
      segment.position.z = i * ROAD.segmentLength;
      this.segments.push(segment);
      this.group.add(segment);
    }
  }

  private disposeSegment(segment: THREE.Group) {
    const seen = new Set<THREE.BufferGeometry>();
    segment.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (this.sharedGeo.has(mesh.geometry) || seen.has(mesh.geometry)) return;
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    });
    const owned = this.segmentMats.get(segment);
    if (owned) {
      for (const material of owned) {
        material.map?.dispose();
        material.dispose();
      }
    }
    this.segmentMats.delete(segment);
  }

  /** Track materials minted for one segment so a circuit swap can free them. */
  private own(segment: THREE.Group, ...mats: THREE.MeshStandardMaterial[]) {
    const list = this.segmentMats.get(segment);
    if (list) list.push(...mats);
    else this.segmentMats.set(segment, mats);
  }

  private makeSegment(index: number) {
    const g = new THREE.Group();
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD.width + 1.2, ROAD.segmentLength),
      this.roadMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    g.add(road);

    const style = this.circuit.cityStyle;
    for (const side of [-1, 1]) {
      const gravel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, ROAD.segmentLength),
        this.gravelMat,
      );
      gravel.rotation.x = -Math.PI / 2;
      gravel.position.set(side * (ROAD.halfWidth + 1.35), 0.002, 0);
      g.add(gravel);

      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, ROAD.segmentLength), this.kerbMat);
      kerb.position.set(side * (ROAD.halfWidth + 0.18), 0.06, 0);
      g.add(kerb);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, ROAD.segmentLength), this.edgeMat);
      edge.position.set(side * (ROAD.halfWidth + 0.02), 0.04, 0);
      g.add(edge);

      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, ROAD.segmentLength), this.wallMat);
      wall.position.set(side * (ROAD.halfWidth + 1.12), 0.42, 0);
      g.add(wall);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, ROAD.segmentLength), this.wallMat);
      rail.position.set(side * (ROAD.halfWidth + 1.12), 0.8, 0);
      g.add(rail);

      const pole = createLightPole();
      pole.position.set(side * (ROAD.halfWidth + 2.6), 0, 0);
      if (side > 0) pole.rotation.y = Math.PI;
      g.add(pole);

      g.add(this.makeVerge(index, side, style));

      for (const z of [-16, 0, 16]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.09), this.eyeMat);
        eye.position.set(side * (ROAD.halfWidth + 0.02), 0.085, z);
        g.add(eye);
      }

      for (const z of [-14, 14]) {
        const post = new THREE.Mesh(this.postGeo, this.eyeMat);
        post.position.set(side * (ROAD.halfWidth + 1.55), 0.38, z);
        g.add(post);
      }
    }

    const flavor = index % 8;
    if (index === 1 || (flavor === 2 && index >= 1)) this.addGantry(g, index);
    if (flavor === 5 && index >= 1) this.addBillboard(g, index);
    if (flavor === 7 && index > 2) this.addTunnel(g);
    if (flavor === 3 && index >= 1) this.addMarshal(g, index);
    if (flavor === 4 && index >= 1) this.addDistanceMarker(g, index);
    if (flavor === 0) this.addCones(g, index);
    if (flavor === 6) this.addBarrels(g, index);
    if (flavor === 1) this.addTracksideCamera(g, index);

    return g;
  }

  private makeVerge(index: number, side: number, style: CityStyle) {
    if (style === "docks") {
      const stack = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const crate = new THREE.Mesh(this.crateGeo, this.propMat);
        const s = 0.9 + ((index + i) % 3) * 0.22;
        crate.scale.set(s, s * 0.8, s);
        crate.position.set(i * 0.35, s * 0.4, i * 1.4 - 1.4);
        crate.rotation.y = ((index + i) % 5) * 0.12;
        stack.add(crate);
      }
      stack.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return stack;
    }
    if (style === "ridge") {
      const cluster = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const rock = new THREE.Mesh(this.rockGeo, this.propMat);
        const s = 0.6 + ((index + i * 3) % 4) * 0.28;
        rock.scale.set(s * 1.2, s * 0.8, s);
        rock.position.set(i * 0.5, s * 0.3, i * 1.8 - 2);
        rock.rotation.set(i * 0.4, index * 0.3 + i, i * 0.2);
        cluster.add(rock);
      }
      cluster.position.set(side * (ROAD.halfWidth + 3.7), 0, ((index * 7) % 11) - 5);
      return cluster;
    }
    if (style === "glass") {
      const cluster = new THREE.Group();
      const count = 2 + (index % 2);
      for (let i = 0; i < count; i++) {
        const planter = new THREE.Mesh(this.crateGeo, this.propMat);
        planter.scale.set(0.5, 1.4, 0.5);
        planter.position.set(i * 0.55, 0.7, i * 1.2 - 1.2);
        const pane = new THREE.Mesh(this.crateGeo, this.propMat);
        pane.scale.set(0.38, 0.06, 0.38);
        pane.position.set(i * 0.55, 1.43, i * 1.2 - 1.2);
        cluster.add(planter, pane);
      }
      cluster.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return cluster;
    }
    if (style === "works") {
      const stack = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const crate = new THREE.Mesh(this.crateGeo, this.propMat);
        const s = 0.95 + ((index + i) % 3) * 0.18;
        crate.scale.set(s * 1.15, s * 0.5, s);
        crate.position.set(i * 0.22, s * 0.25, i * 1.15 - 1.15);
        crate.rotation.y = ((index + i) % 5) * 0.1;
        stack.add(crate);
      }
      stack.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return stack;
    }
    if (style === "sprawl") {
      const row = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const post = new THREE.Mesh(this.crateGeo, this.propMat);
        post.scale.set(0.18, 0.9, 0.18);
        post.position.set(i * 0.28, 0.45, i * 1.5 - 1.5);
        row.add(post);
      }
      row.position.set(side * (ROAD.halfWidth + 3.8), 0, ((index * 7) % 11) - 5);
      return row;
    }
    if (style === "frost") {
      const cluster = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(this.rockGeo, this.propMat);
        const s = 0.7 + ((index + i) % 3) * 0.18;
        shard.scale.set(s * 0.4, s * 1.1, s * 0.35);
        shard.position.set(i * 0.4, s * 0.45, i * 1.5 - 1.5);
        shard.rotation.set(i * 0.2, index * 0.25 + i, i * 0.15);
        cluster.add(shard);
      }
      cluster.position.set(side * (ROAD.halfWidth + 3.7), 0, ((index * 7) % 11) - 5);
      return cluster;
    }
    if (style === "kiln") {
      const stack = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const brick = new THREE.Mesh(this.crateGeo, this.propMat);
        const s = 0.95 + ((index + i) % 3) * 0.16;
        brick.scale.set(s * 1.2, s * 0.38, s * 0.85);
        brick.position.set(i * 0.28, s * 0.19, i * 1.25 - 1.25);
        brick.rotation.y = ((index + i) % 5) * 0.08;
        stack.add(brick);
      }
      stack.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return stack;
    }
    const tree = createTree();
    tree.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
    tree.scale.setScalar(0.88 + (index % 5) * 0.12);
    return tree;
  }

  private addCones(g: THREE.Group, index: number) {
    const side = index % 2 === 0 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(this.coneGeo, this.coneMat);
      cone.position.set(side * (ROAD.halfWidth + 0.72), 0.23, -12 + i * 6);
      g.add(cone);
    }
  }

  private addBarrels(g: THREE.Group, index: number) {
    const side = index % 2 === 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const barrel = new THREE.Mesh(this.barrelGeo, this.barrelMat);
      barrel.position.set(side * (ROAD.halfWidth + 1.85), 0.39, 4 + i * 1.1);
      g.add(barrel);
    }
  }

  private addTracksideCamera(g: THREE.Group, index: number) {
    const side = index % 2 === 0 ? -1 : 1;
    const pole = new THREE.Mesh(this.camPoleGeo, this.postMat);
    pole.position.set(side * (ROAD.halfWidth + 2.05), 1.05, -2);
    const head = new THREE.Mesh(this.camHeadGeo, this.camMat);
    head.position.set(side * (ROAD.halfWidth + 1.86), 2.05, -2);
    head.rotation.y = side < 0 ? 0.4 : -0.4;
    const lens = new THREE.Mesh(this.camHeadGeo, this.eyeMat);
    lens.scale.set(0.22, 0.32, 0.12);
    lens.position.set(side * (ROAD.halfWidth + 1.72), 2.05, -1.82);
    g.add(pole, head, lens);
  }

  private addGantry(g: THREE.Group, index: number) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x151c26, metalness: 0.55, roughness: 0.38 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 6, 0.22, 0.5), steel);
    beam.position.set(0, 5.2, 0);
    const labels = [this.circuit.event, ...this.circuit.signs];
    const signMat = new THREE.MeshStandardMaterial({
      map: makeGantrySign(labels[index % labels.length], this.circuit.event),
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.2), signMat);
    sign.position.set(0, 4.55, 0.28);
    sign.rotation.y = Math.PI;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), steel);
    left.position.set(-(ROAD.halfWidth + 2.6), 2.6, 0);
    const right = left.clone();
    right.position.x *= -1;
    g.add(beam, sign, left, right);
    this.own(g, steel, signMat);
  }

  private addBillboard(g: THREE.Group, index: number) {
    const copy = this.circuit.boards[index % this.circuit.boards.length];
    const boardMat = new THREE.MeshStandardMaterial({
      map: makeBillboardTexture(
        copy.title,
        copy.color,
        copy.kicker,
        `${circuitTag(this.circuit)}  ·  ${this.circuit.name.toUpperCase()}`,
      ),
      emissive: 0x101418,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), boardMat);
    const side = index % 2 === 0 ? -1 : 1;
    board.position.set(side * (ROAD.halfWidth + 8.5), 6.2, 0);
    board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(board);
    this.own(g, boardMat);
  }

  private addTunnel(g: THREE.Group) {
    const lining = new THREE.MeshStandardMaterial({
      color: 0x121820,
      roughness: 0.78,
      metalness: 0.12,
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 8, 0.35, 16), lining);
    roof.position.y = 5.4;
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffe6c4,
      emissive: 0xffe0b0,
      emissiveIntensity: 0.35,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 6, 0.04, 0.08), stripMat);
    strip.position.set(0, 5.18, 0);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 16), lining);
      wall.position.set(side * (ROAD.halfWidth + 3.4), 2.7, 0);
      g.add(wall);
    }
    g.add(roof, strip);
    this.own(g, lining, stripMat);
  }

  private addMarshal(g: THREE.Group, index: number) {
    const side = index % 2 === 0 ? -1 : 1;
    const post = new THREE.Mesh(this.signPostGeo, this.postMat);
    post.position.set(side * (ROAD.halfWidth + 2.15), 0.6, 8);
    const board = new THREE.Mesh(this.marshalGeo, this.marshalMats[index % 2]);
    board.position.set(side * (ROAD.halfWidth + 2.15), 1.28, 8.04);
    board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(post, board);
  }

  private addDistanceMarker(g: THREE.Group, index: number) {
    const side = index % 2 === 0 ? 1 : -1;
    const post = new THREE.Mesh(this.signPostGeo, this.postMat);
    post.position.set(side * (ROAD.halfWidth + 1.85), 0.6, -6);
    const board = new THREE.Mesh(this.distGeo, this.distMats[index % this.distMats.length]);
    board.position.set(side * (ROAD.halfWidth + 1.85), 1.32, -6);
    board.rotation.y = Math.PI;
    g.add(post, board);
  }
}
