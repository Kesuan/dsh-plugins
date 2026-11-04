# dsh-source-control

在 DSH **会话右侧侧边栏**提供 VSCode 风格的源代码管理页：查看当前 Session 工作区的 Git 改动、暂存与提交，浏览提交图谱和逐文件差异，并在安全时抓取/拉取/推送。

![Source Control 图标](icon.svg)

## 功能

- **仓库与分支**：从当前 Session 的工作目录解析 Git 仓库，显示仓库名、分支、上游、ahead/behind 和 HEAD。
- **改动列表**：按「已暂存的更改 / 更改」分组；支持 M/A/D/R/C/T/未跟踪/冲突状态字母和目录弱化显示。
- **暂存与提交**：逐文件或批量暂存/取消暂存；在提交框中写消息，`⌘Enter` / `Ctrl+Enter` 提交，可选「提交前暂存全部更改」。
- **提交图谱**：按加载窗口计算 lane 的提交图，显示 refs（HEAD、分支、远程、tag）、作者、时间和短 hash；点击进入提交详情与逐文件差异。
- **差异查看**：工作区、暂存区、未跟踪文件和任意提交内的文件都可以打开统一 diff；带行号、增删底色、二进制和截断提示。
- **同步**：抓取远程更新；拉取使用 `--ff-only`，推送使用当前分支上游。分叉、无上游或 detached HEAD 会给出明确拒绝，不擅自选择 merge/rebase。
- **刷新与状态**：手动刷新、窗口重新聚焦和 15 秒静默轮询；无需刷新整个 DSH 页面即可继续操作。
- **本地化**：中文/英文界面，跟随 DSH 的 locale 服务。

## 入口

插件提供三个入口，均打开同一个右侧栏页面：

1. 会话标题旁的 **源代码管理** 按钮；
2. 右侧侧边栏 `+` 向导中的 **源代码管理** 卡片；
3. 左侧侧边栏底部、Settings 旁的 Git 图标按钮。

## 安装

插件目录：`plugins/tools/dsh-source-control`。在插件管理器中安装该目录，或使用：

```bash
dsh plugin --profile desktop add link:"$PWD/plugins/tools/dsh-source-control"
```

安装后刷新现有 GUI。若当前 profile 已有其他 `link:` 插件，按本仓库根 README 的完整安装命令保持顺序。

## 工作方式

1. 打开一个工作目录属于 Git 仓库的会话。
2. 点击会话标题旁的 **源代码管理**，或右侧栏 `+` → **源代码管理**。
3. Host 从 Session header 读取 `cwd`，通过 `ctx.subprocess` 调用 Git；从 `ctx.sessions` / `ctx.sessionPersistence` 读取冷会话的工作目录。
4. 页面通过同源 `/local/source-control/*` 路由读取状态、历史、提交详情和 diff；暂存、提交和同步通过需要 JSON 与专用请求头的 POST 路由执行。
5. 所有 Git 命令都以 argv 数组启动，不经过 shell；浏览器传来的路径会先限制在仓库根目录内。

## Host API

| 路由 | 方法 | 作用 |
| --- | --- | --- |
| `/local/source-control/status` | GET | 当前 Session 工作区的仓库、分支、改动与计数 |
| `/local/source-control/history` | GET | 一页提交历史（含 parents/refs，供图谱计算） |
| `/local/source-control/commit` | GET | 单个提交的元数据与变更文件 |
| `/local/source-control/diff` | GET | 工作区/暂存区/未跟踪文件/提交内文件的统一 diff |
| `/local/source-control/stage` | POST | 暂存若干仓库相对路径 |
| `/local/source-control/unstage` | POST | 取消暂存若干路径 |
| `/local/source-control/commit` | POST | 提交已暂存更改，可按需先 `git add -A` |
| `/local/source-control/sync` | POST | `fetch` / `pull` / `push` / 智能 `sync` |
| `/local/source-control/init` | POST | 在当前 Session 工作目录初始化仓库 |

读取使用 `GIT_OPTIONAL_LOCKS=0`；网络操作设置 `GIT_TERMINAL_PROMPT=0` 并使用更长超时。变更路由只接受 loopback、同源、`application/json` 和 `x-dsh-source-control: 1` 请求头。

## 实现结构

| 文件 | 职责 |
| --- | --- |
| `index.js` | Host 包入口，重新导出 `server.js` 的插件导出。 |
| `server.js` | Session 工作目录解析、仓库发现、Git 状态/历史/diff/暂存/提交/同步、HTTP 路由与安全校验。 |
| `client.js` | 右侧栏页、向导卡片、会话标题按钮和左侧栏按钮；React 组件、diff/图谱渲染与主题样式。 |
| `cordis.patch.yml` | 唯一的 bundle 行 `source-control`。 |
| `locale/*.json` | 插件管理器使用的中英文标题与描述。 |
| `test/server.test.js` | 真实临时 Git 仓库上的状态、暂存、提交、历史、diff、init 和重命名测试。 |
| `test/client.test.js` | 浏览器 artifact 的加载与 Slot 注册测试。 |

## 开发

```bash
cd plugins/tools/dsh-source-control
node --check server.js
node --check client.js
node --test
```

## 已知限制

- **仅本机 loopback**：路由只接受本机回调地址；远程 DSH Web 访问不会使用这条 Git 面板（与现有 Godot 预览插件相同的本地优先策略）。
- **单仓库**：以 Session 的 `cwd` 所属仓库为准，不自动列出子模块或同工作区的其他仓库。
- **不提供丢弃/撤销**：当前版本没有 `git discard`、reset、stash 等破坏性操作，避免误触。
- **同步策略保守**：只做 fetch、fast-forward pull 和普通 push；分叉、无上游或 detached HEAD 会拒绝并说明原因。
- **无 Git LFS 和二进制内容预览**：二进制只显示提示，不解析图片或 LFS 指针。
- 首次提交若本机没有 `user.name` / `user.email`，Git 会按自身配置失败，错误会显示在面板中。

## 参考

实现前对比过以下社区插件，仅作为 Slot、右侧栏和 Git 读取模式的参考，代码为本插件独立实现：

- [lengmoxxl/dsh-git](https://github.com/lengmoxxl/dsh-git) — 右侧栏只读 Git 浏览页。
- [KannaKuron/dsh-ide-git](https://github.com/KannaKuron/dsh-ide-git) — 基于 dsh-better-sidebar 的 IDE 级 Git 工具窗口。
