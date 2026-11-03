---
name: "Animal Island — DSH desktop theme"
description: "1.4.0：奶油浅色与暖炭灰深色，八色强调全站生效；保留宿主功能与用户偏好。"
colors:
  night-sidebar: "#20201f"
  night-base: "#292928"
  night-layer-1: "#323230"
  night-layer-2: "#3b3a37"
  night-layer-3: "#44433f"
  night-ink: "#e9e8e4"
  night-ink-strong: "#f5f4ef"
  night-ink-dim: "#d0cfc8"
  night-ink-secondary: "#bdbdb5"
  night-hover: "#f5f4ef0f"
  day-base: "#f8f8f0"
  day-sidebar: "#f2ecda"
  day-ink: "#794f27"
  night-primary: "#8bd5ba"
  night-primary-hover: "#a4e2cc"
  day-primary: "#0f9d90"
  day-primary-hover: "#12b3a6"
  night-focus: "#ffcc00"
  night-elevated: "#4d4c47"
  day-focus: "#9a6f00"
  mint-tile: "#19c8b9"
  day-syntax-keyword: "#b03e55"
  day-syntax-string: "#3f753f"
  day-syntax-constant: "#3f55b5"
  night-syntax-keyword: "#e5a09a"
  night-syntax-string: "#b0cfa0"
  night-syntax-constant: "#adbdf0"
typography:
  body:
    fontFamily: '"Nunito", "Noto Sans SC", -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  title: { fontSize: "14px", fontWeight: 600, lineHeight: "22px" }
  label: { fontSize: "12px", fontWeight: 500, lineHeight: "20px" }
  helper: { fontSize: "12px", fontWeight: 400, lineHeight: "20px" }
rounded:
  day-xs: "6px"
  day-sm: "10px"
  day-md: "14px"
  night-xs: "12px"
  night-sm: "12px"
  night-md: "18px"
  lg: "20px"
  xl: "24px"
  panel: "28px"
  swatch: "50px"
spacing:
  row-gap: "12px"
  row-padding-block: "16px"
  swatch-gap: "10px"
  grid-padding: "4px"
components:
  accent-row: { padding: "16px 0" }
  accent-swatch: { rounded: "{rounded.swatch}", padding: "0", height: "44px", width: "44px" }
---

# Design System: Animal Island — DSH desktop theme

## Overview

**Creative North Star: "干净暖炭灰 + 少量薄荷"**

本记录对应动物岛插件 1.4.0 source，不是其他插件或宿主的组件规范。用户以真实截图否定 1.1.0 的整屏苔绿：发闷、层级平、不轻盈；当前方向已选择暖炭灰，不再延续旧夜色。浅色保留奶油纸面与暖棕文字，深色以中性表面递亮、灰白文字和局部粉彩组织阅读。1.4.0 让八色覆盖浅色气泡、选区、业务 chip、侧栏选中态与信息表面，并把深色弹层抬到 layer 3 之上。

**Key Characteristics:**
- 中性底色和文字独立于强调色；薄荷默认，八色选择保留。
- 仅 Electron 桌面应用主题，不替换宿主布局、控件或工作流。
- 用户文本字体优先，代码字体不变；自有设置使用原生 radio。
- 代码块语法色由主题 token 统一控制；工具栏填充始终是低透明度背景，不能写成文字色。
- 源码与静态检查不等于新版视觉验收。

