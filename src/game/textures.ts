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

export function makeRoadTexture() {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#1c2430";
  ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 9000; i++) {
    const n = 18 + Math.random() * 22;
    ctx.fillStyle = `rgba(${n},${n + 4},${n + 10},${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
  }

  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(6, 0, 10, 1024);
  ctx.fillRect(496, 0, 10, 1024);

  ctx.fillStyle = "#dce6f0";
  for (const x of [128, 256, 384]) {
    for (let y = 24; y < 1024; y += 96) {
      ctx.fillRect(x - 3, y, 6, 48);
    }
  }

  ctx.fillStyle = "#ffd600";
  for (let y = 0; y < 1024; y += 32) {
    ctx.fillRect(18, y, 4, 16);
    ctx.fillRect(490, y, 4, 16);
  }

  return toTexture(el, 8);
}

/** Darker = glossier. Long streaks read as wet asphalt under night lights. */
export function makeRoadRoughness() {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 48; i++) {
    const alpha = 0.22 + Math.random() * 0.4;
    ctx.fillStyle = `rgba(28, 28, 28, ${alpha})`;
    ctx.fillRect(12 + Math.random() * 488, 0, 1 + Math.random() * 5, 1024);
  }
  return toTexture(el, 8);
}

export function makeKerbTexture() {
  const { el, ctx } = canvas(64, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? "#f4f4f4" : "#e10600";
    ctx.fillRect(0, y, 64, 32);
  }
  const tex = toTexture(el, 10);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeBuildingTexture(accent: string) {
  const { el, ctx } = canvas(128, 256);
  ctx.fillStyle = "#0c141e";
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 240; y += 18) {
    for (let x = 8; x < 120; x += 14) {
      const lit = Math.random() > 0.38;
      ctx.fillStyle = lit ? accent : "#151e28";
      ctx.globalAlpha = lit ? 0.55 + Math.random() * 0.4 : 0.9;
      ctx.fillRect(x, y, 8, 11);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function makeBillboardTexture(title: string, color: string) {
  const { el, ctx } = canvas(512, 256);
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 244, 512, 12);
  ctx.fillStyle = "#e8f4ff";
  ctx.font = "700 54px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, 256, 120);
  ctx.fillStyle = color;
  ctx.font = "500 22px sans-serif";
  ctx.fillText("ORIGINAL CIRCUIT SERIES", 256, 168);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
