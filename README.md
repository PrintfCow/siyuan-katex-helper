# KaTeX Formula Helper · siyuan-katex-helper

> A [SiYuan](https://b3log.org/siyuan/) plugin that makes writing KaTeX formulas much less painful.

[![CI](https://github.com/PrintfCow/siyuan-katex-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/PrintfCow/siyuan-katex-helper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A5%203.8.0-3575f0.svg)](https://b3log.org/siyuan/)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)

Built and verified against **SiYuan 3.8.x** (3.8.3).

中文文档：[README_zh_CN.md](README_zh_CN.md)

---

## Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Settings](#settings)
- [Project layout](#project-layout)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Packaging & releasing](#packaging--releasing)
- [FAQ](#faq)
- [Compatibility](#compatibility)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 1. No more "select all" when the formula editor opens via arrow keys

**The problem.** After `$x^2$` becomes an inline formula, putting the caret next to it and pressing
`←` / `→` opens SiYuan's formula editor — with **everything selected**. To change a single character
you first have to deselect.

**Root cause** (verified against the shipped 3.8.3 bundle): the core handler calls
`range.selectNode(mathElement)`, and when the panel is shown it calls `textarea.select()`.

**The fix.** The text is no longer selected; the caret lands inside the formula:

| Action | Caret position |
| --- | --- |
| Caret is **after** the formula, press `←` | end of the formula |
| Caret is **before** the formula, press `→` | start of the formula |

Opening the editor with a **mouse click** keeps SiYuan's original select-all behaviour by default
(handy for retyping), and can be changed in the settings.

### 2. LaTeX command completion

Type **plain English letters** inside the formula editor — **no leading `\` needed**:

- **998 commands**, generated from KaTeX's own source and merged with a curated snippet table;
- prefix / substring / fuzzy matching; `↑` `↓` to choose, `Enter` to confirm, `Esc` to dismiss, or click;
- candidates are **rendered by KaTeX** with the matched letters highlighted;
- the popup **only ever appears directly above or below the editor panel and never covers it**;
- the popup is **self-contained** — its own background, border and shadow, with content clipped
  inside the box, so list text can never "escape" the menu; long lists scroll internally;
- braces/brackets are **auto-filled** and the caret is placed **inside the first pair**;
- `Tab` then **jumps to the next pair**; after the last one, `Tab` **jumps out of the snippet**;
- `Shift+Tab` goes back; insertion preserves the textarea's native undo (`Ctrl+Z`).

| Type | Result | Tab order |
| --- | --- | --- |
| `fra` | `\frac{}{}` | `{}` → `{}` → out |
| `sum` | `\sum_{}^{}` | `_{}` → `^{}` → out |
| `int` | `\int_{}^{}` | `_{}` → `^{}` → out |
| `sqr` | `\sqrt{}` | `{}` → out |
| `pmat` | `\begin{pmatrix} & \\ & \end{pmatrix}` | 4 stops |
| `alp` | `\alpha` | inserted directly |

---

## Installation

### From a release (regular users)

1. Download `package.zip` from [Releases](https://github.com/PrintfCow/siyuan-katex-helper/releases);
2. Unzip it to get the `siyuan-katex-helper/` folder;
3. Move that folder into `<workspace>/data/plugins/` (e.g. `~/SiYuan/data/plugins/`);
4. Restart SiYuan and enable **KaTeX Formula Helper** under
   **Settings → Marketplace → Downloaded**.

> ⚠️ The folder name must match the `name` field in `plugin.json` (`siyuan-katex-helper`) exactly,
> otherwise SiYuan silently ignores the plugin.

### From source (developers)

```bash
git clone git@github.com:PrintfCow/siyuan-katex-helper.git
cd siyuan-katex-helper
npm install
npm run make-install      # build + package + install into the SiYuan workspace
```

The workspace is auto-detected (`~/SiYuan`, `~/Documents/SiYuan`, …) or can be given explicitly:

```bash
node scripts/install.mjs --workspace /path/to/SiYuan
SIYUAN_WORKSPACE=/path/to/SiYuan npm run make-install
```

### Development mode

```bash
npm run make-link     # symlink <workspace>/data/plugins/<name> → ./dist
npm run dev           # rebuild on change
```

---

## Usage

### Triggering completion

Open the formula editor (inline `$…$` or block `$$…$$`) and type any English letter — the list
appears immediately and filters as you keep typing.

- **No `\` required**: both `alp` and `\alp` match `\alpha`;
- ranking: exact → prefix → substring → fuzzy (can be disabled);
- bracket-aware entries: `left(`, `left[`, `left{` each have their own delimiter snippet.

### Key bindings

| Key | Action |
| --- | --- |
| letters | open / filter the suggestion list |
| `↑` `↓` | move the selection |
| `Enter` | accept the selected suggestion |
| `Tab` | jump to the next brace while a snippet has unfilled braces; accept a suggestion when the list is open |
| `Shift+Tab` | jump back to the previous brace |
| `Esc` | close the list / leave the tab-stop session |
| click | accept a suggestion |

> The `Tab` priority is deliberate: typing letters inside a brace opens the list, so if `Tab`
> accepted a suggestion the user could no longer tab through the braces.
> While a snippet still has unfilled braces, **`Tab` always navigates** — use `Enter` to accept.

---

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Don't select all when opened via arrow keys | on | the core fix |
| Caret position after deselecting | follow arrow key | or pin to start / end |
| Also deselect when opened by mouse click | off | keeps SiYuan's "click to select all and retype" |
| Enable LaTeX completion | on | |
| Also complete in math blocks | on | when off, only inline `$…$` is completed |
| Minimum letters before completing | 1 | |
| Maximum suggestions | 50 | |
| Enable fuzzy matching | on | |
| Show KaTeX preview | on | |
| Enter confirms a suggestion | on | |
| Tab confirms a suggestion | on | brace navigation still wins while braces are unfilled |
| Tab after the last brace | jump out of the snippet | or close the formula editor |

---

## Project layout

```
siyuan-katex-helper/
├── .github/workflows/
│   ├── ci.yml                    # typecheck / tests / build / upload artifact
│   └── release.yml               # publish package.zip on tag push
├── i18n/                         # plugin UI strings
│   ├── en_US.json
│   └── zh_CN.json
├── scripts/
│   ├── lib/browser.mjs           # test infra: locate SiYuan/browser, static server, headless run
│   ├── build.mjs                 # bundle into dist/ and copy static assets
│   ├── package.mjs               # zip dist/ into package.zip
│   ├── install.mjs               # copy or symlink into the SiYuan workspace
│   ├── gen-latex-db.mjs          # generate the command database from KaTeX source
│   ├── gen-icon.mjs              # dependency-free icon.png / preview.png generator
│   ├── test.mjs                  # logic tests (no browser)
│   ├── e2e.mjs                   # end-to-end tests (headless browser)
│   └── visual.mjs                # layout regression tests (headless browser + screenshot)
├── src/
│   ├── index.ts                  # plugin entry: lifecycle, event wiring, settings panel
│   ├── panel.ts                  # formula panel detection + caret-adjacency test
│   ├── completion.ts             # completion engine: search, popup, positioning, tab stops
│   ├── latex-db.ts               # database assembly (generated data + curated snippets + ranking)
│   ├── latex-db.generated.ts     # generated — do not edit by hand
│   └── snippet.ts                # snippet parsing ($1 / $2 tab stops)
├── tests/
│   ├── harness.html              # e2e page (replicates SiYuan's real DOM structure)
│   ├── loader.js                 # loads the bundle exactly the way SiYuan does
│   └── visual.html               # layout page (with hit-testing probes)
├── dist/                         # build output (gitignored) — a complete, installable plugin folder
├── plugin.json                   # plugin manifest
├── index.css                     # plugin styles (shipped with the package)
├── icon.png / preview.png        # plugin icon and marketplace preview
├── package.json / tsconfig.json
├── CHANGELOG.md / LICENSE
└── README.md / README_zh_CN.md
```

---

## Architecture

### Verified facts about SiYuan 3.8.3

| Fact | Consequence |
| --- | --- |
| The formula editor is the `Toolbar`'s `subElement`: `div.protyle-util` containing `textarea.b3-text-field` | how the panel is found |
| The panel title (`.resize__move`) is `window.siyuan.languages["inline-math"]` or `languages.math` | how math panels are told apart from Mermaid / HTML / embed panels |
| The panel is `position: fixed`, so `offsetParent` is always `null` | visibility must be tested with `getClientRects()` |
| The core editor binds `keydown` in the **bubble** phase on `protyle.wysiwyg.element` | a capture-phase listener can run first |
| Core **never checks `event.defaultPrevented`** | you must `stopPropagation()` / `stopImmediatePropagation()`; `preventDefault()` alone does nothing |
| Opening the panel runs `textarea.select()` | the direct cause of "select all" |
| `--b3-menu-background` is defined **only in theme CSS**, not in `base.css` | the popup must ship its own fallback background or it becomes transparent |

### Module responsibilities

- **`src/index.ts`** — plugin entry. Registers **capture-phase** `keydown` / `input` / `focusin` /
  `mousedown` on `window` to intercept keys before the core; implements the caret fix and settings.
- **`src/panel.ts`** — pure predicates: find the visible formula panel, classify it, and decide whether
  the caret sits next to an inline formula (a port of SiYuan's `getAdjacentInlineMath()`, including
  `<wbr>` and zero-width-space handling).
- **`src/completion.ts`** — the engine: trigger-word detection, search, popup rendering/positioning,
  and the tab-stop session (with diff-based position correction as the user types).
- **`src/latex-db.ts`** — database assembly and ranking (exact > prefix > substring > fuzzy).
- **`src/snippet.ts`** — turns `\frac{$1}{$2}` into plain text plus tab-stop offsets.

### Lifecycle of one completion

```
user types "a" in the textarea
  └─ input event (capture) → completion.onInput()
       ├─ adjustTabStops(): shift tab stops by the edit delta when a session is active
       └─ refresh(): read the trigger word → searchItems() → render → position()
            └─ clamp max-height first, measure the real height, then decide above/below the panel
user presses Enter
  └─ keydown (capture) → completion.handleKeyDown()
       ├─ preventDefault + stopPropagation + stopImmediatePropagation (core never sees the key)
       └─ accept()
            ├─ parseSnippet() → plain text + tab stops
            ├─ execCommand("insertText") (keeps native undo)
            └─ caret moves to the first tab stop, session opens
user presses Tab
  └─ tab-stop navigation wins while braces are unfilled
       ├─ another brace → move the caret there
       └─ last brace → jump out of the snippet (configurable to close the editor)
```

---

## Development

### Requirements

- Node.js ≥ 18 (developed on 20 / 24)
- npm (a `package-lock.json` is committed; CI uses `npm ci`)
- Optional: a local SiYuan install (3.8+) for the browser-based test suites

### Commands

```bash
npm install            # install dependencies

npm run build          # bundle into dist/
npm run dev            # rebuild on change
npm run package        # build + create package.zip

npm run typecheck      # TypeScript type check
npm test               # logic tests (no browser)
npm run test:e2e       # end-to-end tests (headless browser)
npm run test:layout    # layout regression tests (headless browser + screenshot)
npm run test:all       # everything above

npm run make-link      # symlink dist/ into the SiYuan workspace
npm run make-install   # build + package + copy into the SiYuan workspace

npm run gen:db         # regenerate the command database from KaTeX source
npm run gen:icon       # regenerate the icon
```

### Contribution guidelines

- Source is TypeScript with `strict` enabled; bundling is done by esbuild (no `.d.ts` output).
- The bundle **must be CommonJS** with `siyuan` kept external — SiYuan loads plugins via
  `window.eval("(function anonymous(require,module,exports){…})")`.
- Comments and log messages are written in Chinese; identifiers are English.
- `src/latex-db.generated.ts` is generated — edit `scripts/gen-latex-db.mjs` and regenerate instead.

---

## Testing

| Command | Assertions | Covers |
| --- | --- | --- |
| `npm test` | 24 | database integrity, ranking and highlighting, snippet parsing and tab-stop offsets |
| `npm run test:e2e` | 36 | full interaction with the real bundle: arrow-key fix, popup, `↑↓`, `Enter`, brace auto-fill, `Tab` navigation, non-math panels, teardown |
| `npm run test:layout` | 27 | popup layout in four panel positions: no overlap, inside the viewport, opaque background, clipped content, row width, no painted content outside the box |

The browser suites do **not** mock the plugin. They:

1. load `dist/index.js` **exactly the way SiYuan does**
   (`window.eval("(function anonymous(require,module,exports){…})")`);
2. dispatch real keyboard/input events into a page that replicates SiYuan's real DOM structure
   (including `<wbr>`, zero-width spaces and the `.protyle-util` panel);
3. load SiYuan's real `base.css` and a real theme stylesheet for the layout suite.

The strongest assertion probes all four edges of the popup box with
`document.elementFromPoint`: hit-testing shares the same clipping rules as painting, so
"no list row is hit outside the box" is equivalent to "text cannot be painted outside the menu".

### Why the browser suites need a local SiYuan install

They deliberately use SiYuan's **real stylesheets and theme variables** instead of an approximation —
otherwise the tests would only validate an assumption about SiYuan. The scripts probe
`/opt/SiYuan/resources`, `/usr/lib/siyuan/resources`,
`/Applications/SiYuan.app/Contents/Resources`, and can be pointed anywhere:

```bash
SIYUAN_RESOURCES=/path/to/siyuan/resources npm run test:layout
SIYUAN_THEME=midnight npm run test:layout     # verify another theme
CHROME_BIN=/usr/bin/google-chrome npm run test:e2e
```

When no SiYuan install is found the suites **skip with a clear message** (exit code 0) rather than
pretending to pass.

---

## Packaging & releasing

```bash
npm run package        # → package.zip
```

`package.zip` contains the plugin folder itself, ready to drop into `<workspace>/data/plugins/`.

Release flow:

1. bump `version` in `plugin.json` and `package.json`, add a `CHANGELOG.md` entry;
2. commit and tag: `git tag v1.0.0 && git push origin main --tags`;
3. `.github/workflows/release.yml` runs the type check and logic tests, builds, packages, and attaches
   `package.zip` to the GitHub Release.

The SiYuan marketplace reads `plugin.json` from the repository root and downloads `package.zip`
from the release, so this flow is directly marketplace-compatible.

---

## FAQ

**The plugin doesn't show up under "Downloaded".**
The folder name must equal the `name` in `plugin.json` (`siyuan-katex-helper`), and your SiYuan
version must be ≥ `minAppVersion` (3.8.0).

**I changed the code but nothing happens.**
SiYuan only loads `index.js` when the plugin is enabled — toggle the plugin off and on, or restart.

**The suggestion list never appears.**
Check, in order: "Enable LaTeX completion" is on; the caret is inside the **formula editor**
(typing letters in the document body does nothing); "Also complete in math blocks" if you are in a
`$$…$$` block; and the minimum-letters setting.

**`Tab` doesn't jump to the next brace.**
Make sure the snippet still has unfilled braces. If "Tab confirms a suggestion" is off, `Tab` does
nothing while the list is open. The behaviour after the last brace is configurable.

**The KaTeX previews are blank.**
Previews need `window.katex`; SiYuan normally loads it when rendering a formula. If it is missing the
plugin degrades to no previews — completion and insertion still work.

**Arrow keys still select everything.**
Verify the setting is on. The fix only triggers when the caret sits **immediately next to** an inline
formula (separated only by `<wbr>` or zero-width characters) — the same condition SiYuan uses to open
the editor.

---

## Compatibility

| Item | Notes |
| --- | --- |
| SiYuan | `minAppVersion: 3.8.0`; fully verified on 3.8.3 |
| Platforms | desktop / mobile / browser (no Electron-specific APIs) |
| Themes | follows theme variables; the popup ships fallback colours so it is never transparent |
| Dependencies | zero runtime dependencies; `siyuan` is a types-only package provided at runtime |

---

## Known limitations

- Completion only triggers inside the **formula editor**. SiYuan converts `$…$` in the kernel
  (`protyle.lute.SpinBlockDOM()`), so there is no LaTeX input state in the document body.
- `\begin{}` / `\end{}` are not mirrored tab stops — type the environment name (`pmat`, `cases`,
  `aligned`, …) and both ends are filled in.
- The database is generated from KaTeX 0.18 while SiYuan bundles a slightly older KaTeX; a few very
  new commands may not render there (insertion still works).
- Multi-cursor / multi-selection is not handled: completion stays hidden while the selection is not
  collapsed.

---

## Contributing

Issues and pull requests are welcome.

- make sure `npm run test:all` is green;
- when adding or changing snippets, extend the cases in `scripts/test.mjs`;
- when changing popup styles or positioning, extend the assertions in `tests/visual.html`.

---

## License

[MIT](LICENSE) © 2026 PrintfCow
