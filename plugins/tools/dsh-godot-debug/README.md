# dsh-godot-debug

在 DSH **右侧侧边栏**预览**当前会话**的 Godot 项目。插件会读取当前会话的工作目录，找到最近的 `project.godot`，把项目构建成调试版 Web 导出，并在右侧栏的 iframe 中运行。

![Godot Preview 图标](icon.svg)

## 功能

- 当前会话是 Godot 项目时，右侧栏工具页出现 **Godot 预览** 卡片，会话标题旁也有 **Godot 预览** 快捷按钮。
- 当前会话不是 Godot 项目时，这两个入口都不渲染。
- 点击后打开右侧侧边栏的 **Godot 预览** 页，不再创建左侧“Godot 调试”面板。
- 自动构建并复用同一项目的最近一次 Web 调试导出；切换会话时会重新解析该项目。
- 预览页顶部显示项目名与路径，支持 **重新构建** 和 **在浏览器打开**。
- 底部控制台实时读取 Godot Web 导出的浏览器 console，可切换「只看问题」。
- 项目检测、构建和运行都从 Host 发起；前端参数通过 loopback 同源接口传递，不经过 shell。
- 构建使用系统临时目录中的项目副本，**不会修改原项目目录**。

## 工作方式

1. 打开一个工作目录属于 Godot 项目的会话。
2. 打开右侧栏（工具页）或直接看会话标题旁，点击 **Godot 预览**。
3. Host 从 Session header 读取 `cwd`，向上查找最近的 `project.godot`。
4. 如果当前项目已有可用的 Web 构建，直接显示；否则自动构建：
   - 复制项目到临时目录；
   - 加入 `Web` 导出预设和 `gl_compatibility` 渲染覆盖；
   - 运行 `godot --headless --import` 和 `--export-debug Web`；
   - 由仅绑定 `127.0.0.1` 的静态服务器提供页面。
5. 右侧栏 iframe 显示游戏画面，底部显示浏览器控制台。

## 安装

插件位于 `plugins/tools/dsh-godot-debug`。在插件管理器中安装该目录，或使用：

```bash
dsh plugin --profile desktop add link:"$PWD/plugins/tools/dsh-godot-debug"
```

默认 Godot 可执行文件为：

```text
/Applications/Godot.app/Contents/MacOS/Godot
```

如果 Godot 不在该位置，可以在启动 DSH 时设置 `GODOT` 环境变量，或修改
[`cordis.patch.yml`](cordis.patch.yml) 中的 `godotExecutable`，然后重载插件。

项目路径不需要在插件里手动配置：它来自当前会话的工作目录。若会话目录不是 Godot
项目，入口会隐藏；如果从旧布局恢复了一个预览标签，页面会显示「当前会话不是 Godot 项目」。

## 实现结构

| 文件 | 职责 |
| --- | --- |
| `index.js` | Host 包入口，重新导出 `server.js` 的插件导出。 |
| `server.js` | 读取 Session `cwd`、查找 `project.godot`，注册上下文、Web 构建和日志路由。 |
| `web.js` | 临时项目副本、Web 导出构建、静态预览服务器、浏览器控制台桥接。 |
| `client.js` | 注册右侧栏 guide 卡片、会话标题入口、`sidebarRightTabs` 页面类型与 `sidebar.right.pane.tab` 页面主体。 |
| `cordis.patch.yml` | Bundle 行、默认 Godot 可执行文件。 |
| `locale/*.json` | 插件管理器显示用的标题与描述。 |
| `test/*.test.js` | 项目检测、Web 预设、日志桥接和右侧栏注册测试。 |

Host 路由：

- `GET /local/godot-debug/context?sessionId=<id>` — 根据当前会话的 `cwd` 查找 Godot 项目。
- `GET /local/godot-web/state` — 最近一次 Web 构建状态。
- `POST /local/godot-web/build` — 构建 Web 调试导出并返回 iframe URL。
- `GET /local/godot-web/logs?buildId=<id>&after=<seq>` — 读取内嵌页面上报的浏览器控制台增量日志。

预览的静态文件和日志由 `web.js` 启动的独立 loopback 端口提供，避免把预览页面暴露在
DSH 的 authenticated app origin 上。

## 开发

```bash
cd plugins/tools/dsh-godot-debug
node --check client.js
node --check server.js
node --check web.js
node --test
```

## 已知限制

- 预览使用 Godot Web 导出，渲染器为 `gl_compatibility`；与原生 Mobile 渲染可能存在差异。
- Web 导出不支持移动端 `Input.get_device_orientation()` 等原生传感器；桌面鼠标/键盘回退可用。
- iframe 依赖 DSH 渲染器允许加载 loopback HTTP；本机桌面端已验证，远程/纯浏览器 Host 可能受限。
- 首次 Web 构建需要约 4–20 秒，并会产生约 37 MB 的 `wasm` 文件；构建缓存保留最近 3 份。
- 这是 Web console 调试，不是 GDScript DAP 断点调试器。
- 日志最多保留约 300 KB，更早的内容会被丢弃。
- 只面向桌面端本地 Host；远程 Host 没有本地 Godot 时不可用。
