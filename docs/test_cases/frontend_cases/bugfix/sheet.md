# 前端缺陷修复技能大赛 · BUG 埋点方案（修订版）

> 适用项目：Ant Design Pro（Umi Max v4 + antd v6 + ProComponents v3）
> 全部 Bug 均不影响 TypeScript 编译和 Biome Lint，需通过黑盒系统测试（ST）阶段发现。

---

## 修订说明

本方案基于下属提交的初版方案进行评审和修订，主要改进点：

| 改进项 | 初版问题 | 修订方案 |
|--------|---------|---------|
| 难度校准 | BUG-3（改一行数字）标为 ⭐⭐⭐⭐，区分度不足 | 重新标定难度，将 BUG-3 与 BUG-4 交换难度等级，并让 BUG-3 包含「代码审查能力」的考察点 |
| 评分阶梯 | 所有 Bug 只有「找到/没找到」二值判定 | 每个 Bug 设 0-5 分评分细则，考察修复深度和工程素养 |
| 场景覆盖 | 缺少「异步竞态」类企业高频 Bug | 新增 BUG-5（防重复提交缺失），补齐场景矩阵 |
| 位置复用 | BUG-3 和 BUG-4 过于简单，浪费了考核机会 | BUG-4（原 BUG-3）增加代码审查层的考察，让简单 Bug 也能区分水平 |

---

## 一、BUG 总览

| 编号 | 分类 | 注入页面 / 路径 | Bug 简述 | 难度 | 满分 |
|------|------|-----------------|----------|------|------|
| BUG-1 | 数据展示 | 搜索列表 → 文章 | 文章收藏数错误显示为评论数 | ⭐⭐ | 3 |
| BUG-2 | 数据刷新 | 表格列表 | 批量删除成功后表格数据不刷新 | ⭐⭐⭐ | 5 |
| BUG-3 | 交互流程 | 表单 → 分步表单 | 完成转账后「再转一笔」跳转到确认页而非第一步 | ⭐⭐ | 3 |
| BUG-4 | 性能 / 代码审查 | 仪表盘 → 监控页 | 活动图表刷新频率异常高，且代码存在可优化点 | ⭐⭐⭐ | 5 |
| BUG-5 | 数据提交 | 表单 → 基础表单 | 提交按钮缺少 loading 防重，可被快速双击重复提交 | ⭐⭐⭐⭐ | 5 |
| BUG-6 | 状态管理 | 个人设置页 | 窗口缩放时菜单模式切换偶尔失效（过时闭包） | ⭐⭐⭐⭐⭐ | 5 |

**难度梯度**：⭐⭐（2 个入门）→ ⭐⭐⭐（2 个进阶）→ ⭐⭐⭐⭐（1 个挑战）→ ⭐⭐⭐⭐⭐（1 个深水区）

---

## 二、评分体系

### 2.1 通用评分标准

| 分数 | 含义 | 典型表现 |
|------|------|---------|
| 0 | 未发现 Bug | 未在代码中定位到问题行 |
| 1 | 发现了问题但修复思路错误 | 定位到了可疑区域，但修改了无关代码或引入了新问题 |
| 2 | 正确修复但方案不完整 | 改了核心行，但遗漏了关联影响或未做验证 |
| 3 | 正确修复 + 理解根因 | 修复正确，能清楚解释为什么出问题、为什么这样修 |
| 4 | 正确修复 + 工程化改进 | 在修复基础上，对相关代码做了防御性加固或类型安全改进 |
| 5 | 正确修复 + 测试覆盖 | 修复并编写了可复现的测试用例，或提出了防止回归的方案 |

### 2.2 评分原则

- **不只看结果，更看过程**：两选手都改了同一行代码，但能讲清楚「为什么是这行」「为什么不是其他行」的应得更高分。
- **鼓励预防性思维**：修复当前 Bug 的同时，指出同类代码存在相同风险模式的，应加分。
- **不惩罚「过度工程」**：对于简单 Bug（满分 3 分），选手如果做了深度改进（如加类型约束），仍按满分计，不计溢出。

