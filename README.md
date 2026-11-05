# dsh-plugins

我制作的 [DeepSeek Harness](https://github.com/deepseek-ai) 插件合集，按类别集中存放。
每个插件都是一个独立、可单独链接进 DSH profile 的 bundle，互不依赖。

## 目录结构

```
.
├── plugins/
│   ├── themes/                      # 主题类：配色、字体、外观
│   │   ├── dsh-theme-animal-island/
│   │   └── dsh-theme-claude-code/
│   └── tools/                       # 功能类：给界面/工作流增加能力
│       ├── dsh-godot-debug/         # 右侧侧边栏预览当前会话的 Godot 项目
│       ├── dsh-session-delete/
│       └── dsh-source-control/      # 会话右侧栏的 VSCode 风格源代码管理
├── third_party/                     # 第三方插件引用（git submodule，不计入自研插件）
│   └── dsh-rewind-plugin/
├── LICENSE
└── README.md
```

新增插件时按用途放进现有分类；确实开新分类时，在上面的树里补一行说明。

## 插件一览

| 插件 | 类别 | 版本 | 说明 |
| --- | --- | --- | --- |
| [dsh-theme-animal-island](plugins/themes/dsh-theme-animal-island/README.md) | themes | 1.4.0 | 动物岛风格主题：浅色奶油纸面、深色暖炭灰、局部薄荷点缀、Nunito 字体，设置页带八种岛屿强调色；1.4.0 让八色覆盖浅色气泡/选区/业务 chip/侧栏选中态，并抬升深色弹层；设计语言参考 guokaigdg 的 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) |
| [dsh-theme-claude-code](plugins/themes/dsh-theme-claude-code/README.md) | themes | 1.0.0 | Claude Code 配色：暖纸/暖炭底色，明暗两套色值跟随系统外观 |
| [dsh-godot-debug](plugins/tools/dsh-godot-debug/README.md) | tools | 0.3.0 | 在当前会话的 DSH 右侧栏内嵌预览该会话的 Godot Web 调试版，并显示浏览器控制台日志 |
| [dsh-session-delete](plugins/tools/dsh-session-delete/README.md) | tools | 0.1.0 | 在侧边栏会话菜单中加入「删除会话…」，二次确认后从磁盘移除会话及其检查点 |
| [dsh-source-control](plugins/tools/dsh-source-control/README.md) | tools | 0.1.0 | 在会话右侧栏查看 Git 改动、暂存/提交、提交图谱与逐文件 diff，并支持保守的抓取/拉取/推送 |

## 第三方插件引用

第三方插件不放进 `plugins/`，而是以 git submodule 固定在 `third_party/`，避免与自研代码混淆，也便于跟随上游更新。详见 [third_party/README.md](third_party/README.md)。

| 插件 | 版本 | 说明 |
| --- | --- | --- |
| [dsh-rewind-plugin](third_party/README.md) | v0.19.1 | Claude Code 风格 `/rewind` / `/undo`：对话就地回退，可选还原 Agent 改过的文件 |

## 本机安装

推荐以 `link:` 方式链接进目标 profile；桌面端通常是 `~/.dsh/profiles/desktop`，
但应以当前 `DSH_PROFILE` / `DSH_PROFILE_DIR` 或用户指定值为准。
链接指向本仓库源码；安装后刷新现有 GUI 加载客户端模块，不保证源码修改无需构建就能热更新。
五个自研插件都按此方式安装；第三方 `dsh-rewind-plugin` 同样以 `link:` 指向
`third_party/dsh-rewind-plugin`，首次构建和更新方式见 [third_party/README.md](third_party/README.md)。

### 安装全部插件

在仓库根运行（`dsh` 已在 PATH 时）：

```bash
dsh plugin --profile desktop add link:"$PWD/plugins/themes/dsh-theme-animal-island" link:"$PWD/plugins/themes/dsh-theme-claude-code" link:"$PWD/plugins/tools/dsh-godot-debug" link:"$PWD/plugins/tools/dsh-session-delete" link:"$PWD/plugins/tools/dsh-source-control"
```

