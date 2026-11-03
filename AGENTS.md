# 项目代理指引

## 适用范围与工作方式

本文件适用于整个 `dsh-plugins` 仓库；子目录如有更具体的代理指引，以其范围内的约定为准。本文命令默认从仓库根运行。

- 默认使用中文沟通；沿用文件现有语言、排版和局部代码风格，避免无关格式化。
- 动手前阅读 [README](README.md)、目标插件说明和当前 Git 状态，区分已有变更与本次工作，不覆盖或丢弃用户变更。
- 本仓库是 **独立 DSH 插件合集**，不是 DSH 宿主源码，也没有根级 Node workspace 或统一构建命令。不要为了修改插件引入根级依赖或重建宿主。
- 每次尽量只改任务涉及的插件；实际插件清单与版本以各自 manifest 为准，不硬编码到自动化流程里。

## 目录与参考资料

- `plugins/themes/`：主题插件，目前包含 Animal Island 与 Claude Code。
- `plugins/tools/`：功能插件，目前包含会话删除工具。
- [.agents/skills/install-dsh-plugins/SKILL.md](.agents/skills/install-dsh-plugins/SKILL.md)：项目级安装、更新、profile 核验与排障步骤。涉及这些操作时先加载该 Skill。
- [PRODUCT.md](PRODUCT.md)、[DESIGN.md](DESIGN.md)、[动物岛方向契约](.impeccable/surface-briefs/animal-island-theme.md)：当前内容主要约束 Animal Island，不应直接当作其他插件的统一视觉规范。
- `.impeccable/review/`：带版本与证据边界的设计复核记录；历史报告不能作为新版验收结果。

新增插件按用途放入现有分类；新建分类时同步更新 [README 目录与插件清单](README.md#目录结构)。

## 插件结构与实现约定

每个插件是可独立安装的自包含 bundle，遵循相邻插件现有结构：

- manifest 使用 `@local/<目录名>`、`private: true`，宿主包为 ESM；名称与导出路径保持一致。
- 宿主入口为 `index.js`；客户端入口通过 manifest 的 `./client` 导出，并以 `dsh.client` 声明平台和依赖。
- `dsh.bundle.patch` 指向 `cordis.patch.yml`，通过稳定、唯一的 Cordis row ID 注册插件。不要随意改已有 row ID、slot ID 或偏好存储键。
- 宿主与客户端采用不同的执行约定：不要因为 manifest 为 ESM 就把现有客户端模块加载包装器改成普通 ESM，也不要将客户端代码直接交给宿主加载。
- 客户端依赖 DSH 提供的模块表、服务与 Slot；不要把独立 React 应用的包导入、构建方式或全局样式直接套到手写客户端插件上。
- 通过 `ctx.effect` 等现有生命周期机制管理 token、样式、Slot 与路由，停用插件必须释放其资源。
- 用户可见功能变动同步维护插件说明及中英文 locale；版本变化同步 manifest、根 README 和相关版本文档。
- 保留第三方许可和资源来源。Animal Island 内嵌字体遵循 [Nunito 许可](plugins/themes/dsh-theme-animal-island/LICENSE-Nunito.txt)，不要无故重写大段内嵌字体数据。

## 安全与用户偏好

- 保留目标 profile 的其他依赖、bundle 选择、用户禁用状态、LLM/provider 配置和已有字体/外观偏好。
- 安装或更新前备份相关 profile 文件；使用受支持的 DSH CLI / 插件管理器，不直接覆盖整个 profile。
- 本地 `link:` 仅说明源码路径关联，不代表客户端一定热更新。没有核实 watcher、构建与实际页面结果，不承诺“修改即时生效”。
- 修改本地插件不等于获准修改 DSH 安装目录、启动替代服务器或终止当前宿主。若任务需要运行时验证，使用当前运行环境提供的真实 profile 与 GUI URL，不使用历史报告里的端口。
- 会话删除属于不可撤销能力，必须保留确认、活动会话拒绝和路径越界保护。验证只使用临时夹具；不得通过删除真实会话测试安装。
- 不将密钥、认证 token、带 token 的 URL、用户会话内容、profile 备份或机器缓存提交到仓库。

## 主题特有约束

- 两个主题可能覆盖同一组 token；不要为了验收擅自切换用户偏好或启用另一个主题。
- Animal Island 仅在 Electron 桌面端应用；普通浏览器无主题层是预期行为。
- Animal Island 当前方向为浅色奶油纸面、深色暖炭灰加局部薄荷强调。保留八色选择、原存储键、用户字体优先、原生 radio 语义、键盘焦点、forced-colors 和 reduced-motion 分支。
- 不以主题适配之名替换宿主布局或控制其他插件 DOM；具体视觉变更先阅读对应设计资料和适用的设计 Skill。

## 验证命令与证据边界

两组现有测试均使用 Node 内置测试运行器，无需安装测试框架。可在仓库根一次运行：

```powershell
node --test plugins/themes/dsh-theme-animal-island/theme.test.js plugins/tools/dsh-session-delete/test/delete.test.mjs
```

按插件单独执行亦可：

```powershell
# 工作目录：plugins/themes/dsh-theme-animal-island
node --check client.js
node --check index.js
node --test theme.test.js

# 工作目录：plugins/tools/dsh-session-delete
node --check client.js
node --check index.js
node --check delete.js
node --test
```

提交前至少：

1. 对修改的 JavaScript 执行 `node --check`，运行受影响插件的测试；纯文档变更检查链接、命令与当前源码是否一致。
2. manifest、locale 或 bundle 补丁有改动时检查其解析、导出/资源路径和注册关系。
3. 用 `git diff --check` 与暂存区差异检查空白、无关修改和敏感内容。
4. 有运行时验证需求时，分开说明依赖链接、bundle 选择、宿主加载、客户端加载与实际渲染的结果。

静态 token/对比度测试和服务边界测试 **不等于视觉验收**。没有浏览器或截图证据时明确写出未验证项，不能把旧截图、Slot 存在或语法通过描述为新版界面验收通过。

## 文档与 Git 交付

- 安装知识优先更新项目 Skill；通用入口与插件清单更新根 README，插件行为更新其自身说明，避免互相冲突。
- 复核记录写明日期、目标版本、实际运行的检查和未验证项；旧记录标明历史/被替代状态，不把历史结论改写成当前结果。
- 仅在用户要求时创建提交；按意图组织提交，使用明确路径暂存并检查暂存内容，不用全量暂存掩盖未审阅文件。
- 遵循现有英文、动词开头的简洁提交标题；不擅自 amend、reset、删除用户改动或推送远端。
- 交付时报告修改范围、测试结果、提交 hash 和剩余工作区状态；如仍有无关改动，明确列出。
