---
name: install-dsh-plugins
description: "安装、更新或核验本仓库的全部或指定 DeepSeek Harness (DSH) 插件；处理本地 link: 依赖、desktop profile、Windows 打包版 CLI、bundle 激活和安装后验证。"
---

# 安装本项目的 DSH 插件

## 目标与边界

把本仓库 `plugins/` 下实际存在的 DSH bundle 安装到用户指定（否则当前运行环境）的 profile，验证安装和加载，保留无关配置。默认使用 `link:`，让 profile 指向源码而不是复制目录。

本文 `plugins/`、`README.md`、`.agents/` 等项目路径均相对于第 1 步确认的**仓库根**，不是 Skill 自身的资源目录。示例 shell 命令也以仓库根为工作目录；测试命令明确标注例外。

- 不把“包管理器退出 0”当作全部成功：依赖、bundle 选择、真实链接及宿主加载是不同层次。
- 不改 DSH 安装目录、不创建替代 Web 服务器、不终止正在执行本任务的宿主。
- 不为了验证删除能力而删除真实会话；只运行隔离测试和非破坏性路由探测。
- 不打印凭据、认证 token、带 token 的 URL 或用户私密会话内容。
- 不提交 Git commit，除非用户明确要求。

## 1. 发现环境与插件

1. 用工作目录工具确定仓库根；阅读根 README、适用的 AGENTS 指令和已有 Git 状态。
2. 用 `glob` 发现 `plugins/**/package.json`，再用 `read` 读取 manifest 和各插件说明；不要只依赖 README 中的固定数量。
3. 只有声明 `dsh.bundle.patch` 的包才作为 bundle 安装。记录包名、版本、绝对目录、补丁、导出入口、客户端声明及测试要求。读取补丁确认各插件的 Cordis row ID。
4. 从 `$env:DSH_PROFILE`、`$env:DSH_PROFILE_DIR`、`$env:DSH_HOME` 和 `$env:DSH_WEB_URL` 确认当前宿主；用户明确指定的目标优先。环境变量不全时先定位真实 profile，不猜测用户目录。
5. 阅读目标 profile 的 `package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml`（若存在）及已有锁文件，保留其他依赖、内建 bundle、LLM/provider 设置和用户禁用状态。

本次实测插件清单（2026-11-04；以后必须重新发现）：

| 包名 | 仓库相对目录 | Cordis row ID |
| --- | --- | --- |
| `@local/dsh-theme-animal-island` | `plugins/themes/dsh-theme-animal-island` | `theme-animal-island` |
| `@local/dsh-theme-claude-code` | `plugins/themes/dsh-theme-claude-code` | `theme-claude-code` |
| `@local/dsh-godot-debug` | `plugins/tools/dsh-godot-debug` | `godot-debug` |
| `@local/dsh-session-delete` | `plugins/tools/dsh-session-delete` | `session-delete` |
| `@local/dsh-source-control` | `plugins/tools/dsh-source-control` | `source-control` |

## 2. 找到真正的 DSH CLI

先用 `Get-Command dsh -ErrorAction SilentlyContinue` 查找 PATH 中的命令，再执行 `plugin --help` 确认语义。Windows 安装版的 CLI 不一定在 PATH。

本次安装在 `D:\Applications\DeepSeekHarness`，实测入口是：

```powershell
$dsh = 'D:\Applications\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd'
& $dsh plugin --help
```

这只是已验证的位置，不是通用安装路径。换机器需从实际应用安装目录定位 `resources/runtime/cli/bin/dsh.cmd`。macOS 则按实际应用目录定位 CLI，不把 README 的 macOS 路径直接用于 Windows。

### Windows 打包版的关键限制

- `resources/app.asar/dsh` 是 Electron 的虚拟归档目录，不是普通磁盘目录。普通 `glob`、系统 Node 和文件读取工具可能报告找不到，不代表应用损坏。
- 优先使用自带 `dsh.cmd`：它设置 `ELECTRON_RUN_AS_NODE=1`，通过应用 Electron 执行打包 CLI，并配置应用自带的包管理器。不用系统 Node 直接运行 asar 内部入口。
- 如确实需要核查版本相关安装机制，只读提取确切相关文件到临时目录，再用 `read` 检查；不要解包、修改或重建整个应用。
- 不必为安装这些无第三方依赖的本地插件升级 Node/pnpm，也不要执行安装输出中的全局升级提示。

## 3. 备份，然后串行修改同一个 profile

执行前把现存的 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`cordis.patch.yml` 复制到新的带时间戳备份目录；记录位置，不覆盖旧备份。不把含用户配置的备份提交到仓库。

优先调用 DSH CLI，而不是直接调用系统 `pnpm add`。在本次版本中，CLI 会在 pnpm 完成后核查 bundle 补丁，并把**新增依赖**自动加入 `dsh.profile.bundles`；直接 pnpm 不保证这一点。

在已确认的仓库根中，按发现清单构造绝对 `link:` 参数。以下为 PowerShell 示例（变量应来自前面已确认的环境）：

```powershell
$repo = (Get-Location).Path
$profile = $env:DSH_PROFILE
if (-not $profile) { throw '请先确认目标 profile' }
$pluginDirs = @(
    'plugins/themes/dsh-theme-animal-island'
    'plugins/themes/dsh-theme-claude-code'
    'plugins/tools/dsh-godot-debug'
    'plugins/tools/dsh-session-delete'
    'plugins/tools/dsh-source-control'
)
$specs = $pluginDirs | ForEach-Object {
    'link:' + (Join-Path $repo $_).Replace('\', '/')
}
& $dsh plugin --profile $profile add @specs
if ($LASTEXITCODE -ne 0) { throw "DSH 插件安装失败：$LASTEXITCODE" }
```

