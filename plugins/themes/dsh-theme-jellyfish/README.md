# JELEE / 水母主题

**0.8.3** — 独立的 **JELEE 紫 / JELEE 蓝** 桌面外观。灵感来自 [JELEE 官网](https://jelee.net/)，为非官方本地主题。

在 **设置 → 通用 → JELEE 外观** 选择主题。紫色提供明亮紫粉、静态星星／流星与动态泡沫；蓝色提供PROFILE海蓝、鱼群、气泡与底浪。**宿主“浅色 / 深色 / 跟随系统”不会替你切换JELEE外观**，插件通过公开Theme服务固定宿主为dark；紫／蓝仅选择JELEE配色。停用时恢复之前或锁定期间最后请求的宿主外观。

Independent JELEE Purple / Blue appearances, available under Settings → General → JELEE appearance. Both JELEE appearances use the host's actual dark component branches while enabled. The previous or most recently requested host preference is restored on disable. Appearance and motion are saved on this device; this does not synchronize preferences to other devices.

## 本版行为

- 默认 **JELEE 蓝**，不根据系统或宿主明暗推断。消息气泡等组件固定采用宿主dark分支，避免浅色分支使用硬编码浅底造成白字不可读。通过插件自有状态与CSS标记驱动背景。Theme别名light/dark使用同一选中色；宿主明暗反向使用的neutral色阶单独映射，使代码底色／文字角色保持一致。
- 设置行只提供紫／蓝与背景动态；没有四角色强调色和圆角选择。主题各自固定强调色，统一柔和圆角，用户字体／字号仍优先。
- **52个气泡**，6–26px、14–28秒上浮，透明度0.42–0.74；中央区域降低至约一半强度。蓝色有 **10条游鱼**，22–40秒横游；紫色新增 **18颗静态星星、4组分段流星**。紫无海浪鱼，蓝无星星流星。窄窗减少动态气泡至28个。
- 背景动态支持 **开启动态 / 跟随系统 / 静止**。按用户明确要求，默认开启，包含系统减少动态效果时；选“跟随系统”才依据prefers-reduced-motion静止，设置行显示暂停原因；“静止”随时暂停。窗口隐藏时自动暂停，恢复可见时继续。强制配色模式始终隐藏装饰。
- 所有装饰aria-hidden且不接收点击；动画仅transform/opacity，不使用计时器或逐帧React更新。没有每帧重绘渐变或添加远程依赖。
- 官网JELEE字标调整为108px，细线水母旁加回9px HARNESS标签，保留18px字标高度、9px标签间距。新会话仍用同一水母原路径并服从宿主尺寸。
- 设置、对话框和普通面板继续采用不透明底色。Windows标题栏与原生按钮继续共用选中JELEE外观的不透明顶色。

## 保存与生命周期

- 当前设备／页面来源的localStorage键：`dsh-theme-jellyfish.appearance`（purple/blue）与`dsh-theme-jellyfish.motion`（on/system/off）。设置行说明保存范围；保存失败仍在当前窗口应用并显示提示。
- 旧accent/shape与Animal Island旧键不读写、不删除；只通过Theme.setTheme写入宿主外观偏好，未直接修改配置文件或安装目录。
- storage事件同步同一来源的其他窗口；只有当前插件的键改变才刷新。切换JELEE外观只替换同一个token层，切换动态不重新应用配色。
- 原有四Slot之外新增`settings.general.item / jellyfish-appearance`，不替换宿主Appearance行。Locale、token、Slot、媒体查询／visibility／storage监听器均随停用释放。
- Electron限定；普通浏览器无覆盖。使用原有模块加载器与Theme/Locale/Slots公开服务，无宿主私有IPC。

## 字体与资源

正文默认 Baloo 2 + Noto Sans SC，代码默认 Space Mono + Noto Serif SC；只设置default token，用户选定字体优先。Latin字体保持内嵌；CJK需从[字体目录](<fonts/NotoSansSC-Regular.ttf>)、[宋体文件](<fonts/NotoSerifSC-Regular.ttf>)安装，未安装则回退系统字体。JELEE外观设置行不修改字体安装或用户字体偏好。

字体许可：[Nunito](<LICENSE-Nunito.txt>)、[Baloo 2](<LICENSE-Baloo2.txt>)、[Space Mono](<LICENSE-SpaceMono.txt>)、[Noto CJK](<LICENSE-NotoCJK.txt>)。现有水母图形来自[naive-icons](https://github.com/guokaigdg/naive-icons)。官网JELEE图形另见[来源与权利说明](<THIRD-PARTY-NOTICES.md>)，不归入本仓库MIT许可。

## 验证与限制

`node --test theme.test.js` 覆盖22项，包括两套JELEE外观在宿主两种mode下的别名与代码角色一致、保存恢复、坏值／保存失败、跨窗口事件、动画on/system/off与隐藏窗口暂停、卸载、官网资产、面板不透明及品牌文字。

语法、JSON、资源与差异检查同时执行。测试不等于实际动画播放或像素验收；0.8.1尚无刷新后的实机截图／录像。0.7截图显示鱼位于代码静止回退位置，只支持“可能因减少动态而停止”的推断，不能据单张截图证明原因。设置行现在提供明确控制和状态。

官网式明亮白字是用户确认的审美选择，不声称整个画布符合WCAG AA；代码／菜单等稳定局部表面独立检查。

当前desktop profile已链接本目录，无需重新安装；刷新原桌面加载更新，不保证热更新。停用主题后恢复之前或最后请求的宿主外观偏好。

设计说明：[DESIGN](<DESIGN.md>)；官网资源说明：[THIRD-PARTY-NOTICES](<THIRD-PARTY-NOTICES.md>)。

## 0.8.1：固定深色组件效果

0.8.0只统一token与neutral色阶，但不能阻止宿主组件进入浅色CSS分支；用户截图已证实蓝色主题在宿主浅色下出现白底白字消息。因此插件现在在生命周期内订阅公开theme/change事件并用Theme.setTheme固定dark。用户点击Light/System会返回Dark，紫／蓝独立选择仍有效。

恢复键为`dsh-theme-jellyfish.hostAppearance`：首次保存原偏好，重载保留；锁定期间新的Light/System请求作为停用后恢复值。正常停用先取消监听，再恢复并删除恢复键。异常退出时宿主可能保留dark，但恢复键会供下次激活使用。此服务写入宿主共享外观偏好，不是仅CSS局部覆盖。

22项测试包括锁定、递归防护、重载恢复与存储不可用；无新版实机气泡截图，不将测试视为视觉验收。


## 0.8.3：透明正文裁切

顶部动作、新会话按钮和用户消息保留0.8.2的局部透明效果。用户拒绝0.8.2输入区的实色底板，本版完全移除该伪元素；输入框本身保持原样，其下方显示原来的渐变和海浪。

通过clip-path仅裁切ChatView正文根：在输入框左右边界内，从输入框顶部到底部不绘制会话内容。背景、动效、输入框、状态栏和右侧面板不被裁切。不添加有色覆盖层、不改变宿主DOM属性、布局或滚动位置。只读取已核对的ChatView结构与data-composer-card几何；宿主结构升级需复验。

输入区与正文尺寸变化、路由切换、滚动和窗口调整时合并到下一帧测量，不持续逐帧循环；自身样式更新被排除以避免观察循环。卸载取消ResizeObserver、MutationObserver、scroll/resize监听及待执行帧。找不到可见正文或输入框时不裁切。

24项回归测试通过，包含滚动坐标、宽度裁切、无重叠情况及资源清理。新版尚无实机截图，不宣称视觉验收通过。

用户消息气泡保留透明背景与1px白色半透明边框（border-l3），继续使用原有圆角和排版。