---

## 三、BUG 详细设计

---

### BUG-1：文章列表收藏数显示错误

**页面/路径**：`/list/search/articles`

**难度**：⭐⭐（入门级）

**满分**：3 分

#### 测试描述（模仿测试人员口吻）

> **测试步骤**：
> 1. 进入「列表」→「搜索列表」→「文章」页面
> 2. 观察列表中每篇文章底部的操作栏图标与数字
> 3. 对比「收藏」图标（星形 ⭐）旁边的数字与「评论」图标（消息 💬）旁边的数字
>
> **预期结果**：收藏数（星形图标）和评论数（消息图标）显示各自不同的数值
>
> **实际结果**：收藏数（星形图标）显示的数字**与评论数完全相同**。两个独立统计指标展示了相同的数据。
>
> **复现率**：100%，页面加载即可见。

#### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 将 `<IconText>` 组件中收藏（star）图标的 `text` 属性从 `item.star` 改为 `item.message`。两个字段都是 `number`，TypeScript 不报错，但呈现的数据语义错误。 |
| **根因** | 文件 `src/pages/list/search/articles/index.tsx` 第 254 行，`<IconText key="star" type="star-o" text={item.star} />` → 改为 `text={item.message}`（注入时）。字段映射错误：`text` 应为 `item.star`（收藏数），错误地绑定到了 `item.message`（评论数）。 |
| **修复方法** | 将 `text={item.message}` 改回 `text={item.star}`。 |

#### 评分细则

| 分数 | 判定标准 |
|------|---------|
| 0 | 未定位到 L254，或定位到但未正确修改 |
| 1 | 定位到 L254 但修改错误（如改成了 `item.like` 或其他字段） |
| 2 | 正确将 `text={item.message}` 改回 `text={item.star}` |
| 3 | 完成修复并验证了同组另外两个 IconText（like、message）的字段绑定也是正确的，或提出「给 IconText 的 type 与数据字段建立编译期映射」的改进建议 |

#### 考察维度

- ① 数据字段与 UI 标签的语义对应分析
- ② 同组多个 IconText 的对比检查能力
- ③ 理解数据模型 `ListItemDataType` 中各字段含义（`star`/`like`/`message` 是三个独立字段）

**企业场景对应**：Code Review 中 copy-paste 导致的字段错位，是极高频率的缺陷类型。

---

### BUG-2：批量删除后表格数据不更新

**页面/路径**：`/list/table-list`

**难度**：⭐⭐⭐（进阶级）

**满分**：5 分

#### 测试描述（模仿测试人员口吻）

> **测试步骤**：
> 1. 进入「列表」→「查询表格」页面
> 2. 勾选表格中若干条数据
> 3. 点击底部操作栏的「批量删除」按钮
> 4. 观察表格数据变化，确认提示消息
>
> **预期结果**：删除成功后，提示"删除成功"，表格数据自动刷新，被删除的记录不再显示
>
> **实际结果**：弹出「Deleted successfully and will refresh soon」成功提示，但**表格中的数据并未刷新**，被删除的记录仍然存在。手动刷新页面（或切换页面）后数据才会更新。
>
> **复现率**：100%

#### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 在 `useMutation` 的 `onSuccess` 回调中，删除 `actionRef.current?.reloadAndRest?.()` 调用。ProTable 通过 `actionRef` 暴露 `reloadAndRest()` 来触发表格重新请求数据；删除后，虽然后续的 `queryClient.invalidateQueries` 仍在，但 ProTable 的 `request` 属性并非 React Query 驱动（传入的是原始请求函数 `rule`），`invalidateQueries` 对表格实际不生效。 |
| **根因** | 文件 `src/pages/table-list/index.tsx` 第 38-43 行，`onSuccess` 回调中缺少 `actionRef.current?.reloadAndRest?.()`。 |
| **修复方法** | 在 `queryClient.invalidateQueries` 之前重新添加 `actionRef.current?.reloadAndRest?.()`。 |

