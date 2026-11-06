# Jellyfish 0.5.0 — historical source verification

> **实际视觉验收失败（2026-11-06）**：用户以2560×1392实机截图明确拒收。下面仅是历史源码验证，不再作为当前设计完成依据。0.5.1针对整列遮罩、固定顶部装饰画幅和底浪被遮挡作修订；新版本仍待真实截图复验。

日期：2026-11-06。范围：水母主题，不适用于 Animal Island 或其他插件。

## 用户确认

按用户提供的 JELEE 双模式参考图重构。用户明确选择更贴近参考图的全白正文，并接受加深内容衬底。紫粉 / 深海蓝外框、白描边、星芒气泡斜线、鱼群与底浪属于设计目标；宿主布局和已保存偏好不变。

## 已执行检查

- `node --check plugins/themes/dsh-theme-jellyfish/client.js`：通过。
- `node --check plugins/themes/dsh-theme-jellyfish/index.js`：通过。
- `node --check plugins/themes/dsh-theme-jellyfish/theme.test.js`：通过。
- `node --test plugins/themes/dsh-theme-jellyfish/theme.test.js`：最终主代理运行 22 / 22 通过，0 失败，137.2957 ms。
- 数值测试包括 4 角色 × 2 模式 × 5 背景（四个渐变停靠点及保守纯白）× 11 阅读表面 × 12 文本角色，共 5,280 组合，均 ≥ 4.5:1。另检查代码9色、状态底色与白字、focus、storage和卸载。测试并非浏览器渲染。
- `git diff --check`：通过；部分文件仅有 Git 的 LF→CRLF 提示。
- Impeccable `detect --json client.js`：输出 `[]`。该次检测后仅补充状态chip颜色、品牌字体与文档，不将检测解释为新版像素验收。
- manifest / locale JSON、入口资源存在、bundle row 名称、图标大小静态检查通过。
- lxml 校验 SVG XML、渐变和水母路径通过；不等于实际图标已渲染。
- 新字标来自现有 OFL Noto Serif SC：仅 `jellyfish` 字形，重命名 Jellyfish Display，2940-byte WOFF，字体表读回与所需字形、WOFF header/length通过。
- 与 HEAD 比较，原 NUNITO_WOFF2 / BALOO2_WOFF2 / SPACE_MONO_WOFF2 内嵌数据保持不变。

## 当前 profile 证据

读取当前运行环境得到 desktop profile。管理器显示 Jellyfish 已启用、通过 link 指向本仓库；真实链接路径与源码目录一致，链接下 manifest 为 0.5.0，入口/locale/icon资源可读。本次没有执行 profile 安装/修改、切换主题、启动替代服务器或重启宿主。

Client Inspect 在修改前观测到 jellyfish-skin、品牌与hero Slot active。这证明已有插件注册，不证明 0.5.0 客户端代际已刷新。未确认同一 checkout 的 dev:web watcher，不承诺热更新。

## 独立复核

独立 source reviewer 初判 FIX：系统衬线作为唯一 display 字体，以及 README 指向未完成的插件 DESIGN 文档。字体已修为内嵌许可子集，reviewer 定点复核确认 @font-face 与品牌400权重引用连通，系统字体仅 fallback，撤销该问题。设计文档及 manifest 分发条目也经独立复核关闭缺失项；原 documenter 失败后，替代代理补齐插件内 design.json 并同步最终测试报告。主代理已读回设计文档和 sidecar，验证 JSON、schemaVersion=2、分发条目、README/DESIGN 的全部本地链接及最终 git diff --check。

最终独立复核结论：**source-only ready / RECAPTURE（真实视觉待验收）**。原两项源级收尾问题已关闭，不将此结论扩写成视觉 SHIP。

源码的 .82 阅读衬底会压低装饰强度：白星芒与深蓝鱼群在列下的有效透明度分别约 .126 / .068。不能以此直接宣称视觉不合格，也不能为了亮度牺牲已确认的白字阅读策略。

## 未验证与后续验收

**没有当前桌面的截图或浏览器控制，未作视觉验收。** CSS-module 后缀命中、真正的宿主层叠、背景装饰辨识度、按钮前景、代码长行、侧栏/右栏、窄窗口、键盘焦点、forced-colors，以及真实停用后的恢复，需刷新现有桌面应用后实测。

此记录只支持 source-ready 与静态回归通过，不支持“参考图复现通过”“新版界面已生效”或“无障碍完整验收通过”。没有创建 mock 页面/截图来替代实际渲染。
