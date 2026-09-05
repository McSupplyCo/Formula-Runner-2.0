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
    zenith: new THREE.Vector3(0.01, 0.016, 0.03),
    haze: new THREE.Vector3(0.08, 0.12, 0.18),
    low: new THREE.Vector3(0.14, 0.2, 0.26),
    warm: new THREE.Vector3(0.18, 0.08, 0.12),
    blockA: 0x101820,
    blockB: 0x141c24,
    winWarm: 0xffe2a8,
    winAccent: 0xff9ec8,
    winCool: 0xcfe6ff,
    ground: 0x0c1016,
    moon: 0xd8e4f4,
  },
  ember: {
    zenith: new THREE.Vector3(0.02, 0.012, 0.008),
    haze: new THREE.Vector3(0.16, 0.08, 0.04),
    low: new THREE.Vector3(0.26, 0.13, 0.05),
    warm: new THREE.Vector3(0.22, 0.09, 0.03),
    blockA: 0x180e08,
    blockB: 0x1e120a,
    winWarm: 0xffc078,
    winAccent: 0xff8a3a,
    winCool: 0xffd8a0,
    ground: 0x120a06,
    moon: 0xf0d0a0,
  },
  canyon: {
    zenith: new THREE.Vector3(0.012, 0.02, 0.032),
    haze: new THREE.Vector3(0.09, 0.15, 0.2),
    low: new THREE.Vector3(0.16, 0.26, 0.32),
    warm: new THREE.Vector3(0.1, 0.16, 0.22),
    blockA: 0x0e1620,
    blockB: 0x14202c,
    winWarm: 0xdff2ff,
    winAccent: 0x8fe4ff,
    winCool: 0xe8f8ff,
    ground: 0x0a1018,
    moon: 0xe4f2ff,
  },
  ridge: {
    zenith: new THREE.Vector3(0.008, 0.008, 0.012),
    haze: new THREE.Vector3(0.1, 0.08, 0.05),
    low: new THREE.Vector3(0.18, 0.13, 0.07),
    warm: new THREE.Vector3(0.16, 0.1, 0.04),
    blockA: 0x140f0a,
    blockB: 0x1a140c,
    winWarm: 0xffd9a0,
    winAccent: 0xffb45c,
    winCool: 0xffe6c0,
    ground: 0x100c08,
    moon: 0xffe8c4,
  },
  delta: {
    zenith: new THREE.Vector3(0.008, 0.022, 0.018),
    haze: new THREE.Vector3(0.06, 0.16, 0.14),
    low: new THREE.Vector3(0.1, 0.24, 0.2),
    warm: new THREE.Vector3(0.06, 0.16, 0.13),
    blockA: 0x0c1a16,
    blockB: 0x12241e,
    winWarm: 0xb8ffe4,
    winAccent: 0x3dffc8,
    winCool: 0xd4fff0,
    ground: 0x081410,
    moon: 0xc4f0d8,
  },
  sprawl: {
    zenith: new THREE.Vector3(0.024, 0.008, 0.022),
    haze: new THREE.Vector3(0.2, 0.05, 0.14),
    low: new THREE.Vector3(0.26, 0.08, 0.2),
    warm: new THREE.Vector3(0.22, 0.04, 0.16),
    blockA: 0x180814,
    blockB: 0x1e0c1a,
    winWarm: 0xffb0e0,
    winAccent: 0xff2bd6,
    winCool: 0xffd0f0,
    ground: 0x120814,
    moon: 0xf0c8e4,
  },
  frost: {
    zenith: new THREE.Vector3(0.01, 0.02, 0.036),
    haze: new THREE.Vector3(0.1, 0.16, 0.22),
    low: new THREE.Vector3(0.16, 0.24, 0.3),
    warm: new THREE.Vector3(0.08, 0.14, 0.2),
    blockA: 0x121c24,
    blockB: 0x182430,
    winWarm: 0xd8f4ff,
    winAccent: 0xb8e8ff,
    winCool: 0xe8f8ff,
    ground: 0x0a1218,
    moon: 0xe8f4ff,
  },
  kiln: {
    zenith: new THREE.Vector3(0.032, 0.01, 0.006),
    haze: new THREE.Vector3(0.2, 0.07, 0.03),
    low: new THREE.Vector3(0.3, 0.12, 0.04),
    warm: new THREE.Vector3(0.26, 0.08, 0.02),
    blockA: 0x1a0c08,
    blockB: 0x221008,
    winWarm: 0xffb07a,
    winAccent: 0xff5a2a,
    winCool: 0xffd0a0,
    ground: 0x140808,
    moon: 0xf0c090,
  },
};

/** Night cubemap: city blocks and warm windows, not a club-light ring. */
export function makeNightEnv(renderer: THREE.WebGLRenderer, world: WorldDef = WORLDS[0]) {
  const palette = ENV_PALETTES[world.id];
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
        void main() {
          float h = clamp(vPos.y / 24.0, -0.25, 1.0);
          vec3 col = mix(haze, zenith, smoothstep(0.0, 0.7, h));
          col += low * (1.0 - smoothstep(-0.05, 0.22, h)) * 0.48;
          col += warm * (1.0 - smoothstep(-0.02, 0.16, h)) * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshBasicMaterial({ color: palette.moon }),
  );
  moon.position.set(-6.5, 11.5, -8);
  envScene.add(moon);

  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
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
