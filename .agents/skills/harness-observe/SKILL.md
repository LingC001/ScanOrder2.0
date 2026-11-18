---
name: harness-observe
description: 用隔离实例的日志、指标、追踪和浏览器证据诊断 ScanOrder 问题。
---

# harness-observe

读取 [工程入口](../../../AGENTS.md) 和 [使用说明](../../../docs/RELIABILITY.md)。

先使用 harness:status 找到准确实例；多实例时显式指定编号。harness:query logs/metrics/traces 实例编号 查询表达式 读取实际后端。诊断同一次请求时关联 x-request-id、traceparent、日志 traceId 和数据库 span。浏览器访问状态提供的 localhost 地址，保留 DOM、控制台、截图及 Playwright trace；设计还原仍使用内置浏览器。没有数据或超时时报告未验证，不把配置存在当作采集成功。
