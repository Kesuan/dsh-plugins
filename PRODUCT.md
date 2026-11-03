# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

DSH 桌面客户端用户，在会话、工具输出和设置中长时间阅读与编码。

## Product Purpose

本仓库提供独立安装的 DSH 插件。本次工作只改动物岛主题：改善深色模式的可读性、层级和夜间观感，不改变宿主工作流。

## Capabilities and Constraints

- 使用现有 Cordis Client Theme token 层与设置 Slot，不替换宿主布局或控件。
- 用户已确认：重点重做深色模式；保留浅色整体风格、八种强调色、Electron 桌面限定及已保存的字体/外观设置。
- 强调色保留原 localStorage key；停用主题应移除其 token、样式与设置项。
- 不改其他主题、会话管理插件或 DSH 安装目录；不启动替代 Web 服务器。
- 当前工具不提供浏览器控制，截图与实际渲染的验收不能以静态测试代替。

## Brand Commitments

用户指定 animal-island-ui-style Skill 与上游 animal-island-ui 设计语言。保留圆润字形、温暖而非纯黑的文字、柔和强调色及黄色焦点；用户在实际截图中否定了整屏苔绿的「海岛夜色」，现已确认「干净暖炭灰底色 + 少量薄荷强调」；中性表面要有清晰明度层级，动物岛的可爱与轻盈放在局部粉彩和圆润细节中。DSH 扩展能力优先于上游仅适用于独立 React 应用的安装/控件要求。

## Product Principles

- 内容阅读优先，主题不能遮挡功能、改变布局或干扰操作。
- 深色背景有清晰但克制的分层；重要文字与交互色可验证对比度。
- 现有用户偏好和无关插件配置保持不变。