#### 评分细则

| 分数 | 判定标准 |
|------|---------|
| 0 | 未定位到 `onSuccess` 回调 |
| 1 | 找到了 `onSuccess` 但修改了无关逻辑（如只修改了提示文案、或误改了 `onError`） |
| 2 | 正确添加回 `actionRef.current?.reloadAndRest?.()` |
| 3 | 完成修复并能解释：为什么 `invalidateQueries` 单独存在时表格不刷新（因为 ProTable 的 `request` 属性传入的是原始函数而非 React Query 的 queryFn，表格内部维护自己的数据状态） |
| 4 | 在修复基础上，处理了边界情况——如删除后清空 `selectedRows`（已在第 39 行），或指出 `invalidateQueries` 在此场景的冗余性及其仍应保留的理由（其他组件可能消费同一 queryKey） |
| 5 | 修复 + 提出回归测试方案（如：编写测试用例，模拟删除操作后验证 `actionRef.reloadAndRest` 被调用） |

#### 考察维度

- ① ProTable 数据刷新机制的理解（`actionRef.reload/reloadAndRest` vs React Query `invalidateQueries`）
- ② Mutation 成功回调中状态同步的完整性检查（不仅要刷新表格，还要清空选中行）
- ③ 理解「删除成功但数据未刷新」现象背后的因果链

**企业场景对应**：ProTable 是企业后台最高频使用的数据展示组件，不理解其刷新机制会导致大量「操作成功但界面不更新」的线上 Bug。

---

### BUG-3：分步表单「再转一笔」跳转错误

**页面/路径**：`/form/step-form`

**难度**：⭐⭐（入门级）

**满分**：3 分

#### 测试描述（模仿测试人员口吻）

> **测试步骤**：
> 1. 进入「表单」→「分步表单」页面
> 2. 第一步填写转账信息并提交
> 3. 第二步确认转账信息并提交（输入支付密码）
> 4. 第三步显示「操作成功」结果页
> 5. 点击「再转一笔」按钮
>
> **预期结果**：回到第一步「填写转账信息」的空白表单，允许用户开始新的转账
>
> **实际结果**：点击「再转一笔」后，**跳转到了第二步「确认转账信息」页面**，显示上一次的转账数据和支付密码输入框。用户无法重新填写转账信息，需要手动点击上一步。
>
> **复现率**：100%

#### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | `StepsForm` 的步骤索引从 0 开始（Step 0 = 填写信息、Step 1 = 确认、Step 2 = 完成）。在「完成」步骤的「再转一笔」按钮回调中，将 `setCurrent(0)` 改为 `setCurrent(1)`，使其跳转至确认步骤（Step 1）而非第一步（Step 0）。 |
| **根因** | 文件 `src/pages/form/step-form/index.tsx` 第 217 行，`setCurrent(0)` → 改为 `setCurrent(1)`（注入时），步骤索引错误。 |
| **修复方法** | 将 `setCurrent(1)` 改回 `setCurrent(0)`。 |

#### 评分细则

| 分数 | 判定标准 |
|------|---------|
| 0 | 未定位到 `onFinish` 回调中的 `setCurrent` 调用 |
| 1 | 定位到了但修改错误（如改成 `setCurrent(2)` 或其他值） |
| 2 | 正确将 `setCurrent(1)` 改回 `setCurrent(0)` |
| 3 | 完成修复并验证 `form.resetFields()` 也在同一回调中正确调用（清空表单数据），确保「再转一笔」的完整体验是「回到空白的第一步」；或指出 StepsForm 的 current prop 以 0 为起始的设计约定 |

#### 考察维度

- ① 理解 StepsForm 的步骤索引（0-based）
- ② 追踪用户操作链路：完成 → 再转一笔 → 预期落地页
- ③ 关注 resetFields 与 setCurrent 的配合（只改 current 但不重置表单会导致第一步显示旧数据）

