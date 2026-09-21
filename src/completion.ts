/**
 * 公式编辑窗口内的 LaTeX 代码补全。
 *
 * 交互：
 *   - 在公式输入框中输入英文字母（不需要先输入 `\`）即弹出补全列表；
 *   - ↑ / ↓ 选择，Enter（或 Tab）确认，Esc 关闭；
 *   - 确认后若片段中含花括号/方括号，会自动补齐，并把光标放进第一个括号；
 *   - 之后按 Tab 依次跳到下一个括号；已是最后一个则直接跳到片段之外。
 */
import type {LatexItem} from "./latex-db";
import {searchItems} from "./latex-db";
import {getActiveMathPanel, type MathPanelContext, type MathPanelKind} from "./panel";
import {parseSnippet} from "./snippet";

export interface CompletionSettings {
    /** 是否启用代码补全 */
    enableCompletion: boolean;
    /** 是否在公式块（$$…$$）中同样启用 */
    completionInBlockMath: boolean;
    /** 至少输入几个字母才弹出补全 */
    minChars: number;
    /** 补全列表最多显示多少项 */
    maxSuggestions: number;
    /** 是否启用模糊匹配 */
    fuzzyMatch: boolean;
    /** 是否显示公式预览 */
    showPreview: boolean;
    /** 回车确认补全 */
    enterAccepts: boolean;
    /** Tab 确认补全 */
    tabAccepts: boolean;
    /** 最后一个制表位之后按 Tab 的行为：caret=光标停在片段后，close=关闭编辑窗口 */
    lastTabAction: "caret" | "close";
}

