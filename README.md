# ScanOrder 扫码点餐 H5

基于原 ScanOrder 重构的 pnpm monorepo。前端使用 React 19、TypeScript、Vite 8、Tailwind CSS 4，后端使用 NestJS 12、TypeORM、PostgreSQL 18。

## 项目介绍

这是个人AI Coding 学习项目，业务为点餐系统，包含客户端和商家管理端，是基于TS的全栈项目。

## 现有功能

- 人数选择、商家信息、推荐菜品、分类选菜、图片预览。
- 购物车数量调整、清空、订单备注、模拟下单。
- 固定顾客账号登录、本人订单列表及详情。
- 商家后台商品、分类和订单管理，支持商品上下架、归档恢复及订单接单、完成和取消。
- MongoDB 菜品 JSON 与图片导入 PostgreSQL；不迁移历史订单。

沿用原移动端橙色风格，宽屏居中展示。商家后台位于 `/admin`，移动端点餐保留独立宽度。顾客登录入口默认与本机联调共用，生产环境必须替换商家凭据，并按部署场景决定是否开启固定顾客账号。当前订单仍不包含真实支付。

## 环境

- Node.js 24.15 或更新的 Node.js 24 版本。
- pnpm 11.5.1（根目录 `packageManager` 已固定）。
- OpenSpec 2.1.0（项目开发依赖固定），统一使用 `pnpm exec openspec` 调用，避免误用机器上的其他全局版本。
- PostgreSQL 18：可使用 Docker Compose，或项目附带的本地开发启动命令。
- 浏览器：Safari 16.4+、Chrome 111+。

## 本地运行

在项目根目录安装依赖，首次运行时创建 `.env`。

```powershell
pnpm install --frozen-lockfile
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

### 选择一种数据库启动方式

**项目自带 PostgreSQL**。确认 `.env` 的 `DATABASE_URL` 使用 `127.0.0.1:5432`。另开终端运行以下命令，看到 PostgreSQL 启动后保持终端打开。数据保存在项目的 `.local/postgres18`。

```powershell
pnpm db:local
```

**Docker Compose**。启动 Docker 后，先把 `.env` 的 `DATABASE_URL` 端口改为 `5433`，再运行以下命令，等待数据库就绪。

```powershell
pnpm db:up
```

### 执行迁移并启动应用

在运行迁移的终端确认数据库端口与所选方式一致。若终端已设置 `DATABASE_URL` 环境变量，它会优先于 `.env`。

```powershell
pnpm --filter @scanorder/contracts build
pnpm db:migrate
```

迁移完成后，可选导入**演示菜品**（使用原素材和演示名称、描述、价格）。

```powershell
pnpm data:import --file examples/foods.json --images-dir examples/images --dry-run
pnpm data:import --file examples/foods.json --images-dir examples/images
```

启动前端和后端。

```powershell
pnpm dev
```

前端打开 [http://localhost:5173](http://localhost:5173)，后端默认监听 `127.0.0.1:3000`。顾客首次进入时登录默认顾客账号；商家后台为 [http://localhost:5173/admin](http://localhost:5173/admin)。

`.env.example` 的开发商家账号为 `admin`，示例口令为 `scanorder-admin`，仅用于本机。生产环境必须生成并配置自己的 `ADMIN_PASSWORD_HASH`。

根目录 `.env` 配置：

| 变量                     | 默认示例                                                    | 说明                                       |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`           | `postgresql://scanorder:scanorder@127.0.0.1:5432/scanorder` | PostgreSQL 连接                            |
| `PORT`                   | `3000`                                                      | 后端端口                                   |
| `HOST`                   | `127.0.0.1`                                                 | 后端监听地址                               |
| `UPLOAD_DIR`             | `./uploads`                                                 | 相对项目根目录的图片目录，也可使用绝对路径 |
| `ADMIN_USERNAME`         | `admin`                                                     | 商家后台账号                               |
| `ADMIN_PASSWORD_HASH`    | `scrypt$盐$哈希`                                            | 商家口令哈希，生产环境必填                 |
| `CUSTOMER_LOGIN_ENABLED` | `true`                                                      | 是否开放固定顾客一键登录                   |
| `CUSTOMER_ACCOUNT_ID`    | `default-customer`                                          | 顾客会话及订单归属标识                     |
| `CUSTOMER_ACCOUNT_NAME`  | `顾客`                                                      | 顾客端展示名称                             |
| `COOKIE_SECURE`          | 生产环境默认为 `true`                                       | 会话 Cookie 是否只通过 HTTPS 发送          |

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

`apps/api/src` 按职责划分为 `auth`、`categories`、`config`、`database`、`foods`、`orders`、`storage` 和 `import`。根模块只负责组合；商家与顾客会话分别校验，分类、商品和订单拥有各自模块、实体、DTO、映射及 Repository。图片格式校验和本地文件读写统一由存储模块提供。

商家名称、公告、地址和默认桌号集中在共享包 `SHOP` 常量中。购物车以菜品 UUID 区分同名商品，只在当前 H5 会话的内存中保留。刷新页面会重置购物车和人数，数据库中的订单不受影响。

商品新增与恢复后默认下架，商家上架后才进入顾客菜单。分类按后台维护顺序展示，仍有关联商品的分类不能删除。归档商品和下线前生成的历史订单快照保留在数据库中。

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
