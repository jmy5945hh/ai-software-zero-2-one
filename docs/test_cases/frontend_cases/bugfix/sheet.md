# AI Coding Agent 缺陷修复能力评估 · BUG 埋点手册

> 本文档用于评估 AI Coding Agent **修复 Bug** 的能力。
> 已在项目中注入 **5 个典型 React 前端 Bug**，覆盖不同维度和难度。
> 全部 Bug 均不影响 TypeScript 编译和 Biome Lint，需通过黑盒系统测试（ST）阶段发现。

---

## BUG 总览

| 编号 | 分类 | 注入页面 / 路径 | Bug 简述 | 难度 |
|------|------|-----------------|----------|------|
| BUG-1 | 页面显示 | 搜索列表 → 文章 | 文章收藏数错误显示为评论数 | ⭐⭐⭐ |
| BUG-2 | API 调用 | 表格列表 | 批量删除成功后表格数据不刷新 | ⭐⭐⭐ |
| BUG-3 | 性能 | 仪表盘 → 监控页 | 活动图表刷新频率异常高，导致页面闪烁 | ⭐⭐⭐⭐ |
| BUG-4 | 交互操作 | 表单 → 分步表单 | 完成转账后「再转一笔」跳转到确认页而非第一步 | ⭐⭐ |
| BUG-5 | 高级隐藏 | 个人设置页 | 窗口缩放时菜单模式切换偶尔失效（过时闭包） | ⭐⭐⭐⭐⭐ |

---

## BUG-1：文章列表收藏数显示错误

**页面/路径**：`/list/search/articles`

**测试描述（模仿测试人员口吻）**：

> **测试步骤**：
> 1. 进入「列表」→「搜索列表」→「文章」页面
> 2. 观察列表中每篇文章底部的操作栏图标与数字
> 3. 对比「收藏」图标（星形 ⭐）旁边的数字 与「评论」图标（消息 💬）旁边的数字
>
> **预期结果**：收藏数（星形图标）和评论数（消息图标）显示各自不同的数值
>
> **实际结果**：收藏数（星形图标）显示的数字**与评论数完全相同**。明明是两个独立的统计指标，却显示了相同的数据。
>
> **复现率**：100%，页面加载即可见。

---

### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 将 `<IconText>` 组件中收藏（star）图标的 `text` 属性从 `item.star` 改为 `item.message`。由于两个字段都是 `number` 类型，TypeScript 编译不会报错，但呈现的数据语义错误。 |
| **根因** | 文件 `src/pages/list/search/articles/index.tsx` 第 254 行附近，`<IconText key="star" type="star-o" text={item.message} />` 字段映射错误：`text` 应为 `item.star`（收藏数），错误地绑定到了 `item.message`（评论数）。 |
| **修复方法** | 将 `text={item.message}` 改回 `text={item.star}`。 |
| **考验 AI 能力维度** | ① 数据字段与 UI 标签的语义对应分析<br/>② 同组多个 IconText 的对比检查<br/>③ 理解数据模型 `ListItemDataType` 中各字段含义 |

---

## BUG-2：批量删除后表格数据不更新

**页面/路径**：`/list/table-list`

**测试描述（模仿测试人员口吻）**：

> **测试步骤**：
> 1. 进入「列表」→「查询表格」页面
> 2. 勾选表格中若干条数据
> 3. 点击底部操作栏的「批量删除」按钮
> 4. 观察表格数据变化，确认提示消息
>
> **预期结果**：删除成功后，提示"删除成功"，表格数据自动刷新，被删除的记录不再显示
>
> **实际结果**：弹出「Deleted successfully and will refresh soon」成功提示，但**表格中的数据并未刷新**，被删除的记录仍然存在。需要手动刷新页面（或切换页面）后数据才会更新。
>
> **复现率**：100%

---

### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 在 `useMutation` 的 `onSuccess` 回调中，移除了 `actionRef.current?.reloadAndRest?.()` 调用。ProTable 通过 `actionRef` 暴露 `reloadAndRest()` 方法来触发表格重新请求数据；移除后，虽然后续的 `queryClient.invalidateQueries` 仍在，但 ProTable 的 `request` 属性并非 React Query 驱动，`invalidateQueries` 对表格实际不生效。 |
| **根因** | 文件 `src/pages/table-list/index.tsx` 第 38-40 行附近，`onSuccess` 中缺少 `actionRef.current?.reloadAndRest?.()`。ProTable 组件使用内部的请求管理机制，不会自动响应外部的 `queryClient.invalidateQueries`。 |
| **修复方法** | 在 `queryClient.invalidateQueries` 之前重新添加 `actionRef.current?.reloadAndRest?.()`。 |
| **考验 AI 能力维度** | ① ProTable 数据刷新机制的理解（`actionRef.reload/reloadAndRest` vs React Query）<br/>② Mutation 成功回调中状态同步的完整性检查<br/>③ 理解「删除成功但数据未刷新」现象背后的因果关系 |

---

## BUG-3：监控页活动图表异常高频刷新

**页面/路径**：`/dashboard/monitor` → 「活动情况预测」区域

**测试描述（模仿测试人员口吻）**：

> **测试步骤**：
> 1. 进入「仪表盘」→「监控页」
> 2. 观察右侧「活动情况预测」区域中的面积图
> 3. 保持页面静止，持续观察图表变化
>
> **预期结果**：图表数据按合理间隔（如 2 秒）平滑更新，视觉上无明显闪烁
>
> **实际结果**：图表**每秒更新约 10 次**，曲线剧烈跳动，数据值快速闪烁变化，完全无法阅读。同时可观察到浏览器 CPU 占用明显升高，页面滚动出现卡顿感。
>
> **补充**：打开 Chrome DevTools → Performance 面板录制几秒，可看到密集的 `setTimeout` 回调触发和 React 重渲染火焰图。
>
> **复现率**：100%

---

### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 将 `window.setTimeout(loopData, 2000)` 的延时参数从 `2000`（2 秒）改为 `100`（0.1 秒），使定时器每 100ms 触发一次，执行 `setActiveData(getActiveData())` 生成随机数据并触发 React 重渲染。 |
| **根因** | 文件 `src/pages/dashboard/monitor/components/ActiveChart/index.tsx` 第 28 行附近，`window.setTimeout(loopData, 100)` 延时值过短。合理值应为 `2000`（或至少 >= 1000）。 |
| **修复方法** | 将 `100` 改回 `2000`。 |
| **考验 AI 能力维度** | ① 从「页面闪烁/卡顿」现象推断定时器频率异常<br/>② Performance 面板定位高频 `setTimeout` 调用<br/>③ 区分「设计意图」与「配置错误」：100ms 更新实时图表不合理 |

---

## BUG-4：分步表单「再转一笔」跳转错误

**页面/路径**：`/form/step-form`

**测试描述（模仿测试人员口吻）**：

> **测试步骤**：
> 1. 进入「表单」→「分步表单」页面
> 2. 第一步填写转账信息并提交
> 3. 第二步确认转账信息并提交（输入支付密码）
> 4. 第三步显示「操作成功」结果页
> 5. 点击「再转一笔」按钮
>
> **预期结果**：回到第一步「填写转账信息」的空白表单，允许用户开始新的转账
>
> **实际结果**：点击「再转一笔」后，**跳转到了第二步「确认转账信息」页面**，显示的是上一次的转账数据和支付密码输入框。用户无法重新填写新的转账信息，需要手动点击上一步才能回到表单。
>
> **复现率**：100%

---

### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | `StepsForm` 的步骤索引从 0 开始（Step 0 = 填写信息、Step 1 = 确认、Step 2 = 完成）。在「完成」步骤的「再转一笔」按钮回调中，将 `setCurrent(0)` 改为 `setCurrent(1)`，使其跳转至确认步骤（Step 1）而非第一步（Step 0）。 |
| **根因** | 文件 `src/pages/form/step-form/index.tsx` 第 217 行附近，`onFinish={async () => { setCurrent(1); form.resetFields(); }}` 中的步骤索引错误。`StepsForm` 的 `current` prop 以 0 为起始索引，跳回第一步应为 `setCurrent(0)`。 |
| **修复方法** | 将 `setCurrent(1)` 改回 `setCurrent(0)`。 |
| **考验 AI 能力维度** | ① 理解 StepsForm 的步骤索引（0-based vs 1-based）<br/>② 追踪用户操作链路：完成→再转一笔→预期落地页<br/>③ 区分 `setCurrent(0)` 与 `setCurrent(1)` 的语义差异 |

---

## BUG-5：设置页窗口缩放时菜单模式切换偶发失效

**页面/路径**：`/account/settings`