**企业场景对应**：多步骤向导（wizard）是金融、政务类应用的常见交互模式，步骤索引错误会导致用户流程断裂。

---

### BUG-4：监控页活动图表异常高频刷新

**页面/路径**：`/dashboard/monitor` → 「活动情况预测」区域

**难度**：⭐⭐⭐（进阶级，含代码审查加分项）

**满分**：5 分

#### 测试描述（模仿测试人员口吻）

> **测试步骤**：
> 1. 进入「仪表盘」→「监控页」
> 2. 观察右侧「活动情况预测」区域中的面积图
> 3. 保持页面静止，持续观察图表变化
>
> **预期结果**：图表数据按合理间隔（如 2 秒）平滑更新，视觉上无明显闪烁
>
> **实际结果**：图表**每秒更新约 10 次**，曲线剧烈跳动，数据值快速闪烁变化，完全无法阅读。同时可观察到浏览器 CPU 占用明显升高，页面滚动出现卡顿。
>
> **补充**：打开 Chrome DevTools → Performance 面板录制几秒，可看到密集的 `setTimeout` 回调触发和 React 重渲染火焰图。
>
> **复现率**：100%

#### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 将 `window.setTimeout(loopData, 2000)` 的延时参数从 `2000`（2 秒）改为 `100`（0.1 秒），使定时器每 100ms 触发一次，执行 `setActiveData(getActiveData())` 生成随机数据并触发 React 重渲染。 |
| **根因** | 文件 `src/pages/dashboard/monitor/components/ActiveChart/index.tsx` 第 28 行，`window.setTimeout(loopData, 100)` 延时值过短。 |
| **修复方法** | 将 `100` 改回 `2000`（或 >= 1000 的合理值）。 |

#### 评分细则

| 分数 | 判定标准 |
|------|---------|
| 0 | 未定位到定时器相关代码 |
| 1 | 定位到了 `setTimeout` 但修改了无关内容（如改了 `getActiveData` 的逻辑） |
| 2 | 正确将 `setTimeout(loopData, 100)` 的延时改回 `2000`（或 >= 1000 的合理值） |
| 3 | 完成修复并能解释：过短的延时 → 高频 setState → 高频重渲染 → 页面闪烁/卡顿 的完整因果链；且能说明 Performance 面板中如何定位此类问题 |
| 4 | 在修复基础上，指出 `getActiveData()` 使用 `Math.random()` 每次生成全新随机数据的问题——即使间隔正常（2s），数据完全没有连续性，图表仍会有视觉跳动。提出改进建议（如基于上一轮数据做增量变化、或使用平滑过渡） |
| 5 | 修复 + 提出定时器管理的最佳实践（如使用 `useRef` 存储 timer ID、确保 cleanup 函数正确清除定时器——当前代码已正确实现，选手应能指出这是正确的模式并解释为什么） |

#### 考察维度

- ① 从「页面闪烁/卡顿」现象推断定时器频率异常
- ② Performance 面板定位高频 `setTimeout` 调用的能力
- ③ 区分「配置错误」（100ms 不合理）与「设计意图」
- ④（高阶）对 `Math.random()` 数据生成策略的代码审查意识

**企业场景对应**：数据看板/大屏类页面的性能问题是企业前端的高频缺陷类型。这类 Bug 通常不是逻辑错误，而是参数/配置错误，但排查过程考验工程师的性能分析能力。

---

### BUG-5：基础表单缺少防重复提交机制

**页面/路径**：`/form/basic-form`

**难度**：⭐⭐⭐⭐（挑战级）

**满分**：5 分

> **说明**：这是修订版新增的 Bug，初版方案中缺少「异步竞态」类企业高频 Bug。

#### 测试描述（模仿测试人员口吻）

