# 完整 Harness 设计

## Context

项目是 Windows 上的 pnpm monorepo，业务为 React H5、NestJS、TypeORM、PostgreSQL。已有真实数据库测试和浏览器回归，用户要求按公开实践覆盖完整工程能力。当前主工作区含未提交改动，Docker 中还有其他项目服务。

## Goals / Non-Goals

目标是有实际知识、可执行工具、隔离资源、诊断查询、维护补丁和演练证据的完整闭环。业务接口及数据库结构保持兼容，Git 发布仍由用户控制。

## Decisions

- OpenSpec 是规范和计划唯一来源，docs 提供有来源的长期知识与生成阅读投影。
- 数据库文档通过临时 PostgreSQL 重放迁移并读取 catalog 生成，校验模式不写已跟踪文件。
- 每个实例用运行编号拥有数据库、上传目录、API、Vite 和 LGTM 容器，Docker 随机映射回环端口。
- Node OpenTelemetry 在 Nest/TypeORM 前初始化，适配 ESM hook；采集 HTTP/pg 和业务 span，日志以相同上下文关联。
- 健康接口仅在 Harness 模式启用，敏感字段不写遥测。观测容器限制 2 GiB，启动失败清理已创建资源。
- 维护工作区采用当前源文件快照覆盖临时 detached worktree；补丁相对快照生成，主索引与用户分支保持原状。
- 原生本机自动化调用维护技能，周一至五 09:00，最多一个问题、两轮修复和三十分钟，交付本地补丁和报告。
- CI 执行确定性检查和 Ubuntu 真实运行验收，真实 Agent 演练在本机进行，独立代码评审使用现有角色配置。

## Risks / Trade-offs

当前内存余量有限，双实例观测验收必须实际验证资源条件，失败不能伪报通过。文档结构检查不证明语义正确，需来源核实与真实语义漂移演练。远端 CI 没有真实运行记录时保持待验收。
