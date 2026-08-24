import * as THREE from "three";
import { BRAND, ROAD } from "./tuning";
import { createLightPole } from "./vehicles";
import {
  makeBillboardTexture,
  makeBuildingTexture,
  makeKerbTexture,
  makeRoadRoughness,
  makeRoadTexture,
} from "./textures";

export type Zone = {
  name: string;
  fog: number;
  horizon: number;
  neon: number;
  window: string;
};

export const ZONES: Zone[] = [
  { name: "Harbor Lights", fog: 0x07141f, horizon: 0x123044, neon: BRAND.cyan, window: "#7ad7ff" },
  { name: "Neon Cut", fog: 0x120814, horizon: 0x3a1040, neon: BRAND.magenta, window: "#ff7ab8" },
  { name: "Storm Ribbon", fog: 0x061816, horizon: 0x0e3040, neon: BRAND.green, window: "#9cff7a" },
  { name: "Apex Void", fog: 0x08070c, horizon: 0x101828, neon: BRAND.gold, window: "#ffe08a" },
];

export function zoneAt(distance: number): Zone {
  if (distance > 4000) return ZONES[3];
  if (distance > 2000) return ZONES[2];
  if (distance > 800) return ZONES[1];
  return ZONES[0];
}

const CITY_COUNT = 120;
const BUILDING_SPACING = 14;

export class TrackWorld {
  readonly group = new THREE.Group();
  private segments: THREE.Group[] = [];
  private roadMat: THREE.MeshStandardMaterial;
  private edgeMat: THREE.MeshStandardMaterial;
  private kerbMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private fog: THREE.Fog;
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private city: THREE.InstancedMesh;
  private cityDummy = new THREE.Object3D();
  private citySlots: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
  private stars: THREE.Points;
  private ground: THREE.Mesh;

