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
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(12, 12, 14, ${0.35 + Math.random() * 0.35})`;
    ctx.fillRect(40 + Math.random() * 420, 80 + Math.random() * 850, 18 + Math.random() * 70, 6 + Math.random() * 14);
  }
  return toTexture(el, 8);
}

export function makeKerbTexture() {
  const { el, ctx } = canvas(64, 256);
  for (let y = 0; y < 256; y += 48) {
    const light = y % 96 === 0;
    ctx.fillStyle = light ? "#e8eaee" : "#8a1a24";
    ctx.fillRect(0, y, 64, 48);
    ctx.fillStyle = light ? "rgba(255,255,255,0.35)" : "rgba(255,80,90,0.18)";
    ctx.fillRect(0, y, 10, 48);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(54, y, 10, 48);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, y + 44, 64, 4);
  }
  const tex = toTexture(el, 5);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeBarrierTexture() {
  const { el, ctx } = canvas(128, 512);
  ctx.fillStyle = "#5e6774";
  ctx.fillRect(0, 0, 128, 512);
  for (let y = 0; y < 512; y += 20) {
    ctx.fillStyle = y % 40 === 0 ? "#8a93a0" : "#4a5260";
    ctx.fillRect(0, y, 128, 12);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(0, y, 128, 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, y + 10, 128, 2);
    ctx.fillStyle = "#cfd6de";
    ctx.fillRect(18, y + 4, 3, 3);
    ctx.fillRect(108, y + 4, 3, 3);
  }
  ctx.fillStyle = "#d4a017";
  ctx.fillRect(0, 0, 8, 512);
  ctx.fillRect(120, 0, 8, 512);
  ctx.save();
  ctx.translate(64, 256);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(18, 22, 28, 0.55)";
  ctx.font = "700 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HARBOR GP", 0, 8);
  ctx.restore();
  return toTexture(el, 2);
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
  return makeFacadeAtlas(accent);
}

/** Irregular night facade — lit bands, not a bathroom-tile window grid. */
export function makeFacadeAtlas(accent: string) {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#0a1016";
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, 512, 48);

  let y = 56;
  while (y < 980) {
    const floorH = 16 + Math.floor(Math.random() * 18);
    const darkBand = Math.random() > 0.7;
    let x = 10;
    while (x < 500) {
      const colW = 8 + Math.floor(Math.random() * 14);
      const wide = Math.random() > 0.88;
      const w = wide ? colW * 2 + 4 : colW;
      if (darkBand || Math.random() > 0.38) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#121820";
        ctx.fillRect(x, y, w - 2, floorH - 3);
      } else {
        const warm = Math.random() > 0.72;
        ctx.fillStyle = warm ? "#ffe6b0" : accent;
        ctx.globalAlpha = 0.4 + Math.random() * 0.5;
        ctx.fillRect(x, y, w - 2, floorH - 3);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#fff8e0";
        ctx.fillRect(x + 1, y + 1, Math.max(2, w / 3), 4);
      }
      x += w + (Math.random() > 0.7 ? 8 : 3);
    }
    y += floorH + (Math.random() > 0.85 ? 10 : 3);
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

export function makeSlabFacade(accent: string) {
  const { el, ctx } = canvas(512, 512);
  ctx.fillStyle = "#0b121a";
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 0, 6, 512);
  ctx.fillRect(506, 0, 6, 512);
  ctx.globalAlpha = 1;
  for (let y = 28; y < 490; y += 22) {
    if (Math.random() > 0.55) continue;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.45 + Math.random() * 0.4;
    ctx.fillRect(18, y, 476, 5 + Math.random() * 4);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function makeShedTexture() {
  const { el, ctx } = canvas(128, 128);
  ctx.fillStyle = "#14181e";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#ffe0a0";
  ctx.globalAlpha = 0.55;
  ctx.fillRect(18, 48, 22, 36);
  ctx.fillRect(88, 70, 18, 14);
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeGravelTexture() {
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = "#161410";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2800; i++) {
    const n = 18 + Math.random() * 36;
    const warm = Math.random() > 0.7;
    ctx.fillStyle = warm
      ? `rgba(${n + 18},${n + 6},${n - 8},${0.18 + Math.random() * 0.3})`
      : `rgba(${n},${n - 4},${n - 8},${0.2 + Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random());
  }
  for (let i = 0; i < 40; i++) {
    const n = 28 + Math.random() * 22;
    ctx.fillStyle = `rgba(${n + 8},${n},${n - 10},0.35)`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(el, 4);
}

export function makeBillboardTexture(title: string, color: string, kicker = "MIDNIGHT VOLTAGE  ·  NIGHT CIRCUIT") {
  const { el, ctx } = canvas(512, 256);
  ctx.fillStyle = "#070a0e";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 256);
  ctx.fillRect(496, 0, 16, 256);
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 244, 512, 12);
  ctx.globalAlpha = 0.18;
  ctx.fillRect(28, 168, 456, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#e8f0f8";
  ctx.font = "700 46px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, 256, 118);
  ctx.fillStyle = color;
  ctx.font = "600 15px sans-serif";
  ctx.fillText(kicker, 256, 168);
  ctx.fillStyle = "#9aa8b4";
  ctx.font = "500 13px sans-serif";
  ctx.fillText("HARBOR GP  ·  VOLTAGE CIRCUIT  ·  MIDNIGHT CUP", 256, 208);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeGantrySign(label: string) {
  const { el, ctx } = canvas(384, 112);
  ctx.fillStyle = "#16382a";
  ctx.fillRect(0, 0, 384, 112);
  ctx.fillStyle = "#c8d2c4";
  ctx.fillRect(0, 0, 384, 6);
  ctx.fillRect(0, 106, 384, 6);
  ctx.fillStyle = "#2a6a4e";
  ctx.fillRect(12, 16, 6, 80);
  ctx.fillStyle = "#eef4ea";
  ctx.font = "700 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, 198, 58);
  ctx.fillStyle = "#9ec9b0";
  ctx.font = "600 12px sans-serif";
  ctx.fillText("HARBOR GP  ·  MIDNIGHT CUP", 198, 86);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeDistanceBoard(meters: string) {
  const { el, ctx } = canvas(256, 192);
  ctx.fillStyle = "#f2f0ea";
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = "#14181e";
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 182, 256, 10);
  ctx.fillRect(0, 0, 10, 192);
  ctx.fillRect(246, 0, 10, 192);
  ctx.fillStyle = "#14181e";
  ctx.font = "700 92px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(meters, 128, 118);
  ctx.font = "700 16px sans-serif";
  ctx.fillText("HARBOR GP", 128, 158);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeMarshalBoard(mode: "clear" | "hold") {
  const { el, ctx } = canvas(192, 160);
  const fill = mode === "clear" ? "#1f8a4c" : "#c48a12";
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 192, 160);
  ctx.fillStyle = "#0c1014";
  ctx.fillRect(0, 0, 192, 8);
  ctx.fillRect(0, 152, 192, 8);
  ctx.fillStyle = "#f4f6f0";
  ctx.font = "700 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(mode === "clear" ? "CLEAR" : "HOLD", 96, 78);
  ctx.font = "600 13px sans-serif";
  ctx.fillText("VOLTAGE CIRCUIT", 96, 112);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
