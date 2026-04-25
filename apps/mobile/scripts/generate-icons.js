#!/usr/bin/env node
/**
 * Generates TruthStay brand icon PNGs for Expo / Android adaptive icon.
 *
 * Brand logo: pill-bar T — blue vertical stem + teal horizontal crossbar.
 *
 * Outputs to apps/mobile/assets/:
 *   icon.png                     1024×1024  Navy bg + brand T
 *   splash-icon.png              1024×1024  Transparent bg + brand T
 *   android-icon-foreground.png  1024×1024  Brand T on transparent (adaptive fg)
 *   android-icon-background.png  1024×1024  Solid navy fill (adaptive bg)
 *   android-icon-monochrome.png  1024×1024  White T on transparent (themed icons)
 *
 * Requires: sharp (available at repo root node_modules/sharp)
 * Run: node apps/mobile/scripts/generate-icons.js
 */

const path = require("path");
const sharp = require(path.resolve(__dirname, "../../../node_modules/sharp"));

const ASSETS = path.resolve(__dirname, "../assets");

const NAVY       = "#0F2A4A";
const BLUE       = "#0A7AFF";
const TEAL       = "#2ECDA7";
const INTERSECT  = "#5BC8D6";

// ── Brand logo SVG ────────────────────────────────────────────────────────────
// Generates the pill-bar T shape matching BrandLogo.tsx proportions.
// logoH: height of the T mark in px; cx/cy: canvas centre.

function brandLogoGroup(logoH, cx, cy) {
  const logoW     = Math.round(logoH * (56 / 72));
  const barTop    = Math.round(logoH * 0.25);
  const barH      = Math.round(logoH * 0.19);
  const stemW     = Math.round(logoW * 0.29);
  const stemLeft  = Math.round(logoW * 0.36);

  const x0 = cx - Math.round(logoW / 2);
  const y0 = cy - Math.round(logoH / 2);

  const barY    = y0 + barTop;
  const stemX   = x0 + stemLeft;
  const stemY   = y0;

  return `
  <!-- crossbar -->
  <rect x="${x0}" y="${barY}" width="${logoW}" height="${barH}" rx="${Math.round(barH / 2)}" fill="${TEAL}"/>
  <!-- stem -->
  <rect x="${stemX}" y="${stemY}" width="${stemW}" height="${logoH}" rx="${Math.round(stemW / 2)}" fill="${BLUE}"/>
  <!-- intersection blend -->
  <rect x="${stemX}" y="${barY}" width="${stemW}" height="${barH}" fill="${INTERSECT}" opacity="0.65"/>`;
}

function iconSvg(size, bgColor, logoH) {
  const bg = bgColor
    ? `<rect width="${size}" height="${size}" fill="${bgColor}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${bg}${brandLogoGroup(logoH, size / 2, size / 2)}
</svg>`;
}

function monoSvg(size, logoH) {
  const logoW     = Math.round(logoH * (56 / 72));
  const barTop    = Math.round(logoH * 0.25);
  const barH      = Math.round(logoH * 0.19);
  const stemW     = Math.round(logoW * 0.29);
  const stemLeft  = Math.round(logoW * 0.36);
  const cx = size / 2;
  const cy = size / 2;
  const x0 = cx - Math.round(logoW / 2);
  const y0 = cy - Math.round(logoH / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect x="${x0}" y="${y0 + barTop}" width="${logoW}" height="${barH}" rx="${Math.round(barH / 2)}" fill="white"/>
  <rect x="${x0 + stemLeft}" y="${y0}" width="${stemW}" height="${logoH}" rx="${Math.round(stemW / 2)}" fill="white"/>
</svg>`;
}

// ── Generation ────────────────────────────────────────────────────────────────

async function generate() {
  const tasks = [
    {
      name: "icon.png",
      svg: iconSvg(1024, NAVY, 520),
      size: 1024,
    },
    {
      name: "splash-icon.png",
      svg: iconSvg(1024, null, 420),
      size: 1024,
      transparent: true,
    },
    {
      name: "android-icon-foreground.png",
      svg: iconSvg(1024, null, 480),
      size: 1024,
      transparent: true,
    },
    {
      name: "android-icon-background.png",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${NAVY}"/></svg>`,
      size: 1024,
    },
    {
      name: "android-icon-monochrome.png",
      svg: monoSvg(1024, 480),
      size: 1024,
      transparent: true,
    },
  ];

  for (const task of tasks) {
    const outPath = path.join(ASSETS, task.name);
    const svgBuffer = Buffer.from(task.svg);

    let pipeline = sharp(svgBuffer);
    if (!task.transparent) {
      pipeline = pipeline.flatten({ background: { r: 15, g: 42, b: 74 } });
    }

    await pipeline.resize(task.size, task.size).png().toFile(outPath);
    console.log(`✓  ${task.name}  (${task.size}×${task.size})`);
  }

  console.log("\nAll icons written to apps/mobile/assets/");
  console.log("Rebuild the dev client or run 'npx expo prebuild' to apply.");
}

generate().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
