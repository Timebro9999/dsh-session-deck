# dsh-session-deck

给 **DeepSeek Harness** 的 Codex 风格侧边栏：为项目和对话都准备了一个置顶区，
`置顶 / 项目 / 组件` 三段可折叠分区，一个小铃铛把侧边栏切成「最近使用」的活动视图，
以及可以为每个项目换的 Emoji 图标。

## 它加了什么

| 位置 | 能力 |
| --- | --- |
| 置顶区（置顶） | 把**一条对话**或**整个项目**收进所有项目之上的一个区（内置的 pin 只能把对话排到它自己的项目里）。置顶的项目可以就地展开、列出它的对话。点行即跳转，`✕` 取消置顶，表头可折叠。 |
| 小铃铛 | 工作区那排图标的最后一个：点开把侧边栏切成**最近使用**——按天分组（今天 / 昨天 / 星期X / 日期），每条两行：标题 + 项目，下面是**最后一条回答的开头**；运行中的会话带圆点；点一条只做导航，活动视图保持打开，可以连着挑。 |
| 项目图标 | 把项目的文件夹图标换成任意 Emoji，侧边栏项目行和目录选择器都生效。Codex 风格的选择器：最近用过、分类标签、图标网格、还原默认。 |
| 分区 | `置顶`、`项目`（内置的项目列表）、`组件`（侧边栏底部那些小组件）都能从各自的表头收起 / 展开。 |

实现细节（座位与 DOM 锚点、被镜像的内置 CSS、踩过的坑、远程探针）见
[`docs/implementation.md`](docs/implementation.md)。

## 安装

```bash
# 从 npm（发布后）
dsh plugin --profile desktop add dsh-session-deck

# 或直接从本仓库装
dsh plugin --profile desktop add github:Timebro9999/dsh-session-deck
```

装完重启桌面端（或刷新窗口）一次；之后随 profile 一起加载。

## 依赖

- 桌面 profile 上的 DSH `0.1.7-rc.2`（插件直接读内置侧边栏的 DOM 与客户端服务，不依赖插槽契约）。
- 运行时零依赖，也没有构建步骤：`lib/client.js` 就是手写源码，原样发布。

## 存储

都在浏览器 `localStorage` 里：`dsh-session-deck:v1`（图标、置顶、折叠状态）与
`dsh-session-deck:previews:v3`（每条对话的回答预览，按更新时间做标记）。
项目图标会有两个键（workspaceId 与 `name:<文件夹名>`），任一处设置都会在所有界面生效。

## 开发

```bash
npm test        # 148 + 7 条断言，零依赖
```

## 卸载

```bash
dsh plugin --profile desktop remove dsh-session-deck
```

插件不写任何宿主状态；卸载并重载后，界面回到原样。

## 许可

MIT