  constructor(private scene: THREE.Scene) {
    this.fog = new THREE.Fog(ZONES[0].fog, 55, 260);
    scene.fog = this.fog;
    scene.background = new THREE.Color(ZONES[0].fog);

    this.roadMat = new THREE.MeshStandardMaterial({
      map: makeRoadTexture(),
      roughnessMap: makeRoadRoughness(),
      roughness: 0.28,
      metalness: 0.22,
    });
    this.edgeMat = new THREE.MeshStandardMaterial({
      color: BRAND.cyan,
      emissive: BRAND.cyan,
      emissiveIntensity: 2.8,
      roughness: 0.25,
    });
    this.kerbMat = new THREE.MeshStandardMaterial({
      map: makeKerbTexture(),
      roughness: 0.55,
      metalness: 0.1,
    });
    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a2430,
      roughness: 0.55,
      metalness: 0.35,
    });

    const hemi = new THREE.HemisphereLight(0x8eb4d8, 0x0a1018, 0.95);
    const moon = new THREE.DirectionalLight(0xe8f2ff, 1.15);
    moon.position.set(-22, 48, 8);
    const fill = new THREE.DirectionalLight(0x00e5ff, 0.28);
    fill.position.set(16, 10, -8);
    scene.add(hemi, moon, fill);

    this.skyMat = this.makeSky();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 20), this.skyMat);
    this.sky.scale.y = 0.62;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.stars = this.makeStars();
    scene.add(this.stars);

    this.city = this.makeCity();
    scene.add(this.city);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 900),
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
    this.scene.background = new THREE.Color(zone.fog);
    this.edgeMat.color.setHex(zone.neon);
    this.edgeMat.emissive.setHex(zone.neon);
    this.skyMat.uniforms.horizon.value.setHex(zone.horizon);
    this.skyMat.uniforms.neon.value.setHex(zone.neon);

    const start = Math.floor((playerZ - ROAD.segmentLength) / ROAD.segmentLength);
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].position.z = (start + i) * ROAD.segmentLength;
    }

    this.ground.position.z = playerZ + 180;
    this.stars.position.z = playerZ;
    this.sky.position.z = playerZ;

    const ahead = playerZ + CITY_COUNT * BUILDING_SPACING * 0.45;
    const behind = playerZ - 40;
    for (let i = 0; i < this.citySlots.length; i++) {
      const slot = this.citySlots[i];
      while (slot.z < behind) slot.z += CITY_COUNT * BUILDING_SPACING * 0.5;
      while (slot.z > ahead) slot.z -= CITY_COUNT * BUILDING_SPACING * 0.5;
      this.cityDummy.position.set(slot.x, slot.sy / 2, slot.z);
      this.cityDummy.scale.set(slot.sx, slot.sy, slot.sz);
      this.cityDummy.updateMatrix();
      this.city.setMatrixAt(i, this.cityDummy.matrix);
    }
    this.city.instanceMatrix.needsUpdate = true;
  }

  private makeSky() {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x02050b) },
        horizon: { value: new THREE.Color(ZONES[0].horizon) },
        neon: { value: new THREE.Color(ZONES[0].neon) },
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
        void main() {
          float h = clamp(vPos.y / 180.0, -0.2, 1.0);
          vec3 col = mix(horizon, top, smoothstep(0.0, 0.85, h));
          col = mix(col, neon, 0.12 * (1.0 - smoothstep(0.0, 0.35, h)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  private makeStars() {
    const count = 400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 420;
      pos[i * 3 + 1] = 30 + Math.random() * 140;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xcfe8ff, size: 0.55, transparent: true, opacity: 0.7, depthWrite: false }),
    );
  }

  private makeCity() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: makeBuildingTexture(ZONES[0].window),
      roughness: 0.72,
      metalness: 0.22,
      emissive: new THREE.Color(0x12202c),
      emissiveIntensity: 0.35,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, CITY_COUNT);
    for (let i = 0; i < CITY_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const slot = {
        x: side * (22 + (i % 7) * 3.4 + (i % 5)),
        y: 0,
        z: Math.floor(i / 2) * BUILDING_SPACING,
        sx: 4 + (i % 4),
        sy: 10 + (i % 11) * 2.8 + (i % 3) * 4,
        sz: 6 + (i % 5),
      };
      this.citySlots.push(slot);
      this.cityDummy.position.set(slot.x, slot.sy / 2, slot.z);
      this.cityDummy.scale.set(slot.sx, slot.sy, slot.sz);
      this.cityDummy.updateMatrix();
      mesh.setMatrixAt(i, this.cityDummy.matrix);
    }
    return mesh;
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
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, ROAD.segmentLength), this.kerbMat);
      kerb.position.set(side * (ROAD.halfWidth + 0.22), 0.08, 0);
      g.add(kerb);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, ROAD.segmentLength), this.edgeMat);
      edge.position.set(side * (ROAD.halfWidth + 0.04), 0.05, 0);
      g.add(edge);

      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.05, ROAD.segmentLength), this.wallMat);
      wall.position.set(side * (ROAD.halfWidth + 1.05), 0.52, 0);
      g.add(wall);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, ROAD.segmentLength), this.edgeMat);
      rail.position.set(side * (ROAD.halfWidth + 1.05), 1.08, 0);
      g.add(rail);

      for (const offset of [-16, 16]) {
        const pole = createLightPole();
        pole.position.set(side * (ROAD.halfWidth + 2.6), 0, offset);
        if (side > 0) pole.rotation.y = Math.PI;
        g.add(pole);
      }
    }

    const flavor = index % 5;
    if (flavor === 1) this.addGantry(g);
    if (flavor === 3) this.addBillboard(g, index);
    if (flavor === 4) this.addTunnel(g);

    return g;
  }

  private addGantry(g: THREE.Group) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD.width + 6, 0.22, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x151c26,
        emissive: BRAND.magenta,
        emissiveIntensity: 0.45,
        metalness: 0.4,
        roughness: 0.4,
      }),
    );
    beam.position.set(0, 5.2, 0);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), new THREE.MeshStandardMaterial({ color: 0x1a2430 }));
    left.position.set(-(ROAD.halfWidth + 2.6), 2.6, 0);
    const right = left.clone();
    right.position.x *= -1;
    g.add(beam, left, right);
  }

  private addBillboard(g: THREE.Group, index: number) {
    const titles = ["VOLT GRID", "NIGHT APEX", "PULSE LANE", "ZERO DRAG"];
    const colors = ["#00E5FF", "#FF006E", "#39FF14", "#FFD600"];
    const tex = makeBillboardTexture(titles[index % titles.length], colors[index % colors.length]);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0x222830, emissiveIntensity: 0.4 }),
    );
    const side = index % 2 === 0 ? -1 : 1;
    board.position.set(side * (ROAD.halfWidth + 8.5), 6.2, 0);
    board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(board);
  }

  private addTunnel(g: THREE.Group) {
    const lining = new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: BRAND.cyan,
      emissiveIntensity: 0.18,
      roughness: 0.7,
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 8, 0.35, 16), lining);
    roof.position.y = 5.4;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 16), lining);
      wall.position.set(side * (ROAD.halfWidth + 3.4), 2.7, 0);
      g.add(wall);
    }
    g.add(roof);
  }
}
