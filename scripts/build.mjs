#!/usr/bin/env node
/**
 * build.mjs —— 构建插件。
 *
 * 产物落在 `dist/`，并且 `dist/` 就是一个**完整、可直接安装**的思源插件目录：
 *   dist/
 *   ├── plugin.json       （从仓库根目录复制）
 *   ├── index.js          （由 src/index.ts 打包）
 *   ├── index.css         （从仓库根目录复制）
 *   ├── icon.png / preview.png
 *   ├── i18n/
 *   └── README.md / README_zh_CN.md
 *
 * 用法：
 *   node scripts/build.mjs            一次性构建
 *   node scripts/build.mjs --watch    监听 src/ 变化并重建
 */
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/** 需要原样进入插件包的静态资源 */
const STATIC_ENTRIES = [
    "plugin.json",
    "index.css",
    "icon.png",
    "preview.png",
    "README.md",
    "README_zh_CN.md",
    "i18n",
];

/** 把静态资源复制到 dist/ */
const copyStatic = () => {
    fs.mkdirSync(DIST, {recursive: true});
    for (const entry of STATIC_ENTRIES) {
        const from = path.join(ROOT, entry);
        if (!fs.existsSync(from)) {
            console.warn(`⚠️  缺少 ${entry}，已跳过`);
            continue;
        }
        fs.cpSync(from, path.join(DIST, entry), {recursive: true});
    }
};

/** @type {import("esbuild").BuildOptions} */
const options = {
    entryPoints: [path.join(ROOT, "src/index.ts")],
    outfile: path.join(DIST, "index.js"),
    bundle: true,
    // 思源通过 window.eval("(function anonymous(require,module,exports){...})") 加载插件，
    // 因此必须输出 CommonJS，并把 siyuan 留给运行时提供。
    format: "cjs",
    platform: "browser",
    target: ["es2020"],
    external: ["siyuan"],
    sourcemap: false,
    minify: false,
    legalComments: "none",
    charset: "utf8",
    logLevel: "warning",
};

const report = (result) => {
    const out = Object.keys(result.metafile.outputs).find((file) => file.endsWith("index.js"));
    const size = result.metafile.outputs[out].bytes;
    console.log(`✅ 构建完成：dist/index.js（${(size / 1024).toFixed(1)} KB）`);
};

if (process.argv.includes("--watch")) {
    copyStatic();
    const context = await esbuild.context(options);
    await context.watch();
    console.log("👀 正在监听 src/ 变化…（静态资源改动请重新执行 build）");
} else {
    const result = await esbuild.build({...options, metafile: true});
    copyStatic();
    report(result);
}
