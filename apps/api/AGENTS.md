# 后端约定

- 遵循 [根级工程入口](../../AGENTS.md) 和 [架构地图](../../ARCHITECTURE.md)。
- 使用当前 NestJS 模块划分。控制器负责 HTTP／DTO，服务负责业务、Repository 和事务；控制器不直接导入实体或 ORM。
- 跨业务模块使用目标模块的公开入口，实体注册、批量导入和 ORM 关联按[架构约定](../../ARCHITECTURE.md#后端装配)使用。
- 金额以整数分保存和计算，订单总价由服务端确定；订单明细保留快照，订单及明细原子保存。
- 图片校验和文件读写复用 `storage`；数据库失败后按已有机制清理本次写入的图片。
- 表结构通过显式迁移修改；不重置开发数据或自动改写已执行迁移。
- 单元测试：`pnpm --filter @scanorder/api test`；真实数据库验收：根目录 `pnpm test:integration`，它会创建独立临时数据库。
- 修改共享接口时同步检查前端、DTO、映射和集成测试，接口定义以 [共享类型](../../packages/contracts/src/index.ts)、控制器和 [集成测试](test/integration.test.ts) 为依据。
