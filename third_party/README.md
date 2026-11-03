# Third-party plugins

这里存放对第三方 DSH 插件的**引用**，与 `plugins/` 下自研插件分开：

- 不复制、不改写第三方源码；
- 用 git submodule 固定到上游 release tag；
- 运行时由 DSH profile 的 `link:` 依赖指向本目录的本地构建，改完源码重新构建即可生效。

## dsh-rewind-plugin

| 项 | 值 |
| --- | --- |
| 上游 | https://github.com/SiriLee/dsh-rewind |
| 版本 | v0.19.1 |
| 许可证 | MIT（见 submodule 内 `LICENSE`） |
| 用途 | Claude Code 风格 `/rewind` / `/undo`：对话就地回退，可选还原 Agent 改过的文件 |
| 运行时 | desktop profile 的 `dsh-rewind-plugin` 指向本目录（`link:`），加载 `lib/` 构建产物 |
| 源码 | `third_party/dsh-rewind-plugin/`（submodule，固定在 `v0.19.1`） |

### 首次安装 / 更新

```bash
cd third_party/dsh-rewind-plugin
git fetch --tags
git checkout v0.20.0        # 目标版本
npm ci                      # 安装 devDependencies 并自动执行 build
```

如果 profile 里还没有这个插件：

```bash
dsh plugin --profile desktop add link:"$PWD"
```

更新后重启 DSH（或刷新页面）使新构建生效。

### 本地修改

```bash
cd third_party/dsh-rewind-plugin
# 修改 src/...
npm run build
```

profile 已经 `link:` 到本目录，重新构建后重启/刷新 DSH 即可。`lib/` 和 `node_modules/` 都在 submodule 的 `.gitignore` 中，不会污染 submodule 的 git 状态。
