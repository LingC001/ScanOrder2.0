# 共享包约定

- 遵循 [根级工程入口](../../AGENTS.md) 和 [架构地图](../../ARCHITECTURE.md)。
- 只提供平台无关的业务类型、常量和纯函数，经 `package.json` 的 `exports` 暴露。
- 不依赖应用、React、NestJS、数据库、Node.js 内置模块或浏览器专用全局变量。
- 金额使用整数分，复用现有金额边界和转换函数。
- 变更公开类型后检查前后端调用方；行为测试为 `pnpm --filter @scanorder/contracts test`，跨包验证为根目录 `pnpm typecheck`。
