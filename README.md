# ScanOrder 扫码点餐 H5

基于原 ScanOrder 重构的 pnpm monorepo。前端使用 React 19、TypeScript、Vite 8、Tailwind CSS 4，后端使用 NestJS 12、TypeORM、PostgreSQL 18。

## 现有功能

- 人数选择、商家信息、推荐菜品、分类选菜、图片预览。
- 购物车数量调整、清空、订单备注、模拟下单。
- 订单列表、订单详情、菜品图片上传及新增。
- MongoDB 菜品 JSON 与图片导入 PostgreSQL；不迁移历史订单。

沿用原移动端橙色风格，宽屏居中展示。仅重构原有功能，未实现原占位接口对应的菜品编辑/删除、登录、商家后台或真实支付。订单列表和上传接口延续原项目无登录的行为。

## 环境

- Node.js 24.15 或更新的 Node.js 24 版本。
- pnpm 11.5.1（根目录 `packageManager` 已固定）。
- OpenSpec 2.1.0（项目开发依赖固定），统一使用 `pnpm exec openspec` 调用，避免误用机器上的其他全局版本。
- PostgreSQL 18：可使用 Docker Compose，或项目附带的本地开发启动命令。
- 浏览器：Safari 16.4+、Chrome 111+。

## 本地运行

以下命令均在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:up
pnpm --filter @scanorder/contracts build
pnpm db:migrate
```

没有启动 Docker 时，在独立终端执行 `pnpm db:local`，保持该终端运行，即可替代 `pnpm db:up`。该命令在本机启动真实 PostgreSQL 18.4，监听 `127.0.0.1:5432`，数据保留在项目 `.local/postgres18`；不安装系统服务。Docker 版本为 PostgreSQL 18.6。

当前 Compose 将数据库映射到本机 `5433` 端口。使用 `pnpm db:up` 时，应将 `.env` 中数据库连接的端口设为 `5433`；使用 `pnpm db:local` 时继续使用 `5432`。

数据库建好后，可选导入**演示菜品**（原素材配合演示名称、描述和价格，不代表实际菜单）：

```powershell
pnpm data:import --file examples/foods.json --images-dir examples/images --dry-run
pnpm data:import --file examples/foods.json --images-dir examples/images
pnpm dev
```

前端打开 [http://localhost:5173](http://localhost:5173)，后端默认监听 `127.0.0.1:3000`。菜品上传页面为 [http://localhost:5173/upload](http://localhost:5173/upload)。

根目录 `.env` 配置：

| 变量           | 默认示例                                                    | 说明                                       |
| -------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL` | `postgresql://scanorder:scanorder@127.0.0.1:5432/scanorder` | PostgreSQL 连接                            |
| `PORT`         | `3000`                                                      | 后端端口                                   |
| `HOST`         | `127.0.0.1`                                                 | 后端监听地址                               |
| `UPLOAD_DIR`   | `./uploads`                                                 | 相对项目根目录的图片目录，也可使用绝对路径 |

Vite 将 `/api` 和 `/images` 代理至后端。修改后端端口时，同时通过运行环境变量 `API_PROXY_TARGET` 指定代理目标。手机在同一局域网访问电脑 IP 的 `5173` 端口即可，前端开发服务监听 `0.0.0.0`。

## 工程结构

```text
apps/web              React H5、页面与组件测试
apps/api              NestJS 模块化 API、数据库、图片存储、菜品导入及接口测试
packages/contracts    共享业务类型、金额工具与商家信息
scripts               本地及隔离测试 PostgreSQL 启动工具
tests/e2e             浏览器端到端测试、三个手机宽度的页面截图
examples              演示菜单和原项目图片素材
docs                  工程知识、产品规范及质量验收资料
```

`apps/api/src` 按职责划分为 `config`、`database`、`foods`、`orders`、`storage` 和
`import`。根模块只负责组合；菜品和订单分别拥有自己的模块、实体、DTO、映射及
Repository，图片格式校验和本地文件读写统一由存储模块提供。

