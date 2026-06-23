# 任务文件回退设计

## 结论

任务隔离与任务回退是两层能力：Git worktree 适合让 Agent 在独立目录和分支工作，但不能覆盖新项目、普通文件夹，也不能直接表达“恢复到第 8 轮开始时”。当前原型采用“任务 workspace + 平台外置快照仓库”，后续可在云端任务创建阶段把 workspace 实现替换为 worktree，而无需改变回退 API 和 UI。

## 用户能力

- 轮次回退：每次 Agent `turn_start` 前自动保存文件状态，选择某轮后恢复到该轮开始时。
- 文件回退：在 Diff 中选择文件，恢复到任务开始前；任务中新增的文件会被删除。
- 整体回退：恢复整个 workspace 到任务开始前。

回退执行期间若 Agent 仍在运行，服务端拒绝操作，避免刚恢复的文件被正在执行的工具再次覆盖。

代码 Diff 同样由“任务基线 vs 当前外置快照”生成，不依赖 workspace 的 HEAD。因此普通文件夹可以选择变更文件回退；已有 Git 项目在任务开始前就存在的本地改动也不会被误判为本任务产出。

## 快照实现

`RollbackManager` 在 `~/.aiNativeDevPlatform/rollbacks/<task>/objects.git` 创建任务专属的外置 Git 对象库，并使用临时 `GIT_INDEX_FILE` 执行：

1. `git read-tree --empty`
2. `git add -A -- .`
3. `git write-tree`
4. `git commit-tree`

生成的 commit 只作为内容寻址快照，并通过外置对象库中的 `refs/zero-one/*` 保活。用户文件夹只作为 work tree，因此无论它是不是 Git 项目，都不会生成 `.git`；对于已有 Git 项目，也不会写入其对象库、切换分支、移动 HEAD 或修改暂存区。

恢复时只更新 working tree：目标快照存在的文件通过 `git restore --source=<snapshot> --worktree` 恢复，目标快照不存在的任务新增文件会被删除。暂存区保持不变。

## 边界

- 支持 Git 仓库、新项目和任意普通文件夹；运行环境仍需安装 Git，但用户目录无需初始化 Git。
- 遵守 workspace 中的 `.gitignore`，不会快照被忽略的缓存、依赖和密钥文件。这避免将 `node_modules`、构建产物或 `.env` 写入平台对象库；被忽略文件不在整体回退保证范围内。
- 回退只处理文件状态，不自动截断 Agent 对话。回退后继续对话时，应明确告诉 Agent 已回到哪个轮次；后续可把“文件快照 + 对话消息索引”合并为完整任务时间线。

## worktree 演进建议

云端或托管仓库可为每个任务创建 `codex/task-<id>` 分支及 worktree，让任务变更天然不污染主工作目录。任务完成时再提供“合并交付”，任务放弃时直接移除 worktree；轮次、文件和整体回退仍由当前快照层负责。
