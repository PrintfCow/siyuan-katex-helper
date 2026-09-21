/**
 * 代码片段解析：把带 `$1` `$2` … 制表位标记的片段文本
 * 转换成「去掉标记的纯文本 + 各制表位的偏移量」。
 *
 * 约定：
 *   - `$1` `$2` … `$9` 为制表位，按编号顺序跳转；
 *   - `$0` 为可选的结束位置（不写则以片段末尾为准）；
 *   - `\$` 表示字面量 `$`。
 */
export interface ParsedSnippet {
    /** 去掉制表位标记后真正要插入的文本 */
    text: string;
    /** 各制表位在 `text` 中的偏移量，按跳转顺序排列 */
    stops: number[];
}

export const parseSnippet = (insert: string): ParsedSnippet => {
    let text = "";
    const positions = new Map<number, number>();

    for (let i = 0; i < insert.length; i++) {
        const ch = insert[i];
        // `\$` → 字面量 $
        if (ch === "\\" && insert[i + 1] === "$") {
            text += "$";
            i++;
            continue;
        }
        if (ch === "$" && i + 1 < insert.length && insert[i + 1] >= "0" && insert[i + 1] <= "9") {
            const index = Number(insert[i + 1]);
            if (!positions.has(index)) {
                positions.set(index, text.length);
            }
            i++;
            continue;
        }
        text += ch;
    }

    // $0 永远排在最后
    const keys = [...positions.keys()].sort((a, b) => {
        const ka = a === 0 ? Number.MAX_SAFE_INTEGER : a;
        const kb = b === 0 ? Number.MAX_SAFE_INTEGER : b;
        return ka - kb;
    });

    return {text, stops: keys.map((k) => positions.get(k) as number)};
};
