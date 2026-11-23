---
name: openspec-archive-change
description: 核对 ScanOrder 已完成变更的任务与验收证据，完成规范同步及归档。用于用户授权归档或已包含归档的完整实施请求。
license: MIT
metadata:
  upstream: OpenSpec 2.1.0
  adaptation: ScanOrder 中文工作流
---

# 归档完成变更

读取 [工程入口](../../../AGENTS.md) 与 [工作流说明](../../../docs/PLANS.md)，承接用户已有归档授权。

1. 确定活动变更，读取 `pnpm exec openspec status --change 变更名称 --json` 和 `pnpm exec openspec list --json`。
2. 在 changes 中精确匹配一个变更，核对非负整数 totalTasks、completedTasks 且后者不大于前者。任务统计以 CLI 解析结果为准；缺少统计或状态读取失败时停止，不靠文件名或制品 done 状态推断任务完成。
3. 制品应为 done 或明确 skipped，跟踪任务全部完成且相关验收通过。缺少证据时补齐验证；失败或确有未完成任务时保留活动变更并报告原因。
4. 读取 `pnpm exec openspec instructions archive --change 变更名称 --json` 的项目上下文与可选 guidance；此附加输入不替代完成状态。说明本地与远端验证的实际范围。
5. 使用项目同步规范技能完成语义合并及正式规范校验；同步失败时不移动变更。
6. 在同步成功且已有归档授权时执行 `pnpm exec openspec archive 变更名称 --skip-specs --yes`，此处跳过的是重复同步，不跳过验证。
7. 归档后执行 `pnpm docs:generate` 更新唯一来源的阅读投影，再执行 `pnpm check:generated`、`pnpm check:knowledge`、`pnpm check:spec` 和 `pnpm check:docs`。来源变化需实际核实文档后再确认指纹。报告归档路径、正式规范及实际验收结果。保留用户未要求修改的全局 CLI 和提示词。
