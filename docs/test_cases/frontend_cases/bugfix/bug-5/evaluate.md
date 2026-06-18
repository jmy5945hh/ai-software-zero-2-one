# BUG-5 修复评分标准

**编号**：BUG-5 | **难度**：⭐⭐⭐⭐ | **满分**：10 分

---

## 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 定位准确度 | 20% | 是否识别出防重复提交缺失的根因 |
| 修复方案质量 | 35% | 防重方案是否完善（UI 层 + 逻辑层） |
| 根因理解 | 25% | 能否解释 `isPending`、`mutate`/`mutateAsync`、ProForm 提交机制 |
| 工程思维 | 20% | 是否考虑了边界情况、通用性、后端协作 |

---

## 评分细则

### 0-2 分：未发现或修复无效

| 分数 | 表现 |
|------|------|
| 0 | 未提交修复，或修复内容与本题无关 |
| 1 | 发现重复提交问题，但采用了无效方案——如仅修改提示文案（把「提交成功」改成「请勿重复点击」），或给按钮加 `disabled` 但没有与异步状态关联（一加载完就永久禁用） |
| 2 | 使用了 `debounce` 或 `throttle` 包裹提交函数——这只能延缓问题，不能真正防止重复提交（如果请求耗时超过 debounce 间隔，仍然会重复） |

### 3-5 分：部分修复

| 分数 | 表现 |
|------|------|
| 3 | 添加了 `useState` 手动管理 `submitting` 状态并绑定到按钮 `loading`，但 `onFinish` 中没有做逻辑层防重判断，存在竞态窗口（状态更新是异步的） |
| 4 | 正确从 `useMutation` 解构了 `isPending` 并绑定到按钮，但未自定义 `submitter`——ProForm 默认 submitter 不感知 `isPending`，所以实际上 loading 没生效 |
| 5 | 正确使用 `submitter.render` 自定义提交按钮并绑定 `isPending` 到 `loading` 属性，但未在 `onFinish` 入口加 `if (isPending) return` 逻辑层防护 |

### 6-8 分：正确修复 + 双层防护

| 分数 | 表现 |
|------|------|
| 6 | 实现了「UI 层 + 逻辑层」双层防护：① `submitter.render` 自定义按钮绑定 `loading={isPending}`；② `onFinish` 入口 `if (isPending) return`。能解释两层各自的必要性 |
| 7 | 在 6 分基础上，能解释为什么 `mutate`（非 `mutateAsync`）不返回 Promise，即使加 `await` 也无法让 ProForm 的 Promise 追踪机制生效——因此必须手动管理 loading |
| 8 | 在 7 分基础上，考虑了错误场景：如果请求失败，`isPending` 必须恢复为 `false`，按钮必须恢复可点击——并验证了 `useMutation` 的 `isPending` 在 `onError` 后会自动重置。或给出了备选方案（改用 `mutateAsync` + `await` + ProForm 自动 Promise 追踪） |

### 9-10 分：卓越修复

| 分数 | 表现 |
|------|------|
| 9 | 在 8 分基础上，额外考虑了：① 组件卸载时取消进行中的请求（`AbortController` / `abortSignal`）；② 后端也应做幂等处理的建议——体现了从前端到全栈的防护思维 |
| 10 | 在 9 分基础上，提取了通用的防重复提交方案——如封装 `useSubmitGuard` Hook、或将防重逻辑抽象为 `ProForm` 的自定义 `submitter` 高阶组件。展示了将单点修复提升为团队基础设施的工程思维 |

---

## 验收检查项

修复完成后，评委将验证以下内容：

- [ ] 快速双击提交按钮，Network 面板中只有 **1 个** POST 请求
- [ ] 提交过程中按钮显示 loading 动画且不可再次点击
- [ ] 提交成功后提示「提交成功」仅出现 1 次
- [ ] 模拟请求失败（如断开网络），按钮恢复可点击状态，可重新提交
- [ ] 使用键盘 Tab 到提交按钮后按 Enter，同样有防重保护（如果实现依赖 `onClick` 而非 `onFinish` 入口的判断）
- [ ] 修复未引入 TypeScript 编译错误或 Lint 告警
