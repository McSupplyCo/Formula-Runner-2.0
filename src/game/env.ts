import * as THREE from "three";

/** Night cubemap: city blocks and warm windows, not a club-light ring. */
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
          vec3 zenith = vec3(0.01, 0.016, 0.03);
          vec3 haze = vec3(0.07, 0.11, 0.16);
          vec3 col = mix(haze, zenith, smoothstep(0.0, 0.7, h));
          col += vec3(0.12, 0.18, 0.22) * (1.0 - smoothstep(-0.05, 0.22, h)) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);

  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const tall = 1.2 + (i % 5) * 0.55;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.1 + (i % 3) * 0.4, tall, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x141c24 }),
    );
    block.position.set(Math.cos(a) * 10.5, tall * 0.35, Math.sin(a) * 10.5);
    block.lookAt(0, block.position.y, 0);
    envScene.add(block);

    if (i % 2 === 0) {
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.04),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffe2a8 : 0xcfe6ff }),
      );
      window.position.set(Math.cos(a) * 10.35, 0.55 + (i % 4) * 0.28, Math.sin(a) * 10.35);
      window.lookAt(0, window.position.y, 0);
      envScene.add(window);
    }
  }

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0x0c1016 }),
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
