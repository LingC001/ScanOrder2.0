# 可靠性与故障处理

订单及明细在同一数据库事务内保存，后续菜单变化不改变订单快照；商家状态更新会锁定订单行，避免并发覆盖。登录会话保存在数据库中，过期或注销后不能继续访问。表结构由显式迁移维护，关闭自动同步。开发数据与测试数据必须分离，数据库和上传目录均需持久化备份。

Harness 模式提供存活和数据库就绪接口。指标支持阈值断言，首次实测建立性能基线；当前尚未建立生产 SLO 和恢复时间目标。

现有 Docker 开发端口为 5433，本地嵌入式 PostgreSQL 默认 5432，应按实际启动方式设置连接；隔离环境使用动态端口。

## 运行诊断与资源回收

启动和停止命令见 [README](../README.md)。实例就绪后可查询其诊断数据：

```powershell
pnpm harness:query logs demo
pnpm harness:query metrics demo scanorder_http_requests_total
pnpm harness:query traces demo
```

通过实例编号、`x-request-id`、`traceparent` 和日志中的 trace ID 关联一次请求。多实例时显式指定编号，读取实际后端结果；没有样本不能作为检查通过。隔离状态不输出内部管理口令，观测端口仅绑定本机回环地址，详情见 [安全边界](SECURITY.md)。

观测镜像按摘要固定，每个容器限制 2 GiB 和 2 CPU。开发数据库和其他项目容器不参与清理。停止时校验工作区、运行编号和资源归属，启动失败也要回收已创建资源；保留失败诊断，不能将清理未完成当成成功。

## 失败与排障

- 环境失败：确认 Node.js 和 pnpm 版本，重新执行冻结锁文件安装，不打印 `.env`。
- 架构失败：按文件、行号和规则修正依赖；不要通过类型导入或相对路径绕过公开边界。
- 链接失败：修复目标文件或相对路径。检查器解析 Markdown 链接与引用链接，不检查代码块中的示例，也不请求外部网站；页内锚点不做自动校验。
- 规范失败：查看 CLI 明细，核对增量与正式要求。标记为「归档兼容性」的提示会使规范门禁失败。归档要求任务完成及验收通过。
- 浏览器缺失：执行 `pnpm exec playwright install chromium`；Linux CI 使用 `--with-deps`。
- 数据库测试失败：查看测试日志和临时实例启动情况。集成测试和端到端测试均使用 `.local` 下独立实例，不需要开发 `.env` 或 Docker；不要切换到开发数据库绕过失败。
- 生成文档失败：从 Ubuntu CI 基础作业日志或本地 `check:generated` 的输出查看失败阶段、子进程退出信息、PostgreSQL 日志和清理结果。
- 端口冲突：隔离测试自动分配端口；开发预览检查 5173、3000，手动预览检查 4173。浏览器访问使用 localhost。

CI 基础验证覆盖 Windows 与 Ubuntu，数据库文档校验、数据库集成、浏览器和观测回归在 Ubuntu 运行。每个作业保存自己的日志和结果，「Harness 合入检查」汇总实际结论。

依据包括 `apps/api/src/orders/orders.service.ts`、`apps/api/src/app.ts`、`compose.yaml`、`scripts/harness/runtime.mjs`、`scripts/harness/observe.mjs`、`scripts/harness/runtime-worker.mjs`、`scripts/harness/runtime-cleanup.mjs`、`scripts/harness/generate-docs.mjs`、`scripts/postgres.mjs`、`scripts/with-postgres.mjs` 和 `playwright.config.ts`。
