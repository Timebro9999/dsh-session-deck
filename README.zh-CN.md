[English](README.md) | **简体中文**

# dsh-session-deck

**管理你的整个工作区，而不只是某一条对话。** 给 DeepSeek Harness 的 Codex 风格侧边栏：
把项目和对话一起收进一个置顶区、一键把侧边栏切成「最近使用」、给每个项目换自己的图标、
用不到的分区可以整块收起。

![dsh](https://img.shields.io/badge/dsh-0.1.7--rc.2-blue)
![tests](https://img.shields.io/badge/tests-148%20%2B%207-brightgreen)
![license](https://img.shields.io/badge/license-MIT-green)

## 为什么做这个

DSH 的侧边栏是按项目组织的，只用一个项目时没问题，一旦同时做几件事就难受：

- 内置的 pin 只能把对话排到**它自己的项目里**——没有地方放「我现在真正在推的那几条」；
- 你最常用的项目停在它当初被创建的位置，而且每个项目都长一个样（同一个文件夹图标）；
- 想找「昨天改的那个」只能一路滚树；
- 底部越堆越多的小组件，收不掉。

所以这个插件补了四件事：**一个置顶区、一个最近视图、每个项目一个图标、可以收起的分区。**

## 它给了什么

| | |
| --- | --- |
| **置顶区**（置顶） | 把**一条对话**或**整个项目**收进所有项目之上的一个区。置顶的项目可以就地展开、列出它自己的对话——和下面的项目行一样，但不用滚下去找。点行即跳转，`✕` 取消置顶，表头可折叠。 |
| **活动视图**（🔔） | 工作区那排图标的最后一个：点开把侧边栏切成**最近使用**——按天分组（今天 / 昨天 / 星期X / 日期），每条两行（标题 + 项目，下面是**最后一条回答的开头**），运行中的会话带圆点；点一条只做导航，视图保持打开，可以连着挑好几条。 |
| **项目图标** | 把项目的文件夹图标换成任意 Emoji——侧边栏项目行和目录选择器都生效。Codex 风格的选择器：最近用过、分类标签、图标网格、还原默认。 |
| **一处改、处处同步** | 改对话名、跑完一轮、换项目图标——所有视图立刻跟上：置顶区和活动视图每一行都按实时数据解析，正在工作的对话显示框架自带的运行圆环。 |
| **可折叠分区** | `置顶`、`项目`（内置的项目列表）、`组件`（侧边栏底部的小组件）都能从各自的表头收起 / 展开，并且记住状态。 |

## 侧边栏长什么样

```
┌ 工作区                        🔍  ⌘  📁+  🔔   ← 铃铛打开活动视图
│ ▾ 置顶                                  3       ← 置顶区（对话 + 项目）
│   ▸ 🌈 deepseek调试                     项目
│     🚀 新出了个GLM5.3 flashx…           会话
│     🌈 我没发现现在有什么这个左侧…      会话
│   ────────────────────────────────────
│ ▾ 项目                                  9       ← 内置项目列表，可折叠
│   📁 pdf
│   🚀 前沿方向研究
│       新出了个GLM5.3 flashx…            1天
└
  ⋯ 底部小组件 ⋯
  ▸ 组件                                          ← 底部小组件，可折叠
```

## 怎么用

1. **置顶** —— 鼠标移到对话行，点动作条里的 `☆`；或移到项目行，点铅笔左边的 `☆`。置顶区会出现在最上面，
   表头可以收起整块，`✕` 取消单条。
2. **最近使用** —— 点工作区那排图标最后的小铃铛。挑一条对话，视图**不会关**，可以连着挑；
   再点铃铛或右上角 `✕` 回到项目列表。
3. **项目图标** —— 鼠标移到项目行点铅笔（或直接在行上右键）打开选择器：点一个 Emoji、或用系统表情面板
   （⌃⌘Space）粘贴、或「还原默认」；目录选择器里的文件夹行同样可用。
4. **折叠** —— 点任意分区表头（`置顶` / `项目` / `组件`），状态按 DSH home 记住。

## 安装

```bash
# 从 npm（发布后）
dsh plugin --profile desktop add dsh-session-deck

# 或直接从本仓库装
dsh plugin --profile desktop add github:Timebro9999/dsh-session-deck
```

装完重启桌面端（或刷新窗口）一次，之后随 profile 加载。
同样的写法也能填进 App 里的插件页面（它接受 GitHub 目标）；加 `#v0.1.1` 可以锁定某个 release，而不是跟着
`main` 分支走：

```bash
dsh plugin --profile desktop add github:Timebro9999/dsh-session-deck#v0.1.1
```

插件市场里的收录来自索引
[`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（市场读它的 `plugins.json`）。
投稿只加一个文件：`data/plugins/Timebro9999__dsh-session-deck.yml`，本仓库放在 [`marketplace/`](marketplace)，
提 PR 用 [`scripts/open-marketplace-pr.sh`](scripts/open-marketplace-pr.sh)。

## 依赖与适配

- **平台：能跑 DSH Web 客户端的地方都行** —— macOS 桌面端、Windows 与 Linux 版都一样：插件是纯浏览器端的 DOM overlay，没有原生代码、不调用任何系统 API（唯一和平台有关的是图标选择器里提示的表情面板快捷键）。

- 桌面 profile 上的 DSH `0.1.7-rc.2`。插件直接读内置侧边栏的 DOM 与客户端服务，因此不依赖插槽契约，
  但界面大改时它用的锚点可能需要跟着调。
- 运行时零依赖，也**没有构建步骤**：[`lib/client.js`](lib/client.js) 就是手写源码，原样发布。
- 界面文案跟随 DSH 自己的语言（先读语言服务，再读界面实际渲染的文案，最后才是浏览器），
  所以它和 App 其余部分一样是中文或英文。

## 实现方式

插件不注册任何插槽、也不需要任何客户端服务（`inject: []`）。它是一个 DOM overlay：找到内置的行
（`[data-row-key^="workspace:"]`、`session:`）、分区标题、列表滚动容器和侧边栏底部，
用行自带的按钮样式长出控件，并画出框架没有的状态。DOM 之外要的数据，按需从客户端服务读取
（`ctx.get('sessions' | 'workspaces' | 'uiWorkspace' | 'locale')`）。

它插入的每个节点都带 `data-dsh-session-deck` 标记，所以后一次挂载会回收前一个实例留下的节点——
框架重载 bundle 时不会卸载旧的客户端实例。这段探索的工作笔记（锚点、被镜像的内置 CSS、踩过的坑、
以及把页面状态编码进插槽 id 的远程探针）放在 [`docs/implementation.md`](docs/implementation.md)。

## 存储

都在浏览器 `localStorage` 里（按 DSH home 划分）：

| 键 | 内容 |
| --- | --- |
| `dsh-session-deck:v1` | `{ emoji, recent, pinnedSessions, pinnedProjects, expandedProjects, pinnedCollapsed, workspaceCollapsed, widgetsCollapsed }` |
| `dsh-session-deck:previews:v3` | 每条对话的回答预览，按它的 `updatedAt` 做标记 |

项目图标故意存两份键——知道 workspaceId 的界面用 id 键，只知道文件夹名的界面用 `name:<文件夹名>`，
两者互相回退，任一处设置都会在所有界面生效。

## 开发

```bash
npm test        # 148 + 7 条断言，零依赖
```

测试会把真实的 `lib/client.js` 装到「假的模块加载器 + 假的 DOM + 假的客户端上下文 + 假的会话记录」上，
然后逐个驱动每个界面：注册、图标绘制、各种触发器、选择器、置顶区、分区、活动视图（包括消息的哪一部分
会变成预览）、语言处理和卸载 / 重载安全。CI 在 Node 22 与 24 上跑。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-session-deck
```

插件不写任何宿主状态：卸掉、重载，界面就回到原样。

## 许可

MIT
