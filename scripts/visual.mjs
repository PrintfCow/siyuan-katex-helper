#!/usr/bin/env node
/**
 * visual.mjs —— 补全弹窗的布局回归测试。
 *
 * 加载思源真实的 base.css 与主题 theme.css，在四种编辑框位置下断言：
 *   - 弹窗与编辑框矩形零重叠、完全落在视口内；
 *   - 弹窗底色不透明、内容被裁剪、行宽不超盒；
 *   - 用 document.elementFromPoint 在盒子四周探测，
 *     确认盒子外没有任何列表内容被绘制（与真实绘制共用同一套裁剪规则）。
 *
 *   node scripts/visual.mjs
 *
 * 需要本机安装思源（用于取真实的 base.css 与主题变量）；找不到会明确跳过。
 */
import fs from "node:fs";
import path from "node:path";
import {
    ROOT, WORK, extractReport, findBrowser, findSiyuanResources, runBrowser, skipWithoutSiyuan, startServer,
} from "./lib/browser.mjs";

const resources = findSiyuanResources();
if (!resources) {
    skipWithoutSiyuan("布局回归测试");
}
if (!fs.existsSync(path.join(ROOT, "dist", "index.js"))) {
    console.error("❌ 找不到 dist/index.js，请先执行 `npm run build`。");
    process.exit(1);
}

const browser = findBrowser();
const {server, url} = await startServer(path.join(ROOT, "tests", "visual.html"), resources);

const dom = await runBrowser(browser, url, ["--dump-dom"]);
const report = extractReport(dom);
if (report === null) {
    console.error("❌ 未能取到布局测量结果。页面输出片段：\n");
    console.error(dom.slice(0, 2000));
    server.close();
    process.exit(1);
}
console.log(report);

const failed = /FAILED (\d+)/.exec(report);
if (!failed || Number(failed[1]) > 0) {
    console.error("❌ 布局检查未通过");
    server.close();
    process.exit(1);
}

// 顺便留一张截图，方便人工复核
fs.mkdirSync(WORK, {recursive: true});
const shot = path.join(WORK, "visual.png");
fs.rmSync(shot, {force: true});
await runBrowser(browser, url + "?shot=1", [`--screenshot=${shot}`]);
server.close();
fs.rmSync(path.join(WORK, "chrome-profile"), {recursive: true, force: true});
console.log(`\n🖼  截图：${shot}`);
console.log("✅ 布局检查全部通过");
