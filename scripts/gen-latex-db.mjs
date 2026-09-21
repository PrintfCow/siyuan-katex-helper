#!/usr/bin/env node
/**
 * gen-latex-db.mjs — 从 KaTeX 源码生成 LaTeX 命令数据库。
 *
 * 数据来源（按优先级自动探测）：
 *   1. node_modules/katex/src
 *   2. .research/npm/package/src   (npm pack katex 解包目录)
 *   3. KaTeX_SRC 环境变量指定的目录
 *
 * 输出：src/latex-db.generated.ts
 *
 * 用法：node scripts/gen-latex-db.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function findKatexSrc() {
    const candidates = [
        process.env.KATEX_SRC,
        path.join(ROOT, "node_modules/katex/src"),
        path.join(ROOT, ".research/npm/package/src"),
    ].filter(Boolean);
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, "symbols.ts"))) return c;
    }
    throw new Error(
        "找不到 KaTeX 源码目录。请先执行 `npm i -D katex` 或 `npm pack katex && tar xzf katex-*.tgz -C .research/npm`，" +
        "也可以用 KATEX_SRC=/path/to/katex/src 指定。");
}

const SRC = findKatexSrc();
const read = (p) => fs.readFileSync(path.join(SRC, p), "utf8");

/** 提取字符串字面量并解码（JSON 兼容 \u 转义）。 */
function literals(text) {
    const out = [];
    const re = /"(?:[^"\\]|\\.)*"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        try {
            out.push(JSON.parse(m[0]));
        } catch {
            /* 忽略无法解析的字面量 */
        }
    }
    return out;
}

/** 从 `defineXxx({` 开始做括号配对，取出所有调用块的参数文本。 */
function callBlocks(text, callee) {
    const blocks = [];
    const re = new RegExp(callee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
    let m;
    while ((m = re.exec(text)) !== null) {
        let i = m.index + m[0].length - 1; // 指向 '('
        let depth = 0;
        let inStr = false;
        let inTpl = false;
        let quote = "";
        for (; i < text.length; i++) {
            const ch = text[i];
            if (inStr) {
                if (ch === "\\") i++;
                else if (ch === quote) inStr = false;
                continue;
            }
            if (inTpl) {
                if (ch === "\\") i++;
                else if (ch === "`") inTpl = false;
                continue;
            }
            if (ch === '"' || ch === "'") {
                inStr = true;
                quote = ch;
                continue;
            }
            if (ch === "`") {
                inTpl = true;
                continue;
            }
            if (ch === "(") depth++;
            else if (ch === ")") {
                depth--;
                if (depth === 0) break;
            }
        }
        blocks.push(text.slice(m.index + m[0].length, i));
    }
    return blocks;
}

/** 从函数调用参数里取出第 index 个顶层实参（简单实现，够用）。 */
function splitArgs(argText) {
    const args = [];
    let depth = 0;
    let cur = "";
    let inStr = false;
    let quote = "";
    for (let i = 0; i < argText.length; i++) {
        const ch = argText[i];
        if (inStr) {
            cur += ch;
            if (ch === "\\") {
                cur += argText[++i] ?? "";
            } else if (ch === quote) inStr = false;
            continue;
        }
        if (ch === '"' || ch === "'") {
            inStr = true;
            quote = ch;
            cur += ch;
            continue;
        }
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        if (ch === ")" || ch === "]" || ch === "}") depth--;
        if (ch === "," && depth === 0) {
            args.push(cur.trim());
            cur = "";
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());
    return args;
}

const dec = (lit) => {
    try {
        return JSON.parse(lit);
    } catch {
        return null;
    }
};

/* ---------------------------------------------------------------- symbols */
const symbols = new Map(); // name(无反斜杠) -> 显示字符
{
    const text = read("symbols.ts");
    // defineSymbol(math, main, rel, "\u2261", "\\equiv", true);
    const re = /defineSymbol\s*\(([\s\S]*?)\)\s*;/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const args = splitArgs(m[1]);
        if (args.length < 5) continue;
        const name = dec(args[4]);
        const char = dec(args[3]);
        if (typeof name !== "string" || !name.startsWith("\\")) continue;
        const key = name.slice(1);
        if (!key || symbols.has(key)) continue;
        symbols.set(key, typeof char === "string" ? char : "");
    }
}

/* -------------------------------------------------------------- functions */
const funcs = new Map(); // name -> {args, opt}
{
    const dir = path.join(SRC, "functions");
    const files = fs.existsSync(path.join(SRC, "functions.ts"))
        ? ["functions.ts", ...fs.readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => `functions/${f}`)]
        : [];
    for (const f of files) {
        const text = read(f);
        for (const block of callBlocks(text, "defineFunction")) {
            const namesMatch = block.match(/names\s*:\s*\[([\s\S]*?)\]/);
            if (!namesMatch) continue;
            const numArgs = Number((block.match(/numArgs\s*:\s*(\d+)/) || [])[1] ?? 0);
            const numOpt = Number((block.match(/numOptionalArgs\s*:\s*(\d+)/) || [])[1] ?? 0);
            for (const raw of literals(namesMatch[1])) {
                if (!raw.startsWith("\\")) continue;
                const key = raw.slice(1);
                if (!key || funcs.has(key)) continue;
                funcs.set(key, {args: numArgs, opt: numOpt});
            }
        }
    }
}

