import * as THREE from "three";

function canvas(width: number, height: number) {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("No 2D context");
  ctx.imageSmoothingEnabled = true;
  return { el, ctx };
}

function toTexture(el: HTMLCanvasElement, repeatY = 6) {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeatY);
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function toLinearTexture(el: HTMLCanvasElement, repeatY = 6) {
  const tex = toTexture(el, repeatY);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function toSignTexture(el: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  color: (i: number) => string,
  size = () => [1 + Math.random() * 2, 1 + Math.random()] as [number, number],
) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = color(i);
    const [sw, sh] = size();
    ctx.fillRect(Math.random() * w, Math.random() * h, sw, sh);
  }
}

function highwayFace(ctx: CanvasRenderingContext2D, w: number, h: number, fill = "#0d5c3a") {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  const inset = Math.max(6, Math.round(Math.min(w, h) * 0.045));
  const border = Math.max(4, Math.round(inset * 0.55));
  ctx.fillStyle = "#f4f7f2";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(border, border, w - border * 2, h - border * 2);
  ctx.fillStyle = "#f4f7f2";
  ctx.fillRect(border + inset - border, border + inset - border, w - (border + inset - border) * 2, h - (border + inset - border) * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  px: number,
  minPx: number,
) {
  let size = px;
  ctx.font = `${weight} ${size}px "Arial Narrow", Arial, Helvetica, sans-serif`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px "Arial Narrow", Arial, Helvetica, sans-serif`;
  }
  return size;
}

/** Worn daylight asphalt. Crisp white dashes, not void black. */
export function makeRoadTexture() {
  const w = 1024;
  const h = 1024;
  const { el, ctx } = canvas(w, h);

  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, "#8a8e92");
  base.addColorStop(0.12, "#7c8186");
  base.addColorStop(0.28, "#868b90");
  base.addColorStop(0.5, "#82878c");
  base.addColorStop(0.72, "#868b90");
  base.addColorStop(0.88, "#7c8186");
  base.addColorStop(1, "#8a8e92");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  speckle(ctx, w, h, 42000, () => {
    const n = 92 + Math.random() * 48;
    const a = 0.12 + Math.random() * 0.28;
    return `rgba(${n},${n + 1},${n + 3},${a})`;
  }, () => [1 + Math.random() * 2.2, 1]);

  speckle(ctx, w, h, 9000, () => {
    const n = 48 + Math.random() * 28;
    return `rgba(${n},${n},${n + 4},${0.1 + Math.random() * 0.2})`;
  });

  for (const x of [210, 430, 594, 814]) {
    ctx.fillStyle = "rgba(62, 66, 70, 0.18)";
    ctx.fillRect(x - 46, 0, 92, h);
  }

  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(110, 96, 70, ${0.04 + Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 18 + Math.random() * 90, 3 + Math.random() * 10);
  }

  ctx.fillStyle = "#f5f6f4";
  ctx.fillRect(36, 0, 14, h);
  ctx.fillRect(w - 50, 0, 14, h);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(38, 0, 4, h);
  ctx.fillRect(w - 44, 0, 4, h);

  const dashW = 12;
  const dashH = 92;
  const gap = 78;
  ctx.fillStyle = "#f7f8f6";
  for (const x of [340, 512, 684]) {
    for (let y = 18; y < h; y += dashH + gap) {
      ctx.fillRect(x - dashW / 2, y, dashW, dashH);
    }
  }

  return toTexture(el, 8);
}

/** Green verge variation for roadside banks. */
export function makeGrassTexture() {
  const { el, ctx } = canvas(512, 512);
  ctx.fillStyle = "#3a4e2c";
  ctx.fillRect(0, 0, 512, 512);

  speckle(ctx, 512, 512, 18000, () => {
    const g = 78 + Math.random() * 72;
    const r = 38 + Math.random() * 36;
    const b = 24 + Math.random() * 22;
    return `rgba(${r},${g},${b},${0.2 + Math.random() * 0.5})`;
  }, () => [1, 1 + Math.random() * 3]);

  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${88 + Math.random() * 40},${70 + Math.random() * 28},${38 + Math.random() * 18},${0.16 + Math.random() * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 28, 4 + Math.random() * 12, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  speckle(ctx, 512, 512, 1600, () => {
    return `rgba(${150 + Math.random() * 50},${140 + Math.random() * 36},${70 + Math.random() * 20},${0.1 + Math.random() * 0.18})`;
  }, () => [1, 2 + Math.random() * 4]);

  speckle(ctx, 512, 512, 400, () => `rgba(210, 206, 180, ${0.08 + Math.random() * 0.12})`);

  return toTexture(el, 4);
}

/** Drab hillside: olive grass with rock flecks. */
export function makeHillTexture() {
  const { el, ctx } = canvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#5a6048");
  g.addColorStop(0.45, "#4a523c");
  g.addColorStop(1, "#3e4634");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  speckle(ctx, 512, 512, 14000, () => {
    const n = 70 + Math.random() * 40;
    return `rgba(${n - 8},${n + 8},${n - 18},${0.16 + Math.random() * 0.34})`;
  }, () => [2 + Math.random() * 5, 1 + Math.random() * 3]);

  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(${110 + Math.random() * 30},${104 + Math.random() * 22},${88 + Math.random() * 16},${0.14 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  speckle(ctx, 512, 512, 800, () => `rgba(${90 + Math.random() * 40},${68 + Math.random() * 22},${42},${0.12 + Math.random() * 0.2})`);

  return toTexture(el, 2);
}

/** Darker = wetter / glossier under night lights. */
export function makeRoadRoughness() {
  const w = 1024;
  const h = 1024;
  const { el, ctx } = canvas(w, h);
  ctx.fillStyle = "#b8b8b8";
  ctx.fillRect(0, 0, w, h);

  speckle(ctx, w, h, 24000, () => {
    const n = 140 + Math.random() * 70;
    return `rgba(${n},${n},${n},${0.12 + Math.random() * 0.22})`;
  });

  for (const x of [210, 430, 594, 814]) {
    ctx.fillStyle = "rgba(88, 88, 90, 0.28)";
    ctx.fillRect(x - 48, 0, 96, h);
  }

  ctx.fillStyle = "rgba(72, 72, 74, 0.45)";
  ctx.fillRect(36, 0, 14, h);
  ctx.fillRect(w - 50, 0, 14, h);

  const dashW = 12;
  const dashH = 92;
  const gap = 78;
  ctx.fillStyle = "rgba(64, 64, 66, 0.5)";
  for (const x of [340, 512, 684]) {
    for (let y = 18; y < h; y += dashH + gap) {
      ctx.fillRect(x - dashW / 2, y, dashW, dashH);
    }
  }

  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(70, 70, 72, ${0.18 + Math.random() * 0.22})`;
    ctx.fillRect(60 + Math.random() * 900, 40 + Math.random() * 940, 24 + Math.random() * 80, 8 + Math.random() * 16);
  }

  return toLinearTexture(el, 8);
}

