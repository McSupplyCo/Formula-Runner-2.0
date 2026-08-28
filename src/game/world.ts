import * as THREE from "three";
import { BRAND, ROAD } from "./tuning";
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

export type Zone = {
  name: string;
  fog: number;
  horizon: number;
  neon: number;
  window: string;
  top: number;
  glow: number;
  fogDensity: number;
  cityEmit: number;
  cityBoost: number;
  lamp: number;
  star: number;
};

export const ZONES: Zone[] = [
  {
    name: "Harbor Lights",
    fog: 0x07141f,
    horizon: 0x123044,
    neon: BRAND.cyan,
    window: "#7ad7ff",
    top: 0x02050b,
    glow: 0.045,
    fogDensity: 0.0032,
    cityEmit: 0.24,
    cityBoost: 0.36,
    lamp: 0xffe4bc,
    star: 0.48,
  },
  {
    name: "Neon Cut",
    fog: 0x160610,
    horizon: 0x4a1238,
    neon: BRAND.magenta,
    window: "#ff7ab8",
    top: 0x0a0312,
    glow: 0.13,
    fogDensity: 0.0038,
    cityEmit: 0.4,
    cityBoost: 0.62,
    lamp: 0xffc4d8,
    star: 0.22,
  },
  {
    name: "Storm Ribbon",
    fog: 0x041814,
    horizon: 0x0c3c38,
    neon: BRAND.green,
    window: "#9cff7a",
    top: 0x02110e,
    glow: 0.1,
    fogDensity: 0.0044,
    cityEmit: 0.32,
    cityBoost: 0.5,
    lamp: 0xd4f4e4,
    star: 0.18,
  },
  {
    name: "Apex Void",
    fog: 0x06050a,
    horizon: 0x1c1608,
    neon: BRAND.gold,
    window: "#ffe08a",
    top: 0x010103,
    glow: 0.055,
    fogDensity: 0.0026,
    cityEmit: 0.14,
    cityBoost: 0.22,
    lamp: 0xffe2a8,
    star: 0.72,
  },
];

