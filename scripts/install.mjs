#!/usr/bin/env node
/**
 * install.mjs —— 把构建产物 dist/ 安装到思源工作区的插件目录。
 *
 *   node scripts/install.mjs                    复制安装（自动探测工作区）
 *   node scripts/install.mjs --link             建立符号链接（开发用，改完即生效）
 *   node scripts/install.mjs --workspace DIR    指定工作区
 *   SIYUAN_WORKSPACE=DIR node scripts/install.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "plugin.json"), "utf8"));

const argValue = (name) => {
    const index = process.argv.indexOf(name);
    return index > -1 ? process.argv[index + 1] : undefined;
};

/** 依次尝试：命令行参数 → 环境变量 → 常见工作区位置 */
const detectWorkspace = () => {
    const candidates = [
        argValue("--workspace"),
        process.env.SIYUAN_WORKSPACE,
        path.join(os.homedir(), "SiYuan"),
        path.join(os.homedir(), "Documents", "SiYuan"),
        path.join(os.homedir(), ".config", "siyuan"),
    ].filter(Boolean);
    return candidates.find((candidate) => fs.existsSync(path.join(candidate, "data")));
};

if (!fs.existsSync(path.join(DIST, "index.js"))) {
    console.error("❌ 找不到 dist/index.js，请先执行 `npm run build`。");
    process.exit(1);
}

const workspace = detectWorkspace();
if (!workspace) {
    console.error("❌ 未找到思源工作区，请用 --workspace /path/to/SiYuan 或 SIYUAN_WORKSPACE 指定。");
    process.exit(1);
}

const target = path.join(workspace, "data", "plugins", pkg.name);
fs.mkdirSync(path.dirname(target), {recursive: true});

if (process.argv.includes("--link")) {
    // 符号链接：改完 dist/ 里的文件后，思源重新加载插件即可生效
    fs.rmSync(target, {recursive: true, force: true});
    fs.symlinkSync(DIST, target, "dir");
    console.log(`🔗 已建立符号链接：${target} → ${DIST}`);
} else {
    fs.rmSync(target, {recursive: true, force: true});
    fs.cpSync(DIST, target, {recursive: true});
    console.log(`📦 已安装到：${target}`);
}

console.log(`ℹ️  插件名必须与目录名一致（当前：${pkg.name}），否则思源会静默跳过。`);
console.log("ℹ️  回到思源：设置 → 集市 → 已下载 → 打开插件开关（或重启思源）。");
