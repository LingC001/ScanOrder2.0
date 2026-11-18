---
name: openspec-explore
description: 在 ScanOrder 的 OpenSpec 任务中调查代码、澄清需求和比较方案。用于明确要求探索、讨论或实施前调查的请求，普通明确的小改动直接执行。
license: MIT
metadata:
  upstream: OpenSpec 2.1.0
  adaptation: ScanOrder 中文工作流
---

# 探索需求

读取 [工程入口](../../../AGENTS.md) 与 [工作流说明](../../../docs/PLANS.md)。探索以只读调查为主，先检查代码和已有规范，再询问无法通过仓库确认的重要意图。

1. 在项目根目录执行 `pnpm exec openspec context --json`，以返回的规划根为准；本项目使用仓库内规范，不自动切换外部 store 或初始化其他项目。
2. 读取该根的 `openspec/config.yaml`，通过 `pnpm exec openspec list --specs` 和相关完整规范了解当前行为。
3. 调查相关入口、调用方与测试，说明确认事实、推荐方案及未决问题，避免把默认猜测写成已确认结论。
4. 用户明确要求形成制品时，承接其授权使用提案技能；用户明确要求实施已有方案时转入实施技能。单纯讨论不修改业务代码。

仅澄清会改变范围、接口、兼容性或验收的关键问题；已经授权的事项不重复请求确认。结果使用中文，指出证据与下一步。
