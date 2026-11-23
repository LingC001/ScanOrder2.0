# 验收记录

## 环境

- 日期：2026-11-23 至 2026-11-24
- Node.js：24.15.0
- pnpm：11.5.1
- OpenSpec：2.1.0
- PostgreSQL：18，隔离临时实例
- Chromium：Playwright 1.64.1 对应版本
- Docker：29.4.3，Grafana OTLP LGTM `0.11.18`

## 结果

- `pnpm exec openspec validate add-merchant-admin --strict --no-interactive`：通过。
- `pnpm test`：共享契约 2 项、API 单元 8 项、Web 组件 9 项，共 19 项通过。
- `pnpm test:integration`：13 项通过，覆盖旧库回填、独立 schema 回滚、会话边界、分类约束、商品状态、图片快照、订单归属、在售校验、事务回滚、登录限流和部署关闭顾客入口。
- `pnpm test:e2e`：7 项通过，覆盖顾客登录、后台新增分类商品、跨浏览器同账号查单、商家接单完成、后台桌面布局、旧 `/upload` 移除及 375、390、430 像素移动端页面。
- `pnpm verify`：通过，报告 `.local/harness/2026-11-23T15-35-02-002Z-20664-base.md`。
- `pnpm verify:full`：最终通过，报告 `.local/harness/2026-11-23T15-55-51-690Z-10040-full.md`。
- `harness:eval`：双 worktree 端口、数据库、上传目录、日志、指标、数据库追踪和故障清理通过，证据 `.local/harness/evaluations/eval-9995b1f408`。
- 人工查看 1440 像素后台商品页和 375 像素顾客登录页截图，确认布局、图片、状态徽标和操作按钮显示正常。

## 未执行

- 远端 CI 尚未运行，实际结果以推送后的 GitHub Actions 记录为准。
- 本次未连接或迁移开发数据库，只使用隔离测试数据库。
