/**
 * KaTeX 公式助手 —— 思源笔记插件。
 *
 * 功能一：用方向键呼出行内公式编辑窗口时，不再默认全选公式内容。
 * 功能二：在公式编辑窗口中输入英文即弹出 LaTeX 命令补全，
 *        支持方向键选择 / 回车确认 / 自动补齐花括号 / Tab 依次跳转。
 */
import {Plugin, Setting} from "siyuan";
import {CompletionController, type CompletionSettings} from "./completion";
import {getActiveMathPanel, isCaretAdjacentToInlineMath, isMathTextarea} from "./panel";

type CaretOnOpen = "entry" | "start" | "end";

interface HelperSettings extends CompletionSettings {
    /** 方向键呼出公式编辑窗口时，取消默认全选 */
    fixArrowOpen: boolean;
    /** 鼠标点击呼出公式编辑窗口时，同样取消默认全选 */
    fixClickOpen: boolean;
    /** 取消全选后光标的落点 */
    caretOnOpen: CaretOnOpen;
}

const DEFAULT_SETTINGS: HelperSettings = {
    fixArrowOpen: true,
    fixClickOpen: false,
    caretOnOpen: "entry",
    enableCompletion: true,
    completionInBlockMath: true,
    minChars: 1,
    maxSuggestions: 50,
    fuzzyMatch: true,
    showPreview: true,
    enterAccepts: true,
    tabAccepts: true,
    lastTabAction: "caret",
};

/** 方向键按下后，多久之内出现的公式面板认为是「由方向键呼出」 */
const ARROW_OPEN_WINDOW_MS = 600;

export default class KatexHelperPlugin extends Plugin {
    private settingsData: HelperSettings = {...DEFAULT_SETTINGS};
    private completion!: CompletionController;
    private lastArrowKey: {key: "ArrowLeft" | "ArrowRight"; time: number} | null = null;

    /* ------------------------------------------------------------ 生命周期 */

    public override async onload(): Promise<void> {
        await this.loadSettings();

        this.completion = new CompletionController(this.settingsData);

        window.addEventListener("keydown", this.onKeyDown, true);
        window.addEventListener("input", this.onInput, true);
        document.addEventListener("focusin", this.onFocusIn, true);
        document.addEventListener("mousedown", this.onMouseDown, true);

        this.setupSetting();
    }

    public override onunload(): void {
        window.removeEventListener("keydown", this.onKeyDown, true);
        window.removeEventListener("input", this.onInput, true);
        document.removeEventListener("focusin", this.onFocusIn, true);
        document.removeEventListener("mousedown", this.onMouseDown, true);
        this.completion?.destroy();
    }

    private async loadSettings(): Promise<void> {
        const saved = await this.loadData("settings") as Partial<HelperSettings> | null;
        Object.assign(this.settingsData, DEFAULT_SETTINGS, saved || {});
    }

    /* -------------------------------------------------------------- 事件处理 */

    /**
     * 捕获阶段监听：必须早于思源核心（核心在 protyle.wysiwyg.element 的
     * 冒泡阶段处理按键，且不检查 defaultPrevented，所以只能靠阻止传播）。
     */
    private onKeyDown = (event: KeyboardEvent): void => {
        if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
            return;
        }
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        // ---------- 公式编辑窗口内部：补全 / 制表位 ----------
        if (isMathTextarea(target)) {
            if (target instanceof HTMLTextAreaElement) {
                this.completion.handleKeyDown(event, target);
            }
            return;
        }

