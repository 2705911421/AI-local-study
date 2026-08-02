import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import pngToIco from "png-to-ico";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = path.join(projectRoot, "brand", "logo-mark.svg");
const publicBrand = path.join(projectRoot, "public", "brand");
const buildDirectory = path.join(projectRoot, "build");
const previewDirectory = path.join(projectRoot, "output", "brand");

await Promise.all([
  mkdir(publicBrand, { recursive: true }),
  mkdir(buildDirectory, { recursive: true }),
  mkdir(previewDirectory, { recursive: true }),
]);

await Promise.all([
  copyFile(source, path.join(publicBrand, "logo-mark.svg")),
  copyFile(source, path.join(buildDirectory, "icon.svg")),
]);

const svg = await readFile(source);
const image = await loadImage(svg);
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((size) => renderPng(image, size));
const icon512 = renderPng(image, 512);

await Promise.all([
  writeFile(path.join(buildDirectory, "icon.png"), icon512),
  writeFile(path.join(buildDirectory, "icon.ico"), await pngToIco(pngs)),
  writeFile(path.join(previewDirectory, "zhiye-logo-preview.png"), icon512),
]);

process.stdout.write(
  "Brand assets generated in build/, public/brand/, and output/brand/.\n",
);

function renderPng(image, size) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  return canvas.toBuffer("image/png");
}
