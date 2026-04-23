#!/usr/bin/env node
/**
 * Generates TruthStay brand icon PNGs for Expo / Android adaptive icon.
 *
 * Outputs to apps/mobile/assets/:
 *   icon.png                    1024×1024  Coral rounded rect + white T
 *   splash-icon.png             1024×1024  Same (shown centered on cream splash bg)
 *   android-icon-foreground.png  512×512   White T on transparent bg (adaptive fg)
 *   android-icon-background.png  512×512   Solid coral fill (adaptive bg)
 *   android-icon-monochrome.png  512×512   White T on black (dark-mode monochrome)
 *
 * Requires: sharp (available at repo root node_modules/sharp)
 * Run: node apps/mobile/scripts/generate-icons.js
 */

const path = require("path");
const sharp = require(path.resolve(__dirname, "../../../node_modules/sharp"));

const ASSETS = path.resolve(__dirname, "../assets");

const CORAL = "#E8694A";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TRANSPARENT = "none";

// ── SVG helpers ──────────────────────────────────────────────────────────────

function makeTileSvg(size, bgColor, letterColor) {
  const r = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.52);
  const cx = size / 2;
  const cy = size / 2;
  // Slight vertical nudge for optical centering of serif T
  const textY = Math.round(cy + fontSize * 0.36);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${bgColor}"/>
  <text
    x="${cx}"
    y="${textY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fontSize}"
    font-weight="400"
    fill="${letterColor}"
    text-anchor="middle"
    dominant-baseline="auto"
  >T</text>
</svg>`;
}

function makeForegroundSvg(size, letterColor) {
  // T on transparent background — sized to fill ~72% of the safe zone
  const fontSize = Math.round(size * 0.52);
  const cx = size / 2;
  const cy = size / 2;
  const textY = Math.round(cy + fontSize * 0.36);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <text
    x="${cx}"
    y="${textY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fontSize}"
    font-weight="400"
    fill="${letterColor}"
    text-anchor="middle"
    dominant-baseline="auto"
  >T</text>
</svg>`;
}

function makeSolidSvg(size, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${color}"/>
</svg>`;
}

// ── Generation ───────────────────────────────────────────────────────────────

async function generate() {
  const tasks = [
    {
      name: "icon.png",
      svg: makeTileSvg(1024, CORAL, WHITE),
      size: 1024,
    },
    {
      name: "splash-icon.png",
      svg: makeTileSvg(1024, CORAL, WHITE),
      size: 1024,
    },
    {
      name: "android-icon-foreground.png",
      svg: makeForegroundSvg(512, WHITE),
      size: 512,
      background: TRANSPARENT,
    },
    {
      name: "android-icon-background.png",
      svg: makeSolidSvg(512, CORAL),
      size: 512,
    },
    {
      name: "android-icon-monochrome.png",
      svg: makeForegroundSvg(512, WHITE),
      size: 512,
      background: BLACK,
    },
  ];

  for (const task of tasks) {
    const outPath = path.join(ASSETS, task.name);
    const svgBuffer = Buffer.from(task.svg);

    let pipeline = sharp(svgBuffer);

    if (task.background === TRANSPARENT) {
      // Keep transparency — no flatten
    } else if (task.background === BLACK) {
      pipeline = pipeline.flatten({ background: { r: 0, g: 0, b: 0 } });
    }

    await pipeline
      .resize(task.size, task.size)
      .png()
      .toFile(outPath);

    console.log(`✓  ${task.name}  (${task.size}×${task.size})`);
  }

  console.log("\nAll icons written to apps/mobile/assets/");
  console.log("Run 'npx expo prebuild' to regenerate Android mipmap WebP files.");
}

generate().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});