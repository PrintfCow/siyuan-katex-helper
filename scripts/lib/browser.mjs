/**
 * 测试基础设施：定位思源资源、定位浏览器、起静态服务、跑无头浏览器。
 *
 * 环境变量：
 *   SIYUAN_RESOURCES  思源安装目录下的 resources 路径（默认自动探测）
 *   SIYUAN_THEME      主题名，默认 daylight
 *   CHROME_BIN        浏览器可执行文件（默认自动探测 chromium/google-chrome）
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {spawn, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIST = path.join(ROOT, "dist");
export const WORK = path.join(ROOT, ".e2e");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
};

/** 思源安装目录候选（Linux / macOS / Windows） */
const RESOURCE_CANDIDATES = [
    process.env.SIYUAN_RESOURCES,
    "/opt/SiYuan/resources",
    "/usr/lib/siyuan/resources",
    "/Applications/SiYuan.app/Contents/Resources",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "SiYuan", "resources"),
].filter(Boolean);

/**
 * 找到思源的 resources 目录。
 * 浏览器测试依赖思源真实的 base.css 与主题变量，找不到就应当明确跳过而不是假装通过。
 */
export const findSiyuanResources = () => {
    for (const candidate of RESOURCE_CANDIDATES) {
        const appDir = path.join(candidate, "stage", "build", "app");
        if (!fs.existsSync(appDir)) {
            continue;
        }
        const baseCss = fs.readdirSync(appDir).find((f) => f.startsWith("base.") && f.endsWith(".css"));
        if (baseCss) {
            return {resources: candidate, baseCss: path.join(appDir, baseCss)};
        }
    }
    return null;
};

/** 主题样式表（--b3-menu-background 等变量只在这里定义） */
export const themeCssPath = (resources) => {
    const theme = process.env.SIYUAN_THEME || "daylight";
    const file = path.join(resources, "appearance", "themes", theme, "theme.css");
    return fs.existsSync(file) ? file : null;
};

/** 找不到思源资源时打印提示并结束（退出码 0，表示跳过而不是失败） */
export const skipWithoutSiyuan = (suite) => {
    console.warn(`⚠️  跳过 ${suite}：未找到思源安装目录。`);
    console.warn("    这类测试需要思源真实的 base.css 与主题样式，");
    console.warn("    Linux 默认找 /opt/SiYuan/resources，也可用 SIYUAN_RESOURCES=/path/to/resources 指定。");
    process.exit(0);
};

/** 定位无头浏览器 */
export const findBrowser = () => {
    const candidates = [
        process.env.CHROME_BIN,
        "chromium",
        "chromium-browser",
        "google-chrome",
        "google-chrome-stable",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].filter(Boolean);
    for (const candidate of candidates) {
        if (candidate.includes(path.sep)) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
            continue;
        }
        const found = spawnSync("which", [candidate], {encoding: "utf8"});
        if (found.status === 0) {
            return found.stdout.trim();
        }
    }
    console.error("❌ 未找到 Chromium/Chrome，可用 CHROME_BIN 指定可执行文件。");
    process.exit(1);
};

/**
 * 启动静态服务。
 * @param pageFile  访问 / 时返回的页面
 * @param siyuan    思源资源信息（可为 null）
 */
export const startServer = async (pageFile, siyuan) => {
    const theme = siyuan ? themeCssPath(siyuan.resources) : null;

    const resolveRequest = (urlPath) => {
        const clean = decodeURIComponent(urlPath.split("?")[0]);
        if (clean === "/") {
            return pageFile;
        }
        if (siyuan) {
            if (clean === "/base.css") {
                return siyuan.baseCss;
            }
            if (clean === "/theme.css" && theme) {
                return theme;
            }
            if (clean.startsWith("/stage/")) {
                // /stage/xxx → <resources>/stage/xxx
                return path.join(siyuan.resources, "stage", clean.slice("/stage/".length));
            }
        }
        // 插件产物统一从 dist/ 提供，其余（tests/ 等）从仓库根目录提供
        const inDist = path.join(DIST, clean.replace(/^\/+/, ""));
        if (fs.existsSync(inDist) && fs.statSync(inDist).isFile()) {
            return inDist;
        }
        return path.join(ROOT, clean.replace(/^\/+/, ""));
    };

    const server = http.createServer((req, res) => {
        const file = resolveRequest(req.url || "/");
        if (!file.startsWith(ROOT) && !(siyuan && file.startsWith(siyuan.resources))) {
            res.writeHead(403).end("forbidden");
            return;
        }
        fs.readFile(file, (error, data) => {
            if (error) {
                res.writeHead(404).end("not found: " + req.url);
                return;
            }
            res.writeHead(200, {"content-type": MIME[path.extname(file)] || "application/octet-stream"});
            res.end(data);
        });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return {server, url: `http://127.0.0.1:${server.address().port}/`};
};

/** 跑一次无头浏览器，返回 stdout（--dump-dom 时即页面 HTML） */
export const runBrowser = (browser, url, extraArgs = [], timeoutMs = 120000) => new Promise((resolve) => {
    const profile = path.join(WORK, "chrome-profile");
    fs.rmSync(profile, {recursive: true, force: true});
    fs.mkdirSync(profile, {recursive: true});
    fs.mkdirSync(path.join(WORK, "chrome-home"), {recursive: true});

    const child = spawn(browser, [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1024,916",
        `--user-data-dir=${profile}`,
        "--virtual-time-budget=30000",
        ...extraArgs,
        url,
    ], {
        env: {...process.env, HOME: path.join(WORK, "chrome-home")},
        stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("close", () => {
        clearTimeout(timer);
        resolve(stdout);
    });
});

/** 从 --dump-dom 的输出里取出 <pre id="results"> 文本 */
export const extractReport = (dom) => {
    const match = dom.match(/<pre id="results">([\s\S]*?)<\/pre>/);
    if (!match) {
        return null;
    }
    return match[1]
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
};
