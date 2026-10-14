# 数海 Mathverse

2026-10-12 本地整合版：以 2026-09-23 开发基线为底，合并最新 Math Agent、手写草稿和第二版莫比乌斯小兽，同时纳入星空/飞船原型与完整四维主页研究。保留基线的命名、试卷界面、难度配置、管理员权限及 V1～V20 迁移。

- [完整对比与整合说明](docs/integration/INTEGRATION_REPORT.md)
- [逐文件清单](docs/integration/FILE_COMPARISON.csv)
- [GitHub 上传与 LFS](docs/GITHUB_UPLOAD.md)

统一启动：Node.js 24.12+；在根目录运行 `npm run install:all`、`npm run dev`。主站 5173，四维目录 5184/studies/，全部设计目录 5500。后端仍按下文单独启动。两个前端各自保留锁文件，Vue/Excalidraw 与 React/Three.js 的依赖版本独立管理。

高考数学题库，包含题目上传与审核、自由组卷、试卷分享、个人学习统计、错题及用户等级。

交接分支：`handoff/dev-baseline-20260923`（本分支，当前开发基线）。上一版交接见 `handoff/original-paper-versions-20260914`，那一版新增了按上传归属自动整理原卷、疑似重复题提示与复用、管理员核验发布及不可改写的试卷版本。

本分支在其之上完成了试卷模块的一轮界面改版：试卷详情页直接渲染整张打印卷面、试卷库与「我的试卷」列表重排、组卷页三栏权重与工具条整理，浏览器测试同步更新。与上一版交接分支的逐文件差异可用 GitHub 的 compare 视图查看。

## 从这里开始

- [完整本地开发与交接说明](docs/DEVELOPMENT.md)：环境、启动、管理员、测试与代码入口。
- [本次交接记录](docs/HANDOFF.md)：线上版本、验证结果及后续工作边界。
- [部署说明](deploy/README.md)：发布包、服务器布局、备份与回滚限制。
- [原卷整理说明](docs/original-papers.md)：操作入口、核验规则、版本锁定与查重范围。
- [等级规则](docs/user-growth.md)：测试期经验与等级配置。
- [题目上传规则 1.4](frontend/public/docs/题目上传规则1.4.md) 与 [MD 模板](frontend/public/docs/题目模板1.4.md)。
- [内容初审与反馈操作](frontend/public/docs/内容初审与反馈说明.md)。
- [Mathverse AI 学习助手开发计划](docs/AI_ASSISTANT_PLAN.md)：长期路线、阶段状态、架构约定与验收标准。

## 项目结构

```text
backend/       Java 21 / Spring Boot，PostgreSQL、Redis、Flyway V1～V20
frontend/      Vue 3 / JavaScript / Vite，KaTeX，单元与浏览器测试
docs/          开发交接文档
deploy/        发布打包、已有服务器升级脚本及服务配置参考
.github/       自动化构建与测试
```

项目交付保留代码、依赖锁文件、配置、迁移、有效测试与必要文档。测试截图、临时测试报告、覆盖率报告、构建产物与 Vite 缓存不属于源码，可重新生成，清理后无需提交。宣传视频及制作素材不纳入此仓库。安装的依赖和本地数据库是开发环境数据；数据库目录不能当作测试记录清空。

请克隆整个仓库：前端和后端共用 `backend/src/main/resources/tag-taxonomy.json`。唯一维护中的前端目录是 `frontend/`。

## 快速启动

准备 JDK 21、Maven 3.9+、Node.js 22.18+ 和 Docker。分别在两个终端运行：

```sh
cd backend
docker compose up -d
mvn spring-boot:run
```

```sh
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:5173`。数据库由迁移自动初始化，不需要生产数据或本机 TEST 文件夹。测试与生产构建命令见开发说明。

本分支从 `handoff/original-paper-versions-20260914` 继续，包含完整前后端代码；没有合并其他成员分支或改写历史。运行数据、密钥、依赖缓存、旧 `frontend-vue/` 和本机参考资料不纳入版本控制。

后续修改请新增 Flyway 迁移，不要改写 V1～V20。V19 增加动态来源目录、来源别名归一化，以及原卷整卷来源/年份更正。PDF 上传仍等待配置 OSS；现有站内组卷分享、原卷整理和版本发布不依赖 OSS。查重目前采用规则提示与人工确认，不包含 OCR 或 AI 自动识别。
