import * as THREE from "three";

/** Night cubemap so paint and wet asphalt have something real to reflect. */
export function makeNightEnv(renderer: THREE.WebGLRenderer) {
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(24, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float h = clamp(vPos.y / 24.0, -0.25, 1.0);
          vec3 zenith = vec3(0.012, 0.02, 0.04);
          vec3 haze = vec3(0.09, 0.16, 0.24);
          vec3 col = mix(haze, zenith, smoothstep(0.0, 0.72, h));
          col += vec3(0.18, 0.42, 0.55) * (1.0 - smoothstep(-0.05, 0.28, h)) * 0.45;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const warm = i % 3 !== 0;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(warm ? 0.45 : 0.7, 8, 8),
      new THREE.MeshBasicMaterial({ color: warm ? 0xffe1b0 : 0x7ae7ff }),
    );
    lamp.position.set(Math.cos(a) * 9.5, warm ? 0.55 : 1.6, Math.sin(a) * 9.5);
    envScene.add(lamp);
  }

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0x101820 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  envScene.add(ground);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.06).texture;
  pmrem.dispose();
  sky.geometry.dispose();
  (sky.material as THREE.Material).dispose();
  return texture;
}