> **测试步骤**：
> 1. 进入「表单」→「基础表单」页面
> 2. 填写各表单项（标题、起止日期、目标描述、衡量标准等）
> 3. **快速连续点击两次**「提交」按钮（模拟用户手抖或网络延迟场景）
> 4. 观察页面反馈和网络请求
>
> **预期结果**：点击一次提交后，按钮进入 loading 状态并禁用，无法再次点击，最终只产生一次提交请求
>
> **实际结果**：快速双击时，**产生了两次提交请求**（可在 Network 面板中看到两个 POST 请求）。若后端未做幂等处理，将导致两条重复数据。成功后提示消息也出现了两次。
>
> **复现率**：约 80%（取决于点击速度，手动双击几乎必现）

#### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 该 Bug 利用了一个极易被忽视的细节：`useMutation` 返回 `isPending` 但当前代码未解构使用；`onFinish` 声明为 `async` 但未 `await run(values)`，导致 ProForm 的内置 Promise 追踪形同虚设（async 函数瞬间 resolve）。注入后，用户快速双击提交按钮即可绕过前端的防重保护。<br/>**注入方式**：确保代码处于「缺少防重」状态——① `useMutation` 不解构 `isPending`；② `onFinish` 中不 `await` mutation 调用；③ 未使用 `submitter.render` 自定义带 loading 的按钮。当前 `src/pages/form/basic-form/index.tsx` 已处于此状态，若重构为正确版本后需还原至此状态。 |
| **根因** | 文件 `src/pages/form/basic-form/index.tsx` 第 21 行 `useMutation` 未解构 `isPending`（`const { mutate: run } = useMutation({...})`），第 28-30 行 `onFinish` 未 `await run(values)`。两个因素叠加：`mutate`（非 `mutateAsync`）不返回 Promise，即使加 `await` 也无意义；ProForm 默认 submitter 不感知外部 `isPending` 状态。结果是提交按钮在异步请求进行中仍可点击，快速双击产生两次 POST 请求。 |
| **修复方法** | 推荐方案（利用现有 `useMutation`）：① 解构 `isPending`：`const { mutate: run, isPending } = useMutation({...})`；② 使用 `submitter.render` 将 `isPending` 绑定到提交按钮的 `loading` 属性；③ （可选）在 `onFinish` 入口加 `if (isPending) return` 做逻辑层兜底。备选方案：改用 `mutateAsync` 并在 `onFinish` 中 `await`，利用 ProForm 对 Promise 的自动 loading 管理。 |

#### 评分细则

| 分数 | 判定标准 |
|------|---------|
| 0 | 未发现重复提交问题，或未找到表单提交相关代码 |
| 1 | 发现重复提交现象，但修复方案错误（如仅用 `debounce` 包裹点击事件，治标不治本） |
| 2 | 正确添加了 loading/disabled 状态，但仅在 UI 层阻止（如 `disabled={submitting}`），未考虑键盘提交等入口 |
| 3 | 使用 `useMutation` 的 `isPending`（或自定义 `useState`）正确管理提交状态，同时在 `onFinish` 入口处做防重判断（如 `if (submitting) return`），实现「UI 层 + 逻辑层」双重防护 |
| 4 | 在「3」的基础上，考虑到了：① 组件卸载时取消进行中的请求（AbortController）；② 或使用 `useMutation` 的错误处理确保失败后按钮仍能恢复；③ 给出了后端也应做幂等处理的建议 |
| 5 | 修复 + 提取了通用的 `useSubmitGuard` Hook 或 HOC，展示了对防重复提交这一通用问题的抽象能力。或编写了模拟快速双击的测试用例 |

#### 考察维度

- ① 异步操作中 UI 状态同步的完整性（loading 不是装饰，是功能）
- ② 防重复提交的双层防护思路（前端 UI 层 + 前端逻辑层 + 后端幂等）
- ③ 竞态条件的时间窗口理解
- ④ 对 ProForm 提交机制的理解（`onFinish` 返回 Promise、`submitter.render` 自定义等）

