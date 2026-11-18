---
name: openspec-sync-specs
description: 将 ScanOrder 已授权变更的增量规范同步为正式规范。用于明确同步规范或完成变更后的规范合并，保留无关要求与场景。
license: MIT
metadata:
  upstream: OpenSpec 2.1.0
  adaptation: ScanOrder 中文工作流
---

# 同步正式规范

读取 [工程入口](../../../AGENTS.md) 与 [工作流说明](../../../docs/PLANS.md)。

1. 确定变更，执行 `pnpm exec openspec status --change 变更名称 --json`。仅以 `artifactPaths.specs.existingOutputPaths` 为增量来源；没有 specs 制品或具体列表为空时无内容可同步，不能从其他文件推断增量。
2. 同步前读取 `pnpm exec openspec instructions specs --change 变更名称 --json`。命令失败或 JSON 无效时停止，不把读取失败当作没有规则；若上层工作流已提供本次有效快照则直接复用。
3. 读取每个增量及对应主规范，保留能力的完整相对路径，确认真实目标位于 CLI 规划根的 `openspec/specs` 内。上下文和规则约束产出内容，不替代根路径、CLI 状态或用户授权。
4. 语义合并 ADDED、MODIFIED、REMOVED、RENAMED，保留无关正文与场景。新能力仅从 ADDED 创建，Purpose 应描述长期用途；缺少主规范时不能凭 MODIFIED 或 RENAMED 编造旧要求。
5. 删除最后一个要求仅在变更元数据明确 `retire_capabilities: true`、主规范没有其他作者内容且真实目标在规范根内时进行，否则停止并说明冲突。
6. 执行 `pnpm exec openspec validate --specs --strict --no-interactive`；失败视为同步失败，不能继续归档。报告修改的能力与校验结果。

本技能只同步规范，不移动变更目录。正文使用中文，保留校验所需标题和关键字。
