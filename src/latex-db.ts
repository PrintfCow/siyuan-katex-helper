/**
 * LaTeX 命令数据库。
 *
 * 基础数据由 `scripts/gen-latex-db.mjs` 从 KaTeX 源码自动生成
 * （见 `latex-db.generated.ts`），本文件在其之上：
 *   1. 合并人工精选的代码片段（带 `$1` `$2` 制表位标记）；
 *   2. 为带参数的函数自动补齐 `{}` / `[]`；
 *   3. 生成用于补全列表预览的 LaTeX。
 */
import {KATEX_ENVIRONMENTS, KATEX_FUNCTIONS, KATEX_MACROS, KATEX_SYMBOLS} from "./latex-db.generated";

export type LatexKind = "snippet" | "environment" | "function" | "symbol" | "macro";

export interface LatexItem {
    /** 触发词（不含反斜杠），例如 `frac`、`alpha`、`pmatrix` */
    name: string;
    /** 插入内容，`$1` `$2` … 为制表位，`$0` 为结束位置 */
    insert: string;
    /** 用于 KaTeX 预览的 LaTeX */
    preview: string;
    kind: LatexKind;
}

/**
 * 人工精选片段。优先级最高，会覆盖同名的自动生成项。
 * `$1`、`$2` … 表示按 Tab 依次跳转的位置。
 */
