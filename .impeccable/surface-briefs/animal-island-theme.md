# Animal Island desktop theme

Mode: Operate. Target: plugins/themes/dsh-theme-animal-island/client.js.

## Direction contract

**THESIS** — 用户以真实桌面截图否定 1.1.0：整屏绿色发闷、层级太平、缺少动物岛的可爱与轻盈。本次讨论已明确选择「干净暖炭灰 + 少量薄荷色」，以这个选择替代旧海岛夜色。

**OWN-WORLD** — 近中性的暖炭灰阅读区、略深侧栏、递亮的中性气泡/输入/菜单表面；自然灰白主文字。薄荷集中于链接、选中和主要操作；状态及色板保留粉彩。Nunito/Noto Sans SC 默认栈、用户字体优先、宿主代码字体不变。

**STORY** — 用户先看清内容、输入位置与当前会话，再看到少量岛屿细节。圆润保留，整个阅读区不再被强调色染色。选中与悬停有区分，改变强调色也不能改变中性背景和文字。

**FIRST VIEWPORT** — 沿用截图中的左侧会话导航、中央内容、底部输入与右栏布局。侧栏最深，阅读区稍亮，输入/气泡更亮一阶；当前会话使用局部强调色洗染。主要操作与链接承担薄荷，底色和辅助信息保持灰阶。色板仍是44px圆润原生radio并显示当前名称。

**FORM** — 用户明确选择的暖炭灰动物岛适配。seed: none (unavailable). Code-led，在现有桌面插件中实现，不重建宿主页面或生成替代GUI。

**FINISH** — unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Evidence and verification limits

用户提供了 2560×1392 的 1.1.0 实际截图，作为失败依据；原图只读，未改动。新的配色仍无可调用的浏览器截图工具，不能拿旧截图或静态测试当新版本视觉验收。通过当前GUI的Inspect核验API/注册；检查代码、明暗兼容与偏好保护。新版最终观感需用户刷新桌面确认。未引入栅格素材。
