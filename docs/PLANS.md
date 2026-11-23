# 计划与变更流程

按 [OpenSpec 新建条件](../AGENTS.md#openspec-新建条件) 自行判断是直接处理、沿用已有变更还是新建。OpenSpec 是行为规范和执行计划的唯一来源，制品包括 proposal、specs、design 和 tasks。本目录的活动和完成计划导航根据 OpenSpec 变更生成。

任务按依赖推进，测试和文档随相应实现落地，实际完成并验证后才勾选。已有用户实施授权可直接承接。归档前核对跟踪任务、实际证据和未验证项；同步规范后重新生成阅读视图。

起草计划时写清目标、范围和受影响模块，列出可验证的验收条件。有部署或数据风险时补充回退办法。执行中在对应的 OpenSpec 变更里记录进度、决策和验证结果。

本工程参考 [OpenAI Harness Engineering 实践](https://openai.com/index/harness-engineering/)，工程命令见 [README](../README.md)，领域知识见 [知识索引](README.md)，资源清理和排障见 [RELIABILITY](RELIABILITY.md)。

## OpenSpec 工作流

项目技能位于 `.agents/skills`，Codex 使用技能名调用：

| 技能                       | 用途                                  |
| -------------------------- | ------------------------------------- |
| `$openspec-explore`        | 只读调查、澄清需求与约束              |
| `$openspec-propose`        | 创建 proposal、design、specs 和 tasks |
| `$openspec-update-change`  | 同步修订已有方案制品                  |
| `$openspec-apply-change`   | 根据已授权方案实施并记录验收证据      |
| `$openspec-sync-specs`     | 将已完成变更的增量规范同步到正式规范  |
| `$openspec-archive-change` | 检查任务和验收状态，归档完成变更      |

先核实已有规范和代码，解决影响范围或验收的关键疑问，再生成制品。不因切换技能再次索取已获得的相同授权。

```powershell
pnpm exec openspec list --specs
pnpm exec openspec list
pnpm exec openspec status --change 变更名称
pnpm exec openspec validate --all --strict --no-interactive
```

正文使用中文，保留 OpenSpec 校验所需的结构标题和 SHALL／MUST 等机器标记。仅修改实现或文档、未改变可观察行为时，可使用标准 `skip_specs: true`，不要为了通过校验虚构业务需求。

中文技能是基于 OpenSpec 2.1.0 的项目定制。升级时先检查版本和差异，先在临时目录验证生成结果，再有选择地合并到项目；新版 `init`／`update` 可能清理用户级旧提示词，不能在本项目盲目重新初始化。项目依赖升级与全局 CLI 升级分别处理。

## 验证分级

| 变更                            | 本地验收                                          |
| ------------------------------- | ------------------------------------------------- |
| 普通前端小改动                  | 按影响范围验证，无需额外代码检查和视觉验证        |
| 文档或工作流                    | `check:docs`，涉及规范时追加 `check:spec`         |
| 跨包、类型、工程配置和计划任务  | `verify` 及计划约定的相关检查                     |
| API、事务、迁移、图片存储和导入 | 相关单测、构建及真实 PostgreSQL 集成测试          |
| 下单、上传等完整业务链路        | 使用隔离数据的 `test:e2e`                         |
| 设计稿还原                      | 使用内置浏览器在 localhost 对照设计稿进行视觉校验 |

CI 每次 push、PR 或手动触发均执行完整自动检查。自动浏览器截图只证明自动化步骤执行，不替代人工对照设计稿。

### 测试入口

- 共享包的金额工具测试见 [contracts/test](../packages/contracts/test)。
- 后端测试见 [单元测试](../apps/api/test/unit.test.ts) 和 [真实 PostgreSQL 集成测试](../apps/api/test/integration.test.ts)。
- 前端的组件及购物车测试见 [web/src/test](../apps/web/src/test)。
- 浏览器主流程和移动端布局见 [Playwright 用例](../tests/e2e/ordering.spec.ts)，视觉核对项见 [设计与交互原则](DESIGN.md)。

运行命令见 [根 README](../README.md#检查与测试)。交付时记录实测命令、结果及未验证项，注明失败来自环境或实现。计划任务的验收证据随 OpenSpec 变更保存。

## 知识更新

各专题的入口见 [知识索引](README.md)。生成资料和来源检查分别使用 `pnpm check:generated`、`pnpm check:knowledge`；确认来源变化对单篇文档的影响后执行如 `pnpm docs:ack docs/FRONTEND.md`。只有首次建立并核实全部基线时使用 `--all`，不得用它掩盖未阅读的来源变化。

## 隔离维护与演练

维护使用 `$harness-maintain`，先用 `pnpm harness:workspace create` 创建源码快照和独立 worktree，在其中完成修改与相关验证，再用 `pnpm harness:workspace patch 编号` 导出相对快照的本轮补丁。实际环境文件、上传数据和运行目录排除在快照外。补丁不自动应用回主工作区，提交推送由用户控制。

本机周期维护在手动演练通过后启用，按工作日北京时间 09:00 运行；每轮最多一个明确问题、两轮修复和三十分钟。历史验收入口见 [质量记录](QUALITY_SCORE.md)，当前启用与实际触发状态以原生自动化记录为准。

| 技能                | 用途                                                     |
| ------------------- | -------------------------------------------------------- |
| `$harness-runtime`  | 按需启动、检查和停止隔离实例                             |
| `$harness-observe`  | 关联日志、指标、追踪和浏览器证据                         |
| `$harness-maintain` | 在独立 worktree 维护知识、修复可复现小问题并交付本地补丁 |
| `$harness-evaluate` | 保存缺陷修复前后证据，完成真实 Agent 演练与独立代码评审  |

依据：`openspec/config.yaml`、`scripts/harness/verify.mjs`、`scripts/harness/settings.json`、`scripts/harness/workspace.mjs`。
