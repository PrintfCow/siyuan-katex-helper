#!/usr/bin/env node
/**
 * package.mjs —— 把 dist/ 打成可直接安装 / 上传到集市与 GitHub Release 的 package.zip。
 *
 *   node scripts/package.mjs
 *
 * 产物：仓库根目录的 package.zip（内容是插件目录本身，解压后即为
 * `siyuan-katex-helper/`，可直接放进 <工作区>/data/plugins/）。
 */
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "plugin.json"), "utf8"));
const ZIP = path.join(ROOT, "package.zip");

/** 插件包里必须存在的文件，缺一个思源就不会正常加载 */
const REQUIRED = ["plugin.json", "index.js"];

if (!fs.existsSync(DIST)) {
    console.error("❌ 找不到 dist/，请先执行 `npm run build`。");
    process.exit(1);
}
for (const file of REQUIRED) {
    if (!fs.existsSync(path.join(DIST, file))) {
        console.error(`❌ dist/${file} 不存在，请先执行 \`npm run build\`。`);
        process.exit(1);
    }
}

fs.rmSync(ZIP, {force: true});

try {
    execFileSync("zip", ["-r", "-q", "-X", ZIP, "."], {cwd: DIST});
} catch (error) {
    console.error("❌ 打包失败，请确认系统已安装 zip 命令。", error.message);
    process.exit(1);
}

const bytes = fs.statSync(ZIP).size;
const entries = execFileSync("unzip", ["-Z1", ZIP], {encoding: "utf8"}).trim().split("\n");
console.log(`✅ 已生成 package.zip（${(bytes / 1024).toFixed(1)} KB，${entries.length} 个文件）`);
console.log(`   插件名：${pkg.name}  版本：${pkg.version}`);
console.log("   安装：解压后把 siyuan-katex-helper 目录放进 <工作区>/data/plugins/，或直接用 npm run make-install");
