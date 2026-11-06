# DSH 打开文件夹链接

在 DSH 对话里点击指向本机文件夹的链接时，直接交给当前桌面系统的文件管理器（Windows 资源管理器、macOS Finder 等）打开，而不是打开右侧的文件预览。

## 使用范围

- 识别 DSH 渲染的本机文件链接：对话里的本地路径会渲染成
  `<button class="…fileLink…" title="<路径>">`，`title` 保留路径末尾的斜杠。
- 同时识别 `dsh-resource://file/session/<sessionId>/<path>`、
  `dsh-resource://file/absolute/<path>` 以及带末尾斜杠的 `file://` 链接。
- 只有**文件夹**（路径以 `/` 或 `\` 结尾）会被接管；普通文件链接仍然打开 DSH 的预览。
- 普通网页链接、片段链接、带修饰键的点击（`Ctrl`/`Shift`/`Alt`/`Cmd`）与中键保持原生行为。
- 在 `window` 的**捕获阶段**处理点击，并 `preventDefault` + `stopPropagation`，先于 DSH 自己的文档级路由，因此不会同时打开右侧预览。

## 实现

客户端只负责识别链接，真正的打开动作由宿主半侧完成：

```
window 捕获点击 → 解析路径 → POST /local/open-folder-link/open
  → sessionController.openWorkspacePath({ path, action: 'reveal' }, signal)
  → 系统文件管理器
```

- 路由只接受本机回环请求，请求体上限 8 KiB，路径必须是非空字符串。
- 走 `sessionController.openWorkspacePath` 而不是自己拼 shell 命令：路径由 Host 的组合文件系统验证，桌面打开能力由 Host 决定；被拒绝时路由返回 `502` 和具体原因。
- 不用 `ctx.remote`：纯 JS 客户端插件访问 Remote 命名空间受 Cordis 服务注入守卫限制，会抛
  `cannot get property "remote.session" without inject`。宿主路由是稳定可用的替代路径。
- 宿主半侧声明 `inject: ['webServer', 'sessionController']`；不要把它们写进 `package.json` 的
  `dsh.client.inject`——那个字段是**模块**加载顺序，写进惰性条目会让客户端半侧永远不激活。

## 安装

从仓库根目录运行：

```powershell
$dsh = 'D:\Applications\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd'
$repo = (Get-Location).Path
& $dsh plugin --profile desktop add "link:$repo/plugins/tools/dsh-open-folder-link"
if ($LASTEXITCODE -ne 0) { throw '插件安装失败' }
```

安装后刷新 DSH GUI，并在插件管理中确认“打开文件夹链接”已启用。

## 测试

```powershell
cd plugins/tools/dsh-open-folder-link
node --test
```