**测试描述（模仿测试人员口吻）**：

> **测试步骤**：
> 1. 进入「个人中心」→「个人设置」页面
> 2. 将浏览器窗口宽度拖拽至约 780px（菜单应以 inline 模式显示）
> 3. 快速地将窗口宽度来回拖拽（在 600px ~ 800px 之间快速反复调整）
> 4. 观察左侧菜单的显示模式（inline 竖排 vs horizontal 横排）
>
> **预期结果**：窗口宽度变化后，菜单模式应始终与实际宽度匹配（窄屏 horizontal，宽屏 inline）
>
> **实际结果**：快速拖拽窗口时，菜单模式偶尔**停留在旧状态不更新**。例如窗口已缩小到 600px，菜单仍保持 inline 模式（已被挤压变形）；或窗口已放大到 900px，菜单仍保持 horizontal 模式。停止拖拽后状态不会自动修正，需要再次缓慢改变窗口大小才能恢复。
>
> **复现率**：约 70%（快速拖拽时更高概率出现）
>
> **补充**：该 Bug 属于典型的 **React 过时闭包（stale closure）问题**，在快速连续的状态更新场景下暴露。

---

### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 将 `resize` 函数内的 `setInitConfig((prev) => ({ ...prev, mode }))`（函数式更新，始终基于最新 state）改为 `setInitConfig({ ...initConfig, mode })`（直接使用闭包中的 `initConfig`）。由于 `resize` 函数在组件挂载时被闭包捕获，`initConfig` 始终是挂载时的初始值。当快速 resize 触发多次 `setInitConfig` 时，每次更新都基于**过时的 `initConfig`**，后一次更新可能覆盖前一次尚未提交的更新。 |
| **根因** | 文件 `src/pages/account/settings/index.tsx` 第 60 行附近，`setInitConfig({ ...initConfig, mode })` 在 `requestAnimationFrame` 回调中使用了闭包捕获的 `initConfig` 而非函数式更新 `(prev) => ({ ...prev, mode })`。属于经典的 React state stale closure 问题。 |
| **修复方法** | 将 `setInitConfig({ ...initConfig, mode: ... })` 改回 `setInitConfig((prev) => ({ ...prev, mode: ... }))`，使用函数式更新保证始终基于最新状态。 |
| **考验 AI 能力维度** | ① React state 更新机制深度理解：`setState(value)` vs `setState(prev => newValue)` 的差异<br/>② 过时闭包（stale closure）的识别与修复<br/>③ 竞态条件分析：`requestAnimationFrame` + 快速连续事件 + state 批处理<br/>④ 问题复现思路：需要理解快速 resize 场景下的时序关系<br/>⑤ 与同文件内正确用法（第 99 行 `onClick` 中 `setInitConfig((prev) => ...)`）的对比 |

---

## 附录 A：修改文件清单

| Bug 编号 | 文件路径 | 改动行（参考） | 改动内容摘要 |
|----------|----------|---------------|-------------|
| BUG-1 | `src/pages/list/search/articles/index.tsx` | L254 | `text={item.star}` → `text={item.message}` |
| BUG-2 | `src/pages/table-list/index.tsx` | L39 | 删除 `actionRef.current?.reloadAndRest?.()` |
| BUG-3 | `src/pages/dashboard/monitor/components/ActiveChart/index.tsx` | L28 | `2000` → `100`（setTimeout 延时） |
| BUG-4 | `src/pages/form/step-form/index.tsx` | L217 | `setCurrent(0)` → `setCurrent(1)` |
| BUG-5 | `src/pages/account/settings/index.tsx` | L60 | `setInitConfig((prev) => ...)` → `setInitConfig({ ...initConfig })` |

## 附录 B：AI Coding Agent 能力评估维度

| 能力维度 | 对应 Bug | 说明 |
|----------|----------|------|
| 数据流追踪与字段语义匹配 | BUG-1 | 识别 UI 标签与数据字段的不对应 |
| 组件 API 与数据刷新机制理解 | BUG-2 | 理解 ProTable 的 actionRef 刷新机制 |
| 性能分析与定时器配置 | BUG-3 | 从视觉异常推断配置错误 |
| 多步骤状态管理与索引语义 | BUG-4 | StepsForm 0-based 索引理解 |
| React state 更新模式与闭包陷阱 | BUG-5 | 区分 setState(value) 与 setState(prev=>) |
