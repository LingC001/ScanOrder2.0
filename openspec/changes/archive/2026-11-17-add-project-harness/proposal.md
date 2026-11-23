# 工程 Harness 提案

## Why

项目已有业务与测试工具，但缺少仓库内的 Agent 导航、规范驱动任务流程和统一检查入口。建立可读、可执行、可验证的工程环境，使后续改动能遵循一致边界并提供实际验收证据。

## What Changes

- 建立中文 Agent 指引、架构地图、知识索引及运行说明。
- 锁定项目 OpenSpec 2.1.0，接入六个项目级中文工作流技能。
- 增加环境诊断、文档和架构检查、规范校验及统一验证编排。
- 增加行为测试和 Windows／Ubuntu GitHub Actions。

## Capabilities

### New Capabilities

- `engineering-harness`：工程上下文导航、可执行规则、验证反馈及规范驱动的任务生命周期。

### Modified Capabilities

无。

## Impact

修改根工程脚本与开发依赖，新增项目指引、文档、OpenSpec 制品、检查器、测试和 CI。业务接口、数据库结构和产品页面保持当前行为。已有用户授权包含本方案实施与完成后的归档。
