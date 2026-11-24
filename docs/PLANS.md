# 计划与变更流程

按 [OpenSpec 新建条件](../AGENTS.md#openspec-新建条件) 自行判断是直接处理、沿用已有变更还是新建。OpenSpec 是正式行为规范和执行计划的唯一来源，制品包括 proposal、specs、design 和 tasks。有对应的[手写业务原稿](product/)时，AI 在提案中链接原稿并形成可验收的工程制品。

任务按依赖推进，测试和文档随相应实现落地，实际完成并验证后才勾选。已有用户实施授权可直接承接。归档前核对跟踪任务、实际证据和未验证项，再按工作流同步规范。

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

Windows CI 运行 `node scripts/harness/verify.mjs windows-ci`，覆盖类型、静态检查、构建、单元测试和工程门禁。Ubuntu CI 运行 `pnpm verify`，额外使用临时 PostgreSQL 检查迁移生成的数据库文档。本地 `pnpm verify` 与 `pnpm verify:full` 均包含该检查。

`pnpm check:spec` 执行严格校验，并将与当前正式规范冲突的归档提示视为失败。修改已有要求时，从正式规范复制完整要求及场景后编写增量。归档仍需核对任务、实测证据和合并后的正式规范。

### 主分支合入

1. 通过 PR 提交变更，在 PR 中记录待合入版本、相关验证和链接，确认该版本对应的 **Harness 合入检查** 已通过。汇总检查覆盖 Windows 和 Ubuntu 基础验证、PostgreSQL、Chromium 和隔离遥测。
2. 数据迁移、权限或身份边界、生产配置或发布、合入规则变更需在 PR 中记录风险、回退办法及维护者的人工批准。变更实质更新后重新确认受影响的批准和检查。
3. 当前 GitHub 私有仓库的套餐不支持规则集，维护者须按以上流程人工把关。仓库支持主分支保护后，要求 PR 与必需状态检查 **Harness 合入检查**，并启用人工审批。核对失败检查和缺少审批时的实际阻止结果，再登记启用。

### 测试入口

- 共享包的金额工具测试见 [contracts/test](../packages/contracts/test)。
- 后端测试见 [单元测试](../apps/api/test/unit.test.ts) 和 [真实 PostgreSQL 集成测试](../apps/api/test/integration.test.ts)。
- 前端的组件及购物车测试见 [web/src/test](../apps/web/src/test)。
- 浏览器主流程和移动端布局见 [Playwright 用例](../tests/e2e/ordering.spec.ts)，视觉核对项见 [设计与交互原则](DESIGN.md)。

运行命令见 [根 README](../README.md#检查与测试)。交付时记录实测命令、结果及未验证项，注明失败来自环境或实现。计划任务的验收证据随 OpenSpec 变更保存。

## 知识更新

各专题的入口见 [知识索引](README.md)。`pnpm docs:generate` 生成数据库结构文档，`pnpm check:generated` 校验生成结果。`pnpm check:knowledge` 检查与实现关联的工程文档来源。确认来源变化对单篇文档的影响后，执行如 `pnpm docs:ack docs/FRONTEND.md`。只有首次建立并核实全部基线时使用 `--all`，不得用它掩盖未核实的来源变化。

知识索引登记手写业务原稿目录。新增原稿可以直接放入目录，文档检查会核对其中的仓库内链接。

## 隔离维护与演练

维护使用 `$harness-maintain`，先用 `pnpm harness:workspace create` 创建源码快照和独立 worktree，在其中完成修改与相关验证，再用 `pnpm harness:workspace patch 编号` 导出相对快照的本轮补丁。实际环境文件、上传数据和运行目录排除在快照外。补丁不自动应用回主工作区，提交推送由用户控制。

本机周期维护启用时按工作日北京时间 09:00 运行，每轮最多一个明确问题、两轮修复和三十分钟。暂停时记录已知原因、状态和恢复条件。经用户授权恢复后核对首次触发、实际报告及补丁状态。当前状态和任务度量见[质量记录](QUALITY_SCORE.md)。

| 技能                | 用途                                                     |
| ------------------- | -------------------------------------------------------- |
| `$harness-runtime`  | 按需启动、检查和停止隔离实例                             |
| `$harness-observe`  | 关联日志、指标、追踪和浏览器证据                         |
| `$harness-maintain` | 在独立 worktree 维护知识、修复可复现小问题并交付本地补丁 |
| `$harness-evaluate` | 保存缺陷修复前后证据，完成真实 Agent 演练与独立代码评审  |

依据包括 `openspec/config.yaml`、`.github/workflows/harness.yml`、`scripts/harness/check-spec.mjs`、`scripts/harness/verify.mjs`、`scripts/harness/settings.json` 和 `scripts/harness/workspace.mjs`。
