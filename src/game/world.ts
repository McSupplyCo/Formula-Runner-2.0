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
  makeGrassTexture,
  makeHillTexture,
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

export const CITY_SPAN = 1320;
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

/** Two-step New Jersey profile: wide foot, knee, sloped face, narrow cap. */
function makeJerseyGeometry(length: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0);
  shape.lineTo(0.32, 0);
  shape.lineTo(0.24, 0.3);
  shape.lineTo(0.11, 0.84);
  shape.lineTo(-0.11, 0.84);
  shape.lineTo(-0.24, 0.3);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -length / 2);
  geo.computeVertexNormals();
  return geo;
}

const HORIZON_MATS: Record<CityStyle, THREE.MeshStandardMaterialParameters> = {
  towers: { color: 0x2a3a28, roughness: 0.94, metalness: 0.04, emissive: 0x1a2818, emissiveIntensity: 0.08 },
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
  private grassMat: THREE.MeshStandardMaterial;
  private hillMat: THREE.MeshStandardMaterial;
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
  private fill: THREE.DirectionalLight;
  private daySky = false;
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
  private grassGeo: THREE.PlaneGeometry;
  private jerseyGeo: THREE.ExtrudeGeometry;
  private railPostGeo: THREE.BoxGeometry;
  private railBeamGeo: THREE.BoxGeometry;
  private railMat: THREE.MeshStandardMaterial;
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
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.22,
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
      roughness: 0.78,
      metalness: 0.12,
      envMapIntensity: 0.35,
    });
    this.gravelMat = new THREE.MeshStandardMaterial({
      map: makeGravelTexture(),
      color: circuit.gravel,
      roughness: 1,
      metalness: 0,
    });
    const grassMap = makeGrassTexture();
    grassMap.repeat.set(4, 6);
    this.grassMat = new THREE.MeshStandardMaterial({
      map: grassMap,
      color: 0x3a6a32,
      roughness: 1,
      metalness: 0,
    });
    this.hillMat = new THREE.MeshStandardMaterial({
      map: makeHillTexture(),
      color: 0x3d5a32,
      roughness: 0.96,
      metalness: 0.02,
    });
    this.towerMat = new THREE.MeshStandardMaterial({
      map: makeBuildingTexture(zone.window),
      roughness: 0.8,
      metalness: 0.14,
      envMapIntensity: 0.3,
      emissive: new THREE.Color(0x101820),
      emissiveIntensity: 0.06,
    });
    this.slabMat = new THREE.MeshStandardMaterial({
      map: makeSlabFacade(zone.window),
      roughness: 0.76,
      metalness: 0.16,
      envMapIntensity: 0.28,
      emissive: new THREE.Color(0x101820),
      emissiveIntensity: 0.04,
    });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf0e6c8,
      emissive: 0xffe7b0,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.2,
    });

    this.daySky = zone.star < 0.05 && circuit.cityStyle === "towers";
    this.hemi = new THREE.HemisphereLight(0xb4d8f4, 0x3a5a28, this.daySky ? 1.22 : 0.72);
    this.moon = new THREE.DirectionalLight(0xfff4d4, this.daySky ? 2.45 : 1.12);
    this.moon.position.set(this.daySky ? -52 : -22, this.daySky ? 148 : 44, this.daySky ? 48 : 12);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    this.fill = new THREE.DirectionalLight(0xc5e0f4, 0.28);
    this.fill.position.set(22, 36, -12);
    scene.add(this.hemi, this.moon, this.moon.target, this.fill);
    this.fitShadow(this.daySky);

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
    this.grassGeo = new THREE.PlaneGeometry(14, ROAD.segmentLength);
    this.jerseyGeo = makeJerseyGeometry(ROAD.segmentLength);
    this.railPostGeo = new THREE.BoxGeometry(0.09, 0.78, 0.09);
    this.railBeamGeo = new THREE.BoxGeometry(0.07, 0.09, ROAD.segmentLength);
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
      this.grassGeo,
      this.jerseyGeo,
      this.railPostGeo,
      this.railBeamGeo,
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
    this.railMat = new THREE.MeshStandardMaterial({
      color: 0x8a9296,
      roughness: 0.38,
      metalness: 0.72,
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
      const lamp = new THREE.SpotLight(0xffe4bc, this.daySky ? 0 : 10.5, 34, 0.55, 0.78, 1.45);
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
    this.stars.visible = zone.star >= 0.05;
    scene.add(this.stars);

    this.weatherField = this.makeWeatherField();
    scene.add(this.weatherField);

    this.makeCity();

    const groundMap = makeGrassTexture();
    groundMap.repeat.set(28, 42);
    this.groundMat = new THREE.MeshStandardMaterial({
      map: groundMap,
      color: circuit.ground,
      roughness: 1,
      metalness: 0,
    });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 3200), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.18;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    this.applyPalette(circuit);
    this.applyWeather(zone.weather ?? "clear");
    this.rebuildSegments();
    this.applyZone(zone);
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
    const now = performance.now();
    const dt = this.lastTime === 0 ? 0 : Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const zone = zoneInWorld(distance, this.circuit);
    this.applyZone(zone, dt);

    const start = Math.floor((playerZ - ROAD.segmentLength) / ROAD.segmentLength);
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].position.z = (start + i) * ROAD.segmentLength;
    }

    this.ground.position.z = playerZ + 240;
    this.stars.position.z = playerZ;
    this.sky.position.z = playerZ;
    if (this.daySky) this.moon.position.set(-52, 148, playerZ + 48);
    else this.moon.position.set(-22, 44, playerZ + 12);
    this.moon.target.position.set(0, 0, playerZ);
    this.moon.target.updateMatrixWorld();

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
    if (world.cityStyle === "towers") {
      this.groundMat.color.lerp(new THREE.Color(0x4a7a38), 0.42);
    }
    this.propMat.color.setHex(world.gravel);
    this.grassMat.color.setHex(world.ground).lerp(new THREE.Color(0x4a7a38), 0.4);
    this.hillMat.color.setHex(world.ground).lerp(new THREE.Color(0x3d5a32), 0.45);
    this.kerbMat.color.setHex(0xffffff).lerp(this.zoneTint.setHex(world.neon), 0.14);
  }

  private applyZone(zone: Zone, dt = 0) {
    const snap = dt <= 0 ? 1 : 1 - Math.exp(-1.2 * dt);
    this.fog.color.lerp(new THREE.Color(zone.fog), snap);
    this.fog.density += (zone.fogDensity - this.fog.density) * snap;
    const day = zone.star < 0.05 && this.circuit.cityStyle === "towers";
    (this.skyMat.uniforms.horizon.value as THREE.Color).lerp(new THREE.Color(zone.horizon), snap);
    (this.skyMat.uniforms.top.value as THREE.Color).lerp(new THREE.Color(zone.top), snap);
    this.skyMat.uniforms.neon.value.setHex(zone.neon);
    this.skyMat.uniforms.glow.value = day ? 0 : zone.glow;
    this.skyMat.uniforms.dayAmount.value = day ? 1 : 0;
    this.skyMat.uniforms.sunColor.value.setHex(day ? 0xfff3c4 : zone.lamp);
    (this.skyMat.uniforms.sunDir.value as THREE.Vector3)
      .set(day ? -0.42 : -0.34, day ? 0.86 : 0.4, day ? 0.3 : 0.22)
      .normalize();
    this.zoneTint.set(zone.window);
    this.towerMat.emissive.copy(this.zoneTint).multiplyScalar(zone.cityEmit);
    this.slabMat.emissive.copy(this.zoneTint).multiplyScalar(zone.cityEmit * 0.82);
    const dayLit = day || this.circuit.cityStyle === "towers";
    this.towerMat.emissiveIntensity = dayLit ? zone.cityBoost * 0.28 : zone.cityBoost;
    this.slabMat.emissiveIntensity = dayLit ? zone.cityBoost * 0.14 : zone.cityBoost * 0.7;
    const horizonBase = HORIZON_MATS[this.circuit.cityStyle];
    this.horizonMat.color.set(horizonBase.color ?? 0x2a3a28);
    if (day) {
      this.horizonMat.color.lerp(new THREE.Color(this.circuit.ground), 0.55).lerp(new THREE.Color(0x5a7048), 0.35);
      this.horizonMat.emissive.setHex(0x000000);
      this.horizonMat.emissiveIntensity = 0;
    } else {
      this.horizonMat.emissive.copy(this.zoneTint).multiplyScalar(0.08);
      this.horizonMat.emissiveIntensity = zone.cityBoost * 0.35;
    }
    this.lightTint.setHex(zone.lamp);
    this.hemi.color.setHex(0xb4d8f4).lerp(this.zoneTint.setHex(zone.horizon), day ? 0.16 : 0.55);
    this.hemi.groundColor.setHex(0x3a5a28).lerp(new THREE.Color(this.circuit.ground), 0.5);
    this.hemi.intensity = day ? 1.28 : 0.72;
    this.moon.color.setHex(day ? 0xfff4d4 : zone.lamp);
    this.moon.intensity = day ? 2.45 : 1.12;
    this.fill.color.setHex(day ? 0xc5e0f4 : 0x1a3040);
    this.fill.intensity = day ? 0.3 : 0.16;
    if (this.daySky !== day) {
      this.daySky = day;
      this.fitShadow(day);
    }
    this.stars.visible = zone.star >= 0.05;
    this.starMat.opacity = zone.star * (zone.weather && zone.weather !== "clear" ? 0.38 : 1);
  }

  /** Tight ortho around the carriageway by day; wider moon coverage at night. */
  private fitShadow(day: boolean) {
    const cam = this.moon.shadow.camera as THREE.OrthographicCamera;
    if (day) {
      cam.near = 8;
      cam.far = 240;
      cam.left = -22;
      cam.right = 22;
      cam.top = 44;
      cam.bottom = -28;
      this.moon.shadow.bias = -0.0002;
      this.moon.shadow.normalBias = 0.035;
    } else {
      cam.near = 2;
      cam.far = 160;
      cam.left = -50;
      cam.right = 50;
      cam.top = 50;
      cam.bottom = -50;
      this.moon.shadow.bias = -0.0004;
      this.moon.shadow.normalBias = 0.06;
    }
    cam.updateProjectionMatrix();
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
      lamp.intensity = this.daySky ? 0 : this.stars.visible ? 10.5 : 1.4;
      lamp.position.set(pole.x * 0.82, 6.05, pole.z);
      lamp.target.position.set(pole.x * 0.22, 0.04, pole.z + 7);
    }
  }

  private makeSky() {
    const zone = this.circuit.zones[0];
    const day = zone.star < 0.05 && this.circuit.cityStyle === "towers";
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(zone.top) },
        horizon: { value: new THREE.Color(zone.horizon) },
        neon: { value: new THREE.Color(zone.neon) },
        glow: { value: day ? 0 : zone.glow },
        sunDir: { value: new THREE.Vector3(day ? -0.42 : -0.34, day ? 0.86 : 0.4, day ? 0.3 : 0.22).normalize() },
        sunColor: { value: new THREE.Color(day ? 0xfff3c4 : zone.lamp) },
        dayAmount: { value: day ? 1 : 0 },
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
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        uniform float dayAmount;
        void main() {
          float h = clamp(vPos.y / 220.0, -0.25, 1.0);
          vec3 col = mix(horizon, top, smoothstep(-0.04, 0.88, h));
          vec3 dir = normalize(vPos);
          float d = max(0.0, dot(dir, sunDir));
          col += sunColor * (pow(d, 78.0) * 5.4 + pow(d, 8.0) * 0.4) * dayAmount;
          col += sunColor * (1.0 - smoothstep(-0.04, 0.2, h)) * 0.12 * dayAmount;
          float night = 1.0 - dayAmount;
          float band = smoothstep(-0.05, 0.02, h) * (1.0 - smoothstep(0.04, 0.28, h));
          col = mix(col, neon, glow * band * night * 0.42);
          col += neon * glow * band * night * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  private makeStars() {
    const count = 360;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.18 + Math.random() * 0.82);
      const r = 340 + Math.random() * 160;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.max(64, Math.cos(phi) * r + 36);
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const disc = document.createElement("canvas");
    disc.width = 32;
    disc.height = 32;
    const ctx = disc.getContext("2d");
    if (ctx) {
      const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.35, "rgba(210,230,255,0.55)");
      glow.addColorStop(1, "rgba(180,210,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 32, 32);
    }
    const starMap = new THREE.CanvasTexture(disc);
    starMap.colorSpace = THREE.NoColorSpace;
    starMap.needsUpdate = true;
    this.starMat = new THREE.PointsMaterial({
      color: 0xcfe8ff,
      size: 1.35,
      map: starMap,
      transparent: true,
      opacity: this.circuit.zones[0].star,
      depthWrite: false,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    const stars = new THREE.Points(geo, this.starMat);
    stars.frustumCulled = false;
    stars.visible = this.circuit.zones[0].star >= 0.05;
    return stars;
  }

  private makeWeatherField() {
    const count = 192;
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
    const sprite = (draw: (ctx: CanvasRenderingContext2D, s: number) => void) => {
      const el = document.createElement("canvas");
      const s = 64;
      el.width = s;
      el.height = s;
      const ctx = el.getContext("2d");
      if (ctx) draw(ctx, s);
      const tex = new THREE.CanvasTexture(el);
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      return tex;
    };
    const rainMap = sprite((ctx, s) => {
      const g = ctx.createLinearGradient(s / 2, 0, s / 2, s);
      g.addColorStop(0, "rgba(220,236,255,0)");
      g.addColorStop(0.18, "rgba(220,236,255,0.18)");
      g.addColorStop(0.55, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(200,224,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(s * 0.47, 0, s * 0.06, s);
    });
    const dustMap = sprite((ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.48);
      g.addColorStop(0, "rgba(255,236,210,0.55)");
      g.addColorStop(0.45, "rgba(220,190,150,0.18)");
      g.addColorStop(1, "rgba(180,150,110,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    const snowMap = sprite((ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.42);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.4, "rgba(232,242,248,0.7)");
      g.addColorStop(1, "rgba(220,232,244,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    this.weatherMat = new THREE.PointsMaterial({
      color: 0xbfd6e8,
      size: 0.4,
      map: rainMap,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const field = new THREE.Points(geo, this.weatherMat);
    field.frustumCulled = false;
    field.visible = false;
    field.userData = { rainMap, dustMap, snowMap, live: 0, wrapY: WEATHER_HEIGHT };
    return field;
  }

  private applyWeather(kind: WeatherKind) {
    this.weatherKind = kind;
    this.weatherField.visible = kind !== "clear";
    const reduced =
      typeof document !== "undefined" &&
      Boolean(document.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const maps = this.weatherField.userData as {
      rainMap: THREE.Texture;
      dustMap: THREE.Texture;
      snowMap: THREE.Texture;
      live: number;
      wrapY: number;
    };
    const scatter = (live: number, yMax: number, width: number) => {
      const pos = this.weatherPos;
      for (let i = 0; i < pos.length; i += 3) {
        if (i / 3 >= live) {
          pos[i] = 0;
          pos[i + 1] = -40;
          pos[i + 2] = 0;
          continue;
        }
        pos[i] = (Math.random() - 0.5) * width;
        pos[i + 1] = Math.random() * yMax;
        pos[i + 2] = -WEATHER_BACK + Math.random() * WEATHER_SPAN;
      }
      maps.live = live;
      maps.wrapY = yMax;
      this.weatherAttr.needsUpdate = true;
    };
    if (kind === "rain") {
      this.weatherMat.color.setHex(0xc4dcf0);
      this.weatherMat.map = maps.rainMap;
      this.weatherMat.size = 2.15;
      this.weatherMat.opacity = reduced ? 0.22 : 0.4;
      this.weatherMat.blending = THREE.AdditiveBlending;
      this.weatherMat.fog = false;
      scatter(reduced ? 56 : 150, WEATHER_HEIGHT, 32);
      this.roadMat.roughness = 0.3;
      this.roadMat.clearcoat = 0.58;
      this.roadMat.clearcoatRoughness = 0.28;
    } else if (kind === "dust") {
      this.weatherMat.color.setHex(0xd8bb92);
      this.weatherMat.map = maps.dustMap;
      this.weatherMat.size = 0.26;
      this.weatherMat.opacity = 0.11;
      this.weatherMat.blending = THREE.NormalBlending;
      this.weatherMat.fog = true;
      scatter(reduced ? 70 : 140, 8, WEATHER_WIDTH);
      this.roadMat.roughness = 0.52;
      this.roadMat.clearcoat = 0.18;
      this.roadMat.clearcoatRoughness = 0.6;
    } else if (kind === "snow") {
      this.weatherMat.color.setHex(0xe8f2f8);
      this.weatherMat.map = maps.snowMap;
      this.weatherMat.size = 1.08;
      this.weatherMat.opacity = 0.48;
      this.weatherMat.blending = THREE.AdditiveBlending;
      this.weatherMat.fog = true;
      scatter(reduced ? 22 : 40, WEATHER_HEIGHT, WEATHER_WIDTH);
      this.roadMat.roughness = 0.22;
      this.roadMat.clearcoat = 0.7;
      this.roadMat.clearcoatRoughness = 0.18;
    } else {
      maps.live = 0;
      this.roadMat.roughness = 0.38;
      this.roadMat.clearcoat = 0.42;
      this.roadMat.clearcoatRoughness = 0.38;
    }
    this.weatherMat.needsUpdate = true;
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

    const follow = kind === "rain";
    const fall = kind === "rain" ? 34 : kind === "snow" ? 4.8 : 2.8;
    const sway = kind === "rain" ? 0.28 : kind === "snow" ? 1.15 : 2.4;
    const wrapY = (this.weatherField.userData.wrapY as number) || WEATHER_HEIGHT;
    const live = (this.weatherField.userData.live as number) || 0;
    const pos = this.weatherPos;
    const end = Math.min(pos.length, live * 3);
    for (let i = 0; i < end; i += 3) {
      let y = pos[i + 1] - fall * dt;
      let z = pos[i + 2] - (follow ? dz * 0.1 : dz);
      if (y < 0) {
        y += wrapY;
        if (follow) {
          pos[i] = (Math.random() - 0.5) * 32;
          z = -WEATHER_BACK + Math.random() * WEATHER_SPAN;
        }
      }
      if (z < -WEATHER_BACK) z += WEATHER_SPAN;
      else if (z > WEATHER_SPAN - WEATHER_BACK) z -= WEATHER_SPAN;
      if (sway > 0) {
        const x = pos[i] + Math.sin(now * 0.0007 + i) * sway * dt;
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

  private addLayer(material: THREE.MeshStandardMaterial, count: number, geometry?: THREE.BufferGeometry) {
    const layer = new THREE.InstancedMesh(geometry ?? new THREE.BoxGeometry(1, 1, 1), material, count);
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
    if (this.circuit.cityStyle === "towers") this.addHills();
    for (const layer of this.cityLayers) {
      if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
      layer.instanceMatrix.needsUpdate = true;
      layer.computeBoundingSphere();
    }
  }

  private addHills() {
    const hills = this.addLayer(this.hillMat, 40);
    hills.receiveShadow = true;
    hills.castShadow = true;
    const tint = new THREE.Color();
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 5;
      const sy = 5.5 + ring * 5.8 + (i % 3) * 1.35;
      const sx = 20 + ring * 9 + (i % 4) * 4.5;
      const sz = 16 + ring * 7 + (i % 3) * 3.5;
      const x = side * (34 + ring * 16 + (i % 4) * 3.2);
      const z = ((i + 0.28) / 40) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.09;
      this.pushSlot(hills, i, x, sy * 0.36, z, sx, sy, sz, yaw);
      tint.setHSL(0.27 + ring * 0.012, 0.3 - ring * 0.04, 0.34 - ring * 0.04);
      hills.setColorAt(i, tint);
    }
  }

  private buildTowers() {
    const towers = this.addLayer(this.towerMat, 72);
    const crowns = this.addLayer(this.ownMat({ color: 0x6a7074, roughness: 0.78, metalness: 0.18 }), 72);
    const wings = this.addLayer(this.slabMat, 48);
    const slabs = this.addLayer(this.slabMat, 40);
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.9, metalness: 0.08 }), 24);
    const antennas = this.addLayer(this.ownMat({ color: 0x4a5258, roughness: 0.45, metalness: 0.55 }), 28);
    const horizon = this.addLayer(this.horizonMat, 48);
    towers.castShadow = true;
    towers.receiveShadow = true;
    slabs.castShadow = true;
    slabs.receiveShadow = true;
    wings.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 72; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const kind = i % 6;
      let sy = 18;
      let sx = 5;
      let sz = 5;
      if (kind === 0) {
        sy = 46 + (i % 7) * 3.4;
        sx = 3.1 + (i % 3) * 0.35;
        sz = 3.3 + (i % 2) * 0.4;
      } else if (kind === 1) {
        sy = 24 + (i % 5) * 2.6;
        sx = 7.4 + (i % 3) * 0.8;
        sz = 6.2 + (i % 2);
      } else if (kind === 2) {
        sy = 11 + (i % 4) * 1.8;
        sx = 11 + (i % 3) * 1.4;
        sz = 8.5 + (i % 2) * 1.2;
      } else if (kind === 3) {
        sy = 30 + (i % 6) * 2.2;
        sx = 4.4 + (i % 2) * 0.5;
        sz = 11 + (i % 3) * 1.1;
      } else if (kind === 4) {
        sy = 36 + (i % 5) * 2.8;
        sx = 5.6;
        sz = 5.4;
      } else {
        sy = 16 + ring * 8 + (i % 5) * 2.2;
        sx = 4.6 + (i % 4) * 0.9;
        sz = 5.2 + (i % 3) * 0.7;
      }
      const x = side * (46 + ring * 18 + (i % 6) * 2.8 + (kind === 0 ? 6 : 0));
      const z = ((i + 0.5) / 72) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.035;
      this.pushSlot(towers, i, x, sy / 2, z, sx, sy, sz, yaw);
      const capH = kind === 2 ? 0.55 : kind === 0 ? 2.2 : 1.15;
      this.pushSlot(crowns, i, x, sy + capH * 0.45, z, sx * (kind === 0 ? 0.38 : 0.62), capH, sz * (kind === 3 ? 0.4 : 0.58), yaw);
      tint.setHSL(0.08 + (i % 5) * 0.02, 0.06, 0.62 + (i % 6) * 0.05);
      towers.setColorAt(i, tint);
      tint.setRGB(0.62, 0.64, 0.66);
      crowns.setColorAt(i, tint);
      if (i < 28) {
        this.pushSlot(antennas, i, x, sy + 3.4 + capH, z, 0.16, 3.6 + (kind === 0 ? 2.4 : 0.8) + (i % 3), 0.16, yaw);
      }
    }
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const x = side * (46 + ring * 18 + (i % 6) * 2.8) + side * (3.6 + (i % 3) * 0.8);
      const z = ((i + 0.5) / 72) * CITY_SPAN + ((i % 5) - 2) * 1.8;
      const wy = 5.5 + (i % 6) * 1.4;
      this.pushSlot(wings, i, x, wy / 2, z, 7.2 + (i % 4) * 1.3, wy, 3.6 + (i % 3) * 0.7, ((i % 5) - 2) * 0.05);
      tint.setHSL(0.09 + (i % 4) * 0.02, 0.08, 0.58 + (i % 4) * 0.05);
      wings.setColorAt(i, tint);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 6 + (i % 8) * 1.35;
      this.pushSlot(
        slabs,
        i,
        side * (36 + (i % 5) * 5.4),
        sy / 2,
        ((i + 0.2) / 40) * CITY_SPAN,
        8.5 + (i % 5) * 2.2,
        sy,
        5.5 + (i % 4) * 1.4,
        ((i % 5) - 2) * 0.05,
      );
      tint.setHSL(0.07 + (i % 4) * 0.025, 0.08, 0.66 + (i % 3) * 0.05);
      slabs.setColorAt(i, tint);
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pushSlot(
        sheds,
        i,
        side * (32 + (i % 4) * 2.6),
        1.05,
        ((i + 0.6) / 24) * CITY_SPAN,
        4.4 + (i % 3) * 0.9,
        2.1,
        5.2 + (i % 2) * 1.2,
        ((i % 4) - 1.5) * 0.08,
      );
      tint.setHSL(0.08, 0.07, 0.68 + (i % 4) * 0.04);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 4;
      const kind = i % 5;
      const sy = kind === 0 ? 22 + ring * 6 : kind === 2 ? 55 + (i % 6) * 5 : 38 + ring * 8 + (i % 5) * 3;
      const sx = kind === 2 ? 5.5 + (i % 3) : 12 + (i % 4) * 4 + ring * 2;
      const sz = kind === 1 ? 22 + (i % 3) * 4 : 9 + (i % 4) * 2.5;
      this.pushSlot(
        horizon,
        i,
        side * (78 + ring * 14 + (i % 5) * 4),
        sy / 2,
        ((i + 0.15) / 48) * CITY_SPAN,
        sx,
        sy,
        sz,
        ((i % 5) - 2) * 0.03,
      );
      tint.setHSL(0.32, 0.1, 0.2 + ring * 0.03 + (i % 3) * 0.02);
      horizon.setColorAt(i, tint);
    }
  }

  private buildDocks() {
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.92, metalness: 0.08 }), 28);
    const roofs = this.addLayer(this.ownMat({ color: 0x3a2414, roughness: 0.62, metalness: 0.22 }), 28);
    const containers = this.addLayer(this.slabMat, 40);
    const rust = this.ownMat({
      color: 0x4a3020,
      roughness: 0.42,
      metalness: 0.38,
      emissive: 0x1a0c04,
      emissiveIntensity: 0.22,
    });
    const tanks = this.addLayer(rust, 12, new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
    const steel = this.ownMat({
      color: 0x2e1e12,
      roughness: 0.5,
      metalness: 0.5,
      emissive: 0x180a02,
      emissiveIntensity: 0.35,
    });
    const masts = this.addLayer(steel, 14, new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
    const jibs = this.addLayer(steel, 14);
    const hooks = this.addLayer(steel, 14);
    const portalLegs = this.addLayer(steel, 16, new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
    const portalBeams = this.addLayer(steel, 8);
    const hulls = this.addLayer(this.ownMat({ color: 0x1a100c, roughness: 0.7, metalness: 0.28 }), 10);
    const horizon = this.addLayer(this.horizonMat, 28);
    sheds.castShadow = true;
    sheds.receiveShadow = true;
    containers.castShadow = true;
    masts.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const kind = i % 3;
      const sy = kind === 0 ? 6.2 + (i % 4) * 1.1 : kind === 1 ? 9.4 + (i % 3) * 1.4 : 4.8 + (i % 3) * 0.8;
      const sx = kind === 1 ? 9 + (i % 3) * 1.2 : 18 + (i % 4) * 2.6;
      const sz = kind === 0 ? 10 + (i % 3) * 1.8 : 14 + (i % 4) * 2.2;
      const x = side * (24 + (i % 4) * 5.2 + kind * 3.4);
      const z = ((i + 0.4) / 28) * CITY_SPAN;
      const yaw = ((i % 5) - 2) * 0.03;
      this.pushSlot(sheds, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(roofs, i, x, sy + 1.15, z, sx * 0.22, 2.3, sz * 0.94, yaw);
      tint.setHSL(0.07 + (i % 4) * 0.015, 0.22, 0.48 + (i % 3) * 0.06);
      sheds.setColorAt(i, tint);
      tint.setRGB(0.3, 0.16, 0.09);
      roofs.setColorAt(i, tint);
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const stack = 1 + (i % 4);
      const sy = 2.15 * stack;
      this.pushSlot(
        containers,
        i,
        side * (14.2 + (i % 5) * 2.05 + (stack > 2 ? 1.2 : 0)),
        sy / 2,
        ((i + 0.18) / 40) * CITY_SPAN,
        5.6 + (i % 3) * 0.45,
        sy,
        2.25,
        0,
      );
      if (i % 3 === 0) tint.setHSL(0.07, 0.42, 0.4);
      else if (i % 3 === 1) tint.setHSL(0.48, 0.18, 0.36);
      else tint.setHSL(0.1, 0.12, 0.52);
      containers.setColorAt(i, tint);
    }
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 8.5 + (i % 4) * 2.4;
      const d = 4.6 + (i % 3) * 0.55;
      this.pushSlot(tanks, i, side * (36 + (i % 3) * 6.5), sy / 2, ((i + 0.55) / 12) * CITY_SPAN, d, sy, d, 0);
      tint.setHSL(0.06, 0.18, 0.3 + (i % 3) * 0.05);
      tanks.setColorAt(i, tint);
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 32 + (i % 6) * 6.2;
      const jibLen = 18 + (i % 4) * 3.6;
      const x = side * (30 + (i % 4) * 7);
      const z = ((i + 0.32) / 14) * CITY_SPAN;
      this.pushSlot(masts, i, x, h / 2, z, 1.05, h, 1.05, 0);
      this.pushSlot(jibs, i, x - side * (jibLen * 0.28), h - 0.55, z, jibLen, 0.7, 0.7, 0);
      this.pushSlot(hooks, i, x - side * (jibLen * 0.55), h - 5.2, z, 0.85, 7.4 + (i % 3) * 1.2, 0.85, 0);
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 22 + (i % 4) * 3.4;
      const span = 14 + (i % 3) * 2.2;
      const x = side * (42 + (i % 3) * 8);
      const z = ((i + 0.62) / 8) * CITY_SPAN;
      this.pushSlot(portalLegs, i * 2, x, h / 2, z - span * 0.38, 0.95, h, 0.95, 0);
      this.pushSlot(portalLegs, i * 2 + 1, x, h / 2, z + span * 0.38, 0.95, h, 0.95, 0);
      this.pushSlot(portalBeams, i, x, h + 0.45, z, 1.15, 0.9, span * 1.05, 0);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 5.2 + (i % 3) * 1.4;
      this.pushSlot(
        hulls,
        i,
        side * (52 + (i % 3) * 7),
        sy / 2,
        ((i + 0.28) / 10) * CITY_SPAN,
        7 + (i % 3) * 1.4,
        sy,
        28 + (i % 4) * 5,
        0,
      );
      tint.setHSL(0.05, 0.12, 0.14 + (i % 3) * 0.03);
      hulls.setColorAt(i, tint);
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const kind = i % 4;
      const sy = kind === 1 ? 42 + (i % 5) * 5 : 12 + (i % 6) * 2.8;
      const sx = kind === 1 ? 2.8 + (i % 3) : 20 + (i % 4) * 5;
      const sz = kind === 2 ? 26 + (i % 3) * 5 : 11 + (i % 4) * 2.4;
      this.pushSlot(horizon, i, side * (68 + (i % 5) * 9), sy / 2, ((i + 0.12) / 28) * CITY_SPAN, sx, sy, sz, 0);
      tint.setHSL(0.06, 0.14, 0.14 + (i % 4) * 0.04);
      horizon.setColorAt(i, tint);
    }
  }

  private buildGlass() {
    const slabs = this.addLayer(this.towerMat, 48);
    const crowns = this.addLayer(this.ownMat({ color: 0x0c1822, roughness: 0.32, metalness: 0.62 }), 48);
    const shoulders = this.addLayer(this.slabMat, 32);
    const spires = this.addLayer(this.towerMat, 24);
    const podia = this.addLayer(this.slabMat, 24);
    const bridges = this.addLayer(this.ownMat({ color: 0x152838, roughness: 0.4, metalness: 0.5 }), 20);
    const antennas = this.addLayer(this.ownMat({ color: 0x243240, roughness: 0.4, metalness: 0.6 }), 24);
    const horizon = this.addLayer(this.horizonMat, 40);
    slabs.castShadow = true;
    slabs.receiveShadow = true;
    spires.castShadow = true;
    podia.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const kind = i % 4;
      const sy =
        kind === 0 ? 48 + ring * 12 + (i % 5) * 3.6 : kind === 1 ? 32 + ring * 8 + (i % 4) * 2.2 : 20 + ring * 5 + (i % 4) * 1.8;
      const sx = kind === 2 ? 5.8 + (i % 3) * 0.6 : 1.85 + ring * 0.28 + (i % 3) * 0.18;
      const sz = kind === 0 ? 16 + (i % 4) * 2.4 : kind === 1 ? 9 + (i % 3) * 1.6 : 6.2 + (i % 3);
      const x = side * (16.4 + ring * 7.2 + (kind === 2 ? 2.4 : 0) + (i % 4) * 0.55);
      const z = ((i + 0.45) / 48) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.012;
      this.pushSlot(slabs, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(crowns, i, x, sy + 0.85, z, sx * (kind === 0 ? 0.62 : 0.38), 1.7, sz * 0.48, yaw);
      tint.setHSL(0.52 + (i % 6) * 0.016, 0.2, 0.74 + (i % 5) * 0.04);
      slabs.setColorAt(i, tint);
      tint.setRGB(0.14, 0.24, 0.32);
      crowns.setColorAt(i, tint);
    }
    for (let i = 0; i < 32; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 8 + (i % 6) * 1.6;
      this.pushSlot(
        shoulders,
        i,
        side * (17.2 + (i % 4) * 6.4),
        sy / 2,
        ((i + 0.38) / 32) * CITY_SPAN,
        6.4 + (i % 3) * 1.1,
        sy,
        4.2 + (i % 3) * 0.8,
        0,
      );
      tint.setHSL(0.53 + (i % 4) * 0.015, 0.14, 0.68 + (i % 3) * 0.04);
      shoulders.setColorAt(i, tint);
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 62 + (i % 8) * 7.5;
      const sx = 1.45 + (i % 3) * 0.18;
      const x = side * (22 + (i % 4) * 6.5);
      const z = ((i + 0.22) / 24) * CITY_SPAN;
      this.pushSlot(spires, i, x, sy / 2, z, sx, sy, sx * 1.2, 0);
      this.pushSlot(antennas, i, x, sy + 5.2, z, 0.12, 8 + (i % 4) * 1.4, 0.12, 0);
      tint.setHSL(0.54 + (i % 4) * 0.018, 0.16, 0.8 + (i % 3) * 0.03);
      spires.setColorAt(i, tint);
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 4.8 + (i % 4) * 1.1;
      this.pushSlot(
        podia,
        i,
        side * (15.6 + (i % 4) * 2.2),
        sy / 2,
        ((i + 0.7) / 24) * CITY_SPAN,
        6.2 + (i % 3) * 1.2,
        sy,
        5.4 + (i % 3),
        0,
      );
      tint.setHSL(0.55 + (i % 4) * 0.012, 0.1, 0.7 + (i % 3) * 0.04);
      podia.setColorAt(i, tint);
    }
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = 22 + (i % 6) * 4.5;
      this.pushSlot(
        bridges,
        i,
        side * (19 + (i % 3) * 4),
        y,
        ((i + 0.5) / 20) * CITY_SPAN,
        10 + (i % 4) * 1.8,
        1.15,
        2.4,
        0,
      );
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const kind = i % 5;
      const sy = kind === 2 ? 96 + (i % 4) * 8 : 58 + (i % 8) * 8;
      this.pushSlot(
        horizon,
        i,
        side * (46 + (i % 6) * 7),
        sy / 2,
        ((i + 0.14) / 40) * CITY_SPAN,
        kind === 0 ? 3.6 + (i % 3) : 8 + (i % 4) * 2,
        sy,
        kind === 1 ? 20 + (i % 3) * 3 : 7 + (i % 3) * 1.8,
        0,
      );
      tint.setHSL(0.55, 0.12, 0.2 + (i % 4) * 0.05);
      horizon.setColorAt(i, tint);
    }
  }

  private buildRidge() {
    const mesas = this.addLayer(this.horizonMat, 20);
    const caps = this.addLayer(
      this.ownMat({ color: 0x5a4634, roughness: 1, metalness: 0.02, flatShading: true }),
      20,
    );
    const buttes = this.addLayer(
      this.horizonMat,
      14,
      new THREE.CylinderGeometry(0.28, 0.55, 1, 5),
    );
    const scree = this.addLayer(
      this.ownMat({ color: 0x3a2e22, roughness: 1, metalness: 0.02, flatShading: true }),
      36,
      new THREE.IcosahedronGeometry(0.5, 0),
    );
    const cabins = this.addLayer(this.towerMat, 6);
    const masts = this.addLayer(this.ownMat({ color: 0x241c14, roughness: 0.5, metalness: 0.45 }), 6);
    mesas.castShadow = true;
    mesas.receiveShadow = true;
    buttes.castShadow = true;
    scree.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 11 + (i % 5) * 3.2;
      const sx = 22 + (i % 4) * 6.5;
      const sz = 16 + (i % 3) * 5;
      const x = side * (38 + (i % 5) * 12);
      const z = ((i + 0.18) / 20) * CITY_SPAN;
      const yaw = ((i % 5) - 2) * 0.07;
      this.pushSlot(mesas, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(caps, i, x, sy + 0.95, z, sx * 0.78, 1.9, sz * 0.74, yaw);
      tint.setHSL(0.08, 0.24, 0.2 + (i % 4) * 0.05);
      mesas.setColorAt(i, tint);
      tint.setHSL(0.09, 0.2, 0.34 + (i % 3) * 0.04);
      caps.setColorAt(i, tint);
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 28 + (i % 6) * 7.5;
      const d = 7.5 + (i % 3) * 2.2;
      this.pushSlot(
        buttes,
        i,
        side * (62 + (i % 4) * 13),
        sy / 2,
        ((i + 0.4) / 14) * CITY_SPAN,
        d,
        sy,
        d * 0.92,
        ((i % 4) - 1.5) * 0.1,
      );
      tint.setHSL(0.07, 0.18, 0.12 + (i % 4) * 0.04);
      buttes.setColorAt(i, tint);
    }
    for (let i = 0; i < 36; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const s = 2.2 + (i % 6) * 1.15;
      this.pushSlot(
        scree,
        i,
        side * (12.4 + (i % 7) * 2.4),
        s * 0.4,
        ((i + 0.62) / 36) * CITY_SPAN,
        s * 1.55,
        s * 0.78,
        s * 1.2,
        ((i % 5) - 2) * 0.4,
      );
      tint.setHSL(0.08, 0.16, 0.26 + (i % 4) * 0.06);
      scree.setColorAt(i, tint);
    }
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 6.5 + (i % 3) * 2.4;
      const x = side * (30 + (i % 3) * 9);
      const z = ((i + 0.5) / 6) * CITY_SPAN;
      this.pushSlot(cabins, i, x, sy / 2, z, 3.2 + (i % 2), sy, 3, 0);
      this.pushSlot(masts, i, x, sy + 6.2, z, 0.14, 11 + (i % 3) * 1.8, 0.14, 0);
      tint.setHSL(0.09, 0.18, 0.52 + (i % 3) * 0.06);
      cabins.setColorAt(i, tint);
    }
  }

  private buildWorks() {
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.9, metalness: 0.08 }), 24);
    const ridges = this.addLayer(this.ownMat({ color: 0x1a322c, roughness: 0.55, metalness: 0.28 }), 24);
    const walls = this.addLayer(this.slabMat, 20);
    const halls = this.addLayer(this.towerMat, 12);
    const coolers = this.addLayer(
      this.ownMat({
        color: 0x1a3a32,
        roughness: 0.62,
        metalness: 0.22,
        emissive: 0x062418,
        emissiveIntensity: 0.18,
      }),
      10,
      new THREE.CylinderGeometry(0.32, 0.55, 1, 6),
    );
    const steel = this.ownMat({
      color: 0x1a2e28,
      roughness: 0.48,
      metalness: 0.55,
      emissive: 0x062418,
      emissiveIntensity: 0.32,
    });
    const masts = this.addLayer(steel, 16, new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
    const arms = this.addLayer(steel, 16);
    const nacelles = this.addLayer(steel, 16);
    const horizon = this.addLayer(this.horizonMat, 28);
    sheds.castShadow = true;
    sheds.receiveShadow = true;
    walls.castShadow = true;
    halls.castShadow = true;
    coolers.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const saw = i % 2;
      const sy = 6.2 + saw * 2.6 + (i % 4) * 0.85;
      const sx = 16 + (i % 4) * 3.2;
      const sz = 9 + (i % 3) * 1.8;
      const x = side * (26 + (i % 4) * 5.4);
      const z = ((i + 0.38) / 24) * CITY_SPAN;
      const yaw = ((i % 5) - 2) * 0.02;
      this.pushSlot(sheds, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(ridges, i, x, sy + 1.25, z, sx * 0.14, 2.5, sz * 0.96, yaw);
      tint.setHSL(0.46 + (i % 4) * 0.012, 0.18, 0.48 + (i % 3) * 0.06);
      sheds.setColorAt(i, tint);
      tint.setRGB(0.1, 0.22, 0.2);
      ridges.setColorAt(i, tint);
    }
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 6.2 + (i % 4) * 1.05;
      this.pushSlot(
        walls,
        i,
        side * (15.2 + (i % 3) * 1.4),
        sy / 2,
        ((i + 0.2) / 20) * CITY_SPAN,
        1.85,
        sy,
        28 + (i % 3) * 5,
        0,
      );
      tint.setHSL(0.45 + (i % 3) * 0.01, 0.14, 0.56 + (i % 3) * 0.05);
      walls.setColorAt(i, tint);
    }
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 11 + (i % 4) * 2.4;
      this.pushSlot(
        halls,
        i,
        side * (38 + (i % 3) * 7),
        sy / 2,
        ((i + 0.55) / 12) * CITY_SPAN,
        9 + (i % 3) * 1.6,
        sy,
        12 + (i % 2) * 2.4,
        0,
      );
      tint.setHSL(0.47 + (i % 3) * 0.015, 0.18, 0.58 + (i % 3) * 0.05);
      halls.setColorAt(i, tint);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 18 + (i % 5) * 3.2;
      const d = 7.2 + (i % 3) * 1.1;
      this.pushSlot(coolers, i, side * (34 + (i % 4) * 6.5), sy / 2, ((i + 0.42) / 10) * CITY_SPAN, d, sy, d, 0);
      tint.setHSL(0.48, 0.12, 0.32 + (i % 3) * 0.05);
      coolers.setColorAt(i, tint);
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 28 + (i % 5) * 5.4;
      const arm = 9.5 + (i % 3) * 1.8;
      const x = side * (32 + (i % 4) * 6.5);
      const z = ((i + 0.3) / 16) * CITY_SPAN;
      this.pushSlot(masts, i, x, h / 2, z, 0.5, h, 0.5, 0);
      this.pushSlot(nacelles, i, x, h + 0.7, z, 2.2, 1.35, 2.8, 0);
      this.pushSlot(arms, i, x, h + 0.7, z, arm, 0.32, 0.32, ((i % 5) - 2) * 0.45);
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const kind = i % 4;
      const sy = kind === 0 ? 22 + (i % 5) * 3.2 : 10 + (i % 6) * 2.4;
      this.pushSlot(
        horizon,
        i,
        side * (60 + (i % 5) * 10),
        sy / 2,
        ((i + 0.12) / 28) * CITY_SPAN,
        kind === 0 ? 5 + (i % 3) : 18 + (i % 4) * 5,
        sy,
        kind === 2 ? 22 + (i % 3) * 4 : 12 + (i % 3) * 3,
        0,
      );
      tint.setHSL(0.48, 0.1, 0.13 + (i % 4) * 0.04);
      horizon.setColorAt(i, tint);
    }
  }

  private buildSprawl() {
    const blocks = this.addLayer(this.towerMat, 72);
    const neon = this.addLayer(
      this.ownMat({
        color: 0x2a1020,
        roughness: 0.5,
        metalness: 0.34,
        emissive: 0xff2bd6,
        emissiveIntensity: 0.7,
      }),
      72,
    );
    const boards = this.addLayer(this.slabMat, 40);
    const podia = this.addLayer(this.slabMat, 28);
    const antennas = this.addLayer(this.ownMat({ color: 0x2a1824, roughness: 0.42, metalness: 0.58 }), 48);
    const horizon = this.addLayer(this.horizonMat, 64);
    blocks.castShadow = true;
    blocks.receiveShadow = true;
    boards.castShadow = true;
    podia.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 72; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 4;
      const kind = i % 5;
      let sy = 16;
      let sx = 4;
      let sz = 4;
      if (kind === 0) {
        sy = 36 + ring * 5 + (i % 5) * 2.2;
        sx = 2.8 + (i % 3) * 0.35;
        sz = 3.2;
      } else if (kind === 1) {
        sy = 16 + ring * 3.4 + (i % 4) * 1.6;
        sx = 7.6 + (i % 3) * 1.1;
        sz = 6.2;
      } else if (kind === 2) {
        sy = 8 + (i % 4) * 1.2;
        sx = 11 + (i % 3) * 1.5;
        sz = 7.2;
      } else if (kind === 3) {
        sy = 24 + ring * 4.5 + (i % 6) * 1.8;
        sx = 2.15;
        sz = 9 + (i % 3);
      } else {
        sy = 20 + ring * 6 + (i % 5) * 2;
        sx = 5 + (i % 2) * 0.8;
        sz = 4.8;
      }
      const x = side * (12.4 + ring * 5.4 + (i % 5) * 0.7);
      const z = ((i + 0.48) / 72) * CITY_SPAN;
      const yaw = ((i % 7) - 3) * 0.016;
      this.pushSlot(blocks, i, x, sy / 2, z, sx, sy, sz, yaw);
      this.pushSlot(neon, i, x + side * (sx * 0.04), sy * 0.62, z, sx * 1.12, 1.15, sz * 0.78, yaw);
      tint.setHSL(0.86 + (i % 6) * 0.018, 0.3, 0.55 + (i % 5) * 0.05);
      blocks.setColorAt(i, tint);
      tint.setHSL(0.9 + (i % 4) * 0.02, 0.62, 0.5);
      neon.setColorAt(i, tint);
      if (i < 48) {
        this.pushSlot(antennas, i, x, sy + 2.8, z, 0.12, 3.6 + (i % 4) * 0.8, 0.12, yaw);
      }
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 10 + (i % 7) * 2.4;
      this.pushSlot(
        boards,
        i,
        side * (13.2 + (i % 4) * 2.4),
        sy / 2,
        ((i + 0.22) / 40) * CITY_SPAN,
        0.42,
        sy,
        9 + (i % 4) * 1.8,
        0,
      );
      tint.setHSL(0.88 + (i % 5) * 0.02, 0.36, 0.6 + (i % 3) * 0.06);
      boards.setColorAt(i, tint);
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 3.6 + (i % 5) * 0.75;
      this.pushSlot(
        podia,
        i,
        side * (12.8 + (i % 4) * 2),
        sy / 2,
        ((i + 0.7) / 28) * CITY_SPAN,
        7.4 + (i % 4) * 1.6,
        sy,
        4.2 + (i % 3),
        0,
      );
      tint.setHSL(0.9, 0.16, 0.44 + (i % 3) * 0.05);
      podia.setColorAt(i, tint);
    }
    for (let i = 0; i < 64; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const kind = i % 4;
      const sy = kind === 2 ? 20 + (i % 5) * 3.5 : 42 + (i % 8) * 6.5;
      this.pushSlot(
        horizon,
        i,
        side * (36 + (i % 8) * 4.4),
        sy / 2,
        ((i + 0.08) / 64) * CITY_SPAN,
        kind === 1 ? 5.2 + (i % 3) : 10 + (i % 4) * 1.8,
        sy,
        kind === 0 ? 14 + (i % 3) * 2 : 7 + (i % 3) * 1.4,
        0,
      );
      tint.setHSL(0.9, 0.16, 0.14 + (i % 4) * 0.05);
      horizon.setColorAt(i, tint);
    }
  }

  private buildFrost() {
    const ice = this.ownMat({
      color: 0xc4d8e6,
      roughness: 0.28,
      metalness: 0.32,
      emissive: 0x1a2834,
      emissiveIntensity: 0.22,
      flatShading: true,
    });
    const walls = this.addLayer(ice, 22);
    const bergs = this.addLayer(ice, 24, new THREE.IcosahedronGeometry(0.5, 0));
    const spires = this.addLayer(ice, 16, new THREE.ConeGeometry(0.5, 1, 5));
    const shelves = this.addLayer(this.slabMat, 16);
    const cabins = this.addLayer(this.towerMat, 8);
    const crowns = this.addLayer(this.ownMat({ color: 0xd8ecf4, roughness: 0.24, metalness: 0.38 }), 8);
    const horizon = this.addLayer(this.horizonMat, 28);
    walls.castShadow = true;
    walls.receiveShadow = true;
    bergs.castShadow = true;
    spires.castShadow = true;
    shelves.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const jagged = i % 5;
      const sy = 12 + jagged * 4.2 + (i % 3) * 1.6;
      const sx = 2.6 + (i % 3) * 0.55;
      const sz = 14 + (i % 4) * 2.8;
      const x = side * (16.5 + (i % 4) * 4.2);
      const z = ((i + 0.28) / 22) * CITY_SPAN;
      this.pushSlot(walls, i, x, sy / 2, z, sx, sy, sz, ((i % 5) - 2) * 0.1);
      tint.setHSL(0.55, 0.1, 0.74 + (i % 4) * 0.05);
      walls.setColorAt(i, tint);
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const s = 5.2 + (i % 6) * 2.1;
      this.pushSlot(
        bergs,
        i,
        side * (28 + (i % 4) * 7.5),
        s * 0.52,
        ((i + 0.5) / 24) * CITY_SPAN,
        s * (0.65 + (i % 3) * 0.18),
        s * (1.25 + (i % 2) * 0.4),
        s * 0.8,
        ((i % 5) - 2) * 0.45,
      );
      tint.setHSL(0.54, 0.08, 0.8 + (i % 3) * 0.04);
      bergs.setColorAt(i, tint);
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 16 + (i % 6) * 4.8;
      const d = 3.4 + (i % 3) * 0.7;
      this.pushSlot(
        spires,
        i,
        side * (40 + (i % 4) * 8),
        sy / 2,
        ((i + 0.4) / 16) * CITY_SPAN,
        d,
        sy,
        d,
        0,
      );
      tint.setHSL(0.55, 0.1, 0.78 + (i % 3) * 0.04);
      spires.setColorAt(i, tint);
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 1.8 + (i % 4) * 0.55;
      this.pushSlot(
        shelves,
        i,
        side * (13.8 + (i % 4) * 2.6),
        sy / 2,
        ((i + 0.65) / 16) * CITY_SPAN,
        10 + (i % 3) * 2.4,
        sy,
        8 + (i % 3) * 1.6,
        ((i % 5) - 2) * 0.06,
      );
      tint.setHSL(0.56, 0.06, 0.82 + (i % 3) * 0.04);
      shelves.setColorAt(i, tint);
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 8 + (i % 3) * 2.2;
      const sx = 2.4 + (i % 2) * 0.4;
      const x = side * (24 + (i % 3) * 6);
      const z = ((i + 0.35) / 8) * CITY_SPAN;
      this.pushSlot(cabins, i, x, sy / 2, z, sx, sy, sx * 1.15, 0);
      this.pushSlot(crowns, i, x, sy + 1.4, z, sx * 0.32, 2.8, sx * 0.32, 0);
      tint.setHSL(0.55, 0.08, 0.7 + (i % 3) * 0.04);
      cabins.setColorAt(i, tint);
      tint.setRGB(0.86, 0.93, 0.97);
      crowns.setColorAt(i, tint);
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const jagged = i % 6;
      const sy = 14 + jagged * 8 + (i % 3) * 3.2;
      this.pushSlot(
        horizon,
        i,
        side * (56 + (i % 5) * 11),
        sy / 2,
        ((i + 0.12) / 28) * CITY_SPAN,
        14 + (i % 4) * 6,
        sy,
        12 + (i % 3) * 5,
        ((i % 5) - 2) * 0.06,
      );
      tint.setHSL(0.55, 0.08, 0.2 + jagged * 0.03);
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
    const bases = this.addLayer(brick, 18, new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
    const necks = this.addLayer(brick, 18, new THREE.CylinderGeometry(0.22, 0.5, 1, 6));
    const caps = this.addLayer(this.ownMat({ color: 0x1a0c08, roughness: 0.85, metalness: 0.12 }), 18);
    const mouths = this.addLayer(
      this.ownMat({
        color: 0x4a1808,
        roughness: 0.5,
        metalness: 0.08,
        emissive: 0xff5a2a,
        emissiveIntensity: 0.85,
      }),
      18,
    );
    const stacks = this.addLayer(brick, 24, new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
    const sheds = this.addLayer(this.ownMat({ map: makeShedTexture(), roughness: 0.94, metalness: 0.05 }), 18);
    const halls = this.addLayer(this.slabMat, 18);
    const horizon = this.addLayer(this.horizonMat, 28);
    bases.castShadow = true;
    bases.receiveShadow = true;
    sheds.castShadow = true;
    halls.castShadow = true;
    stacks.castShadow = true;

    const tint = new THREE.Color();
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const baseH = 8.2 + (i % 4) * 1.4;
      const neckH = 8.5 + (i % 5) * 1.8;
      const x = side * (20 + (i % 4) * 5.8);
      const z = ((i + 0.32) / 18) * CITY_SPAN;
      const d = 6.2 + (i % 3) * 0.8;
      this.pushSlot(bases, i, x, baseH / 2, z, d, baseH, d, 0);
      this.pushSlot(necks, i, x, baseH + neckH / 2, z, d * 0.78, neckH, d * 0.78, 0);
      this.pushSlot(caps, i, x, baseH + neckH + 0.5, z, d * 0.48, 1.0, d * 0.48, 0);
      this.pushSlot(mouths, i, x + side * (d * 0.38), baseH * 0.34, z, 1.55, 2.1, 1.7, 0);
      tint.setHSL(0.04 + (i % 3) * 0.012, 0.3, 0.36 + (i % 3) * 0.06);
      bases.setColorAt(i, tint);
      necks.setColorAt(i, tint);
      tint.setRGB(0.2, 0.08, 0.05);
      caps.setColorAt(i, tint);
      tint.setRGB(1, 0.4, 0.16);
      mouths.setColorAt(i, tint);
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const cluster = i % 3;
      const sy = 18 + (i % 7) * 2.8 + cluster * 1.4;
      this.pushSlot(
        stacks,
        i,
        side * (32 + (i % 5) * 4.4 + cluster * 1.6),
        sy / 2,
        ((i + 0.45) / 24) * CITY_SPAN,
        1.05 + (i % 3) * 0.16,
        sy,
        1.05 + (i % 3) * 0.16,
        0,
      );
      tint.setHSL(0.035, 0.24, 0.3 + (i % 4) * 0.05);
      stacks.setColorAt(i, tint);
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 5.2 + (i % 4) * 1.05;
      this.pushSlot(
        sheds,
        i,
        side * (14.8 + (i % 4) * 2.2),
        sy / 2,
        ((i + 0.6) / 18) * CITY_SPAN,
        8.5 + (i % 3) * 1.4,
        sy,
        6.2 + (i % 2) * 1.3,
        ((i % 4) - 1.5) * 0.04,
      );
      tint.setHSL(0.05, 0.22, 0.46 + (i % 4) * 0.05);
      sheds.setColorAt(i, tint);
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sy = 6.5 + (i % 5) * 1.5;
      this.pushSlot(
        halls,
        i,
        side * (28 + (i % 4) * 5.2),
        sy / 2,
        ((i + 0.18) / 18) * CITY_SPAN,
        13 + (i % 4) * 2.4,
        sy,
        9 + (i % 3) * 2,
        0,
      );
      tint.setHSL(0.045 + (i % 3) * 0.01, 0.24, 0.4 + (i % 3) * 0.05);
      halls.setColorAt(i, tint);
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const kind = i % 4;
      const sy = kind === 1 ? 36 + (i % 5) * 4.5 : 12 + (i % 6) * 3;
      this.pushSlot(
        horizon,
        i,
        side * (58 + (i % 5) * 10),
        sy / 2,
        ((i + 0.14) / 28) * CITY_SPAN,
        kind === 1 ? 2.6 + (i % 3) : 16 + (i % 4) * 4,
        sy,
        kind === 2 ? 20 + (i % 3) * 4 : 10 + (i % 3) * 3,
        0,
      );
      tint.setHSL(0.04, 0.16, 0.12 + (i % 4) * 0.04);
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
    road.receiveShadow = true;
    g.add(road);

    const style = this.circuit.cityStyle;
    for (const side of [-1, 1] as const) {
      const gravel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.45, ROAD.segmentLength),
        this.gravelMat,
      );
      gravel.rotation.x = -Math.PI / 2;
      gravel.position.set(side * (ROAD.halfWidth + 0.92), 0.003, 0);
      gravel.receiveShadow = true;
      g.add(gravel);

      const grass = new THREE.Mesh(this.grassGeo, this.grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(side * (ROAD.halfWidth + 8.8), 0.001, 0);
      grass.receiveShadow = true;
      g.add(grass);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, ROAD.segmentLength), this.edgeMat);
      edge.position.set(side * (ROAD.halfWidth + 0.02), 0.035, 0);
      g.add(edge);

      const jersey = new THREE.Mesh(this.jerseyGeo, this.wallMat);
      jersey.position.set(side * (ROAD.halfWidth + 1.58), 0, 0);
      jersey.castShadow = true;
      jersey.receiveShadow = true;
      g.add(jersey);

      const pole = createLightPole();
      pole.position.set(side * (ROAD.halfWidth + 2.85), 0, 0);
      if (side > 0) pole.rotation.y = Math.PI;
      g.add(pole);

      g.add(this.makeVerge(index, side, style));
      this.plantTrees(g, index, side);

      if (index % 2 === 0) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.09), this.eyeMat);
        eye.position.set(side * (ROAD.halfWidth + 0.02), 0.08, 0);
        g.add(eye);
      }
    }

    const flavor = index % 8;
    const highway = style === "towers";
    if (highway) {
      if (index === 13) this.addOverpass(g);
    } else {
      if (flavor === 2 && index % 16 === 2) this.addGantry(g, index);
      if (flavor === 5 && index % 16 === 5) this.addBillboard(g, index);
      if (flavor === 7 && index > 2 && index % 16 === 7) this.addOverpass(g);
      if (flavor === 4 && index % 16 === 4) this.addDistanceMarker(g, index);
      if (flavor === 3 && index >= 1) this.addMarshal(g, index);
      if (flavor === 0) this.addCones(g, index);
      if (flavor === 6) this.addBarrels(g, index);
      if (flavor === 1) this.addTracksideCamera(g, index);
    }

    return g;
  }

  private plantTrees(g: THREE.Group, index: number, side: number) {
    const cluster = (index * 5 + (side > 0 ? 2 : 0)) % 7;
    if (cluster === 2 || cluster === 5) return;
    const n = cluster === 0 ? 4 : 2 + (cluster % 2);
    const proto = createTree();
    const grove = new THREE.Group();
    const cx = side * (17.2 + (cluster % 4) * 2.6 + (index % 3) * 1.15);
    const cz = ((index * 11 + cluster * 3) % 19) - 9;
    for (let t = 0; t < n; t++) {
      const tree = t === 0 ? proto : proto.clone();
      const spread = 1.05 + t * 0.92;
      const a = t * 1.72 + index * 0.41;
      tree.position.set(cx + Math.cos(a) * spread * 0.7, 0, cz + Math.sin(a) * spread);
      const s = 0.9 + ((index * 3 + t * 7) % 6) * 0.15;
      tree.scale.set(s * (0.9 + (t % 2) * 0.14), s * (0.96 + (t % 3) * 0.08), s);
      tree.rotation.y = a * 0.35;
      tree.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      grove.add(tree);
    }
    g.add(grove);
  }

  private makeVerge(index: number, side: number, style: CityStyle) {
    if (style === "docks") {
      const stack = new THREE.Group();
      const pallet = new THREE.Mesh(this.crateGeo, this.propMat);
      pallet.scale.set(1.85, 0.22, 2.4);
      pallet.position.set(0, 0.11, 0);
      const drum = new THREE.Mesh(this.barrelGeo, this.propMat);
      drum.scale.set(1.7, 1.15, 1.7);
      drum.position.set(-0.15, 0.95, -0.35);
      const bollard = new THREE.Mesh(this.camPoleGeo, this.propMat);
      bollard.scale.set(2.4, 0.55, 2.4);
      bollard.position.set(side * 0.85, 0.58, 1.35);
      stack.add(pallet, drum, bollard);
      stack.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return stack;
    }
    if (style === "ridge") {
      const cluster = new THREE.Group();
      const s = 1.05 + (index % 3) * 0.22;
      const mesa = new THREE.Mesh(this.crateGeo, this.propMat);
      mesa.scale.set(s * 2.05, s * 0.42, s * 1.55);
      mesa.position.set(0, s * 0.21, 0);
      const cap = new THREE.Mesh(this.crateGeo, this.propMat);
      cap.scale.set(s * 1.25, s * 0.12, s * 0.95);
      cap.position.set(0, s * 0.48, 0);
      const rock = new THREE.Mesh(this.rockGeo, this.propMat);
      rock.scale.set(0.95, 0.48, 0.72);
      rock.position.set(side * 0.62, 0.2, 1.4);
      rock.rotation.set(0.32, index * 0.35, 0.2);
      cluster.add(mesa, cap, rock);
      cluster.position.set(side * (ROAD.halfWidth + 3.7), 0, ((index * 7) % 11) - 5);
      return cluster;
    }
    if (style === "glass") {
      const cluster = new THREE.Group();
      const base = new THREE.Mesh(this.crateGeo, this.propMat);
      base.scale.set(0.7, 0.16, 1.35);
      base.position.set(0, 0.08, 0);
      const pane = new THREE.Mesh(this.crateGeo, this.propMat);
      pane.scale.set(0.08, 2.05, 1.15);
      pane.position.set(0, 1.18, 0);
      const cap = new THREE.Mesh(this.crateGeo, this.propMat);
      cap.scale.set(0.22, 0.1, 0.22);
      cap.position.set(0, 2.26, 0);
      cluster.add(base, pane, cap);
      cluster.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return cluster;
    }
    if (style === "works") {
      const stack = new THREE.Group();
      const wall = new THREE.Mesh(this.crateGeo, this.propMat);
      wall.scale.set(0.32, 1.45, 3.4);
      wall.position.set(0, 0.72, 0);
      const cap = new THREE.Mesh(this.crateGeo, this.propMat);
      cap.scale.set(0.55, 0.12, 3.5);
      cap.position.set(0, 1.5, 0);
      const pipe = new THREE.Mesh(this.camPoleGeo, this.propMat);
      pipe.scale.set(1.6, 0.22, 1.6);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(side * 0.55, 0.95, 1.4);
      stack.add(wall, cap, pipe);
      stack.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return stack;
    }
    if (style === "sprawl") {
      const row = new THREE.Group();
      const kiosk = new THREE.Mesh(this.crateGeo, this.propMat);
      kiosk.scale.set(0.78, 1.55, 0.48);
      kiosk.position.set(0, 0.78, 0);
      const sign = new THREE.Mesh(this.crateGeo, this.propMat);
      sign.scale.set(1.15, 0.38, 0.08);
      sign.position.set(0, 1.72, side * 0.22);
      const post = new THREE.Mesh(this.camPoleGeo, this.propMat);
      post.scale.set(1.4, 0.48, 1.4);
      post.position.set(0.48, 0.5, 0.82);
      row.add(kiosk, sign, post);
      row.position.set(side * (ROAD.halfWidth + 3.8), 0, ((index * 7) % 11) - 5);
      return row;
    }
    if (style === "frost") {
      const cluster = new THREE.Group();
      const wall = new THREE.Mesh(this.crateGeo, this.propMat);
      wall.scale.set(0.38, 1.95, 1.7);
      wall.position.set(0, 0.98, 0);
      wall.rotation.y = 0.14;
      const shard = new THREE.Mesh(this.rockGeo, this.propMat);
      shard.scale.set(0.28, 1.85, 0.24);
      shard.position.set(side * 0.48, 0.92, 0.9);
      shard.rotation.set(0.16, index * 0.28, 0.1);
      const spike = new THREE.Mesh(this.coneGeo, this.propMat);
      spike.scale.set(1.8, 3.4, 1.8);
      spike.position.set(-side * 0.35, 0.78, -0.55);
      cluster.add(wall, shard, spike);
      cluster.position.set(side * (ROAD.halfWidth + 3.7), 0, ((index * 7) % 11) - 5);
      return cluster;
    }
    if (style === "kiln") {
      const stack = new THREE.Group();
      const base = new THREE.Mesh(this.barrelGeo, this.propMat);
      base.scale.set(2.35, 1.05, 2.35);
      base.position.set(0, 0.41, 0);
      const neck = new THREE.Mesh(this.coneGeo, this.propMat);
      neck.scale.set(2.1, 2.4, 2.1);
      neck.position.set(0, 1.38, 0);
      const cap = new THREE.Mesh(this.crateGeo, this.propMat);
      cap.scale.set(0.72, 0.12, 0.72);
      cap.position.set(0, 1.98, 0);
      stack.add(base, neck, cap);
      stack.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      return stack;
    }
    return this.makeGuardrail(side);
  }

  private makeGuardrail(side: number) {
    const rail = new THREE.Group();
    const x = side * (ROAD.halfWidth + 2.22);
    const span = ROAD.segmentLength;
    const posts = 5;
    for (let i = 0; i < posts; i++) {
      const post = new THREE.Mesh(this.railPostGeo, this.railMat);
      post.position.set(x, 0.39, -span / 2 + ((i + 0.5) * span) / posts);
      post.castShadow = true;
      post.receiveShadow = true;
      rail.add(post);
    }
    for (const y of [0.46, 0.7]) {
      const beam = new THREE.Mesh(this.railBeamGeo, this.railMat);
      beam.position.set(x, y, 0);
      beam.castShadow = true;
      beam.receiveShadow = true;
      rail.add(beam);
    }
    return rail;
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
    const rig = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x3c444a, metalness: 0.62, roughness: 0.34 });
    const paint = new THREE.MeshStandardMaterial({ color: 0x2a3238, metalness: 0.4, roughness: 0.42 });
    const span = ROAD.width + 7.4;
    for (const side of [-1, 1] as const) {
      const x = side * (ROAD.halfWidth + 2.9);
      for (const dz of [-0.32, 0.32]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.34, 6.6, 0.34), steel);
        col.position.set(x, 3.3, dz);
        col.castShadow = true;
        col.receiveShadow = true;
        rig.add(col);
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.05), steel);
      cap.position.set(x, 6.52, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 1.1), steel);
      foot.position.set(x, 0.1, 0);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.85), steel);
      brace.position.set(x, 3.4, 0);
      rig.add(cap, foot, brace);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.62, 0.78), steel);
    beam.position.set(0, 6.28, 0);
    beam.castShadow = true;
    const truss = new THREE.Mesh(new THREE.BoxGeometry(span * 0.98, 0.16, 0.95), steel);
    truss.position.set(0, 5.86, 0.08);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(span * 0.9, 0.07, 0.82), paint);
    walk.position.set(0, 5.96, 0.48);
    const labels = [this.circuit.event, ...this.circuit.signs];
    const signMat = new THREE.MeshStandardMaterial({
      map: makeGantrySign(labels[index % labels.length], this.circuit.event),
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.62, 0.28), paint);
    cabinet.position.set(0, 5.08, -0.18);
    cabinet.castShadow = true;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.28, 1.42), signMat);
    sign.position.set(0, 5.08, -0.33);
    sign.rotation.y = Math.PI;
    rig.add(beam, truss, walk, cabinet, sign);
    g.add(rig);
    this.own(g, steel, paint, signMat);
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
    const rig = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), boardMat);
    const side = index % 2 === 0 ? -1 : 1;
    board.position.set(side * (ROAD.halfWidth + 8.5), 6.2, 0);
    board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    rig.add(board);
    g.add(rig);
    this.own(g, boardMat);
  }

  private addOverpass(g: THREE.Group) {
    const rig = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({
      color: 0xc4c6c2,
      roughness: 0.9,
      metalness: 0.04,
    });
    const deckW = ROAD.width + 38;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 1.22, 13.2), concrete);
    deck.position.y = 7.2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    const pavement = new THREE.Mesh(new THREE.BoxGeometry(deckW * 0.52, 0.08, 12.2), this.roadMat);
    pavement.position.y = 7.84;
    pavement.receiveShadow = true;
    for (const gz of [-4.1, 0, 4.1]) {
      const girder = new THREE.Mesh(new THREE.BoxGeometry(deckW - 1.5, 0.72, 0.58), concrete);
      girder.position.set(0, 6.42, gz);
      girder.castShadow = true;
      rig.add(girder);
    }
    const parapetA = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.72, 0.34), concrete);
    parapetA.position.set(0, 7.92, 6.42);
    const parapetB = parapetA.clone();
    parapetB.position.z = -6.42;
    for (const side of [-1, 1] as const) {
      const px = side * (ROAD.halfWidth + 6.5);
      for (const pz of [-3.8, 3.8]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 2.9), concrete);
        foot.position.set(px, 0.25, pz);
        foot.receiveShadow = true;
        const pier = new THREE.Mesh(new THREE.BoxGeometry(2.05, 6.4, 1.7), concrete);
        pier.position.set(px, 3.45, pz);
        pier.castShadow = true;
        pier.receiveShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.55, 2.5), concrete);
        cap.position.set(px, 6.55, pz);
        rig.add(foot, pier, cap);
      }
    }
    rig.add(deck, pavement, parapetA, parapetB);
    g.add(rig);
    this.own(g, concrete);
  }

  private addMarshal(g: THREE.Group, index: number) {
    const rig = new THREE.Group();
    const side = index % 2 === 0 ? -1 : 1;
    const post = new THREE.Mesh(this.signPostGeo, this.postMat);
    post.position.set(side * (ROAD.halfWidth + 2.15), 0.6, 8);
    const board = new THREE.Mesh(this.marshalGeo, this.marshalMats[index % 2]);
    board.position.set(side * (ROAD.halfWidth + 2.15), 1.28, 8.04);
    board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    rig.add(post, board);
    g.add(rig);
  }

  private addDistanceMarker(g: THREE.Group, index: number) {
    const rig = new THREE.Group();
    const side = index % 2 === 0 ? 1 : -1;
    const post = new THREE.Mesh(this.signPostGeo, this.postMat);
    post.position.set(side * (ROAD.halfWidth + 1.85), 0.6, -6);
    const board = new THREE.Mesh(this.distGeo, this.distMats[index % this.distMats.length]);
    board.position.set(side * (ROAD.halfWidth + 1.85), 1.32, -6);
    board.rotation.y = Math.PI;
    rig.add(post, board);
    g.add(rig);
  }
}
