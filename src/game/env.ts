import * as THREE from "three";
import { WORLDS } from "./circuits";
import type { WorldDef, WorldId } from "./circuits";

type EnvPalette = {
  zenith: THREE.Vector3;
  haze: THREE.Vector3;
  low: THREE.Vector3;
  warm: THREE.Vector3;
  blockA: number;
  blockB: number;
  winWarm: number;
  winAccent: number;
  winCool: number;
  ground: number;
  moon: number;
};

const ENV_PALETTES: Record<WorldId, EnvPalette> = {
  harbor: {
    zenith: new THREE.Vector3(0.28, 0.58, 0.98),
    haze: new THREE.Vector3(0.74, 0.9, 1.0),
    low: new THREE.Vector3(0.28, 0.52, 0.2),
    warm: new THREE.Vector3(1.0, 0.94, 0.62),
    blockA: 0x6a7a88,
    blockB: 0x7a8a96,
    winWarm: 0xffe2a8,
    winAccent: 0xffd08a,
    winCool: 0xcfe6ff,
    ground: 0x3a6c28,
    moon: 0xfff8dc,
  },
  ember: {
    zenith: new THREE.Vector3(0.22, 0.12, 0.08),
    haze: new THREE.Vector3(0.72, 0.42, 0.18),
    low: new THREE.Vector3(0.82, 0.48, 0.16),
    warm: new THREE.Vector3(1.0, 0.55, 0.18),
    blockA: 0x4a2c18,
    blockB: 0x5a3820,
    winWarm: 0xffc878,
    winAccent: 0xff8a3a,
    winCool: 0xffe0a8,
    ground: 0x3a2818,
    moon: 0xffd090,
  },
  canyon: {
    zenith: new THREE.Vector3(0.06, 0.22, 0.38),
    haze: new THREE.Vector3(0.28, 0.62, 0.72),
    low: new THREE.Vector3(0.22, 0.55, 0.64),
    warm: new THREE.Vector3(0.35, 0.75, 0.85),
    blockA: 0x1a3848,
    blockB: 0x244858,
    winWarm: 0xc8f8ff,
    winAccent: 0x4ae8ff,
    winCool: 0xe0fcff,
    ground: 0x142830,
    moon: 0xd8f8ff,
  },
  ridge: {
    zenith: new THREE.Vector3(0.08, 0.08, 0.22),
    haze: new THREE.Vector3(0.62, 0.38, 0.18),
    low: new THREE.Vector3(0.75, 0.48, 0.2),
    warm: new THREE.Vector3(0.95, 0.62, 0.28),
    blockA: 0x2a2418,
    blockB: 0x3a3020,
    winWarm: 0xffe0b0,
    winAccent: 0xffb45c,
    winCool: 0xfff0d0,
    ground: 0x2a2218,
    moon: 0xffe8c4,
  },
  delta: {
    zenith: new THREE.Vector3(0.04, 0.22, 0.18),
    haze: new THREE.Vector3(0.22, 0.62, 0.52),
    low: new THREE.Vector3(0.18, 0.55, 0.45),
    warm: new THREE.Vector3(0.25, 0.85, 0.7),
    blockA: 0x14382c,
    blockB: 0x1c4838,
    winWarm: 0xa0ffe0,
    winAccent: 0x3dffc8,
    winCool: 0xd0fff0,
    ground: 0x163428,
    moon: 0xd0fff0,
  },
  sprawl: {
    zenith: new THREE.Vector3(0.18, 0.04, 0.22),
    haze: new THREE.Vector3(0.62, 0.16, 0.42),
    low: new THREE.Vector3(0.72, 0.18, 0.48),
    warm: new THREE.Vector3(0.95, 0.2, 0.7),
    blockA: 0x3a1834,
    blockB: 0x4a2044,
    winWarm: 0xff8ae0,
    winAccent: 0xff2bd6,
    winCool: 0xffd0f4,
    ground: 0x2a1424,
    moon: 0xffc0e8,
  },
  frost: {
    zenith: new THREE.Vector3(0.22, 0.38, 0.52),
    haze: new THREE.Vector3(0.72, 0.84, 0.92),
    low: new THREE.Vector3(0.65, 0.78, 0.88),
    warm: new THREE.Vector3(0.55, 0.72, 0.88),
    blockA: 0x3a505c,
    blockB: 0x486068,
    winWarm: 0xe8f8ff,
    winAccent: 0xc8ecff,
    winCool: 0xf4fcff,
    ground: 0x3a4c58,
    moon: 0xf8fcff,
  },
  kiln: {
    zenith: new THREE.Vector3(0.28, 0.08, 0.04),
    haze: new THREE.Vector3(0.78, 0.28, 0.08),
    low: new THREE.Vector3(0.88, 0.32, 0.08),
    warm: new THREE.Vector3(1.0, 0.35, 0.08),
    blockA: 0x4a1810,
    blockB: 0x5a2014,
    winWarm: 0xff9060,
    winAccent: 0xff4a18,
    winCool: 0xffc090,
    ground: 0x321410,
    moon: 0xffa060,
  },
};