export function makeKerbTexture() {
  const { el, ctx } = canvas(128, 512);
  ctx.fillStyle = "#c4beb4";
  ctx.fillRect(0, 0, 128, 512);

  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? "#d2cdc4" : "#b6b0a6";
    ctx.fillRect(0, y, 128, 64);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, y, 128, 3);
    ctx.fillStyle = "rgba(40,36,30,0.22)";
    ctx.fillRect(0, y + 60, 128, 4);
    ctx.fillStyle = "rgba(90, 84, 74, 0.18)";
    ctx.fillRect(96, y + 8, 24, 48);
  }

  speckle(ctx, 128, 512, 2200, () => `rgba(${90 + Math.random() * 40},${82 + Math.random() * 28},${60},${0.08 + Math.random() * 0.16})`);

  ctx.fillStyle = "#e8c84a";
  ctx.fillRect(8, 0, 18, 512);
  ctx.fillStyle = "rgba(255,255,240,0.28)";
  ctx.fillRect(10, 0, 6, 512);
  ctx.fillStyle = "rgba(40,32,10,0.2)";
  ctx.fillRect(22, 0, 4, 512);

  const tex = toTexture(el, 5);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeBarrierTexture(label = "HARBOR GP") {
  const { el, ctx } = canvas(256, 1024);
  ctx.fillStyle = "#b7b2a8";
  ctx.fillRect(0, 0, 256, 1024);

  for (let y = 0; y < 1024; y += 128) {
    ctx.fillStyle = y % 256 === 0 ? "#c4bfb4" : "#ada89e";
    ctx.fillRect(0, y, 256, 128);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(0, y, 256, 5);
    ctx.fillStyle = "rgba(40,36,32,0.22)";
    ctx.fillRect(0, y + 122, 256, 6);
    ctx.fillStyle = "#8c8880";
    ctx.beginPath();
    ctx.arc(36, y + 64, 5, 0, Math.PI * 2);
    ctx.arc(220, y + 64, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(20,18,16,0.35)";
    ctx.beginPath();
    ctx.arc(36, y + 64, 2, 0, Math.PI * 2);
    ctx.arc(220, y + 64, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  speckle(ctx, 256, 1024, 5000, () => {
    const n = 90 + Math.random() * 50;
    return `rgba(${n},${n - 6},${n - 16},${0.08 + Math.random() * 0.16})`;
  });

  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(70, 62, 48, ${0.06 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 200, Math.random() * 1024, 20 + Math.random() * 80, 8 + Math.random() * 40);
  }

  ctx.fillStyle = "#d9a012";
  ctx.fillRect(0, 0, 18, 1024);
  ctx.fillRect(238, 0, 18, 1024);
  ctx.fillStyle = "rgba(20,18,14,0.35)";
  ctx.fillRect(18, 0, 4, 1024);
  ctx.fillRect(234, 0, 4, 1024);

  ctx.save();
  ctx.translate(128, 512);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(48, 46, 42, 0.42)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, label, 900, 700, 28, 16);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  return toTexture(el, 2);
}

export function makeCarbonTexture() {
  const { el, ctx } = canvas(64, 64);
  ctx.fillStyle = "#1c1e22";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(110, 116, 124, 0.28)";
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
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeBuildingTexture(accent: string) {
  return makeFacadeAtlas(accent);
}

/** Daytime office / apartment facade — mixed occupancy, not a neon grid. */
export function makeFacadeAtlas(accent: string) {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#c8c2b6";
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = "#b7b1a6";
  ctx.fillRect(0, 0, 512, 40);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(0, 0, 512, 10);
  ctx.globalAlpha = 1;

  let y = 52;
  let row = 0;
  while (y < 990) {
    const floorH = 28 + (row % 5 === 0 ? 8 : 0);
    let x = 14;
    while (x < 498) {
      const colW = 18 + ((x + row * 13) % 17);
      const w = Math.min(colW, 498 - x);
      const roll = (x * 17 + y * 31) % 100;
      ctx.fillStyle = "#9aa8b4";
      ctx.fillRect(x, y, w - 3, floorH - 8);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x + 1, y + 1, Math.max(3, (w - 3) * 0.35), 5);

      if (roll > 78) {
        ctx.fillStyle = "rgba(28, 34, 42, 0.72)";
        ctx.fillRect(x + 1, y + 2, w - 5, floorH - 12);
      } else if (roll > 62) {
        ctx.fillStyle = "rgba(255, 232, 186, 0.55)";
        ctx.fillRect(x + 1, y + 2, w - 5, floorH - 12);
        ctx.fillStyle = "rgba(255, 248, 220, 0.28)";
        ctx.fillRect(x + 2, y + 3, 5, 6);
      } else if (roll > 48) {
        ctx.fillStyle = "rgba(70, 90, 108, 0.35)";
        ctx.fillRect(x + 2, y + 4, w - 8, Math.floor((floorH - 14) * 0.55));
      } else {
        ctx.fillStyle = "rgba(180, 206, 224, 0.28)";
        ctx.fillRect(x + 1, y + 2, w - 5, floorH - 12);
      }
      x += w + 4;
    }
    ctx.fillStyle = "rgba(90, 86, 78, 0.18)";
    ctx.fillRect(0, y + floorH - 6, 512, 3);
    y += floorH + 4;
    row++;
  }

  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeSlabFacade(accent: string) {
  const { el, ctx } = canvas(512, 512);
  ctx.fillStyle = "#d0ccc4";
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.28;
  ctx.fillRect(0, 0, 10, 512);
  ctx.fillRect(502, 0, 10, 512);
  ctx.globalAlpha = 1;

  for (let y = 18; y < 500; y += 36) {
    ctx.fillStyle = "#8fa0ae";
    ctx.fillRect(22, y, 468, 14);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(22, y, 468, 3);
    const lit = (y * 7) % 100;
    if (lit > 70) {
      ctx.fillStyle = "rgba(255, 230, 180, 0.4)";
      ctx.fillRect(40 + (y % 80), y + 2, 90 + (y % 40), 10);
    } else if (lit > 40) {
      ctx.fillStyle = "rgba(40, 50, 60, 0.28)";
      ctx.fillRect(60 + (y % 50), y + 2, 120, 10);
    }
    ctx.fillStyle = "rgba(90, 86, 80, 0.16)";
    ctx.fillRect(18, y + 22, 476, 2);
  }

  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeShedTexture() {
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = "#9a9084";
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 14) {
    ctx.fillStyle = x % 28 === 0 ? "#a89e90" : "#8c8276";
    ctx.fillRect(x, 0, 12, 256);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = "rgba(40,32,24,0.16)";
    ctx.fillRect(x + 10, 0, 2, 256);
  }
  ctx.fillStyle = "rgba(70, 90, 104, 0.7)";
  ctx.fillRect(28, 96, 48, 64);
  ctx.fillStyle = "rgba(255, 236, 190, 0.22)";
  ctx.fillRect(32, 100, 18, 20);
  ctx.fillStyle = "rgba(40, 36, 32, 0.45)";
  ctx.fillRect(168, 140, 42, 52);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeGravelTexture() {
  const { el, ctx } = canvas(512, 512);
  ctx.fillStyle = "#8a7e6c";
  ctx.fillRect(0, 0, 512, 512);

  speckle(ctx, 512, 512, 9000, () => {
    const n = 70 + Math.random() * 50;
    const warm = Math.random() > 0.45;
    return warm
      ? `rgba(${n + 28},${n + 12},${n - 8},${0.22 + Math.random() * 0.35})`
      : `rgba(${n},${n - 4},${n - 10},${0.2 + Math.random() * 0.32})`;
  }, () => [1 + Math.random() * 3, 1 + Math.random() * 2]);

  for (let i = 0; i < 220; i++) {
    const n = 96 + Math.random() * 40;
    ctx.fillStyle = `rgba(${n + 10},${n},${n - 12},${0.28 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 1.2 + Math.random() * 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  speckle(ctx, 512, 512, 400, () => `rgba(58, 72, 40, ${0.1 + Math.random() * 0.16})`);

  return toTexture(el, 4);
}

export function makeBillboardTexture(
  title: string,
  color: string,
  kicker = "MIDNIGHT VOLTAGE  ·  NIGHT CIRCUIT",
  footer = "HARBOR GP  ·  VOLTAGE CIRCUIT  ·  MIDNIGHT CUP",
) {
  const w = 1024;
  const h = 512;
  const { el, ctx } = canvas(w, h);
  highwayFace(ctx, w, h, "#0d5c3a");
  ctx.fillStyle = color;
  ctx.fillRect(28, 28, 18, h - 56);
  ctx.fillRect(w - 46, 28, 18, h - 56);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f7f2";
  fitText(ctx, title, 860, 800, 86, 36);
  ctx.fillText(title, w / 2, 220);

  ctx.fillStyle = "#d5eadc";
  fitText(ctx, kicker, 860, 650, 28, 16);
  ctx.fillText(kicker, w / 2, 300);

  ctx.fillStyle = "#b7d4c4";
  fitText(ctx, footer, 860, 600, 22, 14);
  ctx.fillText(footer, w / 2, 400);
  return toSignTexture(el);
}

export function makeGantrySign(label: string, sub = "HARBOR GP  ·  MIDNIGHT CUP") {
  const w = 1024;
  const h = 288;
  const { el, ctx } = canvas(w, h);
  highwayFace(ctx, w, h, "#0d5c3a");
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f7f2";
  fitText(ctx, label, 900, 800, 72, 28);
  ctx.fillText(label, w / 2, 150);
  ctx.fillStyle = "#c5ddcf";
  fitText(ctx, sub, 900, 650, 26, 14);
  ctx.fillText(sub, w / 2, 214);
  return toSignTexture(el);
}

export function makeDistanceBoard(meters: string, sub = "HARBOR GP") {
  const w = 512;
  const h = 384;
  const { el, ctx } = canvas(w, h);
  highwayFace(ctx, w, h, "#0d5c3a");
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f7f2";
  fitText(ctx, meters, 420, 800, 148, 48);
  ctx.fillText(meters, w / 2, 210);
  ctx.fillStyle = "#d5eadc";
  fitText(ctx, sub, 400, 700, 28, 16);
  ctx.fillText(sub, w / 2, 292);
  return toSignTexture(el);
}

export function makeMarshalBoard(mode: "clear" | "hold", sub = "VOLTAGE CIRCUIT") {
  const w = 384;
  const h = 320;
  const { el, ctx } = canvas(w, h);
  const fill = mode === "clear" ? "#0d5c3a" : "#8a6a12";
  highwayFace(ctx, w, h, fill);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f7f2";
  fitText(ctx, mode === "clear" ? "CLEAR" : "HOLD", 300, 800, 64, 28);
  ctx.fillText(mode === "clear" ? "CLEAR" : "HOLD", w / 2, 168);
  ctx.fillStyle = mode === "clear" ? "#d5eadc" : "#f0e6c0";
  fitText(ctx, sub, 300, 650, 22, 14);
  ctx.fillText(sub, w / 2, 226);
  return toSignTexture(el);
}