商家名称、公告、地址和默认桌号集中在共享包 `SHOP` 常量中。购物车以菜品 UUID 区分同名商品，只在当前 H5 会话的内存中保留。刷新页面会重置购物车和人数，数据库中的订单不受影响。

## 检查与测试

环境诊断使用 `pnpm harness:doctor`，不读取或打印 `.env` 内容，也不要求开发数据库或 Docker 正在运行。项目工具入口如下，按变更影响选择检查：

通过 `pnpm exec openspec --version` 核对项目 OpenSpec 版本。

| 命令                      | 内容                                                 |
| ------------------------- | ---------------------------------------------------- |
| `pnpm check:docs`         | 必备文档、导航、本地链接和技能元数据                 |
| `pnpm check:architecture` | 包边界、依赖方向和文件规模                           |
| `pnpm check:spec`         | OpenSpec 正式规范与活动变更的严格校验                |
| `pnpm check:knowledge`    | 人工维护文档的来源变化                               |
| `pnpm check:generated`    | 规范、计划和数据库生成文档是否过期，需先完成必要构建 |
| `pnpm test:harness`       | 工程检查器和运行工具的行为测试                       |
| `pnpm docs:generate`      | 完成必要构建并生成知识阅读视图和数据库文档           |

工程导航见 [AGENTS.md](AGENTS.md)，完整知识索引见 [docs/README.md](docs/README.md)。
复杂任务通过项目级 OpenSpec 管理，使用 `pnpm exec openspec` 调用固定版本。
任务流程和验证分级见 [PLANS](docs/PLANS.md)，诊断与故障处理见 [RELIABILITY](docs/RELIABILITY.md)。

```powershell
pnpm harness:doctor
pnpm verify
pnpm verify:full
```

`verify` 汇总环境、文档、架构、规范、工具行为、类型、Lint、格式、单测、构建以及知识来源和生成资料检查；
`verify:full` 追加真实数据库、浏览器及双 worktree 隔离、观测与故障清理验收。报告保存在 `.local/harness`。
编排器依次执行检查，首个失败即停止，记录每步退出码和耗时。终端保留原始输出，日志及 JSON、Markdown 报告使用时间和进程号命名；`latest.json`、`latest.md` 保存最近一次结果。
以下原有命令继续支持单独按需执行：

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

集成测试和浏览器测试分别创建隔离的真实 PostgreSQL 18 临时数据库，自动执行迁移并在结束后清理，不读取现有开发数据库。浏览器测试使用生产构建，覆盖下单、上传、订单详情，并保存 375、390、430 像素宽度下七个页面及弹窗的截图。报告位于 `playwright-report`，截图位于 `test-results`。

## 隔离运行

完整业务复现或并行任务需要时，在当前 worktree 的根目录运行：

```powershell
pnpm harness:up demo
pnpm harness:status demo
pnpm harness:down demo
```

每个编号只能创建一次，下次使用新编号。`up` 构建并等待临时 PostgreSQL、Grafana、API 和 Vite 就绪后返回 localhost 地址；`status` 返回实例状态；`down` 按归属回收资源。日常文案或样式小改动按需验证，完整环境按任务启停。

`pnpm harness:eval` 在两个临时 worktree 执行真实隔离、下单、上传、日志、指标、数据库追踪、浏览器和故障清理验收。它需要 Docker、Chromium 及足够运行两套环境的资源，证据位于 `.local/harness/evaluations`，不替代真实 Agent 修复演练。

日志、指标和追踪查询、资源限制与故障排查见 [RELIABILITY](docs/RELIABILITY.md)。计划、维护和演练方法见 [PLANS](docs/PLANS.md)。

## 生产运行

```powershell
pnpm build
pnpm db:migrate
pnpm --filter @scanorder/api start
```

前端构建结果在 `apps/web/dist`，后端在 `apps/api/dist`。静态服务器需将前端页面路由回退至 `index.html`，并把 `/api`、`/images` 反向代理到后端。开发和测试使用的 `vite preview` 不作为生产服务器。上传目录需要持久化，并与 PostgreSQL 数据一同备份。