依据：[产品](<PRODUCT.md>)、[方向契约](<.impeccable/surface-briefs/animal-island-theme.md>)、[中性色阶与表面](<plugins/themes/dsh-theme-animal-island/client.js#L73-L240>)、[token 映射](<plugins/themes/dsh-theme-animal-island/client.js#L393-L554>)、[1.4.0 复核记录](<.impeccable/review/animal-island-1.4.0.md>)及[插件说明](<plugins/themes/dsh-theme-animal-island/README.md>)。

## Colors

深色侧栏最深，阅读区、layer-1/2/3 逐级变亮；overlay/menu/toast/tooltip 使用 elevated `#4d4c47`，高于 layer 3；module 为 layer-1。neutral 与 neutral-bluish 原始色阶也改为暖炭灰，直接消费 primitive 的宿主区域不能残留绿底。主文字、强文字、dimmed、secondary 使用 frontmatter 的四级灰白；描边以强文字色的低透明度构成。深色菜单不透明，状态保留粉彩绿/黄/红。

默认品牌/hover 见 frontmatter；色板原色不是品牌文字色。品牌、链接、business-primary 跟随当前强调色，dimmed 为品牌 45% 与 base 混合。深色选中/active 为 `color-mix(in srgb, brand 18%, transparent)`；普通 hover 使用中性 `night-hover`，不能误写成薄荷 hover。专用 accent-hover 仍为深色品牌 12% / 浅色品牌 16% 与 transparent 混合。

深色文本选择为品牌 24% 与 transparent 混合；浅色为品牌 28% 与 transparent 混合。浅色 active wash 为品牌 14% 与 transparent，侧栏选中态为品牌 12% 与 base；普通 hover 仍保持中性。深色 static-deepseek 的 50/100/200/300/400/450/500 用品牌 12/24/42/65/85/95/100% 混入强文字，600/700-delete/800/900/950 用品牌 78/55/32/18/10% 混入 base；浅色 static-deepseek 由 tile 10/20/38/58/78/100% 混入 base（450 为 tile 原色），500 为品牌，600–950 用 82/68/55/35/22% 品牌混入黑作为深色停靠。thinking 渐变保留源码内容遮罩，不新增装饰渐变。

1.3.0 的工具栏填充改为 4–14% 中性洗染：浅色用暖棕 alpha，深色用暖白 alpha；文字保持 `label-primary`，因此 fill 不能写成不透明灰。代码语法色覆盖宿主 9 个 `--shiki-token-*`，全部在代码底上达到 4.5:1：

| Token | Light | Dark |
| --- | --- | --- |
| constant | `#3f55b5` | `#adbdf0` |
| string | `#3f753f` | `#b0cfa0` |
| comment | `#7c6d58` | `#a7a79e` |
| keyword | `#b03e55` | `#e5a09a` |
| parameter | `#a85432` | `#e2ad91` |
| function | `#7d45b5` | `#c5b0e4` |
| string-expression | `#356b35` | `#c5dfb8` |
| punctuation | `#665946` | `#bdbdb5` |
| link | `#0b7f75` | `#8bd5ba` |

设置行当前名称与说明使用自有 `--aia-current`（浅 `#6f614d` / 深 `#d0cfc8`）与 `--aia-hint`（浅 `#7c6d58` / 深 `#bdbdb5`），不直接消费偏弱的 `label-secondary`。浅色焦点环由 `#e0a800` 改为 `#9a6f00`，在 base 上从 2.01:1 提到 4.23:1；深色保持 `#ffcc00`。

**The Neutral Stays Neutral Rule.** 切换强调色只影响指定品牌与交互 token，不染色中性表面、文字和普通 hover。

**The Accent Covers the Site Rule.** 浅色 static-deepseek、气泡、气泡高亮、业务 chip、侧栏 badge/选中态、信息表面、选区与 active wash 都必须由品牌派生；不能留下固定 MINT。深色 elevated 表面必须高于 layer 3。

## Typography

默认文本栈见 frontmatter；内嵌 Nunito Latin 可变子集，中文回落到已安装字体。仅写默认文本字体 token，用户设置优先，不写代码字体。title/label/helper 只描述自有设置标题、当前颜色名及说明；说明最大宽度 65ch，不补造宿主正文或 display 字阶。

## Layout

保留宿主左侧导航、中央阅读/输入与右栏。自有 row 为纵向 flex，gap 12px、padding 16px 0；标题与名称按 baseline 对齐并换行，gap 4px 16px。色板 flex-wrap、gap 10px、padding 4px，单项固定 44×44px，不压缩触点；没有新增断点。

## Elevation & Depth

明度色阶负责主层级，阴影辅助浮层。深色阴影基色改为 `rgba(20, 19, 17, …)`，浅色仍用暖棕；精选精确值见 [sidecar](<.impeccable/design.json>)。radio 不使用游戏主按钮厚脚阴影。色板 hover/active 位移 −1/+1px，过渡 0.2s、`cubic-bezier(.4, 0, .2, 1)`；reduced-motion 下取消过渡与位移。

## Shapes

宿主圆角 token 见 frontmatter，corner-shape 为 `superellipse(1.3)`；不保证每个宿主控件都消费它。色板显式使用 round 与 50px radius，44px 外框含 2px 边框；选中内点为 10×10px content-box、2px 描边、50% radius，不能将 10px 误报为外径。

## Components

唯一自有可见控件是 `settings.general.item` 中的强调色 row：八个 label 包裹原生 radio，当前名称 `aria-live="polite"`，radiogroup 关联标题与说明。标题用 `label-primary`，当前名称与说明分别用 `--aia-current`、`--aia-hint`。未选背景为样本 82% 与 base 混合；选中用主文字边框及 base 内点，不只靠颜色。focus outline 为 2px、offset 3px：浅色深金 `#9a6f00`，深色 `#ffcc00`；forced-colors 恢复原生 input 并隐藏装饰点。侧栏、按钮、菜单、输入框等均属宿主，只消费主题 token，不在 sidecar 发明它们的组件实现。

存储键 `dsh-animal-island.accent` 与八色 id 不变，无效/不可用存储回落 mint；字体/外观偏好不改。停用移除 token、样式与设置项，不删除偏好。sidecar 仅留一个自有 radio 片段，依赖继承的主题变量，不模拟持久化与名称更新。

## Do's and Don'ts

- **Do** 保留中性层级、八色选择、浅色兼容、用户字体与原生 radio 语义。
- **Do** 区分品牌 18% 选中态与中性普通 hover，保留焦点、forced-colors 和 reduced-motion 分支。
- **Do** 把工具栏、菜单、选中态等填充 token 保持为低透明度背景，文字色单独读取 `label-*`。
- **Do** 让浅色 accent 覆盖气泡/选区/业务 chip/侧栏选中态，并让深色 overlay/menu/toast/tooltip 高于 layer 3。
- **Don't** 恢复整屏苔绿、替换宿主控件或扩展到其他插件。
- **Don't** 把 `button-tool-bar-fill` 这类 fill token 当 foreground 做对比度检查或写不透明值。
- **Don't** 让浅色气泡、选区、业务 chip 或侧栏选中态固定为薄荷；它们必须读当前品牌。
- **Don't** 把静态测试、旧截图或 source 完成写成新版视觉通过。

证据边界：1.4.0 记录 Node 测试 11 过、总数 140 token。工具栏 fill、设置行 ink、焦点环、9 个 Shiki token、浅色 accent 消费者和深色 elevated 表面均做了静态检查。live Theme 已列出 1.4.0 新增 token（140 个），设置 slot 仍 active，确认 1.4.0 client JS 已加载；但当前进程没有 UI 导航/自动截图验收能力，对比图仍是 token 级生成图。用户截图是被否定的 1.1.0，不是 1.4.0 验收证据；新版实际层级、菜单合成、焦点、窄窗口及最终观感仍需用户实际查看确认。