/* ----------------------------------------------------------- environments */
const envs = new Set();
{
    const dir = path.join(SRC, "environments");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".ts")) : [];
    for (const f of files) {
        const text = read(`environments/${f}`);
        for (const block of callBlocks(text, "defineEnvironment")) {
            const namesMatch = block.match(/names\s*:\s*\[([\s\S]*?)\]/);
            if (!namesMatch) continue;
            for (const raw of literals(namesMatch[1])) {
                // 环境名可能带 * ，统一保留
                if (raw && /^[\w*@-]+$/.test(raw)) envs.add(raw);
            }
        }
    }
}

/* ---------------------------------------------------------------- macros */
const macros = new Set();
{
    const text = read("macros.ts");
    const re = /defineMacro\s*\(\s*("(?:[^"\\]|\\.)*")/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = dec(m[1]);
        if (typeof name !== "string" || !name.startsWith("\\")) continue;
        const key = name.slice(1);
        // 过滤内部宏（以 @ 或 . 开头）
        if (!key || key.startsWith("@") || key.startsWith(".")) continue;
        macros.add(key);
    }
}

/* ------------------------------------------------------------------ 输出 */
const symArr = [...symbols.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const fnArr = [...funcs.entries()]
    .map(([name, value]) => [name, value.args, value.opt])
    .sort((a, b) => a[0].localeCompare(b[0]));
const envArr = [...envs].sort();
const macArr = [...macros].sort();

const gen = `// ⚠️ 本文件由 scripts/gen-latex-db.mjs 自动生成，请勿手工修改。
//    数据来源：KaTeX ${(() => {
    try {
        return JSON.parse(fs.readFileSync(path.join(SRC, "..", "package.json"), "utf8")).version;
    } catch {
        return "unknown";
    }
})()} (${SRC})
//    重新生成：node scripts/gen-latex-db.mjs

/** 无参数符号命令：[名称(不含反斜杠), 显示字符] */
export const KATEX_SYMBOLS: [string, string][] = ${JSON.stringify(symArr)};

/** 带参数的函数命令：[名称(不含反斜杠), 必选参数个数, 可选参数个数] */
export const KATEX_FUNCTIONS: [string, number, number][] = ${JSON.stringify(fnArr)};

/** 环境名（用于 \\\\begin{} / \\\\end{}） */
export const KATEX_ENVIRONMENTS: string[] = ${JSON.stringify(envArr)};

/** KaTeX 内置宏命令（名称不含反斜杠） */
export const KATEX_MACROS: string[] = ${JSON.stringify(macArr)};
`;

const outFile = path.join(ROOT, "src/latex-db.generated.ts");
fs.mkdirSync(path.dirname(outFile), {recursive: true});
fs.writeFileSync(outFile, gen);
console.log(
    `✅ 已生成 ${path.relative(ROOT, outFile)}\n` +
    `   符号 ${symArr.length} 个 / 函数 ${fnArr.length} 个 / 环境 ${envArr.length} 个 / 宏 ${macArr.length} 个`
);