const CURATED: Record<string, string> = {
    /* ---------------- 分数 / 二项式 ---------------- */
    frac: "\\frac{$1}{$2}",
    dfrac: "\\dfrac{$1}{$2}",
    tfrac: "\\tfrac{$1}{$2}",
    cfrac: "\\cfrac{$1}{$2}",
    binom: "\\binom{$1}{$2}",
    dbinom: "\\dbinom{$1}{$2}",
    tbinom: "\\tbinom{$1}{$2}",
    genfrac: "\\genfrac{}{}{}{}{$1}{$2}",

    /* ---------------- 根式 ---------------- */
    sqrt: "\\sqrt{$1}",
    sqrtn: "\\sqrt[$1]{$2}",

    /* ---------------- 大运算符（带上下限） ---------------- */
    sum: "\\sum_{$1}^{$2}",
    prod: "\\prod_{$1}^{$2}",
    coprod: "\\coprod_{$1}^{$2}",
    int: "\\int_{$1}^{$2}",
    iint: "\\iint_{$1}^{$2}",
    iiint: "\\iiint_{$1}^{$2}",
    oint: "\\oint_{$1}^{$2}",
    bigcup: "\\bigcup_{$1}^{$2}",
    bigcap: "\\bigcap_{$1}^{$2}",
    bigoplus: "\\bigoplus_{$1}^{$2}",
    bigotimes: "\\bigotimes_{$1}^{$2}",
    bigodot: "\\bigodot_{$1}^{$2}",
    bigvee: "\\bigvee_{$1}^{$2}",
    bigwedge: "\\bigwedge_{$1}^{$2}",
    lim: "\\lim_{$1}",
    limsup: "\\limsup_{$1}",
    liminf: "\\liminf_{$1}",
    max: "\\max_{$1}",
    min: "\\min_{$1}",
    sup: "\\sup_{$1}",
    inf: "\\inf_{$1}",
    argmax: "\\operatorname*{arg\\,max}_{$1}",
    argmin: "\\operatorname*{arg\\,min}_{$1}",

    /* ---------------- 文本与字体 ---------------- */
    text: "\\text{$1}",
    textbf: "\\textbf{$1}",
    textit: "\\textit{$1}",
    textrm: "\\textrm{$1}",
    textsf: "\\textsf{$1}",
    texttt: "\\texttt{$1}",
    mathbf: "\\mathbf{$1}",
    mathrm: "\\mathrm{$1}",
    mathit: "\\mathit{$1}",
    mathbb: "\\mathbb{$1}",
    mathcal: "\\mathcal{$1}",
    mathfrak: "\\mathfrak{$1}",
    mathsf: "\\mathsf{$1}",
    mathtt: "\\mathtt{$1}",
    mathnormal: "\\mathnormal{$1}",
    boldsymbol: "\\boldsymbol{$1}",
    bm: "\\bm{$1}",
    operatorname: "\\operatorname{$1}",

    /* ---------------- 重音 / 装饰 ---------------- */
    vec: "\\vec{$1}",
    hat: "\\hat{$1}",
    widehat: "\\widehat{$1}",
    bar: "\\bar{$1}",
    overline: "\\overline{$1}",
    underline: "\\underline{$1}",
    tilde: "\\tilde{$1}",
    widetilde: "\\widetilde{$1}",
    dot: "\\dot{$1}",
    ddot: "\\ddot{$1}",
    overbrace: "\\overbrace{$1}",
    underbrace: "\\underbrace{$1}",
    overrightarrow: "\\overrightarrow{$1}",
    overleftarrow: "\\overleftarrow{$1}",
    overleftrightarrow: "\\overleftrightarrow{$1}",
    overset: "\\overset{$1}{$2}",
    underset: "\\underset{$1}{$2}",
    stackrel: "\\stackrel{$1}{$2}",
    substack: "\\substack{$1}",
    boxed: "\\boxed{$1}",
    fbox: "\\fbox{$1}",
    cancel: "\\cancel{$1}",
    mathring: "\\mathring{$1}",
    acute: "\\acute{$1}",
    grave: "\\grave{$1}",
    check: "\\check{$1}",
    breve: "\\breve{$1}",

    /* ---------------- 箭头（可带标注） ---------------- */
    xrightarrow: "\\xrightarrow{$1}",
    xleftarrow: "\\xleftarrow{$1}",
    xtwoheadrightarrow: "\\xtwoheadrightarrow{$1}",

    /* ---------------- 定界符 ---------------- */
    left: "\\left($1\\right)",
    "left(": "\\left($1\\right)",
    "left[": "\\left[$1\\right]",
    "left{": "\\left\\{$1\\right\\}",
    "left|": "\\left|$1\\right|",
    abs: "\\left|$1\\right|",
    norm: "\\left\\|$1\\right\\|",
    ceil: "\\left\\lceil$1\\right\\rceil",
    floor: "\\left\\lfloor$1\\right\\rfloor",
    angle: "\\left\\langle$1\\right\\rangle",
    brace: "\\left\\{$1\\right\\}",
    bracket: "\\left[$1\\right]",

    /* ---------------- 常用上下标别名 ---------------- */
    sub: "_{$1}",
    pw: "^{$1}",
    power: "^{$1}",
    sq: "^{2}",
    cb: "^{3}",
    inv: "^{-1}",

    /* ---------------- 环境 ---------------- */
    matrix: "\\begin{matrix}$1\\end{matrix}",
    pmatrix: "\\begin{pmatrix}$1 & $2 \\\\ $3 & $4\\end{pmatrix}",
    bmatrix: "\\begin{bmatrix}$1 & $2 \\\\ $3 & $4\\end{bmatrix}",
    Bmatrix: "\\begin{Bmatrix}$1 & $2 \\\\ $3 & $4\\end{Bmatrix}",
    vmatrix: "\\begin{vmatrix}$1 & $2 \\\\ $3 & $4\\end{vmatrix}",
    Vmatrix: "\\begin{Vmatrix}$1 & $2 \\\\ $3 & $4\\end{Vmatrix}",
    smallmatrix: "\\begin{smallmatrix}$1 & $2 \\\\ $3 & $4\\end{smallmatrix}",
    cases: "\\begin{cases}$1 & $2 \\\\ $3 & $4\\end{cases}",
    aligned: "\\begin{aligned}$1 &= $2 \\\\ $3 &= $4\\end{aligned}",
    align: "\\begin{align}$1 &= $2 \\\\ $3 &= $4\\end{align}",
    array: "\\begin{array}{$1}$2\\end{array}",
    gathered: "\\begin{gathered}$1 \\\\ $2\\end{gathered}",
    split: "\\begin{split}$1 &= $2\\end{split}",
    equation: "\\begin{equation}$1\\end{equation}",

    /* ---------------- 其它常用 ---------------- */
    color: "\\color{$1}{$2}",
    textcolor: "\\textcolor{$1}{$2}",
    colorbox: "\\colorbox{$1}{$2}",
    hspace: "\\hspace{$1}",
    vspace: "\\vspace{$1}",
    rule: "\\rule{$1}{$2}",
    phantom: "\\phantom{$1}",
    hphantom: "\\hphantom{$1}",
    vphantom: "\\vphantom{$1}",
    mathop: "\\mathop{$1}",
    mathrel: "\\mathrel{$1}",
    mathbin: "\\mathbin{$1}",
    mathord: "\\mathord{$1}",
    mathchoice: "\\mathchoice{$1}{$2}{$3}{$4}",
    href: "\\href{$1}{$2}",
    raisebox: "\\raisebox{$1}{$2}",
};

