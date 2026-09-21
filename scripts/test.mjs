#!/usr/bin/env node
/**
 * test.mjs —— 纯逻辑自测（命令库检索 + 片段解析），不依赖浏览器环境。
 *
 *   node scripts/test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import esbuild from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".tmp-test");

fs.rmSync(OUT, {recursive: true, force: true});
await esbuild.build({
    entryPoints: [path.join(ROOT, "src/latex-db.ts"), path.join(ROOT, "src/snippet.ts")],
    outdir: OUT,
    outExtension: {".js": ".mjs"},
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: ["es2020"],
    logLevel: "warning",
});

const {getDatabase, searchItems} = await import(path.join(OUT, "latex-db.mjs"));
const {parseSnippet} = await import(path.join(OUT, "snippet.mjs"));

let passed = 0;
const check = (name, fn) => {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (error) {
        console.error(`  ✗ ${name}\n    ${error.message}`);
        process.exitCode = 1;
    }
};

const db = getDatabase();
const find = (name) => db.find((item) => item.name.toLowerCase() === name.toLowerCase());
const top = (query) => searchItems(query, true, 5)[0]?.item.name;

console.log("命令库：");
check("命令库规模足够大", () => assert.ok(db.length > 900, `实际 ${db.length}`));
check("包含 frac", () => assert.ok(find("frac")));
check("包含 alpha 且有字符预览", () => assert.equal(find("alpha").preview, "\\alpha"));
check("包含 pmatrix 环境", () => assert.ok(find("pmatrix").insert.startsWith("\\begin{pmatrix}")));
check("frac 使用精选片段", () => assert.equal(find("frac").insert, "\\frac{$1}{$2}"));
check("sqrt 使用精选片段", () => assert.equal(find("sqrt").insert, "\\sqrt{$1}"));
check("自动生成的函数带花括号", () => assert.equal(find("overline").insert, "\\overline{$1}"));
check("自动生成的可选参数用方括号", () => {
    // \sqrt 已被精选覆盖，这里用一个未精选、带可选参数的函数验证
    const item = db.find((entry) => entry.kind === "function" && entry.insert.includes("["));
    assert.ok(item, "应存在带可选参数的自动生成项");
});
check("不包含伪造/损坏的命令名", () => {
    for (const bad of ["atopfraq", "abovefraq", "bracefraq", "brackfraq"]) {
        assert.equal(find(bad), undefined, `不应存在 ${bad}`);
    }
});

console.log("检索：");
check("精确匹配排第一", () => assert.equal(top("frac"), "frac"));
check("前缀匹配", () => assert.equal(top("alph"), "alpha"));
check("子串匹配", () => assert.ok(searchItems("arrow", true, 20).some((r) => r.item.name === "rightarrow")));
check("模糊匹配", () => assert.ok(searchItems("sqr", true, 20).some((r) => r.item.name === "sqrt")));
check("关闭模糊后不返回无序匹配", () => assert.equal(searchItems("zzqq", false, 5).length, 0));
check("无匹配时返回空", () => assert.equal(searchItems("zzzqqqxxx", true, 5).length, 0));
check("可以按环境名检索（中文输入场景）", () => assert.equal(top("cases"), "cases"));
check("高亮区间正确", () => {
    const [first] = searchItems("alp", true, 1);
    assert.deepEqual(first.highlight, [0, 3]);
});

console.log("片段解析：");
check("frac", () => {
    const {text, stops} = parseSnippet("\\frac{$1}{$2}");
    assert.equal(text, "\\frac{}{}");
    assert.deepEqual(stops, [6, 8]);
});
check("sqrt 可选参数", () => {
    const {text, stops} = parseSnippet("\\sqrt[$1]{$2}");
    assert.equal(text, "\\sqrt[]{}");
    assert.deepEqual(stops, [6, 8]);
});
check("无制表位", () => {
    const {text, stops} = parseSnippet("\\alpha");
    assert.equal(text, "\\alpha");
    assert.deepEqual(stops, []);
});
check("制表位按编号排序", () => {
    // 文本为 "$x$"：$2 在 0，$1 在 2，跳转顺序应为 $1 → $2
    const {text, stops} = parseSnippet("$2$x$1$");
    assert.equal(text, "$x$");
    assert.deepEqual(stops, [2, 0]);
});
check("$0 排在最后", () => {
    // 文本为 "a{}b"：$1 在 2，$0 在 4
    const {text, stops} = parseSnippet("a{$1}b$0");
    assert.equal(text, "a{}b");
    assert.deepEqual(stops, [2, 4]);
});
check("矩阵环境四个制表位", () => {
    const {text, stops} = parseSnippet(find("pmatrix").insert);
    assert.equal(text, "\\begin{pmatrix} &  \\\\  & \\end{pmatrix}");
    assert.equal(stops.length, 4);
    assert.deepEqual([...stops].sort((a, b) => a - b), stops, "偏移量应递增");
});
check("反斜杠转义 $", () => {
    const {text, stops} = parseSnippet("\\$100");
    assert.equal(text, "$100");
    assert.deepEqual(stops, []);
});

fs.rmSync(OUT, {recursive: true, force: true});
console.log(`\n${process.exitCode ? "❌" : "✅"} ${passed} 项检查通过${process.exitCode ? "（存在失败项）" : ""}`);
