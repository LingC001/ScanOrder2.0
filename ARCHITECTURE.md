# 架构地图

本文件描述当前代码的职责和依赖边界。工程入口见 [AGENTS.md](AGENTS.md)，文档导航见 [知识索引](docs/README.md)。

## 包与调用方向

```text
apps/web ──公开类型与金额工具──> packages/contracts
    │ HTTP /api、图片 /images、HttpOnly 会话 Cookie
    ▼
apps/api ──公开类型与金额工具──> packages/contracts
    │ TypeORM Repository / 事务
    ▼
PostgreSQL 18；本地图片存储
```

- `apps/web`：移动点餐 H5 与响应式商家后台。[路由](apps/web/src/App.tsx)分别处理顾客会话和 `/admin`，[购物车状态](apps/web/src/CartProvider.tsx)和请求封装位于前端。前端不能引用后端源码或服务端依赖。
- `apps/api`：NestJS HTTP 服务、身份会话、分类、菜品和订单、文件存储、显式数据库迁移及导入工具，不能引用前端源码。
- `packages/contracts`：[公开业务类型、商家常量和纯金额工具](packages/contracts/src/index.ts)，不依赖应用或 Node.js／浏览器运行时专用 API。
- 跨包导入使用包的公开 `exports`；禁止通过相对路径或包子路径绕过公开入口。工作区包依赖不得成环。

## 后端装配

- `config` 提供环境配置；`database` 装配 TypeORM、实体、迁移和整数转换器。
- `auth` 集中维护商家与顾客会话；`categories`、`foods` 和 `orders` 各自拥有控制器、DTO、服务、实体及映射。控制器处理 HTTP、守卫和 DTO，把持久化与事务交给服务。
- `storage` 负责图片内容校验、命名和文件读写；`import` 复用菜品实体、DTO 与存储能力。
- 根模块组合各模块。数据库注册实体、订单关联菜品实体、订单实体之间的关系均为现有合法依赖，不套用禁止所有文件循环的规则。
- `check:architecture` 自动约束包边界、平台依赖和控制器对实体／ORM 的直接依赖；其余业务约束由类型与行为测试验证。

[服务入口](apps/api/src/main.ts) 启动 [应用工厂](apps/api/src/app.ts) 创建的应用，该工厂注册全局校验和图片静态路由，集成测试通过同一工厂注入隔离数据库。模块组合见 [AppModule](apps/api/src/app.module.ts)。旧菜品以 `legacyId` 匹配已有记录，入口见 [导入实现](apps/api/src/import/foods-importer.ts)。

## 数据约束

- 金额统一以整数“分”表示，格式化和元转分使用共享工具；服务端查询实际价格计算订单总额。
- 订单和明细在同一事务内保存，明细保留下单时的名称、图片与价格快照。
- 订单保存顾客归属及待接单、已接单、已完成、已取消状态，商家状态变更在事务内锁定订单行。
- 商品通过分类 UUID 关联独立分类；上下架和归档状态控制顾客菜单可见性，删除分类受商品外键约束。
- 共享包公开 HTTP 类型，实体留在后端；修改请求／响应时同步更新调用方、DTO、映射和测试。
- 购物车以菜品 UUID 为标识，保存在当前页面会话内存中。
- 数据库使用显式迁移，关闭自动同步；测试使用独立临时实例和上传目录，不复用开发数据。

迁移注册见 [数据源](apps/api/src/database/data-source.ts)，现行表结构见 [数据库结构](docs/generated/db-schema.md)。顾客操作与业务边界见 [首次点餐流程](docs/product-specs/new-user-onboarding.md)。

## 工程反馈

检查器位于 `scripts/harness`，行为测试位于 `tests/harness`。失败信息包含文件、规则及修复建议；验证结果写入忽略的 `.local/harness`。CI 执行相同命令，入口见 [README](README.md)，验证流程见 [PLANS](docs/PLANS.md)，诊断与排障见 [RELIABILITY](docs/RELIABILITY.md)。
