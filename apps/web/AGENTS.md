# 前端约定

- 遵循 [根级工程入口](../../AGENTS.md) 和 [架构地图](../../ARCHITECTURE.md)。
- 页面位于 `src/pages`，请求集中在 `src/api.ts`，购物车状态由 reducer 与 Context 管理。
- 使用 `@scanorder/contracts` 公开类型与金额工具，不引用后端源码、实体或服务端依赖。
- 保留 H5 橙色风格及宽屏居中行为，金额展示由共享工具完成。
- 已有测试：`pnpm --filter @scanorder/web test`；真实下单和上传链路：根目录 `pnpm test:e2e`。
- 普通小改动按需验证；按计划执行或大型任务覆盖相关交互。设计稿还原使用内置浏览器对照，访问 `localhost`。