**企业场景对应**：支付、下单、审批等关键操作中的重复提交，是金融/电商类应用的一级事故。这也是前端面试和代码审查中的高频考点。

#### 注入代码对照

**Bug 状态（当前代码）**：

```tsx
// src/pages/form/basic-form/index.tsx
const BasicForm: FC<Record<string, any>> = () => {
  const { styles } = useStyles();
  const queryClient = useQueryClient();
  const { mutate: run } = useMutation({           // ← 未解构 isPending
    mutationFn: fakeSubmitForm,
    onSuccess: () => {
      message.success('提交成功');
      queryClient.invalidateQueries({ queryKey: ['basic-form'] });
    },
  });
  const onFinish = async (values: Record<string, any>) => {
    run(values);                                    // ← 未 await，Promise 瞬间 resolve
  };
  return (
    <PageContainer content="...">
      <Card variant="borderless">
        <ProForm
          onFinish={onFinish}                       // ← 使用默认 submitter，无 loading 绑定
          // ... 表单项
        />
      </Card>
    </PageContainer>
  );
};
```

**修复后（正确版本）**：

```tsx
const BasicForm: FC<Record<string, any>> = () => {
  const { styles } = useStyles();
  const queryClient = useQueryClient();
  const { mutate: run, isPending } = useMutation({ // ← 解构 isPending
    mutationFn: fakeSubmitForm,
    onSuccess: () => {
      message.success('提交成功');
      queryClient.invalidateQueries({ queryKey: ['basic-form'] });
    },
  });
  const onFinish = async (values: Record<string, any>) => {
    if (isPending) return;                          // ← 逻辑层防重兜底
    run(values);
  };
  return (
    <PageContainer content="...">
      <Card variant="borderless">
        <ProForm
          onFinish={onFinish}
          submitter={{
            render: (props) => [
              <Button
                type="primary"
                loading={isPending}                 // ← UI 层防重
                onClick={() => props.form?.submit?.()}
              >
                提交
              </Button>,
            ],
          }}
          // ... 表单项
        />
      </Card>
    </PageContainer>
  );
};
```

