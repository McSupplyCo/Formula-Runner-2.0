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
          vec3 haze = vec3(0.08, 0.12, 0.18);
          vec3 col = mix(haze, zenith, smoothstep(0.0, 0.7, h));
          col += vec3(0.14, 0.2, 0.26) * (1.0 - smoothstep(-0.05, 0.22, h)) * 0.48;
          col += vec3(0.18, 0.08, 0.12) * (1.0 - smoothstep(-0.02, 0.16, h)) * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xd8e4f4 }),
  );
  moon.position.set(-6.5, 11.5, -8);
  envScene.add(moon);

  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const tall = 1.15 + (i % 6) * 0.52 + (i % 3) * 0.18;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.05 + (i % 3) * 0.42, tall, 0.22),
      new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0x101820 : 0x141c24 }),
    );
    block.position.set(Math.cos(a) * 10.5, tall * 0.35, Math.sin(a) * 10.5);
    block.lookAt(0, block.position.y, 0);
    envScene.add(block);

    if (i % 2 === 0) {
      const warm = i % 3 === 0;
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.14, 0.04),
        new THREE.MeshBasicMaterial({ color: warm ? 0xffe2a8 : i % 5 === 0 ? 0xff9ec8 : 0xcfe6ff }),
      );
      window.position.set(Math.cos(a) * 10.35, 0.5 + (i % 5) * 0.26, Math.sin(a) * 10.35);
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
