#!/usr/bin/env node
/**
 * e2e.mjs —— 无头浏览器端到端测试。
 *
 * 用**真实构建产物** dist/index.js，按思源完全相同的加载方式
 * （window.eval 包裹的 CommonJS），在一个复刻了思源 DOM 与样式的页面里
 * 跑完整交互，覆盖方向键修复与代码补全。
 *
 *   node scripts/e2e.mjs
 *
 * 需要本机安装思源（用于取真实的 base.css）；找不到会明确跳过。
 */
import path from "node:path";
import {
    ROOT, WORK, extractReport, findBrowser, findSiyuanResources, runBrowser, skipWithoutSiyuan, startServer,
} from "./lib/browser.mjs";
import fs from "node:fs";

const resources = findSiyuanResources();
if (!resources) {
    skipWithoutSiyuan("端到端测试");
}
if (!fs.existsSync(path.join(ROOT, "dist", "index.js"))) {
    console.error("❌ 找不到 dist/index.js，请先执行 `npm run build`。");
    process.exit(1);
}

const browser = findBrowser();
const {server, url} = await startServer(path.join(ROOT, "tests", "harness.html"), resources);

const dom = await runBrowser(browser, url, ["--dump-dom"]);
server.close();

const report = extractReport(dom);
if (report === null) {
    console.error("❌ 未能从页面取到测试结果。页面输出片段：\n");
    console.error(dom.slice(0, 2000));
    process.exit(1);
}

console.log(report);
const failed = /FAILED (\d+)/.exec(report);
if (!failed || Number(failed[1]) > 0) {
    console.error("❌ 端到端测试失败");
    process.exit(1);
}
fs.rmSync(path.join(WORK, "chrome-profile"), {recursive: true, force: true});
console.log("✅ 端到端测试全部通过");
