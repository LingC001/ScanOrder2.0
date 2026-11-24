---
name: openspec-apply-change
description: 按已授权的 ScanOrder OpenSpec 变更实施任务、执行相关验证并记录证据。用于用户要求实施变更或继续实施的请求。
license: MIT
metadata:
  upstream: OpenSpec 2.1.0
  adaptation: ScanOrder 中文工作流
---

# 实施变更

读取 [工程入口](../../../AGENTS.md) 与 [工作流说明](../../../docs/PLANS.md)，承接已有实施授权。

1. 根据用户指定名称或明确上下文选择变更；有多个候选时用 `pnpm exec openspec list --json` 查明后澄清，不能靠修改时间自动替用户选定。
2. 执行 `pnpm exec openspec status --change 变更名称 --json` 及 `pnpm exec openspec instructions apply --change 变更名称 --json`。
3. 读取返回的 contextFiles、项目 context、operationGuidance、任务来源与 actionContext。路径以 CLI 返回值为准；遵守规划根和实现根的边界，不自行推断外部仓库权限。
4. CLI 状态为 blocked 时先修复缺失制品或跟踪文件，不越过阻塞开始实现；all_done 表示任务已勾选，仍应核对实际验收证据。
5. 查看工作区，保留用户已有改动。按依赖实施未完成任务，相关测试和文档随实现落地；实际完成且对应验证满足后再勾选原任务。
6. 按影响范围运行验证。涉及数据库结构时运行 `pnpm docs:generate` 并校验生成的数据库文档。工程知识依据变化时核实后确认指纹。必要检查必须等待结束并读取退出码，区分单元测试、真实数据库、浏览器自动化、视觉校验与远端 CI。复杂业务复现按需使用隔离运行和观测技能。
7. 记录完成、失败和未执行项目。用户授权包含归档且验收通过时转入归档技能，否则报告当前状态。

发生会改变行为、范围或兼容性的方案偏差时先同步制品；无法独立解决的关键意图再询问用户，不把未通过的检查标记完成。
