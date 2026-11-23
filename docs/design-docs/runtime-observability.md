# 隔离运行与观测决策

每个实例拥有临时 PostgreSQL、上传目录、API、Vite 和固定摘要的 LGTM 容器。选择单容器开发观测后端以减少配置面，并通过 Grafana 数据源代理查询日志、指标和追踪。

API 的 OpenTelemetry 在应用导入前初始化，适配 ESM hook。观测容器设置内存和 CPU 上限，按需启动并回收，保留报告。启动、正常关闭、异常恢复和双实例隔离都需要真实测试。

该环境用于开发和验收。现有开发数据库及其他项目容器不参与清理。

依据：`scripts/harness/runtime-worker.mjs`、`apps/api/src/telemetry/bootstrap.ts`。