/** `\begin{环境名}` … `\end{环境名}` 的通用模板 */
const ENV_TEMPLATE = "\\begin{NAME}$1\\end{NAME}";

/**
 * 定界符类命令。它们的参数是**定界符本身**（`\Big(` ），而不是分组，
 * 自动补 `{}` 会得到无法渲染的 `\Big{}`，所以只把光标放到命令后面。
 * @see KaTeX functions/delimsizing.ts：`argTypes: ["primitive"]`
 */
const DELIMITER_COMMANDS = new Set([
    "big", "Big", "bigg", "Bigg",
    "bigl", "Bigl", "bigr", "Bigr", "bigm", "Bigm",
    "biggl", "Biggl", "biggr", "Biggr", "biggm", "Biggm",
]);

/** 把 `$1` `$2` … 制表位替换成 `\square`，得到可渲染的预览 LaTeX */
const previewOf = (insert: string, name: string, kind: LatexKind): string => {
    if (kind === "symbol") {
        return "\\" + name;
    }
    if (DELIMITER_COMMANDS.has(name)) {
        // 用一个真实的定界符做预览
        return "\\" + name + "(";
    }
    if (kind === "environment") {
        return insert.replace(/\$(\d)/g, "\\square");
    }
    return insert.replace(/\$(\d)/g, "\\square");
};

/** 依据 KaTeX 的参数个数自动生成插入内容与制表位 */
const autoInsert = (name: string, args: number, opt: number): string => {
    if (DELIMITER_COMMANDS.has(name)) {
        return "\\" + name + "$1";
    }
    let out = "\\" + name;
    let n = 1;
    for (let i = 0; i < opt; i++) {
        out += `[$${n++}]`;
    }
    for (let i = 0; i < args; i++) {
        out += `{$${n++}}`;
    }
    return out;
};

let cached: LatexItem[] | null = null;

/** 构建（并缓存）完整命令库 */
export const getDatabase = (): LatexItem[] => {
    if (cached) {
        return cached;
    }
    const map = new Map<string, LatexItem>();
    // 注意：这里必须区分大小写去重。LaTeX 中 `\delta` 与 `\Delta`、`\gamma` 与 `\Gamma`、
    // `bmatrix` 与 `Bmatrix` 是**不同**的命令，忽略大小写会把大写形式整条丢弃。
    const put = (item: LatexItem) => {
        if (!map.has(item.name)) {
            map.set(item.name, item);
        }
    };

    // 1. 精选片段优先级最高
    for (const [name, insert] of Object.entries(CURATED)) {
        put({name, insert, preview: previewOf(insert, name, "snippet"), kind: "snippet"});
    }
    // 2. 环境
    for (const env of KATEX_ENVIRONMENTS) {
        const insert = ENV_TEMPLATE.replace(/NAME/g, env);
        put({name: env, insert, preview: previewOf(insert, env, "environment"), kind: "environment"});
    }
    // 3. 带参数的函数
    for (const [name, args, opt] of KATEX_FUNCTIONS) {
        const insert = autoInsert(name, args, opt);
        put({
            name,
            insert,
            preview: previewOf(insert, name, "function"),
            kind: args + opt > 0 ? "function" : "symbol",
        });
    }
    // 4. 无参数符号
    for (const [name, glyph] of KATEX_SYMBOLS) {
        put({
            name,
            insert: "\\" + name,
            preview: glyph ? "\\" + name : "\\" + name,
            kind: "symbol",
        });
    }
    // 5. 内置宏
    for (const name of KATEX_MACROS) {
        put({name, insert: "\\" + name, preview: "\\" + name, kind: "macro"});
    }

    cached = [...map.values()];
    return cached;
};