        // ---------- 编辑器内部：方向键呼出行内公式编辑窗口 ----------
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
            return;
        }
        if (!this.settingsData.fixArrowOpen || !target.closest(".protyle-wysiwyg")) {
            return;
        }
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
            return;
        }
        // 只有光标紧贴行内公式时，核心才会打开编辑窗口
        if (!isCaretAdjacentToInlineMath(selection.getRangeAt(0), event.key === "ArrowLeft")) {
            return;
        }
        this.lastArrowKey = {key: event.key, time: Date.now()};
        this.scheduleCaretFix(event.key);
    };

    private onInput = (event: Event): void => {
        const target = event.target;
        if (isMathTextarea(target)) {
            this.completion.onInput(target);
        }
    };

    private onFocusIn = (event: FocusEvent): void => {
        const target = event.target;
        if (!isMathTextarea(target)) {
            return;
        }
        // 判断是不是「刚刚打开面板」：上一次焦点还在面板之外
        const related = event.relatedTarget as HTMLElement | null;
        const fromInsidePanel = Boolean(related && related.closest(".protyle-util"));
        if (!fromInsidePanel) {
            this.completion.onPanelClose();
        }
        if (!this.settingsData.fixClickOpen) {
            return;
        }
        const recentArrow = this.lastArrowKey && Date.now() - this.lastArrowKey.time < ARROW_OPEN_WINDOW_MS;
        if (recentArrow) {
            // 已经由 scheduleCaretFix 处理，落点更准确
            return;
        }
        queueMicrotask(() => this.collapseTextareaSelection(target, null));
        requestAnimationFrame(() => this.collapseTextareaSelection(target, null));
    };

    private onMouseDown = (event: MouseEvent): void => {
        const target = event.target as HTMLElement | null;
        if (!target || target.closest(".katex-helper__hint")) {
            return;
        }
        this.completion.hide();
    };

    /* ---------------------------------------------- 功能一：取消默认全选 */

    private scheduleCaretFix(key: "ArrowLeft" | "ArrowRight"): void {
        const apply = () => {
            if (!this.settingsData.fixArrowOpen) {
                return;
            }
            const ctx = getActiveMathPanel();
            if (!ctx) {
                return;
            }
            this.collapseTextareaSelection(ctx.textarea, key);
        };
        // 核心在同一次按键派发中同步打开面板，这里用三种时机兜底
        queueMicrotask(apply);
        requestAnimationFrame(apply);
        window.setTimeout(apply, 0);
    }

    /**
     * 思源打开渲染节点编辑面板时会执行 `textarea.select()`，
     * 这里把「全选」改成折叠光标。
     */
    private collapseTextareaSelection(textarea: HTMLTextAreaElement, key: "ArrowLeft" | "ArrowRight" | null): void {
        if (document.activeElement !== textarea) {
            return;
        }
        const length = textarea.value.length;
        if (length === 0) {
            return;
        }
        if (textarea.selectionStart !== 0 || textarea.selectionEnd !== length) {
            // 已经不是全选状态，说明用户或核心已经调整过，不再干预
            return;
        }
        let position: number;
        switch (this.settingsData.caretOnOpen) {
            case "start":
                position = 0;
                break;
            case "end":
                position = length;
                break;
            default:
                // 顺着方向键的方向「走进」公式：从右边进入落在末尾，从左边进入落在开头
                position = key === "ArrowRight" ? 0 : length;
                break;
        }
        textarea.setSelectionRange(position, position);
    }

    /* ---------------------------------------------------------------- 设置 */

    private setupSetting(): void {
        const t = (key: string): string => (this.i18n && this.i18n[key]) || key;

        this.setting = new Setting({
            confirmCallback: () => {
                void this.saveData("settings", this.settingsData);
                this.completion.updateSettings(this.settingsData);
            },
        });

        this.setting.addItem({
            title: t("fixArrowOpen"),
            description: t("fixArrowOpenDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.fixArrowOpen,
                (value) => (this.settingsData.fixArrowOpen = value)),
        });
        this.setting.addItem({
            title: t("caretOnOpen"),
            description: t("caretOnOpenDesc"),
            createActionElement: () => this.createSelect<CaretOnOpen>(
                [
                    {value: "entry", label: t("caretOnOpenEntry")},
                    {value: "start", label: t("caretOnOpenStart")},
                    {value: "end", label: t("caretOnOpenEnd")},
                ],
                this.settingsData.caretOnOpen,
                (value) => (this.settingsData.caretOnOpen = value)),
        });
        this.setting.addItem({
            title: t("fixClickOpen"),
            description: t("fixClickOpenDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.fixClickOpen,
                (value) => (this.settingsData.fixClickOpen = value)),
        });

        this.setting.addItem({
            title: t("enableCompletion"),
            description: t("enableCompletionDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.enableCompletion,
                (value) => (this.settingsData.enableCompletion = value)),
        });
        this.setting.addItem({
            title: t("completionInBlockMath"),
            description: t("completionInBlockMathDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.completionInBlockMath,
                (value) => (this.settingsData.completionInBlockMath = value)),
        });
        this.setting.addItem({
            title: t("minChars"),
            description: t("minCharsDesc"),
            createActionElement: () => this.createNumber(
                this.settingsData.minChars, 1, 6,
                (value) => (this.settingsData.minChars = value)),
        });
        this.setting.addItem({
            title: t("maxSuggestions"),
            description: t("maxSuggestionsDesc"),
            createActionElement: () => this.createNumber(
                this.settingsData.maxSuggestions, 5, 300,
                (value) => (this.settingsData.maxSuggestions = value)),
        });
        this.setting.addItem({
            title: t("fuzzyMatch"),
            description: t("fuzzyMatchDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.fuzzyMatch,
                (value) => (this.settingsData.fuzzyMatch = value)),
        });
        this.setting.addItem({
            title: t("showPreview"),
            description: t("showPreviewDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.showPreview,
                (value) => (this.settingsData.showPreview = value)),
        });

        this.setting.addItem({
            title: t("enterAccepts"),
            description: t("enterAcceptsDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.enterAccepts,
                (value) => (this.settingsData.enterAccepts = value)),
        });
        this.setting.addItem({
            title: t("tabAccepts"),
            description: t("tabAcceptsDesc"),
            createActionElement: () => this.createSwitch(
                this.settingsData.tabAccepts,
                (value) => (this.settingsData.tabAccepts = value)),
        });
        this.setting.addItem({
            title: t("lastTabAction"),
            description: t("lastTabActionDesc"),
            createActionElement: () => this.createSelect<"caret" | "close">(
                [
                    {value: "caret", label: t("lastTabCaret")},
                    {value: "close", label: t("lastTabClose")},
                ],
                this.settingsData.lastTabAction,
                (value) => (this.settingsData.lastTabAction = value)),
        });
    }

    private createSwitch(value: boolean, onChange: (value: boolean) => void): HTMLElement {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "b3-switch fn__flex-center";
        input.checked = value;
        input.addEventListener("change", () => onChange(input.checked));
        return input;
    }

    private createSelect<T extends string>(
        options: {value: T; label: string}[],
        value: T,
        onChange: (value: T) => void,
    ): HTMLElement {
        const select = document.createElement("select");
        select.className = "b3-select fn__flex-center";
        select.style.width = "180px";
        for (const option of options) {
            const item = document.createElement("option");
            item.value = option.value;
            item.textContent = option.label;
            if (option.value === value) {
                item.selected = true;
            }
            select.appendChild(item);
        }
        select.addEventListener("change", () => onChange(select.value as T));
        return select;
    }

    private createNumber(value: number, min: number, max: number, onChange: (value: number) => void): HTMLElement {
        const input = document.createElement("input");
        input.type = "number";
        input.className = "b3-text-field fn__flex-center";
        input.style.width = "80px";
        input.min = String(min);
        input.max = String(max);
        input.value = String(value);
        input.addEventListener("change", () => {
            let next = Number(input.value);
            if (!Number.isFinite(next)) {
                next = value;
            }
            next = Math.min(max, Math.max(min, Math.round(next)));
            input.value = String(next);
            onChange(next);
        });
        return input;
    }
}
