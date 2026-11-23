---
name: harness-maintain
description: 执行 ScanOrder 周期知识维护和可复现小缺陷修复，交付本地补丁与报告。
---

# harness-maintain

读取 [工程入口](../../../AGENTS.md) 和 [使用说明](../../../docs/PLANS.md)。

每轮最多一个明确问题、两轮修复和三十分钟。先读取根指引、知识索引、QUALITY_SCORE 和技术债。通过 harness:workspace create 建立当前源码快照及独立 detached worktree，排除环境、上传和运行数据。所有修复在返回的 worktree 内进行，原工作区保持原状。依据实际问题运行最小相关验证，业务复现需要时启动隔离实例。使用独立 code-reviewer 角色并读取 code-review 技能，只评审相对快照的本轮补丁，核实角色配置；不可用或验证失败时报告未完成。harness:workspace patch 编号 输出本轮补丁并记录来源指纹。禁止自动提交、推送、开 PR 或合并，禁止无证据扩大重构。结束停止本轮实例；有补丁的 worktree 保留供用户审阅。只有完成手动试运行后才启用工作日09:00本机自动化。
