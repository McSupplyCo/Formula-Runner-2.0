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

const CIRCUIT = {
  ink: "#111416",
  deep: "#25292b",
  pale: "#e7e0d3",
  cyan: "#71c4c5",
  blue: "#477f88",
  amber: "#e7a84c",
};

function highwayFace(ctx: CanvasRenderingContext2D, w: number, h: number, fill = CIRCUIT.deep) {
  ctx.fillStyle = CIRCUIT.ink;
  ctx.fillRect(0, 0, w, h);
  const inset = Math.max(8, Math.round(Math.min(w, h) * 0.045));
  ctx.fillStyle = CIRCUIT.cyan;
  ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(inset + 5, inset + 5, w - (inset + 5) * 2, h - (inset + 5) * 2);
  ctx.fillStyle = "rgba(220,232,240,0.08)";
  ctx.fillRect(inset + 14, inset + 14, w - (inset + 14) * 2, 3);
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

/** Fine-grain graphite asphalt with race-day ivory markings. */
export function makeRoadTexture() {
  const w = 1024;
  const h = 1024;
  const { el, ctx } = canvas(w, h);

  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, "#24282a");
  base.addColorStop(0.12, "#2d3133");
  base.addColorStop(0.5, "#34383a");
  base.addColorStop(0.88, "#2d3133");
  base.addColorStop(1, "#24282a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Deterministic aggregate flecks break up the surface without noisy repetition.
  for (let i = 0; i < 1700; i++) {
    const x = (i * 137 + (i % 17) * 29) % w;
    const y = (i * 271 + (i % 23) * 13) % h;
    const alpha = 0.018 + (i % 5) * 0.006;
    ctx.fillStyle = i % 3 === 0 ? `rgba(232,224,211,${alpha})` : `rgba(10,12,13,${alpha + 0.012})`;
    ctx.fillRect(x, y, 1 + (i % 4), 1 + ((i + 1) % 2));
  }
  // Subtle rubbered-in racing lines sit beneath the painted lane marks.
  ctx.fillStyle = "rgba(12,14,15,0.17)";
  for (const x of [242, 266, 758, 782]) ctx.fillRect(x, 0, 8, h);

  ctx.fillStyle = CIRCUIT.pale;
  ctx.fillRect(36, 0, 9, h);
  ctx.fillRect(w - 45, 0, 9, h);
  ctx.fillStyle = CIRCUIT.amber;
  ctx.fillRect(31, 0, 2, h);
  ctx.fillRect(w - 33, 0, 2, h);

  const dashW = 10;
  const dashH = 82;
  const gap = 86;
  ctx.fillStyle = "#e7e0d3";
  for (const x of [340, 512, 684]) {
    for (let y = 22; y < h; y += dashH + gap) {
      ctx.fillRect(x - dashW / 2, y, dashW, dashH);
    }
  }

  // Small amber reference ticks keep the road edge readable at speed.
  ctx.fillStyle = CIRCUIT.amber;
  for (let y = 0; y < h; y += 168) {
    ctx.fillRect(20, y + 18, 5, 58);
    ctx.fillRect(w - 25, y + 18, 5, 58);
  }

  return toTexture(el, 8);
}

/** Muted olive and stone ground, deliberately calm beside the racing surface. */
export function makeGrassTexture() {
  const { el, ctx } = canvas(512, 512);
  ctx.fillStyle = "#343a32";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? "#3a4036" : "#373d34";
    ctx.fillRect(0, y, 512, 32);
  }
  ctx.fillStyle = "rgba(168,157,111,0.12)";
  for (let y = 18; y < 512; y += 64) {
    ctx.fillRect(20, y, 72, 3);
    ctx.fillRect(132, y + 12, 46, 3);
    ctx.fillRect(246, y + 4, 94, 3);
    ctx.fillRect(390, y + 16, 66, 3);
  }
  ctx.fillStyle = "rgba(16,18,16,0.2)";
  for (let y = 0; y < 512; y += 128) ctx.fillRect(0, y + 58, 512, 6);

  return toTexture(el, 4);
}

