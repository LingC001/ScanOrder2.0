---
name: harness-runtime
description: 启动、检查和停止 ScanOrder 的隔离运行实例，用于完整业务复现或多 worktree 验证。
---

# harness-runtime

读取 [工程入口](../../../AGENTS.md) 和 [使用说明](../../../README.md)。

执行 pnpm harness:up，读取返回的实例编号和 localhost 地址。每个实例拥有临时数据库、上传目录和观测容器。通过 harness:status 核对就绪状态；失败时读取 process.log，不能将启动命令发出当作启动成功。结束后执行 harness:down 实例编号，读取清理结果。不得停止其他数据库、容器或按通用进程名批量终止程序。
