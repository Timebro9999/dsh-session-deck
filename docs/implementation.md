# 实现笔记（dsh-session-deck）

> 这是插件开发过程中的工作笔记：座位与 DOM 锚点、被镜像的内置 CSS、踩过的坑与修法、探针（把现场状态编码进 slot 注册 id，便于远程诊断）。面向使用者的说明见根目录 README。

# dsh-session-deck

三件事：

0. **活动视图（小铃铛）** —— 工作区头部那排图标（放大镜 / 文件夹 / 调整）里再加一个小铃铛，
   点它把侧边栏列表切换成「最近使用」：按天分组（今天 / 昨天 / 更早）列出最近用过的对话，
   点一条直接打开并自动切回列表，再点铃铛（或面板上的 ✕）切回。


1. **项目图标** —— 把项目的文件夹图标换成你选的图标（照 Codex 的 `projectAppearance` 做）。
2. **置顶区** —— 工作区列表最上面一块常驻区域，可以同时置顶**项目**和**对话**
   （内置的 pin 只能把对话排到它自己的项目里，这里是全局的）。

## 交互（照着 Codex 的 `projectAppearance` 做）

Codex（ChatGPT 桌面端的 Codex）里，项目外观是一个独立的 **project appearance** 选择器：
一组命名图标 + 一组颜色，由项目行上的 customize 入口打开。这里沿用同一套交互：

1. **入口**
   - 鼠标移到**项目行**（侧边栏的项目分组行 / 目录选择器里的文件夹行）→ 行尾动作区出现一个
     **铅笔图标按钮**（沿用该行自带 `iconButton` 的样式，和「…」按钮同款）；
   - 或在项目行上**右键**；
   - 或点已经换好的项目图标本身。
2. **选择器面板**：最近用过的图标 → 分类标签（工作 / 科研 / 技术 / 表情 / 自然 / 物件 / 生活 / 旅行 / 符号）
   → 图标网格，一格一点击，选中即生效并关闭。
   - `还原默认` 回到原来的文件夹图标；
   - `Esc` / 点面板外关闭；
   - 也可以用系统表情面板（Control + Command + Space）复制任意表情贴进去（存在 `recent` 里）。
3. **没选过的项目保持原样**：只有设置了图标的项目才会隐藏原文件夹图标。

## 活动视图（小铃铛）

- **入口**：工作区那一排图标的**最右边第四个**。实现上铃铛是 `*_sectionHeader` 的最后一个子节点，
  **不是**图标组 `*_headerActions` 的子节点——那一组是 `max-width:60px`（刚好两个 28px 图标加间隙）+
  `overflow:hidden`，塞第三个进去会被裁掉。而 sectionHeader 自己是 `gap:4px`（和图标组内部同样的 4px），
  所以并排放着间距完全一致：`[工作区]……[🔍][调整][📁+][🔔]`。
  按钮类名从该行的搜索按钮复制（28×28 命中区、同样的 hover/焦点态），图标 16px 与其它图标等大。
- **打开状态用强调色**：打开时给铃铛加 `.dsd-trigger-on`（实心图标 + `--dsw-alias-brand-primary`）。
  颜色那条必须带 `!important`——复制的内置类里有 `color: inherit`，两者特异度相同，
  而内置样式表是运行时后注入的，会盖过我方规则（这就是「点了还是灰的」的原因）。
- **内容**：`.dsd-activity` 插进 `*_listArea`，位于列表滚动容器之前；打开的这段时间把滚动容器
  `display:none`（连同里面的置顶区一起让位），关掉时恢复原值。
- **排版（照 Codex 的活动视图）**：每条是**两行**——第一行「项目图标 + 标题（超出省略）+ 右侧项目名」，
  第二行「**这条对话最后一次的内容**（两行截断，灰色）+ 右侧相对时间（运行中加品牌色圆点）」；
  行高 ~56px、圆角 10、hover 高亮；分组标题之间留 16px 间距
  （今天 / 昨天 / 星期X / 超过一周显示 `9月26日`）。标题行 13px/500，预览 12px 次要色。