Windows PowerShell 中，若 `dsh` 不在 PATH，可使用应用自带 CLI。
以下安装路径是本机实测值，其他机器请替换 `$dsh`：

```powershell
$dsh = 'D:\Applications\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd'
$repo = (Get-Location).Path
& $dsh plugin --profile desktop add `
  "link:$repo/plugins/themes/dsh-theme-animal-island" `
  "link:$repo/plugins/themes/dsh-theme-claude-code" `
  "link:$repo/plugins/tools/dsh-godot-debug" `
  "link:$repo/plugins/tools/dsh-session-delete" `
  "link:$repo/plugins/tools/dsh-source-control"
if ($LASTEXITCODE -ne 0) { throw '插件安装失败' }
```

macOS 未加入 PATH 时，使用实际应用目录内的
`DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`。
也可在桌面端 **Settings → Plugins** 中逐个选择插件目录安装。

### 安装验证与注意事项

- 安装前备份目标 profile 的 manifest、锁文件、workspace 设置和用户补丁；保留无关配置。
- 当前版本 DSH CLI 会把新增 bundle 依赖自动加入 `package.json` 的 `dsh.profile.bundles`；
  直接执行系统 `pnpm add` 不保证注册。安装后仍应核验依赖、bundle 清单和链接的真实路径。
- 已安装但禁用的 bundle 不一定会因重复 `add` 而启用；按用户意图在插件设置中处理。
- 两个主题都可安装，但会覆盖同一组外观 token，建议在插件设置中一次只启用一个。
  Animal Island 只在 Electron 桌面端应用主题，普通浏览器不应用该主题。
- 会话删除插件的隔离测试：在 `plugins/tools/dsh-session-delete` 下运行 `node --test`。
  不要通过删除真实会话验证安装；删除操作不可撤销。
- 源代码管理插件的隔离测试：在 `plugins/tools/dsh-source-control` 下运行 `node --test`。
  它使用临时 Git 仓库，不操作真实工作区；安装后可用 GET
  `/local/source-control/status?sessionId=does-not-exist` 返回 HTTP 400 `session/unknown`
  验证路由已加载，该请求不会修改仓库。
- 安装后刷新当前 GUI，检查插件列表、会话菜单，以及源代码管理在会话标题旁、右侧栏
  `+` 向导中的入口，确认左侧栏底部不再显示源代码管理按钮。后端可用 GET `/local/session-delete` 返回预期的
  HTTP 405 验证会话删除路由已加载，该请求不会删除会话。

### 项目级 Skill

[install-dsh-plugins](.agents/skills/install-dsh-plugins/SKILL.md) 已沉淀完整操作步骤、
Windows 打包版 CLI / ASAR 注意事项、备份与故障处理、分层验证及主题共存说明。
在本项目的 DSH 会话中可直接要求使用 `install-dsh-plugins` 安装或核验插件。

## 开发约定

代理协作、插件生命周期、安全边界、测试与提交要求见 [AGENTS.md](AGENTS.md)。

- 每个插件目录自包含：`package.json`、宿主入口 `index.js`、客户端入口 `client.js`、
  bundle 补丁 `cordis.patch.yml`、`locale/` 与图标。
- `package.json` 的名称统一用 `@local/<目录名>`，私有发布（`"private": true`）。
- 客户端插件在 `package.json` 的 `dsh.client` 里声明平台与注入目标，
  宿主侧补丁写在 `dsh.bundle.patch` 指向的 `cordis.patch.yml`。
- 有测试的插件用 Node 内置测试运行器：

  ```bash
  cd plugins/tools/dsh-godot-debug && node --test
  cd plugins/tools/dsh-session-delete && node --test
  cd plugins/tools/dsh-source-control && node --test
  ```

## 许可

[MIT](LICENSE)。`dsh-theme-animal-island` 内置的 Nunito 字体遵循其自带的
[LICENSE-Nunito.txt](plugins/themes/dsh-theme-animal-island/LICENSE-Nunito.txt)。
