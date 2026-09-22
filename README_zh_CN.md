# KaTeX 公式助手 · siyuan-katex-helper

> 思源笔记插件：让 KaTeX 公式写起来更顺手。

[![CI](https://github.com/PrintfCow/siyuan-katex-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/PrintfCow/siyuan-katex-helper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A5%203.8.0-3575f0.svg)](https://b3log.org/siyuan/)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)

面向 **思源 3.8.x**（开发与验证基于 3.8.3）。

---

## 目录

- [功能](#功能)
- [安装](#安装)
- [使用](#使用)
- [设置项](#设置项)
- [项目结构](#项目结构)
- [架构与实现原理](#架构与实现原理)
- [开发](#开发)
- [测试](#测试)
- [打包与发布](#打包与发布)
- [常见问题](#常见问题)
- [兼容性](#兼容性)
- [已知限制](#已知限制)
- [贡献](#贡献)
- [许可](#许可)

---

## 功能

### 1. 修复「方向键呼出公式编辑窗口时默认全选」

**问题**：输入 `$x^2$` 变成行内公式后，把光标移到公式旁边按 `←` / `→`，
思源会打开公式编辑窗口并**默认全选**里面的内容 —— 想接着改一个字符，
却得先按一下方向键取消选中。

**根因**（对照思源 3.8.3 生产包核实）：核心在按键处理里先执行
`range.selectNode(公式节点)`，打开面板时又调用了一次 `textarea.select()`。

**修复后**：不再全选，光标直接落进公式：

| 操作 | 光标位置 |
| --- | --- |
| 光标在公式**右侧**，按 `←` | 公式**末尾** |
| 光标在公式**左侧**，按 `→` | 公式**开头** |

鼠标点击打开公式的行为默认**保持不变**（仍是全选，方便直接重写），可在设置里一并改掉。

### 2. LaTeX 代码补全

在公式编辑窗口里输入**英文字母**即可弹出补全（**不需要先输入 `\`**）：

- 命令库 **1000+ 条**，由 KaTeX 源码自动生成，另叠加人工精选片段；
- **区分大小写**：`Delta` 命中 `\Delta`（Δ），`delta` 命中 `\delta`（δ），两者都会出现在候选里；
  大小写完全匹配的候选优先，仅大小写不同的候选排在后面（`varDelta` 这类仍照常命中）；
- 前缀 / 子串 / 模糊三级匹配，`↑` `↓` 选择，`Enter` 确认，`Esc` 关闭，也可鼠标点击；
- 候选项用 KaTeX **实时渲染**，并高亮命中的字母；
- **弹窗只出现在编辑框的正上方或正下方，任何情况下都不会遮住编辑框**；
- **列表自成一体**：有独立底色、边框与阴影，内容一律裁剪在菜单内部，
  不会「文字冲出菜单」；候选过多时在列表内部滚动；
- 确认后若片段含花括号 / 方括号，会**自动补齐**并把光标放进**第一个括号**；
- 之后按 `Tab` **依次跳到下一个括号**；已经是最后一个括号时，`Tab` 直接**跳出片段**；
- `Shift+Tab` 往回跳；插入保留输入框的原生撤销（`Ctrl+Z`）。

举例：输入 `fra` → 回车 → 得到 `\frac{}{}`，光标已停在第一个 `{}` 里；
输入 `a` 后按 `Tab`，光标跳到第二个 `{}`；再按 `Tab`，光标跳到片段之外。

常用片段：

| 输入 | 回车后得到 | 光标 / Tab 顺序 |
| --- | --- | --- |
| `fra` | `\frac{}{}` | `{}` → `{}` → 跳出 |
| `sum` | `\sum_{}^{}` | `_{}` → `^{}` → 跳出 |
| `int` | `\int_{}^{}` | `_{}` → `^{}` → 跳出 |
| `sqr` | `\sqrt{}` | `{}` → 跳出 |
| `pmat` | `\begin{pmatrix} & \\ & \end{pmatrix}` | 4 个位置依次跳 |
| `alp` | `\alpha` | 无括号，直接插入 |
| `Delta` | `\Delta`（Δ） | 大写命令优先命中大写 |
| `big` | `\big` + 光标 | 定界符命令不补花括号，直接输入 `(` |

---

## 安装

### 方式一：下载安装包（普通用户）

1. 打开 [Releases](https://github.com/PrintfCow/siyuan-katex-helper/releases) 下载 `package.zip`；
2. 解压得到 `siyuan-katex-helper/` 目录；
3. 放进 `<工作区>/data/plugins/`（例如 `~/SiYuan/data/plugins/`）；
4. 重启思源，进入 **设置 → 集市 → 已下载**，打开「KaTeX 公式助手」开关。

> ⚠️ 目录名必须与 `plugin.json` 里的 `name`（`siyuan-katex-helper`）**完全一致**，
> 否则思源会静默跳过、插件不会出现。

### 方式二：从源码构建（开发者）

```bash
git clone git@github.com:PrintfCow/siyuan-katex-helper.git
cd siyuan-katex-helper
npm install
npm run make-install      # 构建 + 打包 + 安装到思源工作区
```

工作区会自动探测（`~/SiYuan`、`~/Documents/SiYuan` 等），也可指定：

```bash
node scripts/install.mjs --workspace /path/to/SiYuan
SIYUAN_WORKSPACE=/path/to/SiYuan npm run make-install
```

### 方式三：开发模式（改完即生效）

```bash
npm run make-link     # 在 <工作区>/data/plugins/ 建立指向本仓库 dist/ 的符号链接
npm run dev           # 监听 src/ 变化并自动重建
```

之后在思源里把插件开关关掉再打开（或重启思源）即可加载新代码。

---

## 使用

### 触发补全

在公式编辑窗口（行内公式 `$…$` 或公式块 `$$…$$`，用方向键或鼠标点开）里输入任意英文字母，
补全列表立即出现；继续输入会实时过滤。

- **不需要输入 `\`**：`alp` 与 `\alp` 都能匹配到 `\alpha`；
- 匹配优先级：完全相同 → 前缀 → 子串 → 模糊（可关闭）；
- 也支持带括号的输入：`left(`、`left[`、`left{` 有各自的定界符片段。

### 快捷键一览

| 按键 | 作用 |
| --- | --- |
| 英文字母 | 弹出 / 过滤补全列表 |
| `↑` `↓` | 在补全列表中移动选择 |
| `Enter` | 确认当前补全项 |
| `Tab` | 片段还有括号未填完时跳到下一个括号；补全列表打开时确认补全 |
| `Shift+Tab` | 跳回上一个括号 |
| `Esc` | 关闭补全列表 / 退出制表位会话 |
| 鼠标点击 | 确认补全项 |

> `Tab` 的优先级是刻意设计的：在花括号里输入字母会弹出补全，
> 如果 `Tab` 直接确认补全，用户就没法用 `Tab` 跳到下一个括号了。
> 因此**只要片段还有未填完的括号，`Tab` 一律用于跳转**，确认补全请用 `Enter`。

---

## 设置项

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| 方向键呼出公式编辑窗口时不全选 | 开 | 本插件的核心修复 |
| 取消全选后的光标位置 | 跟随方向键 | 也可固定为「公式开头 / 公式末尾」 |
| 鼠标点击打开时也不全选 | 关 | 关闭时保留思源「点击即全选重写」的习惯 |
| 启用代码补全 | 开 | |
| 公式块中同样启用补全 | 开 | 关闭后只对行内公式 `$…$` 生效 |
| 触发补全的最少字母数 | 1 | |
| 补全列表最大条目数 | 50 | |
| 启用模糊匹配 | 开 | |
| 显示公式预览 | 开 | 用 KaTeX 渲染候选项 |
| 回车确认补全 | 开 | |
| Tab 确认补全 | 开 | 片段还有括号未填完时，`Tab` 优先用于跳转括号 |
| 最后一个花括号之后的 Tab | 跳到片段之外 | 也可设为「关闭公式编辑窗口」 |

---

## 项目结构

```
siyuan-katex-helper/
├── .github/workflows/
│   ├── ci.yml                    # 类型检查 / 测试 / 构建 / 上传产物
│   └── release.yml               # 打 tag 后自动发布 package.zip
├── i18n/                         # 插件界面文案
│   ├── en_US.json
│   └── zh_CN.json
├── scripts/
│   ├── lib/browser.mjs           # 测试基础设施：定位思源资源/浏览器、静态服务、跑无头浏览器
│   ├── build.mjs                 # 构建到 dist/ 并复制静态资源
│   ├── package.mjs               # 把 dist/ 打成 package.zip
│   ├── install.mjs               # 安装 / 软链到思源工作区
│   ├── gen-latex-db.mjs          # 从 KaTeX 源码生成命令库
│   ├── gen-icon.mjs              # 零依赖生成 icon.png / preview.png
│   ├── test.mjs                  # 逻辑测试（不需要浏览器）
│   ├── e2e.mjs                   # 端到端测试（无头浏览器）
│   └── visual.mjs                # 布局回归测试（无头浏览器 + 截图）
├── src/
│   ├── index.ts                  # 插件入口：生命周期、事件分发、设置面板
│   ├── panel.ts                  # 公式编辑面板识别 + 光标邻接行内公式判定
│   ├── completion.ts             # 补全引擎：检索、弹窗渲染、定位、制表位跳转
│   ├── latex-db.ts               # 命令库组装（自动生成数据 + 精选片段 + 检索打分）
│   ├── latex-db.generated.ts     # 自动生成，请勿手改
│   └── snippet.ts                # 片段解析（$1 / $2 制表位）
├── tests/
│   ├── harness.html              # 端到端测试页面（复刻思源 DOM 与真实结构）
│   ├── loader.js                 # 按思源完全相同的方式加载构建产物
│   └── visual.html               # 布局测试页面（含命中测试探针）
├── dist/                         # 构建产物（gitignore）—— 本身就是完整可安装的插件目录
├── plugin.json                   # 插件清单
├── index.css                     # 插件样式（随包发布）
├── icon.png / preview.png        # 插件图标与集市预览图
├── package.json / tsconfig.json
├── CHANGELOG.md / LICENSE
└── README.md / README_zh_CN.md
```

---

## 架构与实现原理

### 关键机制（已对照思源 3.8.3 / 3.8.5 生产包逐条核实）

| 事实 | 影响 |
| --- | --- |
| 公式编辑面板是 `Toolbar` 的 `subElement`，DOM 为 `div.protyle-util`，内含 `textarea.b3-text-field` | 面板识别 |
| 面板标题栏 `.resize__move` 的文本是 `window.siyuan.languages["inline-math"]` 或 `languages.math` | 用它区分公式面板与 Mermaid / HTML / 嵌入块面板 |
| 面板是 `position: fixed`，`offsetParent` 恒为 `null` | 可见性判断只能用 `getClientRects()` |
| 核心的 `keydown` 绑在 `protyle.wysiwyg.element` 的**冒泡阶段**（3.8.5 仍未加捕获标记） | 捕获阶段监听可以抢先 |
| 核心**不检查 `event.defaultPrevented`** | 必须 `stopPropagation()` / `stopImmediatePropagation()`，只 `preventDefault()` 无效 |
| 打开面板时核心执行 `range.selectNode(公式节点)` 与 `textarea.select()`（3.8.5 代码同上） | 「默认全选」的直接来源 |
| `--b3-menu-background` **只在主题 CSS 中定义**，`base.css` 里没有 | 弹窗必须自带兜底底色，否则会透明 |

### 模块职责

- **`src/index.ts`** —— 插件入口。在 `window` 上注册**捕获阶段**的 `keydown` / `input` /
  `focusin` / `mousedown`，在核心之前拦截按键；负责功能一的光标修复与设置面板。
- **`src/panel.ts`** —— 纯判定逻辑：找出当前可见的公式编辑面板、判断面板类型、
  以及「光标是否紧贴行内公式」（思源 `getAdjacentInlineMath()` 的等价实现，含 `<wbr>` 与零宽字符处理）。
- **`src/completion.ts`** —— 补全引擎。触发词识别、检索调用、弹窗渲染与定位、
  制表位会话（含按输入增量修正制表位位置）。
- **`src/latex-db.ts`** —— 命令库组装与检索打分（精确 > 前缀 > 子串 > 模糊）。
- **`src/snippet.ts`** —— 把 `\frac{$1}{$2}` 解析成「纯文本 + 制表位偏移」。

### 一次补全的完整时序

```
用户在 textarea 输入 "a"
  └─ input 事件（捕获）→ completion.onInput()
       ├─ adjustTabStops()：若处于制表位会话，按文本增量修正各制表位位置
       └─ refresh()：取光标前的触发词 → searchItems() → 渲染列表 → position()
            └─ 先按可用空间设 max-height → 再测量真实高度 → 再决定放编辑框上方还是下方
用户在列表中按 Enter
  └─ keydown 事件（捕获）→ completion.handleKeyDown()
       ├─ preventDefault + stopPropagation + stopImmediatePropagation（核心不再收到该按键）
       └─ accept()
            ├─ parseSnippet() 拆出纯文本与制表位
            ├─ execCommand("insertText")（保留原生撤销）
            └─ 光标落在第一个制表位，开启制表位会话
用户按 Tab
  └─ 优先走制表位跳转（未填完括号时不会被用来确认补全）
       ├─ 还有下一个括号 → 光标移过去
       └─ 已是最后一个 → 光标跳到片段之外（可配置为关闭编辑窗口）
```

---

## 开发

### 环境要求

- Node.js ≥ 18（开发使用 20 / 24）
- npm（仓库内含 `package-lock.json`，CI 使用 `npm ci`）
- 可选：本机安装思源（3.8+），用于运行浏览器端测试

### 常用命令

```bash
npm install            # 安装依赖

npm run build          # 构建到 dist/
npm run dev            # 监听 src/ 变化并重建
npm run package        # 构建 + 打 package.zip

npm run typecheck      # TypeScript 类型检查
npm test               # 逻辑测试（无浏览器）
npm run test:e2e       # 端到端测试（无头浏览器）
npm run test:layout    # 布局回归测试（无头浏览器 + 截图）
npm run test:all       # 以上全部

npm run make-link      # 把 dist/ 软链到思源工作区（开发用）
npm run make-install   # 构建 + 打包 + 复制安装到思源工作区

npm run gen:db         # 重新从 KaTeX 源码生成命令库
npm run gen:icon       # 重新生成图标
```

### 开发流程

1. `npm install && npm run make-link`
2. `npm run dev` 让 esbuild 监听重建；
3. 在思源中把插件开关关掉再打开（或 `Ctrl+Shift+I` 用开发者工具调试）；
4. 提交前跑 `npm run test:all`。

### 代码约定

- 源码为 TypeScript，`strict` 模式，构建由 esbuild 完成（不产出 `.d.ts`）；
- 构建产物必须是 **CommonJS**，并把 `siyuan` 保留为 external
  —— 思源用 `window.eval("(function anonymous(require,module,exports){…})")` 加载插件；
- 注释与日志使用中文，代码标识符使用英文；
- `src/latex-db.generated.ts` 是生成物，修改请改 `scripts/gen-latex-db.mjs` 后重新生成。

---

## 测试

### 三套测试

| 命令 | 数量 | 覆盖内容 |
| --- | --- | --- |
| `npm test` | 24 | 命令库完整性、检索排序与高亮、片段解析与制表位偏移 |
| `npm run test:e2e` | 36 | 用真实构建产物跑完整交互：方向键修复、补全弹窗、`↑↓` 选择、回车确认、花括号补齐与 `Tab` 跳转、非公式面板不误触发、卸载清理 |
| `npm run test:layout` | 27 | 四种编辑框位置下的弹窗布局：零遮挡、视口内、底色不透明、内容裁剪、行宽不超盒、盒子四周无内容漏出 |

端到端与布局测试都**不模拟插件逻辑**，而是：

1. 把 `dist/index.js` 用**与思源完全相同的方式**加载
   （`window.eval("(function anonymous(require,module,exports){…})")`）；
2. 在一个复刻了思源真实 DOM 结构（含 `<wbr>`、零宽字符、`.protyle-util` 面板）的页面里
   派发真实键盘 / 输入事件；
3. 布局测试还会加载思源真实的 `base.css` 与主题 `theme.css`。

其中最有价值的一条断言用 `document.elementFromPoint` 在弹窗盒子**四周探测**：
命中测试与真实绘制共用同一套裁剪规则，所以「盒子外探不到任何列表行」
就等价于「文字不可能画到菜单外面」。

### 为什么浏览器测试需要本机安装思源

这两套测试刻意使用思源**真实的样式表与主题变量**，而不是自己编一份近似的 CSS ——
否则测试只会验证「我假设的思源」，而不是「真实的思源」。
脚本会按顺序探测 `/opt/SiYuan/resources`、`/usr/lib/siyuan/resources`、
`/Applications/SiYuan.app/Contents/Resources` 等路径，也可以用环境变量指定：

```bash
SIYUAN_RESOURCES=/path/to/siyuan/resources npm run test:layout
SIYUAN_THEME=midnight npm run test:layout     # 换主题验证
CHROME_BIN=/usr/bin/google-chrome npm run test:e2e
```

找不到思源时会**明确提示并跳过**（退出码 0），不会伪装成通过。

---

## 打包与发布

### 本地打包

```bash
npm run package        # → package.zip
```

`package.zip` 的内容就是插件目录本身，解压后可直接放进 `<工作区>/data/plugins/`。

### 版本发布流程

1. 更新 `plugin.json` 与 `package.json` 的 `version`，在 `CHANGELOG.md` 补一段；
2. 提交并打 tag：`git tag v1.0.0 && git push origin main --tags`；
3. `.github/workflows/release.yml` 会自动类型检查、跑逻辑测试、构建打包，
   并把 `package.zip` 附到 GitHub Release 上。

### 提交到思源集市

思源集市读取仓库根目录的 `plugin.json`，并从 Release 下载 `package.zip`，
因此上面这套发布流程产出的 Release 可以直接用于集市上架。

---

## 常见问题

**Q：装好了但在「已下载」里看不到插件？**
目录名必须与 `plugin.json` 的 `name` 完全一致（`siyuan-katex-helper`）；
另外确认 `minAppVersion`（3.8.0）不高于你的思源版本。

**Q：改了代码但思源里没变化？**
思源只在启用插件时加载 `index.js`。把插件开关关掉再打开，或重启思源。

**Q：补全列表不出现？**
依次检查：设置里「启用代码补全」是否为开；是不是在**公式编辑窗口**里输入
（正文里输入英文字母不会触发）；公式块是否被「公式块中同样启用补全」排除；
「触发补全的最少字母数」是否被调高。

**Q：`Tab` 没有跳到下一个花括号？**
先确认当前片段确实还有未填完的括号；另外「Tab 确认补全」若关闭，
补全列表打开时 `Tab` 不会有任何动作。最后一个括号之后再按 `Tab` 的行为由
「最后一个花括号之后的 Tab」决定。

**Q：弹窗里的公式预览是空白的？**
预览依赖 `window.katex`。正常情况下思源渲染公式时已加载；
若你的环境加载失败，插件会退化为不显示预览，不影响补全与插入。

**Q：方向键呼出公式窗口时还是全选？**
确认「方向键呼出公式编辑窗口时不全选」为开。该修复只在
**光标紧贴行内公式**（中间只隔 `<wbr>` 或零宽字符）时触发，
这与思源核心打开编辑窗口的条件一致。

---

## 兼容性

| 项目 | 说明 |
| --- | --- |
| 思源版本 | `minAppVersion: 3.8.0`，已在 **3.8.3 与 3.8.5** 上完整验证（DOM、CSS、核心按键逻辑逐条比对） |
| 平台 | 桌面端 / 移动端 / 浏览器端（插件不依赖 Electron 特有 API） |
| 主题 | 跟随主题变量；弹窗自带兜底底色，主题未定义变量时也不会透明 |
| 依赖 | 运行时零依赖；`siyuan` 为类型包，运行时由思源提供 |

---

## 已知限制

- 补全只在**公式编辑窗口**内触发。思源里 `$…$` 是在输入完成时由内核
  （`protyle.lute.SpinBlockDOM()`）转换的，正文中没有可供补全的 LaTeX 输入态。
- `\begin{}` / `\end{}` 没有做成镜像制表位，请直接输入环境名
  （如 `pmat`、`cases`、`aligned`），插件会自动补全两端的 `\begin{}` / `\end{}`。
- 命令库由 KaTeX 0.18 生成，思源 3.8.5 内置的是 KaTeX 0.16.9，
  少数新命令（如 `\overbracket`、`\underbracket`）在思源里会渲染失败（不影响插入）。
- 少数**需要参数的内置宏**（如 `\blue`、`\bra`、`\set`）目前按「无参数」收录，
  确认后会插入命令名本身，需要自己补参数。
- 不处理多光标 / 多选：面板打开时若选区非折叠，补全不会弹出。

---

## 贡献

欢迎提 Issue 与 PR。

- 提交前请确保 `npm run test:all` 全绿；
- 若新增或修改了命令片段，请同时补充 `scripts/test.mjs` 中的用例；
- 若改动了弹窗样式或定位逻辑，请同时补充 `tests/visual.html` 中的断言。

---

## 许可

[MIT](LICENSE) © 2026 PrintfCow
