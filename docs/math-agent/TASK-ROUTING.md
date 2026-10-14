# Math Agent Task Routing

Use the minimum relevant specification set; do not load every specification by default.

当前实施优先级遵循 `UI 骨架 → 最小功能闭环 → 教学策略 → 完善 Context Engine → 长期学习 Agent`。如果任务对应的用户行为入口尚不存在，先完成或定义 UI 入口；除正确性、安全性和已有闭环所需工作外，后台能力只记录接口与 TODO，不提前完整工程化。

| Task | Required reading |
|---|---|
| 基础 AI UI 按钮 / 输入区 / 空态 / 加载 / 错误 / 取消 | `00`, `03`; add `01` for hint/reveal labels and `04` for draft input |
| 将已有 UI 按钮接入最小真实闭环 | `00`, `03`, `05`; add the intent-specific spec only |
| Hint / “再提示一点” / progressive help | `00`, `01`, `03`, `05`; add `10` for user-facing flow |
| Explain a selected solution step | `00`, `03`, `05`; add `02` for verification or visualization |
| Explain motivation / method choice | `01`, `02`, `03`, `05` |
| LaTeX draft diagnosis | `02`, `03`, `04`, `05` |
| Handwriting or paper draft | `02`, `03`, `04`, `08` |
| Find first error / logical gap | `01`, `02`, `03`, `04` |
| Visualization | `00`, `02`, `03` |
| Strategy map / compare methods | `00`, `02`, `03` |
| Personalized explanation | `03`, `05`, `06` |
| Tool-calling orchestration | `00`, `02`, `07`, `08` |
| Provider or reasoning-level work | `00`, `07`, `08` |
| Similar/adaptive practice | `02`, `03`, `06`, `09` |
| User journey / visible focus / actions / cancellation / recovery | `00`, `03`, `07`, `10`; add `05` for target correction |
| Learning mode UI / help control | `01`, `06`, `07`, `10` |
| Evaluation or regression tests | relevant active specs plus `09` |

Numbers refer to the matching files in this directory. Draft files describe boundaries only and must not be treated as completed designs.

不要因为实现一个基础按钮而默认加载或实施 `06`、`07`、`08` 的完整目标架构；只有该按钮的当前闭环确实需要学习状态、运行时编排或 Provider 能力时，才增量读取并实现相应部分。
