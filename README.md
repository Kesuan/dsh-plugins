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
│       └── dsh-session-delete/
├── LICENSE
└── README.md
```

新增插件时按用途放进现有分类；确实开新分类时，在上面的树里补一行说明。

## 插件一览

| 插件 | 类别 | 版本 | 说明 |
| --- | --- | --- | --- |
| [dsh-theme-animal-island](plugins/themes/dsh-theme-animal-island/README.md) | themes | 1.2.0 | 动物岛风格主题：浅色奶油纸面、深色暖炭灰、局部薄荷点缀、Nunito 字体，设置页带八种岛屿强调色；设计语言参考 guokaigdg 的 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) |
| [dsh-theme-claude-code](plugins/themes/dsh-theme-claude-code/README.md) | themes | 1.0.0 | Claude Code 配色：暖纸/暖炭底色，明暗两套色值跟随系统外观 |
| [dsh-session-delete](plugins/tools/dsh-session-delete/README.md) | tools | 0.1.0 | 在侧边栏会话菜单中加入「删除会话…」，二次确认后从磁盘移除会话及其检查点 |

## 本机安装

三个插件目前都以 `link:` 方式链接进桌面端 profile（`~/.dsh/profiles/desktop`），
链接指向本仓库的对应目录，修改插件代码即时生效。

安装/更新一个本地插件，任选一种：

1. 桌面端 **Settings → Plugins**，选择插件目录安装本地插件；
2. 命令行（`dsh` 不在 PATH 时用应用内的 `DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`）：

   ```bash
   dsh plugin --profile desktop add link:"$PWD/plugins/themes/dsh-theme-claude-code"
   ```

3. 直接改 profile 并重装链接：

   ```bash
   cd ~/.dsh/profiles/desktop
   pnpm add link:/Users/kesuan/项目/dsh-plugins/plugins/themes/dsh-theme-claude-code
   ```

装好后还要把包名加入 profile `package.json` 的 `dsh.profile.bundles`（插件管理器会自动处理），
插件才会随应用启动加载。

## 开发约定

- 每个插件目录自包含：`package.json`、宿主入口 `index.js`、客户端入口 `client.js`、
  bundle 补丁 `cordis.patch.yml`、`locale/` 与图标。
- `package.json` 的名称统一用 `@local/<目录名>`，私有发布（`"private": true`）。
- 客户端插件在 `package.json` 的 `dsh.client` 里声明平台与注入目标，
  宿主侧补丁写在 `dsh.bundle.patch` 指向的 `cordis.patch.yml`。
- 有测试的插件用 Node 内置测试运行器：

  ```bash
  cd plugins/tools/dsh-session-delete && node --test
  ```

## 许可

[MIT](LICENSE)。`dsh-theme-animal-island` 内置的 Nunito 字体遵循其自带的
[LICENSE-Nunito.txt](plugins/themes/dsh-theme-animal-island/LICENSE-Nunito.txt)。
