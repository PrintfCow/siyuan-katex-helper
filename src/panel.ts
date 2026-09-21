/**
 * 公式编辑面板的识别。
 *
 * 思源 3.8.3 中，行内公式 / 公式块 / 图表 / 嵌入块等「渲染节点」共用同一个
 * 编辑面板（Toolbar 类的 `subElement`，DOM 为 `div.protyle-util`），
 * 面板里是一个 `textarea.b3-text-field`。
 *
 * 关键事实（来自对 3.8.3 前端代码的核对）：
 *   - 面板显示时 `protyle-util` 上的 `fn__none` 会被移除；
 *   - 面板标题栏的 `.resize__move` 里写着 `window.siyuan.languages["inline-math"]`
 *     （行级公式）或 `window.siyuan.languages.math`（公式块），可据此判断类型；
 *   - 打开面板时核心会执行 `textarea.select()`，这就是「默认全选」的根因。
 */

export type MathPanelKind = "inline" | "block" | "other";

export interface MathPanelContext {
    /** 面板本体（div.protyle-util） */
    panel: HTMLElement;
    /** 面板中的公式输入框 */
    textarea: HTMLTextAreaElement;
    /** 面板类型：行内公式 / 公式块 / 其它渲染节点 */
    kind: MathPanelKind;
}

const siyuanLanguages = (): Record<string, string> =>
    ((window as unknown as {siyuan?: {languages?: Record<string, string>}}).siyuan?.languages || {});

/** 读取面板标题，判断是不是公式面板 */
const readKind = (panel: HTMLElement): MathPanelKind => {
    const title = panel.querySelector(".resize__move")?.textContent?.trim() || "";
    const lang = siyuanLanguages();
    const inlineTitle = lang["inline-math"] || "行级公式";
    const blockTitle = lang.math || "公式块";
    if (title && title === inlineTitle) {
        return "inline";
    }
    if (title && title === blockTitle) {
        return "block";
    }
    return "other";
};

/** 面板是否处于可见状态 */
const isVisible = (element: HTMLElement): boolean => {
    if (element.classList.contains("fn__none") || element.style.display === "none") {
        return false;
    }
    // 注意：.protyle-util 是 position:fixed，offsetParent 恒为 null，
    // 因此只能用 getClientRects 判断是否真正渲染。
    return element.getClientRects().length > 0;
};

/** 取得当前正在编辑的公式面板（没有则返回 null） */
export const getActiveMathPanel = (): MathPanelContext | null => {
    const panels = document.querySelectorAll<HTMLElement>(".protyle-util");
    for (const panel of panels) {
        if (!isVisible(panel)) {
            continue;
        }
        const textarea = panel.querySelector<HTMLTextAreaElement>("textarea.b3-text-field");
        if (!textarea) {
            continue;
        }
        const kind = readKind(panel);
        if (kind === "other") {
            continue;
        }
        return {panel, textarea, kind};
    }
    return null;
};

/** 判断某个元素是不是公式面板里的输入框 */
export const isMathTextarea = (element: unknown): element is HTMLTextAreaElement => {
    if (!(element instanceof HTMLTextAreaElement)) {
        return false;
    }
    const panel = element.closest<HTMLElement>(".protyle-util");
    if (!panel) {
        return false;
    }
    return readKind(panel) !== "other";
};

/** 面板对应的编辑类型（用于判断是否启用补全） */
export const panelKindOf = (textarea: HTMLTextAreaElement): MathPanelKind => {
    const panel = textarea.closest<HTMLElement>(".protyle-util");
    return panel ? readKind(panel) : "other";
};

/**
 * 判断光标是否紧贴着某个行内公式。
 * 仅在方向键按下时使用，用来确认「核心即将因为行内公式而打开编辑窗口」。
 *
 * 这是思源 core `getAdjacentInlineMath()` 的等价实现：
 * 文本节点必须先满足「本侧只剩零宽字符」，再逐层向上找相邻兄弟节点。
 */
export const isCaretAdjacentToInlineMath = (range: Range, previous: boolean): boolean => {
    let currentNode: Node | null = range.startContainer;
    let adjacentNode: Node | null;

    if (currentNode.nodeType === Node.TEXT_NODE) {
        const text = currentNode.textContent || "";
        const rest = previous ? text.slice(0, range.startOffset) : text.slice(range.startOffset);
        if (rest.replace(/\u200B/g, "") !== "") {
            return false;
        }
        adjacentNode = previous ? currentNode.previousSibling : currentNode.nextSibling;
    } else {
        adjacentNode = currentNode.childNodes[previous ? range.startOffset - 1 : range.startOffset] || null;
    }

    let guard = 0;
    while (currentNode && guard++ < 100) {
        while (adjacentNode && isIgnorable(adjacentNode)) {
            adjacentNode = previous ? adjacentNode.previousSibling : adjacentNode.nextSibling;
        }
        if (adjacentNode) {
            return isMathElement(adjacentNode);
        }
        if (currentNode.nodeType === Node.ELEMENT_NODE &&
            (currentNode as Element).classList.contains("protyle-wysiwyg")) {
            return false;
        }
        currentNode = currentNode.parentNode;
        if (currentNode) {
            adjacentNode = previous ? currentNode.previousSibling : currentNode.nextSibling;
        }
    }
    return false;
};

/** 空文本节点（只含零宽字符）与 <wbr> 都要跳过 */
const isIgnorable = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || "").replace(/\u200B/g, "") === "";
    }
    return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "WBR";
};

const isMathElement = (node: Node): boolean => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }
    const element = node as Element;
    if (element.matches('[data-type~="inline-math"]')) {
        return true;
    }
    // 行内公式外面有时还会包一层（例如 .render-node）
    return Boolean(element.querySelector(':scope > [data-type~="inline-math"]'));
};
