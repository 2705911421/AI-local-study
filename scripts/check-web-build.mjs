import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const clientDir = path.resolve("dist/client");
const html = await readFile(path.join(clientDir, "index.html"), "utf8");
const entryPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];

assert(entryPath, "网站入口脚本不存在");

const entry = await readFile(
  path.join(clientDir, entryPath.replace(/^\//, "")),
  "utf8",
);
const dependencyMapSource = entry.match(
  /m\.f\|\|\(m\.f=(\[[^\]]+\])/,
)?.[1];

assert(dependencyMapSource, "无法读取 Vite 动态导入依赖映射");

const dependencyMap = JSON.parse(dependencyMapSource);

function dependenciesFor(modulePrefix) {
  const importIndex = entry.indexOf(`import("./${modulePrefix}-`);
  assert.notEqual(importIndex, -1, `${modulePrefix} 动态入口不存在`);

  const dependencyIndexesSource = entry
    .slice(importIndex, importIndex + 600)
    .match(/__vite__mapDeps\((\[[^\]]+\])\)/)?.[1];

  assert(
    dependencyIndexesSource,
    `${modulePrefix} 动态入口缺少独立的资源依赖`,
  );

  return JSON.parse(dependencyIndexesSource).map(
    (index) => dependencyMap[index],
  );
}

const appDependencies = dependenciesFor("App");
const landingDependencies = dependenciesFor("LandingPage");

assert(
  appDependencies.some((asset) => /^assets\/App-.*\.css$/.test(asset)),
  `工作台没有关联 App.css：${appDependencies.join(", ")}`,
);
assert(
  landingDependencies.some((asset) =>
    /^assets\/LandingPage-.*\.css$/.test(asset),
  ),
  `发布页没有关联 LandingPage.css：${landingDependencies.join(", ")}`,
);

const emittedAssets = new Set(await readdir(path.join(clientDir, "assets")));
for (const asset of [...appDependencies, ...landingDependencies]) {
  const relativeAsset = asset.replace(/^assets\//, "");
  assert(emittedAssets.has(relativeAsset), `构建资源不存在：${asset}`);
}

console.log("网站工作台与发布页的动态样式依赖正确");
