#!/usr/bin/env node
/**
 * gen-icon.mjs —— 不依赖任何图形库，直接生成插件图标 icon.png / preview.png。
 *
 * 图案：圆角渐变底 + 白色根号（√），表示数学公式。
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ----------------------------------------------------------- 最小 PNG 编码器 */
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c;
    }
    return table;
})();

const crc32 = (buffer) => {
    let c = -1;
    for (const byte of buffer) {
        c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    }
    return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
    return Buffer.concat([length, typeBuffer, data, crc]);
};

const encodePng = (width, height, rgba) => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;  // bit depth
    header[9] = 6;  // RGBA
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (width * 4 + 1)] = 0; // filter: none
        rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", zlib.deflateSync(raw, {level: 9})),
        chunk("IEND", Buffer.alloc(0)),
    ]);
};

/* ------------------------------------------------------------------ 绘图 */
const SIZE = 160;
const SS = 4; // 4x4 超采样抗锯齿

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 圆角矩形：内部返回 true（u、v 为 0~1 归一化坐标） */
const inRoundedRect = (u, v, radius) => {
    const dx = Math.abs(u - 0.5) - (0.5 - radius);
    const dy = Math.abs(v - 0.5) - (0.5 - radius);
    const x = Math.max(dx, 0);
    const y = Math.max(dy, 0);
    return Math.hypot(x, y) <= radius;
};

/** 点到线段的距离 */
const distToSegment = (px, py, ax, ay, bx, by) => {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : clamp01((wx * vx + wy * vy) / len2);
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};

/** 根号折线 */
const RADICAL = [
    [0.20, 0.54, 0.31, 0.78],
    [0.31, 0.78, 0.53, 0.24],
    [0.53, 0.24, 0.86, 0.24],
];
const STROKE = 0.068;

const render = () => {
    const rgba = Buffer.alloc(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            let bgHits = 0;
            let fgHits = 0;
            let gradientSum = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const u = (x + (sx + 0.5) / SS) / SIZE;
                    const v = (y + (sy + 0.5) / SS) / SIZE;
                    if (!inRoundedRect(u, v, 0.23)) {
                        continue;
                    }
                    bgHits++;
                    gradientSum += v;
                    for (const [ax, ay, bx, by] of RADICAL) {
                        if (distToSegment(u, v, ax, ay, bx, by) <= STROKE / 2) {
                            fgHits++;
                            break;
                        }
                    }
                }
            }
            const total = SS * SS;
            const alpha = bgHits / total;
            const index = (y * SIZE + x) * 4;
            if (alpha === 0) {
                rgba[index + 3] = 0;
                continue;
            }
            // 渐变底色
            const t = bgHits ? gradientSum / bgHits : 0;
            let r = 76 + (124 - 76) * t;
            let g = 141 + (92 - 141) * t;
            let b = 255 + (255 - 255) * t;
            // 白色前景
            const fg = clamp01(fgHits / total);
            r = r * (1 - fg) + 255 * fg;
            g = g * (1 - fg) + 255 * fg;
            b = b * (1 - fg) + 255 * fg;
            rgba[index] = Math.round(r);
            rgba[index + 1] = Math.round(g);
            rgba[index + 2] = Math.round(b);
            rgba[index + 3] = Math.round(clamp01(alpha) * 255);
        }
    }
    return encodePng(SIZE, SIZE, rgba);
};

const png = render();
fs.writeFileSync(path.join(ROOT, "icon.png"), png);
fs.writeFileSync(path.join(ROOT, "preview.png"), png);
console.log(`✅ 已生成 icon.png / preview.png（${SIZE}×${SIZE}，${(png.length / 1024).toFixed(1)} KB）`);
