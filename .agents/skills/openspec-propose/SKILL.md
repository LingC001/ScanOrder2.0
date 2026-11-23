---
name: openspec-propose
description: 为 ScanOrder 创建 OpenSpec 变更及方案制品。用户明确要求创建，或 AI 按 AGENTS.md 判断任务需要新建 OpenSpec 变更时使用。
license: MIT
metadata:
  upstream: OpenSpec 2.1.0
  adaptation: ScanOrder 中文工作流
---

# 创建方案制品

读取 [工程入口](../../../AGENTS.md) 与 [工作流说明](../../../docs/PLANS.md)。所有 CLI 命令使用项目的 `pnpm exec openspec`。

1. 执行 `pnpm exec openspec context --json`，读取返回根的项目配置及相关完整规范。解析失败时报告原因，不猜测备用根，不自动初始化。
2. 检查活动变更。用户指定了已有变更或已有变更覆盖本次需求时，按工程入口沿用并转入修订或实施技能。需要新建时，根据已明确的需求选择未被占用的 kebab-case 变更名称。
3. 执行 `pnpm exec openspec new change 变更名称`，再执行 `pnpm exec openspec status --change 变更名称 --json`。
4. 按 CLI 返回的依赖顺序，对就绪制品执行 `pnpm exec openspec instructions 制品ID --change 变更名称 --json`，读取当前依赖文件、模板、context 和 rules，再写入其允许的具体路径。glob 必须解析为变更根内具体文件，不直接写 glob。
5. 正文使用中文，保留机器结构标记。proposal 声明能力，specs 描述行为与场景，design 说明决策，tasks 按依赖列出实施和验证。没有规范行为变化时按标准使用 `skip_specs: true`，不编造需求。
6. 以 `status` 检查制品，并执行 `pnpm exec openspec validate 变更名称 --strict --no-interactive`，报告就绪状态及未决项。

本技能负责方案制品。用户只要求方案时完成后交付；用户已经明确授权实施该方案时可转入实施技能，保持授权范围。项目自定义规则通过配置读取，不复制整段上下文到制品中。