/** 触发词：可选的 `\` + 英文字母 + 可选的左括号 */
const TRIGGER_RE = /(\\?)([A-Za-z]+[([{]?)$/;

interface CompletionSession {
    textarea: HTMLTextAreaElement;
    /** 被替换区间的起点（含可选的反斜杠） */
    start: number;
    /** 被替换区间的终点（即光标位置） */
    end: number;
}

interface TabSession {
    textarea: HTMLTextAreaElement;
    /** 各制表位的绝对偏移 */
    stops: number[];
    index: number;
    /** 片段在输入框中的范围 */
    segStart: number;
    segEnd: number;
    /** 上一次的文本内容，用于计算增量 */
    lastValue: string;
}

const KIND_LABEL: Record<string, string> = {
    snippet: "片段",
    environment: "环境",
    function: "函数",
    symbol: "符号",
    macro: "宏",
};

const escapeHtml = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 中断事件传播：核心编辑器不检查 defaultPrevented，必须阻止传播 */
const consume = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
};

export class CompletionController {
    private settings: CompletionSettings;
    private popup: HTMLElement | null = null;
    private items: LatexItem[] = [];
    private highlights: ([number, number] | null)[] = [];
    private index = 0;
    private session: CompletionSession | null = null;
    private tab: TabSession | null = null;
    private katex: {renderToString?: (tex: string, options?: unknown) => string} | null = null;
    private katexLoading = false;
    private previewCache = new Map<string, string>();
    private suppressInput = false;
    private ctx: MathPanelContext | null = null;

    constructor(settings: CompletionSettings) {
        this.settings = settings;
    }

    public updateSettings(settings: CompletionSettings): void {
        this.settings = settings;
    }

    /* ------------------------------------------------------------------ 对外 */

    public onInput(textarea: HTMLTextAreaElement): void {
        this.adjustTabStops(textarea);
        if (this.suppressInput) {
            this.suppressInput = false;
            return;
        }
        this.refresh(textarea);
    }

    /** 面板获得焦点时调用：清空上一次的残留状态 */
    public onPanelFocus(textarea: HTMLTextAreaElement): void {
        if (this.session && this.session.textarea !== textarea) {
            this.hide();
        }
        if (this.tab && this.tab.textarea !== textarea) {
            this.tab = null;
        }
        void textarea;
    }

    /** 面板关闭时调用 */
    public onPanelClose(): void {
        this.hide();
        this.tab = null;
        this.ctx = null;
    }

    public isVisible(): boolean {
        return Boolean(this.popup && !this.popup.classList.contains("fn__none") && this.items.length);
    }

    public hide(): void {
        if (this.popup) {
            this.popup.classList.add("fn__none");
            this.popup.innerHTML = "";
        }
        this.items = [];
        this.highlights = [];
        this.index = 0;
        this.session = null;
    }

    public destroy(): void {
        this.popup?.remove();
        this.popup = null;
        this.items = [];
        this.tab = null;
    }

    /**
     * 处理公式输入框中的按键。
     * @returns 是否已消费该按键（已消费则不会再传给思源核心）
     */
    public handleKeyDown(event: KeyboardEvent, textarea: HTMLTextAreaElement): boolean {
        const {settings} = this;

        // 制表位会话优先：片段还有花括号没填完时，Tab 必须用于跳转花括号，
        // 否则用户在花括号里输入字母弹出补全后就没法用 Tab 跳到下一个括号了。
        if (event.key === "Tab" && this.tab && this.tab.textarea === textarea) {
            if (this.jumpTab(event.shiftKey ? -1 : 1)) {
                consume(event);
                return true;
            }
        }

        if (this.isVisible()) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                this.move(event.key === "ArrowDown" ? 1 : -1);
                consume(event);
                return true;
            }
            if (event.key === "Enter" && settings.enterAccepts &&
                !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                this.accept(this.items[this.index]);
                consume(event);
                return true;
            }
            if (event.key === "Tab" && !event.shiftKey && settings.tabAccepts) {
                this.accept(this.items[this.index]);
                consume(event);
                return true;
            }
            if (event.key === "Escape") {
                this.hide();
                consume(event);
                return true;
            }
            // 其它按键：关闭列表，交给核心继续处理
            this.hide();
        }

        if (event.key === "Escape" && this.tab) {
            this.tab = null;
        }
        return false;
    }

    /* -------------------------------------------------------------- 补全检索 */

    private refresh(textarea: HTMLTextAreaElement): void {
        if (!this.settings.enableCompletion) {
            this.hide();
            return;
        }
        if (textarea.selectionStart !== textarea.selectionEnd) {
            this.hide();
            return;
        }
        const ctx = getActiveMathPanel();
        if (!ctx || ctx.textarea !== textarea) {
            this.hide();
            return;
        }
        this.ctx = ctx;
        if (!this.isEnabledFor(ctx.kind)) {
            this.hide();
            return;
        }

        const caret = textarea.selectionStart;
        const match = textarea.value.slice(0, caret).match(TRIGGER_RE);
        if (!match) {
            this.hide();
            return;
        }
        const word = match[2];
        // 只输入了 `(`、`[`、`{` 这类符号时不算有效触发词
        if (word.replace(/[([{]$/, "").length < Math.max(1, this.settings.minChars)) {
            this.hide();
            return;
        }

        const results = searchItems(word, this.settings.fuzzyMatch, this.settings.maxSuggestions);
        if (!results.length) {
            this.hide();
            return;
        }

        this.session = {textarea, start: caret - match[0].length, end: caret};
        this.items = results.map((r) => r.item);
        this.highlights = results.map((r) => r.highlight);
        this.index = 0;
        this.render();
        this.show();
    }

    private isEnabledFor(kind: MathPanelKind): boolean {
        if (kind === "inline") {
            return true;
        }
        if (kind === "block") {
            return this.settings.completionInBlockMath;
        }
        return false;
    }

    /* ---------------------------------------------------------------- 弹窗 UI */

    private ensurePopup(): HTMLElement {
        if (this.popup && this.popup.isConnected) {
            return this.popup;
        }
        const popup = document.createElement("div");
        popup.className = "protyle-hint b3-list b3-list--background katex-helper__hint fn__none";
        popup.setAttribute("data-close", "false");
        popup.addEventListener("mousedown", (event) => {
            // 防止点击列表时输入框失焦
            event.preventDefault();
        });
        popup.addEventListener("click", (event) => {
            const button = (event.target as HTMLElement)?.closest<HTMLElement>(".b3-list-item");
            if (!button) {
                return;
            }
            const item = this.items[Number(button.dataset.index)];
            if (item) {
                this.accept(item);
            }
        });
        document.body.appendChild(popup);
        this.popup = popup;
        return popup;
    }

    private render(): void {
        const popup = this.ensurePopup();
        const {showPreview} = this.settings;
        popup.innerHTML = this.items.map((item, i) => {
            const preview = showPreview ? this.renderPreview(item) : "";
            return `<button data-index="${i}" style="width: calc(100% - 16px)" ` +
                `class="b3-list-item${i === this.index ? " b3-list-item--focus" : ""}">` +
                (preview ? `<span class="katex-helper__preview">${preview}</span>` : "") +
                `<span class="b3-list-item__text katex-helper__name">${this.labelOf(item, this.highlights[i])}</span>` +
                `<span class="b3-list-item__meta katex-helper__kind">${escapeHtml(KIND_LABEL[item.kind] || "")}</span>` +
                `</button>`;
        }).join("");
    }

    private labelOf(item: LatexItem, highlight: [number, number] | null): string {
        const name = item.name;
        if (!highlight) {
            return "\\" + escapeHtml(name);
        }
        const [start, end] = highlight;
        return "\\" + escapeHtml(name.slice(0, start)) +
            "<mark>" + escapeHtml(name.slice(start, end)) + "</mark>" +
            escapeHtml(name.slice(end));
    }

    private renderPreview(item: LatexItem): string {
        const katex = this.getKatex();
        if (!katex?.renderToString) {
            return "";
        }
        const cached = this.previewCache.get(item.preview);
        if (cached !== undefined) {
            return cached;
        }
        let html = "";
        try {
            html = katex.renderToString(item.preview, {
                throwOnError: true,
                output: "html",
                displayMode: false,
                strict: false,
                trust: false,
            });
        } catch {
            html = "";
        }
        this.previewCache.set(item.preview, html);
        return html;
    }

    private getKatex(): CompletionController["katex"] {
        const win = window as unknown as {katex?: CompletionController["katex"]};
        if (win.katex?.renderToString) {
            this.katex = win.katex;
            return this.katex;
        }
        if (!this.katexLoading) {
            this.katexLoading = true;
            const script = document.createElement("script");
            script.src = "/stage/protyle/js/katex/katex.min.js";
            script.onload = () => {
                // 加载完成后重绘一次，让预览显示出来
                if (this.isVisible()) {
                    this.render();
                    this.position();
                }
            };
            document.head.appendChild(script);
        }
        return null;
    }

    private show(): void {
        const popup = this.ensurePopup();
        popup.classList.remove("fn__none");
        // 面板自身的 z-index 是递增分配的，这里保持一致以免被遮挡
        const siyuan = (window as unknown as {siyuan?: {zIndex?: number}}).siyuan;
        if (siyuan && typeof siyuan.zIndex === "number") {
            popup.style.zIndex = String(++siyuan.zIndex);
        }
        this.position();
    }

    /**
     * 定位补全列表。
     *
     * 硬性约束（两条都是用户可感知的）：
     *   1. 只能出现在编辑框的**正上方**或**正下方**，任何情况下都不覆盖编辑框；
     *   2. 列表自身必须是一个被裁剪的完整盒子，内容不能溢出到盒子外面。
     *
     * 因此顺序必须是：先按可用空间压好 max-height → 再测量真实高度 → 再决定上下与 top。
     * 反过来（先按自然高度决策）会拿到未截断的高度，算出错误的落点。
     */
    private position(): void {
        const popup = this.popup;
        const ctx = this.ctx;
        if (!popup || !ctx) {
            return;
        }
        const MARGIN = 8;       // 距视口边缘的最小间距
        const GAP = 6;          // 与编辑框之间的间距
        const MIN_HEIGHT = 96;  // 列表最小可用高度
        const MAX_HEIGHT = 320; // 列表最大高度

        const panelRect = ctx.panel.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const spaceBelow = viewportHeight - panelRect.bottom - MARGIN - GAP;
        const spaceAbove = panelRect.top - MARGIN - GAP;
        // 下方够用就放下面；下方太窄而上方更宽裕就翻到上面
        const placeBelow = spaceBelow >= MIN_HEIGHT || spaceBelow >= spaceAbove;
        const available = Math.max(MIN_HEIGHT, placeBelow ? spaceBelow : spaceAbove);

        popup.style.maxHeight = `${Math.min(MAX_HEIGHT, available)}px`;
        const height = popup.offsetHeight;
        const width = popup.offsetWidth;

        const top = placeBelow
            ? panelRect.bottom + GAP
            : Math.max(MARGIN, panelRect.top - GAP - height);

        let left = panelRect.left;
        if (left + width > viewportWidth - MARGIN) {
            left = viewportWidth - width - MARGIN;
        }
        if (left < MARGIN) {
            left = MARGIN;
        }

        popup.style.left = `${Math.round(left)}px`;
        popup.style.top = `${Math.round(top)}px`;
    }

    private move(delta: number): void {
        if (!this.items.length) {
            return;
        }
        this.index = (this.index + delta + this.items.length) % this.items.length;
        const popup = this.popup;
        if (!popup) {
            return;
        }
        popup.querySelectorAll(".b3-list-item--focus").forEach((el) => el.classList.remove("b3-list-item--focus"));
        const current = popup.querySelector<HTMLElement>(`[data-index="${this.index}"]`);
        if (!current) {
            return;
        }
        current.classList.add("b3-list-item--focus");
        // 自己算滚动量，不用 scrollIntoView —— 后者可能连带滚动祖先容器，
        // 把整个列表顶出编辑框。
        const itemTop = current.offsetTop;
        const itemBottom = itemTop + current.offsetHeight;
        if (itemTop < popup.scrollTop) {
            popup.scrollTop = itemTop;
        } else if (itemBottom > popup.scrollTop + popup.clientHeight) {
            popup.scrollTop = itemBottom - popup.clientHeight;
        }
    }

    /* ------------------------------------------------------------- 补全确认 */

    private accept(item: LatexItem | undefined): void {
        const session = this.session;
        if (!item || !session) {
            return;
        }
        const {textarea} = session;
        const {text, stops} = parseSnippet(item.insert);

        this.tab = null;
        this.hide();

        // 优先用 execCommand 插入：这样输入框里的原生撤销（Ctrl+Z）依然可用。
        // 直接给 textarea.value 赋值会清空撤销栈。
        this.suppressInput = true;
        let inserted = false;
        try {
            textarea.focus();
            textarea.setSelectionRange(session.start, session.end);
            inserted = document.execCommand("insertText", false, text);
        } catch {
            inserted = false;
        }
        if (!inserted) {
            textarea.value = textarea.value.slice(0, session.start) + text + textarea.value.slice(session.end);
            // dispatchEvent 是同步的，onInput 会把 suppressInput 复位
            textarea.dispatchEvent(new Event("input", {bubbles: true}));
        }
        this.suppressInput = false;

        const base = session.start;
        const segEnd = base + text.length;
        const absoluteStops = stops.map((offset) => base + offset);

        if (absoluteStops.length) {
            textarea.setSelectionRange(absoluteStops[0], absoluteStops[0]);
            this.tab = {
                textarea,
                stops: absoluteStops,
                index: 0,
                segStart: base,
                segEnd,
                lastValue: textarea.value,
            };
        } else {
            textarea.setSelectionRange(segEnd, segEnd);
        }
    }

    /* ----------------------------------------------------------- 制表位跳转 */

    private jumpTab(direction: 1 | -1): boolean {
        const tab = this.tab;
        if (!tab) {
            return false;
        }
        const {textarea} = tab;
        if (tab.segEnd > textarea.value.length || tab.segStart > tab.segEnd) {
            this.tab = null;
            return false;
        }
        const next = tab.index + direction;
        if (next < 0) {
            return false;
        }
        // 光标要移动了，之前那个词的补全列表已经没有意义
        this.hide();
        if (next >= tab.stops.length) {
            // 已是最后一个花括号 —— 直接跳出去
            this.tab = null;
            const caret = Math.max(tab.segStart, Math.min(tab.segEnd, textarea.value.length));
            textarea.setSelectionRange(caret, caret);
            if (this.settings.lastTabAction === "close") {
                this.closePanel(textarea);
            }
            return true;
        }
        tab.index = next;
        const position = Math.max(0, Math.min(textarea.value.length, tab.stops[next]));
        textarea.setSelectionRange(position, position);
        return true;
    }

    private closePanel(textarea: HTMLTextAreaElement): void {
        // 交给核心自带的 Esc 逻辑关闭面板
        textarea.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        }));
    }

    /** 依据输入框内容的变化量，同步修正各制表位的位置 */
    private adjustTabStops(textarea: HTMLTextAreaElement): void {
        const tab = this.tab;
        if (!tab || tab.textarea !== textarea) {
            return;
        }
        const previous = tab.lastValue;
        const current = textarea.value;
        if (previous === current) {
            return;
        }

        const minLength = Math.min(previous.length, current.length);
        let prefix = 0;
        while (prefix < minLength && previous[prefix] === current[prefix]) {
            prefix++;
        }
        let suffix = 0;
        while (suffix < minLength - prefix &&
        previous[previous.length - 1 - suffix] === current[current.length - 1 - suffix]) {
            suffix++;
        }
        const oldEnd = previous.length - suffix;
        const delta = current.length - previous.length;

        const shift = (position: number): number => {
            if (position <= prefix) {
                return position;
            }
            if (position >= oldEnd) {
                return position + delta;
            }
            return -1;
        };

        const stops: number[] = [];
        for (const stop of tab.stops) {
            const shifted = shift(stop);
            if (shifted < 0) {
                this.tab = null;
                return;
            }
            stops.push(shifted);
        }
        const segEnd = shift(tab.segEnd);
        const segStart = shift(tab.segStart);
        if (segEnd < 0 || segStart < 0) {
            this.tab = null;
            return;
        }
        tab.stops = stops;
        tab.segEnd = segEnd;
        tab.segStart = segStart;
        tab.lastValue = current;
    }
}
