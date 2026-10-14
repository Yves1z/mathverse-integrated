# 整理后的目录与维护约定

日期：2026-10-12。当前项目根目录 `D:\Mathverse`。

```text
Mathverse/
├─ src/
│  ├─ main.tsx                 场景入口
│  ├─ projectCatalog.ts       历史样片地址兼容表
│  └─ mathverse/
│     ├─ catalog/             分类浏览页
│     ├─ scene/ motion/ config/
│     ├─ content/ windows/ reading/
│     ├─ experiments/
│     │  ├─ layered/
│     │  ├─ inversion/
│     │  ├─ fusion/
│     │  ├─ megastructure/
│     │  └─ abyss/
│     └─ shared/
│        ├─ rendering/
│        ├─ projection/
│        ├─ math/
│        ├─ reading/
│        └─ styles/
├─ docs/
│  ├─ overview.md             分类与版本关系
│  ├─ design/                 主执行方案与概念讨论
│  ├─ entrance/ interaction/ worlds/
│  ├─ spaces/                 与场景家族同名的文档目录
│  ├─ environment/            工具审计、验证与原环境备份
│  ├─ history/                完整历史日志
│  └─ maintenance/            迁移清单和整理验证
├─ artifacts/
│  ├─ entrance/ interaction/ worlds/
│  ├─ spaces/                 与场景家族同名的样片目录
│  ├─ design/                 原概念图
│  └─ archive/sources/        早期完整源码快照
├─ scripts/
│  ├─ entrance/ interaction/ worlds/
│  ├─ spaces/                 与场景家族同名的验证脚本
│  ├─ environment/
│  └─ maintenance/
├─ public/                    公开静态资源与可运行草图
├─ dist/                      可重新构建的生产输出
├─ node_modules/              现有开发依赖
└─ temp/                      工具临时目录
```

每个样片目录中保留正式截图、已命名演示录像、最终验证摘要和必要时序记录。部分早期目录里的 `source-baseline/` 是局部源码基线片段，与所属研究一起保留，不把它们当成当前可独立编译的模块。

新源码按场景家族或共享能力归位；新增样片、报告与检查脚本采用相同分类。不要再次把所有返修堆入一个 `revision` 目录，也不要仅因文件属于旧版就删除仍有审美比较、恢复或验证用途的内容。

本次迁移清单为 `reorganization-2026-10-12.json`。清理仅针对已有命名完成版、未被任何页面引用的原始录屏中间文件，以及一次性工具探针和诊断日志。原环境备份含恢复用途，继续保留。最终清理数量和字节数以清单实际执行结果为准。

旧场景 URL 保持原样；旧样片 URL 通过 Vite 配置和中央映射跳转到分类目录，避免历史对话和打开的收藏地址失效。文档与源码引用已同步迁移。
