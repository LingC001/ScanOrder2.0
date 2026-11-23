---
name: openspec-update-change
description: 修订 ScanOrder 已有 OpenSpec 方案并同步受影响制品。用于用户要求调整方案、补充决策或消除制品冲突，不用于升级 CLI 或替代业务实施。
license: MIT
metadata:
  upstream: OpenSpec 2.1.0
  adaptation: ScanOrder 中文工作流
---

# 修订已有方案

读取 [工程入口](../../../AGENTS.md) 与 [工作流说明](../../../docs/PLANS.md)。`openspec-update-change` 修订方案，CLI `openspec update` 则刷新生成文件，两者含义不同。

1. 根据明确上下文选择变更，执行 `pnpm exec openspec status --change 变更名称 --json`。路径、制品 ID 和跳过状态以 CLI 为准。
2. 从磁盘读取相关制品、项目配置和受影响代码，明确请求改变的行为及验收标准。
3. 对需要修订的制品读取 `pnpm exec openspec instructions 制品ID --change 变更名称 --json`，使用最新模板和规则。按用户授权同步所有受影响制品，不限于单向下游。
4. 修改现有具体文件；补充 glob 制品时先核对具体目标位于真实变更根内且尚未存在，不能覆盖用户文件或写入模式字符串。跳过的制品保持跳过，缺失依赖先解决。
5. 按需更新任务及验证要求，保留已完成工作的实际记录；重新执行严格变更校验，报告需要重做的实现任务。

修订方案本身不构成额外实施授权；用户已经要求同步实施时转入实施技能。仅在范围有实质扩展或关键意图缺失时询问，不逐文件重复索取已获得的授权。