/** Broad, low-contrast hillside bands with a few readable rock facets. */
export function makeHillTexture() {
  const { el, ctx } = canvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#53574b");
  g.addColorStop(0.45, "#464a40");
  g.addColorStop(1, "#343a34");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = "rgba(16,26,39,0.12)";
  for (let y = 34; y < 512; y += 92) {
    ctx.beginPath();
    ctx.moveTo(0, y + 24);
    ctx.lineTo(146, y - 10);
    ctx.lineTo(302, y + 18);
    ctx.lineTo(512, y - 8);
    ctx.lineTo(512, y + 26);
    ctx.lineTo(0, y + 58);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(226,218,202,0.09)";
  for (const [x, y] of [[52, 92], [352, 170], [180, 336], [438, 420]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x + 24, y);
    ctx.lineTo(x + 54, y + 17);
    ctx.lineTo(x + 34, y + 24);
    ctx.closePath();
    ctx.fill();
  }

  return toTexture(el, 2);
}

/** Simple matching roughness mask for asphalt and its painted markings. */
export function makeRoadRoughness() {
  const w = 1024;
  const h = 1024;
  const { el, ctx } = canvas(w, h);
  ctx.fillStyle = "#d0d0d0";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#bcbcbc";
  for (const x of [242, 266, 758, 782]) ctx.fillRect(x, 0, 8, h);
  ctx.fillStyle = "#777777";
  ctx.fillRect(36, 0, 14, h);
  ctx.fillRect(w - 50, 0, 14, h);
  ctx.fillStyle = "#8a8a8a";
  for (const x of [340, 512, 684]) {
    for (let y = 22; y < h; y += 168) {
      ctx.fillRect(x - 5, y, 10, 82);
    }
  }

  return toLinearTexture(el, 8);
}

export function makeKerbTexture() {
  const { el, ctx } = canvas(128, 512);
  ctx.fillStyle = CIRCUIT.pale;
  ctx.fillRect(0, 0, 128, 512);

  for (let y = 0; y < 512; y += 64) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, 38, 64);
    ctx.clip();
    ctx.fillStyle = y % 128 === 0 ? "#c8523e" : "#e7a84c";
    ctx.translate(-14, y);
    for (let x = -64; x < 96; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.lineTo(x + 24, 64);
      ctx.lineTo(x + 56, 0);
      ctx.lineTo(x + 32, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(17,20,22,0.18)";
    ctx.fillRect(0, y + 58, 128, 6);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(38, y + 4, 90, 2);
  }
  ctx.fillStyle = CIRCUIT.ink;
  ctx.fillRect(36, 0, 3, 512);

  const tex = toTexture(el, 5);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeBarrierTexture(label = "HARBOR GP") {
  const { el, ctx } = canvas(256, 1024);
  ctx.fillStyle = "#292c2d";
  ctx.fillRect(0, 0, 256, 1024);

  for (let y = 0; y < 1024; y += 128) {
    ctx.fillStyle = y % 256 === 0 ? "#35393a" : "#2e3233";
    ctx.fillRect(18, y + 5, 220, 118);
    ctx.fillStyle = "rgba(231,224,211,0.1)";
    ctx.fillRect(18, y + 5, 220, 4);
    ctx.fillStyle = "rgba(16,26,39,0.7)";
    ctx.fillRect(18, y + 118, 220, 5);
    ctx.fillStyle = "#686d6d";
    ctx.beginPath();
    ctx.arc(34, y + 64, 4, 0, Math.PI * 2);
    ctx.arc(222, y + 64, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CIRCUIT.ink;
    ctx.beginPath();
    ctx.arc(34, y + 64, 1.5, 0, Math.PI * 2);
    ctx.arc(222, y + 64, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = CIRCUIT.amber;
  ctx.fillRect(0, 0, 6, 1024);
  ctx.fillRect(250, 0, 6, 1024);

  ctx.save();
  ctx.translate(128, 512);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(231,224,211,0.76)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, label, 900, 700, 28, 16);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  return toTexture(el, 2);
}

export function makeCarbonTexture() {
  const { el, ctx } = canvas(64, 64);
  ctx.fillStyle = CIRCUIT.ink;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#203346";
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      if (((x + y) / 8) % 2 === 0) ctx.fillRect(x, y, 4, 4);
      else ctx.fillRect(x + 4, y + 4, 4, 4);
    }
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

/** Simple repeatable window rhythm for distant urban silhouettes. */
export function makeFacadeAtlas(accent: string) {
  const { el, ctx } = canvas(512, 1024);
  ctx.fillStyle = "#172638";
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = "#24394b";
  ctx.fillRect(0, 0, 512, 32);
  ctx.fillRect(0, 988, 512, 36);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, 32, 512, 8);
  ctx.globalAlpha = 1;
  for (let row = 0, y = 52; y < 972; row++, y += 48) {
    ctx.fillStyle = row % 4 === 0 ? "#314a5d" : "#263c50";
    ctx.fillRect(0, y + 34, 512, 3);
    for (let col = 0, x = 20; x < 490; col++, x += 58) {
      const lit = (row * 7 + col * 11) % 9;
      ctx.fillStyle = lit < 2 ? CIRCUIT.amber : lit < 6 ? "#54bdd0" : "#30485b";
      ctx.fillRect(x, y, 36, 25);
      ctx.fillStyle = "rgba(220,232,240,0.16)";
      ctx.fillRect(x, y, 36, 3);
    }
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
  ctx.fillStyle = "#1d3041";
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.78;
  ctx.fillRect(0, 0, 12, 512);
  ctx.fillRect(500, 0, 12, 512);
  ctx.globalAlpha = 1;

  for (let y = 18, row = 0; y < 500; y += 36, row++) {
    ctx.fillStyle = "#30485b";
    ctx.fillRect(22, y + 17, 468, 8);
    for (let x = 36, col = 0; x < 480; x += 72, col++) {
      ctx.fillStyle = (row + col * 2) % 7 < 2 ? CIRCUIT.amber : "#4fb5c8";
      ctx.fillRect(x, y, 54, 13);
      ctx.fillStyle = "rgba(220,232,240,0.18)";
      ctx.fillRect(x, y, 54, 2);
    }
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
  ctx.fillStyle = "#1b2d3d";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#263e50";
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 27, 256);
    ctx.fillStyle = "rgba(220,232,240,0.12)";
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = "#263e50";
  }
  ctx.fillStyle = "#102333";
  ctx.fillRect(24, 92, 66, 72);
  ctx.fillStyle = "#4fb5c8";
  ctx.fillRect(30, 98, 24, 25);
  ctx.fillStyle = CIRCUIT.amber;
  ctx.fillRect(60, 98, 24, 25);
  ctx.fillStyle = "#0e1b29";
  ctx.fillRect(165, 132, 48, 60);
  ctx.fillStyle = CIRCUIT.cyan;
  ctx.fillRect(165, 132, 48, 5);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeGravelTexture() {
  const { el, ctx } = canvas(512, 512);
  ctx.fillStyle = "#35434b";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? "#3d4d56" : "#394850";
    ctx.fillRect(0, y, 512, 32);
    ctx.fillStyle = "rgba(220,232,240,0.08)";
    ctx.fillRect(0, y + 32, 512, 2);
  }
  ctx.fillStyle = "#71818a";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * 56 + ((row % 2) * 18) + 8;
      const y = row * 64 + 44;
      ctx.fillRect(x, y, 8 + (col % 3) * 3, 3);
    }
  }

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
  highwayFace(ctx, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(32, 32, 14, h - 64);
  ctx.fillRect(w - 46, 32, 14, h - 64);

  ctx.textAlign = "center";
  ctx.fillStyle = CIRCUIT.pale;
  fitText(ctx, title, 860, 800, 86, 36);
  ctx.fillText(title, w / 2, 220);

  ctx.fillStyle = CIRCUIT.cyan;
  fitText(ctx, kicker, 860, 650, 28, 16);
  ctx.fillText(kicker, w / 2, 300);

  ctx.fillStyle = "#9aafbd";
  fitText(ctx, footer, 860, 600, 22, 14);
  ctx.fillText(footer, w / 2, 400);
  return toSignTexture(el);
}

export function makeGantrySign(label: string, sub = "HARBOR GP  ·  MIDNIGHT CUP") {
  const w = 1024;
  const h = 288;
  const { el, ctx } = canvas(w, h);
  highwayFace(ctx, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = CIRCUIT.pale;
  fitText(ctx, label, 900, 800, 72, 28);
  ctx.fillText(label, w / 2, 150);
  ctx.fillStyle = CIRCUIT.cyan;
  fitText(ctx, sub, 900, 650, 26, 14);
  ctx.fillText(sub, w / 2, 214);
  return toSignTexture(el);
}

export function makeDistanceBoard(meters: string, sub = "HARBOR GP") {
  const w = 512;
  const h = 384;
  const { el, ctx } = canvas(w, h);
  highwayFace(ctx, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = CIRCUIT.pale;
  fitText(ctx, meters, 420, 800, 148, 48);
  ctx.fillText(meters, w / 2, 210);
  ctx.fillStyle = CIRCUIT.cyan;
  fitText(ctx, sub, 400, 700, 28, 16);
  ctx.fillText(sub, w / 2, 292);
  return toSignTexture(el);
}

export function makeMarshalBoard(mode: "clear" | "hold", sub = "VOLTAGE CIRCUIT") {
  const w = 384;
  const h = 320;
  const { el, ctx } = canvas(w, h);
  const fill = mode === "clear" ? "#173948" : "#49371e";
  highwayFace(ctx, w, h, fill);
  ctx.textAlign = "center";
  ctx.fillStyle = CIRCUIT.pale;
  fitText(ctx, mode === "clear" ? "CLEAR" : "HOLD", 300, 800, 64, 28);
  ctx.fillText(mode === "clear" ? "CLEAR" : "HOLD", w / 2, 168);
  ctx.fillStyle = mode === "clear" ? CIRCUIT.cyan : CIRCUIT.amber;
  fitText(ctx, sub, 300, 650, 22, 14);
  ctx.fillText(sub, w / 2, 226);
  return toSignTexture(el);
}