/** 子序列打分：`q` 的字符按顺序出现在 `name` 中则返回正分，否则返回 -1 */
const subsequenceScore = (name: string, q: string): number => {
    let qi = 0;
    let gap = 0;
    let lastHit = -1;
    for (let i = 0; i < name.length && qi < q.length; i++) {
        if (name[i] === q[qi]) {
            if (lastHit >= 0) {
                gap += i - lastHit - 1;
            }
            lastHit = i;
            qi++;
        }
    }
    if (qi < q.length) {
        return -1;
    }
    return 120 - Math.min(gap, 100) - Math.min(name.length - q.length, 40);
};

export interface SearchResult {
    item: LatexItem;
    /** 高亮区间 [start, end)，可能为空 */
    highlight: [number, number] | null;
}

/** 完全匹配得分 */
const SCORE_EXACT = 2000;
/** 前缀匹配得分 */
const SCORE_PREFIX = 1500;
/** 子串匹配得分 */
const SCORE_SUBSTRING = 1000;
/** 模糊（子序列）匹配得分 */
const SCORE_FUZZY = 400;
/**
 * 只有忽略大小写才命中时的降权（150）。
 * 参考分档：完全匹配 2000 / 前缀 1500 / 子串 1000 / 模糊 400，
 * 因此这个降权只影响**同一档**内的先后：`Delta` 与 `delta` 同时精确命中时，
 * 大小写一致的排前面；但「大小写不对的完全匹配」(1850) 仍高于
 * 「大小写正确的前缀匹配」(≤1500)，不会因为大小写把明显更贴切的候选挤掉。
 */
const CASE_MISMATCH_PENALTY = 150;

interface NameMatch {
    score: number;
    highlight: [number, number] | null;
}

/** 在 `name` 中按 `query` 打分；未命中返回 null */
const matchName = (name: string, query: string, fuzzy: boolean): NameMatch | null => {
    if (name === query) {
        return {score: SCORE_EXACT, highlight: [0, query.length]};
    }
    if (name.startsWith(query)) {
        return {score: SCORE_PREFIX - (name.length - query.length), highlight: [0, query.length]};
    }
    const idx = name.indexOf(query);
    if (idx > 0) {
        return {score: SCORE_SUBSTRING - idx * 4 - (name.length - query.length), highlight: [idx, idx + query.length]};
    }
    if (fuzzy) {
        const sub = subsequenceScore(name, query);
        if (sub > 0) {
            return {score: SCORE_FUZZY + sub, highlight: null};
        }
    }
    return null;
};

/** 依据输入内容检索命令 */
export const searchItems = (query: string, fuzzy: boolean, limit: number): SearchResult[] => {
    if (!query) {
        return [];
    }
    const q = query.toLowerCase();
    const db = getDatabase();
    const scored: {item: LatexItem; score: number; highlight: [number, number] | null}[] = [];

    for (const item of db) {
        // 先区分大小写匹配，让 `Delta` 命中 `\Delta`、`delta` 命中 `\delta`；
        // 只有区分大小写完全命中不了时，才退回忽略大小写并降权。
        let match = matchName(item.name, query, fuzzy);
        if (!match) {
            const insensitive = matchName(item.name.toLowerCase(), q, fuzzy);
            if (!insensitive) {
                continue;
            }
            insensitive.score -= CASE_MISMATCH_PENALTY;
            match = insensitive;
        }
        let score = match.score;
        // 精选片段略微加权
        if (item.kind === "snippet") {
            score += 25;
        }
        if (score > 0) {
            scored.push({item, score, highlight: match.highlight});
        }
    }

    scored.sort((a, b) =>
        b.score - a.score ||
        a.item.name.length - b.item.name.length ||
        a.item.name.localeCompare(b.item.name));
    return scored.slice(0, limit).map(({item, highlight}) => ({item, highlight}));
};