> **注入操作**：从「修复后」版本回退到「Bug 状态」版本，即删除 `isPending` 解构、`submitter.render` 自定义按钮、`if (isPending) return` 守卫这三处。
```

---

### BUG-6：设置页窗口缩放时菜单模式切换偶发失效

**页面/路径**：`/account/settings`

**难度**：⭐⭐⭐⭐⭐（深水区）

**满分**：5 分

#### 测试描述（模仿测试人员口吻）

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

#### Cheat-Sheet

| 维度 | 内容 |
|------|------|
| **逆向构造思路** | 将 `resize` 函数内的 `setInitConfig((prev) => ({ ...prev, mode }))`（函数式更新，始终基于最新 state）改为 `setInitConfig({ ...initConfig, mode })`（直接使用闭包中捕获的 `initConfig`）。由于 `resize` 函数在组件挂载时通过 `resizeRef` 被闭包捕获，每次快速 resize 触发多次 `setInitConfig` 时，每次更新都基于**过时的 `initConfig`**，后一次更新可能覆盖前一次尚未提交的更新。 |
| **根因** | 文件 `src/pages/account/settings/index.tsx` 第 60 行，`setInitConfig((prev) => ({ ...prev, mode }))` → 改为 `setInitConfig({ ...initConfig, mode: ... })`（注入时），在 `requestAnimationFrame` 回调中使用了闭包捕获的 `initConfig` 而非函数式更新。属于经典的 React state stale closure 问题。 |
| **修复方法** | 将 `setInitConfig({ ...initConfig, mode: ... })` 改回 `setInitConfig((prev) => ({ ...prev, mode: ... }))`，使用函数式更新保证始终基于最新状态。 |

#### 评分细则

| 分数 | 判定标准 |
|------|---------|
| 0 | 未定位到 `resize` 函数及其 `setInitConfig` 调用 |
| 1 | 发现菜单模式不更新，但错误地认为是 CSS 媒体查询问题或事件监听问题 |
| 2 | 正确将 `setInitConfig({ ...initConfig, mode })` 改为 `setInitConfig((prev) => ({ ...prev, mode }))`，但解释不清楚为什么函数式更新能解决问题 |
| 3 | 完成修复并能解释：① 闭包捕获的是挂载时的 `initConfig` 值；② 快速 resize 时 `setInitConfig` 的批处理导致基于旧值的更新覆盖新值的更新；③ 函数式更新 `(prev) => ...` 如何保证始终基于最新状态 |
| 4 | 在「3」的基础上，指出代码中已有正确用法的对比——第 99 行 `onClick` 中 `setInitConfig((prev) => ...)` 是正确写法，说明选手具备对比审查的能力；或指出 `resizeRef.current = resize` 模式在此场景下的必要性（保证最新的 `resize` 引用被事件监听器调用） |
| 5 | 修复 + 提出「如何从工程层面防止此类问题」的建议（如：ESLint 规则强制要求依赖 state 的 setter 使用函数式更新、Code Review checklist 中加入 stale closure 检查项、或使用 `useReducer` 替代复杂的状态更新逻辑） |

#### 考察维度

- ① React state 更新机制深度理解：`setState(value)` vs `setState(prev => newValue)` 的本质差异
- ② 过时闭包（stale closure）的识别与修复——React 面试和高级开发的标志性技能
- ③ 竞态条件的时间序列分析：`requestAnimationFrame` + 快速连续事件 + state 批处理
- ④ 问题复现思路：需要理解快速 resize 场景下的时序关系
- ⑤ 与同文件内正确用法（第 99 行 `onClick` 中 `setInitConfig((prev) => ...)`）的对比审查能力

**企业场景对应**：过时闭包是 React Hooks 时代最常见的「隐蔽 Bug」之一，在 ResizeObserver、WebSocket 回调、定时器等长期存在的闭包场景中高频出现。能独立排查此类 Bug 是高级前端工程师的标志。

---

## 四、修改文件清单（注入参考）

| Bug 编号 | 文件路径 | 改动行（参考） | 改动内容摘要（当前正确 → 注入后错误） |
|----------|----------|---------------|------------------------------------------|
| BUG-1 | `src/pages/list/search/articles/index.tsx` | L254 | `text={item.star}` → `text={item.message}` |
| BUG-2 | `src/pages/table-list/index.tsx` | L40 | 删除 `actionRef.current?.reloadAndRest?.()` |
| BUG-3 | `src/pages/form/step-form/index.tsx` | L217 | `setCurrent(0)` → `setCurrent(1)` |
| BUG-4 | `src/pages/dashboard/monitor/components/ActiveChart/index.tsx` | L28 | `2000` → `100`（setTimeout 延时） |
| BUG-5 | `src/pages/form/basic-form/index.tsx` | L21, L28-30, L34 | 删除 `isPending` 解构 + 删除 `await` + 移除 `submitter.render` 自定义按钮 |
| BUG-6 | `src/pages/account/settings/index.tsx` | L60 | `setInitConfig((prev) => ...)` → `setInitConfig({ ...initConfig })` |

---

## 五、AI Coding Agent 能力评估维度

| 能力维度 | 对应 Bug | 权重 | 说明 |
|----------|----------|------|------|
| 数据流追踪与字段语义匹配 | BUG-1 | 15% | 识别 UI 标签与数据字段的不对应 |
| 组件 API 与数据刷新机制理解 | BUG-2 | 20% | 理解 ProTable actionRef 刷新机制 |
| 多步骤状态管理 | BUG-3 | 10% | StepsForm 0-based 索引与表单重置 |
| 性能分析与定时器配置 | BUG-4 | 20% | 从视觉异常推断配置错误 + 代码审查 |
| 异步竞态与防重机制 | BUG-5 | 15% | 前端防重复提交的完整方案 |
| React 闭包陷阱与状态更新 | BUG-6 | 20% | setState(value) vs setState(prev=>) |

---

## 六、赛事组织建议

### 6.1 赛制

| 阶段 | 时长 | 内容 |
|------|------|------|
| 环境准备 | 赛前 30min | 选手 Clone 含 Bug 的分支，确认 `npm start` 可正常启动 |
| 发现与修复 | 90-120min | 选手通过黑盒测试 + 代码审查逐个发现和修复 Bug |
| 提交与评审 | 30-60min | 选手提交修复后的分支 / Patch，评委逐项评分 |
| 答辩（可选） | 每人 5-10min | 选手讲解最难 Bug（BUG-6）的排查思路和修复方案 |

### 6.2 选手须知

- **可使用**：Chrome DevTools（Network / Performance / React DevTools）、VS Code 搜索、Ant Design 官方文档、ProComponents 文档
- **不可使用**：AI 编程助手（如果比赛目的就是评估 AI Coding Agent 能力，则反之——必须使用 AI 助手）
- **评分依据**：按各 Bug 的评分细则打分，总分 26 分（3+5+3+5+5+5）

### 6.3 注入注意事项

1. **创建独立分支**：`competition/bug-hunt-2026`，所有 Bug 注入到此分支
2. **验证编译与 Lint**：注入后执行 `npm run lint` 和 `npm run tsc`，确保全部通过，否则选手可能通过静态检查直接定位 Bug
3. **验证复现**：逐一按测试描述手动验证每个 Bug 可复现
4. **快照备份**：保留一份未注入 Bug 的正确代码副本，用于赛后对照
5. **BUG-5 特殊说明**：该 Bug 的注入位置依赖当前基础表单页的实际代码结构，注入前需先阅读 `src/pages/form/basic-form/index.tsx` 确认注入点。如该页面已使用 `useMutation` 且正确传递了 `isPending`，则需额外处理

### 6.4 奖项建议

| 奖项 | 条件 | 说明 |
|------|------|------|
| 一等奖 | 总分 ≥ 22 | 发现并高质量修复全部或几乎所有 Bug |
| 二等奖 | 总分 ≥ 16 | 发现并修复大部分 Bug，修复质量良好 |
| 三等奖 | 总分 ≥ 10 | 发现并修复了主要 Bug |
| 最佳排查奖 | BUG-6 得分 ≥ 4 | 对最难的过时闭包问题有深入理解 |
| 最佳工程奖 | 单 Bug 得分出现 5 分 | 修复方案达到测试覆盖或预防性工程化水平 |

---

## 附录：初版方案评审纪要

### 设计亮点（予以保留）

1. **Bug 选型贴合企业场景**：字段映射错误、数据刷新遗漏、定时器配置错误、步骤索引错误、过时闭包——这些都是真实的「程序员写出来的 Bug」，而非教科书式的人造题。
2. **通过 TypeScript/Lint 的 Bug**：所有 Bug 在编译和 Lint 层面均无告警，必须通过系统测试发现，符合「黑盒测试」的大赛设定。
3. **Cheat-Sheet 格式**：为赛事组织者提供了清晰的注入指南和预期修复方案，开箱即用。

### 主要问题与改进

1. **评分体系缺失**：初版仅有「找到/没找到」二值判定，无法区分修复质量。修订版为每个 Bug 设计了 0-5 分评分细则。
2. **难度标注不准确**：BUG-3（改一行数字）标注为 ⭐⭐⭐⭐，实际难度仅 ⭐⭐。修订版重新标定了全部难度。
3. **场景覆盖缺口**：缺少「异步竞态/防重复提交」这一企业高频 Bug 类型。修订版新增 BUG-5 弥补。
4. **BUG-4 考察点单一**：初版 BUG-3（现 BUG-4）仅考察改定时器参数，修订版增加了对 `Math.random()` 数据生成策略的代码审查层，让简单 Bug 也能区分水平。