- **预览要洗过**：回答常常以代码围栏收尾（比如一段 ```schemaJson），所以取到的文本先做清理——
  截断在第一个围栏之前、去掉行内反引号/标题井号/强调符号、折叠空白，再塞进两行截断的格子里。
  缓存键因此再次升到 `:v3`（旧缓存里存着带围栏的原文）。
- **预览是「回答开头」，不是思考**：一条 assistant 消息的 content 是一串分段
  （实测 `reasoning, text, tool-call`），预览只取 `text` 分段（正则 `^(text|output[-_]?text|message|final)$`），
  跳过 `reasoning` 与工具调用；最新一条没有回答文本（纯工具轮）时继续往前找上一条有回答的消息，
  用户那句话只作为「还没回答」时的兜底。缓存键因此升到 `dsh-session-deck:previews:v2`，
  旧版本缓存里混着思考文本，靠换键作废。
- **预览从哪来**：会话摘要里**没有**预览字段（探针确认字段只有
  `id / displayTitle / running / retainedBy / blank / updatedAt / projectionValues / title / cwd / parentId / origin`，
  projections 也只有 goal/inbox/modelSelection/permissions），所以预览是**按需读会话自己的记录**：
  用 `sessions.using(id, { source: 'gateway' }, …)` 临时持有该会话 → `await reference.ready` →
  从 `binding.eventSource.getSnapshot().entries` 里往回找最新的 `user/message` 或 `assistant/message`
  （递归找 `text` 叶子，兼容各种层级）→ 立刻释放。读完按该会话的 `updatedAt` 存进
  `localStorage["dsh-session-deck:previews:v1"]`（最多 240 条），`updatedAt` 变了才会重读；
  一次最多 3 个并发、12 秒超时，读不到就记一条空结果不再重试。
- **列表**：取 `sessions.list`（`id / displayTitle / updatedAt / running / blank`）+
  `workspaces.list` 的项目归属，
  每条给出「项目图标 + 标题 + 时间（或项目名）」；有会话活动时间（`sessions.binding(id)` 的最后一个
  节点时间）时按时间倒序并按天分组（今天 / 昨天 / 更早），拿不到时间就按宿主给的顺序。
- **点击**：只做导航（`uiWorkspace.openSession`）——**活动视图保持打开**，可以一条一条点下去，
  像 Codex 那样在活动视图里连续挑对话；关闭只走铃铛或 ✕。
- **占满高度**：打开时隐藏的是列表所在的**整个 cell**（`treeBody`，即滚动容器的父节点），
  只隐藏滚动容器会把它的父节点留成一块空 flex 区块，看起来就是「下面空一大块」。
- **关闭**：再点铃铛、或面板右上角 ✕；插件卸载时也会还原那个 cell 的显示。
  （列表显隐只由一处决定：活动视图打开时隐藏列表 cell；「项目」分区收起是另一套——只加类、不隐藏 cell。）

## 「项目」分区（收起内置的项目列表）

在我们的分区节点里、置顶区那条分隔线之后，插入一个自有标题「项目」（带项目条数）。点它收起/展开时，
**不改 DOM 结构**——给滚动容器 `.list` 加一个类 `dsd-projects-collapsed`，由 CSS 隐藏它的非插件子节点：

```css
.dsd-projects-collapsed > :not([data-dsh-session-deck]) { display:none; }
```

内置的项目行归 React 所有，这样隐藏最安全（行仍在，只是不显示），展开时移除类即可。
状态记 `workspaceCollapsed`。（早先版本是让内置的「工作区」标题可点，现已移除——那是 React 拥有的节点，
不如自己出一个标题干净。）

### 一个已经修掉的死路（值得记）

早先「项目」收起用的是**隐藏列表 cell**（`treeBody`），而活动视图也用同一个 helper 隐藏 cell。
两者叠加时——置顶和项目都收起——cell 连同**我们自己的分区标题**一起消失，页面上没有任何入口可以再打开
（探针现场：`treecls1.list0.sec0.kids0of…`，`list0` 就是「滚动容器不可见」）。

现在职责分开：

- **活动视图** → 隐藏 cell（它要整块替换浏览区）；
- **「项目」分区收起** → 只在滚动容器上加类，行被 CSS 隐藏，cell 和我们的分区标题都留着 → 永远有入口。

## 「组件」分区（收起底部小组件）

侧边栏底部结构是 `*_footArea` → [`*_footerActions`（命令面板/用量卡片/上下文洞察/使用统计等插件小组件）,
`*_settingsArea`（设置与账号）]。我们把「组件」标题插到 `*_footArea` 的第一个子节点，
收起时只隐藏 `*_footerActions`——**设置与账号那一行不动**。状态记 `widgetsCollapsed`。
`footerActions` 里没有任何条目时，标题自己也不显示。

## 置顶区

- **位置**：在**列表的滚动容器里面**、所有项目分组之上（滚动容器 = 模块化的 `list` 元素，
  即 `*_listArea` 里类名以 `_list` 结尾的那个节点）；也就是说置顶区和下面的项目区是**同一个滚动整体**，
  会一起滚动，不是悬浮在顶部。`*_listArea` 只是找不到滚动容器时的兜底落点。
  侧边栏折叠成 rail 时整块隐藏。
- **分隔线**：置顶区最后自带一条 `.dsd-pin-sep`（1px，`--dsw-alias-border-l1`），
  把置顶区和下面的项目区分开；没有置顶时整块（含分隔线）一起消失。
- **分区**：整个侧边栏列表现在是三段可折叠的分区，标题样式统一（13px 实心小三角 + 标签 + 条数）：
  `置顶`（我们的置顶区）、`项目`（内置的项目列表）、`组件`（侧边栏底部那些小组件）。
- **表头可折叠**（照 Codex 的分区标题）：`▶ 置顶 3` 这样一行（**实心小三角**，不是文字箭头 ▸/▾），点它就收起/展开整个置顶区，
  状态记在 `pinnedCollapsed`；表头用 13px（和下面项目行的正文同号——用户要求「置顶区字体和项目区一样大」），
  右侧的条数用 10px 三级色（和内置时间同号）。
- **表头**：只有「置顶」两个字。文案按这个顺序判定语言（**不**以浏览器语言为准）：
  1. `ctx.get('locale').getLocale().active`（Harness 自己的语言）——通过 `ctx.inject(['locale'], …)`
     等待服务到位，服务晚挂载也不会漏；订阅 `locale.subscribe`，切语言立刻重刷。
  2. 界面上真正渲染出来的文案：侧边栏 `*_sectionLabel` / `*_brandName` 里有汉字就是中文
     （浏览器语言常是系统语言，`<html lang>` 又可能是构建期的固定值，所以这条比它们都可靠）。
  3. `<html lang>`。
  4. 浏览器语言，最后默认中文。
  另外每次扫描都会重读一次语言，所以即使第一帧判断错了，下一帧会自己纠正。
- **置顶什么**：项目和对话各一组，项目在前；新置顶的排最前。
- **置顶一个项目 = 置顶它和它下面的所有对话**：置顶区里的项目行是个可展开的行
  （▸/▾ 箭头），点它就地展开，把它名下的对话按侧边栏里的顺序列在下面，
  点其中任意一条直接打开；再点一次折回去。展开状态会记住。
  对话清单取自客户端服务 `ctx.get('workspaces').list` + `ctx.get('sessions').list`，
  所以即使侧边栏那个项目是折叠的、行没渲染，置顶区也能列全。
- **置顶一个对话**：单独一条对话也可以置顶，它会作为顶层行出现在置顶区（和项目行并列）。
- **怎么置顶**：
  - **对话行** hover 时出现的 ☆ 按钮（在行自带动作条里，和「…」同款样式）；
  - **项目行** hover 时出现的 ☆ 按钮（在换图标的铅笔按钮左边）；
  - 再点一次即取消；置顶区里每行右侧的 ✕ 也能取消。
- **置顶区长什么样**：`置顶` 标题 + 每行「图标 + 标题 + 项目/会话 + ✕」。
- **对齐（重要）**：整块和内置行用同一套栅格——置顶区自己**不加水平内边距**，行用内置会话行的
  `padding:0 8px`、`height:32px`、`border-radius:var(--dsw-radius-md)`，右侧的「项目/会话」用内置时间同款
  `font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary)`。这样置顶行右侧的标签与下面普通行的
  「3个月」右边缘完全对齐。取消置顶的 ✕ 是 `position:absolute;right:8px`（hover 时与标签**同位互换**），
  所以它不占流、不会把标签往左挤；展开项目的指示器同理：**实心小三角**（和内置项目行用的是同一种形状），展开时旋转 90° 指向下方
（内置 `.arrowOpen` 也是这个做法），hover 时顶掉图标、不占宽度。
  活动视图也用同一栅格（外层 `padding:6px 4px`，行 `padding:9px 8px`），因此三处的文字左边缘都在 12px。
  点置顶的**对话**行 → `uiWorkspace.openSession(id)`；点置顶的**项目**行 → 就地展开/折叠；
  点项目下面嵌套的对话 → `uiWorkspace.openSession(id)`。服务不可用时退化为点击/滚动到该行。
- **快照**：置顶时把标题和图标一起存下来，所以即使某个项目折叠了、行没渲染，
  置顶区照样显示；行渲染出来时会自动同步最新标题/图标。

## 覆盖的位置

| 位置 | 识别方式 | 图标座位 |
| --- | --- | --- |
| 侧边栏项目行 | `[data-row-key^="workspace:"]` | `*_folder`（名字取 `*_title`，入口放进 `*_rowActions`） |
| 目录选择器文件夹行 | `svg[class*="_rowIcon"]` / `_rowIconSelected` | 行按钮本身（名字取 `*_rowName`） |
| 对话行（置顶触发器） | `[data-row-key^="session:"]` | 行动作条 `*_rowActions` |
| 置顶区 | `*_listArea` 的第一个子节点 | 插件自绘 |

## 存储

`localStorage["dsh-session-deck:v1"]` →

```json
{
  "emoji": { "<workspaceId>": "📁", "name:数据库": "🚀" },
  "recent": ["🚀", "📁"],
  "pinnedSessions": [{ "id": "session-…", "title": "…", "icon": "📁" }],
  "pinnedProjects": [{ "id": "…", "title": "…", "icon": "📁" }]
}
```

- 侧边栏行知道 workspaceId，用 id 键；目录选择器只有文件夹名，用 `name:<文件夹名>` 键。
- 两边互相回退，任一处设置都会在所有界面显示。

## 不包含（已按需求移除）

曾一度做过、现已删除且不再注册任何座位：会话头部的「顶栏」、侧边栏的「会话面板」活动视图、
会话行前缀图标、会话菜单里的「加入顶栏」。当前插件**不注册任何 slot**，
`inject: []`，纯 DOM overlay，因此不会遮蔽任何内置 UI。

## 踩过的坑：整块 CSS 被自己的批量替换删掉

有一次「改置顶区样式」的批量替换锚点选在了 `.dsd-pinned {`，而活动视图的规则恰好位于它和 `.dsd-rail-hidden`
之间——结果把 `.dsd-activity*` 整块规则删掉了。表现就是活动视图「乱码」：没有 flex、没有两行截断，
预览里的 JSON 原样铺满。教训：**批量替换先确认边界**，并且给关键样式块加断言（自检脚本里现在有
「活动视图的布局规则必须存在」「围栏不得进入预览」这类静态断言，再被删就会立刻失败）。

## 自检

`/tmp/dsh-ref/test-deck.cjs`（假 DOM + 假 module-loader + 假客户端服务，99 项断言）与
`/tmp/dsh-ref/test-locale.cjs`（语言回归，7 项断言）：
触发器注入与样式继承、未设置时不改图标、选择器面板结构（标题/项目名/网格/分类/还原）、
点选后落盘并重绘、点已换图标重开面板、Esc 关闭、还原、目录选择器按名字键、
右键打开并抑制原生菜单、不破坏内置行结构；置顶：对话/项目星标注入与样式继承、
置顶区出现在 listArea 最前、标头与行内容、点击跳转（openSession/openWorkspace）、
✕ 取消、清空后整块消失、项目换图标后置顶行跟着换、rail 模式隐藏、卸载还原。

## 安装与「改完不生效」的坑（重要）

```bash
# profile 的 package.json 已登记：dependencies "dsh-session-deck": "file:plugins/dsh-session-deck"
# dsh.profile.bundles 也已加入 dsh-session-deck
```

**运行中的 App 加载的是 `~/.dsh/profiles/desktop/node_modules/dsh-session-deck/`（profile 安装时拷过去的一份），
不是 `plugins/dsh-session-deck/`。** 只改 plugins/ 目录，客户端永远看不到新代码——这就是「改了没反应 /
文字又变回英文 / 看不到新按钮」的原因。改完必须同步：

```bash
~/.dsh/profiles/desktop/plugins/dsh-session-deck/scripts/sync.sh
```

同步后宿主会重新激活该 entry，浏览器端会重新拉取 `lib/client.js`，通常几秒内生效（无需重启）。

### 为什么要刷新一次页面

DSH 的客户端在重新加载插件 bundle 时**不会卸载上一个实例**（这个长跑的页面里会叠好几个我的实例）。
所以每个实例都会往同一个位置加一个铃铛：旧的没标记、新的标记；新实例挂载时会回收自己标记过的节点
（`reclaimPrevious`，同时也按 `.dsd-trigger / .dsd-project-icon / .dsd-pinned / .dsd-activity` 兜底扫一遍）。
新实例是「权威实例」：它把别人的铃铛**隐藏**并且打上 `data-dsh-session-deck-stale` 标记，
被标记的实例下次扫描会**直接收手**（不再把自己塞回来）——不用这个握手的话，两个实例会互相隐藏、
来回拉锯。探针里的 `retired<N>` 是被退役的旧铃铛数量，正常 `bell1.retired0`。
残留值大说明这一页叠过多个实例（它们是不同版本的代码，比如早期的实例还在无条件隐藏别人），
刷新一次（Cmd+R）或重启 App 就是干净的单实例页面。

### 探针：确认客户端跑的是哪一版

客户端半边会在 `conversation.composer.dock` 里注册一个**什么都不渲染**的占位条目
（id `session-deck-beacon`）。它只为了一件事：可以从外部问一句「现在跑的到底是哪版」。

用 DSH 的 Cordis Inspect（或直接在 App 里）查 `conversation.composer.dock` 的 occupants：
有 `session-deck-probe.<状态>` 就说明客户端跑的是当前 bundle，且 id 里直接带回了现场状态：

| 片段 | 含义 |
| --- | --- |
| `cand2` / `vis2` | 文档里匹配到几个 `*_headerActions`，其中几个可见 |
| `host1` `vis1` | 选中的那一行是否存在 / 可见 |
| `bell1` | **可见**的铃铛数量（正常就是 1） |
| `retired7` | 被退役（隐藏 + 打标记）的旧实例铃铛数量（>0 说明这一页叠过多个实例，刷新即清） |
| `atsearch` | 铃铛挂到了哪：`search`＝带放大镜的那一行（正常，且插在图标左边空位），`actions`/`header`＝兜底 |
| `box332x36x12x200` | 该行的宽高与位置（像素），可直接判断它是不是侧边栏那行 |
| `rail0` | 侧边栏是否处于折叠 rail |

例如 `...probe.cand2.vis2.host1.vis1.bell1.atsearch.box332x36x12x200.rail0` 就是健康状态。
