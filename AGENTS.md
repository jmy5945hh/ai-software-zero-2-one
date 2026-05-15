这是一个AI原生研发平台，处于原型构建阶段，目标是给CTO和投资人清晰演示我们的理念和产品形态，在执行任务时，有以下要求：
- 给定的想法/要求不一定对，多和我一起头脑风暴，找到最优解再行动
- 产品设计和功能会经常变动，代码实现尽量模块化，便于打破重组复用
- 注重“真实可体验”，可操作可交互性要强，我们不是在做PPT而是真实产品
- 始终保持当前的UI风格，要有一致性的taste
- 构建中有意义、值得记录的内容放到 /docs 目录沉淀
- 无需构建运行，效果检查和功能验证我来做，有问题和你反馈
- 完成任务complete时，简洁总结即可，不超过三句话。

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.