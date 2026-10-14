# Mathverse 主页动效研究

统一分类入口：[动效研究目录](http://127.0.0.1:5184/studies/)。

当前整体视觉基准是 [参考图巨构](http://127.0.0.1:5184/space-a/reference/)。[深井与欧拉](http://127.0.0.1:5184/space-a/abyss/euler/) 是独立节点研究，尚未与旧巨构融合；融合边界、尺度和进入路径待讨论。

## 文件入口

| 目录 | 内容 |
|---|---|
| `src/mathverse/scene`、`motion`、`config` | 白色入口、拱门、镜头与基础配置 |
| `src/mathverse/content`、`windows`、`reading` | 数学内容、人物故事、窗口与阅读 |
| `src/mathverse/experiments` | 按 layered／inversion／fusion／megastructure／abyss 分类的场景研究 |
| `src/mathverse/shared` | 共用渲染、投影、数学几何、阅读叠加与样式 |
| `docs` | 按主题归档的方案、讨论和报告 |
| `artifacts` | 按同一主题归档的实际画面、命名录像、验证摘要与源码快照 |
| `scripts` | 按同一主题归档的模型验证、网页检查、抓图及维护工具 |

详见 [分类与版本关系](docs/overview.md)、[目录说明](docs/maintenance/folder-guide.md)、[原执行方案](docs/design/Mathverse-主页动效设计与Agent执行方案.md)。逐次实施记录保留在 [历史日志](docs/history/iteration-log.md)。

## 在任意目录运行

打开 PowerShell，执行：

```powershell
npm ci
npm run dev
```

网页服务为 `http://127.0.0.1:5184/`，生产构建用 `npm run build`。要求 Node.js 24.12+。活动检查脚本已改为从自身位置解析项目目录，不依赖原电脑 D 盘。历史报告中的 D 盘路径是原验收记录。

新检查示例：

```powershell
node scripts/spaces/megastructure/reference-light.model.test.mjs
node scripts/spaces/abyss/abyss-euler.model.test.mjs
```

旧场景地址保持不变，旧 `/artifacts/版本名/…` 地址会跳转到新的分类位置。最终演示、设计图、源码快照、验证摘要及安装前环境备份保留；本次清理依据见 [迁移清单](docs/maintenance/reorganization-2026-10-12.json)。
