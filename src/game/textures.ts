import * as THREE from "three";

function canvas(width: number, height: number) {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("No 2D context");
  return { el, ctx };
}

function toTexture(el: HTMLCanvasElement, repeatY = 6) {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Dark, worn night asphalt. White paint, not neon — the LEDs live on the kerb. */
export function makeRoadTexture() {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#14181e";
  ctx.fillRect(0, 0, 512, 1024);

  for (let i = 0; i < 18000; i++) {
    const n = 16 + Math.random() * 28;
    ctx.fillStyle = `rgba(${n},${n + 2},${n + 6},${0.12 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 1024, 1 + Math.random() * 2, 1);
  }

  for (const x of [96, 224, 288, 416]) {
    ctx.fillStyle = "rgba(8, 8, 10, 0.28)";
    ctx.fillRect(x - 18, 0, 36, 1024);
  }

  ctx.fillStyle = "#cfd6de";
  ctx.fillRect(14, 0, 5, 1024);
  ctx.fillRect(493, 0, 5, 1024);

  ctx.fillStyle = "#d8dee6";
  for (const x of [128, 256, 384]) {
    for (let y = 18; y < 1024; y += 88) {
      ctx.fillRect(x - 2, y, 4, 38);
    }
  }

  return toTexture(el, 8);
}

/** Darker = wetter / glossier under night lights. */
export function makeRoadRoughness() {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#a8a8a8";
  ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(18, 18, 20, ${0.18 + Math.random() * 0.5})`;
    ctx.fillRect(8 + Math.random() * 496, 0, 1 + Math.random() * 4, 1024);
  }
  for (const x of [96, 224, 288, 416]) {
    ctx.fillStyle = "rgba(30, 30, 32, 0.35)";
    ctx.fillRect(x - 16, 0, 32, 1024);
  }
  return toTexture(el, 8);
}

export function makeKerbTexture() {
  const { el, ctx } = canvas(64, 256);
  for (let y = 0; y < 256; y += 48) {
    ctx.fillStyle = y % 96 === 0 ? "#e8eaee" : "#8a1a24";
    ctx.fillRect(0, y, 64, 48);
  }
  const tex = toTexture(el, 5);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeBarrierTexture() {
  const { el, ctx } = canvas(64, 256);
  ctx.fillStyle = "#6a7380";
  ctx.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 18) {
    ctx.fillStyle = y % 36 === 0 ? "#8a93a0" : "#4e5662";
    ctx.fillRect(0, y, 64, 10);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, y, 64, 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, y + 8, 64, 2);
  }
  return toTexture(el, 3);
}

export function makeCarbonTexture() {
  const { el, ctx } = canvas(64, 64);
  ctx.fillStyle = "#14161a";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(90, 96, 104, 0.35)";
  ctx.lineWidth = 1;
  for (let i = -64; i < 64; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 64, 0);
    ctx.lineTo(i, 64);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 8);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function makeBuildingTexture(accent: string) {
  const { el, ctx } = canvas(256, 512);
  ctx.fillStyle = "#0a1018";
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = "#070c12";
  ctx.fillRect(0, 0, 256, 18);

  for (let y = 28; y < 500; y += 22) {
    const floorDark = Math.random() > 0.82;
    for (let x = 12; x < 244; x += 16) {
      if (floorDark || Math.random() > 0.62) {
        ctx.fillStyle = "#121820";
        ctx.globalAlpha = 1;
        ctx.fillRect(x, y, 9, 14);
        continue;
      }
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.35 + Math.random() * 0.5;
      ctx.fillRect(x, y, 9, 14);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#fff4d0";
      ctx.fillRect(x + 1, y + 1, 4, 5);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function makeBillboardTexture(title: string, color: string) {
  const { el, ctx } = canvas(512, 256);
  ctx.fillStyle = "#0c1218";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 256);
  ctx.fillRect(504, 0, 8, 256);
  ctx.fillStyle = "#e8f0f8";
  ctx.font = "700 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, 256, 118);
  ctx.fillStyle = color;
  ctx.font = "500 18px sans-serif";
  ctx.fillText("MIDNIGHT VOLTAGE  ·  ORIGINAL CIRCUIT", 256, 168);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