/** Photographic cubemap: blue or dusk sky, haze, green-tinted ground, sun disc. */
export function makeNightEnv(renderer: THREE.WebGLRenderer, world: WorldDef = WORLDS[0]) {
  const palette = ENV_PALETTES[world.id];
  const day = world.id === "harbor";
  const sunPos = new THREE.Vector3(day ? -6.6 : -6.5, day ? 16.2 : 11.5, day ? -7.2 : -8);
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(24, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        zenith: { value: palette.zenith },
        haze: { value: palette.haze },
        low: { value: palette.low },
        warm: { value: palette.warm },
        sunDir: { value: sunPos.clone().normalize() },
        sunGlow: { value: day ? 5.4 : 0.22 },
        sunCore: { value: day ? 72.0 : 180.0 },
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
        uniform vec3 zenith;
        uniform vec3 haze;
        uniform vec3 low;
        uniform vec3 warm;
        uniform vec3 sunDir;
        uniform float sunGlow;
        uniform float sunCore;
        void main() {
          float h = clamp(vPos.y / 24.0, -0.25, 1.0);
          vec3 col = mix(haze, zenith, smoothstep(0.0, 0.72, h));
          col += low * (1.0 - smoothstep(-0.08, 0.18, h)) * 0.62;
          col += warm * (1.0 - smoothstep(-0.02, 0.16, h)) * 0.1;
          float d = max(0.0, dot(normalize(vPos), sunDir));
          col += warm * (pow(d, sunCore) * sunGlow + pow(d, 9.0) * sunGlow * 0.22);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(day ? 2.05 : 0.7, 16, 14),
    new THREE.MeshBasicMaterial({ color: palette.moon }),
  );
  sun.position.copy(sunPos);
  envScene.add(sun);

  if (day) {
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(4.4, 16, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.42 }),
    );
    halo.position.copy(sunPos);
    envScene.add(halo);
  }

  const blockCount = world.id === "harbor" ? 12 : 22;
  for (let i = 0; i < blockCount; i++) {
    const a = (i / blockCount) * Math.PI * 2;
    const tall = 1.15 + (i % 6) * 0.52 + (i % 3) * 0.18;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.05 + (i % 3) * 0.42, tall, 0.22),
      new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? palette.blockA : palette.blockB }),
    );
    block.position.set(Math.cos(a) * 10.5, tall * 0.35, Math.sin(a) * 10.5);
    block.lookAt(0, block.position.y, 0);
    envScene.add(block);

    if (i % 2 === 0) {
      const warm = i % 3 === 0;
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.14, 0.04),
        new THREE.MeshBasicMaterial({
          color: warm ? palette.winWarm : i % 5 === 0 ? palette.winAccent : palette.winCool,
        }),
      );
      window.position.set(Math.cos(a) * 10.35, 0.5 + (i % 5) * 0.26, Math.sin(a) * 10.35);
      window.lookAt(0, window.position.y, 0);
      envScene.add(window);
    }
  }

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: palette.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  envScene.add(ground);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.1).texture;
  pmrem.dispose();
  envScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material.dispose();
  });
  return texture;
}