export function zoneAt(distance: number): Zone {
  if (distance > 4000) return ZONES[3];
  if (distance > 2000) return ZONES[2];
  if (distance > 800) return ZONES[1];
  return ZONES[0];
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
  private segments: THREE.Group[] = [];
  private roadMat: THREE.MeshPhysicalMaterial;
  private edgeMat: THREE.MeshStandardMaterial;
  private kerbMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private gravelMat: THREE.MeshStandardMaterial;
  private fog: THREE.FogExp2;
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private cityLayers: THREE.InstancedMesh[] = [];
  private citySlots: CitySlot[] = [];
  private cityDummy = new THREE.Object3D();
  private stars: THREE.Points;
  private ground: THREE.Mesh;
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

  constructor(private scene: THREE.Scene) {
    this.fog = new THREE.FogExp2(ZONES[0].fog, ZONES[0].fogDensity);
    scene.fog = this.fog;
    scene.background = this.fog.color;

    this.roadMat = new THREE.MeshPhysicalMaterial({
      map: makeRoadTexture(),
      roughnessMap: makeRoadRoughness(),
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
      map: makeBarrierTexture(),
      color: 0x8a93a0,
      roughness: 0.38,
      metalness: 0.72,
      envMapIntensity: 0.85,
    });
    this.gravelMat = new THREE.MeshStandardMaterial({
      map: makeGravelTexture(),
      color: 0x2c2820,
      roughness: 1,
      metalness: 0,
    });
    this.towerMat = new THREE.MeshStandardMaterial({
      map: makeBuildingTexture(ZONES[0].window),
      roughness: 0.8,
      metalness: 0.14,
      envMapIntensity: 0.3,
      emissive: new THREE.Color(0x101820),
      emissiveIntensity: 0.28,
    });
    this.slabMat = new THREE.MeshStandardMaterial({
      map: makeSlabFacade(ZONES[0].window),
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
    this.postMat = new THREE.MeshStandardMaterial({
      color: 0x1c222c,
      roughness: 0.48,
      metalness: 0.35,
      emissive: 0xc8d2dc,
      emissiveIntensity: 0.18,
    });
    this.marshalMats = [
      new THREE.MeshStandardMaterial({
        map: makeMarshalBoard("clear"),
        roughness: 0.55,
        metalness: 0.06,
        side: THREE.DoubleSide,
        emissive: 0x0a2014,
        emissiveIntensity: 0.22,
      }),
      new THREE.MeshStandardMaterial({
        map: makeMarshalBoard("hold"),
        roughness: 0.55,
        metalness: 0.06,
        side: THREE.DoubleSide,
        emissive: 0x201408,
        emissiveIntensity: 0.22,
      }),
    ];
    this.distMats = ["50", "100", "200"].map(
      (label) =>
        new THREE.MeshStandardMaterial({
          map: makeDistanceBoard(label),
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

    this.makeCity();

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(640, 1400),
      new THREE.MeshStandardMaterial({ color: 0x080e16, roughness: 1, metalness: 0 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.22;
    scene.add(this.ground);

    for (let i = 0; i < ROAD.segmentCount; i++) {
      const segment = this.makeSegment(i);
      segment.position.z = i * ROAD.segmentLength;
      this.segments.push(segment);
      this.group.add(segment);
    }
    scene.add(this.group);
  }

  update(playerZ: number, distance: number) {
    const zone = zoneAt(distance);
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
    this.starMat.opacity = zone.star;

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
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(ZONES[0].top) },
        horizon: { value: new THREE.Color(ZONES[0].horizon) },
        neon: { value: new THREE.Color(ZONES[0].neon) },
        glow: { value: ZONES[0].glow },
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
      opacity: ZONES[0].star,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return new THREE.Points(geo, this.starMat);
  }

  private makeCity() {
    const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.towerMat, 72);
    const crowns = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.85, metalness: 0.2 }),
      72,
    );
    const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.slabMat, 56);
    const sheds = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        map: makeShedTexture(),
        roughness: 0.9,
        metalness: 0.08,
      }),
      40,
    );
    const antennas = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x1a222c, roughness: 0.45, metalness: 0.55 }),
      36,
    );
    this.horizonMat = new THREE.MeshStandardMaterial({
      color: 0x0a121c,
      roughness: 0.92,
      metalness: 0.08,
      emissive: new THREE.Color(0x152030),
      emissiveIntensity: 0.22,
    });
    const horizon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.horizonMat, 48);
    this.cityLayers = [towers, crowns, slabs, sheds, antennas, horizon];
    for (const layer of this.cityLayers) {
      layer.frustumCulled = false;
      this.scene.add(layer);
    }

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
    for (const layer of this.cityLayers) {
      if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
      layer.instanceMatrix.needsUpdate = true;
      layer.computeBoundingSphere();
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

  private makeSegment(index: number) {
    const g = new THREE.Group();
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD.width + 1.2, ROAD.segmentLength),
      this.roadMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    g.add(road);

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

      const tree = createTree();
      tree.position.set(side * (ROAD.halfWidth + 3.9), 0, ((index * 7) % 11) - 5);
      tree.scale.setScalar(0.88 + (index % 5) * 0.12);
      g.add(tree);

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

    return g;
  }

  private addGantry(g: THREE.Group, index: number) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x151c26, metalness: 0.55, roughness: 0.38 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 6, 0.22, 0.5), steel);
    beam.position.set(0, 5.2, 0);
    const labels = ["HARBOR GP 2 km", "VOLTAGE CKT", "MIDNIGHT CUP", "LANES OPEN"];
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.2),
      new THREE.MeshStandardMaterial({
        map: makeGantrySign(labels[index % labels.length] ?? "HARBOR GP 2 km"),
        roughness: 0.62,
        metalness: 0.08,
        side: THREE.DoubleSide,
      }),
    );
    sign.position.set(0, 4.55, 0.28);
    sign.rotation.y = Math.PI;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), steel);
    left.position.set(-(ROAD.halfWidth + 2.6), 2.6, 0);
    const right = left.clone();
    right.position.x *= -1;
    g.add(beam, sign, left, right);
  }

  private addBillboard(g: THREE.Group, index: number) {
    const titles = ["HARBOR GP", "VOLTAGE CIRCUIT", "MIDNIGHT CUP", "GRID LIGHT"];
    const kickers = [
      "STREET CIRCUIT  ·  NIGHT",
      "MIDNIGHT VOLTAGE",
      "ROUND 04  ·  HARBOR",
      "VOLTAGE SERIES  ·  LIVE",
    ];
    const colors = ["#2a6a88", "#7a2458", "#6a5a28", "#3a5468"];
    const tex = makeBillboardTexture(
      titles[index % titles.length],
      colors[index % colors.length],
      kickers[index % kickers.length],
    );
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0x101418,
        emissiveIntensity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    const side = index % 2 === 0 ? -1 : 1;
    board.position.set(side * (ROAD.halfWidth + 8.5), 6.2, 0);
    board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(board);
  }

  private addTunnel(g: THREE.Group) {
    const lining = new THREE.MeshStandardMaterial({
      color: 0x121820,
      roughness: 0.78,
      metalness: 0.12,
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 8, 0.35, 16), lining);
    roof.position.y = 5.4;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD.width + 6, 0.04, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xffe6c4, emissive: 0xffe0b0, emissiveIntensity: 0.35 }),
    );
    strip.position.set(0, 5.18, 0);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 16), lining);
      wall.position.set(side * (ROAD.halfWidth + 3.4), 2.7, 0);
      g.add(wall);
    }
    g.add(roof, strip);
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
