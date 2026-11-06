---
name: "Jellyfish — DSH desktop theme"
description: "0.8.4：独立JELEE紫／蓝、可见动效、协调JELEE HARNESS品牌，插件页Header去掉深色底板。"
colors:
  day-lavender: "#9191f5"
  day-lilac: "#b49df2"
  day-orchid: "#d3a7f1"
  day-pink: "#ebaff0"
  shade-mix-anchor: "#000000"
  brand-shadow: "#29114966"
  night-blue: "#347ccf"
  night-cobalt: "#24589e"
  night-ocean: "#102d63"
  night-midnight: "#000a32"
  day-reading: "#b49df2"
  night-reading: "#173e6a"
  day-layer-1: "#9b87cb"
  night-layer-1: "#16385f"
  white-ink: "#ffffff"
  night-dimmed: "#f1f6ff"
  night-secondary: "#e5efff"
  jelee-tile: "#7fd6ff"
  yoru-tile: "#ff9ecb"
  kiwi-tile: "#a98ff5"
  mei-tile: "#7fd6a8"
  focus: "#fff5a8"
typography:
  display: { source: "jelee-logo.svg", width: "108px", height: "18px" }
  body: { fontFamily: '"Baloo 2", "Noto Sans SC", -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }
  code: { fontFamily: '"Space Mono", "Noto Serif SC", "SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, monospace' }
rounded:
  classic-preview: "6px"
  round-preview: "9px"
spacing:
  row-gap: "12px"
  swatch-gap: "10px"
  shape-gap: "8px"
  controls-padding: "4px"
  brand-gap: "7px"
components:
  wordmark: { source: "jelee-logo.svg", alt: "JELEE" }
---

# JELEE 0.8.1

用户以0.7实机截图要求四项：动态可见、装饰更丰富、紫／蓝独立于宿主明暗、协调水母+JELEE并加回HARNESS。本轮保留颜色和不透明面板修复，不重做画布。

## 独立外观

本地appearance状态purple/blue，默认blue；数据由settings.general.item的原生radio控制。颜色通过Theme.overrideTokens将别名两列投影为选定值，neutral primitives按宿主light/dark使用的相反索引适配；CSS全部以插件自有.jf-skin[data-jf-appearance]标记驱动，不读取或写入宿主data-ds-dark-theme。0.8.1通过公开setTheme固定dark组件分支；不直接操纵DOM明暗属性。

## 动效与静态装饰

52泡、10蓝鱼、18紫星、4紫流星；保留原画布静态装饰及蓝色底浪。气泡14–28s，鱼22–40s；无逐帧JS。窗口隐藏暂停。动效on/system/off可选，明确用户要求动态所以默认on；system遵守prefers-reduced-motion，off暂停。不得把系统reduce静止误报成动画已实际播放。强制配色始终隐藏装饰。

## 品牌与设置

官网字标108×18、HARNESS 9px/700，标签1px白边、4px角、与字标间距9px，保留水母路径与宿主尺寸。设置通过两个有文字解释的原生radio和motion select，焦点可见，中英文文案；保存失败role=alert、动效状态role=status。

存储键dsh-theme-jellyfish.appearance与.motion，旧accent/shape不改；停用清理全部监听器和token/Slot/locale。用户字体字号优先。

## 证据边界

22项服务边界和结构测试覆盖独立模式、动效控制、状态保存和清理，非视觉验收。0.8无实机截图／录像。0.7单帧中鱼位于静止回退坐标，因此减少动态是候选原因，未直接读取用户媒体查询结果，不把推断当确诊。

## 组件模式锁定修复

用户实机证据显示0.8.0蓝色主题在宿主浅色下仍有白底白字气泡，原先独立配色的实现不完整。0.8.1在ctx.effect中订阅theme/change，非dark时调用公开Theme.setTheme(dark)，pending状态避免重复请求；停用先退订，再恢复记录偏好。恢复键跨重载保存，正常停用删除。紫／蓝颜色、动效及品牌不变。

## 0.8.2 局部透明

顶部conversation.session.header.actions内button、新会话button[class*=_newSession]、官方data-message-bubble局部透明；按钮保留border与hover。输入区不透明且在InputBar root（直接拥有data-composer-card和data-composer-dock）上添加负层伪元素遮罩，宽度使用宿主--dsh-composer-side-clearance与--dsh-composer-card-max-width，top0、bottom-8px覆盖状态栏；自身isolation，不拦截点击。只在composerSeat内应用，不影响hero。无视觉通过声明。

## 0.8.3 替代0.8.2实色遮罩

用户拒收实色底板，要求只遮正文并保留背景。已删除InputBar伪元素和isolation。TranscriptCutout只测量主会话ChatView根与输入框矩形，在自有style内输出正文根clip-path底部凹口，背景与输入控件不受影响。窗口/滚动/resize/节点替换按帧合并测量，清理全部观察器与监听，排除自身style变化。24测试通过；实机效果待确认。此前0.8.2遮罩描述为已被替代的历史设计。

用户消息气泡保留透明背景与1px白色半透明边框（border-l3），继续使用原有圆角和排版。

## 0.8.4 插件页 Header 去底板

宿主插件管理页的 `[data-plugin-bar]` 用 `::before` 铺一条 `background: var(--dsw-alias-bg-base)` 的全宽不透明横带，滚动压缩时另有 `::after` 细分隔线。JELEE 将该 token 映射为深蓝／紫后，横带与满屏渐变割裂，视觉上是一块未适配的深色 Header；用户确认只去底板、保留标题与功能按钮。

在自有样式表中以 `body:has(.jf-skin)` 限定，隐藏这两个伪元素（均为绝对定位，不影响宿主高度测量、测量克隆与滚动压缩），不改 `[data-plugin-bar]`、标题、说明、刷新与添加插件按钮的显示或几何。选择器只用宿主稳定的 data 属性，不依赖会随构建重哈希的 CSS module 类名；样式表随插件停用释放。紫／蓝两套外观同样生效，不改任何主题 token。25项测试新增一项守住「只去底板、控件保留」；无新版实机截图，不作视觉通过声明。