- 清单随发现结果更新；路径含空格时仍使用参数数组，不拼接 shell 命令字符串。
- 同一 profile 的安装串行执行，避免多个包管理器争用文件；独立测试可以并行。
- 已经安装但用户禁用的插件，不擅自重新启用。用户要求全部启用时明确核验并处理 selection/row disable，不能以重复 `add` 代替启用。
- 成功后重新读 profile manifest；不要手写覆盖整个文件。CLI 也可能同步应用预设的 bundle，应将无关变化与备份比较，不能误报为本地插件。
- 若只能直接 pnpm 安装，必须通过当前版本支持的插件管理机制登记/启用 bundle；必要时针对性合并 manifest，保留所有无关字段与原顺序，且明确需要重新加载。

## 4. 分层验证

### A. 依赖与链接

对本次要求安装的每个包核验：

1. 目标 profile `dependencies` 含正确的 `link:` spec。
2. profile 的 `dsh.profile.bundles` 含包名（除非用户要求安装但不启用）。
3. `node_modules/<包名>` 的真实路径指向当前仓库的插件目录，而不是旧仓库或复制品。
4. 链接目录 manifest 的名称、版本、入口和 bundle 补丁都可读。
5. 原有 profile 配置没有被意外覆盖。记录实际发生的额外变化。

`fs.realpathSync()` 可以验证 junction/symlink 的最终路径；不能只看目录名存在。

### B. 代码与隔离测试

- 用 `node --check <文件>` 检查每个插件的 JS 入口/实现，包括客户端文件（语法通过不等于客户端成功执行）。
- 对声明或文档提供的测试逐个执行；本项目的功能插件都使用 Node 内置测试运行器：

```powershell
node --test
# working directory: plugins/tools/dsh-session-delete
# working directory: plugins/tools/dsh-godot-debug
# working directory: plugins/tools/dsh-source-control
```

2026-11-03 会话删除插件实测 6 项全部通过，覆盖冷会话删除、拒绝活动会话、记录不存在、非法 ID、路径逃逸保护和已归档情况；2026-11-04 源代码管理插件 8 项通过，使用临时 Git 仓库验证状态、暂存、提交、历史、diff、init 和重命名，不以真实仓库做破坏性测试。

### C. 当前宿主与客户端

会话删除插件可用现有 URL 做无副作用检查：

```powershell
$r = Invoke-WebRequest -Uri "$env:DSH_WEB_URL/local/session-delete" -SkipHttpErrorCheck
$r.StatusCode
$r.Content
```

预期为 HTTP **405**，JSON 中 `error` 为 `method`、`message` 为 `POST is required`。它证明现有宿主注册了插件路由，不证明浏览器菜单已渲染。不要发送真实删除 POST。

- 404：检查 profile 是否正确、bundle 是否已选中、row 是否禁用及宿主是否应用配置；必要时通过受支持的插件管理器重载，不能直接杀当前宿主。
- 根页面返回 401 且提示 `dsh web authentication required`：这是独立 HTTP 客户端缺少浏览器认证，不等于插件安装失败。不要伪造 cookie 或修改凭据绕过认证。
- 客户端需要在**现有 GUI URL**刷新页面后验证：Settings → Plugins 能看到对应包；会话菜单出现“删除会话…”；源代码管理出现在会话标题旁的按钮、右侧栏 `+` 向导和左侧栏底部；Animal Island 在桌面端的 General 设置中显示强调色选择器。
- 只有实际检查过渲染结果才能声称“界面验证通过”。没有浏览器工具时，分别报告已完成的安装/宿主验证和待用户刷新的界面检查。
- 本地链接只保证源码路径关联。客户端代码修改是否热更新取决于实际构建和 watcher；没有核实同安装/checkout 的 `pnpm run dev:web`，不要承诺“修改即时生效”。不要为此启动另一个服务。

## 5. 主题共存与破坏性能力提示

- 两个主题都会覆盖颜色/字体 token；安装全部不等于两套主题可同时完整显示。不要擅自选择用户的偏好；建议在 Settings → Plugins 中一次只启用一个主题。
- Animal Island 具有 Electron 检测门槛：普通浏览器即使连同一个 Host 也不会应用其主题，这不是安装故障。Claude Code 没有这一桌面限定。
- 主题不应改用户已保存的外观和字体设置；不要为了“生效”覆盖这些偏好或额外安装字体。
- 会话删除不可撤销，要求先关闭目标会话；不会连带删除 fork/子代理会话或共享附件。验收不需要真实删除。

## 6. 失败处理与交付

- 非零退出必须先查清原因，不能继续宣称成功；记录相关后台任务 ID，收集结果或取消不再需要的任务。
- 先比较当前 profile 与备份，再决定针对性恢复。并发发生用户配置修改时不要整文件回滚；不要删除整个 profile/node_modules 或原有会话。
- Windows 意外 ACL 拒绝按可用的 sandbox ACL 诊断 Skill 处理；预期的策略拒绝不要绕过，不申请用户策略禁止的提权。
- 最终报告：目标 profile、每个包的版本/链接/启用情况、测试数量、宿主验证结果、未完成的界面检查、备份位置和主题共存提醒。

此 Skill 是项目级文档，位于 `.agents/skills/install-dsh-plugins/SKILL.md`。DSH 默认支持此发现目录并动态刷新；同名 `.dsh/skills` 条目优先。不要把本机绝对安装路径写成所有机器必须使用的前提。
